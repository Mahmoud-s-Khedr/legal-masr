/* global console, document */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/tasks?captureLocale=en&create=task');
await page.waitForSelector('[role=dialog]');
await page.waitForTimeout(800);
const r = await page.evaluate(() =>
  [...document.querySelectorAll('button[data-slot="input-group-button"]')].map((e) => ({
    html: e.outerHTML.replace(/class="[^"]*"/, 'class=…').slice(0, 400),
    parent:
      e.closest('[data-slot=input-group]')?.querySelector('input')?.getAttribute('aria-label') ??
      e.parentElement.outerHTML.replace(/class="[^"]*"/g, '').slice(0, 300),
  })),
);
console.log(JSON.stringify(r, null, 1));
// accessibility-tree view via Playwright ARIA snapshot
console.log(await page.locator('[role=dialog]').ariaSnapshot());
await b.close();
