// A private, non-activating bus and XDG roots keep tray tests independent of the
// person's desktop services. Each dbus-run-session owns and closes its daemon.
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const output = process.env.LAUNCH_TRAY_OUTPUT ?? 'test-results/launch-e2e';
await mkdir(output, { recursive: true });
const results = [];
for (const host of [false, true]) {
  const root = await mkdtemp(join(tmpdir(), 'legalmaster-tray-bus-'));
  try {
    const result = spawnSync(
      'dbus-run-session',
      [
        '--config-file',
        resolve('scripts/launch-session-bus.conf'),
        '--',
        ...(host
          ? ['python3', 'scripts/launch-tray-host.py']
          : ['node', 'scripts/launch-tray-e2e.mjs']),
      ],
      {
        env: {
          ...process.env,
          XDG_DATA_HOME: join(root, 'data'),
          XDG_CONFIG_HOME: join(root, 'config'),
          XDG_CACHE_HOME: join(root, 'cache'),
          NO_AT_BRIDGE: '1',
          GIO_USE_VFS: 'local',
          LAUNCH_TRAY_HOST: 'absent',
          LAUNCH_E2E_OUTPUT: join(output, host ? 'tray-host' : 'tray-no-host'),
        },
        stdio: 'inherit',
      },
    );
    results.push({ hostFixture: host, exitCode: result.status ?? 1 });
    console.log(JSON.stringify(results.at(-1)));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
await writeFile(join(output, 'tray-session-commands.json'), JSON.stringify(results, null, 2));
if (results.some((result) => result.exitCode !== 0)) process.exitCode = 1;
