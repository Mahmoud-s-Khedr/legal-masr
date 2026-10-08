import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { PowerOfAttorneyDetailPage } from './PowerOfAttorneyDetailPage';

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});

function renderDetail() {
  return renderWorkflow(
    <PowerOfAttorneyDetailPage />,
    `/powers-of-attorney/${fixtures.poa.id}`,
    '/powers-of-attorney/:id',
  );
}

it('explains why a client cannot be removed from a power of attorney a case relies on, and keeps the draft', async () => {
  vi.mocked(bridge.powerOfAttorneyUpdate).mockRejectedValue({
    code: 'POWER_OF_ATTORNEY_CLIENT_IN_USE',
    message: 'safe',
    details: null,
  });
  renderDetail();

  fireEvent.click(await screen.findByRole('button', { name: 'تعديل' }));
  const dialog = await screen.findByRole('dialog');
  const notes = within(dialog)
    .getAllByLabelText('ملاحظات')
    .find((field) => field.tagName === 'TEXTAREA')!;
  fireEvent.change(notes, { target: { value: 'DEMO retained draft' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التوكيل' }));

  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent('توجد قضية تعتمد على هذا التوكيل');
  expect(alert).not.toHaveTextContent('أعد المحاولة');
  expect(notes).toHaveValue('DEMO retained draft');
});

it('closes the editor after a successful save of a power of attorney a case relies on', async () => {
  vi.mocked(bridge.powerOfAttorneyUpdate).mockResolvedValue(fixtures.poa);
  renderDetail();

  fireEvent.click(await screen.findByRole('button', { name: 'تعديل' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التوكيل' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(bridge.powerOfAttorneyUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ id: fixtures.poa.id }),
  );
});
