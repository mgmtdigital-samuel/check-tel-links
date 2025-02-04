import { test, expect } from '@playwright/test';
import { crawlSite } from './crawler';
import { blockTrackingScripts } from './blockers'; // Import blocking module

test.use({ userAgent: 'PlaywrightBot/1.0 (+https://playwright.dev)' });

test.describe('Check tel: Links on Website', () => {
  const baseUrl = process.env.HOMEPAGE_URL || 'https://example.com';
  const desiredTelLinks = (process.env.PHONE_NUMBERS || '+1234567890').split(',');
  const homepageOnly = process.env.HOMEPAGE_ONLY === 'true';
  const topLevelOnly = process.env.TOP_LEVEL_ONLY === 'true';

  // Function to generate the two valid formats for a phone number
  function generateAllowedFormats(phone: string): string[] {
    const digitsOnly = phone.replace(/\D/g, ''); // Remove non-numeric characters

    if (!digitsOnly.startsWith('1')) {
      return []; // Ensure it includes country code (1 for US)
    }

    return [
      `+${digitsOnly}`, // Format: +18888888888
      `+1-${digitsOnly.slice(1, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`, // Format: +1-888-888-8888
      `1-${digitsOnly.slice(1, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`, // Format: 1-888-888-8888
    ];
  }

  test('Extract and validate tel: links', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

  // Apply tracking blockers
  await blockTrackingScripts(page);

    console.log(
      homepageOnly
        ? '🏠 Running in homepage-only mode'
        : topLevelOnly
        ? '📄 Running in top-level pages mode'
        : '🌎 Crawling the entire website'
    );

    const telLinks = await crawlSite(baseUrl, page, homepageOnly, topLevelOnly);
    const errors: string[] = [];

    // Generate allowed variations for each expected phone number
    const validPhoneVariations = new Set(
      desiredTelLinks.flatMap((num) => generateAllowedFormats(num))
    );

    console.log('\nSummary of Tel Links Found:');
    if (telLinks.size > 0) {
      for (const [url, links] of telLinks) {
        console.log(`\n🔍 URL: ${url}`);
        for (const link of links) {
          console.log(`  - 📞 Text: ${link.text}, Href: ${link.href}`);
          const extractedNumber = link.href.replace('tel:', '').trim();

          // Check if extracted number matches one of the two allowed formats
          const isValid = validPhoneVariations.has(extractedNumber);

          if (!isValid) {
            const errorMessage = `❌ ERROR: Invalid tel: link found on ${url} - Expected one of [${Array.from(validPhoneVariations).join(
              ', '
            )}], but got: ${link.text} or ${link.href}`;
            console.error(errorMessage);
            errors.push(errorMessage);
          }
        }
      }
    } else {
      console.warn('❌ No tel: links found on the entire website.');
      errors.push('No tel: links found.');
    }

    // If errors were found, fail the test but show all issues
    expect(errors.length).toBe(0);

    await context.close();
  });
});