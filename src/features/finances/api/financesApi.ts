import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  ExpenseInput,
  ExpenseListInput,
  FeeAgreementInput,
  PaymentInput,
  PaymentListInput,
} from '../../../bridge/types';
import { queryInvalidation } from '../../../lib/queryInvalidation';
import { queryKeys } from '../../../lib/queryKeys';

export const usePayments = (input: PaymentListInput = {}) =>
  useQuery({ queryKey: queryKeys.payments.list(input), queryFn: () => bridge.paymentList(input) });
export const useExpenses = (input: ExpenseListInput = {}) =>
  useQuery({ queryKey: queryKeys.expenses.list(input), queryFn: () => bridge.expenseList(input) });
export const useSavePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentInput) => bridge.paymentSave(input),
    onSuccess: (payment) =>
      queryInvalidation.payment(queryClient, {
        caseId: payment.caseId,
        payerClientId: payment.payerClientId,
      }),
  });
};
export const useSaveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseInput) => bridge.expenseSave(input),
    onSuccess: (expense) =>
      queryInvalidation.expense(queryClient, {
        caseId: expense.caseId,
        clientId: expense.clientId,
      }),
  });
};
export const useCaseFinanceSummary = (id: string) =>
  useQuery({
    queryKey: queryKeys.cases.account(id),
    queryFn: () => bridge.financeCaseSummary(id),
    enabled: Boolean(id),
  });
export const useClientFinanceSummary = (id: string) =>
  useQuery({
    queryKey: queryKeys.clients.account(id),
    queryFn: () => bridge.financeClientSummary(id),
    enabled: Boolean(id),
  });
export const useSaveFeeAgreement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeAgreementInput) => bridge.feeAgreementSave(input),
    onSuccess: (_result, input) => queryInvalidation.feeAgreement(queryClient, input.caseId),
  });
};
