//! Consistency rules between cases, clients, tasks, expenses and powers of attorney:
//! - a task/expense is linked to a case OR a client, never both (the client is known through the case);
//! - a client has at most one active power of attorney;
//! - a case's power of attorney is derived from its client, never picked per case.
use legalmaster_lib::{
    db,
    repositories::{
        case_repository, finance_repository, power_of_attorney_repository, task_repository,
    },
    security,
};
use rusqlite::Connection;
use uuid::Uuid;

fn conn() -> (tempfile::TempDir, Connection) {
    let dir = tempfile::tempdir().unwrap();
    let c = db::create_db(&dir.path().join("vault.sqlite"), &security::random_32()).unwrap();
    db::migrate(&c).unwrap();
    (dir, c)
}

fn id() -> String {
    Uuid::new_v4().to_string()
}

fn client(c: &Connection, number: &str) -> String {
    let id = id();
    c.execute(
        "INSERT INTO clients (id, internal_number, full_name, created_at, updated_at) VALUES (?1, ?2, ?2, 'now', 'now')",
        [&id, number],
    )
    .unwrap();
    id
}

fn case_for(c: &Connection, number: &str, client_id: &str) -> String {
    let id = id();
    c.execute(
        "INSERT INTO cases (id, internal_number, status, created_at, updated_at) VALUES (?1, ?2, 'ACTIVE', 'now', 'now')",
        [&id, number],
    )
    .unwrap();
    c.execute(
        "INSERT INTO case_clients (case_id, client_id, created_at, updated_at) VALUES (?1, ?2, 'now', 'now')",
        [&id, client_id],
    )
    .unwrap();
    id
}

fn poa(c: &Connection, sequence: &str, created_at: &str, archived: bool) -> String {
    let id = id();
    c.execute(
        "INSERT INTO powers_of_attorney (id, internal_sequence, archived_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        rusqlite::params![id, sequence, archived.then_some("2026-01-01T00:00:00Z"), created_at],
    )
    .unwrap();
    id
}

fn link_poa(c: &Connection, poa_id: &str, client_id: &str) -> rusqlite::Result<usize> {
    c.execute(
        "INSERT INTO power_of_attorney_clients (power_of_attorney_id, client_id, created_at) VALUES (?1, ?2, 'now')",
        [poa_id, client_id],
    )
}

fn insert_task(
    c: &Connection,
    case_id: Option<&str>,
    client_id: Option<&str>,
) -> rusqlite::Result<usize> {
    c.execute(
        "INSERT INTO tasks (id, case_id, client_id, title, due_date, created_at, updated_at) VALUES (?1, ?2, ?3, 'مهمة', '2026-10-13', 'now', 'now')",
        rusqlite::params![id(), case_id, client_id],
    )
}

fn insert_expense(
    c: &Connection,
    case_id: Option<&str>,
    client_id: Option<&str>,
) -> rusqlite::Result<usize> {
    c.execute(
        "INSERT INTO expenses (id, case_id, client_id, amount_minor, expense_date, expense_type, created_at, updated_at) VALUES (?1, ?2, ?3, 500, '2026-10-13', 'OTHER', 'now', 'now')",
        rusqlite::params![id(), case_id, client_id],
    )
}

// ---- task / expense: case OR client ----

#[test]
fn task_links_a_case_or_a_client_or_neither() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    insert_task(&c, Some(&case_id), None).unwrap();
    insert_task(&c, None, Some(&owner)).unwrap();
    insert_task(&c, None, None).unwrap();
}

#[test]
fn task_cannot_link_a_case_and_a_client_together() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let other = client(&c, "2");
    let case_id = case_for(&c, "1", &owner);
    // The screenshot case: client «2» is not on case «1» at all.
    assert!(insert_task(&c, Some(&case_id), Some(&other)).is_err());
    // Even the case's own client is redundant: the case already knows it.
    assert!(insert_task(&c, Some(&case_id), Some(&owner)).is_err());
}

#[test]
fn task_update_cannot_add_a_client_to_a_case_task() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    insert_task(&c, Some(&case_id), None).unwrap();
    assert!(c
        .execute("UPDATE tasks SET client_id = ?1", [&owner])
        .is_err());
}

#[test]
fn expense_links_a_case_or_a_client_or_neither() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    insert_expense(&c, Some(&case_id), None).unwrap();
    insert_expense(&c, None, Some(&owner)).unwrap();
    insert_expense(&c, None, None).unwrap();
}

#[test]
fn expense_cannot_link_a_case_and_a_client_together() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let other = client(&c, "2");
    let case_id = case_for(&c, "1", &owner);
    assert!(insert_expense(&c, Some(&case_id), Some(&other)).is_err());
    assert!(insert_expense(&c, Some(&case_id), Some(&owner)).is_err());
}

// ---- the client view derives case work ----

#[test]
fn client_task_list_includes_tasks_of_the_clients_cases() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let other = client(&c, "2");
    let case_id = case_for(&c, "1", &owner);
    let other_case = case_for(&c, "2", &other);
    insert_task(&c, Some(&case_id), None).unwrap(); // reached through the case
    insert_task(&c, None, Some(&owner)).unwrap(); // direct
    insert_task(&c, Some(&other_case), None).unwrap(); // someone else's
    let tasks = task_repository::list(&c, Some("ALL"), "2026-10-13", None, Some(&owner)).unwrap();
    assert_eq!(tasks.len(), 2);
}

#[test]
fn client_finance_summary_includes_expenses_of_the_clients_cases() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let other = client(&c, "2");
    let case_id = case_for(&c, "1", &owner);
    let other_case = case_for(&c, "2", &other);
    insert_expense(&c, Some(&case_id), None).unwrap();
    insert_expense(&c, None, Some(&owner)).unwrap();
    insert_expense(&c, Some(&other_case), None).unwrap();
    assert_eq!(
        finance_repository::client_summary(&c, &owner)
            .unwrap()
            .expenses_minor,
        1000
    );
    let listed = finance_repository::list_expenses(&c, Some(&owner), None, None, None).unwrap();
    assert_eq!(listed.len(), 2);
}

// ---- one active POA per client ----

#[test]
fn client_cannot_hold_two_active_powers_of_attorney() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let first = poa(&c, "1", "a", false);
    let second = poa(&c, "2", "b", false);
    link_poa(&c, &first, &owner).unwrap();
    assert!(link_poa(&c, &second, &owner).is_err());
}

#[test]
fn a_poa_may_have_several_clients() {
    let (_d, c) = conn();
    let (a, b) = (client(&c, "1"), client(&c, "2"));
    let shared = poa(&c, "1", "a", false);
    link_poa(&c, &shared, &a).unwrap();
    link_poa(&c, &shared, &b).unwrap();
}

#[test]
fn client_gets_a_new_poa_once_the_old_one_is_archived() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let old = poa(&c, "1", "a", true);
    link_poa(&c, &old, &owner).unwrap();
    let new = poa(&c, "2", "b", false);
    link_poa(&c, &new, &owner).unwrap();
}

#[test]
fn restoring_an_archived_poa_is_refused_while_its_client_has_another_active_one() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let old = poa(&c, "1", "a", true);
    link_poa(&c, &old, &owner).unwrap();
    let new = poa(&c, "2", "b", false);
    link_poa(&c, &new, &owner).unwrap();
    assert!(c
        .execute(
            "UPDATE powers_of_attorney SET archived_at = NULL WHERE id = ?1",
            [&old]
        )
        .is_err());
}

// ---- POA <-> case is derived ----

fn hydrated_case(c: &Connection, case_id: &str) -> legalmaster_lib::dto::CaseDto {
    case_repository::hydrate(c, case_repository::get(c, case_id).unwrap()).unwrap()
}

fn hydrated_poa(c: &Connection, poa_id: &str) -> legalmaster_lib::dto::PowerOfAttorneyDto {
    power_of_attorney_repository::hydrate(c, power_of_attorney_repository::get(c, poa_id).unwrap())
        .unwrap()
}

#[test]
fn poa_lists_the_cases_of_its_clients_without_any_manual_pointer() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    let power = poa(&c, "1", "a", false);
    link_poa(&c, &power, &owner).unwrap();
    assert_eq!(hydrated_poa(&c, &power).case_ids, vec![case_id]);
}

#[test]
fn case_shows_its_clients_poa_without_any_manual_pointer() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    let power = poa(&c, "1", "a", false);
    link_poa(&c, &power, &owner).unwrap();
    let case = hydrated_case(&c, &case_id);
    assert_eq!(
        case.clients[0].power_of_attorney_id.as_deref(),
        Some(power.as_str())
    );
}

#[test]
fn case_shows_no_poa_when_its_client_has_none() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    assert_eq!(
        hydrated_case(&c, &case_id).clients[0].power_of_attorney_id,
        None
    );
}

#[test]
fn case_still_shows_an_archived_poa_when_it_is_the_clients_only_one() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    let old = poa(&c, "1", "a", true);
    link_poa(&c, &old, &owner).unwrap();
    let case = hydrated_case(&c, &case_id);
    assert_eq!(
        case.clients[0].power_of_attorney_id.as_deref(),
        Some(old.as_str())
    );
}

#[test]
fn case_prefers_the_active_poa_over_an_archived_one() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    let old = poa(&c, "1", "a", true);
    link_poa(&c, &old, &owner).unwrap();
    let current = poa(&c, "2", "b", false);
    link_poa(&c, &current, &owner).unwrap();
    let case = hydrated_case(&c, &case_id);
    assert_eq!(
        case.clients[0].power_of_attorney_id.as_deref(),
        Some(current.as_str())
    );
    // The archived POA no longer claims the case.
    assert!(hydrated_poa(&c, &old).case_ids.is_empty());
    assert_eq!(hydrated_poa(&c, &current).case_ids, vec![case_id]);
}

#[test]
fn the_per_case_poa_pointer_is_retired() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    let power = poa(&c, "1", "a", false);
    link_poa(&c, &power, &owner).unwrap();
    assert!(c
        .execute(
            "UPDATE case_clients SET power_of_attorney_id = ?1 WHERE case_id = ?2",
            [&power, &case_id],
        )
        .is_err());
}

// ---- typed errors and the upgrade from a 0002 vault ----

#[test]
fn trigger_refusals_surface_as_typed_errors() {
    let (_d, c) = conn();
    let owner = client(&c, "1");
    let case_id = case_for(&c, "1", &owner);
    let error = insert_task(&c, Some(&case_id), Some(&owner)).unwrap_err();
    assert_eq!(
        legalmaster_lib::errors::Error::from(error).code(),
        "LINK_CASE_OR_CLIENT"
    );

    let (first, second) = (poa(&c, "1", "a", false), poa(&c, "2", "b", false));
    link_poa(&c, &first, &owner).unwrap();
    let error = link_poa(&c, &second, &owner).unwrap_err();
    assert_eq!(
        legalmaster_lib::errors::Error::from(error).code(),
        "CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY"
    );
}

#[test]
fn upgrading_a_0002_vault_repairs_links_and_keeps_existing_rows() {
    let dir = tempfile::tempdir().unwrap();
    let c = db::create_db(&dir.path().join("old.sqlite"), &security::random_32()).unwrap();
    // A vault as it was before 0003: only the first two migrations applied.
    c.execute_batch(include_str!("../migrations/0001_canonical_legal_masr.sql"))
        .unwrap();
    c.execute_batch(include_str!("../migrations/0002_case_judicial_year.sql"))
        .unwrap();
    c.execute_batch(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (1, 'now'), (2, 'now');",
    )
    .unwrap();
    let (a, b) = (client(&c, "1"), client(&c, "2"));
    let case_id = case_for(&c, "1", &a);
    let (first, second) = (poa(&c, "1", "a", false), poa(&c, "2", "b", false));
    // Rows the old app allowed: both links on a task/expense, a per-case POA pointer, and two
    // active POAs for one client.
    insert_task(&c, Some(&case_id), Some(&b)).unwrap();
    insert_expense(&c, Some(&case_id), Some(&b)).unwrap();
    link_poa(&c, &first, &a).unwrap();
    link_poa(&c, &second, &a).unwrap();
    c.execute(
        "UPDATE case_clients SET power_of_attorney_id = ?1 WHERE case_id = ?2",
        [&first, &case_id],
    )
    .unwrap();

    db::migrate(&c).unwrap();

    let count = |sql: &str| c.query_row(sql, [], |row| row.get::<_, i64>(0)).unwrap();
    assert_eq!(
        count("SELECT COUNT(*) FROM tasks WHERE client_id IS NOT NULL"),
        0
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM tasks WHERE case_id IS NOT NULL"),
        1
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM expenses WHERE client_id IS NOT NULL"),
        0
    );
    assert_eq!(
        count("SELECT COUNT(*) FROM case_clients WHERE power_of_attorney_id IS NOT NULL"),
        0
    );
    // Nothing was deleted; the duplicate POA link stays until someone edits it, and the case
    // deterministically shows the newest active one.
    assert_eq!(count("SELECT COUNT(*) FROM power_of_attorney_clients"), 2);
    let derived = hydrated_case(&c, &case_id).clients[0]
        .power_of_attorney_id
        .clone();
    assert_eq!(derived.as_deref(), Some(second.as_str()));
}

#[test]
fn poa_list_reports_the_ids_of_its_clients_so_forms_can_tell_who_is_taken() {
    let (_d, c) = conn();
    let (a, b) = (client(&c, "1"), client(&c, "2"));
    let shared = poa(&c, "1", "a", false);
    link_poa(&c, &shared, &a).unwrap();
    link_poa(&c, &shared, &b).unwrap();
    let listed = power_of_attorney_repository::list(&c, None, false, None).unwrap();
    assert_eq!(listed.len(), 1);
    let mut ids = listed[0].client_ids.clone();
    ids.sort();
    let mut expected = vec![a, b];
    expected.sort();
    assert_eq!(ids, expected);
}
