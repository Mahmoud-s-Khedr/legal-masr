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

// The renderer selects a contact kind; it cannot supply a URL or executable.
fn dispatch_developer_contact(
    state: &AppState,
    contact: &str,
    opener: impl FnOnce(&str) -> Result<(), Error>,
) -> Result<(), Error> {
    state.unlocked()?;
    let url = match contact {
        "email" => "mailto:Mahmoud.s.khedr.2@gmail.com",
        "phone" => "tel:+201016240934",
        "whatsapp" => "https://wa.me/201016240934",
        "telegram" => "https://t.me/+201016240934",
        "linkedin" => "https://www.linkedin.com/in/mahmoud-s-khedr/",
        _ => return Err(Error::Validation),
    };
    opener(url)
}

pub fn open_developer_contact<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    contact: &str,
) -> Result<(), Error> {
    use tauri_plugin_opener::OpenerExt;
    dispatch_developer_contact(state, contact, |url| {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|_| Error::Operation)
    })
}

#[cfg(test)]
mod contact_tests {
    use super::*;

    fn unlocked_state() -> AppState {
        let state = AppState::default();
        *state.master_key.lock().unwrap() = Some(zeroize::Zeroizing::new([7; 32]));
        state
    }

    #[test]
    fn opens_only_fixed_developer_destinations() {
        for (contact, expected) in [
            ("email", "mailto:Mahmoud.s.khedr.2@gmail.com"),
            ("phone", "tel:+201016240934"),
            ("whatsapp", "https://wa.me/201016240934"),
            ("telegram", "https://t.me/+201016240934"),
            ("linkedin", "https://www.linkedin.com/in/mahmoud-s-khedr/"),
        ] {
            dispatch_developer_contact(&unlocked_state(), contact, |url| {
                assert_eq!(url, expected);
                Ok(())
            })
            .unwrap();
        }
    }

    #[test]
    fn rejects_arbitrary_destinations_without_opening_them() {
        for contact in [
            "",
            "https://example.com",
            "file:///tmp/file",
            "email?body=private",
            "EMAIL",
        ] {
            assert!(matches!(
                dispatch_developer_contact(&unlocked_state(), contact, |_| panic!("must not open")),
                Err(Error::Validation)
            ));
        }
    }

    #[test]
    fn rejects_contacts_while_locked() {
        assert!(matches!(
            dispatch_developer_contact(&AppState::default(), "email", |_| panic!("must not open")),
            Err(Error::Locked)
        ));
    }

    #[test]
    fn propagates_opener_failure() {
        assert!(matches!(
            dispatch_developer_contact(&unlocked_state(), "email", |_| Err(Error::Operation)),
            Err(Error::Operation)
        ));
    }
}
