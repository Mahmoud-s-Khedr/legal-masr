/* global console, document */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({
  timezoneId: 'Africa/Cairo',
  viewport: { width: 1440, height: 900 },
});
const base = 'http://127.0.0.1:4173';
const go = async (p) => {
  await page.goto(`${base}${p}${p.includes('?') ? '&' : '?'}captureLocale=en`);
  await page.waitForSelector('.workspace');
  await page.waitForTimeout(700);
};
const snap = () =>
  page.evaluate(() => {
    const ds = [...document.querySelectorAll('[role="dialog"]')];
    const s = ds.at(-1) ?? document.querySelector('.workspace');
    return {
      dialog: ds.length,
      alerts: [...s.querySelectorAll('[role="alert"]')].map((e) =>
        e.textContent.trim().slice(0, 70),
      ),
      invalid: s.querySelectorAll('[aria-invalid="true"]').length,
      status: [...s.querySelectorAll('[role="status"],.error,.form-error')].map((e) =>
        e.textContent.trim().slice(0, 70),
      ),
    };
  });
const out = [];
const step = async (label, fn) => {
  try {
    await fn();
    await page.waitForTimeout(500);
    out.push({ label, ...(await snap()) });
  } catch (e) {
    out.push({ label, error: e.message.split('\n')[0] });
  }
};
await go('/cases/demo-case-14');
await page.getByRole('tab').nth(5).click();
await page.waitForTimeout(400);
await step('fee: save with empty amount', async () => {
  await page.getByRole('button', { name: 'Save fee' }).click();
});
await step('expense add dialog: empty save', async () => {
  await page.getByRole('button', { name: 'Add expense' }).click();
  const d = page.locator('[role="dialog"]').last();
  await d.waitFor();
  await d.locator('button[type="submit"]').click();
});
await page.keyboard.press('Escape');
await go('/cases/demo-case-14');
await page.getByRole('tab').nth(2).click();
await page.waitForTimeout(400);
await step('hearing: record decision dialog empty save', async () => {
  await page.getByRole('button', { name: 'Record decision' }).click();
  const d = page.locator('[role="dialog"]').last();
  await d.waitFor();
  await d.locator('button[type="submit"]').click();
});
await page.keyboard.press('Escape');
await go('/settings?tab=profile');
await step('settings profile: clear name + save', async () => {
  const n = page.getByLabel(/Full name|Name/).first();
  await n.fill('');
  await page.getByRole('button', { name: 'Save office details' }).click();
});
await go('/cases/demo-case-14');
await page.getByRole('tab').nth(0).click();
await page.waitForTimeout(400);
console.log(
  'summary buttons:',
  (await page.getByRole('button').allInnerTexts()).filter(Boolean).join(' | '),
);
await b.close();
console.log(JSON.stringify(out, null, 1));
