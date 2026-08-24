use crate::{
    dto::{ClientDto, ClientDuplicateCandidate, ClientSummary},
    errors::Error,
};
use rusqlite::{Connection, Row};

const CLIENT_COLUMNS: &str = "id, internal_number, full_name, national_id, primary_phone, email, address, notes, archived_at, created_at, updated_at";

fn map_row(row: &Row) -> rusqlite::Result<ClientDto> {
    Ok(ClientDto {
        id: row.get(0)?,
        internal_number: row.get(1)?,
        full_name: row.get(2)?,
        national_id: row.get(3)?,
        primary_phone: row.get(4)?,
        email: row.get(5)?,
        address: row.get(6)?,
        notes: row.get(7)?,
        archived_at: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn insert(
    conn: &Connection,
    id: &str,
    internal_number: &str,
    full_name: &str,
    national_id: Option<&str>,
    primary_phone: Option<&str>,
    normalized_phone: Option<&str>,
    email: Option<&str>,
    address: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO clients (id, internal_number, full_name, national_id, primary_phone, normalized_phone, email, address, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        rusqlite::params![id, internal_number, full_name, national_id, primary_phone, normalized_phone, email, address, notes, now],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update(
    conn: &Connection,
    id: &str,
    internal_number: &str,
    full_name: &str,
    national_id: Option<&str>,
    primary_phone: Option<&str>,
    normalized_phone: Option<&str>,
    email: Option<&str>,
    address: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    let changed = conn.execute(
        "UPDATE clients SET internal_number = ?2, full_name = ?3, national_id = ?4, primary_phone = ?5, normalized_phone = ?6, email = ?7, address = ?8, notes = ?9, updated_at = ?10 WHERE id = ?1",
        rusqlite::params![id, internal_number, full_name, national_id, primary_phone, normalized_phone, email, address, notes, now],
    )?;
    if changed == 0 {
        return Err(Error::ClientNotFound);
    }
    Ok(())
}

pub fn find_by_id(conn: &Connection, id: &str) -> Result<ClientDto, Error> {
    conn.query_row(
        &format!("SELECT {CLIENT_COLUMNS} FROM clients WHERE id = ?1"),
        [id],
        map_row,
    )
    .map_err(|_| Error::ClientNotFound)
}

pub fn list(
    conn: &Connection,
    query: Option<&str>,
    include_archived: bool,
) -> Result<Vec<ClientSummary>, Error> {
    let like = query.map(|q| format!("%{q}%"));
    let archived_filter = if include_archived {
        "1 = 1"
    } else {
        "archived_at IS NULL"
    };
    let sql = format!(
        "SELECT id, internal_number, full_name, primary_phone, archived_at FROM clients WHERE {archived_filter} AND (?1 IS NULL OR internal_number LIKE ?1 OR full_name LIKE ?1 OR primary_phone LIKE ?1) ORDER BY full_name"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([like], |row| {
        Ok(ClientSummary {
            id: row.get(0)?,
            internal_number: row.get(1)?,
            full_name: row.get(2)?,
            primary_phone: row.get(3)?,
            archived_at: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool, now: &str) -> Result<(), Error> {
    let value: Option<&str> = if archived { Some(now) } else { None };
    let changed = conn.execute(
        "UPDATE clients SET archived_at = ?2, updated_at = ?3 WHERE id = ?1",
        rusqlite::params![id, value, now],
    )?;
    if changed == 0 {
        return Err(Error::ClientNotFound);
    }
    Ok(())
}

pub fn find_probable_duplicates(
    conn: &Connection,
    normalized_phone: Option<&str>,
    full_name: &str,
) -> Result<Vec<ClientDuplicateCandidate>, Error> {
    let mut stmt = conn.prepare(
        "SELECT id, full_name, primary_phone FROM clients WHERE (normalized_phone IS NOT NULL AND normalized_phone = ?1) OR full_name = ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![normalized_phone, full_name], |row| {
        Ok(ClientDuplicateCandidate {
            id: row.get(0)?,
            full_name: row.get(1)?,
            primary_phone: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use uuid::Uuid;

    #[test]
    fn persists_canonical_client_fields_and_rejects_duplicate_internal_numbers() {
        let connection = Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        let id = Uuid::new_v4().to_string();
        insert(
            &connection,
            &id,
            "CL-001",
            "أحمد علي",
            None,
            Some("01000000000"),
            Some("01000000000"),
            None,
            None,
            None,
            "now",
        )
        .unwrap();
        let client = find_by_id(&connection, &id).unwrap();
        assert_eq!(client.internal_number, "CL-001");
        assert_eq!(client.full_name, "أحمد علي");
        let duplicate = insert(
            &connection,
            &Uuid::new_v4().to_string(),
            "CL-001",
            "موكل آخر",
            None,
            None,
            None,
            None,
            None,
            None,
            "now",
        );
        assert!(duplicate.is_err());
    }
}
