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

describe('TasksPage', () => {
  it('updates the open dialog after completion and allows reopening without losing its draft', async () => {
    const original = (await bridge.taskList({ referenceDate: '2026-10-06' }))[0];
    vi.mocked(bridge.taskReopen).mockResolvedValue(original);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: original.title }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'المهمة' }), {
      target: { value: 'مسودة لم تحفظ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'إتمام المهمة' }));
    const reopen = await within(dialog).findByRole('button', { name: 'إعادة فتح المهمة' });
    expect(within(dialog).getByRole('textbox', { name: 'المهمة' })).toHaveValue('مسودة لم تحفظ');
    fireEvent.click(reopen);
    expect(await within(dialog).findByRole('button', { name: 'إتمام المهمة' })).toBeVisible();
    expect(vi.mocked(bridge.taskReopen).mock.calls[0][0]).toBe('task-1');
  });

  it('keeps the dialog status and draft when completion fails', async () => {
    vi.mocked(bridge.taskComplete).mockRejectedValue({
      code: 'OPERATION_FAILED',
      message: 'x',
      details: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'مراجعة عقد ABC-42' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'إتمام المهمة' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('تعذر تغيير حالة المهمة');
    expect(within(dialog).getByRole('button', { name: 'إتمام المهمة' })).toBeVisible();
    expect(
      within(dialog).queryByRole('button', { name: 'إعادة فتح المهمة' }),
    ).not.toBeInTheDocument();
  });

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

    const today = screen.getByRole('tab', { name: 'اليوم' });
    today.focus();
    fireEvent.keyDown(today, { key: 'ArrowRight' });
    const overdue = screen.getByRole('tab', { name: 'متأخرة' });
    await waitFor(() => expect(overdue).toHaveAttribute('aria-selected', 'true'));
    expect(overdue).toHaveFocus();

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

  it('opens the view requested by the Today dashboard', async () => {
    renderPage('/tasks?view=OVERDUE');
    expect(await screen.findByRole('tab', { name: 'متأخرة' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() =>
      expect(vi.mocked(bridge.taskList).mock.calls.at(-1)?.[0]).toMatchObject({ view: 'OVERDUE' }),
    );
  });

  it('falls back to today for an unknown view', async () => {
    renderPage('/tasks?view=SOMEDAY');
    expect(await screen.findByRole('tab', { name: 'اليوم' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('reports a failed completion from the list without opening a dialog', async () => {
    vi.mocked(bridge.taskComplete).mockRejectedValue({
      code: 'OPERATION_FAILED',
      message: 'x',
      details: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'إتمام مراجعة عقد ABC-42' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تغيير حالة المهمة');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
