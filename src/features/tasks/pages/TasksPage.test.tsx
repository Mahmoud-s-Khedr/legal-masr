import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    taskList: vi.fn(),
    caseList: vi.fn(),
    clientList: vi.fn(),
    taskCreate: vi.fn(),
    taskUpdate: vi.fn(),
    taskComplete: vi.fn(),
    taskReopen: vi.fn(),
    taskDelete: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import { TasksPage } from './TasksPage';

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.caseList).mockResolvedValue([]);
    vi.mocked(bridge.clientList).mockResolvedValue([]);
    vi.mocked(bridge.taskList).mockResolvedValue([
      {
        id: 'task-1',
        clientId: null,
        caseId: null,
        title: 'مراجعة عقد ABC-42',
        details: null,
        notes: null,
        dueDate: new Date().toISOString().slice(0, 10),
        reminderMinutes: null,
        completed: false,
        completedAt: null,
        createdAt: 'now',
        updatedAt: 'now',
      },
    ]);
    vi.mocked(bridge.taskComplete).mockResolvedValue({
      id: 'task-1',
      clientId: null,
      caseId: null,
      title: 'مراجعة عقد ABC-42',
      details: null,
      notes: null,
      dueDate: new Date().toISOString().slice(0, 10),
      reminderMinutes: null,
      completed: true,
      completedAt: 'now',
      createdAt: 'now',
      updatedAt: 'now',
    });
  });

  it('uses a semantic task checkbox and exposes keyboard-accessible tabs and dialog', async () => {
    renderPage();
    const checkbox = await screen.findByRole('checkbox', { name: 'إتمام مراجعة عقد ABC-42' });
    fireEvent.click(checkbox);
    await waitFor(() => expect(bridge.taskComplete).toHaveBeenCalled());
    expect(vi.mocked(bridge.taskComplete).mock.calls[0][0]).toBe('task-1');

    const overdue = screen.getByRole('tab', { name: 'متأخرة' });
    overdue.focus();
    fireEvent.keyDown(overdue, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'متأخرة' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'إضافة مهمة' }));
    expect(await screen.findByRole('dialog', { name: 'إضافة مهمة' })).toBeInTheDocument();
  });

  it('opens a task inspection from the title and exposes its status action', async () => {
    renderPage();
    const title = await screen.findByRole('button', { name: 'مراجعة عقد ABC-42' });
    fireEvent.click(title);
    const dialog = await screen.findByRole('dialog', { name: 'تفاصيل المهمة' });
    expect(within(dialog).getByRole('button', { name: 'إتمام المهمة' })).toBeInTheDocument();
  });
});
