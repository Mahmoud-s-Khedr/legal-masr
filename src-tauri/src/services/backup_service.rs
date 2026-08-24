use crate::{backup, db, errors::Error, repositories::backup_repository, state::AppState};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

pub fn create<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> Result<String, Error> {
    let master = state.unlocked()?;
    let (_, db_path) = db::paths(app)?;
    let connection = db::open_db(&db_path, &master)?;
    let history_id = uuid::Uuid::new_v4().to_string();
    backup_repository::start(&connection, &history_id, &db::now())?;
    let data_dir = db::app_dir(app)?;
    let destination = data_dir.join("Backups");
    let documents = data_dir.join("attachments");
    let result = backup::create(
        &db_path,
        &master,
        &destination.to_string_lossy(),
        &documents,
    );
    match result {
        Ok(path) => {
            let size = std::fs::metadata(&path)
                .ok()
                .map(|metadata| metadata.len() as i64);
            backup_repository::finish(&connection, &history_id, true, size, None, &db::now())?;
            Ok(path)
        }
        Err(error) => {
            backup_repository::finish(
                &connection,
                &history_id,
                false,
                None,
                Some(error.code()),
                &db::now(),
            )?;
            Err(error)
        }
    }
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
    let documents = db::app_dir(app)?.join("attachments");
    backup::restore(&active_db, &master, &path.to_string_lossy(), &documents)
}
