import { spawn } from 'node:child_process';

// Setting environment variables inline is shell-specific. This launcher keeps
// the opt-in seeded Tauri workflow identical on Windows, macOS, and Linux.
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(pnpm, ['tauri', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SEED_DEMO_DATA: 'true' },
});

child.once('error', (error) => {
  console.error(`Unable to start Tauri development mode: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
