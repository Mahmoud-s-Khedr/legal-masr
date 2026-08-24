use crate::{backup, db, errors::Error, repositories::settings_repository, state::AppState};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

pub fn create<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let connection = db::open_db(&db_path, &master)?;
    let settings = settings_repository::get_settings(&connection)?;
    let destination = settings
        .backup_directory
        .filter(|value| !value.trim().is_empty())
        .ok_or(Error::Validation)?;
    let documents = settings
        .managed_documents_directory
        .filter(|value| !value.trim().is_empty())
        .ok_or(Error::Operation)?;
    backup::create(
        &db_path,
        &master,
        &destination,
        std::path::Path::new(&documents),
    )
}

fn choose_backup<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, Error> {
    app.dialog()
        .file()
        .add_filter("LegalMaster backup", &["lmsbackup"])
        .blocking_pick_file()
        .ok_or(Error::Cancelled)?
        .into_path()
        .map_err(|_| Error::Operation)
}

pub fn validate<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    let path = choose_backup(app)?;
    backup::validate(&path.to_string_lossy(), &state.unlocked()?)
}

pub fn restore<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<(), Error> {
    let master = state.unlocked()?;
    let (_, active_db) = db::paths(app)?;
    let path = choose_backup(app)?;
    let documents = {
        let connection = db::open_db(&active_db, &master)?;
        settings_repository::get_settings(&connection)?
            .managed_documents_directory
            .filter(|value| !value.trim().is_empty())
            .ok_or(Error::Operation)?
    };
    backup::restore(
        &active_db,
        &master,
        &path.to_string_lossy(),
        std::path::Path::new(&documents),
    )
}
