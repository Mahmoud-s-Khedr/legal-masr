import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  CaseCreateInput,
  CaseListInput,
  CasePartyInput,
  CasePartyUpdateInput,
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

export const useExportCase = () =>
  useMutation({
    mutationFn: ({ id, destination }: { id: string; destination: string }) =>
      bridge.caseExport(id, destination),
  });

export function useAttachClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      clientId,
      makePrimary,
    }: {
      caseId: string;
      clientId: string;
      makePrimary: boolean;
    }) => bridge.caseAttachClient(caseId, clientId, makePrimary),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useDetachClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, clientId }: { caseId: string; clientId: string }) =>
      bridge.caseDetachClient(caseId, clientId),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useSetPrimaryClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, clientId }: { caseId: string; clientId: string }) =>
      bridge.caseSetPrimaryClient(caseId, clientId),
    onSuccess: (caseDto) => invalidateCase(queryClient, caseDto),
  });
}

export function useAddParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CasePartyInput) => bridge.caseAddParty(input),
    onSuccess: (_party, input) =>
      queryClient.invalidateQueries({ queryKey: caseKey(input.caseId) }),
  });
}

export function useUpdateParty(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CasePartyUpdateInput) => bridge.caseUpdateParty(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKey(caseId) }),
  });
}

export function useRemoveParty(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.caseRemoveParty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKey(caseId) }),
  });
}
