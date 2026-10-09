import { expect, test } from '@playwright/test';
import { routes, languages, viewports, fixtureTime } from './visual-matrix.mjs';

for (const language of languages)
  for (const viewport of viewports)
    for (const [name, path, ready] of routes) {
      test(`${name}-${language}-${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.clock.setFixedTime(new Date(fixtureTime));
        await page.goto(`${path}${path.includes('?') ? '&' : '?'}captureLocale=${language}`);
        await expect(page.locator(ready).first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          language === 'ar' ? 'rtl' : 'ltr',
        );
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() =>
          Promise.all(Array.from(document.images, (image) => image.decode())),
        );
        await expect(page.getByRole('alert')).toHaveCount(0);
        if (process.env.VISUAL_LAYOUT_PROBE === '1' && name === 'dashboard') {
          const header = page.locator('.dashboard-ledger > .page-header');
          await expect(header).toHaveCount(1);
          await page.addStyleTag({
            content: '.dashboard-ledger > .page-header { padding-top: 120px !important; }',
          });
          await expect(header).toHaveCSS('padding-top', '120px');
        }
        await expect(page).toHaveScreenshot(
          `${name}-${language}-${viewport.width}x${viewport.height}.png`,
          {
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
            threshold: 0.2,
            maxDiffPixelRatio: 0.001,
          },
        );
      });
    }

test('keyboard route navigation and dialog focus return', async ({ page }) => {
  await page.clock.setFixedTime(new Date(fixtureTime));
  await page.goto('/?captureLocale=ar');
  const clients = page.locator('nav a[href="/clients"]');
  await clients.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/clients$/);
  await expect(clients).toHaveClass(/active/);
  await page.goto('/attachments?case=demo-case-14&captureLocale=ar');
  const add = page.getByRole('button', { name: 'إضافة مستند', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();
});

test('hearing roll printing excludes workspace chrome and unrelated records', async ({ page }) => {
  await page.clock.setFixedTime(new Date(fixtureTime));
  await page.goto('/calendar?captureLocale=en');
  await expect(page.locator('.agenda-item').first()).toBeVisible();
  await expect(page.locator('.hearing-roll')).toBeHidden();
  await page.getByRole('button', { name: 'Print the hearing roll', exact: true }).click();
  await expect(page.locator('.hearing-roll')).toHaveCount(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.hearing-roll')).toBeVisible();
  for (const navigation of await page.locator('nav').all()) await expect(navigation).toBeHidden();
  await expect(page.locator('.calendar-layout')).toBeHidden();
  await expect(page.locator('.developer-contacts')).toBeHidden();
  await expect(page.locator('.hearing-roll tbody tr')).toHaveCount(1);
  await page.pdf({
    path: 'test-results/visual/hearing-roll.pdf',
    format: 'A4',
    printBackground: true,
  });
});

test('recovery key printing includes only the fictional key sheet', async ({ page }) => {
  await page.goto('/?captureOnboarding=1&captureLocale=en');
  await page.locator('input[name="fullName"]').fill('Fictional lawyer');
  await page.locator('input[name="password"]').fill('fictional secure passphrase');
  await page.locator('input[name="confirmPassword"]').fill('fictional secure passphrase');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.locator('.recovery-key-sheet')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.recovery-key')).toBeVisible();
  await expect(page.locator('.recovery-key-print-title')).toBeVisible();
  await expect(page.locator('.gate-brand')).toBeHidden();
  await expect(page.locator('.recovery-key-actions')).toBeHidden();
  await expect(page.locator('.gate-confirm')).toBeHidden();
  await page.pdf({ path: 'test-results/visual/recovery-key.pdf', format: 'A4' });
});
