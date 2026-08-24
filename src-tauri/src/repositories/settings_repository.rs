use crate::{
    db,
    dto::{LawyerProfileDto, SettingsDto, SettingsUpdateInput},
    errors::Error,
};
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
    db.query_row("SELECT language, theme, date_format, week_starts_on, default_reminder_minutes, autostart_enabled, lock_timeout_minutes, managed_documents_directory, backup_directory FROM app_settings WHERE id = 1", [], |row| Ok(SettingsDto {
        language: row.get(0)?, theme: row.get(1)?, date_format: row.get(2)?, week_starts_on: row.get(3)?, default_reminder_minutes: row.get(4)?, autostart_enabled: row.get(5)?, lock_timeout_minutes: row.get(6)?, managed_documents_directory: row.get(7)?, backup_directory: row.get(8)?,
    })).map_err(Error::from)
}

pub fn update_autostart(db: &Connection, enabled: bool) -> Result<(), Error> {
    db.execute(
        "UPDATE app_settings SET autostart_enabled=?1,updated_at=?2 WHERE id=1",
        rusqlite::params![enabled, db::now()],
    )?;
    Ok(())
}

pub fn update_settings(db: &Connection, input: &SettingsUpdateInput) -> Result<(), Error> {
    db.execute(
        "UPDATE app_settings SET language = ?1, theme = ?2, date_format = ?3, week_starts_on = ?4, default_reminder_minutes = ?5, lock_timeout_minutes = ?6, updated_at = ?7 WHERE id = 1",
        rusqlite::params![input.language, input.theme, input.date_format, input.week_starts_on, input.default_reminder_minutes, input.lock_timeout_minutes, db::now()],
    )?;
    Ok(())
}

pub fn update_backup_directory(db: &Connection, directory: &str) -> Result<(), Error> {
    db.execute(
        "UPDATE app_settings SET backup_directory = ?1, updated_at = ?2 WHERE id = 1",
        rusqlite::params![directory, db::now()],
    )?;
    Ok(())
}

pub fn get_profile(db: &Connection) -> Result<LawyerProfileDto, Error> {
    db.query_row("SELECT full_name,bar_number,phone,email,office_address,default_currency FROM lawyer_profile WHERE id=1", [], |row| Ok(LawyerProfileDto { full_name: row.get(0)?, bar_number: row.get(1)?, phone: row.get(2)?, email: row.get(3)?, office_address: row.get(4)?, default_currency: row.get(5)? })).map_err(Error::from)
}

pub fn update_profile(
    db: &Connection,
    profile: &LawyerProfileDto,
) -> Result<LawyerProfileDto, Error> {
    db.execute("UPDATE lawyer_profile SET full_name=?1,bar_number=?2,phone=?3,email=?4,office_address=?5,updated_at=?6 WHERE id=1", rusqlite::params![profile.full_name,profile.bar_number,profile.phone,profile.email,profile.office_address,db::now()])?;
    get_profile(db)
}
