use crate::{
    dto::{LawyerProfileDto, SettingsDto, SettingsUpdateInput},
    errors::Error,
    services::settings_service,
    state::AppState,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn settings_get(app: AppHandle, state: State<AppState>) -> Result<SettingsDto, Error> {
    settings_service::get(&app, &state)
}

#[tauri::command]
pub fn settings_update(
    app: AppHandle,
    state: State<AppState>,
    input: SettingsUpdateInput,
) -> Result<SettingsDto, Error> {
    settings_service::update(&app, &state, &input)
}

#[tauri::command]
pub fn profile_get(app: AppHandle, state: State<AppState>) -> Result<LawyerProfileDto, Error> {
    settings_service::get_profile(&app, &state)
}

#[tauri::command]
pub fn profile_update(
    app: AppHandle,
    state: State<AppState>,
    profile: LawyerProfileDto,
) -> Result<LawyerProfileDto, Error> {
    settings_service::update_profile(&app, &state, profile)
}

#[tauri::command]
pub fn settings_set_autostart(
    app: AppHandle,
    state: State<AppState>,
    enabled: bool,
) -> Result<SettingsDto, Error> {
    settings_service::set_autostart(&app, &state, enabled)
}

#[tauri::command]
pub fn settings_set_usage_counters(
    app: AppHandle,
    state: State<AppState>,
    enabled: bool,
) -> Result<SettingsDto, Error> {
    settings_service::set_usage_counters(&app, &state, enabled)
}

#[tauri::command]
pub fn settings_open_developer_contact(
    app: AppHandle,
    state: State<AppState>,
    contact: String,
) -> Result<(), Error> {
    settings_service::open_developer_contact(&app, &state, &contact)
}
