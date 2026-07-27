import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
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
