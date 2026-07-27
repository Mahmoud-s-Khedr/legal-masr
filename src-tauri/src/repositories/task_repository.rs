use crate::{dto::TaskDto, errors::Error};
use rusqlite::{params, Connection};
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<TaskDto> {
    Ok(TaskDto {
        id: r.get(0)?,
        client_id: r.get(1)?,
        case_id: r.get(2)?,
        source_event_id: r.get(3)?,
        title: r.get(4)?,
        description: r.get(5)?,
        due_date: r.get(6)?,
        due_time: r.get(7)?,
        priority: r.get(8)?,
        status: r.get(9)?,
        completed_at: r.get(10)?,
        created_at: r.get(11)?,
        updated_at: r.get(12)?,
    })
}
const SELECT:&str="SELECT id,client_id,case_id,source_event_id,title,description,due_date,due_time,priority,status,completed_at,created_at,updated_at FROM tasks";
pub fn get(db: &Connection, id: &str) -> Result<TaskDto, Error> {
    db.query_row(&format!("{SELECT} WHERE id=?1"), [id], row)
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Error::TaskNotFound,
            other => Error::from(other),
        })
}
pub fn list(
    db: &Connection,
    from: Option<&str>,
    to: Option<&str>,
    case_id: Option<&str>,
    client_id: Option<&str>,
    priority: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<TaskDto>, Error> {
    let mut s=db.prepare(&format!("{SELECT} WHERE (?1 IS NULL OR due_date>=?1) AND (?2 IS NULL OR due_date<=?2) AND (?3 IS NULL OR case_id=?3) AND (?4 IS NULL OR client_id=?4) AND (?5 IS NULL OR priority=?5) AND (?6 IS NULL OR status=?6) ORDER BY due_date,due_time,title"))?;
    let result = s
        .query_map(params![from, to, case_id, client_id, priority, status], row)?
        .collect::<Result<_, _>>()?;
    Ok(result)
}
pub fn save(db: &Connection, t: &TaskDto, is_new: bool) -> Result<(), Error> {
    if is_new{db.execute("INSERT INTO tasks(id,client_id,case_id,source_event_id,title,description,due_date,due_time,priority,status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,'OPEN',?10,?10)",params![t.id,t.client_id,t.case_id,t.source_event_id,t.title,t.description,t.due_date,t.due_time,t.priority,t.created_at])?;}else if db.execute("UPDATE tasks SET client_id=?2,case_id=?3,title=?4,description=?5,due_date=?6,due_time=?7,priority=?8,updated_at=?9 WHERE id=?1",params![t.id,t.client_id,t.case_id,t.title,t.description,t.due_date,t.due_time,t.priority,t.updated_at])?==0{return Err(Error::TaskNotFound)};
    Ok(())
}
pub fn set_status(db: &Connection, id: &str, status: &str, now: &str) -> Result<(), Error> {
    if db.execute("UPDATE tasks SET status=?2,completed_at=CASE WHEN ?2='COMPLETED' THEN ?3 ELSE NULL END,updated_at=?3 WHERE id=?1",params![id,status,now])?==0{return Err(Error::TaskNotFound)};
    Ok(())
}
pub fn delete(db: &Connection, id: &str) -> Result<(), Error> {
    if db.execute("DELETE FROM tasks WHERE id=?1", [id])? == 0 {
        return Err(Error::TaskNotFound);
    };
    Ok(())
}
