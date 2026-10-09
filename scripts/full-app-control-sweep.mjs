import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { routes, fixtureTime } from './visual-matrix.mjs';
const out = process.env.QA_OUTPUT ?? 'test-results/full-app-controls';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = process.env.QA_RESUME
  ? JSON.parse(await readFile(`${out}/results.json`, 'utf8')).results
  : [];
const persist = () =>
  writeFile(
    `${out}/results.json`,
    JSON.stringify(
      { mode: 'browser synthetic capture bridge; mutations are not persistence evidence', results },
      null,
      2,
    ),
  );
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4174';
for (const language of ['ar', 'en']) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    timezoneId: 'Africa/Cairo',
  });
  let page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const visit = async (path, tab) => {
    await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(fixtureTime));
    await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}captureLocale=${language}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('main').waitFor();
    const ready =
      routes.find((r) => r[1] === path)?.[2] ??
      (path === '/attachments' ? '.attachment-rows' : path === '/finances' ? 'tbody' : undefined);
    if (ready) await page.locator(ready).first().waitFor();
    await page.evaluate(() => globalThis.document.fonts.ready);
    await page.waitForTimeout(150);
    if (tab) await page.getByRole('tab', { name: tab, exact: true }).click();
  };
  for (const [name, path] of [
    ...routes.filter((r) => r[0] !== 'onboarding'),
    ['global-documents', '/attachments', '.attachment-rows'],
    ['global-finances', '/finances', 'tbody'],
  ]) {
    if (
      !process.env.QA_RETRY_FAILED &&
      process.env.QA_RESUME &&
      results.some(
        (r) => r.kind === 'route-complete' && r.route === path && r.language === language,
      )
    )
      continue;
    if (
      process.env.QA_RETRY_FAILED &&
      !results.some((r) => r.route === path && r.language === language && r.result === 'failed')
    )
      continue;
    await visit(path);
    const tabs = await page.locator('main [role="tab"]').allTextContents();
    for (const tab of [null, ...tabs.map((t) => t.trim())]) {
      await visit(path, tab);
      const state = `${name}-${language}-${tab ?? 'default'}`;
      const inventory = await page.locator('main').evaluate((root) =>
        [
          ...root.querySelectorAll('button,input,textarea,a,[role="combobox"],[role="checkbox"]'),
        ].map((el, i) => ({
          index: i,
          tag: el.tagName,
          role: el.getAttribute('role'),
          type: el.getAttribute('type'),
          name:
            el.getAttribute('aria-label') ||
            el.textContent.trim() ||
            el.getAttribute('placeholder') ||
            el.getAttribute('name'),
          disabled: el.disabled ?? false,
          href: el.getAttribute('href'),
        })),
      );
      const screenshot = `${results.length}-${state.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      if (!(await page.locator('main input[type="password"]').count()))
        await page.screenshot({ path: `${out}/${screenshot}`, fullPage: true });
      const overflow = await page.evaluate(() => ({
        viewport: globalThis.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
      }));
      results.push({ route: path, language, tab, kind: 'state', inventory, screenshot, overflow });
      const buttons = await page.locator('main button').evaluateAll((els) =>
        els.map((e, i) => ({
          index: i,
          name: e.getAttribute('aria-label') || e.textContent.trim(),
          disabled: e.disabled,
          role: e.getAttribute('role'),
          className: e.className,
        })),
      );
      for (const button of buttons) {
        if (button.disabled || button.role === 'tab') continue;
        if (
          process.env.QA_RETRY_FAILED &&
          !results.some(
            (r) =>
              r.route === path &&
              r.language === language &&
              r.tab === tab &&
              r.index === button.index &&
              r.kind === 'button' &&
              r.result === 'failed',
          )
        )
          continue;
        if (!/calendar-day|agenda-item/.test(button.className)) await visit(path, tab);
        const row = { route: path, language, tab, kind: 'button', ...button };
        try {
          const target = page.locator('main button').nth(button.index);
          if (!(await target.isVisible())) {
            row.result = 'skipped-hidden';
            results.push(row);
            await persist();
            continue;
          }
          if (!(await target.isEnabled())) {
            row.result = 'skipped-disabled';
            results.push(row);
            await persist();
            continue;
          }
          await target.click();
          await page.waitForTimeout(100);
          row.result = 'clicked';
          row.destination = new URL(page.url()).pathname;
          const dialog = page.getByRole('dialog');
          row.dialog = (await dialog.count()) > 0;
          if (row.dialog) {
            row.fields = await dialog
              .locator('input,textarea,[role="combobox"]')
              .evaluateAll((els) =>
                els.map((e) => ({
                  tag: e.tagName,
                  name: e.getAttribute('name'),
                  type: e.getAttribute('type'),
                  required: e.required ?? false,
                  label: e.getAttribute('aria-label'),
                })),
              );
            const required = dialog.locator('input[required]:visible');
            if (
              (await required.count()) &&
              !(await dialog.locator('input[type="password"]').count())
            ) {
              for (const field of await required.all())
                if (await field.isEnabled()) await field.fill('');
              const submit = dialog.locator('button[type="submit"]');
              if (await submit.count()) {
                await submit.first().click();
                await page.waitForTimeout(100);
                row.invalidFormFeedback = await dialog
                  .locator('[role="alert"],[aria-invalid="true"]')
                  .count();
              }
            }
            if (!(await dialog.locator('input[type="password"]').count())) {
              row.dialogScreenshot = `dialog-${results.length}.png`;
              await page.screenshot({ path: `${out}/${row.dialogScreenshot}`, fullPage: true });
            }
            await page.keyboard.press('Escape');
            row.escapeDismissed = await dialog.waitFor({ state: 'detached', timeout: 2000 }).then(
              () => true,
              () => false,
            );
          }
          row.alerts = await page.getByRole('alert').allTextContents();
        } catch (e) {
          row.result = 'failed';
          row.error = e.message.split('\n')[0];
        }
        results.push(row);
        await persist();
      }
    }
    results.push({ route: path, language, kind: 'route-complete' });
    await persist();
    console.log(`Completed ${name} ${language}`);
  }
  // Exercise the global keyboard command palette without opening external destinations.
  await visit('/');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog');
  await palette.waitFor({ state: 'visible' });
  const paletteVisible = await palette.isVisible();
  await page.keyboard.press('Escape');
  await palette.waitFor({ state: 'detached' });
  results.push({
    language,
    kind: 'global-search-keyboard',
    result: paletteVisible && !(await palette.count()) ? 'passed' : 'failed',
  });
  results.push({ language, kind: 'runtime-errors', errors: [...new Set(errors)] });
  await context.close();
}
await browser.close();
await writeFile(
  `${out}/results.json`,
  JSON.stringify(
    { mode: 'browser synthetic capture bridge; mutations are not persistence evidence', results },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    states: results.filter((r) => r.kind === 'state').length,
    buttons: results.filter((r) => r.kind === 'button').length,
    failedButtons: results.filter((r) => r.kind === 'button' && r.result === 'failed').length,
  }),
);
