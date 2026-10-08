import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.argv[2] ?? '/tmp/legalmaster-ui-review/interactions';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const checks = [];
for (const locale of ['ar', 'en']) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Africa/Cairo',
  });
  await page.clock.setFixedTime(new Date('2026-10-03T12:00:00+03:00'));
  await page.goto(`http://127.0.0.1:4173/cases/new?captureLocale=${locale}`);
  const picker = page.locator('[data-slot="combobox-chip-input"]');
  await picker.fill('01000000000');
  await picker.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'أدهم منصور — DEMO' })).toBeVisible();
  await picker.press('Enter');
  await expect(page.locator('[data-slot="combobox-chip"]')).toContainText('أدهم');
  await picker.fill('DEMO new client');
  await page.getByRole('button', { name: /DEMO new client/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox').first()).toHaveValue('DEMO new client');
  await dialog
    .getByRole('button', { name: locale === 'ar' ? 'إلغاء' : 'Cancel', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-slot="combobox-chip"]')).toContainText('أدهم');
  await page.screenshot({ path: `${output}/chips-${locale}.png`, fullPage: true });
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  checks.push(
    `${locale}: keyboard ID selection, phone search, inline name prefill, cancel preserves chips, search dialog Escape`,
  );
  await page.goto(`http://127.0.0.1:4173/cases/demo-case-14?captureLocale=${locale}`);
  await page.getByRole('tab', { name: locale === 'ar' ? 'الأطراف' : 'Parties' }).click();
  const panel = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', {
        name: locale === 'ar' ? 'موكلو القضية' : 'Clients in this case',
        exact: true,
      }),
    })
    .last();
  await panel
    .getByRole('button', { name: locale === 'ar' ? 'تعديل' : 'Edit', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: `${output}/relationships-${locale}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.goto(`http://127.0.0.1:4173/powers-of-attorney/new?captureLocale=${locale}`);
  await expect(page.locator('form')).toBeVisible();
  await page.screenshot({ path: `${output}/poa-new-${locale}.png`, fullPage: true });
  // eslint-disable-next-line no-undef
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.screenshot({ path: `${output}/poa-new-dark-${locale}.png`, fullPage: true });
  await page.setViewportSize({ width: 760, height: 900 });
  await page
    .getByRole('button', { name: locale === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation menu' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  checks.push(`${locale}: relationship editor, POA create, dark theme, mobile drawer Escape`);
  await page.close();
}
await browser.close();
await writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2));
console.log(checks.join('\n'));
