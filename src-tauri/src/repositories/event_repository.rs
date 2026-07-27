use crate::{dto::EventDto, errors::Error};
use rusqlite::{params, Connection};

fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<EventDto> {
    Ok(EventDto {
        id: row.get(0)?,
        case_id: row.get(1)?,
        client_id: row.get(2)?,
        event_type: row.get(3)?,
        title: row.get(4)?,
        event_date: row.get(5)?,
        start_time: row.get(6)?,
        end_time: row.get(7)?,
        is_all_day: row.get::<_, i64>(8)? != 0,
        location: row.get(9)?,
        circuit_name: row.get(10)?,
        preparation_notes: row.get(11)?,
        required_documents: row.get(12)?,
        outcome: row.get(13)?,
        decision_text: row.get(14)?,
        next_action: row.get(15)?,
        status: row.get(16)?,
        completed_at: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
    })
}
const SELECT: &str = "SELECT id,case_id,client_id,event_type,title,event_date,start_time,end_time,is_all_day,location,circuit_name,preparation_notes,required_documents,outcome,decision_text,next_action,status,completed_at,created_at,updated_at FROM case_events";
pub fn get(db: &Connection, id: &str) -> Result<EventDto, Error> {
    db.query_row(&format!("{SELECT} WHERE id=?1"), [id], row)
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Error::EventNotFound,
            other => Error::from(other),
        })
}
pub fn list(
    db: &Connection,
    from: Option<&str>,
    to: Option<&str>,
    case_id: Option<&str>,
    client_id: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<EventDto>, Error> {
    let mut stmt=db.prepare(&format!("{SELECT} WHERE (?1 IS NULL OR event_date>=?1) AND (?2 IS NULL OR event_date<=?2) AND (?3 IS NULL OR case_id=?3) AND (?4 IS NULL OR client_id=?4) AND (?5 IS NULL OR status=?5) ORDER BY event_date,start_time,title"))?;
    let result = stmt
        .query_map(params![from, to, case_id, client_id, status], row)?
        .collect::<Result<_, _>>()?;
    Ok(result)
}
pub fn insert(db: &Connection, e: &EventDto) -> Result<(), Error> {
    db.execute("INSERT INTO case_events (id,case_id,client_id,event_type,title,event_date,start_time,end_time,is_all_day,location,circuit_name,preparation_notes,required_documents,outcome,decision_text,next_action,status,completed_at,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,NULL,NULL,NULL,'SCHEDULED',NULL,?14,?14)",params![e.id,e.case_id,e.client_id,e.event_type,e.title,e.event_date,e.start_time,e.end_time,e.is_all_day as i64,e.location,e.circuit_name,e.preparation_notes,e.required_documents,e.created_at])?;
    Ok(())
}
pub fn update(db: &Connection, e: &EventDto) -> Result<(), Error> {
    if db.execute("UPDATE case_events SET case_id=?2,client_id=?3,event_type=?4,title=?5,event_date=?6,start_time=?7,end_time=?8,is_all_day=?9,location=?10,circuit_name=?11,preparation_notes=?12,required_documents=?13,updated_at=?14 WHERE id=?1",params![e.id,e.case_id,e.client_id,e.event_type,e.title,e.event_date,e.start_time,e.end_time,e.is_all_day as i64,e.location,e.circuit_name,e.preparation_notes,e.required_documents,e.updated_at])?==0{return Err(Error::EventNotFound)};
    Ok(())
}
pub fn complete(
    db: &Connection,
    id: &str,
    outcome: Option<&str>,
    decision: Option<&str>,
    next: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    if db.execute("UPDATE case_events SET outcome=?2,decision_text=?3,next_action=?4,status='COMPLETED',completed_at=?5,updated_at=?5 WHERE id=?1",params![id,outcome,decision,next,now])?==0{return Err(Error::EventNotFound)};
    Ok(())
}
pub fn delete(db: &Connection, id: &str) -> Result<(), Error> {
    if db.execute("DELETE FROM case_events WHERE id=?1", [id])? == 0 {
        return Err(Error::EventNotFound);
    };
    Ok(())
}
