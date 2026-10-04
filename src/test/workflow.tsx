import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { bridge } from '../bridge/commands';
import { captureFixtures } from '../dev/captureBridge';
export const fixtures = captureFixtures;
export const fictionalFailure = {
  code: 'OPERATION_FAILED',
  message: 'تعذر إتمام العملية.',
  details: null,
};
export function prepareWorkflowMocks() {
  vi.resetAllMocks();
  vi.mocked(bridge.clientList).mockResolvedValue([fixtures.clientSummary]);
  vi.mocked(bridge.clientGet).mockResolvedValue(fixtures.client);
  vi.mocked(bridge.caseList).mockResolvedValue([fixtures.caseSummary]);
  vi.mocked(bridge.caseGet).mockResolvedValue(fixtures.caseItem);
  vi.mocked(bridge.powerOfAttorneyList).mockResolvedValue([
    { ...fixtures.poa, clientNames: [fixtures.client.fullName] },
  ]);
  vi.mocked(bridge.powerOfAttorneyGet).mockResolvedValue(fixtures.poa);
  vi.mocked(bridge.hearingList).mockResolvedValue([fixtures.hearing]);
  vi.mocked(bridge.taskList).mockResolvedValue([fixtures.task]);
  vi.mocked(bridge.paymentList).mockResolvedValue([]);
  vi.mocked(bridge.expenseList).mockResolvedValue([]);
  vi.mocked(bridge.attachmentList).mockResolvedValue([]);
  vi.mocked(bridge.financeClientSummary).mockResolvedValue({
    clientId: fixtures.client.id,
    receivedMinor: 0,
    expensesMinor: 0,
    netCashMinor: 0,
  });
  vi.mocked(bridge.financeCaseSummary).mockResolvedValue({
    caseId: fixtures.caseItem.id,
    agreedFeeMinor: 0,
    receivedMinor: 0,
    outstandingMinor: 0,
    expensesMinor: 0,
    netCashMinor: 0,
  });
  vi.mocked(bridge.dashboardSummary).mockResolvedValue({
    todayHearings: [fixtures.hearing],
    todayTasks: [fixtures.task],
    overdueTasks: [],
    upcomingHearings: [fixtures.hearing],
  });
}
export function renderWorkflow(node: ReactNode, path = '/', route = '*') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
          {route !== '*' && <Route path="*" element={<p>تم الانتقال</p>} />}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, invalidate, ...view };
}
