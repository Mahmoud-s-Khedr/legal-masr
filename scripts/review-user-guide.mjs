/* global document */
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const root = resolve('docs/user-guide');
const output = resolve('test-results/user-guide-review');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(join(root, 'capture-manifest.json'), 'utf8'));
const browser = await chromium.launch();
try {
  for (const lang of ['ar', 'en']) {
    await mkdir(join(output, `pdf-${lang}`), { recursive: true });
    execFileSync('pdftoppm', [
      '-scale-to',
      '1100',
      '-png',
      join(root, lang, 'guide.pdf'),
      join(output, `pdf-${lang}`, 'page'),
    ]);
    for (const mode of ['images', 'pdf']) {
      const items =
        mode === 'images'
          ? manifest.screenshots
              .filter((s) => s.locale === lang)
              .map((s) => ({ name: s.filename, path: join(root, lang, 'assets', s.filename) }))
          : (await readdir(join(output, `pdf-${lang}`)))
              .filter((f) => f.endsWith('.png'))
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .map((name) => ({ name, path: join(output, `pdf-${lang}`, name) }));
      const size = mode === 'images' ? 9 : 24;
      const sheets = [];
      for (let i = 0; i < items.length; i += size) sheets.push(items.slice(i, i + size));
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e8ece9;font:14px Arial}.sheet{padding:16px;display:grid;grid-template-columns:repeat(${mode === 'images' ? 3 : 6},1fr);gap:12px;width:1920px}article{background:white;padding:8px;height:${mode === 'images' ? 440 : 420}px;display:flex;flex-direction:column}img{width:100%;height:calc(100% - 30px);object-fit:contain}p{margin:4px 0;text-align:center}</style></head><body>${sheets.map((sheet, i) => `<section class="sheet" id="sheet-${i + 1}">${sheet.map((item) => `<article><img src="${pathToFileURL(item.path).href}" alt="${item.name}"><p>${item.name}</p></article>`).join('')}</section>`).join('')}</body></html>`;
      const gallery = join(output, `${lang}-${mode}.html`);
      await writeFile(gallery, html);
      const page = await browser.newPage({ viewport: { width: 1920, height: 1800 } });
      await page.goto(pathToFileURL(gallery).href);
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
      for (let i = 0; i < sheets.length; i++)
        await page.locator(`#sheet-${i + 1}`).screenshot({
          path: join(output, `${lang}-${mode}-${String(i + 1).padStart(2, '0')}.png`),
        });
      await page.close();
      console.log(`${lang}/${mode}: ${items.length} items, ${sheets.length} review sheets`);
    }
  }
} finally {
  await browser.close();
}
