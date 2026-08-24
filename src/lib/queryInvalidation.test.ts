import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { queryInvalidation } from './queryInvalidation';

describe('canonical query invalidation', () => {
  it('refreshes a payment and both affected account summaries', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    queryInvalidation.payment(queryClient, { caseId: 'case-1', payerClientId: 'client-1' });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['payments'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cases', 'case-1', 'account'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['clients', 'client-1', 'account'],
    });
  });

  it('does not invalidate unrelated relationship records for a case-only task completion', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    queryInvalidation.taskCompletion(queryClient, { caseId: 'case-1' });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['today'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['agenda'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cases', 'case-1'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['clients'] });
  });

  it('refreshes hearing-derived views and only the linked case summary', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    queryInvalidation.hearing(queryClient, { caseId: 'case-1' });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['hearings'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cases', 'case-1', 'summary'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['today'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['agenda'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['clients'] });
  });

  it('does not invent POA relationship invalidations when no related ids are supplied', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    queryInvalidation.powerOfAttorneyOrCaseClient(queryClient, {});

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['powers-of-attorney'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['search'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['cases'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['clients'] });
  });
});
