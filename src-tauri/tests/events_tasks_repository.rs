use legalmaster_lib::{db, security};
use rusqlite::Connection;
fn conn() -> (tempfile::TempDir, Connection) {
    let dir = tempfile::tempdir().unwrap();
    let c = db::create_db(&dir.path().join("vault.sqlite"), &security::random_32()).unwrap();
    db::migrate(&c).unwrap();
    (dir, c)
}
#[test]
fn canonical_task_rejects_invalid_completion_state() {
    let (_dir, c) = conn();
    let id = uuid::Uuid::new_v4().to_string();
    assert!(c.execute("INSERT INTO tasks (id, title, due_date, completed, completed_at, created_at, updated_at) VALUES (?1, 'مهمة', '2026-08-24', 0, 'done', 'now', 'now')", [&id]).is_err());
    c.execute("INSERT INTO tasks (id, title, due_date, completed, completed_at, created_at, updated_at) VALUES (?1, 'مهمة', '2026-08-24', 1, 'done', 'now', 'now')", [&id]).unwrap();
}
#[test]
fn attachment_requires_one_owner_and_managed_metadata() {
    let (_dir, c) = conn();
    let id = uuid::Uuid::new_v4().to_string();
    assert!(c.execute("INSERT INTO attachments (id, original_filename, stored_filename, relative_path, file_size_bytes, sha256, category, created_at, updated_at) VALUES (?1, 'x.pdf', 'x.pdf', 'x.pdf', 1, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'OTHER', 'now', 'now')", [&id]).is_err());
}
