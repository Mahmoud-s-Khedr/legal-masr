import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  isTauri: vi.fn(() => true),
  invalidateSession: vi.fn(),
  status: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }));
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }));
vi.mock('../bridge/invoke', () => ({ invalidateSession: mocks.invalidateSession }));
vi.mock('../bridge/commands', () => ({ bridge: { status: mocks.status } }));
import { useNativeVaultLock } from './nativeVaultEvents';
import { queryKeys } from './queryKeys';

describe('native tray lock session boundary', () => {
  let locked: () => void;
  const stop = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.listen.mockImplementation(async (_event, callback) => {
      locked = callback;
      return stop;
    });
    mocks.status.mockResolvedValue({ initialized: true, unlocked: false, vaultState: 'LOCKED' });
  });

  function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.appStatus, {
      initialized: true,
      unlocked: true,
      vaultState: 'UNLOCKED',
    });
    client.setQueryData(['clients'], [{ name: 'fictional' }]);
    const onLocked = vi.fn();
    const hook = renderHook(() => useNativeVaultLock(onLocked), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    return { client, onLocked, ...hook };
  }

  it.each([false, true])(
    'clears records and sets locked status even if status refresh fails: %s',
    async (fails) => {
      if (fails) mocks.status.mockRejectedValue({ code: 'OPERATION_BUSY' });
      const { client, onLocked, unmount } = mount();
      await waitFor(() =>
        expect(mocks.listen).toHaveBeenCalledWith('vault-locked', expect.any(Function)),
      );
      act(() => locked());
      await waitFor(() => expect(client.getQueryData(['clients'])).toBeUndefined());
      expect(client.getQueryData(queryKeys.appStatus)).toMatchObject({ unlocked: false });
      expect(mocks.invalidateSession).toHaveBeenCalledOnce();
      expect(onLocked).toHaveBeenCalledOnce();
      unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );

  it('unsubscribes once when registration finishes after unmount', async () => {
    let register!: (value: () => void) => void;
    mocks.listen.mockImplementation(
      () =>
        new Promise((resolve) => {
          register = resolve;
        }),
    );
    const { unmount } = mount();
    unmount();
    await act(async () => register(stop));
    expect(stop).toHaveBeenCalledOnce();
  });

  it('does not subscribe outside Tauri', () => {
    mocks.isTauri.mockReturnValue(false);
    mount();
    expect(mocks.listen).not.toHaveBeenCalled();
  });
});
