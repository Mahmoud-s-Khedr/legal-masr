import { invoke } from './invoke';
import type {
  AppStatus,
  CaseCreateInput,
  CaseDto,
  CaseListInput,
  CasePartyDto,
  CasePartyInput,
  CasePartyUpdateInput,
  CaseSummary,
  CaseUpdateInput,
  ClientCreateInput,
  ClientDto,
  ClientListInput,
  ClientSummary,
  ClientUpdateInput,
  InitializeInput,
  SearchHit,
  EventDto,
  EventInput,
  EventListInput,
  TaskDto,
  TaskInput,
  TaskListInput,
  DashboardSummary,
  DocumentDto,
  DocumentReferenceInput,
  DocumentUpdateInput,
  Settings,
  LawyerProfile,
  FeeAgreementInput,
  FinancialTransactionInput,
  FinancialTransactionDto,
  FinancialTransactionListInput,
  CaseFinanceSummary,
  ClientFinanceSummary,
} from './types';

export const bridge = {
  status: () => invoke<AppStatus>('app_get_status'),
  initialize: (input: InitializeInput) =>
    invoke<{ recoveryKey: string }>('app_initialize', { input }),
  unlock: (password: string) => invoke<void>('app_unlock', { password }),
  recover: (recoveryKey: string, newPassword: string) =>
    invoke<void>('app_recover_access', { recoveryKey, newPassword }),
  lock: () => invoke<void>('app_lock'),
  changePassword: (currentPassword: string, newPassword: string) =>
    invoke<void>('app_change_password', { currentPassword, newPassword }),
  createBackup: (destination: string) => invoke<string>('backup_create', { destination }),
  validateBackup: (path: string) => invoke<void>('backup_validate', { path }),
  restoreBackup: (path: string) => invoke<void>('backup_restore', { path }),
  settings: () => invoke<Settings>('settings_get'),
  updateSettings: (settings: Omit<Settings, 'managedDocumentsDirectory' | 'autostartEnabled'>) =>
    invoke<Settings>('settings_update', { input: settings }),
  setAutostart: (enabled: boolean) => invoke<Settings>('settings_set_autostart', { enabled }),
  profile: () => invoke<LawyerProfile>('profile_get'),
  updateProfile: (profile: LawyerProfile) => invoke<LawyerProfile>('profile_update', { profile }),

  clientCreate: (input: ClientCreateInput) => invoke<ClientDto>('client_create', { input }),
  clientUpdate: (input: ClientUpdateInput) => invoke<ClientDto>('client_update', { input }),
  clientGet: (id: string) => invoke<ClientDto>('client_get', { id }),
  clientList: (input: ClientListInput) => invoke<ClientSummary[]>('client_list', { input }),
  clientArchive: (id: string) => invoke<ClientDto>('client_archive', { id }),
  clientRestore: (id: string) => invoke<ClientDto>('client_restore', { id }),
  clientExport: (id: string, destination: string) =>
    invoke<string>('client_export', { id, destination }),

  caseCreate: (input: CaseCreateInput) => invoke<CaseDto>('case_create', { input }),
  caseUpdate: (input: CaseUpdateInput) => invoke<CaseDto>('case_update', { input }),
  caseGet: (id: string) => invoke<CaseDto>('case_get', { id }),
  caseList: (input: CaseListInput) => invoke<CaseSummary[]>('case_list', { input }),
  caseArchive: (id: string) => invoke<CaseDto>('case_archive', { id }),
  caseRestore: (id: string) => invoke<CaseDto>('case_restore', { id }),
  caseExport: (id: string, destination: string) =>
    invoke<string>('case_export', { id, destination }),
  caseAttachClient: (caseId: string, clientId: string, makePrimary: boolean) =>
    invoke<CaseDto>('case_attach_client', { caseId, clientId, makePrimary }),
  caseDetachClient: (caseId: string, clientId: string) =>
    invoke<CaseDto>('case_detach_client', { caseId, clientId }),
  caseSetPrimaryClient: (caseId: string, clientId: string) =>
    invoke<CaseDto>('case_set_primary_client', { caseId, clientId }),
  caseAddParty: (input: CasePartyInput) => invoke<CasePartyDto>('case_add_party', { input }),
  caseUpdateParty: (input: CasePartyUpdateInput) =>
    invoke<CasePartyDto>('case_update_party', { input }),
  caseRemoveParty: (id: string) => invoke<void>('case_remove_party', { id }),

  searchGlobal: (query: string) => invoke<SearchHit[]>('search_global', { query }),
  searchRebuildIndex: () => invoke<{ indexedCount: number }>('search_rebuild_index'),
  dashboardSummary: (today: string) => invoke<DashboardSummary>('dashboard_get_summary', { today }),
  refreshReminders: (today: string, nowTime: string) =>
    invoke<number>('reminders_refresh', { today, nowTime }),
  eventCreate: (input: EventInput) => invoke<EventDto>('event_create', { input }),
  eventUpdate: (input: EventInput) => invoke<EventDto>('event_update', { input }),
  eventList: (input: EventListInput) => invoke<EventDto[]>('event_list', { input }),
  eventComplete: (input: {
    id: string;
    outcome?: string;
    decisionText?: string;
    nextAction?: string;
    nextHearingDate?: string;
    createTaskTitle?: string;
  }) => invoke<EventDto>('event_complete', { input }),
  eventDelete: (id: string) => invoke<void>('event_delete', { id }),
  taskCreate: (input: TaskInput) => invoke<TaskDto>('task_create', { input }),
  taskUpdate: (input: TaskInput) => invoke<TaskDto>('task_update', { input }),
  taskList: (input: TaskListInput) => invoke<TaskDto[]>('task_list', { input }),
  taskComplete: (id: string) => invoke<TaskDto>('task_complete', { id }),
  taskReopen: (id: string) => invoke<TaskDto>('task_reopen', { id }),
  taskDelete: (id: string) => invoke<void>('task_delete', { id }),
  documentList: (input: { caseId?: string; clientId?: string; includeArchived?: boolean } = {}) =>
    invoke<DocumentDto[]>('document_list', { input }),
  documentImportManaged: (input: DocumentReferenceInput) =>
    invoke<DocumentDto>('document_import_managed', { input }),
  documentAddReference: (input: DocumentReferenceInput) =>
    invoke<DocumentDto>('document_add_reference', { input }),
  documentUpdate: (input: DocumentUpdateInput) => invoke<DocumentDto>('document_update', { input }),
  documentCheckMissing: (id: string) => invoke<boolean>('document_check_missing', { id }),
  documentOpen: (id: string) => invoke<void>('document_open', { id }),
  documentReveal: (id: string) => invoke<void>('document_reveal', { id }),
  documentRemove: (id: string) => invoke<void>('document_remove', { id }),
  financeFeeAgreementSave: (input: FeeAgreementInput) =>
    invoke('finance_fee_agreement_save', { input }),
  financeTransactionSave: (input: FinancialTransactionInput) =>
    invoke<FinancialTransactionDto>('finance_transaction_save', { input }),
  financeTransactionReverse: (id: string, transactionDate: string) =>
    invoke<FinancialTransactionDto>('finance_transaction_reverse', { id, transactionDate }),
  financeTransactionList: (input: FinancialTransactionListInput = {}) =>
    invoke<FinancialTransactionDto[]>('finance_transaction_list', { input }),
  financeCaseSummary: (id: string) => invoke<CaseFinanceSummary>('finance_case_summary', { id }),
  financeClientSummary: (id: string) =>
    invoke<ClientFinanceSummary>('finance_client_summary', { id }),
};
