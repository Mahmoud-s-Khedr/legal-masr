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

function renderPage(path = '/tasks') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
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

  it('keeps the archived client name on a direct task but excludes archived clients from new links', async () => {
    const archived = {
      ...fixtures.clientSummary,
      fullName: 'DEMO archived task client',
      archivedAt: '2026-10-14T10:00:00Z',
    };
    const active = {
      ...fixtures.clientSummary,
      id: 'active-client',
      fullName: 'DEMO active client',
    };
    vi.mocked(bridge.caseList).mockResolvedValue([]);
    vi.mocked(bridge.clientList).mockImplementation(async (input) =>
      input.includeArchived ? [archived, active] : [active],
    );
    vi.mocked(bridge.taskList).mockResolvedValue([
      {
        ...fixtures.task,
        id: 'historical-task',
        title: 'DEMO historical task',
        clientId: archived.id,
        caseId: null,
      },
    ]);
    renderPage();
    expect(await screen.findByText(archived.fullName)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مهمة' }));
    const dialog = await screen.findByRole('dialog');
    const client = within(dialog).getByRole('combobox', { name: 'الموكل' });
    client.focus();
    fireEvent.click(client);
    fireEvent.keyDown(client, { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: active.fullName })).toBeVisible();
    expect(screen.queryByRole('option', { name: archived.fullName })).not.toBeInTheDocument();
    fireEvent.keyDown(client, { key: 'Escape' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'إلغاء' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'DEMO historical task' }));
    const historical = await screen.findByRole('dialog');
    const retainedClient = within(historical).getByRole('combobox', { name: 'الموكل' });
    expect(retainedClient).toHaveValue(archived.fullName);
    retainedClient.focus();
    fireEvent.click(retainedClient);
    fireEvent.keyDown(retainedClient, { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: archived.fullName })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it.each([false, true])(
    'seeds a new task from a client filter only when active (archived: %s)',
    async (archived) => {
      const client = {
        ...fixtures.clientSummary,
        archivedAt: archived ? '2026-10-14T10:00:00Z' : null,
      };
      vi.mocked(bridge.clientList).mockResolvedValue([client]);
      renderPage(`/tasks?client=${client.id}`);
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'الموكل' })).toHaveValue(client.fullName),
      );
      fireEvent.click(screen.getByRole('button', { name: 'إضافة مهمة' }));
      const dialog = await screen.findByRole('dialog', { name: 'إضافة مهمة' });
      expect(within(dialog).getByRole('combobox', { name: 'الموكل' })).toHaveValue(
        archived ? '' : client.fullName,
      );
      fireEvent.change(within(dialog).getByRole('textbox', { name: /المهمة/ }), {
        target: { value: 'مهمة تجريبية' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ المهمة' }));
      await waitFor(() => expect(bridge.taskCreate).toHaveBeenCalledTimes(1));
      expect(vi.mocked(bridge.taskCreate).mock.calls[0][0].clientId).toBe(
        archived ? undefined : client.id,
      );
    },
  );
});
