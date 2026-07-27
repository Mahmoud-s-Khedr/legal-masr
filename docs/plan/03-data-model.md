# Data model

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 9. Database model

Use UUIDs as public/internal entity identifiers.

Use:

* UTC timestamps for moments
* `YYYY-MM-DD` text for date-only legal dates
* Integer minor units for money
* Foreign-key constraints
* Explicit archive timestamps
* Transactions for multi-record operations

## 9.1 Core tables

```text
app_metadata
lawyer_profile
app_settings
clients
client_contacts
cases
case_clients
case_parties
case_events
tasks
documents
case_fee_agreements
financial_transactions
search_index
backup_history
activity_history
```

## 9.2 Proposed schema

### `app_metadata`

```text
id                    INTEGER PRIMARY KEY CHECK (id = 1)
installation_uuid     TEXT NOT NULL
schema_version        INTEGER NOT NULL
created_at            TEXT NOT NULL
updated_at            TEXT NOT NULL
```

The installation UUID remains local and must not be sent during update checks.

### `lawyer_profile`

```text
id                    INTEGER PRIMARY KEY CHECK (id = 1)
full_name             TEXT NOT NULL
bar_number            TEXT
phone                  TEXT
email                  TEXT
office_address         TEXT
logo_relative_path     TEXT
default_currency       TEXT NOT NULL DEFAULT 'EGP'
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `app_settings`

```text
id                           INTEGER PRIMARY KEY CHECK (id = 1)
language                     TEXT NOT NULL DEFAULT 'ar'
theme                        TEXT NOT NULL DEFAULT 'system'
date_format                  TEXT NOT NULL
week_starts_on               INTEGER NOT NULL
default_reminder_minutes     INTEGER NOT NULL
autostart_enabled            INTEGER NOT NULL DEFAULT 0
minimize_to_tray             INTEGER NOT NULL DEFAULT 0
lock_timeout_minutes         INTEGER NOT NULL
backup_enabled               INTEGER NOT NULL DEFAULT 1
backup_directory             TEXT
backup_frequency             TEXT NOT NULL
backup_retention_count       INTEGER NOT NULL
last_successful_backup_at    TEXT
created_at                   TEXT NOT NULL
updated_at                   TEXT NOT NULL
```

### `clients`

```text
id                    TEXT PRIMARY KEY
client_type           TEXT NOT NULL
display_name          TEXT NOT NULL
national_id           TEXT
registration_number   TEXT
primary_phone         TEXT
normalized_phone      TEXT
email                 TEXT
address               TEXT
notes                 TEXT
archived_at            TEXT
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `client_contacts`

```text
id                    TEXT PRIMARY KEY
client_id             TEXT NOT NULL REFERENCES clients(id)
contact_type          TEXT NOT NULL
label                 TEXT
value                 TEXT NOT NULL
normalized_value      TEXT
is_primary            INTEGER NOT NULL DEFAULT 0
created_at            TEXT NOT NULL
updated_at            TEXT NOT NULL
```

### `cases`

**Implemented with a deviation from the schema below:** a case may have more
than one client, so `cases` does **not** carry a `client_id` foreign key.
See `case_clients` immediately after this table.

```text
id                    TEXT PRIMARY KEY
case_number           TEXT NOT NULL
judicial_year         INTEGER
court_name            TEXT
circuit_name          TEXT
case_type             TEXT
client_legal_capacity TEXT
status                TEXT NOT NULL
filed_on              TEXT
closed_on             TEXT
summary               TEXT
notes                 TEXT
archived_at            TEXT
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `case_clients`

Join table recording every client on a case, with exactly one marked
primary (enforced by a partial unique index on `case_id` where
`is_primary = 1`).

```text
case_id               TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE
client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT
is_primary            INTEGER NOT NULL DEFAULT 0
created_at            TEXT NOT NULL
PRIMARY KEY (case_id, client_id)
```

`client_id` uses `ON DELETE RESTRICT`: a client linked to a case cannot be
deleted out from under it. `case_id` cascades: deleting a case removes its
own join rows.

### `case_parties`

**Implemented with a deviation from the schema below:** the `role` enum no
longer includes `CLIENT`/`CO_CLIENT`. `case_clients` is the single source of
truth for which clients are on a case; `case_parties` is exclusively for
opponents, witnesses, experts and other non-client participants
(`OPPONENT` / `WITNESS` / `EXPERT` / `OTHER`).

```text
id                    TEXT PRIMARY KEY
case_id               TEXT NOT NULL REFERENCES cases(id)
role                  TEXT NOT NULL
name                  TEXT NOT NULL
phone                 TEXT
address               TEXT
notes                 TEXT
created_at            TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `case_events`

```text
id                    TEXT PRIMARY KEY
case_id               TEXT REFERENCES cases(id)
client_id             TEXT REFERENCES clients(id)
event_type            TEXT NOT NULL
title                 TEXT NOT NULL
event_date            TEXT NOT NULL
starts_at             TEXT
ends_at               TEXT
is_all_day            INTEGER NOT NULL
location              TEXT
circuit_name          TEXT
preparation_notes     TEXT
required_documents    TEXT
outcome               TEXT
decision_text         TEXT
next_action           TEXT
status                TEXT NOT NULL
reminder_config_json  TEXT
completed_at          TEXT
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `tasks`

```text
id                    TEXT PRIMARY KEY
client_id             TEXT REFERENCES clients(id)
case_id               TEXT REFERENCES cases(id)
source_event_id       TEXT REFERENCES case_events(id)
title                 TEXT NOT NULL
description           TEXT
due_date              TEXT
due_time              TEXT
priority              TEXT NOT NULL
status                TEXT NOT NULL
reminder_config_json  TEXT
completed_at          TEXT
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `documents`

```text
id                    TEXT PRIMARY KEY
client_id             TEXT REFERENCES clients(id)
case_id               TEXT REFERENCES cases(id)
storage_mode          TEXT NOT NULL
original_filename     TEXT NOT NULL
stored_filename       TEXT
relative_path         TEXT
external_path         TEXT
mime_type             TEXT
file_size_bytes       INTEGER
sha256                TEXT
category              TEXT NOT NULL
description           TEXT
document_date         TEXT
missing_at            TEXT
archived_at            TEXT
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `case_fee_agreements`

```text
id                    TEXT PRIMARY KEY
case_id               TEXT NOT NULL UNIQUE REFERENCES cases(id)
amount_minor          INTEGER NOT NULL
currency              TEXT NOT NULL
agreement_date        TEXT
notes                 TEXT
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `financial_transactions`

```text
id                    TEXT PRIMARY KEY
client_id             TEXT NOT NULL REFERENCES clients(id)
case_id               TEXT REFERENCES cases(id)
transaction_type      TEXT NOT NULL
amount_minor          INTEGER NOT NULL
currency              TEXT NOT NULL
transaction_date      TEXT NOT NULL
payment_method        TEXT
description           TEXT
receipt_document_id   TEXT REFERENCES documents(id)
reversed_transaction_id TEXT REFERENCES financial_transactions(id)
created_at             TEXT NOT NULL
updated_at             TEXT NOT NULL
```

### `search_index`

```text
entity_type           TEXT NOT NULL
entity_id             TEXT NOT NULL
title                 TEXT NOT NULL
subtitle              TEXT
normalized_text       TEXT NOT NULL
updated_at             TEXT NOT NULL
PRIMARY KEY (entity_type, entity_id)
```

### `backup_history`

```text
id                    TEXT PRIMARY KEY
started_at            TEXT NOT NULL
completed_at          TEXT
status                TEXT NOT NULL
destination_path      TEXT
archive_size_bytes    INTEGER
error_code            TEXT
created_at             TEXT NOT NULL
```

See [07-backup-format.md](07-backup-format.md) for the backup archive itself.

### `activity_history`

This is not a multi-user audit log. It supports recent activity and troubleshooting.

```text
id                    TEXT PRIMARY KEY
activity_type         TEXT NOT NULL
entity_type           TEXT
entity_id             TEXT
safe_description      TEXT
created_at             TEXT NOT NULL
```

Do not store sensitive record content inside activity descriptions.

---

# 11. Database migrations

## Rules

* Every schema change requires a numbered migration.
* Applied migrations are immutable.
* Never edit a migration already used by a beta tester.
* Migrations run inside a transaction where SQLite permits.
* Create a verified backup before an application update that changes schema.
* Record migration version in the database.
* Test migration from every publicly released schema version.
* Do not implement automatic downgrade migrations.

## Startup migration process

1. Unlock database.
2. Check integrity.
3. Read schema version.
4. Determine pending migrations.
5. Create pre-migration backup.
6. Apply migrations.
7. Rebuild derived search index if required.
8. Run post-migration integrity checks.
9. Start application.
10. On failure, keep the pre-migration backup and stop.
