import { Page } from '@playwright/test';

export async function crawlSite(
  baseUrl: string,
  page: Page,
  homepageOnly: boolean = false,
  topLevelOnly: boolean = false
): Promise<Map<string, { href: string; text: string }[]>> {
  const visitedUrls = new Set<string>();
  const telLinks = new Map<string, { href: string; text: string }[]>();

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

  async function extractTelLinks(url: string): Promise<void> {
    console.log(`🔍 Checking: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const links = await page.$$eval(
      'a[href^="tel:"]',
      (anchors) =>
        anchors.map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: (a as HTMLAnchorElement).textContent?.trim() || '',
        }))
    );

    if (links.length > 0) {
      console.log(`✅ Found ${links.length} tel: links on ${url}`);
      telLinks.set(url, links);
    } else {
      console.warn(`⚠️ No tel: links found on ${url}`);
    }
  }

  async function crawl(url: string): Promise<void> {
    const normalizedUrl = normalizeUrl(url);
    if (visitedUrls.has(normalizedUrl)) return;
    visitedUrls.add(normalizedUrl);

    await extractTelLinks(normalizedUrl);

    if (homepageOnly) return; // Stop here if only checking the homepage

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
      const linkUrl = new URL(link);
      const pathSegments = linkUrl.pathname.split('/').filter(Boolean); // Remove empty parts

      // Ensure we always include the homepage
      if (topLevelOnly && pathSegments.length > 1) {
        continue; // Skip anything deeper than the first level
      }

      await crawl(link);
    }
  }

  // Always crawl the homepage first in `topLevelOnly` mode
  if (topLevelOnly) {
    await crawl(baseUrl);
  }

  return telLinks;
}