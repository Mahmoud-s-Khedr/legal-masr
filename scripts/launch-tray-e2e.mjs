import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openGuideDesktop } from './guide-desktop.mjs';

const host = process.env.LAUNCH_TRAY_HOST === 'present';
const output =
  process.env.LAUNCH_E2E_OUTPUT ?? `test-results/launch-e2e/tray-${host ? 'host' : 'no-host'}`;
await mkdir(output, { recursive: true });
const h = await openGuideDesktop('en');
const results = [];
const catalog = JSON.parse(await readFile('src/i18n/en/common.json', 'utf8'));
const t = (key) => key.split('.').reduce((v, k) => v[k], catalog);
let checkpoint = 'setup';
const xdo = (...args) =>
  execFileSync('xdotool', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const childPids = () => {
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number));
  const owned = new Set([h.driverPid]);
  for (let n = 0; n < rows.length; n++)
    for (const [pid, parent] of rows) if (owned.has(parent)) owned.add(pid);
  return [...owned];
};
const windowForApp = () => {
  for (const pid of childPids()) {
    try {
      for (const id of xdo('search', '--pid', String(pid)).split('\n')) {
        if (xdo('getwindowname', id) === 'ليجال مصر') return { id, pid };
      }
    } catch {
      /* This owned child has no X11 window. */
    }
  }
  throw new Error('OWNED_APP_WINDOW_REQUIRED');
};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
try {
  await h.wait('[name="fullName"]');
  await h.click('.language-switcher');
  await h.fill('[name="fullName"]', 'Fictional tray lawyer');
  await h.fill('[name="password"]', 'Fictional tray password 2026');
  await h.fill('[name="confirmPassword"]', 'Fictional tray password 2026');
  await h.button(t('gate.submit.setup'));
  await h.wait('.recovery-key');
  await h.click('.gate-confirm [role="checkbox"]');
  await h.button(t('gate.recoveryKeySavedButton'));
  await h.wait('nav');
  assert.equal(await h.invoke('settings_tray_available'), host);
  assert.equal((await h.invoke('settings_get')).keepRunningInTray, false);
  const client = await h.invoke('client_create', {
    input: { internalNumber: 'TRAY-CLIENT', fullName: 'Fictional tray client' },
  });
  await h.go(`/clients/${client.id}`);
  checkpoint = 'default-off-native-close-quits';
  let app = windowForApp();
  xdo('windowquit', app.id);
  await h.browser.waitUntil(() => !alive(app.pid), { timeout: 15000 });
  results.push({ scenario: checkpoint, result: 'passed' });
  await h.restart();
  await h.wait('[name="password"]');
  await h.fill('[name="password"]', 'Fictional tray password 2026');
  await h.button(t('gate.submit.unlock'));
  await h.wait('nav');
  assert.equal((await h.invoke('client_get', { id: client.id })).fullName, 'Fictional tray client');
  await h.go('/settings?tab=general');
  const toggle = await h.browser.$('[role="switch"]');
  await toggle.waitForDisplayed();
  checkpoint = host ? 'toggle-on-locks-before-hiding' : 'persisted-toggle-on-without-host-quits';
  if (host) {
    await toggle.click();
    await h.button(t('settings.save'));
    await h.browser.waitUntil(async () => (await h.invoke('settings_get')).keepRunningInTray, {
      timeout: 15000,
    });
  } else {
    assert.equal(await toggle.isEnabled(), false);
    const current = await h.invoke('settings_get');
    await h.invoke('settings_update', { input: { ...current, keepRunningInTray: true } });
  }
  app = windowForApp();
  xdo('windowquit', app.id);
  if (host) {
    await h.browser.waitUntil(
      async () => !(await h.invoke('plugin:window|is_visible', { label: 'main' })),
      { timeout: 15000 },
    );
    assert(alive(app.pid));
    await assert.rejects(h.invoke('client_list', { input: {} }), { code: 'APP_LOCKED' });
    xdo('windowmap', app.id);
    await h.wait('[name="password"]');
    assert.equal(await h.browser.$('nav').isExisting(), false);
    await h.fill('[name="password"]', 'Fictional tray password 2026');
    await h.button(t('gate.submit.unlock'));
    await h.wait('nav');
  } else await h.browser.waitUntil(() => !alive(app.pid), { timeout: 15000 });
  results.push({ scenario: checkpoint, result: 'passed' });
} catch {
  results.push({ scenario: checkpoint, result: 'failed' });
  process.exitCode = 1;
} finally {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify({ binarySha256: h.binarySha256, hostFixture: host, results }, null, 2),
  );
  console.log(JSON.stringify(results));
  await h.close();
}
