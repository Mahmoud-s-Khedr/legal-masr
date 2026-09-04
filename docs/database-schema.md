# Database schema

This document describes the SQLite/SQLCipher schema created by
[`0001_canonical_legal_masr.sql`](../src-tauri/migrations/0001_canonical_legal_masr.sql).
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

| Table            | Purpose                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `lawyer_profile` | Optional singleton profile: full name, bar number, phone, and office address.                                                             |
| `app_settings`   | Required singleton settings: language, theme, date format, week start, reminders, lock timeout, autostart, and aggregate-counter consent. |

The migration creates the `app_settings` row with canonical defaults. Its
constrained values include Arabic/English language, the three supported themes,
and valid ranges for reminder and lock timeout settings.

## Core legal records

| Table                | Purpose                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clients`            | People or entities represented by the lawyer. Each has a unique internal number and can be archived.                                                                   |
| `powers_of_attorney` | POAs with a unique internal sequence, optional official number/year/date, notary, notes, and archive timestamp.                                                        |
| `cases`              | Legal cases with a unique internal number, optional official number/year, court and circuit details, litigation degree, status, subject, notes, and archive timestamp. |

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
   │          │              ├── 1 case_fee_agreement
   │          │              ├──< payments
   │          │              └──< attachments
   │          └── optional POA for that same client
   │
   ├──< tasks
   ├──< expenses ──< attachments
   └──< attachments
```

### POA relationships

| Table                       | Relationship and purpose                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `power_of_attorney_clients` | Many-to-many link between POAs and clients. A POA deletion cascades to its links; a client with a POA link cannot be deleted. |
| `power_of_attorney_lawyers` | Descriptive lawyer rows for a POA. Deleting the POA cascades to these rows.                                                   |

### Case relationships

| Table            | Relationship and purpose                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `case_clients`   | Many-to-many client/case link with legal capacity, notes, and an optional POA. Its composite foreign key guarantees the selected POA is linked to the same client.                                                                 |
| `case_opponents` | Opponents associated with one case; case deletion cascades.                                                                                                                                                                        |
| `hearings`       | Required case and hearing date, optional time/reminder/details, and an optional self-reference to a previous hearing. Deleting the prior hearing sets its successors’ `previous_hearing_id` to `NULL`; deleting the case cascades. |
| `tasks`          | Optional client and case links, required due date, optional reminder, and constrained completion state. Deleting the linked client or case sets the corresponding link to `NULL`.                                                  |

## Financial records

| Table                 | Purpose and integrity rules                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `case_fee_agreements` | One fee agreement per case. The case relationship is unique and cascades on case deletion.                                                            |
| `payments`            | A positive payment amount from a payer linked to the same case. A composite foreign key references `case_clients(case_id, client_id)`.                |
| `expenses`            | Positive case or office expense with a constrained type. Client and case links are independent and optional; deleting either sets its link to `NULL`. |

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

| Table                 | Purpose                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `search_index`        | Normalized prefix/exact lookup rows for clients, cases, and POAs. It is derived data, rebuilt by application services. |
| `reminder_deliveries` | De-duplicates notifications by `(entity_type, entity_id, reminder_date)` for hearings and tasks.                       |
| `backup_history`      | Local backup attempt/status history. It records no backup destination paths.                                           |
| `usage_counters`      | Optional aggregate-only counters for selected actions; no individual legal-record data is stored.                      |

## Deletion behavior summary

- Deleting a case cascades to its case-client links, opponents, hearings,
  fee agreement, and case-owned attachments. Tasks and expenses retain their
  records with the case link set to `NULL`.
- Clients are restricted from deletion while POA or case relationships remain.
  Optional task/expense links become `NULL`; client-owned attachments cascade.
- Deleting a POA cascades to its client links, lawyer rows, and POA-owned
  attachments. A POA still referenced by `case_clients` cannot be removed.
- Payments restrict deletion of their referenced case/client relationship.

## Change policy

`0001` is the sole pre-release baseline. Do not edit it. A schema change needs
an explicit migration-policy decision before implementation; update this
reference in the same change.
