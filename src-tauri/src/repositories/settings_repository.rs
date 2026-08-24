use crate::{
    db,
    dto::{LawyerProfileDto, SettingsDto, SettingsUpdateInput},
    errors::Error,
};
use rusqlite::Connection;
pub fn insert_initial_profile_and_settings(
    conn: &Connection,
    full_name: &str,
    language: &str,
    lock_timeout_minutes: u32,
) -> Result<(), Error> {
    let now = db::now();
    conn.execute(
        "INSERT INTO lawyer_profile (id, full_name, created_at, updated_at) VALUES (1, ?1, ?2, ?2)",
        [full_name, &now],
    )?;
    conn.execute(
        "INSERT INTO app_settings (id, language, lock_timeout_minutes, created_at, updated_at) VALUES (1, ?1, ?2, ?3, ?3) ON CONFLICT(id) DO UPDATE SET language = excluded.language, lock_timeout_minutes = excluded.lock_timeout_minutes, updated_at = excluded.updated_at",
        rusqlite::params![language, lock_timeout_minutes, now],
    )?;
    Ok(())
}
pub fn get_settings(conn: &Connection) -> Result<SettingsDto, Error> {
    conn.query_row("SELECT language, theme, date_format, week_starts_on, default_reminder_minutes, autostart_enabled, usage_counters_enabled, lock_timeout_minutes FROM app_settings WHERE id = 1", [], |row| Ok(SettingsDto { language: row.get(0)?, theme: row.get(1)?, date_format: row.get(2)?, week_starts_on: row.get(3)?, default_reminder_minutes: row.get(4)?, autostart_enabled: row.get(5)?, usage_counters_enabled: row.get(6)?, lock_timeout_minutes: row.get(7)? })).map_err(Error::from)
}
pub fn update_autostart(conn: &Connection, enabled: bool) -> Result<(), Error> {
    conn.execute(
        "UPDATE app_settings SET autostart_enabled = ?1, updated_at = ?2 WHERE id = 1",
        rusqlite::params![enabled, db::now()],
    )?;
    Ok(())
}
pub fn update_usage_counters(conn: &Connection, enabled: bool) -> Result<(), Error> {
    conn.execute(
        "UPDATE app_settings SET usage_counters_enabled = ?1, updated_at = ?2 WHERE id = 1",
        rusqlite::params![enabled, db::now()],
    )?;
    Ok(())
}
pub fn update_settings(conn: &Connection, input: &SettingsUpdateInput) -> Result<(), Error> {
    conn.execute("UPDATE app_settings SET language = ?1, theme = ?2, date_format = ?3, week_starts_on = ?4, default_reminder_minutes = ?5, lock_timeout_minutes = ?6, updated_at = ?7 WHERE id = 1", rusqlite::params![input.language, input.theme, input.date_format, input.week_starts_on, input.default_reminder_minutes, input.lock_timeout_minutes, db::now()])?;
    Ok(())
}
pub fn get_profile(conn: &Connection) -> Result<LawyerProfileDto, Error> {
    conn.query_row(
        "SELECT full_name, bar_number, phone, office_address FROM lawyer_profile WHERE id = 1",
        [],
        |row| {
            Ok(LawyerProfileDto {
                full_name: row.get(0)?,
                bar_number: row.get(1)?,
                phone: row.get(2)?,
                office_address: row.get(3)?,
                default_currency: "EGP".into(),
            })
        },
    )
    .map_err(Error::from)
}
pub fn update_profile(
    conn: &Connection,
    profile: &LawyerProfileDto,
) -> Result<LawyerProfileDto, Error> {
    conn.execute("UPDATE lawyer_profile SET full_name = ?1, bar_number = ?2, phone = ?3, office_address = ?4, updated_at = ?5 WHERE id = 1", rusqlite::params![profile.full_name, profile.bar_number, profile.phone, profile.office_address, db::now()])?;
    get_profile(conn)
}
