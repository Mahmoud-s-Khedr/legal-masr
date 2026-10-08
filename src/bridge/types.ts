export type AppStatus = {
  initialized: boolean;
  unlocked: boolean;
  vaultState: 'EMPTY' | 'LOCKED' | 'UNLOCKED' | 'INCOMPLETE' | 'INTERRUPTED';
};
export type AppDiagnostic = { kind: string; detail: string };
export type AppError = {
  code: AppErrorCode;
  message: string;
  details: unknown;
  diagnostic?: AppDiagnostic;
};
export type AppErrorCode =
  | 'INVALID_PASSWORD'
  | 'APP_LOCKED'
  | 'ALREADY_INITIALIZED'
  | 'RECOVERY_KEY_INVALID'
  | 'BACKUP_CORRUPTED'
  | 'LEGACY_DATA_MIGRATION_REQUIRED'
  | 'VAULT_INTERRUPTED'
  | 'VAULT_MISSING'
  | 'VAULT_INCOMPLETE'
  | 'VAULT_CORRUPT'
  | 'VAULT_NEWER_SCHEMA'
  | 'VALIDATION_FAILED'
  | 'CLIENT_NOT_FOUND'
  | 'CASE_NOT_FOUND'
  | 'POWER_OF_ATTORNEY_NOT_FOUND'
  | 'POWER_OF_ATTORNEY_CLIENT_IN_USE'
  | 'HEARING_NOT_FOUND'
  | 'CLIENT_PROBABLE_DUPLICATE'
  | 'CLIENT_NUMBER_TAKEN'
  | 'CASE_NUMBER_TAKEN'
  | 'POWER_OF_ATTORNEY_NUMBER_TAKEN'
  | 'CASE_CLIENT_HAS_PAYMENTS'
  | 'CLIENT_ARCHIVED'
  | 'CASE_MUST_HAVE_CLIENT'
  | 'CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED'
  | 'TASK_NOT_FOUND'
  | 'ATTACHMENT_SOURCE_MISSING'
  | 'ATTACHMENT_NOT_FOUND'
  | 'PAYMENT_NOT_FOUND'
  | 'EXPENSE_NOT_FOUND'
  | 'OPERATION_FAILED'
  | 'OPERATION_CANCELLED';
export type Settings = {
  language: 'ar' | 'en';
  theme: 'system' | 'light' | 'dark';
  dateFormat: 'dd/MM/yyyy' | 'yyyy-MM-dd';
  weekStartsOn: number;
  defaultReminderMinutes: number;
  autostartEnabled: boolean;
  usageCountersEnabled: boolean;
  lockTimeoutMinutes: number;
};
export type SettingsUpdateInput = {
  language: Settings['language'];
  theme: Settings['theme'];
  dateFormat: Settings['dateFormat'];
  weekStartsOn: number;
  defaultReminderMinutes: number;
  lockTimeoutMinutes: number;
};
export type LatestSuccessfulBackup = {
  completedAt: string;
  archiveSizeBytes: number | null;
};
export type LawyerProfile = {
  fullName: string;
  barNumber: string | null;
  phone: string | null;
  officeAddress: string | null;
  defaultCurrency: 'EGP';
};
export type InitializeInput = {
  password: string;
  fullName: string;
  language: 'ar' | 'en';
  lockTimeoutMinutes?: number;
};

export type ClientDto = {
  id: string;
  internalNumber: string;
  fullName: string;
  nationalId: string | null;
  primaryPhone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientSummary = {
  id: string;
  internalNumber: string;
  fullName: string;
  primaryPhone: string | null;
  archivedAt: string | null;
};

export type ClientDuplicateCandidate = {
  id: string;
  fullName: string;
  primaryPhone: string | null;
};

export type ClientCreateInput = {
  internalNumber: string;
  fullName: string;
  nationalId?: string;
  primaryPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
  confirmDuplicate: boolean;
};

export type ClientUpdateInput = {
  id: string;
  internalNumber: string;
  fullName: string;
  nationalId?: string;
  primaryPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

export type ClientListInput = { query?: string; includeArchived?: boolean };

export type CaseStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export type CaseClientDto = {
  clientId: string;
  fullName: string;
  internalNumber: string;
  legalCapacity: string | null;
  powerOfAttorneyId: string | null;
  notes: string | null;
};

export type CaseOpponentDto = {
  id: string;
  caseId: string;
  fullName: string;
  legalCapacity: string | null;
  lawyerName: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export type CaseDto = {
  id: string;
  internalNumber: string;
  officialNumber: string | null;
  officialYear: number | null;
  judicialYear: number | null;
  courtName: string | null;
  circuitName: string | null;
  caseType: string | null;
  litigationDegree: 'FIRST_INSTANCE' | 'APPEAL' | 'CASSATION' | 'OTHER' | null;
  status: CaseStatus;
  filedOn: string | null;
  closedOn: string | null;
  subject: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clients: CaseClientDto[];
  opponents: CaseOpponentDto[];
};

export type CaseSummary = {
  id: string;
  internalNumber: string;
  officialNumber: string | null;
  officialYear: number | null;
  judicialYear: number | null;
  status: CaseStatus;
  clientNames: string[];
  archivedAt: string | null;
  courtName: string | null;
  /** Earliest hearing still awaiting its decision; it may already be in the past. */
  nextHearingDate: string | null;
};

export type CaseCreateInput = {
  internalNumber: string;
  officialNumber?: string;
  officialYear?: number;
  judicialYear?: number;
  courtName?: string;
  circuitName?: string;
  caseType?: string;
  litigationDegree?: 'FIRST_INSTANCE' | 'APPEAL' | 'CASSATION' | 'OTHER';
  status: CaseStatus;
  filedOn?: string;
  closedOn?: string;
  subject?: string;
  notes?: string;
  clients: CaseClientInput[];
};

export type CaseUpdateInput = {
  id: string;
  internalNumber: string;
  officialNumber?: string;
  officialYear?: number;
  judicialYear?: number;
  courtName?: string;
  circuitName?: string;
  caseType?: string;
  litigationDegree?: 'FIRST_INSTANCE' | 'APPEAL' | 'CASSATION' | 'OTHER';
  status: CaseStatus;
  filedOn?: string;
  closedOn?: string;
  subject?: string;
  notes?: string;
  clients: CaseClientInput[];
};

export type CaseListInput = {
  query?: string;
  status?: CaseStatus;
  clientId?: string;
  includeArchived?: boolean;
};

export type CaseClientInput = {
  clientId: string;
  legalCapacity?: string;
  powerOfAttorneyId?: string;
  notes?: string;
};

export type CaseOpponentInput = {
  caseId: string;
  fullName: string;
  legalCapacity?: string;
  lawyerName?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type CaseOpponentUpdateInput = {
  id: string;
  fullName: string;
  legalCapacity?: string;
  lawyerName?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type SearchEntityType = 'CLIENT' | 'CASE' | 'POWER_OF_ATTORNEY';
export type SearchHit = {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
};

export type PowerOfAttorneyLawyerInput = {
  id?: string;
  fullName: string;
  barNumber?: string;
  notes?: string;
};
export type PowerOfAttorneyLawyer = Required<
  Pick<PowerOfAttorneyLawyerInput, 'id' | 'fullName'>
> & {
  barNumber: string | null;
  notes: string | null;
};
export type PowerOfAttorneyClient = { id: string; fullName: string; internalNumber: string };
export type PowerOfAttorneyDto = {
  id: string;
  internalSequence: string;
  officialNumber: string | null;
  issueYear: number | null;
  issueDate: string | null;
  notaryOffice: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clients: PowerOfAttorneyClient[];
  lawyers: PowerOfAttorneyLawyer[];
  caseIds: string[];
};
export type PowerOfAttorneySummary = Pick<
  PowerOfAttorneyDto,
  'id' | 'internalSequence' | 'officialNumber' | 'issueYear' | 'archivedAt'
> & { clientNames: string[] };
export type PowerOfAttorneyInput = {
  id?: string;
  internalSequence: string;
  officialNumber?: string;
  issueYear?: number;
  issueDate?: string;
  notaryOffice?: string;
  notes?: string;
  clientIds: string[];
  lawyers: PowerOfAttorneyLawyerInput[];
};
export type PowerOfAttorneyListInput = {
  query?: string;
  includeArchived?: boolean;
  clientId?: string;
};

export type HearingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type HearingDto = {
  id: string;
  caseId: string;
  previousHearingId: string | null;
  hearingDate: string;
  hearingTime: string | null;
  hearingType: string | null;
  location: string | null;
  circuitName: string | null;
  requiredDocuments: string | null;
  notes: string | null;
  decisionText: string | null;
  status: HearingStatus;
  completedAt: string | null;
  reminderMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};
export type HearingInput = {
  id?: string;
  caseId: string;
  hearingDate: string;
  hearingTime?: string;
  hearingType?: string;
  location?: string;
  circuitName?: string;
  requiredDocuments?: string;
  notes?: string;
  reminderMinutes?: number;
};
export type HearingListInput = {
  caseId?: string;
  fromDate?: string;
  toDate?: string;
  status?: HearingStatus;
};
export type HearingDecisionInput = {
  id: string;
  decisionText?: string;
  nextHearing?: HearingInput;
};
export type HearingDecisionResult = { hearing: HearingDto; nextHearing: HearingDto | null };
export type TaskDto = {
  id: string;
  clientId: string | null;
  caseId: string | null;
  title: string;
  details: string | null;
  notes: string | null;
  dueDate: string;
  reminderMinutes: number | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type TaskInput = {
  id?: string;
  clientId?: string;
  caseId?: string;
  title: string;
  details?: string;
  notes?: string;
  dueDate: string;
  reminderMinutes?: number;
};
export type TaskListInput = {
  view?: 'TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED' | 'ALL';
  referenceDate: string;
  caseId?: string;
  clientId?: string;
};
export type DashboardSummary = {
  todayHearings: HearingDto[];
  todayTasks: TaskDto[];
  overdueTasks: TaskDto[];
  upcomingHearings: HearingDto[];
};
export type AttachmentCategory =
  | 'IDENTIFICATION'
  | 'POWER_OF_ATTORNEY'
  | 'CASE_FILE'
  | 'COURT_DECISION'
  | 'EVIDENCE'
  | 'RECEIPT'
  | 'CORRESPONDENCE'
  | 'OTHER';
export type AttachmentDto = {
  id: string;
  clientId: string | null;
  caseId: string | null;
  powerOfAttorneyId: string | null;
  expenseId: string | null;
  originalFilename: string;
  storedFilename: string;
  relativePath: string;
  category: AttachmentCategory;
  description: string | null;
  documentDate: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  sha256: string;
  createdAt: string;
  updatedAt: string;
};
export type AttachmentInput = {
  clientId?: string;
  caseId?: string;
  powerOfAttorneyId?: string;
  expenseId?: string;
  sourceToken: string;
  category: AttachmentCategory;
  description?: string;
  documentDate?: string;
};
export type AttachmentSourceSelection = { sourceToken: string; filename: string };
export type AttachmentUpdateInput = {
  id: string;
  category: AttachmentCategory;
  description?: string;
  documentDate?: string;
};
export type AttachmentListInput = {
  clientId?: string;
  caseId?: string;
  powerOfAttorneyId?: string;
  expenseId?: string;
};
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ELECTRONIC' | 'OTHER';
export type FeeAgreementDto = {
  id: string;
  caseId: string;
  amountMinor: number;
  agreementDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type FeeAgreementInput = {
  caseId: string;
  amountMinor: number;
  agreementDate?: string;
  notes?: string;
};
export type PaymentDto = {
  id: string;
  caseId: string;
  payerClientId: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PaymentInput = {
  id?: string;
  caseId: string;
  payerClientId: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
};
export type PaymentListInput = {
  payerClientId?: string;
  caseId?: string;
  fromDate?: string;
  toDate?: string;
};
export type ExpenseType = 'COURT_FEE' | 'TRANSPORT' | 'OFFICE_SUPPLIES' | 'EXPERT_FEE' | 'OTHER';
export type ExpenseDto = {
  id: string;
  caseId: string | null;
  clientId: string | null;
  amountMinor: number;
  expenseDate: string;
  expenseType: ExpenseType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ExpenseInput = {
  id?: string;
  clientId?: string;
  caseId?: string;
  amountMinor: number;
  expenseDate: string;
  expenseType: ExpenseType;
  notes?: string;
};
export type ExpenseListInput = {
  clientId?: string;
  caseId?: string;
  fromDate?: string;
  toDate?: string;
};
export type CaseFinanceSummary = {
  caseId: string;
  agreedFeeMinor: number;
  receivedMinor: number;
  outstandingMinor: number;
  expensesMinor: number;
  netCashMinor: number;
};
export type ClientFinanceSummary = {
  clientId: string;
  receivedMinor: number;
  expensesMinor: number;
  netCashMinor: number;
};
export type SearchRebuildResult = { indexedCount: number };

export type CaseSetClientsInput = { caseId: string; clients: CaseClientInput[] };
