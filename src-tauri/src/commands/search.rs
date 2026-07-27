use crate::{dto::SearchHit, errors::Error, services::search_service, state::AppState};
use serde::Serialize;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn search_global(
    app: AppHandle,
    state: State<AppState>,
    query: String,
) -> Result<Vec<SearchHit>, Error> {
    search_service::search(&app, &state, &query)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildResult {
    indexed_count: usize,
}

#[tauri::command]
pub fn search_rebuild_index(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RebuildResult, Error> {
    let indexed_count = search_service::rebuild_index(&app, &state)?;
    Ok(RebuildResult { indexed_count })
}
