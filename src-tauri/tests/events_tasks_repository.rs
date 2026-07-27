use legalmaster_lib::{db, security};

fn database() -> (tempfile::TempDir, rusqlite::Connection) {
    let dir = tempfile::tempdir().unwrap();
    let connection = db::open_db(&dir.path().join("test.sqlite"), &security::random_32()).unwrap();
    db::migrate(&connection).unwrap();
    (dir, connection)
}

#[test]
fn event_rejects_an_end_time_before_its_start_time() {
    let (_dir, connection) = database();
    let result = connection.execute(
        "INSERT INTO case_events (id,event_type,title,event_date,start_time,end_time,is_all_day,status,created_at,updated_at) VALUES ('event','HEARING','جلسة','2026-07-27','14:00','10:00',0,'SCHEDULED','now','now')",
        [],
    );
    assert!(result.is_err());
}

#[test]
fn task_status_and_completion_timestamp_are_persisted_without_timezone_dates() {
    let (_dir, connection) = database();
    connection.execute("INSERT INTO tasks (id,title,due_date,priority,status,created_at,updated_at) VALUES ('task','مراجعة','2026-07-27','HIGH','OPEN','now','now')", []).unwrap();
    connection.execute("UPDATE tasks SET status='COMPLETED',completed_at='2026-07-27T10:00:00Z' WHERE id='task'", []).unwrap();
    let (due_date, status): (String, String) = connection
        .query_row(
            "SELECT due_date,status FROM tasks WHERE id='task'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(due_date, "2026-07-27");
    assert_eq!(status, "COMPLETED");
}

#[test]
fn managed_document_requires_a_relative_path_and_external_document_requires_an_external_path() {
    let (_dir, connection) = database();
    assert!(connection.execute("INSERT INTO documents (id,storage_mode,original_filename,category,created_at,updated_at) VALUES ('bad','MANAGED_COPY','x.pdf','OTHER','now','now')", []).is_err());
    assert!(connection.execute("INSERT INTO documents (id,storage_mode,original_filename,external_path,category,created_at,updated_at) VALUES ('external','EXTERNAL_REFERENCE','x.pdf','/tmp/x.pdf','OTHER','now','now')", []).is_ok());
}
