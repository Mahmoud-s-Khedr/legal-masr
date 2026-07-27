PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  installation_uuid TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spike_records (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
