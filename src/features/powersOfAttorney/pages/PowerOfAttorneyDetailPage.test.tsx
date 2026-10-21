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

it('explains that a client already has an active power of attorney, and keeps the draft', async () => {
  vi.mocked(bridge.powerOfAttorneyUpdate).mockRejectedValue({
    code: 'CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY',
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
  expect(alert).toHaveTextContent('توكيل ساري بالفعل');
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

it("lists the cases of the power of attorney's clients with their court, and a labelled title", async () => {
  vi.mocked(bridge.powerOfAttorneyGet).mockResolvedValue({
    ...fixtures.poa,
    caseIds: [fixtures.caseSummary.id],
  });
  renderDetail();

  expect(await screen.findByRole('heading', { name: /توكيل .*007/ })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('tab', { name: /القضايا/ }));
  const link = await screen.findByRole('link', { name: fixtures.caseSummary.internalNumber });
  expect(link).toHaveAttribute('href', `/cases/${fixtures.caseSummary.id}`);
  expect(link.closest('li')).toHaveTextContent(fixtures.caseSummary.courtName!);
  expect(link.closest('li')).toHaveTextContent(fixtures.client.fullName);
});

it('shows and retries a failed linked-case lookup instead of displaying incomplete case labels', async () => {
  vi.mocked(bridge.caseList)
    .mockRejectedValueOnce({ code: 'OPERATION_FAILED' })
    .mockResolvedValue([fixtures.caseSummary]);
  vi.mocked(bridge.powerOfAttorneyGet).mockResolvedValue({
    ...fixtures.poa,
    caseIds: [fixtures.caseSummary.id],
  });
  renderDetail();
  fireEvent.click(await screen.findByRole('tab', { name: /القضايا/ }));
  const alert = await screen.findByRole('alert');
  expect(
    screen.queryByRole('link', { name: fixtures.caseSummary.internalNumber }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(alert).getByRole('button', { name: i18n.t('app.retry') }));
  expect(
    await screen.findByRole('link', { name: fixtures.caseSummary.internalNumber }),
  ).toBeVisible();
});
