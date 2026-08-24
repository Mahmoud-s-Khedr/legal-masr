import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentInput,
  CaseCreateInput,
  ExpenseInput,
  HearingDecisionInput,
  HearingInput,
  PaymentInput,
  PowerOfAttorneyInput,
  TaskInput,
} from './types';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('./invoke', () => ({ invoke: invokeMock }));

import { bridge } from './commands';

async function expectBridgeCall(
  call: () => Promise<unknown>,
  command: string,
  args?: Record<string, unknown>,
) {
  invokeMock.mockResolvedValueOnce(undefined);
  await call();
  expect(invokeMock).toHaveBeenLastCalledWith(command, args);
}

describe('canonical Tauri bridge payload contracts', () => {
  it('serializes POA and case-client relationship commands with camelCase payloads', async () => {
    const powerOfAttorney: PowerOfAttorneyInput = {
      internalSequence: 'ت/١',
      issueDate: '2026-08-24',
      clientIds: ['client-1'],
      lawyers: [{ fullName: 'أحمد المحامي' }],
    };
    const caseInput: CaseCreateInput = {
      internalNumber: 'ق/١',
      status: 'CLOSED',
      closedOn: '2026-08-24',
      clients: [{ clientId: 'client-1', legalCapacity: 'مدعٍ', powerOfAttorneyId: 'poa-1' }],
    };

    await expectBridgeCall(
      () => bridge.powerOfAttorneyCreate(powerOfAttorney),
      'power_of_attorney_create',
      { input: powerOfAttorney },
    );
    await expectBridgeCall(() => bridge.caseCreate(caseInput), 'case_create', { input: caseInput });
  });

  it('serializes dedicated hearing and task writes without legacy event or priority fields', async () => {
    const hearing: HearingInput = {
      caseId: 'case-1',
      hearingDate: '2026-08-24',
      hearingTime: '09:30',
      hearingType: 'مرافعة',
    };
    const decision: HearingDecisionInput = {
      id: 'hearing-1',
      decisionText: 'حجز للحكم',
      nextHearing: { ...hearing, hearingDate: '2026-09-01' },
    };
    const task: TaskInput = {
      title: 'مراجعة الملف',
      dueDate: '2026-08-24',
      caseId: 'case-1',
      details: 'قبل الجلسة',
    };

    await expectBridgeCall(() => bridge.hearingCreate(hearing), 'hearing_create', {
      input: hearing,
    });
    await expectBridgeCall(
      () => bridge.hearingRecordDecision(decision),
      'hearing_record_decision',
      { input: decision },
    );
    await expectBridgeCall(() => bridge.taskCreate(task), 'task_create', { input: task });
    await expectBridgeCall(() => bridge.taskComplete('task-1'), 'task_complete', { id: 'task-1' });
  });

  it('serializes attachment, payment, and expense writes with their finalized ownership fields', async () => {
    const attachment: AttachmentInput = {
      caseId: 'case-1',
      sourceToken: 'native-source-token',
      category: 'CASE_FILE',
      documentDate: '2026-08-24',
    };
    const payment: PaymentInput = {
      caseId: 'case-1',
      payerClientId: 'client-1',
      amountMinor: 150_000,
      paymentDate: '2026-08-24',
      paymentMethod: 'BANK_TRANSFER',
    };
    const expense: ExpenseInput = {
      caseId: 'case-1',
      amountMinor: 5_000,
      expenseDate: '2026-08-24',
      expenseType: 'COURT_FEE',
    };

    await expectBridgeCall(() => bridge.attachmentAdd(attachment), 'attachment_add', {
      input: attachment,
    });
    await expectBridgeCall(() => bridge.paymentSave(payment), 'payment_save', { input: payment });
    await expectBridgeCall(() => bridge.expenseSave(expense), 'expense_save', { input: expense });
    await expectBridgeCall(
      () => bridge.feeAgreementSave({ caseId: 'case-1', amountMinor: 200_000 }),
      'fee_agreement_save',
      { input: { caseId: 'case-1', amountMinor: 200_000 } },
    );
  });

  it('uses exact commands for canonical reads and owner-scoped attachment lists', async () => {
    await expectBridgeCall(() => bridge.hearingList({ caseId: 'case-1' }), 'hearing_list', {
      input: { caseId: 'case-1' },
    });
    await expectBridgeCall(() => bridge.taskList({ referenceDate: '2026-08-24' }), 'task_list', {
      input: { referenceDate: '2026-08-24' },
    });
    await expectBridgeCall(
      () => bridge.attachmentList({ powerOfAttorneyId: 'poa-1' }),
      'attachment_list',
      { input: { powerOfAttorneyId: 'poa-1' } },
    );
    await expectBridgeCall(
      () => bridge.paymentList({ payerClientId: 'client-1' }),
      'payment_list',
      {
        input: { payerClientId: 'client-1' },
      },
    );
    invokeMock.mockResolvedValueOnce(undefined);
    await bridge.latestSuccessfulBackup();
    expect(invokeMock).toHaveBeenLastCalledWith('backup_latest_successful');
    await expectBridgeCall(() => bridge.setUsageCounters(true), 'settings_set_usage_counters', {
      enabled: true,
    });
  });
});
