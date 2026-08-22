import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  FeeAgreementInput,
  FinancialTransactionInput,
  FinancialTransactionListInput,
} from '../../../bridge/types';
export const useTransactions = (input: FinancialTransactionListInput = {}) =>
  useQuery({ queryKey: ['finances', input], queryFn: () => bridge.financeTransactionList(input) });
export const useSaveTransaction = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: FinancialTransactionInput) => bridge.financeTransactionSave(input),
    onSuccess: () => q.invalidateQueries({ queryKey: ['finances'] }),
  });
};
export const useReverseTransaction = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      bridge.financeTransactionReverse(id, date),
    onSuccess: () => q.invalidateQueries({ queryKey: ['finances'] }),
  });
};
export const useCaseFinanceSummary = (id: string) =>
  useQuery({
    queryKey: ['finances', 'case-summary', id],
    queryFn: () => bridge.financeCaseSummary(id),
    enabled: Boolean(id),
  });
export const useClientFinanceSummary = (id: string) =>
  useQuery({
    queryKey: ['finances', 'client-summary', id],
    queryFn: () => bridge.financeClientSummary(id),
    enabled: Boolean(id),
  });
export const useSaveFeeAgreement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeAgreementInput) => bridge.financeFeeAgreementSave(input),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({ queryKey: ['finances', 'case-summary', input.caseId] }),
  });
};
