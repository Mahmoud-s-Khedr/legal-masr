import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

const invalidate = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.invalidateQueries({ queryKey });

/** Invalidation rules from the finalized frontend-domain contract. */
export const queryInvalidation = {
  payment(queryClient: QueryClient, input: { caseId: string; payerClientId: string }) {
    invalidate(queryClient, queryKeys.payments.all);
    invalidate(queryClient, queryKeys.cases.account(input.caseId));
    invalidate(queryClient, queryKeys.clients.account(input.payerClientId));
  },
  hearing(queryClient: QueryClient, input: { caseId: string }) {
    invalidate(queryClient, queryKeys.hearings.all);
    invalidate(queryClient, queryKeys.cases.summary(input.caseId));
    invalidate(queryClient, queryKeys.today);
    invalidate(queryClient, queryKeys.agenda);
  },
  taskCompletion(
    queryClient: QueryClient,
    input: { caseId?: string | null; clientId?: string | null },
  ) {
    invalidate(queryClient, queryKeys.tasks.all);
    invalidate(queryClient, queryKeys.today);
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
    if (input.caseId) invalidate(queryClient, queryKeys.cases.relationships(input.caseId));
    if (input.clientId) invalidate(queryClient, queryKeys.clients.relationships(input.clientId));
    invalidate(queryClient, queryKeys.search);
  },
};
