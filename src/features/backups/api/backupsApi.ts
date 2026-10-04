import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import { clearVaultCache } from '../../../lib/vaultCache';
import { queryKeys } from '../../../lib/queryKeys';

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
    onSuccess: async () => {
      // Restore replaces the entire vault. Drop every record derived from the
      // previous vault before the locked gate can render again.
      await clearVaultCache(queryClient);
    },
  });
};
