import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
await new Promise((r) => server.close(r));
const root = await mkdtemp(join(tmpdir(), 'legalmaster-desktop-e2e-'));
const nonce = randomUUID();
await writeFile(join(root, 'runner-marker'), nonce);
const profile = join(root, 'webview');
const stderrCategories = new Set();
const inheritedArgumentKeys = Object.keys(process.env).filter((key) => key.toUpperCase() === 'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS');
const launchEnvironment = { ...process.env };
for (const key of inheritedArgumentKeys) delete launchEnvironment[key];
const app = spawn(process.env.LEGALMASTER_PROBE_BINARY, [], {
  env: {
    ...launchEnvironment,
    TAURI_WEBVIEW_AUTOMATION: 'true',
    LEGALMASTER_E2E_ROOT: root,
    LEGALMASTER_E2E_NONCE: nonce,
    WEBVIEW2_USER_DATA_FOLDER: profile,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --enable-automation`,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
app.on('error', () => stderrCategories.add('SPAWN_FAILED'));
app.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  for (const [pattern, category] of [
    [/DESKTOP_E2E_ISOLATION_REQUIRED/, 'ISOLATION_REFUSED'],
    [/panicked/, 'APPLICATION_PANIC'],
    [/WebView|webview|ICoreWebView/, 'WEBVIEW_ERROR'],
  ]) if (pattern.test(text)) stderrCategories.add(category);
});
let ready = false;
let fetchCode;
const deadline = Date.now() + 15000;
while (Date.now() < deadline && app.exitCode === null) {
  try {
    ready = (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })).ok;
    if (ready) break;
  } catch (error) {
    const code = error.cause?.code;
    fetchCode = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(code) ? code : 'OTHER';
  }
  await new Promise((r) => setTimeout(r, 250));
}
const probe = spawnSync('pwsh', ['-NoProfile', '-Command', `
  $owned = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine.Contains($env:LEGALMASTER_PROBE_PROFILE) })
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort ([int]$env:LEGALMASTER_PROBE_PORT) -ErrorAction SilentlyContinue)
  @{
    webviewProcessCount = $owned.Count
    portFlagPresent = @($owned | Where-Object { $_.CommandLine.Contains("--remote-debugging-port=$env:LEGALMASTER_PROBE_PORT") }).Count -gt 0
    anyPortFlag = @($owned | Where-Object { $_.CommandLine.Contains('remote-debugging-port') }).Count -gt 0
    zeroPortFlag = @($owned | Where-Object { $_.CommandLine.Contains('--remote-debugging-port=0') }).Count -gt 0
    pipeFlag = @($owned | Where-Object { $_.CommandLine.Contains('--remote-debugging-pipe') }).Count -gt 0
    automationFlag = @($owned | Where-Object { $_.CommandLine.Contains('--enable-automation') }).Count -gt 0
    ipv4Listener = @($listeners | Where-Object { $_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '0.0.0.0' }).Count -gt 0
    ipv6Listener = @($listeners | Where-Object { $_.LocalAddress -eq '::1' -or $_.LocalAddress -eq '::' }).Count -gt 0
    windowPresent = (Get-Process -Id ([int]$env:LEGALMASTER_PROBE_PID) -ErrorAction SilentlyContinue).MainWindowHandle -ne 0
  } | ConvertTo-Json -Compress
`], {
  env: { ...process.env, LEGALMASTER_PROBE_PROFILE: profile, LEGALMASTER_PROBE_PORT: String(port), LEGALMASTER_PROBE_PID: String(app.pid) },
  encoding: 'utf8',
});
let metadata;
try { metadata = JSON.parse(probe.stdout); } catch { metadata = { processProbeFailed: true }; }
const portFiles = [];
for (const directory of [profile, join(profile, 'EBWebView')]) {
  try {
    const portText = (await readFile(join(directory, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
    portFiles.push({ exists: true, valid: /^\d+$/.test(portText), matchesRequested: Number(portText) === port });
  } catch { portFiles.push({ exists: false }); }
}
console.log(JSON.stringify({ inheritedArgumentKeys, portFiles, ready, fetchCode, exitCode: app.exitCode, stderrCategories: [...stderrCategories], ...metadata }));
if (app.pid && app.exitCode === null) spawnSync('taskkill.exe', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' });
await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => console.log('PROFILE_CLEANUP_LOCKED'));
process.exitCode = ready ? 0 : 1;
