use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub initialized: bool,
    pub unlocked: bool,
    pub vault_state: VaultState,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VaultState {
    Empty,
    Locked,
    Unlocked,
    Incomplete,
    Interrupted,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeResult {
    pub recovery_key: String,
}

#[cfg(test)]
mod tests {
    use super::InitializeResult;

    #[test]
    fn initialize_result_uses_the_camel_case_bridge_contract() {
        let result = InitializeResult {
            recovery_key: "recovery-key".into(),
        };

        assert_eq!(
            serde_json::to_value(result).unwrap(),
            serde_json::json!({ "recoveryKey": "recovery-key" })
        );
    }
}

#[derive(Deserialize, zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
#[serde(rename_all = "camelCase")]
pub struct InitializeInput {
    pub password: String,
    pub full_name: String,
    pub language: String,
    #[serde(default = "default_lock_timeout_minutes")]
    pub lock_timeout_minutes: u32,
}

fn default_lock_timeout_minutes() -> u32 {
    15
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub language: String,
    pub theme: String,
    pub date_format: String,
    pub week_starts_on: u8,
    pub default_reminder_minutes: u32,
    pub autostart_enabled: bool,
    pub usage_counters_enabled: bool,
    pub lock_timeout_minutes: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUpdateInput {
    pub language: String,
    pub theme: String,
    pub date_format: String,
    pub week_starts_on: u8,
    pub default_reminder_minutes: u32,
    pub lock_timeout_minutes: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestSuccessfulBackupDto {
    pub completed_at: String,
    pub archive_size_bytes: Option<i64>,
}

/// A checked backup: when it was made and how many documents it holds. `token` names the
/// chosen file for the following restore; the path itself never reaches the interface.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummaryDto {
    pub token: Option<String>,
    pub file_name: String,
    pub created_at: String,
    pub document_count: usize,
}

/// A backup chosen on a new installation, before its password is known.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupChoiceDto {
    pub token: String,
    pub file_name: String,
}

/// Opens a backup on a new installation with the password in use when it was made, or
/// with the recovery key and a new password.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreFromBackupInput {
    pub token: String,
    pub password: Option<String>,
    pub recovery_key: Option<String>,
    /// Required with the recovery key: the password the restored vault opens with from now on.
    pub new_password: Option<String>,
    pub language: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LawyerProfileDto {
    pub full_name: String,
    pub bar_number: Option<String>,
    pub phone: Option<String>,
    pub office_address: Option<String>,
    pub default_currency: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FeeAgreementDto {
    pub id: String,
    pub case_id: String,
    pub amount_minor: i64,
    pub agreement_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeeAgreementInput {
    pub case_id: String,
    pub amount_minor: i64,
    pub agreement_date: Option<String>,
    pub notes: Option<String>,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaymentDto {
    pub id: String,
    pub case_id: String,
    pub payer_client_id: String,
    pub amount_minor: i64,
    pub payment_date: String,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentInput {
    pub id: Option<String>,
    pub case_id: String,
    pub payer_client_id: String,
    pub amount_minor: i64,
    pub payment_date: String,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentListInput {
    pub payer_client_id: Option<String>,
    pub case_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseDto {
    pub id: String,
    pub case_id: Option<String>,
    pub client_id: Option<String>,
    pub amount_minor: i64,
    pub expense_date: String,
    pub expense_type: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseInput {
    pub id: Option<String>,
    pub case_id: Option<String>,
    pub client_id: Option<String>,
    pub amount_minor: i64,
    pub expense_date: String,
    pub expense_type: String,
    pub notes: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseListInput {
    pub client_id: Option<String>,
    pub case_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseFinanceSummary {
    pub case_id: String,
    pub agreed_fee_minor: i64,
    pub received_minor: i64,
    pub outstanding_minor: i64,
    pub expenses_minor: i64,
    pub net_cash_minor: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientFinanceSummary {
    pub client_id: String,
    pub received_minor: i64,
    pub expenses_minor: i64,
    pub net_cash_minor: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClientDto {
    pub id: String,
    pub internal_number: String,
    pub full_name: String,
    pub national_id: Option<String>,
    pub primary_phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCreateInput {
    pub internal_number: String,
    pub full_name: String,
    pub national_id: Option<String>,
    pub primary_phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub confirm_duplicate: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateInput {
    pub id: String,
    pub internal_number: String,
    pub full_name: String,
    pub national_id: Option<String>,
    pub primary_phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSummary {
    pub id: String,
    pub internal_number: String,
    pub full_name: String,
    pub primary_phone: Option<String>,
    pub archived_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientListInput {
    pub query: Option<String>,
    #[serde(default)]
    pub include_archived: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClientDuplicateCandidate {
    pub id: String,
    pub full_name: String,
    pub primary_phone: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseClientDto {
    pub client_id: String,
    pub full_name: String,
    pub internal_number: String,
    pub legal_capacity: Option<String>,
    pub power_of_attorney_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseOpponentDto {
    pub id: String,
    pub case_id: String,
    pub full_name: String,
    pub legal_capacity: Option<String>,
    pub lawyer_name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseDto {
    pub id: String,
    pub internal_number: String,
    pub official_number: Option<String>,
    pub official_year: Option<i64>,
    pub judicial_year: Option<i64>,
    pub case_type: Option<String>,
    pub litigation_degree: Option<String>,
    pub court_name: Option<String>,
    pub circuit_name: Option<String>,
    pub status: String,
    pub filed_on: Option<String>,
    pub closed_on: Option<String>,
    pub subject: Option<String>,
    pub notes: Option<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub clients: Vec<CaseClientDto>,
    pub opponents: Vec<CaseOpponentDto>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseCreateInput {
    pub internal_number: String,
    pub official_number: Option<String>,
    pub official_year: Option<i64>,
    pub judicial_year: Option<i64>,
    pub case_type: Option<String>,
    pub litigation_degree: Option<String>,
    pub court_name: Option<String>,
    pub circuit_name: Option<String>,
    pub status: String,
    pub filed_on: Option<String>,
    pub closed_on: Option<String>,
    pub subject: Option<String>,
    pub notes: Option<String>,
    pub clients: Vec<CaseClientInput>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseClientInput {
    pub client_id: String,
    pub legal_capacity: Option<String>,
    pub power_of_attorney_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseSetClientsInput {
    pub case_id: String,
    pub clients: Vec<CaseClientInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseUpdateInput {
    pub id: String,
    pub internal_number: String,
    pub official_number: Option<String>,
    pub official_year: Option<i64>,
    pub judicial_year: Option<i64>,
    pub case_type: Option<String>,
    pub litigation_degree: Option<String>,
    pub court_name: Option<String>,
    pub circuit_name: Option<String>,
    pub status: String,
    pub filed_on: Option<String>,
    pub closed_on: Option<String>,
    pub subject: Option<String>,
    pub notes: Option<String>,
    pub clients: Vec<CaseClientInput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseSummary {
    pub id: String,
    pub internal_number: String,
    pub official_number: Option<String>,
    pub official_year: Option<i64>,
    pub judicial_year: Option<i64>,
    pub status: String,
    pub client_names: Vec<String>,
    pub archived_at: Option<String>,
    pub court_name: Option<String>,
    /// Earliest hearing still awaiting its decision (it may already be in the past).
    pub next_hearing_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseListInput {
    pub query: Option<String>,
    pub status: Option<String>,
    pub client_id: Option<String>,
    #[serde(default)]
    pub include_archived: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseOpponentInput {
    pub case_id: String,
    pub full_name: String,
    pub legal_capacity: Option<String>,
    pub lawyer_name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseOpponentUpdateInput {
    pub id: String,
    pub full_name: String,
    pub legal_capacity: Option<String>,
    pub lawyer_name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub entity_type: String,
    pub entity_id: String,
    pub title: String,
    pub subtitle: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskDto {
    pub id: String,
    pub client_id: Option<String>,
    pub case_id: Option<String>,
    pub title: String,
    pub details: Option<String>,
    pub notes: Option<String>,
    pub due_date: String,
    pub reminder_minutes: Option<u32>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub id: Option<String>,
    pub client_id: Option<String>,
    pub case_id: Option<String>,
    pub title: String,
    pub details: Option<String>,
    pub notes: Option<String>,
    pub due_date: String,
    pub reminder_minutes: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListInput {
    pub view: Option<String>,
    pub reference_date: String,
    pub case_id: Option<String>,
    pub client_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentDto {
    pub id: String,
    pub client_id: Option<String>,
    pub case_id: Option<String>,
    pub power_of_attorney_id: Option<String>,
    pub expense_id: Option<String>,
    pub original_filename: String,
    pub stored_filename: String,
    pub relative_path: String,
    pub category: String,
    pub description: Option<String>,
    pub document_date: Option<String>,
    pub mime_type: Option<String>,
    pub file_size_bytes: i64,
    pub sha256: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentInput {
    pub client_id: Option<String>,
    pub case_id: Option<String>,
    pub power_of_attorney_id: Option<String>,
    pub expense_id: Option<String>,
    pub source_token: String,
    pub category: String,
    pub description: Option<String>,
    pub document_date: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentSourceSelection {
    pub source_token: String,
    pub filename: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentUpdateInput {
    pub id: String,
    pub category: String,
    pub description: Option<String>,
    pub document_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentListInput {
    pub case_id: Option<String>,
    pub client_id: Option<String>,
    pub power_of_attorney_id: Option<String>,
    pub expense_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub today_hearings: Vec<HearingDto>,
    pub today_tasks: Vec<TaskDto>,
    pub overdue_tasks: Vec<TaskDto>,
    pub upcoming_hearings: Vec<HearingDto>,
}

// Canonical Legal Masr contracts.  These coexist with the legacy DTOs only
// while the remaining feature callers are migrated in Phase 3.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneyDto {
    pub id: String,
    pub internal_sequence: String,
    pub official_number: Option<String>,
    pub issue_year: Option<i64>,
    pub issue_date: Option<String>,
    pub notary_office: Option<String>,
    pub notes: Option<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub clients: Vec<PowerOfAttorneyClientDto>,
    pub lawyers: Vec<PowerOfAttorneyLawyerDto>,
    pub case_ids: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneySummary {
    pub id: String,
    pub internal_sequence: String,
    pub official_number: Option<String>,
    pub issue_year: Option<i64>,
    pub client_names: Vec<String>,
    pub archived_at: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneyClientDto {
    pub id: String,
    pub full_name: String,
    pub internal_number: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneyLawyerDto {
    pub id: String,
    pub full_name: String,
    pub bar_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneyInput {
    pub id: Option<String>,
    pub internal_sequence: String,
    pub official_number: Option<String>,
    pub issue_year: Option<i64>,
    pub issue_date: Option<String>,
    pub notary_office: Option<String>,
    pub notes: Option<String>,
    pub client_ids: Vec<String>,
    pub lawyers: Vec<PowerOfAttorneyLawyerInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneyLawyerInput {
    pub id: Option<String>,
    pub full_name: String,
    pub bar_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerOfAttorneyListInput {
    pub query: Option<String>,
    #[serde(default)]
    pub include_archived: bool,
    #[serde(default)]
    pub client_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HearingDto {
    pub id: String,
    pub case_id: String,
    pub previous_hearing_id: Option<String>,
    pub hearing_date: String,
    pub hearing_time: Option<String>,
    pub hearing_type: Option<String>,
    pub location: Option<String>,
    pub circuit_name: Option<String>,
    pub required_documents: Option<String>,
    pub notes: Option<String>,
    pub decision_text: Option<String>,
    pub status: String,
    pub completed_at: Option<String>,
    pub reminder_minutes: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HearingInput {
    pub id: Option<String>,
    pub case_id: String,
    pub hearing_date: String,
    pub hearing_time: Option<String>,
    pub hearing_type: Option<String>,
    pub location: Option<String>,
    pub circuit_name: Option<String>,
    pub required_documents: Option<String>,
    pub notes: Option<String>,
    pub reminder_minutes: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HearingListInput {
    pub case_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HearingDecisionInput {
    pub id: String,
    pub decision_text: Option<String>,
    pub next_hearing: Option<HearingInput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HearingDecisionResult {
    pub hearing: HearingDto,
    pub next_hearing: Option<HearingDto>,
}
