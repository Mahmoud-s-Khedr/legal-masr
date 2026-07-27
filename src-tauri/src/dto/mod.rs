use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct Status {
    pub initialized: bool,
    pub unlocked: bool,
}

#[derive(Serialize)]
pub struct InitializeResult {
    pub recovery_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeInput {
    pub password: String,
    pub full_name: String,
    pub language: String,
    #[serde(default)]
    pub managed_documents_directory: Option<String>,
    #[serde(default)]
    pub backup_directory: Option<String>,
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
    pub lock_timeout_minutes: u32,
    pub managed_documents_directory: Option<String>,
    pub backup_directory: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClientDto {
    pub id: String,
    pub client_type: String,
    pub display_name: String,
    pub national_id: Option<String>,
    pub registration_number: Option<String>,
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
    pub client_type: String,
    pub display_name: String,
    pub national_id: Option<String>,
    pub registration_number: Option<String>,
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
    pub display_name: String,
    pub national_id: Option<String>,
    pub registration_number: Option<String>,
    pub primary_phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSummary {
    pub id: String,
    pub client_type: String,
    pub display_name: String,
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
    pub display_name: String,
    pub primary_phone: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseClientDto {
    pub client_id: String,
    pub display_name: String,
    pub is_primary: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CasePartyDto {
    pub id: String,
    pub case_id: String,
    pub role: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseDto {
    pub id: String,
    pub case_number: String,
    pub judicial_year: Option<i64>,
    pub court_name: Option<String>,
    pub circuit_name: Option<String>,
    pub case_type: Option<String>,
    pub client_legal_capacity: Option<String>,
    pub status: String,
    pub filed_on: Option<String>,
    pub closed_on: Option<String>,
    pub summary: Option<String>,
    pub notes: Option<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub clients: Vec<CaseClientDto>,
    pub parties: Vec<CasePartyDto>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseCreateInput {
    pub case_number: String,
    pub judicial_year: Option<i64>,
    pub court_name: Option<String>,
    pub circuit_name: Option<String>,
    pub case_type: Option<String>,
    pub client_legal_capacity: Option<String>,
    pub status: String,
    pub filed_on: Option<String>,
    pub summary: Option<String>,
    pub notes: Option<String>,
    pub client_ids: Vec<String>,
    pub primary_client_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseUpdateInput {
    pub id: String,
    pub case_number: String,
    pub judicial_year: Option<i64>,
    pub court_name: Option<String>,
    pub circuit_name: Option<String>,
    pub case_type: Option<String>,
    pub client_legal_capacity: Option<String>,
    pub status: String,
    pub filed_on: Option<String>,
    pub closed_on: Option<String>,
    pub summary: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseSummary {
    pub id: String,
    pub case_number: String,
    pub judicial_year: Option<i64>,
    pub status: String,
    pub primary_client_name: Option<String>,
    pub archived_at: Option<String>,
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
pub struct CasePartyInput {
    pub case_id: String,
    pub role: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CasePartyUpdateInput {
    pub id: String,
    pub role: String,
    pub name: String,
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
