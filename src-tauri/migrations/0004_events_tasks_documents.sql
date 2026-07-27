CREATE TABLE case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('HEARING','EXPERT_SESSION','PROSECUTION_APPOINTMENT','INVESTIGATION','ENFORCEMENT_PROCEDURE','ADMINISTRATIVE_APPOINTMENT','CLIENT_APPOINTMENT','DEADLINE','OTHER')),
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_all_day INTEGER NOT NULL DEFAULT 1 CHECK (is_all_day IN (0,1)),
  location TEXT,
  circuit_name TEXT,
  preparation_notes TEXT,
  required_documents TEXT,
  outcome TEXT,
  decision_text TEXT,
  next_action TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED')),
  reminder_config_json TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);
CREATE INDEX idx_case_events_date ON case_events(event_date);
CREATE INDEX idx_case_events_case_date ON case_events(case_id, event_date);
CREATE INDEX idx_case_events_client_date ON case_events(client_id, event_date);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  source_event_id TEXT REFERENCES case_events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COMPLETED','CANCELLED')),
  reminder_config_json TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status_due_date ON tasks(status, due_date);
CREATE INDEX idx_tasks_case_id ON tasks(case_id);
CREATE INDEX idx_tasks_client_id ON tasks(client_id);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  storage_mode TEXT NOT NULL CHECK (storage_mode IN ('MANAGED_COPY','EXTERNAL_REFERENCE')),
  original_filename TEXT NOT NULL,
  stored_filename TEXT,
  relative_path TEXT,
  external_path TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  sha256 TEXT,
  category TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('PLEADING','COURT_DECISION','EVIDENCE','CONTRACT','POWER_OF_ATTORNEY','IDENTIFICATION','RECEIPT','CORRESPONDENCE','OTHER')),
  description TEXT,
  document_date TEXT,
  missing_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((storage_mode = 'MANAGED_COPY' AND relative_path IS NOT NULL AND external_path IS NULL) OR (storage_mode = 'EXTERNAL_REFERENCE' AND external_path IS NOT NULL AND relative_path IS NULL))
);
CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_archived_at ON documents(archived_at);

CREATE TABLE activity_history (
  id TEXT PRIMARY KEY,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  safe_description TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_activity_history_created_at ON activity_history(created_at DESC);

ALTER TABLE app_settings ADD COLUMN default_calendar_view TEXT NOT NULL DEFAULT 'MONTH';
ALTER TABLE app_settings ADD COLUMN autostart_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN minimize_to_tray INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN notification_privacy TEXT NOT NULL DEFAULT 'SAFE';
