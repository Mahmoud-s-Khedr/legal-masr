export const DESKTOP_ERROR_CODES = Object.freeze([
  'DESKTOP_DRIVER_EXITED_BEFORE_READY',
  'DESKTOP_DRIVER_START_TIMEOUT',
  'DESKTOP_WEBDRIVER_SESSION_FAILED',
  'DESKTOP_SCENARIO_FAILED',
]);

export const SAFE_DESKTOP_STAGES = Object.freeze(['driver-start', 'webdriver-session', 'scenario']);
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
  { timeoutMs = 30_000, pollIntervalMs = 250, fetchFn = fetch, now = Date.now } = {},
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
            .then(() => fetchFn(driverStatusUrl))
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

export function applicationDiagnostic(message) {
  return (
    {
      'ملف النسخة الاحتياطية غير صالح.': 'BACKUP_CORRUPTED',
      'تعذر إتمام العملية بأمان.': 'OPERATION_FAILED',
    }[message] || 'NO_ALLOWLISTED_DIAGNOSTIC'
  );
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
      : safeStage === 'webdriver-session'
        ? 'DESKTOP_WEBDRIVER_SESSION_FAILED'
        : 'DESKTOP_SCENARIO_FAILED';

  return {
    scenario,
    result: 'failed',
    errorCode,
    stage: safeStage,
    ...(SAFE_DESKTOP_CHECKPOINTS.includes(checkpoint) ? { checkpoint } : {}),
    diagnostic: applicationDiagnostic(diagnosticMessage),
  };
}
