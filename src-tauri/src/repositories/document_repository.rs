use crate::{dto::AttachmentDto, errors::Error};
use rusqlite::{params, Connection};
const SELECT: &str = "SELECT id, client_id, case_id, power_of_attorney_id, expense_id, original_filename, stored_filename, relative_path, mime_type, file_size_bytes, sha256, category, description, document_date, created_at, updated_at FROM attachments";
fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AttachmentDto> {
    Ok(AttachmentDto {
        id: row.get(0)?,
        client_id: row.get(1)?,
        case_id: row.get(2)?,
        power_of_attorney_id: row.get(3)?,
        expense_id: row.get(4)?,
        original_filename: row.get(5)?,
        stored_filename: row.get(6)?,
        relative_path: row.get(7)?,
        mime_type: row.get(8)?,
        file_size_bytes: row.get(9)?,
        sha256: row.get(10)?,
        category: row.get(11)?,
        description: row.get(12)?,
        document_date: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}
pub fn insert(conn: &Connection, attachment: &AttachmentDto) -> Result<(), Error> {
    conn.execute("INSERT INTO attachments (id, client_id, case_id, power_of_attorney_id, expense_id, original_filename, stored_filename, relative_path, mime_type, file_size_bytes, sha256, category, description, document_date, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)", params![attachment.id, attachment.client_id, attachment.case_id, attachment.power_of_attorney_id, attachment.expense_id, attachment.original_filename, attachment.stored_filename, attachment.relative_path, attachment.mime_type, attachment.file_size_bytes, attachment.sha256, attachment.category, attachment.description, attachment.document_date, attachment.created_at])?;
    Ok(())
}
pub fn get(conn: &Connection, id: &str) -> Result<AttachmentDto, Error> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row)
        .map_err(|_| Error::AttachmentNotFound)
}
pub fn list(
    conn: &Connection,
    case_id: Option<&str>,
    client_id: Option<&str>,
    poa_id: Option<&str>,
    expense_id: Option<&str>,
) -> Result<Vec<AttachmentDto>, Error> {
    let mut stmt = conn.prepare(&format!("{SELECT} WHERE (?1 IS NULL OR case_id = ?1) AND (?2 IS NULL OR client_id = ?2) AND (?3 IS NULL OR power_of_attorney_id = ?3) AND (?4 IS NULL OR expense_id = ?4) ORDER BY created_at DESC"))?;
    let rows = stmt
        .query_map(params![case_id, client_id, poa_id, expense_id], row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}
pub fn update(conn: &Connection, attachment: &AttachmentDto) -> Result<(), Error> {
    if conn.execute("UPDATE attachments SET category = ?2, description = ?3, document_date = ?4, updated_at = ?5 WHERE id = ?1", params![attachment.id, attachment.category, attachment.description, attachment.document_date, attachment.updated_at])? == 0 { return Err(Error::AttachmentNotFound); }
    Ok(())
}
pub fn delete(conn: &Connection, id: &str) -> Result<(), Error> {
    if conn.execute("DELETE FROM attachments WHERE id = ?1", [id])? == 0 {
        return Err(Error::AttachmentNotFound);
    }
    Ok(())
}
