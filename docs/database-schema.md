# Database schema

This document describes the SQLite/SQLCipher schema created by
[`0001_canonical_legal_masr.sql`](../src-tauri/migrations/0001_canonical_legal_masr.sql)
and extended by
[`0002_case_judicial_year.sql`](../src-tauri/migrations/0002_case_judicial_year.sql),
[`0003_case_or_client_links.sql`](../src-tauri/migrations/0003_case_or_client_links.sql) and
[`0004_remove_reminders_and_autostart.sql`](../src-tauri/migrations/0004_remove_reminders_and_autostart.sql) and
[`0005_pending_file_deletions.sql`](../src-tauri/migrations/0005_pending_file_deletions.sql) and
[`0006_keep_running_in_tray.sql`](../src-tauri/migrations/0006_keep_running_in_tray.sql).
It is a reference for the application model; the migration remains the
authoritative executable definition.

## Conventions

- Domain record IDs are UUID text values. `app_metadata`, `lawyer_profile`,
  and `app_settings` are singleton records with `id = 1`.
- Domain tables use SQLite `STRICT` mode.
- Legal dates are timezone-free `YYYY-MM-DD` text. Times are optional `HH:MM`
  text where applicable.
- Monetary amounts are positive EGP integer minor units (`amount_minor`).
- `created_at`, `updated_at`, and other audit timestamps are stored as text.
- The Rust database boundary enables foreign-key enforcement on every opened
  connection; React does not access the database directly.

## Schema and migration metadata

| Table                | Purpose                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `schema_migrations`  | Records applied numbered migrations. This is the sole schema-version authority.                                     |
| `migration_baseline` | Identifies the sole pre-release canonical baseline so a superseded schema is refused rather than overwritten.       |
| `app_metadata`       | Stores the installation UUID and creation/update timestamps.                                                        |
| `spike_records`      | Small local fixture table used by lifecycle and concurrent-writer regression tests. It has no domain relationships. |

## Lawyer settings

| Table            | Purpose                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lawyer_profile` | Singleton profile created at setup: required full name, optional bar number, phone, and office address.                                     |
| `app_settings`   | Required singleton settings: language, theme, date format, week start, lock timeout, optional tray behavior, and aggregate-counter consent. |

The migration creates the `app_settings` row with canonical defaults. Its
constrained values include Arabic/English language, the three supported themes,
and a valid range for the lock timeout. Migration `0006` adds
`keep_running_in_tray`, an integer boolean constrained to 0/1, NOT NULL and
defaulting to 0 for both new and upgraded vaults. There is no key/value settings
store. The preference remains inside the encrypted singleton row; no plaintext
preference file is added.

## Core legal records

| Table                | Purpose                                                                                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clients`            | People or entities represented by the lawyer. Each has a unique internal number and can be archived.                                                                                                                                                                               |
| `powers_of_attorney` | POAs with a unique internal sequence, optional official number/year/date, notary, notes, and archive timestamp.                                                                                                                                                                    |
| `cases`              | Legal cases with a unique internal number, optional official number, Gregorian `official_year` (1800–9999) and separate `judicial_year` (1–9999, the court year in «لسنة 89 قضائية»), court and circuit details, litigation degree, status, subject, notes, and archive timestamp. |

`clients`, `powers_of_attorney`, and `cases` have search-oriented indexes on
their identifiers and other commonly queried fields. POA official numbers are
descriptive and may repeat.

## Relationship map

```text
clients ──< power_of_attorney_clients >── powers_of_attorney
   │                                           ├──< power_of_attorney_lawyers
   │                                           └──< attachments
   │
   ├──< case_clients >── cases ──< case_opponents
   │          │              ├──< hearings ──> previous hearing (optional)
   │          │              ├──< tasks
   │          │              ├──< expenses ──< attachments
   │          │              ├── 1 case_fee_agreement
   │          │              ├──< payments
   │          │              └──< attachments
   │          └── POA derived from that client (`client_current_poa`)
   │
   ├──< tasks
   ├──< expenses ──< attachments
   └──< attachments
```

### POA relationships

| Table                       | Relationship and purpose                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `power_of_attorney_clients` | Many-to-many link between POAs and clients. A POA deletion cascades to its links; a client with a POA link cannot be deleted. A client has at most one **active** POA (triggers, see below). |
| `power_of_attorney_lawyers` | Descriptive lawyer rows for a POA. Deleting the POA cascades to these rows.                                                                                                                  |

### Case relationships

| Table            | Relationship and purpose                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `case_clients`   | Many-to-many client/case link with legal capacity and notes. `power_of_attorney_id` is **retired** (always `NULL`, a trigger rejects writes): a case shows its client's POA through the `client_current_poa` view.        |
| `case_opponents` | Opponents associated with one case; case deletion cascades.                                                                                                                                                               |
| `hearings`       | Required case and hearing date, optional time/details, and an optional self-reference to a previous hearing. Deleting the prior hearing sets its successors’ `previous_hearing_id` to `NULL`; deleting the case cascades. |
| `tasks`          | Optional client **or** case link (never both: a case already knows its clients), required due date and constrained completion state. Deleting the linked client or case sets the link to `NULL`.                          |

## Financial records

| Table                 | Purpose and integrity rules                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `case_fee_agreements` | One fee agreement per case. The case relationship is unique and cascades on case deletion.                                                      |
| `payments`            | A positive payment amount from a payer linked to the same case. A composite foreign key references `case_clients(case_id, client_id)`.          |
| `expenses`            | Positive case or office expense with a constrained type. Linked to a case **or** a client, never both; deleting either sets its link to `NULL`. |

A client's own view derives case work: its tasks and expenses are those linked
to it directly plus those of the cases it belongs to.

Deleting a client/case link that is referenced by a payment is restricted. This
prevents retaining a payment whose payer is no longer valid for its case.

## Attachments

`attachments` stores metadata for managed-copy files: original/generated file
names, relative path, MIME type, byte size, SHA-256, category, description,
and optional document date. It never stores an arbitrary external path.

Exactly one owner must be set for every attachment:

- `client_id`
- `case_id`
- `power_of_attorney_id`
- `expense_id`

All attachment owner relationships cascade on deletion. The application’s Rust
service coordinates the associated managed-file operation with the metadata
write.

## Local and derived records

| Table            | Purpose                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `search_index`   | Normalized prefix/exact lookup rows for clients, cases, and POAs. It is derived data, rebuilt by application services. |
| `backup_history` | Local backup attempt/status history behind the latest-backup status. It records no backup destination paths.           |
| `usage_counters` | Optional aggregate-only counters for selected actions; no individual legal-record data is stored.                      |

## Deletion behavior summary

The schema's original FK defaults remain: clients with case/POA relationships
are RESTRICTed; case deletion cascades to relationships, opponents, hearings,
fee agreements and attachments, while optional task/expense links SET NULL.
Payments RESTRICT removal of their case/client link. POA deletion cascades to
client links, lawyer rows and attachments.

The guided permanent-deletion service applies a stricter explicit policy before
those FK actions run:

- A client must be archived. Shared cases/POAs block deletion. Exclusive cases
  and POAs must also be archived. Their dependent records and the client's direct
  tasks, expenses and documents are deleted; office-only records are preserved.
- A case must be archived and have at most one client. Its payments, tasks,
  expenses (including their attachments), hearings, opponents, fee agreement,
  relationships and documents are removed. Clients and POAs are preserved.
- A retained hearing chained to a removed hearing or retained attachment sharing
  a removed managed-file path blocks partial deletion.
- Rows are deleted in dependency order in one transaction, together with a search
  refresh. Whole-vault reset removes domain/local rows, then deletes vault files
  through a restartable native marker after closing SQLCipher.

### File-removal outbox added by `0005`

`pending_file_deletions(relative_path TEXT PRIMARY KEY NOT NULL)` is a STRICT,
native-only table. The nonempty basename is copied from removed attachment
metadata within the row-deletion transaction. It has no foreign key because its
record owner is deliberately gone. Native path validation rejects traversal and
directory symlinks. A retained attachment with the same path prevents unlink.
Missing files are already complete; failures remain queued and are reported by
count, without exposing paths. Settings → Privacy and the result dialog can retry.
No existing migration or FK action was changed.

### Link rules added by `0003`

`0003` adds triggers, a view and data repair only (no table rebuild: `attachments`
cascade from `expenses` and `PRAGMA foreign_keys` cannot be switched off inside the
migration transaction). Triggers guard new writes; they do not reject rows that
already exist.

- `tasks_case_or_client_*` and `expenses_case_or_client_*` abort an insert/update
  that sets both `case_id` and `client_id` (`LINK_CASE_OR_CLIENT`). The migration
  clears `client_id` on existing rows that have a case.
- `poa_clients_one_active_poa` aborts linking a client to a second active POA, and
  `poa_restore_one_active_poa` aborts restoring an archived POA that would give a
  client two (`CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY`). Archived POAs do not count.
- `client_current_poa(client_id, power_of_attorney_id)` returns the client's active
  POA, else its newest archived one. Case pages and a POA's case list both read it.
- `case_clients_poa_pointer_retired_*` abort any non-`NULL` write of the old pointer;
  the migration sets existing pointers to `NULL`. The column and its composite
  foreign key remain because SQLite cannot drop a column that an index and foreign
  key use.
- Vaults that already hold two active POAs for one client keep both rows until
  one is archived or the client is removed from it (editing a POA does not
  re-check existing links); the view picks the newest deterministically.

## Change policy

`0001` is the pre-release baseline, `0002` adds `cases.judicial_year`, `0003`
adds the link rules above, and `0004` drops the removed reminder and
launch-at-login state (`app_settings.default_reminder_minutes`,
`app_settings.autostart_enabled`, `hearings.reminder_minutes`,
`tasks.reminder_minutes`, and the `reminder_deliveries` table). `0004` uses
`ALTER TABLE … DROP COLUMN`, which rewrites rows in place rather than rebuilding
the tables, so no cascade fires. Do not
edit an applied migration. A schema change needs an explicit migration-policy
decision before implementation (B10/P3-03 in the remediation register recorded
the one for `0002`); update this reference in the same change.

`0002` is additive (`ALTER TABLE … ADD COLUMN`) on purpose. SQLite cannot alter a
`CHECK` constraint, so widening `official_year` would require rebuilding `cases`,
a parent of `ON DELETE CASCADE` tables, inside the transaction the migration
runner uses (where `PRAGMA foreign_keys` cannot be switched off). Existing rows
keep their Gregorian year and receive no judicial year.
