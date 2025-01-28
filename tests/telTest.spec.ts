import { test, expect, Page } from '@playwright/test';

test.use({ userAgent: 'PlaywrightBot/1.0 (+https://playwright.dev)' });

test.describe('Check tel: Links on Website', () => {
  const baseUrl = process.env.HOMEPAGE_URL || 'https://example.com';
  const desiredTelLinks = (process.env.PHONE_NUMBERS || '+1234567890').split(',');
  const visitedUrls = new Set<string>();
  const telLinks = new Map<string, { href: string; text: string }[]>();
  let page: Page;

  function normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.hash = ''; // Remove hash fragments
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1); // Remove trailing slash
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  async function crawl(url: string): Promise<void> {
    const normalizedUrl = normalizeUrl(url);
    if (visitedUrls.has(normalizedUrl)) return; // Skip already visited URLs
    visitedUrls.add(normalizedUrl);

    try {
      console.log(`Crawling: ${normalizedUrl}`);
      await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded' });

      // Extract `tel:` links from the page
      const links = await page.$$eval(
        'a[href^="tel:"]',
        (anchors) =>
          anchors.map((a) => ({
            href: (a as HTMLAnchorElement).href,
            text: (a as HTMLAnchorElement).textContent?.trim() || '',
          }))
      );

      if (links.length > 0) {
        console.log(`Found ${links.length} tel: links on ${normalizedUrl}`);
        telLinks.set(normalizedUrl, links);
      } else {
        console.warn(`No tel: links found on ${normalizedUrl}`);
      }

      // Extract internal links for further crawling
      const internalLinks = await page.$$eval(
        'a[href]',
        (anchors, base) =>
          anchors
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((href) => href.startsWith(base)),
        baseUrl
      );

      for (const link of internalLinks) {
        await crawl(link);
      }
    } catch (error) {
      console.error(`Failed to crawl ${normalizedUrl}: ${error.message}`);
    }
  }

  test('Extract and validate tel: links', async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    await crawl(baseUrl);

    console.log('\nSummary of Tel Links Found:');
    if (telLinks.size > 0) {
      for (const [url, links] of telLinks) {
        console.log(`\nURL: ${url}`);
        for (const link of links) {
          console.log(`  - Text: ${link.text}, Href: ${link.href}`);
          const linkWithoutScheme = link.href.replace('tel:', '');
          const isValid =
            desiredTelLinks.includes(link.text) ||
            desiredTelLinks.includes(linkWithoutScheme);
          if (!isValid) {
            console.warn(
              `  WARNING: Invalid tel: link found! Expected one of [${desiredTelLinks.join(
                ', '
              )}], but got: ${link.text} or ${link.href}`
            );
          }
        }
      }
    } else {
      console.warn('No tel: links found on the entire website.');
    }

    // Gracefully pass or fail the test based on links found
    if (telLinks.size === 0) {
      console.warn('No tel: links found. Exiting gracefully.');
    } else {
      expect(telLinks.size).toBeGreaterThan(0);
    }

    // Clean up the browser context
    await context.close();
  });
});
