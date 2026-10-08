import type { QueryClient } from '@tanstack/react-query';
import { bridge } from '../bridge/commands';
import { queryKeys } from './queryKeys';

/** Retain the status observer so a parent gate hears a lock from a child action. */
export async function clearVaultCache(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.setQueryData(queryKeys.appStatus, {
    initialized: true,
    unlocked: false,
    vaultState: 'LOCKED',
  });
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.appStatus[0] });
  queryClient.getMutationCache().clear();
  await queryClient.fetchQuery({
    queryKey: queryKeys.appStatus,
    queryFn: bridge.status,
    staleTime: 0,
  });
}
