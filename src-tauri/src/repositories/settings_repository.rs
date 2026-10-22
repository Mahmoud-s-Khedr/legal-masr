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
    conn.query_row("SELECT language, theme, date_format, week_starts_on, usage_counters_enabled, lock_timeout_minutes, keep_running_in_tray FROM app_settings WHERE id = 1", [], |row| Ok(SettingsDto { language: row.get(0)?, theme: row.get(1)?, date_format: row.get(2)?, week_starts_on: row.get(3)?, usage_counters_enabled: row.get(4)?, lock_timeout_minutes: row.get(5)?, keep_running_in_tray: row.get(6)? })).map_err(Error::from)
}
pub fn update_usage_counters(conn: &Connection, enabled: bool) -> Result<(), Error> {
    conn.execute(
        "UPDATE app_settings SET usage_counters_enabled = ?1, updated_at = ?2 WHERE id = 1",
        rusqlite::params![enabled, db::now()],
    )?;
    Ok(())
}
pub fn update_settings(conn: &Connection, input: &SettingsUpdateInput) -> Result<(), Error> {
    conn.execute("UPDATE app_settings SET language = ?1, theme = ?2, date_format = ?3, week_starts_on = ?4, lock_timeout_minutes = ?5, keep_running_in_tray = ?6, updated_at = ?7 WHERE id = 1", rusqlite::params![input.language, input.theme, input.date_format, input.week_starts_on, input.lock_timeout_minutes, input.keep_running_in_tray, db::now()])?;
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

#[cfg(test)]
mod tray_tests {
    use super::*;

    #[test]
    fn tray_preference_defaults_off_persists_both_values_and_rejects_non_booleans() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let settings = get_settings(&conn).unwrap();
        assert!(!settings.keep_running_in_tray);
        for enabled in [true, false] {
            update_settings(
                &conn,
                &SettingsUpdateInput {
                    language: settings.language.clone(),
                    theme: settings.theme.clone(),
                    date_format: settings.date_format.clone(),
                    week_starts_on: settings.week_starts_on,
                    lock_timeout_minutes: settings.lock_timeout_minutes,
                    keep_running_in_tray: enabled,
                },
            )
            .unwrap();
            assert_eq!(get_settings(&conn).unwrap().keep_running_in_tray, enabled);
        }
        assert!(conn
            .execute(
                "UPDATE app_settings SET keep_running_in_tray = 2 WHERE id = 1",
                []
            )
            .is_err());
        assert!(!get_settings(&conn).unwrap().keep_running_in_tray);
    }
}
