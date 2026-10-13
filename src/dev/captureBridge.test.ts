import { describe, expect, it } from 'vitest';
import type { DashboardSummary, ExpenseDto, TaskDto } from '../bridge/types';
import { assertSafeCaptureFixture, captureInvoke, captureModeEnabledFor } from './captureBridge';

describe('capture bridge guardrails', () => {
  it('cannot be activated in a production build', () => {
    expect(captureModeEnabledFor(false, 'true')).toBe(false);
    expect(captureModeEnabledFor(true, undefined)).toBe(false);
    expect(captureModeEnabledFor(true, 'true')).toBe(true);
  });

  it('rejects fixture values that resemble source paths or credentials', () => {
    expect(() => assertSafeCaptureFixture({ source: '/home/person/document.pdf' })).toThrow(
      /paths/i,
    );
    expect(() => assertSafeCaptureFixture({ apiKey: 'not-allowed' })).toThrow(/secrets/i);
    expect(() => assertSafeCaptureFixture({ title: 'fictional capture record' })).not.toThrow();
  });

  it('uses exclusive case/client ownership in captured lists, dashboard and mutations', async () => {
    const [tasks, expenses, dashboard, task, expense] = await Promise.all([
      captureInvoke<TaskDto[]>('task_list'),
      captureInvoke<ExpenseDto[]>('expense_list'),
      captureInvoke<DashboardSummary>('dashboard_get_summary'),
      captureInvoke<TaskDto>('task_create'),
      captureInvoke<ExpenseDto>('expense_save'),
    ]);
    for (const record of [...tasks, ...expenses, ...dashboard.todayTasks, task, expense]) {
      expect(record.caseId).toBeTruthy();
      expect(record.clientId).toBeNull();
    }
  });
});
