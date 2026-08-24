import { afterEach, describe, expect, it, vi } from 'vitest';
import { developerDiagnostic, logCommandFailure } from './devDiagnostics';

describe('development diagnostics', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('stays silent unless the explicit development flag is enabled', () => {
    vi.stubEnv('VITE_DETAILED_DIAGNOSTICS', 'false');

    expect(
      developerDiagnostic('settings_get', {
        code: 'OPERATION_FAILED',
        diagnostic: {
          kind: 'SQLITE',
          detail: 'SQLite schema mismatch — no such column: autostart_enabled',
        },
      }),
    ).toBeNull();
  });

  it('reports only the command and sanitized backend diagnostic when enabled', () => {
    vi.stubEnv('VITE_DETAILED_DIAGNOSTICS', 'true');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const error = {
      code: 'OPERATION_FAILED',
      diagnostic: {
        kind: 'SQLITE',
        detail: 'SQLite schema mismatch — no such column: autostart_enabled',
      },
      details: [{ displayName: 'Must never be logged' }],
    };
    logCommandFailure('settings_get', error);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Command: settings_get'));
    expect(consoleError).toHaveBeenCalledWith(expect.not.stringContaining('Must never be logged'));
  });
});
