import i18n from '../i18n';
import type { AppError, AppErrorCode } from './types';

const appErrorCodes = new Set<AppErrorCode>([
  'INVALID_PASSWORD',
  'APP_LOCKED',
  'ALREADY_INITIALIZED',
  'RECOVERY_KEY_INVALID',
  'BACKUP_CORRUPTED',
  'LEGACY_DATA_MIGRATION_REQUIRED',
  'VALIDATION_FAILED',
  'CLIENT_NOT_FOUND',
  'CASE_NOT_FOUND',
  'POWER_OF_ATTORNEY_NOT_FOUND',
  'HEARING_NOT_FOUND',
  'CLIENT_PROBABLE_DUPLICATE',
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
