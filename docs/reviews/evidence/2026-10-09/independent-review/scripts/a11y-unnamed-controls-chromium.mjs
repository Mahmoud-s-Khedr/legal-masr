/* global console, document */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({
  timezoneId: 'Africa/Cairo',
  viewport: { width: 1440, height: 900 },
});
for (const loc of ['en'])
  for (const p of [
    '/cases/new',
    '/powers-of-attorney/new',
    '/tasks',
    '/finances',
    '/clients',
    '/settings?tab=general',
  ]) {
    await page.goto(`http://127.0.0.1:4173${p}${p.includes('?') ? '&' : '?'}captureLocale=${loc}`);
    await page.waitForSelector('.workspace');
    await page.waitForTimeout(800);
    const bad = await page.evaluate(() => {
      const name = (el) => {
        const lb = el.getAttribute('aria-labelledby');
        if (lb)
          return lb
            .split(' ')
            .map((i) => document.getElementById(i)?.textContent ?? '')
            .join(' ')
            .trim();
        return (
          el.getAttribute('aria-label') ||
          el.textContent ||
          el.getAttribute('title') ||
          (el.labels && [...el.labels].map((l) => l.textContent).join(' ')) ||
          el.getAttribute('placeholder') ||
          ''
        ).trim();
      };
      return [
        ...document.querySelectorAll(
          'button,input,textarea,select,[role=combobox],[role=checkbox],[role=switch]',
        ),
      ]
        .filter((e) => e.getBoundingClientRect().width > 0 && e.type !== 'hidden' && !name(e))
        .map((e) => e.outerHTML.replace(/\s+/g, ' ').slice(0, 170));
    });
    console.log(p, bad.length);
    for (const x of bad) console.log('   ', x);
  }
await b.close();
