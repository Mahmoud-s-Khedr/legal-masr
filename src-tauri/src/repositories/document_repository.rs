use crate::{dto::DocumentDto, errors::Error};
use rusqlite::{params, Connection};
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentDto> {
    Ok(DocumentDto {
        id: r.get(0)?,
        client_id: r.get(1)?,
        case_id: r.get(2)?,
        storage_mode: r.get(3)?,
        original_filename: r.get(4)?,
        category: r.get(5)?,
        description: r.get(6)?,
        document_date: r.get(7)?,
        mime_type: r.get(8)?,
        file_size_bytes: r.get(9)?,
        missing_at: r.get(10)?,
        created_at: r.get(11)?,
    })
}
pub fn insert(
    db: &Connection,
    d: &DocumentDto,
    stored: Option<&str>,
    relative: Option<&str>,
    external: Option<&str>,
    sha: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    db.execute("INSERT INTO documents(id,client_id,case_id,storage_mode,original_filename,stored_filename,relative_path,external_path,mime_type,file_size_bytes,sha256,category,description,document_date,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",params![d.id,d.client_id,d.case_id,d.storage_mode,d.original_filename,stored,relative,external,d.mime_type,d.file_size_bytes,sha,d.category,d.description,d.document_date,now])?;
    Ok(())
}
pub fn list(
    db: &Connection,
    case_id: Option<&str>,
    client_id: Option<&str>,
    archived: bool,
) -> Result<Vec<DocumentDto>, Error> {
    let mut s=db.prepare("SELECT id,client_id,case_id,storage_mode,original_filename,category,description,document_date,mime_type,file_size_bytes,missing_at,created_at FROM documents WHERE (?1 IS NULL OR case_id=?1) AND (?2 IS NULL OR client_id=?2) AND (?3=1 OR archived_at IS NULL) ORDER BY created_at DESC")?;
    let v = s
        .query_map(params![case_id, client_id, archived as i64], row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(v)
}
pub fn update(
    db: &Connection,
    id: &str,
    category: &str,
    description: Option<&str>,
    date: Option<&str>,
    now: &str,
) -> Result<DocumentDto, Error> {
    if db.execute("UPDATE documents SET category=?2,description=?3,document_date=?4,updated_at=?5 WHERE id=?1",params![id,category,description,date,now])?==0{return Err(Error::DocumentNotFound)};
    db.query_row("SELECT id,client_id,case_id,storage_mode,original_filename,category,description,document_date,mime_type,file_size_bytes,missing_at,created_at FROM documents WHERE id=?1",[id],row).map_err(Error::from)
}
pub fn paths(
    db: &Connection,
    id: &str,
) -> Result<(String, Option<String>, Option<String>, String), Error> {
    db.query_row("SELECT storage_mode,relative_path,external_path,original_filename FROM documents WHERE id=?1",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(|_|Error::DocumentNotFound)
}
pub fn set_missing(db: &Connection, id: &str, missing: bool, now: &str) -> Result<(), Error> {
    db.execute("UPDATE documents SET missing_at=CASE WHEN ?2=1 THEN ?3 ELSE NULL END,updated_at=?3 WHERE id=?1",params![id,missing as i64,now])?;
    Ok(())
}
pub fn delete(db: &Connection, id: &str) -> Result<(), Error> {
    if db.execute("DELETE FROM documents WHERE id=?1", [id])? == 0 {
        return Err(Error::DocumentNotFound);
    };
    Ok(())
}
