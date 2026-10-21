import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

const invalidate = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.invalidateQueries({ queryKey });

const refreshAccounts = (client: QueryClient) =>
  client.invalidateQueries({
    predicate: (query) =>
      (query.queryKey[0] === 'cases' || query.queryKey[0] === 'clients') &&
      query.queryKey[2] === 'account',
  });

/** Invalidation rules from the finalized frontend-domain contract. */
export const queryInvalidation = {
  permanentDeletion(queryClient: QueryClient) {
    return Promise.all(
      [
        queryKeys.clients.all,
        queryKeys.cases.all,
        queryKeys.powersOfAttorney.all,
        queryKeys.hearings.all,
        queryKeys.tasks.all,
        queryKeys.payments.all,
        queryKeys.expenses.all,
        queryKeys.attachments.all,
        queryKeys.search.all,
        queryKeys.today.all,
        queryKeys.agenda,
        queryKeys.backups.latestSuccessful,
        ['form-suggestions'] as const,
      ].map((key) => invalidate(queryClient, key)),
    );
  },
  /** Identity and POA membership changes affect cached labels and former owners too. */
  clientOrPowerOfAttorney(queryClient: QueryClient) {
    return Promise.all([
      invalidate(queryClient, queryKeys.clients.all),
      invalidate(queryClient, queryKeys.cases.all),
      invalidate(queryClient, queryKeys.powersOfAttorney.all),
      invalidate(queryClient, queryKeys.search.all),
    ]);
  },
  payment(queryClient: QueryClient, input: { caseId: string; payerClientId: string }) {
    invalidate(queryClient, queryKeys.payments.all);
    refreshAccounts(queryClient);
    invalidate(queryClient, queryKeys.cases.account(input.caseId));
    invalidate(queryClient, queryKeys.clients.account(input.payerClientId));
  },
  hearing(queryClient: QueryClient, input: { caseId: string }) {
    invalidate(queryClient, queryKeys.hearings.all);
    invalidate(queryClient, queryKeys.cases.summary(input.caseId));
    invalidate(queryClient, queryKeys.today.all);
    invalidate(queryClient, queryKeys.agenda);
  },
  taskCompletion(
    queryClient: QueryClient,
    input: { caseId?: string | null; clientId?: string | null },
  ) {
    invalidate(queryClient, queryKeys.tasks.all);
    invalidate(queryClient, queryKeys.today.all);
    invalidate(queryClient, queryKeys.agenda);
    if (input.caseId) invalidate(queryClient, queryKeys.cases.detail(input.caseId));
    if (input.clientId) invalidate(queryClient, queryKeys.clients.detail(input.clientId));
  },
  powerOfAttorneyOrCaseClient(
    queryClient: QueryClient,
    input: { powerOfAttorneyId?: string; caseId?: string; clientId?: string },
  ) {
    invalidate(queryClient, queryKeys.powersOfAttorney.all);
    if (input.powerOfAttorneyId) {
      invalidate(queryClient, queryKeys.powersOfAttorney.detail(input.powerOfAttorneyId));
    }
    if (input.caseId) invalidate(queryClient, queryKeys.cases.detail(input.caseId));
    if (input.clientId) invalidate(queryClient, queryKeys.clients.detail(input.clientId));
    invalidate(queryClient, queryKeys.search.all);
  },
  attachment(
    queryClient: QueryClient,
    input: { caseId?: string | null; clientId?: string | null; powerOfAttorneyId?: string | null },
  ) {
    invalidate(queryClient, queryKeys.attachments.all);
    if (input.caseId) invalidate(queryClient, queryKeys.cases.detail(input.caseId));
    if (input.clientId) invalidate(queryClient, queryKeys.clients.detail(input.clientId));
    if (input.powerOfAttorneyId) {
      invalidate(queryClient, queryKeys.powersOfAttorney.detail(input.powerOfAttorneyId));
    }
  },
  expense(queryClient: QueryClient, input: { caseId?: string | null; clientId?: string | null }) {
    invalidate(queryClient, queryKeys.expenses.all);
    refreshAccounts(queryClient);
    if (input.caseId) invalidate(queryClient, queryKeys.cases.account(input.caseId));
    if (input.clientId) invalidate(queryClient, queryKeys.clients.account(input.clientId));
  },
  feeAgreement(queryClient: QueryClient, caseId: string) {
    refreshAccounts(queryClient);
    invalidate(queryClient, queryKeys.cases.account(caseId));
  },
};
