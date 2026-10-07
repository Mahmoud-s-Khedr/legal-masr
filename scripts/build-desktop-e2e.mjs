import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { desktopE2eBuildArgs } from './desktop-e2e-build.mjs';
const args = desktopE2eBuildArgs(
  process.platform,
  process.platform === 'win32'
    ? JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    : undefined,
);
let configRoot;
if (process.platform === 'win32') {
  configRoot = mkdtempSync(join(tmpdir(), 'legalmaster-desktop-e2e-config-'));
  const index = args.indexOf('--config') + 1;
  const configFile = join(configRoot, 'tauri-e2e.json');
  writeFileSync(configFile, args[index]);
  args[index] = configFile;
}
// Invoke pnpm's JS entry point directly so Windows cmd.exe cannot alter JSON
// quotes or paths. npm_execpath is supplied by `pnpm build:desktop:e2e`.
const cli = process.env.npm_execpath;
const useNode = cli && /\.(?:c?js|mjs)$/i.test(cli);
let result;
try {
  result = spawnSync(useNode ? process.execPath : cli || 'pnpm', useNode ? [cli, ...args] : args, {
    env: { ...process.env, CARGO_TARGET_DIR: resolve('src-tauri/target/desktop-e2e') },
    stdio: 'inherit',
  });
} finally {
  if (configRoot) rmSync(configRoot, { recursive: true, force: true });
}
if (result.error) console.error('DESKTOP_E2E_BUILD_START_FAILED');
process.exit(result.status ?? 1);
