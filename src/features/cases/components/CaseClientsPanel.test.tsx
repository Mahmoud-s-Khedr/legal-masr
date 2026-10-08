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
        powerOfAttorneyId: fixtures.poa.id,
        notes: 'DEMO retained notes',
      }),
    ],
  });
  expect(invalidate).toHaveBeenCalled();
});
