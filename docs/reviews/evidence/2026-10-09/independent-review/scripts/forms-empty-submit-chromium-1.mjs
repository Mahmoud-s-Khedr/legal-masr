/* global console, document */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({
  timezoneId: 'Africa/Cairo',
  viewport: { width: 1440, height: 900 },
});
const base = 'http://127.0.0.1:4173';
const q = 'captureLocale=en';
const go = async (p) => {
  await page.goto(`${base}${p}${p.includes('?') ? '&' : '?'}${q}`);
  await page.waitForSelector('.workspace');
  await page.waitForTimeout(700);
};
const probe = async () =>
  page.evaluate(() => {
    const scopes = [...document.querySelectorAll('[role="dialog"]')];
    const s = scopes.length ? scopes.at(-1) : document.body;
    return {
      alerts: [...s.querySelectorAll('[role="alert"]')].map((e) =>
        e.textContent.trim().slice(0, 60),
      ),
      invalid: s.querySelectorAll('[aria-invalid="true"]').length,
      dialog: scopes.length,
    };
  });
const rows = [];
const attempt = async (label, open, submitName) => {
  try {
    await open();
    const dlg = page.locator('[role="dialog"]').last();
    await dlg.waitFor({ timeout: 3000 });
    const btn = dlg.getByRole('button', { name: submitName }).first();
    await btn.click();
    await page.waitForTimeout(500);
    rows.push({ label, ...(await probe()) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) {
    rows.push({ label, error: e.message.split('\n')[0] });
  }
};
await go('/cases/demo-case-14');
const tabs = page.getByRole('tab');
console.log('case tabs', await tabs.allInnerTexts());
await tabs.nth(1).click();
await attempt(
  'opponent add (empty)',
  () => page.getByRole('button', { name: 'Add opponent' }).click(),
  /Save opponent/,
);
await go('/finances');
const fin = await page.getByRole('button').allInnerTexts();
console.log('finance buttons', fin.filter(Boolean).slice(0, 30));

const dumpButtons = async (label) =>
  console.log(label, (await page.getByRole('button').allInnerTexts()).filter(Boolean).join(' | '));
await attempt(
  'payment add (empty)',
  () => page.getByRole('button', { name: 'Add payment' }).click(),
  /Save|Add/,
);
await go('/finances');
await dumpButtons('fin');
const finTabs = page.getByRole('tab');
console.log('fin tabs', await finTabs.allInnerTexts());
await go('/cases/demo-case-14');
await page.getByRole('tab').nth(5).click();
await page.waitForTimeout(500);
await dumpButtons('case-account');
await go('/cases/demo-case-14');
await page.getByRole('tab').nth(4).click();
await page.waitForTimeout(500);
await dumpButtons('case-documents');
await go('/cases/demo-case-14');
await page.getByRole('tab').nth(2).click();
await page.waitForTimeout(500);
await dumpButtons('case-hearings');
await go('/settings?tab=profile');
await dumpButtons('settings-profile');
await go('/clients/demo-client-adel');
await dumpButtons('client-detail');
await b.close();
console.log(JSON.stringify(rows, null, 1));
