import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../bridge/commands', () => ({
  bridge: { status: vi.fn(), commitBackupRestore: vi.fn(), lock: vi.fn() },
}));
import { bridge } from '../bridge/commands';
import { useAppStatus, useLockVault } from '../features/onboarding/api/onboardingApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearVaultCache } from './vaultCache';
import { queryKeys } from './queryKeys';
function Action({ action }: { action: 'lock' | 'restore' }) {
  const client = useQueryClient();
  const restore = useMutation({
    mutationFn: () => bridge.commitBackupRestore('prepared'),
    onSuccess: () => clearVaultCache(client),
  });
  const lock = useLockVault();
  return <button onClick={() => (action === 'restore' ? restore : lock).mutate()}>إقفال</button>;
}
function Gate({ action }: { action: 'lock' | 'restore' }) {
  const status = useAppStatus();
  return status.data?.unlocked ? <Action action={action} /> : <p>مقفل</p>;
}
describe('active security gate observers', () => {
  it.each(['lock', 'restore'] as const)(
    '%s updates a mounted gate and drops all legal caches',
    async (action) => {
      vi.mocked(bridge.status).mockResolvedValue({
        initialized: true,
        unlocked: true,
        vaultState: 'UNLOCKED',
      });
      vi.mocked(action === 'restore' ? bridge.commitBackupRestore : bridge.lock).mockImplementation(
        async () => {
          vi.mocked(bridge.status).mockResolvedValue({
            initialized: true,
            unlocked: false,
            vaultState: 'LOCKED',
          });
        },
      );
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(queryKeys.clients.list({}), [{ id: 'fictional-sensitive-cache' }]);
      render(
        <QueryClientProvider client={client}>
          <Gate action={action} />
        </QueryClientProvider>,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'إقفال' }));
      await waitFor(() =>
        expect(client.getQueryData(queryKeys.appStatus)).toEqual({
          initialized: true,
          unlocked: false,
          vaultState: 'LOCKED',
        }),
      );
      expect(await screen.findByText('مقفل')).toBeVisible();
      expect(client.getQueryData(queryKeys.clients.list({}))).toBeUndefined();
    },
  );
});
