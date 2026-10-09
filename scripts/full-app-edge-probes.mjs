import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fixtureTime } from './visual-matrix.mjs';
const output = process.env.QA_OUTPUT ?? 'test-results/full-app-edge';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  timezoneId: 'Africa/Cairo',
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4174';
await page.clock.setFixedTime(new Date(fixtureTime));
for (const language of ['ar', 'en']) {
  const catalog = JSON.parse(await readFile(`src/i18n/${language}/common.json`, 'utf8'));
  const t = (key) => key.split('.').reduce((v, k) => v[k], catalog);
  const visit = async (path) => {
    const url = new URL(path, base);
    url.searchParams.set('captureLocale', language);
    await page.goto(url.href);
    await expect(page.locator('main')).toBeVisible();
    await page.evaluate(() => globalThis.document.fonts.ready);
  };
  const check = async (name, fn) => {
    try {
      await fn();
      results.push({ language, name, result: 'passed' });
    } catch (e) {
      results.push({ language, name, result: 'failed', error: e.message.split('\n')[0] });
    }
    await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2) + '\n');
  };
  await check('all-sidebar-destinations', async () => {
    await visit('/');
    const hrefs = await page
      .locator('nav a')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')).filter((href) => href?.startsWith('/')),
      );
    for (const href of hrefs) {
      await page.locator(`nav a[href="${href}"]`).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(href);
      await expect(page.locator(`nav a[href="${href}"]`)).toHaveClass(/active/);
      await expect(page.locator('main')).not.toBeEmpty();
    }
  });
  await check('global-create-menu-four-destinations', async () => {
    for (const href of [
      '/clients/new',
      '/cases/new',
      '/calendar?create=hearing',
      '/tasks?create=task',
    ]) {
      await visit('/');
      await page.locator('.create-button').click();
      await page.locator(`[role="menuitem"][href="${href}"]`).click();
      await expect(page).toHaveURL(base + href);
      await expect(page.locator('form')).toBeVisible();
    }
  });
  await check('global-search-keyboard-result-navigation', async () => {
    await visit('/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input:visible').first().fill('CL-2026');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.getByRole('option').first().click();
    await expect(page).toHaveURL(/\/clients\/demo-client-adel$/);
    await expect(dialog).toHaveCount(0);
  });
  await check('task-invalid-dates-and-whitespace-title', async () => {
    await visit('/tasks?create=task');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(t('tasks.task'), { exact: true }).fill('  ');
    await dialog.getByLabel(t('tasks.dueDate'), { exact: true }).fill('31/02/2026');
    await dialog.getByRole('button', { name: t('tasks.save'), exact: true }).click();
    await expect(dialog.locator('[role="alert"]')).toHaveCount(2);
    await page.screenshot({ path: `${output}/invalid-task-${language}.png`, fullPage: true });
  });
  await check('expense-invalid-money-values', async () => {
    await visit('/finances');
    await page.getByRole('tab', { name: t('finances.expenses'), exact: true }).click();
    await page.getByRole('button', { name: t('finances.add.expense'), exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const value of ['0', '-1', '1.001', 'abc']) {
      await dialog.getByLabel(t('finances.amount'), { exact: true }).fill(value);
      await dialog.getByRole('button', { name: t('finances.saveExpense'), exact: true }).click();
      await expect(dialog.locator('[aria-invalid="true"]')).not.toHaveCount(0);
      await expect(dialog).toBeVisible();
    }
    await page.screenshot({ path: `${output}/invalid-money-${language}.png`, fullPage: true });
  });
  await check('unknown-route-provides-a-recovery-page', async () => {
    for (const path of [
      '/qa-nonexistent-page',
      '/clients/missing/extra',
      '/settings/unknown?filter=fictional#section',
    ]) {
      await visit(path);
      const invalidUrl = page.url();
      await expect(
        page.getByRole('heading', { name: t('app.notFound.title'), exact: true }),
      ).toBeVisible();
      await expect(page.getByText(t('app.notFound.description'), { exact: true })).toBeVisible();
      await expect(page.locator('.topbar')).toBeVisible();
      await expect(page.getByRole('navigation', { name: t('app.workspaceKicker') })).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: t('app.workspaceKicker') }).getByRole('link'),
      ).toHaveCount(10);
      await expect(page).toHaveURL(invalidUrl);
      const recovery = page.getByRole('link', {
        name: t('app.notFound.returnToToday'),
        exact: true,
      });
      await expect(recovery).toHaveAttribute('href', '/');
      await recovery.click();
      await expect(page).toHaveURL(`${base}/`);
      await expect(
        page.getByRole('heading', { name: t('dashboard.today'), exact: true }),
      ).toBeVisible();
    }
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await visit('/qa-nonexistent-page');
      await expect(
        page.getByRole('heading', { name: t('app.notFound.title'), exact: true }),
      ).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          globalThis.document.documentElement.dataset.theme = value;
        }, theme);
        const recovery = page.getByRole('link', {
          name: t('app.notFound.returnToToday'),
          exact: true,
        });
        await page.locator('body').click({ position: { x: 1, y: 1 } });
        let focused = false;
        for (let i = 0; i < 50; i++) {
          await page.keyboard.press('Tab');
          focused = await recovery.evaluate(
            (element) => element === globalThis.document.activeElement,
          );
          if (focused) break;
        }
        expect(focused).toBe(true);
        expect(await recovery.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        expect(
          await recovery.evaluate((element) => globalThis.getComputedStyle(element).boxShadow),
        ).not.toBe('none');
        await page.screenshot({
          path: `${output}/unknown-route-${language}-${viewport.width}x${viewport.height}-${theme}.png`,
          fullPage: true,
        });
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(`${base}/`);
        await expect(
          page.getByRole('heading', { name: t('dashboard.today'), exact: true }),
        ).toBeVisible();
        await visit('/qa-nonexistent-page');
      }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
  });
}
await context.close();
await browser.close();
console.log(JSON.stringify(results));
if (results.some((r) => r.result === 'failed')) process.exitCode = 1;
