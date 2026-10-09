import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asAppError } from '../../../bridge/errors';
import { bridge } from '../../../bridge/commands';
import { clearVaultCache } from '../../../lib/vaultCache';
import { queryKeys } from '../../../lib/queryKeys';
import type { RestoreCredential } from '../../../bridge/types';

export const useLatestSuccessfulBackup = () =>
  useQuery({
    queryKey: queryKeys.backups.latestSuccessful,
    queryFn: bridge.latestSuccessfulBackup,
  });

export const useCreateBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bridge.createBackup,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.latestSuccessful }),
  });
};

export const useValidateBackup = () => useMutation({ mutationFn: bridge.validateBackup });

export const useRestoreBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bridge.restoreBackup,
    onError: async (error) => {
      if (asAppError(error)?.code === 'VAULT_INTERRUPTED') await clearVaultCache(queryClient);
    },
    onSuccess: async () => {
      // Restore replaces the entire vault. Drop every record derived from the
      // previous vault before the locked gate can render again.
      await clearVaultCache(queryClient);
    },
  });
};

export const useSelectBackupForRestore = () =>
  useMutation({ gcTime: 0, mutationFn: bridge.selectBackupForRestore });

/**
 * Restores the chosen backup with its password or recovery key. Whatever the
 * outcome, secrets are not kept: the mutation is discarded immediately. On
 * success the vault is locked: cached records are dropped and the app status is
 * read again, which shows the sign-in screen.
 */
export const useRestoreSelectedBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ token, credential }: { token: string; credential: RestoreCredential }) =>
      bridge.restoreSelectedBackup(token, credential),
    onError: async (error) => {
      if (asAppError(error)?.code === 'VAULT_INTERRUPTED') await clearVaultCache(queryClient);
    },
    onSuccess: async () => {
      await clearVaultCache(queryClient);
    },
  });
};
