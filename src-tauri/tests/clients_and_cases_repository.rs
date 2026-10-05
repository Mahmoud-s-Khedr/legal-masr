use legalmaster_lib::{
    db,
    dto::{CaseClientInput, CaseDto},
    errors::Error,
    repositories::{case_repository, power_of_attorney_repository},
    security,
};
use rusqlite::{params, Connection};
use uuid::Uuid;

fn open_migrated_test_db() -> (tempfile::TempDir, Connection) {
    let dir = tempfile::tempdir().unwrap();
    let master = security::random_32();
    let conn = db::open_db(&dir.path().join("legalmaster.sqlite"), &master).unwrap();
    db::migrate(&conn).unwrap();
    (dir, conn)
}

fn id() -> String {
    Uuid::new_v4().to_string()
}

fn seed_client(conn: &Connection, internal_number: &str, full_name: &str) -> String {
    let client_id = id();
    conn.execute(
        "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')",
        params![client_id, internal_number, full_name],
    )
    .unwrap();
    client_id
}

fn canonical_case(case_id: String, internal_number: &str) -> CaseDto {
    CaseDto {
        id: case_id,
        internal_number: internal_number.into(),
        official_number: Some("42".into()),
        official_year: Some(2026),
        case_type: Some("مدني".into()),
        litigation_degree: Some("FIRST_INSTANCE".into()),
        court_name: Some("محكمة القاهرة".into()),
        circuit_name: None,
        status: "ACTIVE".into(),
        filed_on: Some("2026-08-24".into()),
        closed_on: None,
        subject: Some("نزاع تعاقدي".into()),
        notes: None,
        archived_at: None,
        created_at: "now".into(),
        updated_at: "now".into(),
        clients: vec![],
        opponents: vec![],
    }
}

#[test]
fn case_round_trips_internal_official_numbers_client_capacity_poa_and_opponents() {
    let (_dir, conn) = open_migrated_test_db();
    let first_client = seed_client(&conn, "CL-1", "أحمد");
    let second_client = seed_client(&conn, "CL-2", "سارة");
    let poa_id = id();
    let case_id = id();
    conn.execute(
        "INSERT INTO powers_of_attorney (id, internal_sequence, created_at, updated_at) VALUES (?1, 'TA-1', 'now', 'now')",
        [&poa_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')",
        params![poa_id, first_client],
    )
    .unwrap();
    case_repository::insert(&conn, &canonical_case(case_id.clone(), "CA-1")).unwrap();
    case_repository::replace_clients(
        &conn,
        &case_id,
        &[
            CaseClientInput {
                client_id: first_client,
                legal_capacity: Some("مدعٍ".into()),
                power_of_attorney_id: Some(poa_id),
                notes: Some("بموجب توكيل".into()),
            },
            CaseClientInput {
                client_id: second_client,
                legal_capacity: Some("متدخل".into()),
                power_of_attorney_id: None,
                notes: None,
            },
        ],
        "now",
    )
    .unwrap();
    let opponent_id = id();
    case_repository::insert_opponent(
        &conn,
        &opponent_id,
        &case_id,
        "الخصم",
        Some("مدعى عليه"),
        Some("محاميه"),
        None,
        None,
        None,
        "now",
    )
    .unwrap();

    let saved =
        case_repository::hydrate(&conn, case_repository::get(&conn, &case_id).unwrap()).unwrap();
    assert_eq!(saved.internal_number, "CA-1");
    assert_eq!(saved.official_number.as_deref(), Some("42"));
    assert_eq!(saved.clients.len(), 2);
    assert_eq!(saved.clients[0].legal_capacity.as_deref(), Some("مدعٍ"));
    assert_eq!(saved.opponents[0].full_name, "الخصم");
    assert_eq!(
        case_repository::list(&conn, Some("42"), None, None, false).unwrap()[0].id,
        case_id
    );
}

#[test]
fn case_repository_rejects_a_poa_for_another_client_and_missing_cases() {
    let (_dir, conn) = open_migrated_test_db();
    let poa_client = seed_client(&conn, "CL-1", "أحمد");
    let linked_client = seed_client(&conn, "CL-2", "سارة");
    let poa_id = id();
    let case_id = id();
    conn.execute(
        "INSERT INTO powers_of_attorney (id, internal_sequence, created_at, updated_at) VALUES (?1, 'TA-1', 'now', 'now')",
        [&poa_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')",
        params![poa_id, poa_client],
    )
    .unwrap();
    case_repository::insert(&conn, &canonical_case(case_id.clone(), "CA-1")).unwrap();

    let result = case_repository::replace_clients(
        &conn,
        &case_id,
        &[CaseClientInput {
            client_id: linked_client,
            legal_capacity: None,
            power_of_attorney_id: Some(poa_id),
            notes: None,
        }],
        "now",
    );
    assert!(
        result.is_err(),
        "the composite foreign key must enforce POA ownership"
    );
    assert!(matches!(
        case_repository::get(&conn, "missing"),
        Err(Error::CaseNotFound)
    ));
}

fn seed_poa(conn: &Connection, sequence: &str, client_id: &str, archived: bool) -> String {
    let poa_id = id();
    conn.execute(
        "INSERT INTO powers_of_attorney (id, internal_sequence, archived_at, created_at, updated_at) VALUES (?1, ?2, ?3, 'now', 'now')",
        params![poa_id, sequence, archived.then_some("now")],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')",
        params![poa_id, client_id],
    )
    .unwrap();
    poa_id
}

#[test]
fn power_of_attorney_list_filters_by_client_identity_not_name() {
    let (_dir, conn) = open_migrated_test_db();
    let first = seed_client(&conn, "CL-1", "محمد علي");
    let namesake = seed_client(&conn, "CL-2", "محمد علي");
    let first_poa = seed_poa(&conn, "TA-1", &first, false);
    let namesake_poa = seed_poa(&conn, "TA-2", &namesake, false);
    let archived_poa = seed_poa(&conn, "TA-3", &first, true);

    let ids = |client: Option<&str>, archived: bool| {
        power_of_attorney_repository::list(&conn, None, archived, client)
            .unwrap()
            .into_iter()
            .map(|poa| poa.id)
            .collect::<Vec<_>>()
    };
    assert_eq!(ids(Some(&first), false), vec![first_poa.clone()]);
    assert_eq!(ids(Some(&namesake), false), vec![namesake_poa.clone()]);
    assert_eq!(ids(Some(&first), true), vec![first_poa, archived_poa]);
    assert!(ids(Some("missing-client"), true).is_empty());
    assert_eq!(ids(None, false).len(), 2);
}
