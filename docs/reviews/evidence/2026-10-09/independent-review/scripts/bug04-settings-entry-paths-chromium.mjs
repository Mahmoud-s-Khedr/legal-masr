/* global console, window, PopStateEvent, document */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({ timezoneId: 'Africa/Cairo' });
const vals = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('form [data-slot="select-value"]')].map((e) =>
      e.textContent.trim(),
    ),
  );
const base = 'http://127.0.0.1:4173';
const q = '&captureLocale=en';
// (a) full page load straight onto the Display tab
await page.goto(`${base}/settings?tab=general${q}`);
await page.waitForSelector('.settings');
await page.waitForTimeout(1500);
console.log('chromium full-load deep link:', JSON.stringify(await vals()));
// (b) SPA navigation like the auditor's native go(): land on '/', pushState to the deep link
await page.goto(`${base}/?captureLocale=en`);
await page.waitForSelector('.workspace');
await page.waitForTimeout(800);
await page.evaluate(() => {
  window.history.pushState({}, '', '/settings?tab=general&captureLocale=en');
  window.dispatchEvent(new PopStateEvent('popstate'));
});
await page.waitForSelector('.settings');
await page.waitForTimeout(1500);
console.log('chromium SPA pushState deep link:', JSON.stringify(await vals()));
// (c) SPA: sidebar -> Settings -> click Display tab
await page.goto(`${base}/?captureLocale=en`);
await page.waitForSelector('.workspace');
await page.click('nav a[href^="/settings"]');
await page.waitForSelector('.settings');
await page.getByRole('tab').nth(1).click();
await page.waitForTimeout(1000);
console.log('chromium sidebar+tab click:', JSON.stringify(await vals()));
// (d) history.back onto the Display tab
await page.click('nav a[href="/"]');
await page.waitForTimeout(500);
await page.goBack();
await page.waitForSelector('.settings');
await page.waitForTimeout(1200);
console.log('chromium history back:', JSON.stringify(await vals()));
await b.close();
