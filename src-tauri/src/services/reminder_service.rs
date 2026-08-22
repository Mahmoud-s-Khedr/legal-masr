use crate::{db, errors::Error, repositories::reminder_repository, state::AppState};
use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

fn minutes(value: &str) -> Option<i32> {
    let (hours, minutes) = value.split_once(':')?;
    let hours: i32 = hours.parse().ok()?;
    let minutes: i32 = minutes.parse().ok()?;
    (hours < 24 && minutes < 60).then_some(hours * 60 + minutes)
}

pub fn is_due(now: &str, scheduled: Option<&str>, reminder_minutes: u32) -> bool {
    let Some(scheduled) = scheduled else {
        return true;
    };
    match (minutes(now), minutes(scheduled)) {
        (Some(now), Some(scheduled)) => now >= scheduled - reminder_minutes as i32,
        _ => false,
    }
}

pub fn refresh<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    today: &str,
    now_time: &str,
) -> Result<u32, Error> {
    if today.len() != 10 || minutes(now_time).is_none() {
        return Err(Error::Validation);
    }
    let master = state.unlocked()?;
    let (_, database_path) = db::paths(app)?;
    let connection = db::open_db(&database_path, &master)?;
    let reminder_minutes = reminder_repository::default_minutes(&connection)?;
    let mut delivered = 0;
    for candidate in reminder_repository::candidates(&connection, today)? {
        if !is_due(
            now_time,
            candidate.scheduled_time.as_deref(),
            reminder_minutes,
        ) || reminder_repository::already_delivered(
            &connection,
            &candidate.entity_type,
            &candidate.entity_id,
            today,
        )? {
            continue;
        }
        let body = if candidate.entity_type == "EVENT" {
            candidate
                .scheduled_time
                .as_deref()
                .map(|time| format!("موعد قانوني اليوم الساعة {time}"))
                .unwrap_or_else(|| "لديك موعد قانوني اليوم".into())
        } else {
            "لديك مهمة مستحقة اليوم".into()
        };
        app.notification()
            .builder()
            .title("ليجال مصر")
            .body(body)
            .show()
            .map_err(|_| Error::Operation)?;
        reminder_repository::mark_delivered(
            &connection,
            &candidate.entity_type,
            &candidate.entity_id,
            today,
            &db::now(),
        )?;
        delivered += 1;
    }
    Ok(delivered)
}

#[cfg(test)]
mod tests {
    use super::is_due;

    #[test]
    fn reminder_becomes_due_at_the_configured_offset() {
        assert!(!is_due("08:29", Some("09:30"), 60));
        assert!(is_due("08:30", Some("09:30"), 60));
        assert!(is_due("10:00", None, 60));
    }

    #[test]
    fn malformed_times_never_trigger_a_notification() {
        assert!(!is_due("bad", Some("09:30"), 60));
        assert!(!is_due("08:30", Some("25:10"), 60));
    }
}
