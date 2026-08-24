use crate::{
    dto::{CaseClientDto, CaseClientInput, CaseDto, CaseOpponentDto, CaseSummary},
    errors::Error,
};
use rusqlite::{params, Connection, Row};

const CASE_COLUMNS: &str = "id, internal_number, official_number, official_year, case_type, litigation_degree, court_name, circuit_name, status, filed_on, closed_on, subject, notes, archived_at, created_at, updated_at";

fn map_case(row: &Row<'_>) -> rusqlite::Result<CaseDto> {
    Ok(CaseDto {
        id: row.get(0)?,
        internal_number: row.get(1)?,
        official_number: row.get(2)?,
        official_year: row.get(3)?,
        case_type: row.get(4)?,
        litigation_degree: row.get(5)?,
        court_name: row.get(6)?,
        circuit_name: row.get(7)?,
        status: row.get(8)?,
        filed_on: row.get(9)?,
        closed_on: row.get(10)?,
        subject: row.get(11)?,
        notes: row.get(12)?,
        archived_at: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        clients: vec![],
        opponents: vec![],
    })
}

pub fn insert(conn: &Connection, case: &CaseDto) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO cases (id, internal_number, official_number, official_year, case_type, litigation_degree, court_name, circuit_name, status, filed_on, closed_on, subject, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)",
        params![case.id, case.internal_number, case.official_number, case.official_year, case.case_type, case.litigation_degree, case.court_name, case.circuit_name, case.status, case.filed_on, case.closed_on, case.subject, case.notes, case.created_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, case: &CaseDto) -> Result<(), Error> {
    if conn.execute(
        "UPDATE cases SET internal_number = ?2, official_number = ?3, official_year = ?4, case_type = ?5, litigation_degree = ?6, court_name = ?7, circuit_name = ?8, status = ?9, filed_on = ?10, closed_on = ?11, subject = ?12, notes = ?13, updated_at = ?14 WHERE id = ?1",
        params![case.id, case.internal_number, case.official_number, case.official_year, case.case_type, case.litigation_degree, case.court_name, case.circuit_name, case.status, case.filed_on, case.closed_on, case.subject, case.notes, case.updated_at],
    )? == 0 { return Err(Error::CaseNotFound); }
    Ok(())
}

pub fn get(conn: &Connection, id: &str) -> Result<CaseDto, Error> {
    conn.query_row(
        &format!("SELECT {CASE_COLUMNS} FROM cases WHERE id = ?1"),
        [id],
        map_case,
    )
    .map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => Error::CaseNotFound,
        other => Error::from(other),
    })
}

pub fn hydrate(conn: &Connection, mut case: CaseDto) -> Result<CaseDto, Error> {
    let mut clients = conn.prepare(
        "SELECT cc.client_id, c.full_name, c.internal_number, cc.legal_capacity, cc.power_of_attorney_id, cc.notes FROM case_clients cc JOIN clients c ON c.id = cc.client_id WHERE cc.case_id = ?1 ORDER BY c.full_name",
    )?;
    case.clients = clients
        .query_map([&case.id], |row| {
            Ok(CaseClientDto {
                client_id: row.get(0)?,
                full_name: row.get(1)?,
                internal_number: row.get(2)?,
                legal_capacity: row.get(3)?,
                power_of_attorney_id: row.get(4)?,
                notes: row.get(5)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    let mut opponents = conn.prepare(
        "SELECT id, case_id, full_name, legal_capacity, lawyer_name, phone, address, notes FROM case_opponents WHERE case_id = ?1 ORDER BY created_at",
    )?;
    case.opponents = opponents
        .query_map([&case.id], |row| {
            Ok(CaseOpponentDto {
                id: row.get(0)?,
                case_id: row.get(1)?,
                full_name: row.get(2)?,
                legal_capacity: row.get(3)?,
                lawyer_name: row.get(4)?,
                phone: row.get(5)?,
                address: row.get(6)?,
                notes: row.get(7)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(case)
}

pub fn replace_clients(
    conn: &Connection,
    case_id: &str,
    clients: &[CaseClientInput],
    now: &str,
) -> Result<(), Error> {
    for client in clients {
        conn.execute(
            "INSERT INTO case_clients (case_id, client_id, legal_capacity, power_of_attorney_id, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(case_id, client_id) DO UPDATE SET legal_capacity = excluded.legal_capacity, power_of_attorney_id = excluded.power_of_attorney_id, notes = excluded.notes, updated_at = excluded.updated_at",
            params![case_id, client.client_id, client.legal_capacity, client.power_of_attorney_id, client.notes, now],
        )?;
    }
    let mut statement = conn.prepare("SELECT client_id FROM case_clients WHERE case_id = ?1")?;
    let existing = statement
        .query_map([case_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    drop(statement);
    for client_id in existing {
        if !clients.iter().any(|client| client.client_id == client_id) {
            conn.execute(
                "DELETE FROM case_clients WHERE case_id = ?1 AND client_id = ?2",
                params![case_id, client_id],
            )?;
        }
    }
    Ok(())
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool, now: &str) -> Result<(), Error> {
    if conn.execute("UPDATE cases SET archived_at = CASE WHEN ?2 THEN ?3 ELSE NULL END, updated_at = ?3 WHERE id = ?1", params![id, archived, now])? == 0 {
        return Err(Error::CaseNotFound);
    }
    Ok(())
}

pub fn list(
    conn: &Connection,
    query: Option<&str>,
    status: Option<&str>,
    client_id: Option<&str>,
    include_archived: bool,
) -> Result<Vec<CaseSummary>, Error> {
    let like = query.map(|value| format!("%{value}%"));
    let mut statement = conn.prepare(
        "SELECT c.id, c.internal_number, c.official_number, c.official_year, c.status, c.archived_at, COALESCE(group_concat(cl.full_name, '، '), '') FROM cases c LEFT JOIN case_clients cc ON cc.case_id = c.id LEFT JOIN clients cl ON cl.id = cc.client_id WHERE (?1 OR c.archived_at IS NULL) AND (?2 IS NULL OR c.status = ?2) AND (?3 IS NULL OR EXISTS (SELECT 1 FROM case_clients filtered WHERE filtered.case_id = c.id AND filtered.client_id = ?3)) AND (?4 IS NULL OR c.internal_number LIKE ?4 OR c.official_number LIKE ?4 OR CAST(c.official_year AS TEXT) LIKE ?4) GROUP BY c.id ORDER BY c.archived_at IS NOT NULL, c.internal_number",
    )?;
    let rows = statement
        .query_map(params![include_archived, status, client_id, like], |row| {
            let names = row.get::<_, String>(6)?;
            Ok(CaseSummary {
                id: row.get(0)?,
                internal_number: row.get(1)?,
                official_number: row.get(2)?,
                official_year: row.get(3)?,
                status: row.get(4)?,
                archived_at: row.get(5)?,
                client_names: if names.is_empty() {
                    vec![]
                } else {
                    names.split("، ").map(str::to_owned).collect()
                },
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[allow(clippy::too_many_arguments)]
pub fn insert_opponent(
    conn: &Connection,
    id: &str,
    case_id: &str,
    full_name: &str,
    legal_capacity: Option<&str>,
    lawyer_name: Option<&str>,
    phone: Option<&str>,
    address: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<(), Error> {
    conn.execute("INSERT INTO case_opponents (id, case_id, full_name, legal_capacity, lawyer_name, phone, address, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)", params![id, case_id, full_name, legal_capacity, lawyer_name, phone, address, notes, now])?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_opponent(
    conn: &Connection,
    id: &str,
    full_name: &str,
    legal_capacity: Option<&str>,
    lawyer_name: Option<&str>,
    phone: Option<&str>,
    address: Option<&str>,
    notes: Option<&str>,
    now: &str,
) -> Result<CaseOpponentDto, Error> {
    if conn.execute("UPDATE case_opponents SET full_name = ?2, legal_capacity = ?3, lawyer_name = ?4, phone = ?5, address = ?6, notes = ?7, updated_at = ?8 WHERE id = ?1", params![id, full_name, legal_capacity, lawyer_name, phone, address, notes, now])? == 0 { return Err(Error::CaseNotFound); }
    get_opponent(conn, id)
}

pub fn get_opponent(conn: &Connection, id: &str) -> Result<CaseOpponentDto, Error> {
    conn.query_row("SELECT id, case_id, full_name, legal_capacity, lawyer_name, phone, address, notes FROM case_opponents WHERE id = ?1", [id], |row| Ok(CaseOpponentDto { id: row.get(0)?, case_id: row.get(1)?, full_name: row.get(2)?, legal_capacity: row.get(3)?, lawyer_name: row.get(4)?, phone: row.get(5)?, address: row.get(6)?, notes: row.get(7)? }))
        .map_err(|error| match error { rusqlite::Error::QueryReturnedNoRows => Error::CaseNotFound, other => Error::from(other) })
}

pub fn delete_opponent(conn: &Connection, id: &str) -> Result<(), Error> {
    conn.execute("DELETE FROM case_opponents WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use uuid::Uuid;
    fn id() -> String {
        Uuid::new_v4().to_string()
    }
    fn seed_client(conn: &Connection, number: &str, name: &str) -> String {
        let id = id();
        conn.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![id, number, name]).unwrap();
        id
    }
    fn case(id: String) -> CaseDto {
        CaseDto {
            id,
            internal_number: "CA-1".into(),
            official_number: Some("42".into()),
            official_year: Some(2026),
            case_type: None,
            litigation_degree: Some("APPEAL".into()),
            court_name: None,
            circuit_name: None,
            status: "ACTIVE".into(),
            filed_on: Some("2026-08-24".into()),
            closed_on: None,
            subject: None,
            notes: None,
            archived_at: None,
            created_at: "now".into(),
            updated_at: "now".into(),
            clients: vec![],
            opponents: vec![],
        }
    }
    #[test]
    fn persists_case_clients_with_capacity_and_client_specific_poa() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let first = seed_client(&conn, "CL-1", "أحمد");
        let second = seed_client(&conn, "CL-2", "سارة");
        let poa = id();
        let case_id = id();
        conn.execute("INSERT INTO powers_of_attorney (id, internal_sequence, created_at, updated_at) VALUES (?1, 'TA-1', 'now', 'now')", [&poa]).unwrap();
        conn.execute("INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')", params![poa, first]).unwrap();
        insert(&conn, &case(case_id.clone())).unwrap();
        replace_clients(
            &conn,
            &case_id,
            &[
                CaseClientInput {
                    client_id: first.clone(),
                    legal_capacity: Some("مدعٍ".into()),
                    power_of_attorney_id: Some(poa),
                    notes: Some("ملاحظة".into()),
                },
                CaseClientInput {
                    client_id: second,
                    legal_capacity: None,
                    power_of_attorney_id: None,
                    notes: None,
                },
            ],
            "now",
        )
        .unwrap();
        let saved = hydrate(&conn, get(&conn, &case_id).unwrap()).unwrap();
        assert_eq!(saved.clients.len(), 2);
        assert_eq!(saved.clients[0].legal_capacity.as_deref(), Some("مدعٍ"));
    }
    #[test]
    fn rejects_case_client_poa_for_another_client_and_reports_missing_case() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let owner = seed_client(&conn, "CL-1", "أحمد");
        let other = seed_client(&conn, "CL-2", "سارة");
        let poa = id();
        let case_id = id();
        conn.execute("INSERT INTO powers_of_attorney (id, internal_sequence, created_at, updated_at) VALUES (?1, 'TA-1', 'now', 'now')", [&poa]).unwrap();
        conn.execute("INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')", params![poa, owner]).unwrap();
        insert(&conn, &case(case_id.clone())).unwrap();
        assert!(replace_clients(
            &conn,
            &case_id,
            &[CaseClientInput {
                client_id: other,
                legal_capacity: None,
                power_of_attorney_id: Some(poa),
                notes: None
            }],
            "now"
        )
        .is_err());
        assert!(matches!(get(&conn, "missing"), Err(Error::CaseNotFound)));
    }
    #[test]
    fn persists_lightweight_opponents_and_filters_cases_by_identifiers() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let client = seed_client(&conn, "CL-1", "أحمد");
        let case_id = id();
        insert(&conn, &case(case_id.clone())).unwrap();
        replace_clients(
            &conn,
            &case_id,
            &[CaseClientInput {
                client_id: client,
                legal_capacity: None,
                power_of_attorney_id: None,
                notes: None,
            }],
            "now",
        )
        .unwrap();
        let opponent = id();
        insert_opponent(
            &conn,
            &opponent,
            &case_id,
            "الخصم",
            Some("مدعى عليه"),
            None,
            None,
            None,
            None,
            "now",
        )
        .unwrap();
        assert_eq!(
            hydrate(&conn, get(&conn, &case_id).unwrap())
                .unwrap()
                .opponents[0]
                .full_name,
            "الخصم"
        );
        assert_eq!(
            list(&conn, Some("42"), None, None, false).unwrap()[0].id,
            case_id
        );
    }
}
