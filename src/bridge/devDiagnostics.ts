import type { AppError } from './types';

const diagnosticsEnabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_DETAILED_DIAGNOSTICS === 'true';

const toAppError = (error: unknown): Partial<AppError> =>
  error && typeof error === 'object' ? (error as Partial<AppError>) : {};

export function developerDiagnostic(command: string, error: unknown): string | null {
  if (!diagnosticsEnabled()) return null;

  const appError = toAppError(error);
  const code = appError.code ?? 'UNCLASSIFIED_ERROR';
  const diagnostic = appError.diagnostic;
  const detail = diagnostic
    ? `${diagnostic.kind}: ${diagnostic.detail}`
    : 'The backend did not provide an additional safe diagnostic.';

  return `Command: ${command}\nCode: ${code}\nDetail: ${detail}`;
}

export function logCommandFailure(command: string, error: unknown) {
  const diagnostic = developerDiagnostic(command, error);
  if (diagnostic) console.error(`[Legal Masr diagnostics]\n${diagnostic}`);
}
