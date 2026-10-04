import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baselineRoot, routes, languages, viewports, fixtureTime } from './visual-matrix.mjs';
import { pngDimensions, verifyManifest } from './verify-visual-manifest.mjs';
const os = await readFile('/etc/os-release', 'utf8');
if (!os.includes('ID=ubuntu') || !os.includes('VERSION_ID="24.04"'))
  throw new Error('Use pnpm update:visual:canonical for the pinned Ubuntu environment');
if (process.env.CI) throw new Error('CI cannot update visual baselines');
const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '-c', 'playwright.capture.config.ts', '--update-snapshots'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const captures = [];
for (const [name, route] of routes)
  for (const language of languages)
    for (const viewport of viewports) {
      const file = `${name}-${language}-${viewport.width}x${viewport.height}.png`;
      const bytes = await readFile(join(baselineRoot, file));
      captures.push({
        route,
        language,
        viewport: `${viewport.width}x${viewport.height}`,
        file,
        ...pngDimensions(bytes),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
await writeFile(
  join(baselineRoot, 'manifest.json'),
  `${JSON.stringify(
    {
      status: 'candidate',
      fixture: 'fictional-capture-bridge-v2',
      fixtureTime,
      environment: 'Ubuntu 24.04 / Playwright 1.63.0 Chromium / Africa/Cairo / light',
      imageDigest: 'sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27',
      captures,
    },
    null,
    2,
  )}\n`,
);
await verifyManifest();
