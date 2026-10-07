import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  DESKTOP_ERROR_CODES,
  applicationDiagnostic,
  failedDesktopOutcome,
  sessionDiagnostic,
  waitForDriver,
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
  });
  assert.ok(DESKTOP_ERROR_CODES.includes(outcome.errorCode));
  assert.doesNotMatch(serialized, /password|C:\\Users|<input secret>/);
});

test('application diagnostics preserve the existing fixed allowlist', () => {
  assert.equal(applicationDiagnostic('ملف النسخة الاحتياطية غير صالح.'), 'BACKUP_CORRUPTED');
  assert.equal(applicationDiagnostic('تعذر إتمام العملية بأمان.'), 'OPERATION_FAILED');
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
