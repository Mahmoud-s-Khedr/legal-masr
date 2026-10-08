import { useDebounced } from '@/lib/useDebounced';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  CaseCreateInput,
  CaseListInput,
  CaseOpponentInput,
  CaseOpponentUpdateInput,
  CaseUpdateInput,
} from '../../../bridge/types';
import { queryInvalidation } from '../../../lib/queryInvalidation';
import { queryKeys } from '../../../lib/queryKeys';

export const useCaseList = (input: CaseListInput) => {
  const query = useDebounced(input.query);
  const filters = { ...input, query };
  return useQuery({
    queryKey: queryKeys.cases.list(filters),
    queryFn: () => bridge.caseList(filters),
  });
};

export const useCase = (id: string) =>
  useQuery({ queryKey: queryKeys.cases.detail(id), queryFn: () => bridge.caseGet(id) });

function invalidateCase(
  queryClient: ReturnType<typeof useQueryClient>,
  caseDto: { id: string; clients: { clientId: string; powerOfAttorneyId: string | null }[] },
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
  queryClient.setQueryData(queryKeys.cases.detail(caseDto.id), caseDto);
  queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseDto.id) });
  for (const client of caseDto.clients) {
    queryInvalidation.powerOfAttorneyOrCaseClient(queryClient, {
      caseId: caseDto.id,
      clientId: client.clientId,
      powerOfAttorneyId: client.powerOfAttorneyId ?? undefined,
    });
  }
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseCreateInput) => bridge.caseCreate(input),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseUpdateInput) => bridge.caseUpdate(input),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useArchiveCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.caseArchive(id),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useRestoreCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.caseRestore(id),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useAddOpponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseOpponentInput) => bridge.caseAddOpponent(input),
    onSuccess: (_opponent, input) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(input.caseId) }),
  });
}

export function useUpdateOpponent(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseOpponentUpdateInput) => bridge.caseUpdateOpponent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
  });
}

export function useRemoveOpponent(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.caseRemoveOpponent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
  });
}

export function useSetCaseClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: import('@/bridge/types').CaseSetClientsInput) => {
      // Capture authoritative prior relationships so removed links also refresh.
      const previous = await bridge.caseGet(input.caseId);
      const resulting = await bridge.caseSetClients(input);
      return { previous, resulting };
    },
    onSuccess: ({ previous, resulting }) => {
      invalidateCase(queryClient, previous);
      invalidateCase(queryClient, resulting);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.account(resulting.id) });
      for (const client of [...previous.clients, ...resulting.clients]) {
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.account(client.clientId) });
      }
    },
  });
}
