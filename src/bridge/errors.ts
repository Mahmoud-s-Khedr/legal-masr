import i18n from '../i18n';
import type { AppError, AppErrorCode } from './types';

const appErrorCodes = new Set<AppErrorCode>([
  'INVALID_PASSWORD',
  'APP_LOCKED',
  'ALREADY_INITIALIZED',
  'RECOVERY_KEY_INVALID',
  'BACKUP_CORRUPTED',
  'BACKUP_FROM_OTHER_VAULT',
  'BACKUP_NOT_PORTABLE',
  'BACKUP_SECRET_INVALID',
  'BACKUP_MISSING',
  'LEGACY_DATA_MIGRATION_REQUIRED',
  'VAULT_INTERRUPTED',
  'VAULT_MISSING',
  'VAULT_INCOMPLETE',
  'VAULT_CORRUPT',
  'VAULT_NEWER_SCHEMA',
  'VALIDATION_FAILED',
  'CLIENT_NOT_FOUND',
  'CASE_NOT_FOUND',
  'POWER_OF_ATTORNEY_NOT_FOUND',
  'POWER_OF_ATTORNEY_CLIENT_IN_USE',
  'HEARING_NOT_FOUND',
  'CLIENT_PROBABLE_DUPLICATE',
  'CLIENT_NUMBER_TAKEN',
  'CASE_NUMBER_TAKEN',
  'POWER_OF_ATTORNEY_NUMBER_TAKEN',
  'CASE_CLIENT_HAS_PAYMENTS',
  'CLIENT_ARCHIVED',
  'CASE_ARCHIVED',
  'CASE_MUST_HAVE_CLIENT',
  'CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED',
  'TASK_NOT_FOUND',
  'ATTACHMENT_SOURCE_MISSING',
  'ATTACHMENT_NOT_FOUND',
  'PAYMENT_NOT_FOUND',
  'EXPENSE_NOT_FOUND',
  'OPERATION_FAILED',
  'OPERATION_CANCELLED',
]);

export function asAppError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as Record<string, unknown>;
  if (
    typeof value.message !== 'string' ||
    typeof value.code !== 'string' ||
    !appErrorCodes.has(value.code as AppErrorCode)
  ) {
    return null;
  }
  return value as AppError;
}

/** The lawyer closed a native file dialog without choosing; nothing failed. */
export function isCancelled(error: unknown): boolean {
  return asAppError(error)?.code === 'OPERATION_CANCELLED';
}

/**
 * The message shown for a failed command. Known error codes are translated in
 * the interface language; the backend's Arabic text is only a last resort.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  const appError = asAppError(error);
  if (!appError) return fallback;
  const key = `errors.${appError.code}`;
  return i18n.exists(key) ? i18n.t(key) : appError.message;
}

/**
 * The message for a failed save in a dialog. A specific code (a number already
 * used, a record that no longer exists) gets its translated, actionable text.
 * Anything unspecific, including the catch-all OPERATION_FAILED and raw strings
 * from the runtime, keeps the dialog's own contextual wording («تعذر حفظ الجلسة»)
 * instead of a generic sentence that hides which action failed.
 */
export function actionableErrorMessage(error: unknown, fallback: string): string {
  const appError = asAppError(error);
  if (!appError || appError.code === 'OPERATION_FAILED') return fallback;
  return errorMessage(error, fallback);
}
