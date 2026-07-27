import { invoke } from "./invoke";
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
  Settings,
} from "./types";

export const bridge = {
  status: () => invoke<AppStatus>("app_get_status"),
  initialize: (input: InitializeInput) => invoke<{ recoveryKey: string }>("app_initialize", { input }),
  unlock: (password: string) => invoke<void>("app_unlock", { password }),
  recover: (recoveryKey: string, newPassword: string) =>
    invoke<void>("app_recover_access", { recoveryKey, newPassword }),
  lock: () => invoke<void>("app_lock"),
  createBackup: (destination: string) => invoke<string>("backup_create", { destination }),
  validateBackup: (path: string) => invoke<void>("backup_validate", { path }),
  restoreBackup: (path: string) => invoke<void>("backup_restore", { path }),
  settings: () => invoke<Settings>("settings_get"),
  updateSettings: (settings: Pick<Settings, "language" | "theme" | "lockTimeoutMinutes"> & { backupDirectory: string }) =>
    invoke<Settings>("settings_update", settings),

  clientCreate: (input: ClientCreateInput) => invoke<ClientDto>("client_create", { input }),
  clientUpdate: (input: ClientUpdateInput) => invoke<ClientDto>("client_update", { input }),
  clientGet: (id: string) => invoke<ClientDto>("client_get", { id }),
  clientList: (input: ClientListInput) => invoke<ClientSummary[]>("client_list", { input }),
  clientArchive: (id: string) => invoke<ClientDto>("client_archive", { id }),
  clientRestore: (id: string) => invoke<ClientDto>("client_restore", { id }),
  clientExport: (id: string, destination: string) => invoke<string>("client_export", { id, destination }),

  caseCreate: (input: CaseCreateInput) => invoke<CaseDto>("case_create", { input }),
  caseUpdate: (input: CaseUpdateInput) => invoke<CaseDto>("case_update", { input }),
  caseGet: (id: string) => invoke<CaseDto>("case_get", { id }),
  caseList: (input: CaseListInput) => invoke<CaseSummary[]>("case_list", { input }),
  caseArchive: (id: string) => invoke<CaseDto>("case_archive", { id }),
  caseRestore: (id: string) => invoke<CaseDto>("case_restore", { id }),
  caseExport: (id: string, destination: string) => invoke<string>("case_export", { id, destination }),
  caseAttachClient: (caseId: string, clientId: string, makePrimary: boolean) =>
    invoke<CaseDto>("case_attach_client", { caseId, clientId, makePrimary }),
  caseDetachClient: (caseId: string, clientId: string) =>
    invoke<CaseDto>("case_detach_client", { caseId, clientId }),
  caseSetPrimaryClient: (caseId: string, clientId: string) =>
    invoke<CaseDto>("case_set_primary_client", { caseId, clientId }),
  caseAddParty: (input: CasePartyInput) => invoke<CasePartyDto>("case_add_party", { input }),
  caseUpdateParty: (input: CasePartyUpdateInput) => invoke<CasePartyDto>("case_update_party", { input }),
  caseRemoveParty: (id: string) => invoke<void>("case_remove_party", { id }),

  searchGlobal: (query: string) => invoke<SearchHit[]>("search_global", { query }),
  searchRebuildIndex: () => invoke<{ indexedCount: number }>("search_rebuild_index"),
};
