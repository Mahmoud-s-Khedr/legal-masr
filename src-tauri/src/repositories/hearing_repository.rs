use crate::{dto::HearingDto, errors::Error};
use rusqlite::{params, Connection};

const SELECT: &str = "SELECT id, case_id, previous_hearing_id, hearing_date, hearing_time, hearing_type, location, circuit_name, required_documents, notes, decision_text, status, completed_at, reminder_minutes, created_at, updated_at FROM hearings";
fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<HearingDto> {
    Ok(HearingDto {
        id: row.get(0)?,
        case_id: row.get(1)?,
        previous_hearing_id: row.get(2)?,
        hearing_date: row.get(3)?,
        hearing_time: row.get(4)?,
        hearing_type: row.get(5)?,
        location: row.get(6)?,
        circuit_name: row.get(7)?,
        required_documents: row.get(8)?,
        notes: row.get(9)?,
        decision_text: row.get(10)?,
        status: row.get(11)?,
        completed_at: row.get(12)?,
        reminder_minutes: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}
pub fn get(conn: &Connection, id: &str) -> Result<HearingDto, Error> {
    conn.query_row(&format!("{SELECT} WHERE id=?1"), [id], row)
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Error::HearingNotFound,
            other => Error::from(other),
        })
}
pub fn list(
    conn: &Connection,
    case_id: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<HearingDto>, Error> {
    let mut statement = conn.prepare(&format!("{SELECT} WHERE (?1 IS NULL OR case_id=?1) AND (?2 IS NULL OR hearing_date>=?2) AND (?3 IS NULL OR hearing_date<=?3) AND (?4 IS NULL OR status=?4) ORDER BY hearing_date, hearing_time"))?;
    let result = statement
        .query_map(params![case_id, from, to, status], row)?
        .collect::<Result<_, _>>()?;
    Ok(result)
}
pub fn insert(conn: &Connection, hearing: &HearingDto) -> Result<(), Error> {
    conn.execute("INSERT INTO hearings (id, case_id, previous_hearing_id, hearing_date, hearing_time, hearing_type, location, circuit_name, required_documents, notes, status, reminder_minutes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'SCHEDULED', ?11, ?12, ?12)", params![hearing.id, hearing.case_id, hearing.previous_hearing_id, hearing.hearing_date, hearing.hearing_time, hearing.hearing_type, hearing.location, hearing.circuit_name, hearing.required_documents, hearing.notes, hearing.reminder_minutes, hearing.created_at])?;
    Ok(())
}
pub fn update(conn: &Connection, hearing: &HearingDto) -> Result<(), Error> {
    if conn.execute("UPDATE hearings SET hearing_date=?2, hearing_time=?3, hearing_type=?4, location=?5, circuit_name=?6, required_documents=?7, notes=?8, reminder_minutes=?9, updated_at=?10 WHERE id=?1", params![hearing.id, hearing.hearing_date, hearing.hearing_time, hearing.hearing_type, hearing.location, hearing.circuit_name, hearing.required_documents, hearing.notes, hearing.reminder_minutes, hearing.updated_at])? == 0 { return Err(Error::HearingNotFound); };
    Ok(())
}
pub fn complete(
    conn: &Connection,
    id: &str,
    decision: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    if conn.execute("UPDATE hearings SET decision_text=?2, status='COMPLETED', completed_at=?3, updated_at=?3 WHERE id=?1 AND status='SCHEDULED'", params![id, decision, now])? == 0 { return Err(Error::HearingNotFound); };
    Ok(())
}
pub fn delete(conn: &Connection, id: &str) -> Result<(), Error> {
    if conn.execute("DELETE FROM hearings WHERE id=?1", [id])? == 0 {
        return Err(Error::HearingNotFound);
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use uuid::Uuid;
    fn hearing(case_id: String) -> HearingDto {
        HearingDto {
            id: Uuid::new_v4().to_string(),
            case_id,
            previous_hearing_id: None,
            hearing_date: "2026-08-24".into(),
            hearing_time: Some("10:30".into()),
            hearing_type: None,
            location: None,
            circuit_name: None,
            required_documents: None,
            notes: None,
            decision_text: None,
            status: "SCHEDULED".into(),
            completed_at: None,
            reminder_minutes: Some(30),
            created_at: "now".into(),
            updated_at: "now".into(),
        }
    }
    #[test]
    fn completes_a_hearing_and_rejects_missing_records() {
        let connection = Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        let case_id = Uuid::new_v4().to_string();
        connection.execute("INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, 'CA-1', 'ACTIVE', 'now', 'now')", [&case_id]).unwrap();
        let item = hearing(case_id);
        insert(&connection, &item).unwrap();
        complete(&connection, &item.id, Some("تأجيل"), "later").unwrap();
        let completed = get(&connection, &item.id).unwrap();
        assert_eq!(completed.status, "COMPLETED");
        assert_eq!(completed.decision_text.as_deref(), Some("تأجيل"));
        assert!(matches!(
            delete(&connection, &Uuid::new_v4().to_string()),
            Err(Error::HearingNotFound)
        ));
    }
}
