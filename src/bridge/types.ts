export type AppStatus = { initialized: boolean; unlocked: boolean };
export type AppError = { code: string; message: string; details: unknown };
export type Settings = {
  language: "ar" | "en";
  theme: "system" | "light" | "dark";
  lockTimeoutMinutes: number;
  managedDocumentsDirectory: string | null;
  backupDirectory: string | null;
};
export type InitializeInput = {
  password: string;
  fullName: string;
  language: "ar" | "en";
  managedDocumentsDirectory?: string;
  backupDirectory?: string;
  lockTimeoutMinutes?: number;
};

export type ClientType = "INDIVIDUAL" | "ORGANIZATION";

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

export type ClientDuplicateCandidate = { id: string; displayName: string; primaryPhone: string | null };

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
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "JUDGMENT_ISSUED"
  | "APPEALED"
  | "ENFORCEMENT"
  | "CLOSED"
  | "ARCHIVED";

export type CasePartyRole = "OPPONENT" | "WITNESS" | "EXPERT" | "OTHER";

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

export type CaseListInput = { query?: string; status?: CaseStatus; clientId?: string; includeArchived?: boolean };

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

export type SearchHit = { entityType: string; entityId: string; title: string; subtitle: string | null };
