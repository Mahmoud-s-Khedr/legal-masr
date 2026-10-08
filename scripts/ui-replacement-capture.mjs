import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const output = process.argv[3] ?? '/tmp/legalmaster-ui-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];
for (const locale of ['ar', 'en'])
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    const page = await browser.newPage({
      viewport,
      locale: locale === 'ar' ? 'ar-EG' : 'en-US',
      timezoneId: 'Africa/Cairo',
    });
    await page.clock.setFixedTime(new Date('2026-10-03T12:00:00+03:00'));
    for (const [name, route] of [
      ['case-new', '/cases/new'],
      ['clients', '/clients'],
      ['poa', '/powers-of-attorney'],
      ['finance', '/finances'],
      ['settings', '/settings'],
      ['case-detail', '/cases/demo-case-14'],
    ]) {
      await page.goto(`${base}${route}?captureLocale=${locale}`);
      await page
        .locator('.page-header, .record-header, .entity-detail, .settings-workspace')
        .first()
        .waitFor(); // eslint-disable-next-line no-undef
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);
      const file = `${name}-${locale}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: `${output}/${file}`, fullPage: true });
      captures.push({ file, route, locale, viewport });
      if (name === 'case-new') {
        await page
          .getByRole('button', { name: locale === 'ar' ? 'فتح التقويم' : 'Open calendar' })
          .first()
          .click();
        const file = `calendar-${locale}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: `${output}/${file}`, fullPage: true });
        captures.push({ file, route, locale, viewport });
        await page.keyboard.press('Escape');
      }
    }
    await page.close();
  }
await writeFile(
  `${output}/manifest.json`,
  JSON.stringify({ fixture: 'synthetic capture bridge', base, captures }, null, 2),
);
await browser.close();
console.log(`${captures.length} captures written to ${output}`);
