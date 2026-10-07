import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { desktopE2eBuildArgs, WINDOWS_WEBVIEW_DEBUG_PORT } from './desktop-e2e-build.mjs';

test('Windows harness passes debugging through the API while preserving the configured window', async () => {
  const config = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)),
  );
  const args = desktopE2eBuildArgs('win32', config);
  const override = JSON.parse(args[args.indexOf('--config') + 1]);
  const { additionalBrowserArgs, ...window } = override.app.windows[0];
  assert.deepEqual(window, config.app.windows[0]);
  assert.match(
    additionalBrowserArgs,
    /--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection/,
  );
  assert.match(additionalBrowserArgs, /--autoplay-policy=no-user-gesture-required/);
  assert.ok(
    additionalBrowserArgs.includes(`--remote-debugging-port=${WINDOWS_WEBVIEW_DEBUG_PORT}`),
  );
  assert.ok(args.includes('desktop-e2e'));
  assert.equal(config.app.windows[0].additionalBrowserArgs, undefined);
});

test('Windows harness preserves explicit browser options and rejects ambiguous windows', () => {
  const args = desktopE2eBuildArgs('win32', {
    app: { windows: [{ additionalBrowserArgs: '--example-option' }] },
  });
  assert.equal(
    JSON.parse(args.at(-1)).app.windows[0].additionalBrowserArgs,
    `--example-option --remote-debugging-port=${WINDOWS_WEBVIEW_DEBUG_PORT}`,
  );
  for (const windows of [undefined, [], [{}, {}]]) {
    assert.throws(
      () => desktopE2eBuildArgs('win32', { app: { windows } }),
      /one configured window/,
    );
  }
});

test('Linux harness keeps the existing build arguments without a WebView override', () => {
  assert.deepEqual(desktopE2eBuildArgs('linux'), [
    'tauri',
    'build',
    '--debug',
    '--no-bundle',
    '--features',
    'desktop-e2e',
  ]);
});
