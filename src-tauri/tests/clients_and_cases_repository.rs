use legalmaster_lib::{
    db,
    dto::{CaseListInput, ClientCreateInput, ClientListInput, ClientUpdateInput},
    errors::Error,
    repositories::{case_repository, client_repository},
    security,
};
use rusqlite::Connection;

fn open_migrated_test_db() -> (tempfile::TempDir, Connection, [u8; 32]) {
    let dir = tempfile::tempdir().unwrap();
    let master = security::random_32();
    let conn = db::open_db(&dir.path().join("legalmaster.sqlite"), &master).unwrap();
    db::migrate(&conn).unwrap();
    (dir, conn, master)
}

fn seed_client(conn: &Connection, display_name: &str, phone: Option<&str>) -> String {
    let id = uuid::Uuid::new_v4().to_string();
    let now = db::now();
    client_repository::insert(
        conn,
        &id,
        "INDIVIDUAL",
        display_name,
        None,
        None,
        phone,
        phone
            .map(legalmaster_lib::normalize::normalize_phone)
            .as_deref(),
        None,
        None,
        None,
        &now,
    )
    .unwrap();
    id
}

fn seed_case(conn: &Connection, case_number: &str, client_ids: &[&str], primary: &str) -> String {
    let id = uuid::Uuid::new_v4().to_string();
    let now = db::now();
    case_repository::insert_case(
        conn,
        &id,
        case_number,
        None,
        None,
        None,
        None,
        None,
        "ACTIVE",
        None,
        None,
        None,
        &now,
    )
    .unwrap();
    for client_id in client_ids {
        case_repository::attach_client(conn, &id, client_id, &now).unwrap();
    }
    case_repository::set_primary_client(conn, &id, primary).unwrap();
    id
}

#[test]
fn client_round_trips_optional_fields_and_updates() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let id = seed_client(&conn, "أحمد علي", Some("0100 000 0001"));
    let client = client_repository::find_by_id(&conn, &id).unwrap();
    assert_eq!(client.display_name, "أحمد علي");
    assert_eq!(client.primary_phone.as_deref(), Some("0100 000 0001"));
    assert!(client.national_id.is_none());

    client_repository::update(
        &conn,
        &id,
        "أحمد علي المحدث",
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        &db::now(),
    )
    .unwrap();
    let updated = client_repository::find_by_id(&conn, &id).unwrap();
    assert_eq!(updated.display_name, "أحمد علي المحدث");
    assert!(updated.primary_phone.is_none());
}

#[test]
fn client_update_of_missing_id_returns_not_found() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let result = client_repository::update(
        &conn,
        "missing-id",
        "x",
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        &db::now(),
    );
    assert!(matches!(result, Err(Error::ClientNotFound)));
}

#[test]
fn duplicate_detection_matches_phone_or_name_and_ignores_others() {
    let (_dir, conn, _master) = open_migrated_test_db();
    seed_client(&conn, "محمد سعيد", Some("01011112222"));
    seed_client(&conn, "غير ذلك", Some("01099998888"));

    let by_phone =
        client_repository::find_probable_duplicates(&conn, Some("01011112222"), "اسم مختلف")
            .unwrap();
    assert_eq!(by_phone.len(), 1);

    let by_name =
        client_repository::find_probable_duplicates(&conn, Some("00000000000"), "محمد سعيد")
            .unwrap();
    assert_eq!(by_name.len(), 1);

    let none =
        client_repository::find_probable_duplicates(&conn, Some("00000000000"), "لا يوجد تطابق")
            .unwrap();
    assert!(none.is_empty());
}

#[test]
fn archived_clients_are_excluded_by_default_and_included_when_requested() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let id = seed_client(&conn, "زينب", None);
    client_repository::set_archived(&conn, &id, true, &db::now()).unwrap();

    let default_list = client_repository::list(&conn, None, false).unwrap();
    assert!(default_list.iter().all(|c| c.id != id));

    let with_archived = client_repository::list(&conn, None, true).unwrap();
    assert!(with_archived.iter().any(|c| c.id == id));

    let client = client_repository::find_by_id(&conn, &id).unwrap();
    assert!(client.archived_at.is_some());
}

#[test]
fn case_clients_join_table_populates_on_case_create_with_multiple_clients() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let client_a = seed_client(&conn, "الموكل الأول", None);
    let client_b = seed_client(&conn, "الموكل الثاني", None);
    let case_id = seed_case(
        &conn,
        "100/2026",
        &[client_a.as_str(), client_b.as_str()],
        &client_a,
    );

    let case = case_repository::find_case_by_id(&conn, &case_id).unwrap();
    assert_eq!(case.case_number, "100/2026");
    assert!(!case.id.is_empty());

    let clients = case_repository::list_clients_for_case(&conn, &case_id).unwrap();
    assert_eq!(clients.len(), 2);
    let primary_count = clients.iter().filter(|c| c.is_primary).count();
    assert_eq!(primary_count, 1);
    assert!(
        clients
            .iter()
            .find(|c| c.client_id == client_a)
            .unwrap()
            .is_primary
    );
}

#[test]
fn case_clients_foreign_key_violations_are_rejected() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let case_id = uuid::Uuid::new_v4().to_string();
    case_repository::insert_case(
        &conn,
        &case_id,
        "1/2026",
        None,
        None,
        None,
        None,
        None,
        "ACTIVE",
        None,
        None,
        None,
        &db::now(),
    )
    .unwrap();
    let result = case_repository::attach_client(&conn, &case_id, "nonexistent-client", &db::now());
    assert!(result.is_err());
}

#[test]
fn only_one_primary_client_per_case_is_allowed_by_the_partial_unique_index() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let client_a = seed_client(&conn, "أ", None);
    let client_b = seed_client(&conn, "ب", None);
    let case_id = uuid::Uuid::new_v4().to_string();
    let now = db::now();
    case_repository::insert_case(
        &conn, &case_id, "2/2026", None, None, None, None, None, "ACTIVE", None, None, None, &now,
    )
    .unwrap();
    case_repository::attach_client(&conn, &case_id, &client_a, &now).unwrap();
    case_repository::attach_client(&conn, &case_id, &client_b, &now).unwrap();

    conn.execute(
        "UPDATE case_clients SET is_primary = 1 WHERE case_id = ?1 AND client_id = ?2",
        rusqlite::params![case_id, client_a],
    )
    .unwrap();
    let direct_second_primary = conn.execute(
        "UPDATE case_clients SET is_primary = 1 WHERE case_id = ?1 AND client_id = ?2",
        rusqlite::params![case_id, client_b],
    );
    assert!(
        direct_second_primary.is_err(),
        "two primaries on one case must violate the partial unique index"
    );

    case_repository::clear_primary_client(&conn, &case_id).unwrap();
    case_repository::set_primary_client(&conn, &case_id, &client_b).unwrap();
    let clients = case_repository::list_clients_for_case(&conn, &case_id).unwrap();
    assert!(
        clients
            .iter()
            .find(|c| c.client_id == client_b)
            .unwrap()
            .is_primary
    );
    assert!(
        !clients
            .iter()
            .find(|c| c.client_id == client_a)
            .unwrap()
            .is_primary
    );
}

#[test]
fn client_deletion_is_restricted_while_linked_to_a_case() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let client_id = seed_client(&conn, "موكل مرتبط", None);
    seed_case(&conn, "3/2026", &[client_id.as_str()], &client_id);

    let result = conn.execute("DELETE FROM clients WHERE id = ?1", [&client_id]);
    assert!(
        result.is_err(),
        "ON DELETE RESTRICT must block deleting a client linked to a case"
    );
}

#[test]
fn case_list_filters_by_status_client_and_archived_state() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let client_a = seed_client(&conn, "أ", None);
    let client_b = seed_client(&conn, "ب", None);
    seed_case(&conn, "4/2026", &[client_a.as_str()], &client_a);
    let case_b = seed_case(&conn, "5/2026", &[client_b.as_str()], &client_b);
    case_repository::set_archived(&conn, &case_b, true, &db::now()).unwrap();

    let all_active = case_repository::list_summaries(&conn, None, None, None, false).unwrap();
    assert_eq!(all_active.len(), 1);

    let with_archived = case_repository::list_summaries(&conn, None, None, None, true).unwrap();
    assert_eq!(with_archived.len(), 2);

    let for_client_a =
        case_repository::list_summaries(&conn, None, None, Some(client_a.as_str()), true).unwrap();
    assert_eq!(for_client_a.len(), 1);
    assert_eq!(for_client_a[0].case_number, "4/2026");
}

#[test]
fn detach_guard_state_is_derivable_from_repository_primitives() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let client_a = seed_client(&conn, "أ", None);
    let client_b = seed_client(&conn, "ب", None);
    let case_id = seed_case(&conn, "7/2026", &[client_a.as_str()], &client_a);

    let total = case_repository::count_clients_for_case(&conn, &case_id).unwrap();
    assert_eq!(
        total, 1,
        "detaching the only client must be blocked by the service layer"
    );

    case_repository::attach_client(&conn, &case_id, &client_b, &db::now()).unwrap();
    assert!(case_repository::is_client_primary(&conn, &case_id, &client_a).unwrap());
    assert!(
        !case_repository::is_client_primary(&conn, &case_id, &client_b).unwrap(),
        "detaching a non-primary client with others remaining must be allowed"
    );
}

#[test]
fn search_index_is_updated_within_the_same_transaction_as_a_write() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let id = seed_client(&conn, "بحث الفهرس", None);
    let now = db::now();
    legalmaster_lib::repositories::search_repository::upsert(
        &conn,
        "client",
        &id,
        "بحث الفهرس",
        None,
        &legalmaster_lib::normalize::normalize_text("بحث الفهرس"),
        &now,
    )
    .unwrap();
    let hits = legalmaster_lib::repositories::search_repository::search(&conn, "بحث").unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].entity_id, id);
}

#[test]
fn case_party_can_be_added_updated_and_removed() {
    let (_dir, conn, _master) = open_migrated_test_db();
    let client_id = seed_client(&conn, "موكل", None);
    let case_id = seed_case(&conn, "8/2026", &[client_id.as_str()], &client_id);

    let party_id = uuid::Uuid::new_v4().to_string();
    case_repository::insert_party(
        &conn,
        &party_id,
        &case_id,
        "OPPONENT",
        "الخصم",
        None,
        None,
        None,
        &db::now(),
    )
    .unwrap();
    let parties = case_repository::list_parties_for_case(&conn, &case_id).unwrap();
    assert_eq!(parties.len(), 1);
    assert_eq!(parties[0].role, "OPPONENT");

    case_repository::update_party(
        &conn,
        &party_id,
        "WITNESS",
        "شاهد",
        None,
        None,
        None,
        &db::now(),
    )
    .unwrap();
    let updated = case_repository::list_parties_for_case(&conn, &case_id).unwrap();
    assert_eq!(updated[0].role, "WITNESS");

    case_repository::delete_party(&conn, &party_id).unwrap();
    let after_delete = case_repository::list_parties_for_case(&conn, &case_id).unwrap();
    assert!(after_delete.is_empty());
}

#[test]
fn client_list_input_and_case_list_input_deserialize_from_camel_case_json() {
    let client_input: ClientListInput =
        serde_json::from_str(r#"{"query":"a","includeArchived":true}"#).unwrap();
    assert_eq!(client_input.query.as_deref(), Some("a"));
    assert!(client_input.include_archived);

    let case_input: CaseListInput = serde_json::from_str(r#"{"clientId":"abc"}"#).unwrap();
    assert_eq!(case_input.client_id.as_deref(), Some("abc"));
    assert!(!case_input.include_archived);
}

#[test]
fn client_create_and_update_inputs_deserialize_from_camel_case_json() {
    let create: ClientCreateInput = serde_json::from_str(
        r#"{"clientType":"INDIVIDUAL","displayName":"test","confirmDuplicate":true}"#,
    )
    .unwrap();
    assert_eq!(create.client_type, "INDIVIDUAL");
    assert!(create.confirm_duplicate);

    let update: ClientUpdateInput =
        serde_json::from_str(r#"{"id":"x","displayName":"updated"}"#).unwrap();
    assert_eq!(update.display_name, "updated");
}
