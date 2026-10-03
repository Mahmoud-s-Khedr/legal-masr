import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const output = 'docs/visual-baseline/shadcn-migration';
const routes = [
  ['onboarding', '/?captureOnboarding=1'],
  ['dashboard', '/'],
  ['clients', '/clients'],
  ['client-detail', '/clients/demo-client-adel'],
  ['new-client', '/clients/new'],
  ['powers-of-attorney', '/powers-of-attorney'],
  ['poa-detail', '/powers-of-attorney/demo-poa-1'],
  ['cases', '/cases'],
  ['case-detail', '/cases/demo-case-14'],
  ['new-case', '/cases/new'],
  ['agenda', '/calendar'],
  ['tasks', '/tasks'],
  ['attachments', '/attachments?case=demo-case-14'],
  ['finances', '/finances?case=demo-case-14'],
  ['backups', '/backups'],
  ['settings', '/settings'],
] as const;
const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;
const languages = ['ar', 'en'] as const;

test('capture deterministic, redacted shadcn migration evidence', async ({ browser, baseURL }) => {
  await mkdir(output, { recursive: true });
  const manifest: Array<{ route: string; language: string; viewport: string; file: string }> = [];
  for (const language of languages)
    for (const viewport of viewports)
      for (const [name, path] of routes) {
        const page = await browser.newPage({
          viewport,
          locale: language === 'ar' ? 'ar-EG' : 'en-US',
        });
        const separator = path.includes('?') ? '&' : '?';
        await page.goto(`${baseURL}${path}${separator}captureLocale=${language}`, {
          waitUntil: 'networkidle',
        });
        await expect(page.locator('#root')).not.toBeEmpty();
        const file = `${name}.${language}.${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: join(output, file), fullPage: true });
        manifest.push({
          route: path,
          language,
          viewport: `${viewport.width}x${viewport.height}`,
          file,
        });
        await page.close();
      }
  await writeFile(
    join(output, 'manifest.json'),
    `${JSON.stringify({ fixture: 'fictional-capture-bridge-v1', captures: manifest }, null, 2)}\n`,
  );
  const saved = await readFile(join(output, 'manifest.json'), 'utf8');
  expect(JSON.parse(saved).captures).toHaveLength(
    routes.length * viewports.length * languages.length,
  );
});
