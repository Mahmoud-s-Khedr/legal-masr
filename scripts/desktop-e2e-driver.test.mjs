import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DESKTOP_ERROR_CODES,
  SAFE_HARNESS_FAILURES,
  SAFE_DESKTOP_CHECKPOINTS,
  readRecoveryKey,
  waitForRestoreClosed,
  applicationDiagnostic,
  failedDesktopOutcome,
  sessionDiagnostic,
  stopDriver,
  waitForDriver,
  waitForWebView,
} from './desktop-e2e-driver.mjs';

class FakeDriver extends EventEmitter {
  exitCode = null;
}

test('waitForDriver succeeds only after the status endpoint succeeds', async () => {
  const driver = new FakeDriver();
  let requests = 0;

  await waitForDriver(driver, {
    timeoutMs: 100,
    pollIntervalMs: 1,
    fetchFn: async () => ({ ok: ++requests === 2 }),
  });

  assert.equal(requests, 2);
});

test('waitForDriver stops when the driver exits before readiness', async () => {
  const driver = new FakeDriver();
  const waiting = waitForDriver(driver, {
    timeoutMs: 100,
    fetchFn: () => new Promise(() => {}),
  });

  queueMicrotask(() => {
    driver.exitCode = 1;
    driver.emit('exit', 1);
  });

  await assert.rejects(waiting, { errorCode: 'DESKTOP_DRIVER_EXITED_BEFORE_READY' });
});

test('waitForDriver stops when the driver emits an error before readiness', async () => {
  const driver = new FakeDriver();
  const waiting = waitForDriver(driver, {
    timeoutMs: 100,
    fetchFn: () => new Promise(() => {}),
  });

  queueMicrotask(() => driver.emit('error', new Error('unretained driver failure')));

  await assert.rejects(waiting, { errorCode: 'DESKTOP_DRIVER_EXITED_BEFORE_READY' });
});

test('waitForDriver times out when the status endpoint never succeeds', async () => {
  const driver = new FakeDriver();

  await assert.rejects(
    waitForDriver(driver, {
      timeoutMs: 15,
      pollIntervalMs: 1,
      fetchFn: async () => ({ ok: false }),
    }),
    { errorCode: 'DESKTOP_DRIVER_START_TIMEOUT' },
  );
});

test('failed outcomes retain only allowlisted diagnostics and fixed error codes', () => {
  const rawWebDriverMessage =
    'password=fictional desktop password 2026 path=C:\\Users\\lawyer DOM=<input secret>';
  const outcome = failedDesktopOutcome({
    scenario: 'synthetic-webdriver-failure',
    stage: 'webdriver-session',
    error: new Error(rawWebDriverMessage),
    diagnosticMessage: rawWebDriverMessage,
  });
  const serialized = JSON.stringify(outcome);

  assert.deepEqual(outcome, {
    scenario: 'synthetic-webdriver-failure',
    result: 'failed',
    errorCode: 'DESKTOP_WEBDRIVER_SESSION_FAILED',
    stage: 'webdriver-session',
    diagnostic: 'NO_ALLOWLISTED_DIAGNOSTIC',
    harnessFailure: 'NO_ALLOWLISTED_HARNESS_FAILURE',
  });
  assert.ok(DESKTOP_ERROR_CODES.includes(outcome.errorCode));
  assert.doesNotMatch(serialized, /password|C:\\Users|<input secret>/);
});

test('application diagnostics match current Arabic and English translations only', () => {
  for (const locale of ['ar', 'en']) {
    const strings = JSON.parse(
      readFileSync(new URL(`../src/i18n/${locale}/common.json`, import.meta.url), 'utf8'),
    );
    for (const code of [
      'BACKUP_CORRUPTED',
      'OPERATION_FAILED',
      'RECOVERY_KEY_INVALID',
      'INVALID_PASSWORD',
    ]) {
      assert.equal(applicationDiagnostic(strings.errors[code]), code);
      assert.equal(
        applicationDiagnostic(`${strings.errors[code]} /private/secret`),
        'NO_ALLOWLISTED_DIAGNOSTIC',
      );
    }
    assert.equal(
      applicationDiagnostic(strings.restoreFrom.secretRequired),
      'RESTORE_SECRET_REQUIRED',
    );
    assert.equal(
      applicationDiagnostic(strings.restoreFrom.passwordMismatch),
      'RESTORE_PASSWORD_MISMATCH',
    );
    assert.equal(applicationDiagnostic(strings.forms.required), 'REQUIRED_FIELD');
  }
});

test('failed outcomes retain a fixed journey checkpoint without accepting arbitrary data', () => {
  const failure = { scenario: 'synthetic-failure', stage: 'scenario', error: new Error('secret') };
  assert.equal(
    failedDesktopOutcome({ ...failure, checkpoint: 'add-attachment' }).checkpoint,
    'add-attachment',
  );
  const outcome = failedDesktopOutcome({
    ...failure,
    checkpoint: 'password=secret /private/vault',
  });
  assert.equal(Object.hasOwn(outcome, 'checkpoint'), false);
  assert.doesNotMatch(JSON.stringify(outcome), /secret|private/);
});

test('session diagnostics classify startup failures without retaining raw paths or secrets', () => {
  for (const [message, expected] of [
    [
      "DevToolsActivePort file doesn't exist /private/vault password=secret",
      'WEBDRIVER_DEVTOOLS_PORT_MISSING',
    ],
    [
      'only supports Microsoft Edge version 152, current browser version 153',
      'WEBDRIVER_VERSION_MISMATCH',
    ],
    ['user data directory is already in use C:\\Users\\lawyer', 'WEBDRIVER_PROFILE_IN_USE'],
    ['Microsoft Edge failed to start: exited normally', 'WEBDRIVER_APPLICATION_EXITED'],
    ['connect ECONNREFUSED 127.0.0.1:4445', 'WEBDRIVER_CONNECTION_REFUSED'],
    ['request timed out password=secret', 'WEBDRIVER_REQUEST_TIMEOUT'],
    ['unrecognized failure /private/vault password=secret', 'NO_ALLOWLISTED_DIAGNOSTIC'],
  ]) {
    const error = new Error(message);
    assert.equal(sessionDiagnostic(error), expected);
    const outcome = failedDesktopOutcome({
      scenario: 'synthetic',
      stage: 'webdriver-session',
      error,
    });
    assert.equal(outcome.diagnostic, expected);
    assert.doesNotMatch(JSON.stringify(outcome), /secret|private|lawyer/);
  }
  assert.equal(sessionDiagnostic(undefined), 'NO_ALLOWLISTED_DIAGNOSTIC');
});

test('Windows shutdown kills the driver tree before completing cleanup', async () => {
  const driver = new FakeDriver();
  driver.pid = 12345;
  let called = false;
  await stopDriver(driver, {
    platform: 'win32',
    run(command, args, options) {
      assert.equal(command, 'taskkill.exe');
      assert.deepEqual(args, ['/PID', '12345', '/T', '/F']);
      assert.equal(options.stdio, 'ignore');
      called = true;
      queueMicrotask(() => {
        driver.exitCode = 1;
        driver.emit('exit', 1);
      });
      return { status: 0 };
    },
  });
  assert.equal(called, true);
  assert.equal(driver.exitCode, 1);
});

test('shutdown reports a fixed failure when process termination fails', async () => {
  const driver = new FakeDriver();
  driver.pid = 12345;
  await assert.rejects(stopDriver(driver, { platform: 'win32', run: () => ({ status: 1 }) }), {
    errorCode: 'DESKTOP_DRIVER_STOP_FAILED',
  });
});

test('Linux shutdown waits for exit and skips drivers that already exited', async () => {
  const driver = new FakeDriver();
  driver.pid = 12345;
  let kills = 0;
  driver.kill = () => {
    kills++;
    queueMicrotask(() => {
      driver.exitCode = 0;
      driver.emit('exit', 0);
    });
    return true;
  };
  await stopDriver(driver, { platform: 'linux' });
  await stopDriver(driver, { platform: 'linux' });
  assert.equal(kills, 1);
});

test('shutdown times out safely if a successful kill does not emit exit', async () => {
  const driver = new FakeDriver();
  driver.pid = 12345;
  await assert.rejects(
    stopDriver(driver, { platform: 'win32', run: () => ({ status: 0 }), timeoutMs: 10 }),
    { errorCode: 'DESKTOP_DRIVER_STOP_FAILED' },
  );
  assert.equal(driver.listenerCount('exit'), 0);
});

test('WebView readiness uses its assigned local port and waits for a successful endpoint', async () => {
  const application = new FakeDriver();
  let requests = 0;
  await waitForWebView(application, 12345, {
    timeoutMs: 100,
    pollIntervalMs: 1,
    fetchFn: async (url) => {
      assert.equal(url, 'http://127.0.0.1:12345/json/version');
      return { ok: ++requests === 2 };
    },
  });
  assert.equal(requests, 2);
});

test('WebView startup distinguishes application exit from endpoint timeout', async () => {
  const exited = new FakeDriver();
  exited.exitCode = 2;
  await assert.rejects(waitForWebView(exited, 12345), {
    errorCode: 'DESKTOP_APPLICATION_EXITED_BEFORE_READY',
  });
  await assert.rejects(
    waitForWebView(new FakeDriver(), 12345, {
      timeoutMs: 10,
      pollIntervalMs: 1,
      fetchFn: async () => ({ ok: false }),
    }),
    { errorCode: 'DESKTOP_APPLICATION_START_TIMEOUT' },
  );
});

test('harness categories and fine checkpoints are strictly allowlisted independently of app diagnostics', () => {
  for (const message of [
    ...SAFE_HARNESS_FAILURES,
    'CDP_ELEMENT_TIMEOUT selector=secret',
    'secret',
  ]) {
    const outcome = failedDesktopOutcome({
      scenario: 'synthetic',
      stage: 'scenario',
      error: new Error(message),
    });
    assert.equal(
      outcome.harnessFailure,
      SAFE_HARNESS_FAILURES.includes(message) ? message : 'NO_ALLOWLISTED_HARNESS_FAILURE',
    );
    assert.doesNotMatch(JSON.stringify(outcome), /secret/);
  }
  const error = Object.assign(new Error('secret DOM path'), { code: 'ERR_ASSERTION' });
  assert.equal(
    failedDesktopOutcome({ scenario: 'synthetic', error }).harnessFailure,
    'ASSERTION_FAILED',
  );
  for (const checkpoint of SAFE_DESKTOP_CHECKPOINTS) {
    assert.equal(
      failedDesktopOutcome({ scenario: 'synthetic', checkpoint }).checkpoint,
      checkpoint,
    );
  }
});

function pollingBrowser(element) {
  return {
    $: element,
    async waitUntil(condition, { timeout }) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await condition()) return;
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      throw new Error('CDP_CONDITION_TIMEOUT');
    },
  };
}

test('recovery read waits for displayed and nonempty issuance without exposing the key on timeout', async () => {
  let displayed = false;
  let reads = 0;
  const browser = pollingBrowser(() => ({
    async waitForDisplayed() {
      await new Promise((resolve) => setTimeout(resolve, 5));
      displayed = true;
    },
    async getText() {
      assert.equal(displayed, true);
      return ++reads < 3 ? '' : 'synthetic-key';
    },
  }));
  assert.equal(await readRecoveryKey(browser, { timeout: 100 }), 'synthetic-key');
  browser.$ = () => ({ waitForDisplayed: async () => {}, getText: async () => '' });
  await assert.rejects(readRecoveryKey(browser, { timeout: 10 }), /CDP_CONDITION_TIMEOUT/);
});

test('restore closure waits for asynchronous content and dialog removal and refuses a stuck dialog', async () => {
  let content = true;
  let dialog = true;
  const browser = pollingBrowser((selector) => ({
    isExisting: async () => (selector === '.restore-from-backup' ? content : dialog),
  }));
  let closed = false;
  const pending = waitForRestoreClosed(browser, { timeout: 100 }).then(() => {
    closed = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(closed, false);
  content = false;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(closed, false);
  dialog = false;
  await pending;
  assert.equal(closed, true);
  dialog = true;
  await assert.rejects(waitForRestoreClosed(browser, { timeout: 10 }), /CDP_CONDITION_TIMEOUT/);
});
