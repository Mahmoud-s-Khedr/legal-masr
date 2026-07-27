use crate::{db, dto::SettingsDto, errors::Error};
use rusqlite::Connection;

pub fn insert_initial_profile_and_settings(
    db: &Connection,
    full_name: &str,
    language: &str,
    managed_documents_directory: &str,
    backup_directory: &str,
    lock_timeout_minutes: u32,
) -> Result<(), Error> {
    let now = db::now();
    db.execute("INSERT INTO spike_records (id, value, created_at) VALUES (lower(hex(randomblob(16))), 'initialization-probe', ?1)", [&now])?;
    db.execute(
        "INSERT INTO lawyer_profile (id, full_name, default_currency, created_at, updated_at) VALUES (1, ?1, 'EGP', ?2, ?2)",
        [full_name, &now],
    )?;
    db.execute(
        "INSERT INTO app_settings (id, language, lock_timeout_minutes, managed_documents_directory, backup_directory, created_at, updated_at) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?5)",
        rusqlite::params![language, lock_timeout_minutes, managed_documents_directory, backup_directory, now],
    )?;
    Ok(())
}

pub fn get_settings(db: &Connection) -> Result<SettingsDto, Error> {
    db.query_row("SELECT language, theme, lock_timeout_minutes, managed_documents_directory, backup_directory FROM app_settings WHERE id = 1", [], |row| Ok(SettingsDto {
        language: row.get(0)?, theme: row.get(1)?, lock_timeout_minutes: row.get(2)?, managed_documents_directory: row.get(3)?, backup_directory: row.get(4)?,
    })).map_err(Error::from)
}

pub fn update_settings(
    db: &Connection,
    language: &str,
    theme: &str,
    lock_timeout_minutes: u32,
    backup_directory: &str,
) -> Result<(), Error> {
    db.execute(
        "UPDATE app_settings SET language = ?1, theme = ?2, lock_timeout_minutes = ?3, backup_directory = ?4, updated_at = ?5 WHERE id = 1",
        rusqlite::params![language, theme, lock_timeout_minutes, backup_directory, db::now()],
    )?;
    Ok(())
}
