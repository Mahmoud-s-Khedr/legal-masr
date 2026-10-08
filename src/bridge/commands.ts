import { invoke } from './invoke';
import type {
  AppStatus,
  CaseCreateInput,
  CaseDto,
  CaseListInput,
  CaseOpponentDto,
  CaseOpponentInput,
  CaseOpponentUpdateInput,
  CaseSummary,
  CaseUpdateInput,
  CaseSetClientsInput,
  ClientCreateInput,
  ClientDto,
  ClientListInput,
  ClientSummary,
  ClientUpdateInput,
  InitializeInput,
  SearchHit,
  TaskDto,
  TaskInput,
  TaskListInput,
  DashboardSummary,
  AttachmentDto,
  AttachmentInput,
  AttachmentListInput,
  AttachmentSourceSelection,
  AttachmentUpdateInput,
  Settings,
  SettingsUpdateInput,
  LawyerProfile,
  LatestSuccessfulBackup,
  BackupChoice,
  BackupSummary,
  RestoreFromBackupInput,
  FeeAgreementInput,
  ExpenseDto,
  ExpenseInput,
  ExpenseListInput,
  FeeAgreementDto,
  PaymentDto,
  PaymentInput,
  PaymentListInput,
  CaseFinanceSummary,
  ClientFinanceSummary,
  PowerOfAttorneyDto,
  PowerOfAttorneyInput,
  PowerOfAttorneyListInput,
  PowerOfAttorneySummary,
  HearingDecisionInput,
  HearingDecisionResult,
  HearingDto,
  HearingInput,
  HearingListInput,
  SearchRebuildResult,
} from './types';

export type DeveloperContact = 'email' | 'phone' | 'whatsapp' | 'telegram' | 'linkedin';

export const bridge = {
  status: () => invoke<AppStatus>('app_get_status'),
  initialize: (input: InitializeInput) =>
    invoke<{ recoveryKey: string }>('app_initialize', { input }),
  unlock: (password: string) => invoke<void>('app_unlock', { password }),
  recover: (recoveryKey: string, newPassword: string) =>
    invoke<void>('app_recover_access', { recoveryKey, newPassword }),
  lock: () => invoke<void>('app_lock'),
  replaceRecoveryKey: (currentPassword: string) =>
    invoke<{ recoveryKey: string }>('app_replace_recovery_key', { currentPassword }),
  /** Saves the recovery key as a text file where the lawyer chooses. */
  saveRecoveryKey: (recoveryKey: string) => invoke<void>('app_save_recovery_key', { recoveryKey }),
  /** Opens the system print dialog; the page's print styles decide what is printed. */
  print: () => invoke<void>('app_print'),
  changePassword: (currentPassword: string, newPassword: string) =>
    invoke<void>('app_change_password', { currentPassword, newPassword }),
  /** On a new installation: choose a backup made on another computer. */
  chooseBackupToRestore: () => invoke<BackupChoice>('app_choose_backup'),
  restoreFromBackup: (input: RestoreFromBackupInput) =>
    invoke<void>('app_restore_from_backup', { input }),
  /** `stamp` is the local date and time, YYYY-MM-DD-HHmm; returns the file name. */
  createBackup: (stamp: string) => invoke<string>('backup_create', { stamp }),
  latestSuccessfulBackup: () => invoke<LatestSuccessfulBackup | null>('backup_latest_successful'),
  saveBackupCopy: () => invoke<string>('backup_save_copy'),
  revealBackup: () => invoke<void>('backup_reveal'),
  validateBackup: () => invoke<BackupSummary>('backup_validate'),
  inspectBackupToRestore: () => invoke<BackupSummary>('backup_inspect_restore'),
  restoreBackup: (token: string) => invoke<void>('backup_restore', { token }),
  openDeveloperContact: (contact: DeveloperContact) =>
    invoke<void>('settings_open_developer_contact', { contact }),
  settings: () => invoke<Settings>('settings_get'),
  updateSettings: (settings: SettingsUpdateInput) =>
    invoke<Settings>('settings_update', { input: settings }),
  setAutostart: (enabled: boolean) => invoke<Settings>('settings_set_autostart', { enabled }),
  setUsageCounters: (enabled: boolean) =>
    invoke<Settings>('settings_set_usage_counters', { enabled }),
  profile: () => invoke<LawyerProfile>('profile_get'),
  updateProfile: (profile: LawyerProfile) => invoke<LawyerProfile>('profile_update', { profile }),

  clientCreate: (input: ClientCreateInput) => invoke<ClientDto>('client_create', { input }),
  clientUpdate: (input: ClientUpdateInput) => invoke<ClientDto>('client_update', { input }),
  clientGet: (id: string) => invoke<ClientDto>('client_get', { id }),
  clientList: (input: ClientListInput) => invoke<ClientSummary[]>('client_list', { input }),
  clientArchive: (id: string) => invoke<ClientDto>('client_archive', { id }),
  clientRestore: (id: string) => invoke<ClientDto>('client_restore', { id }),
  clientExport: (id: string) => invoke<string>('client_export', { id }),

  powerOfAttorneyCreate: (input: PowerOfAttorneyInput) =>
    invoke<PowerOfAttorneyDto>('power_of_attorney_create', { input }),
  powerOfAttorneyUpdate: (input: PowerOfAttorneyInput) =>
    invoke<PowerOfAttorneyDto>('power_of_attorney_update', { input }),
  powerOfAttorneyGet: (id: string) => invoke<PowerOfAttorneyDto>('power_of_attorney_get', { id }),
  powerOfAttorneyList: (input: PowerOfAttorneyListInput = {}) =>
    invoke<PowerOfAttorneySummary[]>('power_of_attorney_list', { input }),
  powerOfAttorneyArchive: (id: string) =>
    invoke<PowerOfAttorneyDto>('power_of_attorney_archive', { id }),
  powerOfAttorneyRestore: (id: string) =>
    invoke<PowerOfAttorneyDto>('power_of_attorney_restore', { id }),

  hearingCreate: (input: HearingInput) => invoke<HearingDto>('hearing_create', { input }),
  hearingUpdate: (input: HearingInput) => invoke<HearingDto>('hearing_update', { input }),
  hearingGet: (id: string) => invoke<HearingDto>('hearing_get', { id }),
  hearingList: (input: HearingListInput = {}) => invoke<HearingDto[]>('hearing_list', { input }),
  hearingRecordDecision: (input: HearingDecisionInput) =>
    invoke<HearingDecisionResult>('hearing_record_decision', { input }),
  hearingDelete: (id: string) => invoke<void>('hearing_delete', { id }),

  caseCreate: (input: CaseCreateInput) => invoke<CaseDto>('case_create', { input }),
  caseSetClients: (input: CaseSetClientsInput) => invoke<CaseDto>('case_set_clients', { input }),
  caseUpdate: (input: CaseUpdateInput) => invoke<CaseDto>('case_update', { input }),
  caseGet: (id: string) => invoke<CaseDto>('case_get', { id }),
  caseList: (input: CaseListInput) => invoke<CaseSummary[]>('case_list', { input }),
  caseArchive: (id: string) => invoke<CaseDto>('case_archive', { id }),
  caseRestore: (id: string) => invoke<CaseDto>('case_restore', { id }),
  caseAddOpponent: (input: CaseOpponentInput) =>
    invoke<CaseOpponentDto>('case_add_opponent', { input }),
  caseUpdateOpponent: (input: CaseOpponentUpdateInput) =>
    invoke<CaseOpponentDto>('case_update_opponent', { input }),
  caseRemoveOpponent: (id: string) => invoke<void>('case_remove_opponent', { id }),

  searchGlobal: (query: string) => invoke<SearchHit[]>('search_global', { query }),
  searchRebuildIndex: () => invoke<SearchRebuildResult>('search_rebuild_index'),
  dashboardSummary: (today: string) => invoke<DashboardSummary>('dashboard_get_summary', { today }),
  refreshReminders: (today: string, nowTime: string) =>
    invoke<number>('reminders_refresh', { today, nowTime }),
  taskCreate: (input: TaskInput) => invoke<TaskDto>('task_create', { input }),
  taskUpdate: (input: TaskInput) => invoke<TaskDto>('task_update', { input }),
  taskList: (input: TaskListInput) => invoke<TaskDto[]>('task_list', { input }),
  taskComplete: (id: string) => invoke<TaskDto>('task_complete', { id }),
  taskReopen: (id: string) => invoke<TaskDto>('task_reopen', { id }),
  taskDelete: (id: string) => invoke<void>('task_delete', { id }),
  attachmentList: (input: AttachmentListInput = {}) =>
    invoke<AttachmentDto[]>('attachment_list', { input }),
  attachmentSelectSource: () => invoke<AttachmentSourceSelection>('attachment_select_source'),
  attachmentAdd: (input: AttachmentInput) => invoke<AttachmentDto>('attachment_add', { input }),
  attachmentUpdate: (input: AttachmentUpdateInput) =>
    invoke<AttachmentDto>('attachment_update', { input }),
  attachmentOpen: (id: string) => invoke<void>('attachment_open', { id }),
  attachmentReveal: (id: string) => invoke<void>('attachment_reveal', { id }),
  attachmentRemove: (id: string) => invoke<void>('attachment_remove', { id }),
  feeAgreementSave: (input: FeeAgreementInput) =>
    invoke<FeeAgreementDto>('fee_agreement_save', { input }),
  paymentSave: (input: PaymentInput) => invoke<PaymentDto>('payment_save', { input }),
  paymentList: (input: PaymentListInput = {}) => invoke<PaymentDto[]>('payment_list', { input }),
  paymentDelete: (id: string) => invoke<void>('payment_delete', { id }),
  expenseSave: (input: ExpenseInput) => invoke<ExpenseDto>('expense_save', { input }),
  expenseList: (input: ExpenseListInput = {}) => invoke<ExpenseDto[]>('expense_list', { input }),
  expenseDelete: (id: string) => invoke<void>('expense_delete', { id }),
  financeCaseSummary: (id: string) => invoke<CaseFinanceSummary>('finance_case_summary', { id }),
  financeClientSummary: (id: string) =>
    invoke<ClientFinanceSummary>('finance_client_summary', { id }),
};
