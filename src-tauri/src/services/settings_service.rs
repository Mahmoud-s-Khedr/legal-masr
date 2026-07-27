use crate::{
    db, dto::SettingsDto, errors::Error, repositories::settings_repository, state::AppState,
};
use std::fs;
use tauri::{AppHandle, Runtime};

pub fn get<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<SettingsDto, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    settings_repository::get_settings(&conn)
}

pub fn update<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    language: &str,
    theme: &str,
    lock_timeout_minutes: u32,
    backup_directory: &str,
) -> Result<SettingsDto, Error> {
    if !matches!(language, "ar" | "en")
        || !matches!(theme, "system" | "light" | "dark")
        || lock_timeout_minutes == 0
        || backup_directory.trim().is_empty()
    {
        return Err(Error::Validation);
    }
    fs::create_dir_all(backup_directory)?;
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let conn = db::open_db(&db_path, &master)?;
    settings_repository::update_settings(
        &conn,
        language,
        theme,
        lock_timeout_minutes,
        backup_directory,
    )?;
    settings_repository::get_settings(&conn)
}
