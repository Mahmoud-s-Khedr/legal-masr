use crate::errors::Error;
use rusqlite::{params, Connection};

pub struct ReminderCandidate {
    pub entity_type: String,
    pub entity_id: String,
    pub scheduled_time: Option<String>,
}

pub fn candidates(conn: &Connection, today: &str) -> Result<Vec<ReminderCandidate>, Error> {
    let mut statement = conn.prepare(
        "SELECT 'EVENT',id,start_time FROM case_events WHERE event_date=?1 AND status='SCHEDULED'
         UNION ALL
         SELECT 'TASK',id,due_time FROM tasks WHERE due_date=?1 AND status='OPEN'",
    )?;
    let candidates = statement
        .query_map([today], |row| {
            Ok(ReminderCandidate {
                entity_type: row.get(0)?,
                entity_id: row.get(1)?,
                scheduled_time: row.get(2)?,
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
                "INSERT INTO tasks (id,title,due_date,due_time,priority,status,created_at,updated_at)
                 VALUES ('open','طلب مستند','2026-08-22','09:30','NORMAL','OPEN','now','now'),
                        ('done','مهمة منتهية','2026-08-22','08:00','NORMAL','COMPLETED','now','now')",
                [],
            )
            .unwrap();

        let result = candidates(&connection, "2026-08-22").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].entity_id, "open");
        assert_eq!(result[0].scheduled_time.as_deref(), Some("09:30"));
    }

    #[test]
    fn delivery_marker_deduplicates_the_same_item_and_day() {
        let connection = prepared_database();
        assert!(!already_delivered(&connection, "TASK", "task-1", "2026-08-22").unwrap());
        mark_delivered(&connection, "TASK", "task-1", "2026-08-22", "now").unwrap();
        mark_delivered(&connection, "TASK", "task-1", "2026-08-22", "later").unwrap();
        assert!(already_delivered(&connection, "TASK", "task-1", "2026-08-22").unwrap());
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM reminder_deliveries", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }
}
