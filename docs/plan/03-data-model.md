# Data model

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Canonical schema

Migration `0007_canonical_legal_masr.sql` is the current canonical-domain
schema. Domain tables are SQLite `STRICT` tables. Public records use non-null
UUID text keys, money is positive EGP integer minor units, and legal dates are
timezone-free `YYYY-MM-DD` text. `schema_migrations` is the only schema-version
authority; `app_metadata` holds installation identity only.

| Area                  | Tables                                                                         | Key rules                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation          | `app_metadata`, `lawyer_profile`, `app_settings`                               | One-row records; profile has name/bar number/phone/office address; settings hold language, theme, date/week, reminder, lock, autostart, and aggregate-counter consent. |
| Clients               | `clients`                                                                      | Unique `internal_number`; name required; optional ID, phone, email, address, notes, and archive time. No organization/contact submodel.                                |
| POAs                  | `powers_of_attorney`, `power_of_attorney_clients`, `power_of_attorney_lawyers` | Unique internal sequence; official number may repeat; multiple client links and descriptive lawyer rows.                                                               |
| Cases                 | `cases`, `case_clients`, `case_opponents`                                      | Unique internal number; optional official number/year; each client relationship holds capacity, POA, notes. POA ownership is enforced by a composite foreign key.      |
| Schedule              | `hearings`, `tasks`, `reminder_deliveries`                                     | Hearings belong to a case and optionally chain to a prior hearing. Tasks have due date/details/notes/links/reminder and constrained `completed` state only.            |
| Finance               | `case_fee_agreements`, `payments`, `expenses`                                  | One agreement per case. Payment payer must be a client linked to the same case. Expense case/client links are independently optional.                                  |
| Attachments           | `attachments`                                                                  | Managed-copy metadata only, with exactly one owner: client, case, POA, or expense.                                                                                     |
| Derived/local history | `search_index`, `backup_history`, `usage_counters`                             | Search indexes Clients/Cases/POAs; backup history excludes destination paths; counters are aggregate-only.                                                             |

Removed concepts include generic `case_events`, task priority/status enums,
external file references, generic financial transactions, client contacts and
organizations, activity history, and a metadata schema-version field.

## Domain constraints

### Clients, POAs, and cases

- Client internal numbers and POA internal sequences are unique non-empty text.
- A POA official number is descriptive, not unique.
- A case has a unique internal number; official number/year are independently
  optional and indexed for lookup.
- `case_clients` has primary key `(case_id, client_id)`. Its
  `(power_of_attorney_id, client_id)` foreign key references a matching POA
  client link, so a client cannot be assigned another client's POA.
- Clients are restricted from deletion while case/POA relationships remain.
- Cases cascade their client links, opponents, hearings, fee agreement, and
  case-owned attachments. Archiving is the normal UI removal operation.

### Hearings and tasks

- Hearing date is required; time and reminder are optional. Status is one of
  `SCHEDULED`, `COMPLETED`, or `CANCELLED`.
- `previous_hearing_id` is optional and becomes `NULL` if its source is removed.
- A task has a required due date and a `completed` boolean constrained to `0`
  or `1`. `completed_at` must be null for open tasks and non-null for completed
  tasks. There is no priority, due-time, assignee, source-event, or generic
  status field.
- Reminder delivery deduplicates by `(entity_type, entity_id, reminder_date)`
  for canonical `HEARING` and `TASK` entities.

### Finance and attachments

- Fee agreements, payments, and expenses reject zero/negative money. The
  application presents EGP; the schema does not carry a mutable currency field.
- `payments` has a composite foreign key to `case_clients(case_id, client_id)`.
  Both service and database reject a payer outside the case.
- Expenses require a constrained type (`COURT_FEE`, `TRANSPORT`,
  `OFFICE_SUPPLIES`, `EXPERT_FEE`, or `OTHER`) but can have neither, either, or
  both client and case links.
- An attachment records generated storage name, relative managed path, SHA-256,
  non-negative size, optional MIME/type/date/description, and a category. Its
  ownership check requires exactly one of `client_id`, `case_id`,
  `power_of_attorney_id`, or `expense_id`.

## Search and indexes

The search index is a normalized B-tree prefix/exact index for Clients, Cases,
and POAs. Arabic/Western digit and Arabic-letter normalization is performed
without changing the displayed original input. FTS5 is intentionally deferred:
the current query surface and expected local data size did not justify it.

## Migration policy

- Every schema change receives a new numbered immutable SQL migration.
- Migration `0007` replaces the empty experimental development baseline only.
  Startup rejects a populated legacy vault with
  `LEGACY_DATA_MIGRATION_REQUIRED` before applying it; a real persisted vault
  needs an explicit forward data/file conversion migration.
- Startup opens SQLCipher, enables foreign keys, applies pending migrations,
  rebuilds derived search data where required, and checks integrity.
- Migration tests cover a clean canonical database plus refusal to replace a
  populated legacy schema. No automatic downgrade exists.
