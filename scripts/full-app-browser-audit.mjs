/* global document, innerWidth */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { routes, fixtureTime } from './visual-matrix.mjs';

// Read-only renderer audit. Capture bridge mutations are no-ops: this suite
// deliberately makes no claims about persistence or native OS integrations.
const output = process.argv[2] ?? 'docs/reviews/evidence/2026-10-09/full-test/browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const inventory = [];
async function check(name, action, page) {
  try {
    await action();
    results.push({ name, result: 'passed', layer: 'renderer-fixture' });
  } catch (error) {
    const evidence = `${name.replace(/[^a-z0-9-]/gi, '-')}-failure.png`;
    await page.screenshot({ path: `${output}/${evidence}`, fullPage: true });
    results.push({ name, result: 'failed', evidence, error: error.message.slice(0, 1600) });
  }
}
for (const language of ['ar', 'en']) {
  const page = await browser.newPage({ timezoneId: 'Africa/Cairo' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date(fixtureTime));
  for (const width of [1366, 1440, 760]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    for (const [name, path, ready] of routes) {
      await check(
        `${language}-${width}-${name}`,
        async () => {
          await page.goto(
            `http://127.0.0.1:4173${path}${path.includes('?') ? '&' : '?'}captureLocale=${language}`,
          );
          await expect(page.locator(ready).first()).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute(
            'dir',
            language === 'ar' ? 'rtl' : 'ltr',
          );
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: `${output}/${language}-${width}-${name}.png`,
            fullPage: true,
            animations: 'disabled',
          });
          inventory.push(
            await page.evaluate(
              ({ name, language, width }) => ({
                name,
                language,
                width,
                overflow: document.documentElement.scrollWidth - innerWidth,
                controls: [
                  ...document.querySelectorAll(
                    'button,a,input,textarea,[role="combobox"],[role="checkbox"],[role="switch"]',
                  ),
                ]
                  .filter((el) => el.getBoundingClientRect().width > 0)
                  .map((el) => ({
                    tag: el.tagName,
                    role: el.getAttribute('role'),
                    name:
                      el.getAttribute('aria-label') ||
                      el.innerText ||
                      el.getAttribute('name') ||
                      el.getAttribute('placeholder') ||
                      '',
                    disabled: !!el.disabled,
                    href: el.getAttribute('href'),
                  })),
              }),
              { name, language, width },
            ),
          );
          await expect(page.getByRole('alert')).toHaveCount(0);
        },
        page,
      );
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const go = async (path) => {
    await page.goto(
      `http://127.0.0.1:4173${path}${path.includes('?') ? '&' : '?'}captureLocale=${language}`,
    );
    await expect(page.locator('.workspace')).toBeVisible();
  };
  for (const path of [
    '/clients/demo-client-adel',
    '/cases/demo-case-14',
    '/powers-of-attorney/demo-poa-1',
    '/tasks',
    '/finances',
    '/settings',
  ]) {
    await go(path);
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    for (let index = 0; index < count; index++) {
      await check(
        `${language}-tabs-${path.replaceAll('/', '-')}-${index}`,
        async () => {
          const tab = page.getByRole('tab').nth(index);
          await tab.click();
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          await page.screenshot({
            path: `${output}/${language}-tab-${path.replaceAll('/', '-')}-${index}.png`,
            fullPage: true,
            animations: 'disabled',
          });
        },
        page,
      );
    }
  }
  for (const path of [
    '/clients/new',
    '/cases/new',
    '/powers-of-attorney/new',
    '/tasks?create=task',
    '/calendar?create=hearing',
  ]) {
    await check(
      `${language}-form-validation-${path.replaceAll('/', '-')}`,
      async () => {
        await go(path);
        const form = page.locator('form').last();
        await expect(form).toBeVisible();
        await form.locator('button[type="submit"],button:not([type])').last().click();
        await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();
        await page.screenshot({
          path: `${output}/${language}-validation-${path.replaceAll(/[^a-z0-9]/gi, '-')}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      },
      page,
    );
  }
  await check(
    `${language}-search-keyboard-and-escape`,
    async () => {
      await go('/');
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.locator('.global-search input[role="combobox"]').fill('DEMO');
      await expect(page.getByRole('option').first()).toBeVisible();
      await page.locator('.global-search input[role="combobox"]').press('ArrowDown');
      await page.locator('.global-search input[role="combobox"]').press('Enter');
      await expect(page).toHaveURL(/clients\/demo-client-adel/);
    },
    page,
  );
  await check(
    `${language}-mobile-navigation-escape`,
    async () => {
      await go('/');
      await page.setViewportSize({ width: 760, height: 900 });
      await page
        .getByRole('button', {
          name: language === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation menu',
        })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    },
    page,
  );
  results.push({
    name: `${language}-uncaught-renderer-errors`,
    result: errors.length ? 'failed' : 'passed',
    errors,
  });
  await page.close();
}
await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
await writeFile(`${output}/control-inventory.json`, JSON.stringify(inventory, null, 2));
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.result === 'passed').length,
    failed: results.filter((r) => r.result === 'failed').length,
  }),
);
if (results.some((r) => r.result === 'failed')) process.exitCode = 1;
