import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateController, type UpdateApi, type UpdateStatus } from './updateController';

const enabled: UpdateStatus = { currentVersion: '0.1.0', available: true, reason: null };
const release = { version: '0.2.0', notes: 'Release notes', downloaded: false };
function setup(status = enabled) {
  const api: UpdateApi = {
    status: vi.fn().mockResolvedValue(status),
    check: vi.fn().mockResolvedValue(release),
    download: vi.fn().mockResolvedValue(undefined),
    install: vi.fn().mockRejectedValue('INSTALL_FAILED'),
  };
  return { api, controller: new UpdateController(api, window.localStorage) };
}

describe('update policy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to manual checks and makes no automatic release request', async () => {
    const { controller, api } = setup();
    await controller.check(true);
    expect(controller.getSnapshot().mode).toBe('manual');
    expect(api.check).not.toHaveBeenCalled();
    await controller.check();
    expect(api.check).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().update).toEqual(release);
    expect(api.download).not.toHaveBeenCalled();
  });

  it('never checks releases for unavailable builds', async () => {
    const { controller, api } = setup({ ...enabled, available: false, reason: 'manual-install' });
    controller.setMode('download');
    await controller.check(true);
    await controller.check();
    expect(api.check).not.toHaveBeenCalled();
  });

  it('notifies without downloading and throttles automatic checks', async () => {
    const { controller, api } = setup();
    controller.setMode('notify');
    await controller.check(true);
    await controller.check(true);
    expect(api.check).toHaveBeenCalledOnce();
    expect(api.download).not.toHaveBeenCalled();
    await controller.check();
    expect(api.check).toHaveBeenCalledTimes(2);
  });

  it('automatically downloads but never installs', async () => {
    const { controller, api } = setup();
    controller.setMode('download');
    await controller.check(true);
    expect(api.download).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().update?.downloaded).toBe(true);
    expect(api.install).not.toHaveBeenCalled();
    expect(new UpdateController(api, localStorage).getSnapshot().mode).toBe('download');
  });

  it('does not download again when native check returns verified bytes', async () => {
    const { controller, api } = setup();
    vi.mocked(api.check).mockResolvedValue({ ...release, downloaded: true });
    controller.setMode('download');
    await controller.check(true);
    expect(api.download).not.toHaveBeenCalled();
  });

  it('respects a preference disabled while a check is in flight', async () => {
    const { controller, api } = setup();
    let resolve!: (value: typeof release) => void;
    vi.mocked(api.check).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    controller.setMode('download');
    const check = controller.check(true);
    await vi.waitFor(() => expect(api.check).toHaveBeenCalled());
    controller.setMode('manual');
    resolve(release);
    await check;
    expect(api.download).not.toHaveBeenCalled();
  });

  it('treats no update as current and never downloads', async () => {
    const { controller, api } = setup();
    vi.mocked(api.check).mockResolvedValue(null);
    controller.setMode('download');
    await controller.check(true);
    expect(controller.getSnapshot().message).toBe('current');
    expect(api.download).not.toHaveBeenCalled();
  });

  it('handles offline checks quietly in automatic mode and allows manual retries', async () => {
    const { controller, api } = setup();
    vi.mocked(api.check).mockRejectedValue(new Error('offline'));
    controller.setMode('notify');
    await controller.check(true);
    expect(controller.getSnapshot().phase).toBe('idle');
    expect(controller.getSnapshot().message).toBeNull();
    await controller.check();
    expect(controller.getSnapshot().message).toBe('checkFailed');
    vi.mocked(api.check).mockResolvedValue(release);
    await controller.check();
    expect(controller.getSnapshot().update).toEqual(release);
  });

  it('does not expose failed signature verification as a downloaded update', async () => {
    const { controller, api } = setup();
    vi.mocked(api.download).mockRejectedValue('DOWNLOAD_FAILED');
    await controller.check();
    await controller.download();
    expect(controller.getSnapshot().update?.downloaded).toBe(false);
    expect(controller.getSnapshot().message).toBe('downloadFailed');
    await controller.install();
    expect(api.install).not.toHaveBeenCalled();
    vi.mocked(api.download).mockResolvedValue(undefined);
    await controller.download();
    expect(controller.getSnapshot().update?.downloaded).toBe(true);
  });

  it.each(['BACKUP_FAILED', 'INSTALL_FAILED'])(
    'handles %s without reporting success',
    async (error) => {
      const { controller, api } = setup();
      vi.mocked(api.install).mockRejectedValue(error);
      await controller.check();
      await controller.download();
      await controller.install();
      expect(controller.getSnapshot().phase).toBe('idle');
      expect(controller.getSnapshot().update?.downloaded).toBe(false);
      expect(controller.getSnapshot().message).toBe(
        error === 'BACKUP_FAILED' ? 'backupFailed' : 'installFailed',
      );
      expect(localStorage.getItem('legal-masr.update-target')).toBeNull();
    },
  );

  it('records the target and reports successful update only after the new version starts', async () => {
    const { controller, api } = setup();
    vi.mocked(api.install).mockResolvedValue(undefined);
    await controller.check();
    await controller.download();
    await controller.install();
    expect(controller.getSnapshot().phase).toBe('installing');
    expect(localStorage.getItem('legal-masr.update-target')).toBe('0.2.0');
    const next = setup({ ...enabled, currentVersion: '0.2.0' }).controller;
    await next.initialize();
    expect(next.getSnapshot().message).toBe('updated');
    expect(localStorage.getItem('legal-masr.update-target')).toBeNull();
  });

  it('does not claim success when the installer did not upgrade', async () => {
    localStorage.setItem('legal-masr.update-target', '0.2.0');
    const { controller } = setup();
    await controller.initialize();
    expect(controller.getSnapshot().message).toBeNull();
  });

  it('blocks concurrent operations and notifies subscribers', async () => {
    const { controller, api } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    let resolve!: () => void;
    vi.mocked(api.download).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await controller.check();
    const download = controller.download();
    await controller.download();
    await controller.check();
    await controller.install();
    expect(api.download).toHaveBeenCalledOnce();
    expect(api.check).toHaveBeenCalledOnce();
    expect(api.install).not.toHaveBeenCalled();
    resolve();
    await download;
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    controller.setMode('notify');
    expect(listener).not.toHaveBeenCalled();
  });

  it('uses manual mode for invalid preferences and survives unavailable storage', async () => {
    localStorage.setItem('legal-masr.update-mode', 'invalid');
    expect(setup().controller.getSnapshot().mode).toBe('manual');
    const { api } = setup();
    const storage = {
      getItem: () => {
        throw new Error();
      },
      setItem: () => {
        throw new Error();
      },
      removeItem: () => {
        throw new Error();
      },
    } as unknown as Storage;
    const controller = new UpdateController(api, storage);
    await controller.initialize();
    controller.setMode('download');
    expect(controller.getSnapshot().mode).toBe('manual');
    expect(controller.getSnapshot().message).toBe('preferenceFailed');
  });

  it('initializes once and survives native status failures', async () => {
    const { controller, api } = setup();
    vi.mocked(api.status).mockRejectedValue('unavailable');
    await controller.initialize();
    await controller.initialize();
    expect(api.status).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status.available).toBe(false);
  });
});

it('preserves the successful-update notice during an automatic startup check', async () => {
  localStorage.clear();
  localStorage.setItem('legal-masr.update-target', '0.2.0');
  localStorage.setItem('legal-masr.update-mode', 'notify');
  const { controller, api } = setup({ ...enabled, currentVersion: '0.2.0' });
  vi.mocked(api.check).mockResolvedValue(null);
  await controller.check(true);
  expect(controller.getSnapshot().message).toBe('updated');
  expect(api.check).toHaveBeenCalledOnce();
});
