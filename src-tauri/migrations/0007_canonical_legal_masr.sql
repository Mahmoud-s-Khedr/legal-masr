-- The correction-plan compatibility audit found no released vault fixture or
-- distribution history in this repository.  The Rust migration runner refuses
-- a populated legacy vault before reaching this migration; this SQL therefore
-- replaces only the experimental, empty development baseline.

DROP TABLE IF EXISTS reminder_deliveries;
DROP TABLE IF EXISTS financial_transactions;
DROP TABLE IF EXISTS case_fee_agreements;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS case_events;
DROP TABLE IF EXISTS case_parties;
DROP TABLE IF EXISTS case_clients;
DROP TABLE IF EXISTS client_contacts;
DROP TABLE IF EXISTS search_index;
DROP TABLE IF EXISTS activity_history;
DROP TABLE IF EXISTS backup_history;
DROP TABLE IF EXISTS cases;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS lawyer_profile;
DROP TABLE IF EXISTS app_settings;
ALTER TABLE app_metadata RENAME TO legacy_app_metadata;

-- Installation identity only.  schema_migrations is the sole version source.
CREATE TABLE app_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  installation_uuid TEXT NOT NULL CHECK (length(installation_uuid) = 36),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
INSERT INTO app_metadata (id, installation_uuid, created_at, updated_at)
SELECT
  1,
  CASE
    WHEN length(installation_uuid) = 32 THEN
      substr(installation_uuid, 1, 8) || '-' || substr(installation_uuid, 9, 4) || '-' ||
      substr(installation_uuid, 13, 4) || '-' || substr(installation_uuid, 17, 4) || '-' ||
      substr(installation_uuid, 21, 12)
    ELSE lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6)))
  END,
  created_at,
  updated_at
FROM legacy_app_metadata
WHERE id = 1;
INSERT OR IGNORE INTO app_metadata (id, installation_uuid, created_at, updated_at)
VALUES (1, lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE lawyer_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  bar_number TEXT,
  phone TEXT,
  office_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy' CHECK (date_format IN ('dd/MM/yyyy', 'yyyy-MM-dd')),
  week_starts_on INTEGER NOT NULL DEFAULT 6 CHECK (week_starts_on BETWEEN 0 AND 6),
  default_reminder_minutes INTEGER NOT NULL DEFAULT 60 CHECK (default_reminder_minutes BETWEEN 0 AND 10080),
  lock_timeout_minutes INTEGER NOT NULL DEFAULT 15 CHECK (lock_timeout_minutes BETWEEN 1 AND 1440),
  autostart_enabled INTEGER NOT NULL DEFAULT 0 CHECK (autostart_enabled IN (0, 1)),
  usage_counters_enabled INTEGER NOT NULL DEFAULT 0 CHECK (usage_counters_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE clients (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  internal_number TEXT NOT NULL UNIQUE CHECK (length(trim(internal_number)) > 0),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  national_id TEXT,
  primary_phone TEXT,
  normalized_phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_clients_active_internal_number ON clients(internal_number) WHERE archived_at IS NULL;
CREATE INDEX idx_clients_normalized_phone ON clients(normalized_phone);
CREATE INDEX idx_clients_full_name ON clients(full_name);

CREATE TABLE powers_of_attorney (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  internal_sequence TEXT NOT NULL UNIQUE CHECK (length(trim(internal_sequence)) > 0),
  official_number TEXT,
  issue_year INTEGER CHECK (issue_year BETWEEN 1800 AND 9999),
  issue_date TEXT CHECK (issue_date IS NULL OR (length(issue_date) = 10 AND issue_date GLOB '????-??-??')),
  notary_office TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_powers_of_attorney_official_number ON powers_of_attorney(official_number);
CREATE INDEX idx_powers_of_attorney_active_sequence ON powers_of_attorney(internal_sequence) WHERE archived_at IS NULL;

CREATE TABLE power_of_attorney_clients (
  power_of_attorney_id TEXT NOT NULL REFERENCES powers_of_attorney(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (power_of_attorney_id, client_id)
) STRICT;
CREATE INDEX idx_power_of_attorney_clients_client ON power_of_attorney_clients(client_id);

CREATE TABLE power_of_attorney_lawyers (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  power_of_attorney_id TEXT NOT NULL REFERENCES powers_of_attorney(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  bar_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_power_of_attorney_lawyers_poa ON power_of_attorney_lawyers(power_of_attorney_id);

CREATE TABLE cases (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  internal_number TEXT NOT NULL UNIQUE CHECK (length(trim(internal_number)) > 0),
  official_number TEXT,
  official_year INTEGER CHECK (official_year BETWEEN 1800 AND 9999),
  case_type TEXT,
  litigation_degree TEXT CHECK (litigation_degree IS NULL OR litigation_degree IN ('FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'OTHER')),
  court_name TEXT,
  circuit_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  filed_on TEXT CHECK (filed_on IS NULL OR (length(filed_on) = 10 AND filed_on GLOB '????-??-??')),
  closed_on TEXT CHECK (closed_on IS NULL OR (length(closed_on) = 10 AND closed_on GLOB '????-??-??')),
  subject TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_cases_official_number_year ON cases(official_number, official_year);
CREATE INDEX idx_cases_active_internal_number ON cases(internal_number) WHERE archived_at IS NULL;
CREATE INDEX idx_cases_status ON cases(status);

CREATE TABLE case_clients (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  legal_capacity TEXT,
  power_of_attorney_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (case_id, client_id),
  FOREIGN KEY (power_of_attorney_id, client_id)
    REFERENCES power_of_attorney_clients(power_of_attorney_id, client_id)
    ON DELETE RESTRICT
) STRICT;
CREATE INDEX idx_case_clients_client ON case_clients(client_id);
CREATE INDEX idx_case_clients_poa ON case_clients(power_of_attorney_id);

CREATE TABLE case_opponents (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  legal_capacity TEXT,
  lawyer_name TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_case_opponents_case ON case_opponents(case_id);

CREATE TABLE hearings (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  previous_hearing_id TEXT REFERENCES hearings(id) ON DELETE SET NULL,
  hearing_date TEXT NOT NULL CHECK (length(hearing_date) = 10 AND hearing_date GLOB '????-??-??'),
  hearing_time TEXT CHECK (hearing_time IS NULL OR (length(hearing_time) = 5 AND hearing_time GLOB '??:??')),
  hearing_type TEXT,
  location TEXT,
  circuit_name TEXT,
  required_documents TEXT,
  notes TEXT,
  decision_text TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  completed_at TEXT,
  reminder_minutes INTEGER CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 10080),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_hearings_case_date ON hearings(case_id, hearing_date);
CREATE INDEX idx_hearings_date_status ON hearings(hearing_date, status);
CREATE INDEX idx_hearings_previous ON hearings(previous_hearing_id);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  details TEXT,
  notes TEXT,
  due_date TEXT NOT NULL CHECK (length(due_date) = 10 AND due_date GLOB '????-??-??'),
  reminder_minutes INTEGER CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 10080),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((completed = 0 AND completed_at IS NULL) OR (completed = 1 AND completed_at IS NOT NULL))
) STRICT;
CREATE INDEX idx_tasks_due_completed ON tasks(due_date, completed);
CREATE INDEX idx_tasks_case ON tasks(case_id);
CREATE INDEX idx_tasks_client ON tasks(client_id);

CREATE TABLE case_fee_agreements (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  case_id TEXT NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  agreement_date TEXT CHECK (agreement_date IS NULL OR (length(agreement_date) = 10 AND agreement_date GLOB '????-??-??')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  case_id TEXT NOT NULL,
  payer_client_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  payment_date TEXT NOT NULL CHECK (length(payment_date) = 10 AND payment_date GLOB '????-??-??'),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ELECTRONIC', 'OTHER')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (case_id, payer_client_id)
    REFERENCES case_clients(case_id, client_id)
    ON DELETE RESTRICT
) STRICT;
CREATE INDEX idx_payments_case_date ON payments(case_id, payment_date DESC);
CREATE INDEX idx_payments_payer_date ON payments(payer_client_id, payment_date DESC);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  expense_date TEXT NOT NULL CHECK (length(expense_date) = 10 AND expense_date GLOB '????-??-??'),
  expense_type TEXT NOT NULL CHECK (expense_type IN ('COURT_FEE', 'TRANSPORT', 'OFFICE_SUPPLIES', 'EXPERT_FEE', 'OTHER')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_expenses_case_date ON expenses(case_id, expense_date DESC);
CREATE INDEX idx_expenses_client_date ON expenses(client_id, expense_date DESC);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
  power_of_attorney_id TEXT REFERENCES powers_of_attorney(id) ON DELETE CASCADE,
  expense_id TEXT REFERENCES expenses(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL CHECK (length(trim(original_filename)) > 0),
  stored_filename TEXT NOT NULL CHECK (length(trim(stored_filename)) > 0),
  relative_path TEXT NOT NULL CHECK (length(trim(relative_path)) > 0),
  mime_type TEXT,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  category TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('IDENTIFICATION', 'POWER_OF_ATTORNEY', 'CASE_FILE', 'COURT_DECISION', 'EVIDENCE', 'RECEIPT', 'CORRESPONDENCE', 'OTHER')),
  description TEXT,
  document_date TEXT CHECK (document_date IS NULL OR (length(document_date) = 10 AND document_date GLOB '????-??-??')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (client_id IS NOT NULL) + (case_id IS NOT NULL) +
    (power_of_attorney_id IS NOT NULL) + (expense_id IS NOT NULL) = 1
  )
) STRICT;
CREATE INDEX idx_attachments_client ON attachments(client_id);
CREATE INDEX idx_attachments_case ON attachments(case_id);
CREATE INDEX idx_attachments_poa ON attachments(power_of_attorney_id);
CREATE INDEX idx_attachments_expense ON attachments(expense_id);

CREATE TABLE backup_history (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED')),
  archive_size_bytes INTEGER CHECK (archive_size_bytes IS NULL OR archive_size_bytes >= 0),
  error_code TEXT,
  created_at TEXT NOT NULL,
  CHECK ((status = 'RUNNING' AND completed_at IS NULL) OR (status IN ('SUCCEEDED', 'FAILED') AND completed_at IS NOT NULL))
) STRICT;
CREATE INDEX idx_backup_history_completed ON backup_history(completed_at DESC);

CREATE TABLE usage_counters (
  counter_name TEXT PRIMARY KEY NOT NULL CHECK (counter_name IN ('CLIENT_CREATED', 'CASE_CREATED', 'POA_CREATED', 'HEARING_COMPLETED', 'TASK_COMPLETED', 'BACKUP_CREATED')),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE search_index (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('CLIENT', 'CASE', 'POWER_OF_ATTORNEY')),
  entity_id TEXT NOT NULL CHECK (length(entity_id) = 36),
  title TEXT NOT NULL,
  subtitle TEXT,
  normalized_text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
) STRICT;
CREATE INDEX idx_search_index_normalized_prefix ON search_index(normalized_text);

CREATE TABLE reminder_deliveries (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('HEARING', 'TASK')),
  entity_id TEXT NOT NULL CHECK (length(entity_id) = 36),
  reminder_date TEXT NOT NULL CHECK (length(reminder_date) = 10 AND reminder_date GLOB '????-??-??'),
  delivered_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, reminder_date)
) STRICT;
CREATE INDEX idx_reminder_deliveries_date ON reminder_deliveries(reminder_date DESC);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
SELECT 1, created_at FROM app_metadata WHERE id = 1;

DROP TABLE legacy_app_metadata;
