use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DeletionTarget {
    Client { id: String },
    Case { id: String },
    All,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletionInput {
    pub target: DeletionTarget,
    pub token: String,
    pub backup_first: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeletionPreview {
    pub token: String,
    pub counts: BTreeMap<String, u64>,
    pub managed_files: u64,
    pub vault_files: u64,
}

#[derive(Default, Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeletionResult {
    pub failed_managed_files: u64,
    pub failed_vault_entries: u64,
    pub reset_complete: bool,
    pub backup_created: bool,
}
