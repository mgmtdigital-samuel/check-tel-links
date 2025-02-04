import { Page } from '@playwright/test';

export async function blockTrackingScripts(page: Page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const blockedDomains = [
      'googletagmanager.com',
      'google-analytics.com',
      'gtag/js',
      'analytics.js',
      'tctm.co',
      'callrail.com',
      'js.callrail.com',
    ];

    if (blockedDomains.some((domain) => url.includes(domain))) {
      console.log(`🚫 Blocking tracking script: ${url}`);
      return route.abort();
    }

    return route.continue();
  });
}