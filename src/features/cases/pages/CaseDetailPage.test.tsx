import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { CaseDetailPage } from './CaseDetailPage';

const completed = {
  ...fixtures.hearing,
  id: 'demo-hearing-done',
  hearingDate: '2026-09-01',
  status: 'COMPLETED' as const,
  decisionText: 'حجز للحكم — DEMO',
  completedAt: '2026-09-01T12:00:00',
};

beforeEach(async () => {
  prepareWorkflowMocks();
  vi.mocked(bridge.hearingList).mockResolvedValue([fixtures.hearing, completed]);
  await i18n.changeLanguage('ar');
});

it('lists hearings with edit and record-decision only where the service accepts them', async () => {
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click(await screen.findByRole('tab', { name: /الجلسات/ }));

  expect(await screen.findByText('حجز للحكم — DEMO')).toBeInTheDocument();
  // Two hearings are listed; only the scheduled one can be edited or decided.
  expect(screen.getAllByRole('button', { name: 'تعديل الجلسة' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'تسجيل القرار' })).toHaveLength(1);
});

it('tells the lawyer a case number is already used, in words that fix it, and keeps the draft', async () => {
  vi.mocked(bridge.caseUpdate).mockRejectedValue({
    code: 'CASE_NUMBER_TAKEN',
    message: 'safe',
    details: null,
  });
  renderWorkflow(<CaseDetailPage />, `/cases/${fixtures.caseItem.id}`, '/cases/:id');

  fireEvent.click((await screen.findAllByRole('button', { name: 'تعديل' }))[0]);
  const dialog = await screen.findByRole('dialog');
  const number = within(dialog).getByLabelText('رقم الملف الداخلي');
  fireEvent.change(number, { target: { value: 'DEMO-DUPLICATE' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));

  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent('رقم القضية هذا مستخدم لقضية أخرى');
  expect(alert).not.toHaveTextContent('أعد المحاولة');
  expect(number).toHaveValue('DEMO-DUPLICATE');
});
