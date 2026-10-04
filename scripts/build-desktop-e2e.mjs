import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const result = spawnSync(
  'pnpm',
  ['tauri', 'build', '--debug', '--no-bundle', '--features', 'desktop-e2e'],
  {
    env: { ...process.env, CARGO_TARGET_DIR: resolve('src-tauri/target/desktop-e2e') },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);
process.exit(result.status ?? 1);
