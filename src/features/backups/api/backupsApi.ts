import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asAppError } from '../../../bridge/errors';
import { bridge } from '../../../bridge/commands';
import { backupStamp } from '../../../lib/backupStamp';
import { clearVaultCache } from '../../../lib/vaultCache';
import { markRestored } from '../../../lib/restoreNotice';
import { queryKeys } from '../../../lib/queryKeys';

export const useLatestSuccessfulBackup = () =>
  useQuery({
    queryKey: queryKeys.backups.latestSuccessful,
    queryFn: bridge.latestSuccessfulBackup,
  });

export const useCreateBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bridge.createBackup(backupStamp()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.latestSuccessful }),
  });
};

export const useSaveBackupCopy = () => useMutation({ mutationFn: bridge.saveBackupCopy });

export const useRevealBackup = () => useMutation({ mutationFn: bridge.revealBackup });

export const useValidateBackup = () => useMutation({ mutationFn: bridge.validateBackup });

/** Chooses and checks the backup to restore, so its date and contents can be shown first. */
export const useInspectBackupToRestore = () =>
  useMutation({ mutationFn: bridge.inspectBackupToRestore });

export const useRestoreBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => bridge.restoreBackup(token),
    onError: async (error) => {
      if (asAppError(error)?.code === 'VAULT_INTERRUPTED') await clearVaultCache(queryClient);
    },
    onSuccess: async () => {
      // The restore locks the app; the password screen says why.
      markRestored();
      // Restore replaces the entire vault. Drop every record derived from the
      // previous vault before the locked gate can render again.
      await clearVaultCache(queryClient);
    },
  });
};
