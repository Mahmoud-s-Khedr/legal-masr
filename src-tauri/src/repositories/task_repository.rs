use crate::{dto::TaskDto, errors::Error};
use rusqlite::{params, Connection};

const SELECT: &str = "SELECT id, client_id, case_id, title, details, notes, due_date, reminder_minutes, completed, completed_at, created_at, updated_at FROM tasks";

fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskDto> {
    Ok(TaskDto {
        id: row.get(0)?,
        client_id: row.get(1)?,
        case_id: row.get(2)?,
        title: row.get(3)?,
        details: row.get(4)?,
        notes: row.get(5)?,
        due_date: row.get(6)?,
        reminder_minutes: row.get(7)?,
        completed: row.get::<_, i64>(8)? != 0,
        completed_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn get(conn: &Connection, id: &str) -> Result<TaskDto, Error> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row)
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Error::TaskNotFound,
            other => Error::from(other),
        })
}

pub fn insert(conn: &Connection, task: &TaskDto) -> Result<(), Error> {
    conn.execute("INSERT INTO tasks (id, client_id, case_id, title, details, notes, due_date, reminder_minutes, completed, completed_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)", params![task.id, task.client_id, task.case_id, task.title, task.details, task.notes, task.due_date, task.reminder_minutes, task.completed, task.completed_at, task.created_at])?;
    Ok(())
}

pub fn update(conn: &Connection, task: &TaskDto) -> Result<(), Error> {
    if conn.execute("UPDATE tasks SET client_id = ?2, case_id = ?3, title = ?4, details = ?5, notes = ?6, due_date = ?7, reminder_minutes = ?8, updated_at = ?9 WHERE id = ?1", params![task.id, task.client_id, task.case_id, task.title, task.details, task.notes, task.due_date, task.reminder_minutes, task.updated_at])? == 0 {
        return Err(Error::TaskNotFound);
    }
    Ok(())
}

pub fn set_completed(conn: &Connection, id: &str, completed: bool, now: &str) -> Result<(), Error> {
    if conn.execute("UPDATE tasks SET completed = ?2, completed_at = CASE WHEN ?2 THEN ?3 ELSE NULL END, updated_at = ?3 WHERE id = ?1", params![id, completed, now])? == 0 {
        return Err(Error::TaskNotFound);
    }
    Ok(())
}

pub fn list(
    conn: &Connection,
    view: Option<&str>,
    reference_date: &str,
    case_id: Option<&str>,
    client_id: Option<&str>,
) -> Result<Vec<TaskDto>, Error> {
    let condition = match view {
        Some("TODAY") => "completed = 0 AND due_date = ?1",
        Some("OVERDUE") => "completed = 0 AND due_date < ?1",
        Some("UPCOMING") => "completed = 0 AND due_date > ?1",
        Some("COMPLETED") => "completed = 1",
        None | Some("ALL") => "1 = 1",
        Some(_) => return Err(Error::Validation),
    };
    let mut statement = conn.prepare(&format!("{SELECT} WHERE {condition} AND (?2 IS NULL OR case_id = ?2) AND (?3 IS NULL OR client_id = ?3) ORDER BY due_date, title"))?;
    let rows = statement
        .query_map(params![reference_date, case_id, client_id], row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), Error> {
    if conn.execute("DELETE FROM tasks WHERE id = ?1", [id])? == 0 {
        return Err(Error::TaskNotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use uuid::Uuid;

    fn task(id: String, due_date: &str, completed: bool) -> TaskDto {
        TaskDto {
            id,
            client_id: None,
            case_id: None,
            title: "مهمة".into(),
            details: None,
            notes: None,
            due_date: due_date.into(),
            reminder_minutes: None,
            completed,
            completed_at: completed.then_some("done".into()),
            created_at: "now".into(),
            updated_at: "now".into(),
        }
    }

    #[test]
    fn derives_task_buckets_from_due_date_and_completion() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        for (due, complete) in [
            ("2026-08-23", false),
            ("2026-08-24", false),
            ("2026-08-25", false),
            ("2026-08-01", true),
        ] {
            insert(&conn, &task(Uuid::new_v4().to_string(), due, complete)).unwrap();
        }
        assert_eq!(
            list(&conn, Some("OVERDUE"), "2026-08-24", None, None)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            list(&conn, Some("TODAY"), "2026-08-24", None, None)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            list(&conn, Some("UPCOMING"), "2026-08-24", None, None)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            list(&conn, Some("COMPLETED"), "2026-08-24", None, None)
                .unwrap()
                .len(),
            1
        );
    }
}
