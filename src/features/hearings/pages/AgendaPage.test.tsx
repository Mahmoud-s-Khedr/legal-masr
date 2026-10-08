import { screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { AgendaPage } from './AgendaPage';

const completed = {
  ...fixtures.hearing,
  id: 'demo-hearing-done',
  status: 'COMPLETED' as const,
  decisionText: 'تأجيل لجلسة لاحقة — DEMO',
  completedAt: '2026-10-03T12:00:00',
};

beforeEach(async () => {
  prepareWorkflowMocks();
  vi.mocked(bridge.hearingList).mockResolvedValue([fixtures.hearing, completed]);
  vi.mocked(bridge.taskList).mockResolvedValue([]);
  await i18n.changeLanguage('ar');
});

function renderAgenda(hearingId: string) {
  return renderWorkflow(<AgendaPage />, `/agenda?hearing=${hearingId}&date=2026-10-03`, '/agenda');
}

it('offers edit and record-decision for a scheduled hearing and opens its editor from a link', async () => {
  renderAgenda(fixtures.hearing.id);

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

it('shows a completed hearing with its decision but offers no edit action the service would refuse', async () => {
  renderAgenda(completed.id);

  expect(await screen.findByText('تأجيل لجلسة لاحقة — DEMO')).toBeInTheDocument();
  // The scheduled hearing on the same day keeps its actions…
  expect(screen.getAllByRole('button', { name: 'تعديل الجلسة' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'تسجيل القرار' })).toHaveLength(1);
  // …and linking to the completed one does not open an editor that cannot save.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'حذف الجلسة' })).toHaveLength(2);
});

function openNewHearing() {
  return renderWorkflow(<AgendaPage />, '/agenda?create=hearing&date=2026-10-03', '/agenda');
}

it('saves a time typed the everyday way as the canonical 24-hour time', async () => {
  const { fireEvent, within, waitFor } = await import('@testing-library/react');
  vi.mocked(bridge.hearingCreate).mockResolvedValue(fixtures.hearing);
  renderWorkflow(
    <AgendaPage />,
    `/agenda?create=hearing&date=2026-10-03&case=${fixtures.caseItem.id}`,
    '/agenda',
  );
  const dialog = await screen.findByRole('dialog', { name: 'إضافة جلسة' });
  const time = within(dialog).getByLabelText('الوقت (اختياري)');
  fireEvent.focus(time);
  fireEvent.change(time, { target: { value: '2 م' } });
  fireEvent.blur(time);
  // Shown back as the 12-hour time the rest of the app uses.
  expect((time as HTMLInputElement).value).toMatch(/2:00/);
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الجلسة' }));
  await waitFor(() => expect(bridge.hearingCreate).toHaveBeenCalled());
  expect(vi.mocked(bridge.hearingCreate).mock.calls[0][0]).toMatchObject({
    hearingTime: '14:00',
    hearingDate: '2026-10-03',
  });
});

it('explains a time it cannot read on the field instead of a generic message', async () => {
  const { fireEvent, within } = await import('@testing-library/react');
  renderWorkflow(
    <AgendaPage />,
    `/agenda?create=hearing&date=2026-10-03&case=${fixtures.caseItem.id}`,
    '/agenda',
  );
  const dialog = await screen.findByRole('dialog', { name: 'إضافة جلسة' });
  const time = within(dialog).getByLabelText('الوقت (اختياري)');
  fireEvent.change(time, { target: { value: '25:99' } });
  fireEvent.blur(time);
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الجلسة' }));
  expect(await within(dialog).findByText('اكتب الوقت مثل 9:30 ص أو 2:00 م.')).toBeInTheDocument();
  expect(bridge.hearingCreate).not.toHaveBeenCalled();
});

it('fills in the chosen case’s court and circuit for a new hearing', async () => {
  const { within, waitFor } = await import('@testing-library/react');
  renderWorkflow(
    <AgendaPage />,
    `/agenda?create=hearing&date=2026-10-03&case=${fixtures.caseItem.id}`,
    '/agenda',
  );
  const dialog = await screen.findByRole('dialog', { name: 'إضافة جلسة' });
  await waitFor(() =>
    expect(within(dialog).getByLabelText('المحكمة أو المكان')).toHaveValue(
      fixtures.caseItem.courtName,
    ),
  );
  expect(within(dialog).getByLabelText('الدائرة')).toHaveValue(fixtures.caseItem.circuitName);
});

it('tells a new lawyer to add a case first instead of showing an empty case list', async () => {
  vi.mocked(bridge.caseList).mockResolvedValue([]);
  openNewHearing();
  const dialog = await screen.findByRole('dialog', { name: 'إضافة جلسة' });
  expect(await screen.findByText('لا توجد قضايا بعد.')).toBeInTheDocument();
  expect(dialog.querySelector('a[href="/cases/new"]')).not.toBeNull();
});

it('prints the day’s hearing roll with the case, clients and court of each hearing', async () => {
  const { fireEvent, within, waitFor } = await import('@testing-library/react');
  vi.mocked(bridge.print).mockResolvedValue(undefined);
  renderAgenda(completed.id);

  fireEvent.click(await screen.findByRole('button', { name: 'طباعة رول الجلسات' }));
  await waitFor(() => expect(bridge.print).toHaveBeenCalledOnce());
  const roll = document.querySelector<HTMLElement>('.hearing-roll')!;
  expect(roll).toHaveTextContent('رول الجلسات');
  const rows = within(roll).getAllByRole('row', { hidden: true });
  // A header row and one row per hearing of the day.
  expect(rows).toHaveLength(3);
  expect(roll).toHaveTextContent(fixtures.caseItem.internalNumber);
  expect(roll).toHaveTextContent('تأجيل لجلسة لاحقة — DEMO');
});

it('says so when the print window cannot open', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.mocked(bridge.print).mockRejectedValue({
    code: 'OPERATION_FAILED',
    message: 'x',
    details: null,
  });
  renderAgenda(completed.id);

  fireEvent.click(await screen.findByRole('button', { name: 'طباعة رول الجلسات' }));
  expect(await screen.findByText('تعذر فتح نافذة الطباعة. حاول مرة أخرى.')).toBeVisible();
});

it('shows each hearing’s time and case in the week view, not just counts', async () => {
  const { fireEvent } = await import('@testing-library/react');
  renderAgenda(completed.id);

  fireEvent.click(await screen.findByRole('tab', { name: 'أسبوع' }));
  const lines = document.querySelectorAll('.calendar-agenda-list .day-line');
  const text = [...lines].map((line) => line.textContent).join('\n');
  expect(text).toContain(fixtures.caseItem.internalNumber);
  expect(text).not.toContain('الجلسات:');
});

it('starts the list view today, with earlier days one click away', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.mocked(bridge.hearingList).mockResolvedValue([
    { ...fixtures.hearing, id: 'old', hearingDate: '2020-01-05' },
    { ...fixtures.hearing, id: 'next', hearingDate: '2099-01-05' },
  ]);
  renderWorkflow(<AgendaPage />, '/agenda', '/agenda');

  fireEvent.click(await screen.findByRole('tab', { name: 'قائمة' }));
  expect(screen.getByText(/2099/)).toBeInTheDocument();
  expect(screen.queryByText(/2020/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'عرض اليوم السابق' }));
  expect(screen.getByText(/2020/)).toBeInTheDocument();
});
