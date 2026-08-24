use crate::{
    db,
    dto::{LawyerProfileDto, SettingsDto, SettingsUpdateInput},
    errors::Error,
    repositories::settings_repository,
    state::AppState,
};
use tauri::{AppHandle, Runtime};
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

pub fn get<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<SettingsDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    settings_repository::get_settings(&conn)
}

pub fn update<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    input: &SettingsUpdateInput,
) -> Result<SettingsDto, Error> {
    if !matches!(input.language.as_str(), "ar" | "en")
        || !matches!(input.theme.as_str(), "system" | "light" | "dark")
        || !matches!(input.date_format.as_str(), "dd/MM/yyyy" | "yyyy-MM-dd")
        || input.week_starts_on > 6
        || input.default_reminder_minutes > 10_080
        || input.lock_timeout_minutes == 0
    {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    settings_repository::update_settings(&conn, input)?;
    settings_repository::get_settings(&conn)
}

pub fn get_profile<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<LawyerProfileDto, Error> {
    let master = state.unlocked()?;
    let (_, database_path) = db::paths(app)?;
    settings_repository::get_profile(&db::open_db(&database_path, &master)?)
}

pub fn update_profile<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    profile: LawyerProfileDto,
) -> Result<LawyerProfileDto, Error> {
    if profile.full_name.trim().is_empty() || profile.default_currency != "EGP" {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, database_path) = db::paths(app)?;
    settings_repository::update_profile(&db::open_db(&database_path, &master)?, &profile)
}

pub fn set_autostart<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    enabled: bool,
) -> Result<SettingsDto, Error> {
    let master = state.unlocked()?;
    let (_, database_path) = db::paths(app)?;
    let connection = db::open_db(&database_path, &master)?;
    if enabled {
        app.autolaunch().enable().map_err(|_| Error::Operation)?;
    } else {
        app.autolaunch().disable().map_err(|_| Error::Operation)?;
    }
    settings_repository::update_autostart(&connection, enabled)?;
    settings_repository::get_settings(&connection)
}

pub fn set_usage_counters<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    enabled: bool,
) -> Result<SettingsDto, Error> {
    let master = state.unlocked()?;
    let (_, database_path) = db::paths(app)?;
    let connection = db::open_db(&database_path, &master)?;
    settings_repository::update_usage_counters(&connection, enabled)?;
    settings_repository::get_settings(&connection)
}
