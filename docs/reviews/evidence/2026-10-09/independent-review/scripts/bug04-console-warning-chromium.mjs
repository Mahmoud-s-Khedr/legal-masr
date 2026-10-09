/* global console */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({ timezoneId: 'Africa/Cairo' });
const msgs = [];
page.on('console', (m) => {
  if (['warning', 'error'].includes(m.type())) msgs.push(m.text().slice(0, 260));
});
await page.goto('http://127.0.0.1:4173/settings?tab=general&captureLocale=en');
await page.waitForSelector('.settings');
await page.waitForTimeout(1500);
console.log('console warnings on deep link:', JSON.stringify(msgs, null, 1));
await b.close();
