/* global console, document */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({
  timezoneId: 'Africa/Cairo',
  viewport: { width: 1440, height: 900 },
});
for (const loc of ['en', 'ar']) {
  await page.goto(`http://127.0.0.1:4173/cases/demo-case-14?captureLocale=${loc}`);
  await page.waitForSelector('.workspace');
  await page.getByRole('tab').nth(1).click();
  await page.waitForTimeout(600);
  console.log(
    loc,
    JSON.stringify(await page.locator('.compact-records li').allInnerTexts()),
    'html lang/dir:',
    await page.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir),
  );
}
await b.close();
