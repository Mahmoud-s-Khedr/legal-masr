import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
await mkdir('coverage/rust', { recursive: true });
const commands = [
  [
    'llvm-cov',
    '--no-default-features',
    '--ignore-filename-regex',
    '(tests/|desktop_e2e.rs|/target/)',
    '--json',
    '--output-path',
    '../coverage/rust/raw.json',
  ],
  [
    'llvm-cov',
    'report',
    '--ignore-filename-regex',
    '(tests/|desktop_e2e.rs|/target/)',
    '--lcov',
    '--output-path',
    '../coverage/rust/raw.lcov',
  ],
  [
    'llvm-cov',
    'report',
    '--ignore-filename-regex',
    '(tests/|desktop_e2e.rs|/target/)',
    '--summary-only',
  ],
];
for (const args of commands) {
  const result = spawnSync('cargo', args, { cwd: 'src-tauri', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const scoped = spawnSync(process.execPath, ['scripts/scope-rust-coverage.mjs'], {
  stdio: 'inherit',
});
process.exit(scoped.status ?? 1);
