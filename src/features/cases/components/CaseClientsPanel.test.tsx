import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { CaseClientsPanel } from './CaseClientsPanel';
import i18n from '@/i18n';
beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});
it('retains relationship metadata and a failed draft, then refreshes both sets of links', async () => {
  vi.mocked(bridge.caseSetClients)
    .mockRejectedValueOnce({ code: 'CASE_CLIENT_HAS_PAYMENTS', message: 'safe', details: null })
    .mockResolvedValueOnce(fixtures.caseItem);
  const { invalidate } = renderWorkflow(
    <CaseClientsPanel caseDto={fixtures.caseItem} />,
    '/cases/demo-case-14',
    '/cases/:id',
  );
  fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
  const dialog = await screen.findByRole('dialog');
  const notes = within(dialog).getByLabelText('ملاحظات');
  fireEvent.change(notes, { target: { value: 'DEMO retained notes' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('لا يمكن إزالة');
  expect(notes).toHaveValue('DEMO retained notes');
  expect(invalidate).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(bridge.caseSetClients).toHaveBeenLastCalledWith({
    caseId: fixtures.caseItem.id,
    clients: [
      expect.objectContaining({
        clientId: fixtures.client.id,
        legalCapacity: 'أصيل',
        notes: 'DEMO retained notes',
      }),
    ],
  });
  expect(invalidate).toHaveBeenCalled();
});

const withPower = (
  powerOfAttorney: (typeof fixtures.caseItem.clients)[number]['powerOfAttorney'],
) => ({
  ...fixtures.caseItem,
  clients: fixtures.caseItem.clients.map((client) => ({
    ...client,
    powerOfAttorneyId: powerOfAttorney?.id ?? null,
    powerOfAttorney,
  })),
});

it("shows the client's own power of attorney with its number and links to it", () => {
  renderWorkflow(
    <CaseClientsPanel
      caseDto={withPower({
        id: 'poa-7',
        internalSequence: '7',
        officialNumber: '123',
        issueYear: 2026,
        archived: false,
      })}
    />,
    '/cases/demo-case-14',
    '/cases/:id',
  );
  const link = screen.getByRole('link', { name: /توكيل .*7/ });
  expect(link).toHaveAttribute('href', '/powers-of-attorney/poa-7');
  expect(link).toHaveTextContent(/123/);
  expect(screen.queryByText('لا يوجد توكيل')).not.toBeInTheDocument();
});

it('marks an archived power of attorney and says plainly when the client has none', () => {
  const { unmount } = renderWorkflow(
    <CaseClientsPanel
      caseDto={withPower({
        id: 'poa-7',
        internalSequence: '7',
        officialNumber: null,
        issueYear: null,
        archived: true,
      })}
    />,
    '/cases/demo-case-14',
    '/cases/:id',
  );
  expect(screen.getByRole('link', { name: /توكيل .*7.*مؤرشف/ })).toBeInTheDocument();
  unmount();
  renderWorkflow(
    <CaseClientsPanel caseDto={withPower(null)} />,
    '/cases/demo-case-14',
    '/cases/:id',
  );
  expect(screen.getByText(i18n.t('cases.clientsPanel.noPoa'))).toBeInTheDocument();
});

it('has no per-case power-of-attorney picker: the power of attorney belongs to the client', async () => {
  renderWorkflow(
    <CaseClientsPanel caseDto={fixtures.caseItem} />,
    '/cases/demo-case-14',
    '/cases/:id',
  );
  fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByLabelText(i18n.t('cases.clientsPanel.poa'))).not.toBeInTheDocument();
});
