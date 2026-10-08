import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AttachmentInput,
  AttachmentUpdateInput,
  CaseCreateInput,
  CaseOpponentInput,
  CaseOpponentUpdateInput,
  CaseUpdateInput,
  ClientCreateInput,
  ClientUpdateInput,
  ExpenseInput,
  FeeAgreementInput,
  HearingDecisionInput,
  HearingInput,
  InitializeInput,
  LawyerProfile,
  PaymentInput,
  PowerOfAttorneyInput,
  SettingsUpdateInput,
  TaskInput,
} from './types';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('./invoke', () => ({ invoke: invokeMock }));

import { bridge } from './commands';

const initializeInput: InitializeInput = {
  password: 'correct horse battery staple',
  fullName: 'أحمد علي',
  language: 'ar',
  lockTimeoutMinutes: 15,
};
const settingsInput: SettingsUpdateInput = {
  language: 'ar',
  theme: 'system',
  dateFormat: 'dd/MM/yyyy',
  weekStartsOn: 6,
  defaultReminderMinutes: 60,
  lockTimeoutMinutes: 15,
};
const profile: LawyerProfile = {
  fullName: 'أحمد علي',
  barNumber: '12345',
  phone: '01000000000',
  officeAddress: 'القاهرة',
  defaultCurrency: 'EGP',
};
const clientCreate: ClientCreateInput = {
  internalNumber: 'ع/١',
  fullName: 'فاطمة محمد',
  nationalId: '12345678901234',
  primaryPhone: '01000000001',
  email: 'fatma@example.test',
  address: 'الجيزة',
  notes: 'عميلة اختبار',
  confirmDuplicate: false,
};
const clientUpdate: ClientUpdateInput = { ...clientCreate, id: 'client-1' };
const powerOfAttorneyCreate: PowerOfAttorneyInput = {
  internalSequence: 'ت/١',
  officialNumber: '100',
  issueYear: 2026,
  issueDate: '2026-10-04',
  notaryOffice: 'مكتب التوثيق',
  notes: 'تفويض اختبار',
  clientIds: ['client-1'],
  lawyers: [{ fullName: 'أحمد علي', barNumber: '12345', notes: 'المحامي الموكل' }],
};
const powerOfAttorneyUpdate: PowerOfAttorneyInput = { ...powerOfAttorneyCreate, id: 'poa-1' };
const hearingCreate: HearingInput = {
  caseId: 'case-1',
  hearingDate: '2026-10-04',
  hearingTime: '09:30',
  hearingType: 'مرافعة',
  location: 'محكمة القاهرة',
  circuitName: 'الدائرة الأولى',
  requiredDocuments: 'التوكيل',
  notes: 'مراجعة الملف',
  reminderMinutes: 60,
};
const hearingUpdate: HearingInput = { ...hearingCreate, id: 'hearing-1' };
const hearingDecision: HearingDecisionInput = {
  id: 'hearing-1',
  decisionText: 'حجز للحكم',
  nextHearing: { ...hearingCreate, hearingDate: '2026-10-11' },
};
const caseCreate: CaseCreateInput = {
  internalNumber: 'ق/١',
  officialNumber: '500',
  officialYear: 2026,
  courtName: 'محكمة القاهرة',
  circuitName: 'الدائرة الأولى',
  caseType: 'مدني',
  litigationDegree: 'FIRST_INSTANCE',
  status: 'ACTIVE',
  filedOn: '2026-10-01',
  subject: 'دعوى اختبار',
  notes: 'ملاحظات اختبار',
  clients: [
    {
      clientId: 'client-1',
      legalCapacity: 'مدعٍ',
      powerOfAttorneyId: 'poa-1',
      notes: 'العميل الأساسي',
    },
  ],
};
const caseUpdate: CaseUpdateInput = { ...caseCreate, id: 'case-1' };
const opponentCreate: CaseOpponentInput = {
  caseId: 'case-1',
  fullName: 'الخصم',
  legalCapacity: 'مدعى عليه',
  lawyerName: 'محامي الخصم',
  phone: '01000000002',
  address: 'الإسكندرية',
  notes: 'بيانات الخصم',
};
const opponentUpdate: CaseOpponentUpdateInput = { ...opponentCreate, id: 'opponent-1' };
const taskCreate: TaskInput = {
  clientId: 'client-1',
  caseId: 'case-1',
  title: 'مراجعة الملف',
  details: 'قبل الجلسة',
  notes: 'هام',
  dueDate: '2026-10-04',
  reminderMinutes: 30,
};
const taskUpdate: TaskInput = { ...taskCreate, id: 'task-1' };
const attachmentCreate: AttachmentInput = {
  caseId: 'case-1',
  sourceToken: 'native-source-token',
  category: 'CASE_FILE',
  description: 'صحيفة الدعوى',
  documentDate: '2026-10-04',
};
const attachmentUpdate: AttachmentUpdateInput = {
  id: 'attachment-1',
  category: 'COURT_DECISION',
  description: 'حكم',
  documentDate: '2026-10-05',
};
const feeAgreement: FeeAgreementInput = {
  caseId: 'case-1',
  amountMinor: 200_000,
  agreementDate: '2026-10-01',
  notes: 'أتعاب متفق عليها',
};
const payment: PaymentInput = {
  id: 'payment-1',
  caseId: 'case-1',
  payerClientId: 'client-1',
  amountMinor: 150_000,
  paymentDate: '2026-10-04',
  paymentMethod: 'BANK_TRANSFER',
  notes: 'دفعة اختبار',
};
const expense: ExpenseInput = {
  id: 'expense-1',
  clientId: 'client-1',
  caseId: 'case-1',
  amountMinor: 5_000,
  expenseDate: '2026-10-04',
  expenseType: 'COURT_FEE',
  notes: 'رسم قضائي',
};

const contracts = [
  ['status', 'app_get_status', [], () => bridge.status()],
  [
    'initialize',
    'app_initialize',
    [{ input: initializeInput }],
    () => bridge.initialize(initializeInput),
  ],
  [
    'unlock',
    'app_unlock',
    [{ password: 'correct horse battery staple' }],
    () => bridge.unlock('correct horse battery staple'),
  ],
  [
    'recover',
    'app_recover_access',
    [{ recoveryKey: 'recovery-key', newPassword: 'new password' }],
    () => bridge.recover('recovery-key', 'new password'),
  ],
  ['lock', 'app_lock', [], () => bridge.lock()],
  [
    'changePassword',
    'app_change_password',
    [{ currentPassword: 'old password', newPassword: 'new password' }],
    () => bridge.changePassword('old password', 'new password'),
  ],
  ['createBackup', 'backup_create', [], () => bridge.createBackup()],
  ['latestSuccessfulBackup', 'backup_latest_successful', [], () => bridge.latestSuccessfulBackup()],
  ['validateBackup', 'backup_validate', [], () => bridge.validateBackup()],
  ['restoreBackup', 'backup_restore', [], () => bridge.restoreBackup()],
  [
    'openDeveloperContact',
    'settings_open_developer_contact',
    [{ contact: 'email' }],
    () => bridge.openDeveloperContact('email'),
  ],
  ['settings', 'settings_get', [], () => bridge.settings()],
  [
    'updateSettings',
    'settings_update',
    [{ input: settingsInput }],
    () => bridge.updateSettings(settingsInput),
  ],
  ['setAutostart', 'settings_set_autostart', [{ enabled: true }], () => bridge.setAutostart(true)],
  [
    'setUsageCounters',
    'settings_set_usage_counters',
    [{ enabled: true }],
    () => bridge.setUsageCounters(true),
  ],
  ['profile', 'profile_get', [], () => bridge.profile()],
  ['updateProfile', 'profile_update', [{ profile }], () => bridge.updateProfile(profile)],
  [
    'clientCreate',
    'client_create',
    [{ input: clientCreate }],
    () => bridge.clientCreate(clientCreate),
  ],
  [
    'clientUpdate',
    'client_update',
    [{ input: clientUpdate }],
    () => bridge.clientUpdate(clientUpdate),
  ],
  ['clientGet', 'client_get', [{ id: 'client-1' }], () => bridge.clientGet('client-1')],
  [
    'clientList',
    'client_list',
    [{ input: { query: 'فاطمة', includeArchived: true } }],
    () => bridge.clientList({ query: 'فاطمة', includeArchived: true }),
  ],
  ['clientArchive', 'client_archive', [{ id: 'client-1' }], () => bridge.clientArchive('client-1')],
  ['clientRestore', 'client_restore', [{ id: 'client-1' }], () => bridge.clientRestore('client-1')],
  ['clientExport', 'client_export', [{ id: 'client-1' }], () => bridge.clientExport('client-1')],
  [
    'powerOfAttorneyCreate',
    'power_of_attorney_create',
    [{ input: powerOfAttorneyCreate }],
    () => bridge.powerOfAttorneyCreate(powerOfAttorneyCreate),
  ],
  [
    'powerOfAttorneyUpdate',
    'power_of_attorney_update',
    [{ input: powerOfAttorneyUpdate }],
    () => bridge.powerOfAttorneyUpdate(powerOfAttorneyUpdate),
  ],
  [
    'powerOfAttorneyGet',
    'power_of_attorney_get',
    [{ id: 'poa-1' }],
    () => bridge.powerOfAttorneyGet('poa-1'),
  ],
  [
    'powerOfAttorneyList',
    'power_of_attorney_list',
    [{ input: { query: 'ت/١', includeArchived: true } }],
    () => bridge.powerOfAttorneyList({ query: 'ت/١', includeArchived: true }),
  ],
  [
    'powerOfAttorneyArchive',
    'power_of_attorney_archive',
    [{ id: 'poa-1' }],
    () => bridge.powerOfAttorneyArchive('poa-1'),
  ],
  [
    'powerOfAttorneyRestore',
    'power_of_attorney_restore',
    [{ id: 'poa-1' }],
    () => bridge.powerOfAttorneyRestore('poa-1'),
  ],
  [
    'hearingCreate',
    'hearing_create',
    [{ input: hearingCreate }],
    () => bridge.hearingCreate(hearingCreate),
  ],
  [
    'hearingUpdate',
    'hearing_update',
    [{ input: hearingUpdate }],
    () => bridge.hearingUpdate(hearingUpdate),
  ],
  ['hearingGet', 'hearing_get', [{ id: 'hearing-1' }], () => bridge.hearingGet('hearing-1')],
  [
    'hearingList',
    'hearing_list',
    [
      {
        input: {
          caseId: 'case-1',
          fromDate: '2026-10-01',
          toDate: '2026-10-31',
          status: 'SCHEDULED',
        },
      },
    ],
    () =>
      bridge.hearingList({
        caseId: 'case-1',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
        status: 'SCHEDULED',
      }),
  ],
  [
    'hearingRecordDecision',
    'hearing_record_decision',
    [{ input: hearingDecision }],
    () => bridge.hearingRecordDecision(hearingDecision),
  ],
  [
    'hearingDelete',
    'hearing_delete',
    [{ id: 'hearing-1' }],
    () => bridge.hearingDelete('hearing-1'),
  ],
  ['caseCreate', 'case_create', [{ input: caseCreate }], () => bridge.caseCreate(caseCreate)],
  [
    'caseSetClients',
    'case_set_clients',
    [{ input: { caseId: 'case-1', clients: caseUpdate.clients } }],
    () => bridge.caseSetClients({ caseId: 'case-1', clients: caseUpdate.clients }),
  ],
  ['caseUpdate', 'case_update', [{ input: caseUpdate }], () => bridge.caseUpdate(caseUpdate)],
  ['caseGet', 'case_get', [{ id: 'case-1' }], () => bridge.caseGet('case-1')],
  [
    'caseList',
    'case_list',
    [{ input: { query: 'ق/١', status: 'ACTIVE', clientId: 'client-1', includeArchived: true } }],
    () =>
      bridge.caseList({
        query: 'ق/١',
        status: 'ACTIVE',
        clientId: 'client-1',
        includeArchived: true,
      }),
  ],
  ['caseArchive', 'case_archive', [{ id: 'case-1' }], () => bridge.caseArchive('case-1')],
  ['caseRestore', 'case_restore', [{ id: 'case-1' }], () => bridge.caseRestore('case-1')],
  [
    'caseAddOpponent',
    'case_add_opponent',
    [{ input: opponentCreate }],
    () => bridge.caseAddOpponent(opponentCreate),
  ],
  [
    'caseUpdateOpponent',
    'case_update_opponent',
    [{ input: opponentUpdate }],
    () => bridge.caseUpdateOpponent(opponentUpdate),
  ],
  [
    'caseRemoveOpponent',
    'case_remove_opponent',
    [{ id: 'opponent-1' }],
    () => bridge.caseRemoveOpponent('opponent-1'),
  ],
  ['searchGlobal', 'search_global', [{ query: 'فاطمة' }], () => bridge.searchGlobal('فاطمة')],
  ['searchRebuildIndex', 'search_rebuild_index', [], () => bridge.searchRebuildIndex()],
  [
    'dashboardSummary',
    'dashboard_get_summary',
    [{ today: '2026-10-04' }],
    () => bridge.dashboardSummary('2026-10-04'),
  ],
  [
    'refreshReminders',
    'reminders_refresh',
    [{ today: '2026-10-04', nowTime: '09:30' }],
    () => bridge.refreshReminders('2026-10-04', '09:30'),
  ],
  ['taskCreate', 'task_create', [{ input: taskCreate }], () => bridge.taskCreate(taskCreate)],
  ['taskUpdate', 'task_update', [{ input: taskUpdate }], () => bridge.taskUpdate(taskUpdate)],
  [
    'taskList',
    'task_list',
    [
      {
        input: {
          view: 'UPCOMING',
          referenceDate: '2026-10-04',
          caseId: 'case-1',
          clientId: 'client-1',
        },
      },
    ],
    () =>
      bridge.taskList({
        view: 'UPCOMING',
        referenceDate: '2026-10-04',
        caseId: 'case-1',
        clientId: 'client-1',
      }),
  ],
  ['taskComplete', 'task_complete', [{ id: 'task-1' }], () => bridge.taskComplete('task-1')],
  ['taskReopen', 'task_reopen', [{ id: 'task-1' }], () => bridge.taskReopen('task-1')],
  ['taskDelete', 'task_delete', [{ id: 'task-1' }], () => bridge.taskDelete('task-1')],
  [
    'attachmentList',
    'attachment_list',
    [
      {
        input: {
          clientId: 'client-1',
          caseId: 'case-1',
          powerOfAttorneyId: 'poa-1',
          expenseId: 'expense-1',
        },
      },
    ],
    () =>
      bridge.attachmentList({
        clientId: 'client-1',
        caseId: 'case-1',
        powerOfAttorneyId: 'poa-1',
        expenseId: 'expense-1',
      }),
  ],
  ['attachmentSelectSource', 'attachment_select_source', [], () => bridge.attachmentSelectSource()],
  [
    'attachmentAdd',
    'attachment_add',
    [{ input: attachmentCreate }],
    () => bridge.attachmentAdd(attachmentCreate),
  ],
  [
    'attachmentUpdate',
    'attachment_update',
    [{ input: attachmentUpdate }],
    () => bridge.attachmentUpdate(attachmentUpdate),
  ],
  [
    'attachmentOpen',
    'attachment_open',
    [{ id: 'attachment-1' }],
    () => bridge.attachmentOpen('attachment-1'),
  ],
  [
    'attachmentReveal',
    'attachment_reveal',
    [{ id: 'attachment-1' }],
    () => bridge.attachmentReveal('attachment-1'),
  ],
  [
    'attachmentRemove',
    'attachment_remove',
    [{ id: 'attachment-1' }],
    () => bridge.attachmentRemove('attachment-1'),
  ],
  [
    'feeAgreementSave',
    'fee_agreement_save',
    [{ input: feeAgreement }],
    () => bridge.feeAgreementSave(feeAgreement),
  ],
  ['paymentSave', 'payment_save', [{ input: payment }], () => bridge.paymentSave(payment)],
  [
    'paymentList',
    'payment_list',
    [
      {
        input: {
          payerClientId: 'client-1',
          caseId: 'case-1',
          fromDate: '2026-10-01',
          toDate: '2026-10-31',
        },
      },
    ],
    () =>
      bridge.paymentList({
        payerClientId: 'client-1',
        caseId: 'case-1',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      }),
  ],
  ['expenseSave', 'expense_save', [{ input: expense }], () => bridge.expenseSave(expense)],
  [
    'expenseList',
    'expense_list',
    [
      {
        input: {
          clientId: 'client-1',
          caseId: 'case-1',
          fromDate: '2026-10-01',
          toDate: '2026-10-31',
        },
      },
    ],
    () =>
      bridge.expenseList({
        clientId: 'client-1',
        caseId: 'case-1',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      }),
  ],
  [
    'financeCaseSummary',
    'finance_case_summary',
    [{ id: 'case-1' }],
    () => bridge.financeCaseSummary('case-1'),
  ],
  [
    'financeClientSummary',
    'finance_client_summary',
    [{ id: 'client-1' }],
    () => bridge.financeClientSummary('client-1'),
  ],
] satisfies readonly [string, string, readonly unknown[], () => Promise<unknown>][];

describe('canonical Tauri bridge payload contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers every bridge method', () => {
    expect(contracts).toHaveLength(70);
    expect(Object.keys(bridge)).toHaveLength(70);
  });

  it.each(contracts)(
    '%s invokes %s with its exact argument envelope',
    async (_, command, args, call) => {
      invokeMock.mockResolvedValueOnce(undefined);

      await call();

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenLastCalledWith(command, ...args);
    },
  );
});
