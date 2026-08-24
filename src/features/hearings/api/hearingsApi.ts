import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { HearingDecisionInput, HearingInput, HearingListInput } from '../../../bridge/types';
import { queryInvalidation } from '../../../lib/queryInvalidation';
import { queryKeys } from '../../../lib/queryKeys';

export const useHearings = (input: HearingListInput = {}) =>
  useQuery({
    queryKey: queryKeys.hearings.list(input),
    queryFn: () => bridge.hearingList(input),
  });

export function useSaveHearing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HearingInput) =>
      input.id ? bridge.hearingUpdate(input) : bridge.hearingCreate(input),
    onSuccess: (hearing) => queryInvalidation.hearing(queryClient, { caseId: hearing.caseId }),
  });
}

export function useRecordHearingDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HearingDecisionInput) => bridge.hearingRecordDecision(input),
    onSuccess: ({ hearing }) => queryInvalidation.hearing(queryClient, { caseId: hearing.caseId }),
  });
}

export function useDeleteHearing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hearing: { id: string; caseId: string }) => bridge.hearingDelete(hearing.id),
    onSuccess: (_result, hearing) =>
      queryInvalidation.hearing(queryClient, { caseId: hearing.caseId }),
  });
}
