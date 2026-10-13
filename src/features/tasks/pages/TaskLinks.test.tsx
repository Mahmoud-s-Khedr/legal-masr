import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    taskList: vi.fn(),
    caseList: vi.fn(),
    caseGet: vi.fn(),
    clientList: vi.fn(),
    taskCreate: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import { captureFixtures as fixtures } from '../../../dev/captureBridge';
import { TasksPage } from './TasksPage';

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/tasks']}>
        <TasksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function choose(dialog: HTMLElement, label: string, option: string | RegExp) {
  const input = within(dialog).getByRole('combobox', { name: label });
  input.focus();
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('a task links a case or a client, never both', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.taskList).mockResolvedValue([]);
    vi.mocked(bridge.caseList).mockResolvedValue([fixtures.caseSummary]);
    vi.mocked(bridge.caseGet).mockResolvedValue(fixtures.caseItem);
    vi.mocked(bridge.clientList).mockResolvedValue([fixtures.clientSummary]);
    vi.mocked(bridge.taskCreate).mockResolvedValue({
      id: 'new-task',
      clientId: null,
      caseId: null,
      title: 'x',
      details: null,
      notes: null,
      dueDate: '2026-10-13',
      reminderMinutes: null,
      completed: false,
      completedAt: null,
      createdAt: 'now',
      updatedAt: 'now',
    });
  });

  async function openForm() {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'إضافة مهمة' }));
    const dialog = await screen.findByRole('dialog', { name: 'إضافة مهمة' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /المهمة/ }), {
      target: { value: 'مهمة تجريبية' },
    });
    return dialog;
  }

  it('saves a client-only task when no case is chosen', async () => {
    const dialog = await openForm();
    await choose(dialog, 'الموكل', fixtures.clientSummary.fullName);
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ المهمة' }));
    await waitFor(() => expect(bridge.taskCreate).toHaveBeenCalled());
    const sent = vi.mocked(bridge.taskCreate).mock.calls[0][0];
    expect(sent.clientId).toBe(fixtures.clientSummary.id);
    expect(sent.caseId).toBeUndefined();
  });

  it('choosing a case clears the client, disables the client picker and names the case clients', async () => {
    const dialog = await openForm();
    await choose(dialog, 'الموكل', fixtures.clientSummary.fullName);
    await choose(dialog, 'القضية', new RegExp(fixtures.caseSummary.internalNumber));

    const client = within(dialog).getByRole('combobox', { name: 'الموكل' });
    expect(client).toBeDisabled();
    expect(client).toHaveValue('');
    expect(
      await within(dialog).findByText(
        new RegExp(`الموكل يأتي من القضية.*${fixtures.client.fullName}`),
      ),
    ).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ المهمة' }));
    await waitFor(() => expect(bridge.taskCreate).toHaveBeenCalled());
    const sent = vi.mocked(bridge.taskCreate).mock.calls[0][0];
    expect(sent.caseId).toBe(fixtures.caseSummary.id);
    expect(sent.clientId).toBeUndefined();
  });
});
