use crate::{
    dto::{
        PowerOfAttorneyClientDto, PowerOfAttorneyDto, PowerOfAttorneyLawyerDto,
        PowerOfAttorneySummary,
    },
    errors::Error,
};
use rusqlite::{params, Connection};

fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PowerOfAttorneyDto> {
    Ok(PowerOfAttorneyDto {
        id: row.get(0)?,
        internal_sequence: row.get(1)?,
        official_number: row.get(2)?,
        issue_year: row.get(3)?,
        issue_date: row.get(4)?,
        notary_office: row.get(5)?,
        notes: row.get(6)?,
        archived_at: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        clients: vec![],
        lawyers: vec![],
        case_ids: vec![],
    })
}

const SELECT: &str = "SELECT id, internal_sequence, official_number, issue_year, issue_date, notary_office, notes, archived_at, created_at, updated_at FROM powers_of_attorney";

pub fn get(conn: &Connection, id: &str) -> Result<PowerOfAttorneyDto, Error> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row)
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Error::PowerOfAttorneyNotFound,
            other => Error::from(other),
        })
}

pub fn replace_clients(
    conn: &Connection,
    id: &str,
    client_ids: &[String],
    now: &str,
) -> Result<(), Error> {
    let current = conn
        .prepare("SELECT client_id FROM power_of_attorney_clients WHERE power_of_attorney_id = ?1")?
        .query_map([id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    let removed = current
        .iter()
        .filter(|client_id| !client_ids.contains(client_id))
        .collect::<Vec<_>>();
    // Check every removal before changing anything, so a refusal leaves the
    // stored associations exactly as they were. Associations a case still
    // relies on are kept when unchanged and refused when removed.
    for client_id in &removed {
        let relied_on: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM case_clients WHERE power_of_attorney_id = ?1 AND client_id = ?2)",
            params![id, client_id],
            |row| row.get(0),
        )?;
        if relied_on {
            return Err(Error::PowerOfAttorneyClientInUse);
        }
    }
    for client_id in removed {
        conn.execute(
            "DELETE FROM power_of_attorney_clients WHERE power_of_attorney_id = ?1 AND client_id = ?2",
            params![id, client_id],
        )?;
    }
    for client_id in client_ids.iter().filter(|c| !current.contains(c)) {
        conn.execute(
            "INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, ?3)",
            params![id, client_id, now],
        )?;
    }
    Ok(())
}

pub fn replace_lawyers(
    conn: &Connection,
    id: &str,
    lawyers: &[(String, String, Option<String>, Option<String>)],
    now: &str,
) -> Result<(), Error> {
    conn.execute(
        "DELETE FROM power_of_attorney_lawyers WHERE power_of_attorney_id = ?1",
        [id],
    )?;
    for (lawyer_id, full_name, bar_number, notes) in lawyers {
        conn.execute(
            "INSERT INTO power_of_attorney_lawyers (id, power_of_attorney_id, full_name, bar_number, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![lawyer_id, id, full_name, bar_number, notes, now],
        )?;
    }
    Ok(())
}

pub fn insert(conn: &Connection, poa: &PowerOfAttorneyDto) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO powers_of_attorney (id, internal_sequence, official_number, issue_year, issue_date, notary_office, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![poa.id, poa.internal_sequence, poa.official_number, poa.issue_year, poa.issue_date, poa.notary_office, poa.notes, poa.created_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, poa: &PowerOfAttorneyDto) -> Result<(), Error> {
    if conn.execute(
        "UPDATE powers_of_attorney SET internal_sequence = ?2, official_number = ?3, issue_year = ?4, issue_date = ?5, notary_office = ?6, notes = ?7, updated_at = ?8 WHERE id = ?1",
        params![poa.id, poa.internal_sequence, poa.official_number, poa.issue_year, poa.issue_date, poa.notary_office, poa.notes, poa.updated_at],
    )? == 0 {
        return Err(Error::PowerOfAttorneyNotFound);
    }
    Ok(())
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool, now: &str) -> Result<(), Error> {
    if conn.execute(
        "UPDATE powers_of_attorney SET archived_at = CASE WHEN ?2 THEN ?3 ELSE NULL END, updated_at = ?3 WHERE id = ?1",
        params![id, archived, now],
    )? == 0 {
        return Err(Error::PowerOfAttorneyNotFound);
    }
    Ok(())
}

pub fn hydrate(
    conn: &Connection,
    mut poa: PowerOfAttorneyDto,
) -> Result<PowerOfAttorneyDto, Error> {
    let mut clients = conn.prepare("SELECT c.id, c.full_name, c.internal_number FROM power_of_attorney_clients pc JOIN clients c ON c.id = pc.client_id WHERE pc.power_of_attorney_id = ?1 ORDER BY c.full_name")?;
    poa.clients = clients
        .query_map([&poa.id], |row| {
            Ok(PowerOfAttorneyClientDto {
                id: row.get(0)?,
                full_name: row.get(1)?,
                internal_number: row.get(2)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    let mut lawyers = conn.prepare("SELECT id, full_name, bar_number, notes FROM power_of_attorney_lawyers WHERE power_of_attorney_id = ?1 ORDER BY full_name")?;
    poa.lawyers = lawyers
        .query_map([&poa.id], |row| {
            Ok(PowerOfAttorneyLawyerDto {
                id: row.get(0)?,
                full_name: row.get(1)?,
                bar_number: row.get(2)?,
                notes: row.get(3)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    let mut cases = conn.prepare(
        "SELECT DISTINCT case_id FROM case_clients WHERE power_of_attorney_id = ?1 ORDER BY case_id",
    )?;
    poa.case_ids = cases
        .query_map([&poa.id], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(poa)
}

pub fn list(
    conn: &Connection,
    query: Option<&str>,
    include_archived: bool,
    client_id: Option<&str>,
) -> Result<Vec<PowerOfAttorneySummary>, Error> {
    let like = query.map(|value| format!("%{value}%"));
    let mut statement = conn.prepare(
        "SELECT p.id, p.internal_sequence, p.official_number, p.issue_year, p.archived_at, COALESCE(group_concat(c.full_name, '، '), '')
         FROM powers_of_attorney p
         LEFT JOIN power_of_attorney_clients pc ON pc.power_of_attorney_id = p.id
         LEFT JOIN clients c ON c.id = pc.client_id
         WHERE (?1 OR p.archived_at IS NULL) AND (?2 IS NULL OR p.internal_sequence LIKE ?2 OR p.official_number LIKE ?2 OR c.full_name LIKE ?2)
           AND (?3 IS NULL OR EXISTS (SELECT 1 FROM power_of_attorney_clients owner WHERE owner.power_of_attorney_id = p.id AND owner.client_id = ?3))
         GROUP BY p.id ORDER BY p.archived_at IS NOT NULL, p.internal_sequence",
    )?;
    let rows = statement
        .query_map(params![include_archived, like, client_id], |row| {
            let client_names = row.get::<_, String>(5)?;
            Ok(PowerOfAttorneySummary {
                id: row.get(0)?,
                internal_sequence: row.get(1)?,
                official_number: row.get(2)?,
                issue_year: row.get(3)?,
                archived_at: row.get(4)?,
                client_names: if client_names.is_empty() {
                    vec![]
                } else {
                    client_names.split("، ").map(str::to_owned).collect()
                },
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use uuid::Uuid;

    fn id() -> String {
        Uuid::new_v4().to_string()
    }

    fn poa(id: String) -> PowerOfAttorneyDto {
        PowerOfAttorneyDto {
            id,
            internal_sequence: "TA-١".into(),
            official_number: Some("٤٢".into()),
            issue_year: Some(2026),
            issue_date: Some("2026-08-24".into()),
            notary_office: Some("شهر عقاري القاهرة".into()),
            notes: None,
            archived_at: None,
            created_at: "now".into(),
            updated_at: "now".into(),
            clients: vec![],
            lawyers: vec![],
            case_ids: vec![],
        }
    }

    #[test]
    fn persists_multiple_clients_lawyers_and_case_links() {
        let connection = Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        let first_client = id();
        let second_client = id();
        let poa_id = id();
        let case_id = id();
        for (client_id, number, name) in [
            (&first_client, "CL-1", "أحمد"),
            (&second_client, "CL-2", "سارة"),
        ] {
            connection.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![client_id, number, name]).unwrap();
        }
        insert(&connection, &poa(poa_id.clone())).unwrap();
        replace_clients(
            &connection,
            &poa_id,
            &[first_client.clone(), second_client.clone()],
            "now",
        )
        .unwrap();
        replace_lawyers(
            &connection,
            &poa_id,
            &[(id(), "محمود".into(), Some("١٢٣".into()), None)],
            "now",
        )
        .unwrap();
        assert!(hydrate(&connection, get(&connection, &poa_id).unwrap())
            .unwrap()
            .case_ids
            .is_empty());
        connection.execute("INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, 'CA-1', 'ACTIVE', 'now', 'now')", [&case_id]).unwrap();
        connection.execute("INSERT INTO case_clients (case_id, client_id, power_of_attorney_id, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![case_id, first_client, poa_id]).unwrap();
        connection.execute("INSERT INTO case_clients (case_id, client_id, power_of_attorney_id, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![case_id, second_client, poa_id]).unwrap();

        let saved = hydrate(&connection, get(&connection, &poa_id).unwrap()).unwrap();
        assert_eq!(saved.clients.len(), 2);
        assert_eq!(saved.lawyers[0].full_name, "محمود");
        assert_eq!(saved.case_ids, vec![case_id]);
    }

    #[test]
    fn rejects_a_missing_client_and_reports_a_missing_poa() {
        let connection = Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        let poa_id = id();
        insert(&connection, &poa(poa_id.clone())).unwrap();
        assert!(replace_clients(&connection, &poa_id, &[id()], "now").is_err());
        assert!(matches!(
            get(&connection, &id()),
            Err(Error::PowerOfAttorneyNotFound)
        ));
    }

    /// A power of attorney linking two clients, with a case that relies on the
    /// association for the first client. Returns (connection, poa, first, second).
    fn poa_relied_on_by_a_case() -> (Connection, String, String, String) {
        let connection = Connection::open_in_memory().unwrap();
        db::migrate(&connection).unwrap();
        let (first, second, poa_id, case_id) = (id(), id(), id(), id());
        for (client_id, number, name) in [(&first, "CL-1", "أحمد"), (&second, "CL-2", "سارة")]
        {
            connection.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![client_id, number, name]).unwrap();
        }
        insert(&connection, &poa(poa_id.clone())).unwrap();
        replace_clients(
            &connection,
            &poa_id,
            &[first.clone(), second.clone()],
            "first-save",
        )
        .unwrap();
        connection.execute("INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, 'CA-1', 'ACTIVE', 'now', 'now')", [&case_id]).unwrap();
        connection.execute("INSERT INTO case_clients (case_id, client_id, power_of_attorney_id, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')", params![case_id, first, poa_id]).unwrap();
        (connection, poa_id, first, second)
    }

    fn linked_clients(connection: &Connection, poa_id: &str) -> Vec<String> {
        let mut statement = connection
            .prepare("SELECT client_id FROM power_of_attorney_clients WHERE power_of_attorney_id = ?1 ORDER BY client_id")
            .unwrap();
        statement
            .query_map([poa_id], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<String>, _>>()
            .unwrap()
    }

    #[test]
    fn resaving_an_unchanged_client_set_keeps_associations_a_case_relies_on() {
        let (connection, poa_id, first, second) = poa_relied_on_by_a_case();

        replace_clients(
            &connection,
            &poa_id,
            &[second.clone(), first.clone()],
            "second-save",
        )
        .unwrap();

        let mut expected = vec![first, second];
        expected.sort();
        assert_eq!(linked_clients(&connection, &poa_id), expected);
        let still_referenced: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM case_clients WHERE power_of_attorney_id = ?1",
                [&poa_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(still_referenced, 1);
        let created_at: String = connection
            .query_row(
                "SELECT created_at FROM power_of_attorney_clients WHERE power_of_attorney_id = ?1 LIMIT 1",
                [&poa_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            created_at, "first-save",
            "unchanged links are not rewritten"
        );
    }

    #[test]
    fn adding_a_client_keeps_the_associations_a_case_relies_on() {
        let (connection, poa_id, first, second) = poa_relied_on_by_a_case();
        let third = id();
        connection.execute("INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, 'CL-3', 'منى', 'now', 'now')", [&third]).unwrap();

        replace_clients(
            &connection,
            &poa_id,
            &[first.clone(), second.clone(), third.clone()],
            "second-save",
        )
        .unwrap();

        let mut expected = vec![first, second, third];
        expected.sort();
        assert_eq!(linked_clients(&connection, &poa_id), expected);
    }

    #[test]
    fn removing_an_unreferenced_client_is_allowed() {
        let (connection, poa_id, first, second) = poa_relied_on_by_a_case();

        replace_clients(
            &connection,
            &poa_id,
            std::slice::from_ref(&first),
            "second-save",
        )
        .unwrap();

        assert_eq!(linked_clients(&connection, &poa_id), vec![first]);
        assert!(!linked_clients(&connection, &poa_id).contains(&second));
    }

    #[test]
    fn refusing_to_remove_a_client_a_case_relies_on_changes_nothing() {
        let (connection, poa_id, first, second) = poa_relied_on_by_a_case();
        let before = linked_clients(&connection, &poa_id);

        // Removing both: the unreferenced removal must not be applied on its own.
        let result = replace_clients(&connection, &poa_id, &[], "second-save");
        assert!(matches!(result, Err(Error::PowerOfAttorneyClientInUse)));
        assert_eq!(linked_clients(&connection, &poa_id), before);

        let result = replace_clients(&connection, &poa_id, std::slice::from_ref(&second), "x");
        assert!(matches!(result, Err(Error::PowerOfAttorneyClientInUse)));
        assert_eq!(linked_clients(&connection, &poa_id), before);
        assert!(before.contains(&first) && before.contains(&second));
    }
}
