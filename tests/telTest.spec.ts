import { test, expect, Page } from '@playwright/test';

// Use the "PlaywrightBot" user agent for this test suite
test.use({ userAgent: 'PlaywrightBot/1.0 (+https://playwright.dev)' });

test.describe('Check tel: Links on Website', () => {
  // Read inputs from environment variables or use defaults
  const baseUrl = process.env.HOMEPAGE_URL || 'https://pathwaytopeacela.com';
  const desiredTelLinks = (process.env.PHONE_NUMBERS || '+17472813208,747-281-3208').split(',');
  const visitedUrls = new Set<string>();
  const telLinks = new Map<string, { href: string; text: string }[]>();
  let page: Page;

  // Normalize URLs to avoid duplicate crawls for similar URLs
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

  // Recursively crawl internal links
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
        telLinks.set(normalizedUrl, links);
      }

      // Extract internal links for further crawling
      const internalLinks = await page.$$eval(
        'a[href]',
        (anchors, base) => {
          const results: string[] = [];
          anchors.forEach((a) => {
            const href = (a as HTMLAnchorElement).href;
            if (!href || href.includes('#')) return; // Skip empty or anchor links
            if (!href.startsWith(base)) return; // Skip external links
            results.push(href);
          });
          return results;
        },
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
    // Create a new context and page
    const context = await browser.newContext();
    page = await context.newPage();

    await crawl(baseUrl);

    console.log('\nTel Links Found:');
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

    expect(telLinks.size).toBeGreaterThan(0);

    // Clean up the browser context
    await context.close();
  });
});
