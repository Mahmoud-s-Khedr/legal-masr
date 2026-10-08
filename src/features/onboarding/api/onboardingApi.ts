import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { InitializeInput, RestoreFromBackupInput } from '../../../bridge/types';
import { clearVaultCache } from '../../../lib/vaultCache';
import { queryKeys } from '../../../lib/queryKeys';

export const APP_STATUS_QUERY_KEY = queryKeys.appStatus;

export const useAppStatus = () =>
  useQuery({ queryKey: APP_STATUS_QUERY_KEY, queryFn: bridge.status });

export function useInitializeVault() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (input: InitializeInput) => bridge.initialize(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

export function useUnlockVault() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (password: string) => bridge.unlock(password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

export function useRecoverAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ recoveryKey, newPassword }: { recoveryKey: string; newPassword: string }) =>
      bridge.recover(recoveryKey, newPassword),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

/** On a new installation: choose a backup made on another computer. */
export const useChooseBackup = () =>
  useMutation({ gcTime: 0, mutationFn: bridge.chooseBackupToRestore });

export function useRestoreFromBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (input: RestoreFromBackupInput) => bridge.restoreFromBackup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

export function useLockVault() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: () => bridge.lock(),
    onSuccess: async () => {
      // A lock must also remove record data that was already delivered to the
      // renderer. Status is fetched again as the only permitted post-lock data.
      await clearVaultCache(queryClient);
    },
  });
}
