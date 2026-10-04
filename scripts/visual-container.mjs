import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const action = process.argv[2];
const commands = {
  compare: 'pnpm verify:visual && pnpm capture:visual',
  update: 'pnpm update:visual',
  probe: 'VISUAL_LAYOUT_PROBE=1 pnpm capture:visual --grep dashboard',
};
if (!(action in commands)) throw new Error('Unsupported visual action');
if (action === 'update' && process.env.CI) throw new Error('CI cannot update baselines');
const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '-v',
    `${resolve('.')}:/work`,
    '-w',
    '/work',
    '-e',
    'CI',
    'mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27',
    'bash',
    '-c',
    `npm install -g pnpm@10.33.0 && ${commands[action]}`,
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
