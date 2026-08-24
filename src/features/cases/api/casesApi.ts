import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  CaseCreateInput,
  CaseListInput,
  CaseOpponentInput,
  CaseOpponentUpdateInput,
  CaseUpdateInput,
} from '../../../bridge/types';

const CASES_KEY = ['cases'];
const caseKey = (id: string) => ['case', id];

export const useCaseList = (input: CaseListInput) =>
  useQuery({ queryKey: [...CASES_KEY, input], queryFn: () => bridge.caseList(input) });

export const useCase = (id: string) =>
  useQuery({ queryKey: caseKey(id), queryFn: () => bridge.caseGet(id) });

function invalidateCase(queryClient: ReturnType<typeof useQueryClient>, caseDto: { id: string }) {
  queryClient.invalidateQueries({ queryKey: CASES_KEY });
  queryClient.setQueryData(caseKey(caseDto.id), caseDto);
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseCreateInput) => bridge.caseCreate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CASES_KEY }),
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
      queryClient.invalidateQueries({ queryKey: caseKey(input.caseId) }),
  });
}

export function useUpdateOpponent(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseOpponentUpdateInput) => bridge.caseUpdateOpponent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKey(caseId) }),
  });
}

export function useRemoveOpponent(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.caseRemoveOpponent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKey(caseId) }),
  });
}
