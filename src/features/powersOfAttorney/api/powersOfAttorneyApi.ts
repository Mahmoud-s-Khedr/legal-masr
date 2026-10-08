import { useDebounced } from '@/lib/useDebounced';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { PowerOfAttorneyInput, PowerOfAttorneyListInput } from '../../../bridge/types';
import { queryInvalidation } from '../../../lib/queryInvalidation';
import { queryKeys } from '../../../lib/queryKeys';

export const usePowerOfAttorneyList = (input: PowerOfAttorneyListInput = {}) => {
  const query = useDebounced(input.query);
  const filters = { ...input, query };
  return useQuery({
    queryKey: queryKeys.powersOfAttorney.list(filters),
    queryFn: () => bridge.powerOfAttorneyList(filters),
  });
};

export const usePowerOfAttorney = (id: string) =>
  useQuery({
    queryKey: queryKeys.powersOfAttorney.detail(id),
    queryFn: () => bridge.powerOfAttorneyGet(id),
    enabled: Boolean(id),
  });

function invalidatePowerOfAttorney(
  queryClient: ReturnType<typeof useQueryClient>,
  powerOfAttorney: {
    id: string;
    clients: { id: string }[];
    caseIds: string[];
  },
) {
  queryClient.setQueryData(queryKeys.powersOfAttorney.detail(powerOfAttorney.id), powerOfAttorney);
  if (powerOfAttorney.clients.length === 0 && powerOfAttorney.caseIds.length === 0) {
    queryInvalidation.powerOfAttorneyOrCaseClient(queryClient, {
      powerOfAttorneyId: powerOfAttorney.id,
    });
  }
  for (const client of powerOfAttorney.clients) {
    queryInvalidation.powerOfAttorneyOrCaseClient(queryClient, {
      powerOfAttorneyId: powerOfAttorney.id,
      clientId: client.id,
    });
  }
  for (const caseId of powerOfAttorney.caseIds) {
    queryInvalidation.powerOfAttorneyOrCaseClient(queryClient, {
      powerOfAttorneyId: powerOfAttorney.id,
      caseId,
    });
  }
}

export function useSavePowerOfAttorney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PowerOfAttorneyInput) =>
      input.id ? bridge.powerOfAttorneyUpdate(input) : bridge.powerOfAttorneyCreate(input),
    onSuccess: (powerOfAttorney) => invalidatePowerOfAttorney(queryClient, powerOfAttorney),
  });
}

export function useArchivePowerOfAttorney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bridge.powerOfAttorneyArchive,
    onSuccess: (powerOfAttorney) => invalidatePowerOfAttorney(queryClient, powerOfAttorney),
  });
}

export function useRestorePowerOfAttorney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bridge.powerOfAttorneyRestore,
    onSuccess: (powerOfAttorney) => invalidatePowerOfAttorney(queryClient, powerOfAttorney),
  });
}
