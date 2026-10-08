use crate::{
    dto::{CaseClientDto, CaseClientInput, CaseDto, CaseOpponentDto, CaseSummary},
    errors::Error,
    normalize,
};
use rusqlite::{params, Connection, Row};

const CASE_COLUMNS: &str = "id, internal_number, official_number, official_year, case_type, litigation_degree, court_name, circuit_name, status, filed_on, closed_on, subject, notes, archived_at, created_at, updated_at, judicial_year";

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
        judicial_year: row.get(16)?,
        clients: vec![],
        opponents: vec![],
    })
}

pub fn insert(conn: &Connection, case: &CaseDto) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO cases (id, internal_number, official_number, official_year, case_type, litigation_degree, court_name, circuit_name, status, filed_on, closed_on, subject, notes, created_at, updated_at, judicial_year) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14, ?15)",
        params![case.id, case.internal_number, case.official_number, case.official_year, case.case_type, case.litigation_degree, case.court_name, case.circuit_name, case.status, case.filed_on, case.closed_on, case.subject, case.notes, case.created_at, case.judicial_year],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, case: &CaseDto) -> Result<(), Error> {
    if conn.execute(
        "UPDATE cases SET internal_number = ?2, official_number = ?3, official_year = ?4, case_type = ?5, litigation_degree = ?6, court_name = ?7, circuit_name = ?8, status = ?9, filed_on = ?10, closed_on = ?11, subject = ?12, notes = ?13, updated_at = ?14, judicial_year = ?15 WHERE id = ?1",
        params![case.id, case.internal_number, case.official_number, case.official_year, case.case_type, case.litigation_degree, case.court_name, case.circuit_name, case.status, case.filed_on, case.closed_on, case.subject, case.notes, case.updated_at, case.judicial_year],
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
    // Validate every relationship before writes, including calls from case_update.
    if clients.is_empty() {
        return Err(Error::CaseMustHaveClient);
    }
    let unique: std::collections::HashSet<_> = clients.iter().map(|c| &c.client_id).collect();
    if unique.len() != clients.len() {
        return Err(Error::Validation);
    }
    for client in clients {
        let archived = conn
            .query_row(
                "SELECT archived_at IS NOT NULL FROM clients WHERE id = ?1",
                [&client.client_id],
                |row| row.get::<_, bool>(0),
            )
            .map_err(|err| match err {
                rusqlite::Error::QueryReturnedNoRows => Error::ClientNotFound,
                other => Error::from(other),
            })?;
        let retained: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM case_clients WHERE case_id = ?1 AND client_id = ?2)",
            params![case_id, client.client_id],
            |row| row.get(0),
        )?;
        if archived && !retained {
            return Err(Error::ClientArchived);
        }
        if let Some(poa) = &client.power_of_attorney_id {
            let owned: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM power_of_attorney_clients WHERE power_of_attorney_id = ?1 AND client_id = ?2)", params![poa, client.client_id], |row| row.get(0))?;
            if !owned {
                return Err(Error::Validation);
            }
        }
    }
    let mut payers =
        conn.prepare("SELECT DISTINCT payer_client_id FROM payments WHERE case_id = ?1")?;
    let payers = payers
        .query_map([case_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    if payers
        .iter()
        .any(|payer| !clients.iter().any(|c| &c.client_id == payer))
    {
        return Err(Error::CaseClientHasPayments);
    }
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
    let like = query
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| normalize::like_pattern(&normalize::normalize_text(value)));
    let mut statement = conn.prepare(
        "SELECT c.id, c.internal_number, c.official_number, c.official_year, c.status, c.archived_at,
                COALESCE(group_concat(cl.full_name, '، '), ''), c.judicial_year, c.court_name,
                (SELECT MIN(h.hearing_date) FROM hearings h WHERE h.case_id = c.id AND h.status = 'SCHEDULED')
         FROM cases c
         LEFT JOIN case_clients cc ON cc.case_id = c.id
         LEFT JOIN clients cl ON cl.id = cc.client_id
         WHERE (?1 OR c.archived_at IS NULL)
           AND (?2 IS NULL OR c.status = ?2)
           AND (?3 IS NULL OR EXISTS (SELECT 1 FROM case_clients filtered WHERE filtered.case_id = c.id AND filtered.client_id = ?3))
           AND (?4 IS NULL
                OR lm_normalize(c.internal_number || ' ' || COALESCE(c.official_number, '') || ' ' ||
                     COALESCE(CAST(c.official_year AS TEXT), '') || ' ' || COALESCE(CAST(c.judicial_year AS TEXT), '') || ' ' ||
                     COALESCE(c.court_name, '') || ' ' || COALESCE(c.circuit_name, '') || ' ' || COALESCE(c.case_type, '')) LIKE ?4 ESCAPE '\\'
                OR EXISTS (SELECT 1 FROM case_clients sc JOIN clients scl ON scl.id = sc.client_id
                           WHERE sc.case_id = c.id AND lm_normalize(scl.full_name) LIKE ?4 ESCAPE '\\')
                OR EXISTS (SELECT 1 FROM case_opponents so
                           WHERE so.case_id = c.id AND lm_normalize(so.full_name) LIKE ?4 ESCAPE '\\'))
         GROUP BY c.id",
    )?;
    let rows = statement
        .query_map(params![include_archived, status, client_id, like], |row| {
            let names = row.get::<_, String>(6)?;
            Ok(CaseSummary {
                id: row.get(0)?,
                internal_number: row.get(1)?,
                official_number: row.get(2)?,
                official_year: row.get(3)?,
                judicial_year: row.get(7)?,
                status: row.get(4)?,
                archived_at: row.get(5)?,
                client_names: if names.is_empty() {
                    vec![]
                } else {
                    names.split("، ").map(str::to_owned).collect()
                },
                court_name: row.get(8)?,
                next_hearing_date: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut rows = rows;
    rows.sort_by(|a, b| {
        a.archived_at
            .is_some()
            .cmp(&b.archived_at.is_some())
            .then_with(|| normalize::natural_cmp(&a.internal_number, &b.internal_number))
    });
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
            judicial_year: None,
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

    fn numbers(rows: &[CaseSummary]) -> Vec<&str> {
        rows.iter()
            .map(|row| row.internal_number.as_str())
            .collect()
    }

    fn seed_case(conn: &Connection, number: &str, court: Option<&str>, client: &str) -> String {
        let case_id = id();
        insert(
            conn,
            &CaseDto {
                internal_number: number.into(),
                official_number: None,
                court_name: court.map(Into::into),
                ..case(case_id.clone())
            },
        )
        .unwrap();
        replace_clients(
            conn,
            &case_id,
            &[CaseClientInput {
                client_id: client.into(),
                legal_capacity: None,
                power_of_attorney_id: None,
                notes: None,
            }],
            "now",
        )
        .unwrap();
        case_id
    }

    #[test]
    fn case_search_finds_clients_courts_and_opponents_whatever_the_spelling() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let ahmed = seed_client(&conn, "1", "أحمد محمود علي");
        let mostafa = seed_client(&conn, "2", "مصطفى عبد الرحمن");
        let first = seed_case(
            &conn,
            "2026/15",
            Some("محكمة شمال القاهرة الابتدائية"),
            &ahmed,
        );
        seed_case(&conn, "2026/9", Some("محكمة الأسرة"), &mostafa);
        insert_opponent(
            &conn,
            &id(),
            &first,
            "شركة النيل للمقاولات",
            None,
            None,
            None,
            None,
            None,
            "now",
        )
        .unwrap();
        let search = |query: &str| list(&conn, Some(query), None, None, false).unwrap();
        assert_eq!(numbers(&search("احمد")), vec!["2026/15"]);
        assert_eq!(numbers(&search("مصطفي")), vec!["2026/9"]);
        assert_eq!(numbers(&search("شمال القاهره")), vec!["2026/15"]);
        assert_eq!(numbers(&search("النيل")), vec!["2026/15"]);
        assert_eq!(numbers(&search("٢٠٢٦/٩")), vec!["2026/9"]);
        assert!(search("الإسكندرية").is_empty());
        // Every client of a matching case is still listed.
        assert_eq!(search("احمد")[0].client_names, vec!["أحمد محمود علي"]);
        assert_eq!(
            search("شمال")[0].court_name.as_deref(),
            Some("محكمة شمال القاهرة الابتدائية")
        );
    }

    #[test]
    fn cases_sort_by_their_numbers_with_archived_ones_last() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let client = seed_client(&conn, "1", "أحمد");
        for number in ["2026/100", "2026/15", "10", "2026/9"] {
            seed_case(&conn, number, None, &client);
        }
        let archived = seed_case(&conn, "1", None, &client);
        set_archived(&conn, &archived, true, "now").unwrap();
        assert_eq!(
            numbers(&list(&conn, None, None, None, true).unwrap()),
            vec!["10", "2026/9", "2026/15", "2026/100", "1"]
        );
    }

    #[test]
    fn next_hearing_is_the_earliest_hearing_still_awaiting_a_decision() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let client = seed_client(&conn, "1", "أحمد");
        let case_id = seed_case(&conn, "1", None, &client);
        assert_eq!(
            list(&conn, None, None, None, false).unwrap()[0].next_hearing_date,
            None
        );
        for (date, status) in [
            ("2026-09-01", "COMPLETED"),
            ("2026-11-15", "SCHEDULED"),
            ("2026-10-20", "SCHEDULED"),
        ] {
            conn.execute(
                "INSERT INTO hearings (id, case_id, hearing_date, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'now', 'now')",
                params![id(), case_id, date, status],
            )
            .unwrap();
        }
        assert_eq!(
            list(&conn, None, None, None, false).unwrap()[0]
                .next_hearing_date
                .as_deref(),
            Some("2026-10-20")
        );
    }
}
