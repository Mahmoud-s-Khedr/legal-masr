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
