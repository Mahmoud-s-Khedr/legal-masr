import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { InitializeInput } from '../../../bridge/types';
import { queryKeys } from '../../../lib/queryKeys';

export const APP_STATUS_QUERY_KEY = queryKeys.appStatus;

export const useAppStatus = () =>
  useQuery({ queryKey: APP_STATUS_QUERY_KEY, queryFn: bridge.status });

export function useInitializeVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InitializeInput) => bridge.initialize(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

export function useUnlockVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => bridge.unlock(password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

export function useRecoverAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recoveryKey, newPassword }: { recoveryKey: string; newPassword: string }) =>
      bridge.recover(recoveryKey, newPassword),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_STATUS_QUERY_KEY }),
  });
}

export function useLockVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bridge.lock(),
    onSuccess: async () => {
      // A lock must also remove record data that was already delivered to the
      // renderer. Status is fetched again as the only permitted post-lock data.
      queryClient.clear();
      await queryClient.fetchQuery({ queryKey: APP_STATUS_QUERY_KEY, queryFn: bridge.status });
    },
  });
}
