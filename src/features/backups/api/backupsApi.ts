import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import { backupStamp } from '../../../lib/backupStamp';
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
