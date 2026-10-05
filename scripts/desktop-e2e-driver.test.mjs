import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  DESKTOP_ERROR_CODES,
  applicationDiagnostic,
  failedDesktopOutcome,
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
