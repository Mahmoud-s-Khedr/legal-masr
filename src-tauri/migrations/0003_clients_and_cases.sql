CREATE TABLE clients (
  id                  TEXT PRIMARY KEY,
  client_type         TEXT NOT NULL CHECK (client_type IN ('INDIVIDUAL', 'ORGANIZATION')),
  display_name        TEXT NOT NULL,
  national_id         TEXT,
  registration_number TEXT,
  primary_phone       TEXT,
  normalized_phone    TEXT,
  email               TEXT,
  address             TEXT,
  notes               TEXT,
  archived_at         TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_clients_normalized_phone ON clients(normalized_phone);
CREATE INDEX idx_clients_display_name ON clients(display_name);
CREATE INDEX idx_clients_archived_at ON clients(archived_at);

CREATE TABLE client_contacts (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_type     TEXT NOT NULL CHECK (contact_type IN ('PHONE', 'EMAIL', 'ADDRESS', 'OTHER')),
  label            TEXT,
  value            TEXT NOT NULL,
  normalized_value TEXT,
  is_primary       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_client_contacts_client_id ON client_contacts(client_id);
CREATE UNIQUE INDEX idx_client_contacts_one_primary_per_type
  ON client_contacts(client_id, contact_type) WHERE is_primary = 1;

CREATE TABLE cases (
  id                    TEXT PRIMARY KEY,
  case_number           TEXT NOT NULL,
  judicial_year         INTEGER,
  court_name            TEXT,
  circuit_name          TEXT,
  case_type             TEXT,
  client_legal_capacity TEXT,
  status                TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'ACTIVE', 'SUSPENDED', 'JUDGMENT_ISSUED', 'APPEALED', 'ENFORCEMENT', 'CLOSED', 'ARCHIVED'
  )),
  filed_on              TEXT,
  closed_on             TEXT,
  summary               TEXT,
  notes                 TEXT,
  archived_at           TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX idx_cases_case_number ON cases(case_number);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_archived_at ON cases(archived_at);

CREATE TABLE case_clients (
  case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (case_id, client_id)
);
CREATE INDEX idx_case_clients_client_id ON case_clients(client_id);
CREATE UNIQUE INDEX idx_case_clients_one_primary_per_case
  ON case_clients(case_id) WHERE is_primary = 1;

CREATE TABLE case_parties (
  id         TEXT PRIMARY KEY,
  case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('OPPONENT', 'WITNESS', 'EXPERT', 'OTHER')),
  name       TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_case_parties_case_id ON case_parties(case_id);

CREATE TABLE search_index (
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  normalized_text TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX idx_search_index_normalized_text ON search_index(normalized_text);
