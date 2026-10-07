import { spawnSync } from 'node:child_process';

export const DESKTOP_ERROR_CODES = Object.freeze([
  'DESKTOP_DRIVER_EXITED_BEFORE_READY',
  'DESKTOP_DRIVER_START_TIMEOUT',
  'DESKTOP_WEBDRIVER_SESSION_FAILED',
  'DESKTOP_SCENARIO_FAILED',
  'DESKTOP_DRIVER_STOP_FAILED',
  'DESKTOP_APPLICATION_EXITED_BEFORE_READY',
  'DESKTOP_APPLICATION_START_TIMEOUT',
]);

export const SAFE_DESKTOP_STAGES = Object.freeze([
  'driver-start',
  'webview-start',
  'webdriver-session',
  'scenario',
]);
export const SAFE_DESKTOP_CHECKPOINTS = Object.freeze([
  'initialize',
  'create-client',
  'create-case',
  'add-attachment',
  'create-backup',
  'edit-after-backup',
  'restore-backup',
  'unlock-restored-vault',
  'verify-restored-records',
  'verify-restored-attachment',
  'verify-attachment-bytes',
]);

const driverStatusUrl = 'http://127.0.0.1:4444/status';
const driverFailed = Symbol('driver-failed');
const timedOut = Symbol('timed-out');

export class DesktopHarnessError extends Error {
  constructor(errorCode) {
    super(errorCode);
    this.errorCode = errorCode;
  }
}

function isDriverUnavailable(driver) {
  return driver.exitCode !== null;
}

function raceWithTimeout(promise, timeoutMs) {
  let timeout;
  return new Promise((resolve) => {
    timeout = setTimeout(() => resolve(timedOut), timeoutMs);
    Promise.resolve(promise).then(resolve, () => resolve(undefined));
  }).finally(() => clearTimeout(timeout));
}

/**
 * Wait until tauri-driver accepts WebDriver requests without retaining a driver
 * error, response body, or command output. The injected dependencies keep this
 * behavior testable without starting a native driver.
 */
export async function waitForDriver(
  driver,
  {
    timeoutMs = 30_000,
    pollIntervalMs = 250,
    fetchFn = fetch,
    now = Date.now,
    statusUrl = driverStatusUrl,
  } = {},
) {
  let signalDriverFailure;
  const driverFailure = new Promise((resolve) => {
    signalDriverFailure = () => resolve(driverFailed);
  });
  const onDriverFailure = () => signalDriverFailure();
  driver.once('exit', onDriverFailure);
  driver.once('error', onDriverFailure);

  const deadline = now() + timeoutMs;
  try {
    while (true) {
      if (isDriverUnavailable(driver)) {
        throw new DesktopHarnessError('DESKTOP_DRIVER_EXITED_BEFORE_READY');
      }

      const remainingBeforeRequest = deadline - now();
      if (remainingBeforeRequest <= 0) {
        throw new DesktopHarnessError('DESKTOP_DRIVER_START_TIMEOUT');
      }

      const response = await raceWithTimeout(
        Promise.race([
          Promise.resolve()
            .then(() => fetchFn(statusUrl))
            .catch(() => undefined),
          driverFailure,
        ]),
        remainingBeforeRequest,
      );
      if (response === driverFailed || isDriverUnavailable(driver)) {
        throw new DesktopHarnessError('DESKTOP_DRIVER_EXITED_BEFORE_READY');
      }
      if (response === timedOut) {
        throw new DesktopHarnessError('DESKTOP_DRIVER_START_TIMEOUT');
      }
      if (response?.ok) return;

      const remainingBeforePoll = deadline - now();
      if (remainingBeforePoll <= 0) {
        throw new DesktopHarnessError('DESKTOP_DRIVER_START_TIMEOUT');
      }
      const pollResult = await raceWithTimeout(
        driverFailure,
        Math.min(pollIntervalMs, remainingBeforePoll),
      );
      if (pollResult === driverFailed || isDriverUnavailable(driver)) {
        throw new DesktopHarnessError('DESKTOP_DRIVER_EXITED_BEFORE_READY');
      }
    }
  } finally {
    driver.off('exit', onDriverFailure);
    driver.off('error', onDriverFailure);
  }
}

/** Wait for the directly launched Windows WebView's local debugging endpoint. */
export async function waitForWebView(application, port, options = {}) {
  try {
    await waitForDriver(application, {
      ...options,
      statusUrl: `http://127.0.0.1:${port}/json/version`,
    });
  } catch (error) {
    throw new DesktopHarnessError(
      error.errorCode === 'DESKTOP_DRIVER_EXITED_BEFORE_READY'
        ? 'DESKTOP_APPLICATION_EXITED_BEFORE_READY'
        : 'DESKTOP_APPLICATION_START_TIMEOUT',
    );
  }
}

export function applicationDiagnostic(message) {
  return (
    {
      'ملف النسخة الاحتياطية غير صالح.': 'BACKUP_CORRUPTED',
      'تعذر إتمام العملية بأمان.': 'OPERATION_FAILED',
    }[message] || 'NO_ALLOWLISTED_DIAGNOSTIC'
  );
}

// Classify in memory; never retain raw driver messages, which may contain paths.
export function sessionDiagnostic(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  for (const [pattern, diagnostic] of [
    [/DevToolsActivePort/i, 'WEBDRIVER_DEVTOOLS_PORT_MISSING'],
    [/only supports.*version|current browser version/i, 'WEBDRIVER_VERSION_MISMATCH'],
    [/user data directory.*in use/i, 'WEBDRIVER_PROFILE_IN_USE'],
    [/failed to start|exited (normally|abnormally)|crashed/i, 'WEBDRIVER_APPLICATION_EXITED'],
    [/ECONNREFUSED|connection refused/i, 'WEBDRIVER_CONNECTION_REFUSED'],
    [/timeout|timed out/i, 'WEBDRIVER_REQUEST_TIMEOUT'],
  ]) {
    if (pattern.test(message)) return diagnostic;
  }
  return 'NO_ALLOWLISTED_DIAGNOSTIC';
}

export function failedDesktopOutcome({
  scenario,
  stage,
  checkpoint,
  error,
  diagnosticMessage = '',
}) {
  const safeStage = SAFE_DESKTOP_STAGES.includes(stage) ? stage : 'scenario';
  const errorCode = DESKTOP_ERROR_CODES.includes(error?.errorCode)
    ? error.errorCode
    : safeStage === 'driver-start'
      ? 'DESKTOP_DRIVER_START_TIMEOUT'
      : safeStage === 'webview-start'
        ? 'DESKTOP_APPLICATION_START_TIMEOUT'
        : safeStage === 'webdriver-session'
          ? 'DESKTOP_WEBDRIVER_SESSION_FAILED'
          : 'DESKTOP_SCENARIO_FAILED';

  return {
    scenario,
    result: 'failed',
    errorCode,
    stage: safeStage,
    ...(SAFE_DESKTOP_CHECKPOINTS.includes(checkpoint) ? { checkpoint } : {}),
    diagnostic:
      safeStage === 'webdriver-session'
        ? sessionDiagnostic(error)
        : applicationDiagnostic(diagnosticMessage),
  };
}

/** Terminate the native driver's descendants before discarding its vault marker. */
export async function stopDriver(
  driver,
  { platform = process.platform, run = spawnSync, timeoutMs = 5000 } = {},
) {
  if (driver.exitCode !== null || !driver.pid) return;
  let onExit;
  const exited = new Promise((resolve) => {
    onExit = resolve;
    driver.once('exit', onExit);
  });
  try {
    const stopped =
      platform === 'win32'
        ? run('taskkill.exe', ['/PID', String(driver.pid), '/T', '/F'], {
            stdio: 'ignore',
            timeout: timeoutMs,
          }).status === 0
        : driver.kill();
    if (!stopped || (await raceWithTimeout(exited, timeoutMs)) === timedOut) {
      throw new DesktopHarnessError('DESKTOP_DRIVER_STOP_FAILED');
    }
  } finally {
    driver.off('exit', onExit);
  }
}
