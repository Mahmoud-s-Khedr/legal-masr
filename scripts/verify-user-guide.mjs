/* global document, innerWidth */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { screens } from './guide-content.mjs';
import { validateGuideManifest, verifyImageBytes } from './user-guide-validation.mjs';
const root = 'docs/user-guide';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(join(root, 'capture-manifest.json'), 'utf8'));
validateGuideManifest(manifest, screens, { requireHashes: true });
for (const shot of manifest.screenshots) {
  const assets = join(root, shot.locale, 'assets');
  verifyImageBytes(
    await readFile(join(assets, 'originals', shot.filename)),
    shot.originalSha256,
    shot.viewport,
  );
  verifyImageBytes(
    await readFile(join(assets, shot.filename)),
    shot.annotatedSha256,
    shot.crop || shot.viewport,
  );
}
const browser = await chromium.launch();
const results = [];
try {
  for (const lang of ['ar', 'en']) {
    const folder = resolve(root, lang);
    const page = await browser.newPage();
    const network = [];
    page.on('request', (req) => {
      if (/^https?:/.test(req.url())) network.push(req.url());
    });
    await page.goto(pathToFileURL(join(folder, 'index.html')).href);
    await page.evaluate(async () => {
      document.querySelectorAll('img').forEach((i) => (i.loading = 'eager'));
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    assert.equal(network.length, 0, 'Guide must load offline without HTTP requests');
    assert.equal(await page.locator('html').getAttribute('dir'), lang === 'ar' ? 'rtl' : 'ltr');
    assert.equal(await page.locator('main h3').count(), screens.length);
    assert.equal(
      await page.locator('img').count(),
      manifest.screenshots.filter((s) => s.locale === lang).length,
    );
    for (const link of await page.locator('a').all()) {
      const href = await link.getAttribute('href');
      if (href.startsWith('#')) assert.equal(await page.locator(href).count(), 1);
      else await readFile(resolve(folder, href));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Guide must fit a phone viewport',
    );
    const pdf = await readFile(join(folder, 'guide.pdf'));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const pdfText = execFileSync('pdftotext', [join(folder, 'guide.pdf'), '-'], {
      encoding: 'utf8',
    });
    assert(pdfText.length > 10000, 'PDF must have selectable explanation text');
    assert(pdfText.includes(lang === 'ar' ? 'ليجال' : 'Legal Masr'), 'PDF title missing');
    const info = execFileSync('pdfinfo', [join(folder, 'guide.pdf')], { encoding: 'utf8' });
    const pdfUrls = execFileSync('pdfinfo', ['-url', join(folder, 'guide.pdf')], {
      encoding: 'utf8',
    });
    assert(
      !/file:\/\/|https?:\/\//i.test(pdfUrls),
      'Standalone PDF must not link to development files or network resources',
    );
    const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
    assert(pages > screens.length);
    const md = await readFile(join(folder, 'guide.md'), 'utf8');
    assert.equal((md.match(/^### /gm) || []).length, screens.length);
    assert.equal(
      (md.match(/!\[/g) || []).length,
      manifest.screenshots.filter((s) => s.locale === lang).length,
    );
    results.push({
      locale: lang,
      result: 'passed',
      screens: screens.length,
      images: await page.locator('img').count(),
      pdfPages: pages,
      pdfBytes: pdf.length,
      offline: true,
      selectablePdfText: true,
      standalonePdf: true,
      pdfSha256: digest(pdf),
      htmlSha256: digest(await readFile(join(folder, 'index.html'))),
      markdownSha256: digest(md),
    });
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  join(root, 'artifact-validation.json'),
  JSON.stringify(
    {
      sourceRevision: manifest.sourceRevision,
      binarySha256: manifest.binarySha256,
      manifestSha256: digest(await readFile(join(root, 'capture-manifest.json'))),
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(results));
