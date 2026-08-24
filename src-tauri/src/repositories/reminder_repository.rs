use crate::errors::Error;
use rusqlite::{params, Connection};

pub struct ReminderCandidate {
    pub entity_type: String,
    pub entity_id: String,
    pub scheduled_time: Option<String>,
    pub reminder_minutes: Option<u32>,
}

pub fn candidates(conn: &Connection, today: &str) -> Result<Vec<ReminderCandidate>, Error> {
    let mut statement = conn.prepare(
        "SELECT 'HEARING',id,hearing_time,reminder_minutes FROM hearings WHERE hearing_date=?1 AND status='SCHEDULED'
         UNION ALL
         SELECT 'TASK',id,NULL,reminder_minutes FROM tasks WHERE due_date=?1 AND completed=0",
    )?;
    let candidates = statement
        .query_map([today], |row| {
            Ok(ReminderCandidate {
                entity_type: row.get(0)?,
                entity_id: row.get(1)?,
                scheduled_time: row.get(2)?,
                reminder_minutes: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(Error::from)?;
    Ok(candidates)
}

pub fn already_delivered(
    conn: &Connection,
    entity_type: &str,
    entity_id: &str,
    date: &str,
) -> Result<bool, Error> {
    Ok(conn
        .query_row(
            "SELECT 1 FROM reminder_deliveries WHERE entity_type=?1 AND entity_id=?2 AND reminder_date=?3",
            params![entity_type, entity_id, date],
            |_| Ok(()),
        )
        .is_ok())
}

pub fn mark_delivered(
    conn: &Connection,
    entity_type: &str,
    entity_id: &str,
    date: &str,
    delivered_at: &str,
) -> Result<(), Error> {
    conn.execute(
        "INSERT OR IGNORE INTO reminder_deliveries(entity_type,entity_id,reminder_date,delivered_at) VALUES(?1,?2,?3,?4)",
        params![entity_type, entity_id, date, delivered_at],
    )?;
    Ok(())
}

pub fn default_minutes(conn: &Connection) -> Result<u32, Error> {
    conn.query_row(
        "SELECT default_reminder_minutes FROM app_settings WHERE id=1",
        [],
        |row| row.get(0),
    )
    .map_err(Error::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn prepared_database() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO app_settings (id,language,created_at,updated_at) VALUES (1,'ar','now','now')",
                [],
            )
            .unwrap();
        connection
    }

    #[test]
    fn returns_only_open_items_due_on_the_requested_date() {
        let connection = prepared_database();
        connection
            .execute(
                "INSERT INTO tasks (id,title,due_date,reminder_minutes,completed,completed_at,created_at,updated_at)
                 VALUES (?1,'طلب مستند','2026-08-22',60,0,NULL,'now','now'),
                        (?2,'مهمة منتهية','2026-08-22',60,1,'completed','now','now')",
                rusqlite::params![uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string()],
            )
            .unwrap();

        let result = candidates(&connection, "2026-08-22").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].entity_type, "TASK");
        assert_eq!(result[0].scheduled_time, None);
        assert_eq!(result[0].reminder_minutes, Some(60));
    }

    #[test]
    fn delivery_marker_deduplicates_the_same_item_and_day() {
        let connection = prepared_database();
        let task_id = uuid::Uuid::new_v4().to_string();
        assert!(!already_delivered(&connection, "TASK", &task_id, "2026-08-22").unwrap());
        mark_delivered(&connection, "TASK", &task_id, "2026-08-22", "now").unwrap();
        mark_delivered(&connection, "TASK", &task_id, "2026-08-22", "later").unwrap();
        assert!(already_delivered(&connection, "TASK", &task_id, "2026-08-22").unwrap());
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM reminder_deliveries", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }
}
