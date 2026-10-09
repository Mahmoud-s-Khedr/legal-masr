import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: native }));
vi.mock('../dev/captureBridge', () => ({ captureModeEnabled: () => false }));
vi.mock('./devDiagnostics', () => ({ logCommandFailure: vi.fn() }));
beforeEach(() => {
  vi.resetModules();
  native.mockReset();
});
describe('IPC session boundaries', () => {
  it.each(['client_get', 'attachment_select_source', 'backup_prepare_restore', 'app_get_status'])(
    'rejects a late %s result after lock and unlock',
    async (command) => {
      let finish!: (value: unknown) => void;
      native
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue(undefined);
      const { invoke } = await import('./invoke');
      const pending = invoke(command);
      const refused = expect(pending).rejects.toMatchObject({ code: 'APP_LOCKED' });
      await invoke('app_lock');
      await invoke('app_unlock', { password: 'synthetic' });
      finish({ sensitive: 'synthetic' });
      await refused;
    },
  );
  it('returns current-session data and preserves native errors', async () => {
    const { invoke } = await import('./invoke');
    native.mockResolvedValueOnce({ id: 'synthetic' });
    expect(await invoke('client_get')).toEqual({ id: 'synthetic' });
    native.mockRejectedValueOnce({ code: 'CLIENT_NOT_FOUND' });
    await expect(invoke('client_get')).rejects.toEqual({ code: 'CLIENT_NOT_FOUND' });
  });
});
