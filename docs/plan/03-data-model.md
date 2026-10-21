# Data model

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Canonical schema

Migration `0001_canonical_legal_masr.sql` establishes the complete
canonical-domain schema and its required settings singleton. Domain tables are
SQLite `STRICT` tables.
Public records use non-null UUID text keys, money is positive EGP integer minor
units, and legal dates are timezone-free `YYYY-MM-DD` text.
`schema_migrations` is the only schema-version authority; `app_metadata` holds
installation identity only.

| Area                  | Tables                                                                         | Key rules                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation          | `app_metadata`, `lawyer_profile`, `app_settings`                               | One-row records; profile has name/bar number/phone/office address; settings hold language, theme, date/week, lock timeout, and aggregate-counter consent.                         |
| Clients               | `clients`                                                                      | Unique `internal_number`; name required; optional ID, phone, email, address, notes, and archive time. No organization/contact submodel.                                           |
| POAs                  | `powers_of_attorney`, `power_of_attorney_clients`, `power_of_attorney_lawyers` | Unique internal sequence; official number may repeat; multiple client links and descriptive lawyer rows.                                                                          |
| Cases                 | `cases`, `case_clients`, `case_opponents`                                      | Unique internal number; optional official number/year; each client relationship holds capacity and notes; its POA is derived from the client. The retired POA pointer stays NULL. |
| Schedule              | `hearings`, `tasks`                                                            | Hearings belong to a case and optionally chain to a prior hearing. Tasks have due date/details/notes/a case-or-client link and constrained `completed` state only.                |
| Finance               | `case_fee_agreements`, `payments`, `expenses`                                  | One agreement per case. Payment payer must be a client linked to the same case. Expense links a case or a client, never both; neither link is also valid.                         |
| Attachments           | `attachments`                                                                  | Managed-copy metadata only, with exactly one owner: client, case, POA, or expense.                                                                                                |
| Derived/local history | `search_index`, `backup_history`, `usage_counters`, `pending_file_deletions`   | Search indexes Clients/Cases/POAs; backup history excludes destination paths; counters are aggregate-only.                                                                        |

Removed concepts include generic `case_events`, task priority/status enums,
external file references, generic financial transactions, client contacts and
organizations, activity history, a metadata schema-version field, and (since
migration `0004`) reminder lead times, the reminder delivery log, and the
launch-at-login preference.

## Domain constraints

### Clients, POAs, and cases

- Client internal numbers and POA internal sequences are unique non-empty text.
- A POA official number is descriptive, not unique.
- A case has a unique internal number; official number/year are independently
  optional and indexed for lookup.
- `case_clients` has primary key `(case_id, client_id)`. A case does not store a
  POA: it shows its client's POA through the `client_current_poa` view (the
  active POA, else the newest archived one). `case_clients.power_of_attorney_id`
  is retired and always `NULL`.
- A client has at most one active POA; a POA may have several clients and
  lawyers. Triggers enforce this when linking and when restoring an archived POA.
- Clients are restricted from deletion while case/POA relationships remain.
- Cases cascade their client links, opponents, hearings, fee agreement, and
  case-owned attachments. Archiving is the normal UI removal operation.

### Hearings and tasks

- Hearing date is required; time is optional. Status is one of
  `SCHEDULED`, `COMPLETED`, or `CANCELLED`.
- `previous_hearing_id` is optional and becomes `NULL` if its source is removed.
- A task has a required due date and a `completed` boolean constrained to `0`
  or `1`. `completed_at` must be null for open tasks and non-null for completed
  tasks. There is no priority, due-time, assignee, source-event, or generic
  status field.
- A task (and an expense) links a case or a client, never both; a client's view
  derives the work of its cases through `case_clients`.

### Finance and attachments

- Fee agreements, payments, and expenses reject zero/negative money. The
  application presents EGP; the schema does not carry a mutable currency field.
- `payments` has a composite foreign key to `case_clients(case_id, client_id)`.
  Both service and database reject a payer outside the case.
- Expenses require a constrained type (`COURT_FEE`, `TRANSPORT`,
  `OFFICE_SUPPLIES`, `EXPERT_FEE`, or `OTHER`) but can have neither a client nor a case link, or exactly one of them.
- An attachment records generated storage name, relative managed path, SHA-256,
  non-negative size, optional MIME/type/date/description, and a category. Its
  ownership check requires exactly one of `client_id`, `case_id`,
  `power_of_attorney_id`, or `expense_id`.

## Search and indexes

The search index stores normalized client, case and POA text for literal substring
queries. Arabic/Western digit and Arabic-letter normalization is performed
without changing the displayed original input. FTS5 is intentionally deferred:
the current query surface and expected local data size did not justify it.

## Migration policy

- `0001` is the pre-release canonical migration. It creates both the
  complete domain schema and required settings singleton.
- `0003` enforces the link rules: a task/expense links a case **or** a client,
  one active POA per client, and POA↔case derived from the client. It uses
  triggers, a view and data repair only, so no table is rebuilt.
- `0002` adds the nullable `cases.judicial_year` (1–9999) so a court year such as
  «89 قضائية» is stored apart from the Gregorian `official_year` (1800–9999).
  It is additive: no table is rebuilt and existing rows are unchanged. A test
  upgrades a populated version-1 vault and checks rows, relationships and the
  foreign-key check.
- `0004` removes reminder and launch-at-login settings, per-record reminder
  values and the reminder delivery log. Its upgrade test verifies existing
  records, settings and expense attachments survive.
- Startup identifies the baseline with an internal marker. It refuses every
  superseded schema with `LEGACY_DATA_MIGRATION_REQUIRED` before applying any
  SQL, so a persisted vault requires an explicit conversion decision.
- Startup opens SQLCipher, enables foreign keys, applies pending migrations,
  rebuilds derived search data where required, and checks integrity.
- Migration tests cover a clean canonical database plus refusal to replace a
  superseded schema. No automatic downgrade exists.

## Deletion service and migration status — 2026-10-21

Migration `0005_pending_file_deletions.sql` adds a STRICT table keyed by managed
file basename. It is a transactional deletion outbox: deleted attachment metadata
and a pending unlink are committed together. Successful or already-missing files
clear their queue entry; failed files remain tracked for explicit retry. Existing
migrations and foreign-key actions are unchanged.

The guided deletion service explicitly deletes scoped payments, tasks and
expenses before deleting case/client owners, rather than relying on their
RESTRICT/SET NULL defaults. Exclusive POAs and their dependent rows are also
removed during client deletion. Shared case/POA and retained hearing/file
boundaries are refused. Whole-vault reset removes all domain/local rows in one
transaction, then removes the closed database, envelopes, managed files,
vault-local backups and snapshots through native journal recovery. Derived
search rows refresh in the same partial-deletion transaction; there is no FTS5
index in this schema.
