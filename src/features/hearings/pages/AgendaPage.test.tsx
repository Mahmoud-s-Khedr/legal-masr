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
