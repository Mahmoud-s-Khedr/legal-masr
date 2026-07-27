use crate::{
    dto::{CaseClientDto, CaseDto, CasePartyDto, CaseSummary},
    errors::Error,
};
use rusqlite::{Connection, Row};

const CASE_COLUMNS: &str = "id, case_number, judicial_year, court_name, circuit_name, case_type, client_legal_capacity, status, filed_on, closed_on, summary, notes, archived_at, created_at, updated_at";

fn map_row(row: &Row) -> rusqlite::Result<CaseDto> {
    Ok(CaseDto {
        id: row.get(0)?,
        case_number: row.get(1)?,
        judicial_year: row.get(2)?,
        court_name: row.get(3)?,
        circuit_name: row.get(4)?,
        case_type: row.get(5)?,
        client_legal_capacity: row.get(6)?,
        status: row.get(7)?,
        filed_on: row.get(8)?,
        closed_on: row.get(9)?,
        summary: row.get(10)?,
        notes: row.get(11)?,
        archived_at: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
        clients: Vec::new(),
        parties: Vec::new(),
    })
}

#[allow(clippy::too_many_arguments)]
pub fn insert_case(
    conn: &Connection,
    id: &str,
    case_number: &str,
    judicial_year: Option<i64>,
    court_name: Option<&str>,
    circuit_name: Option<&str>,
    case_type: Option<&str>,
    client_legal_capacity: Option<&str>,
    status: &str,
    filed_on: Option<&str>,
    summary: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO cases (id, case_number, judicial_year, court_name, circuit_name, case_type, client_legal_capacity, status, filed_on, summary, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        rusqlite::params![id, case_number, judicial_year, court_name, circuit_name, case_type, client_legal_capacity, status, filed_on, summary, notes, now],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_case(
    conn: &Connection,
    id: &str,
    case_number: &str,
    judicial_year: Option<i64>,
    court_name: Option<&str>,
    circuit_name: Option<&str>,
    case_type: Option<&str>,
    client_legal_capacity: Option<&str>,
    status: &str,
    filed_on: Option<&str>,
    closed_on: Option<&str>,
    summary: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    let changed = conn.execute(
        "UPDATE cases SET case_number = ?2, judicial_year = ?3, court_name = ?4, circuit_name = ?5, case_type = ?6, client_legal_capacity = ?7, status = ?8, filed_on = ?9, closed_on = ?10, summary = ?11, notes = ?12, updated_at = ?13 WHERE id = ?1",
        rusqlite::params![id, case_number, judicial_year, court_name, circuit_name, case_type, client_legal_capacity, status, filed_on, closed_on, summary, notes, now],
    )?;
    if changed == 0 {
        return Err(Error::CaseNotFound);
    }
    Ok(())
}

pub fn find_case_by_id(conn: &Connection, id: &str) -> Result<CaseDto, Error> {
    conn.query_row(
        &format!("SELECT {CASE_COLUMNS} FROM cases WHERE id = ?1"),
        [id],
        map_row,
    )
    .map_err(|_| Error::CaseNotFound)
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool, now: &str) -> Result<(), Error> {
    let value: Option<&str> = if archived { Some(now) } else { None };
    let changed = conn.execute(
        "UPDATE cases SET archived_at = ?2, updated_at = ?3 WHERE id = ?1",
        rusqlite::params![id, value, now],
    )?;
    if changed == 0 {
        return Err(Error::CaseNotFound);
    }
    Ok(())
}

pub fn list_summaries(
    conn: &Connection,
    query: Option<&str>,
    status: Option<&str>,
    client_id: Option<&str>,
    include_archived: bool,
) -> Result<Vec<CaseSummary>, Error> {
    let like = query.map(|q| format!("%{q}%"));
    let archived_filter = if include_archived {
        "1 = 1"
    } else {
        "c.archived_at IS NULL"
    };
    let sql = format!(
        "SELECT c.id, c.case_number, c.judicial_year, c.status, c.archived_at,
                (SELECT cl.display_name FROM case_clients cc JOIN clients cl ON cl.id = cc.client_id WHERE cc.case_id = c.id AND cc.is_primary = 1)
         FROM cases c
         WHERE {archived_filter}
           AND (?1 IS NULL OR c.status = ?1)
           AND (?2 IS NULL OR EXISTS (SELECT 1 FROM case_clients cc2 WHERE cc2.case_id = c.id AND cc2.client_id = ?2))
           AND (?3 IS NULL OR c.case_number LIKE ?3)
         ORDER BY c.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![status, client_id, like], |row| {
        Ok(CaseSummary {
            id: row.get(0)?,
            case_number: row.get(1)?,
            judicial_year: row.get(2)?,
            status: row.get(3)?,
            archived_at: row.get(4)?,
            primary_client_name: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn list_clients_for_case(
    conn: &Connection,
    case_id: &str,
) -> Result<Vec<CaseClientDto>, Error> {
    let mut stmt = conn.prepare(
        "SELECT cc.client_id, cl.display_name, cc.is_primary FROM case_clients cc JOIN clients cl ON cl.id = cc.client_id WHERE cc.case_id = ?1 ORDER BY cc.is_primary DESC, cl.display_name",
    )?;
    let rows = stmt.query_map([case_id], |row| {
        Ok(CaseClientDto {
            client_id: row.get(0)?,
            display_name: row.get(1)?,
            is_primary: row.get::<_, i64>(2)? != 0,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn count_clients_for_case(conn: &Connection, case_id: &str) -> Result<i64, Error> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM case_clients WHERE case_id = ?1",
        [case_id],
        |r| r.get(0),
    )?)
}

pub fn is_client_primary(conn: &Connection, case_id: &str, client_id: &str) -> Result<bool, Error> {
    Ok(conn
        .query_row(
            "SELECT is_primary FROM case_clients WHERE case_id = ?1 AND client_id = ?2",
            [case_id, client_id],
            |r| r.get::<_, i64>(0),
        )
        .map(|v| v != 0)
        .unwrap_or(false))
}

pub fn attach_client(
    conn: &Connection,
    case_id: &str,
    client_id: &str,
    now: &str,
) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO case_clients (case_id, client_id, is_primary, created_at) VALUES (?1, ?2, 0, ?3)",
        rusqlite::params![case_id, client_id, now],
    )?;
    Ok(())
}

pub fn detach_client(conn: &Connection, case_id: &str, client_id: &str) -> Result<(), Error> {
    conn.execute(
        "DELETE FROM case_clients WHERE case_id = ?1 AND client_id = ?2",
        rusqlite::params![case_id, client_id],
    )?;
    Ok(())
}

pub fn clear_primary_client(conn: &Connection, case_id: &str) -> Result<(), Error> {
    conn.execute(
        "UPDATE case_clients SET is_primary = 0 WHERE case_id = ?1",
        [case_id],
    )?;
    Ok(())
}

pub fn set_primary_client(conn: &Connection, case_id: &str, client_id: &str) -> Result<(), Error> {
    let changed = conn.execute(
        "UPDATE case_clients SET is_primary = 1 WHERE case_id = ?1 AND client_id = ?2",
        rusqlite::params![case_id, client_id],
    )?;
    if changed == 0 {
        return Err(Error::ClientNotFound);
    }
    Ok(())
}

pub fn list_parties_for_case(conn: &Connection, case_id: &str) -> Result<Vec<CasePartyDto>, Error> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, role, name, phone, address, notes FROM case_parties WHERE case_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map([case_id], |row| {
        Ok(CasePartyDto {
            id: row.get(0)?,
            case_id: row.get(1)?,
            role: row.get(2)?,
            name: row.get(3)?,
            phone: row.get(4)?,
            address: row.get(5)?,
            notes: row.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[allow(clippy::too_many_arguments)]
pub fn insert_party(
    conn: &Connection,
    id: &str,
    case_id: &str,
    role: &str,
    name: &str,
    phone: Option<&str>,
    address: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO case_parties (id, case_id, role, name, phone, address, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        rusqlite::params![id, case_id, role, name, phone, address, notes, now],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_party(
    conn: &Connection,
    id: &str,
    role: &str,
    name: &str,
    phone: Option<&str>,
    address: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    let changed = conn.execute(
        "UPDATE case_parties SET role = ?2, name = ?3, phone = ?4, address = ?5, notes = ?6, updated_at = ?7 WHERE id = ?1",
        rusqlite::params![id, role, name, phone, address, notes, now],
    )?;
    if changed == 0 {
        return Err(Error::CaseNotFound);
    }
    Ok(())
}

pub fn delete_party(conn: &Connection, id: &str) -> Result<(), Error> {
    conn.execute("DELETE FROM case_parties WHERE id = ?1", [id])?;
    Ok(())
}
