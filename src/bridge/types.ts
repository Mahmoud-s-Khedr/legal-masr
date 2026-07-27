export type AppStatus = { initialized: boolean; unlocked: boolean };
export type AppError = { code: string; message: string; details: unknown };
export type Settings = {
  language: 'ar' | 'en';
  theme: 'system' | 'light' | 'dark';
  lockTimeoutMinutes: number;
  managedDocumentsDirectory: string | null;
  backupDirectory: string | null;
};
export type InitializeInput = {
  password: string;
  fullName: string;
  language: 'ar' | 'en';
  managedDocumentsDirectory?: string;
  backupDirectory?: string;
  lockTimeoutMinutes?: number;
};

export type ClientType = 'INDIVIDUAL' | 'ORGANIZATION';

export type ClientDto = {
  id: string;
  clientType: ClientType;
  displayName: string;
  nationalId: string | null;
  registrationNumber: string | null;
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
  clientType: ClientType;
  displayName: string;
  primaryPhone: string | null;
  archivedAt: string | null;
};

export type ClientDuplicateCandidate = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
};

export type ClientCreateInput = {
  clientType: ClientType;
  displayName: string;
  nationalId?: string;
  registrationNumber?: string;
  primaryPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
  confirmDuplicate: boolean;
};

export type ClientUpdateInput = {
  id: string;
  displayName: string;
  nationalId?: string;
  registrationNumber?: string;
  primaryPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

export type ClientListInput = { query?: string; includeArchived?: boolean };

export type CaseStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'JUDGMENT_ISSUED'
  | 'APPEALED'
  | 'ENFORCEMENT'
  | 'CLOSED'
  | 'ARCHIVED';

export type CasePartyRole = 'OPPONENT' | 'WITNESS' | 'EXPERT' | 'OTHER';

export type CaseClientDto = { clientId: string; displayName: string; isPrimary: boolean };

export type CasePartyDto = {
  id: string;
  caseId: string;
  role: CasePartyRole;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export type CaseDto = {
  id: string;
  caseNumber: string;
  judicialYear: number | null;
  courtName: string | null;
  circuitName: string | null;
  caseType: string | null;
  clientLegalCapacity: string | null;
  status: CaseStatus;
  filedOn: string | null;
  closedOn: string | null;
  summary: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clients: CaseClientDto[];
  parties: CasePartyDto[];
};

export type CaseSummary = {
  id: string;
  caseNumber: string;
  judicialYear: number | null;
  status: CaseStatus;
  primaryClientName: string | null;
  archivedAt: string | null;
};

export type CaseCreateInput = {
  caseNumber: string;
  judicialYear?: number;
  courtName?: string;
  circuitName?: string;
  caseType?: string;
  clientLegalCapacity?: string;
  status: CaseStatus;
  filedOn?: string;
  summary?: string;
  notes?: string;
  clientIds: string[];
  primaryClientId: string;
};

export type CaseUpdateInput = {
  id: string;
  caseNumber: string;
  judicialYear?: number;
  courtName?: string;
  circuitName?: string;
  caseType?: string;
  clientLegalCapacity?: string;
  status: CaseStatus;
  filedOn?: string;
  closedOn?: string;
  summary?: string;
  notes?: string;
};

export type CaseListInput = {
  query?: string;
  status?: CaseStatus;
  clientId?: string;
  includeArchived?: boolean;
};

export type CasePartyInput = {
  caseId: string;
  role: CasePartyRole;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type CasePartyUpdateInput = {
  id: string;
  role: CasePartyRole;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type SearchHit = {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
};
export type EventDto = {
  id: string;
  caseId: string | null;
  clientId: string | null;
  eventType: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  location: string | null;
  circuitName: string | null;
  preparationNotes: string | null;
  requiredDocuments: string | null;
  outcome: string | null;
  decisionText: string | null;
  nextAction: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type EventInput = {
  id?: string;
  caseId?: string;
  clientId?: string;
  eventType: string;
  title: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  circuitName?: string;
  preparationNotes?: string;
  requiredDocuments?: string;
};
export type EventListInput = {
  fromDate?: string;
  toDate?: string;
  caseId?: string;
  clientId?: string;
  status?: string;
};
export type TaskDto = {
  id: string;
  clientId: string | null;
  caseId: string | null;
  sourceEventId: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type TaskInput = {
  id?: string;
  clientId?: string;
  caseId?: string;
  sourceEventId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority: TaskDto['priority'];
};
export type TaskListInput = {
  dueFrom?: string;
  dueTo?: string;
  caseId?: string;
  clientId?: string;
  priority?: TaskDto['priority'];
  status?: TaskDto['status'];
};
export type DashboardSummary = {
  todayEvents: EventDto[];
  todayTasks: TaskDto[];
  overdueTasks: TaskDto[];
  missingOutcomeEvents: EventDto[];
  upcomingEvents: EventDto[];
};
export type DocumentDto = {
  id: string;
  clientId: string | null;
  caseId: string | null;
  storageMode: 'MANAGED_COPY' | 'EXTERNAL_REFERENCE';
  originalFilename: string;
  category: string;
  description: string | null;
  documentDate: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  missingAt: string | null;
  createdAt: string;
};
export type DocumentReferenceInput = {
  clientId?: string;
  caseId?: string;
  path: string;
  category: string;
  description?: string;
  documentDate?: string;
};
export type DocumentUpdateInput = {
  id: string;
  category: string;
  description?: string;
  documentDate?: string;
};
export type FinancialTransactionType =
  'FEE_PAYMENT' | 'CASE_EXPENSE' | 'REFUND' | 'OTHER_INCOME' | 'OTHER_EXPENSE';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'MOBILE_WALLET' | 'OTHER';
export type FeeAgreementInput = {
  caseId: string;
  amountMinor: number;
  agreementDate?: string;
  notes?: string;
};
export type FinancialTransactionInput = {
  id?: string;
  clientId: string;
  caseId?: string;
  transactionType: FinancialTransactionType;
  amountMinor: number;
  transactionDate: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  receiptDocumentId?: string;
};
export type FinancialTransactionDto = FinancialTransactionInput & {
  id: string;
  currency: 'EGP';
  reversedTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type FinancialTransactionListInput = {
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
  currency: 'EGP';
};
export type ClientFinanceSummary = {
  clientId: string;
  receivedMinor: number;
  expensesMinor: number;
  netCashMinor: number;
  currency: 'EGP';
};
