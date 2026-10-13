# Database explained

A walkthrough of the LegalMaster Solo database: every table, its columns, how
the tables relate, and what each one is used for. The executable definition is
in `src-tauri/migrations/`. For the short reference, see
[`database-schema.md`](database-schema.md).

The database is one encrypted SQLite (SQLCipher) file per installation (a
"vault"). Four migrations define it:

- `0001_canonical_legal_masr.sql` is the base schema.
- `0002_case_judicial_year.sql` adds `cases.judicial_year`.
- `0003_case_or_client_links.sql` adds the rules for how records link to each
  other.
- `0004_remove_reminders_and_autostart.sql` drops the reminder and
  launch-at-login columns and the `reminder_deliveries` table, which no feature
  uses any more.

All access goes through Rust; React never touches the database.

## Conventions used everywhere

- **IDs** are 36-character UUID text. The three single-row tables
  (`app_metadata`, `lawyer_profile`, `app_settings`) use `id = 1` instead.
- **`STRICT` tables**: SQLite enforces the declared column types.
- **Dates** are `YYYY-MM-DD` text with no timezone, so a hearing on 2026-10-13
  never moves to another day. Times are `HH:MM`.
- **Money** is stored in `amount_minor` as an integer number of piasters
  (EGP × 100), always greater than 0. No floating-point rounding.
- **Archiving instead of deleting**: `clients`, `cases` and
  `powers_of_attorney` have an `archived_at` column. When it's NULL the record
  is active; when it holds a timestamp the record is hidden but kept.
- Record tables have `created_at` / `updated_at` audit timestamps. Link and
  log tables keep only the one they need (for example
  `power_of_attorney_clients` and `backup_history` have `created_at`;
  `search_index` and `usage_counters` have `updated_at`).

## Relationship map

```text
clients ──< power_of_attorney_clients >── powers_of_attorney ──< power_of_attorney_lawyers
   │                                              └──< attachments
   ├──< case_clients >── cases ──< case_opponents
   │         │             ├──< hearings ──> previous hearing (self-link)
   │         │             ├── 1 case_fee_agreements
   │         │             ├──< tasks     (case work)
   │         │             ├──< expenses  (case expenses) ──< attachments
   │         │             └──< attachments
   │         └──< payments (payer must be a client of that case)
   ├──< tasks     (client work with no case)
   ├──< expenses  (client expenses with no case) ──< attachments
   └──< attachments
```

A task or expense has either a `case_id` or a `client_id`, never both. Case
work is linked to the case, and the client already reaches it through
`case_clients`. A direct `client_id` link is only for work that doesn't belong
to any case.

## 1. System and metadata tables

| Table | Columns | Used for |
|---|---|---|
| `schema_migrations` | `version`, `applied_at` | Records which numbered migrations have run. This is the only source of truth for the schema version. |
| `migration_baseline` | `id=1`, `name` (must be `canonical-pre-release-2026-09-04`) | Marks the starting schema, so the app refuses to open a vault from an older, discarded migration chain instead of corrupting it. |
| `app_metadata` | `installation_uuid`, timestamps | A random ID for this installation. |
| `spike_records` | `id`, `value`, `created_at` | Used only by tests (lifecycle and concurrent-writer checks). Not part of the legal data. |

## 2. Lawyer and settings (single-row tables)

**`lawyer_profile`** holds the lawyer using the app. Its row is written during
first-run setup: `full_name` (required),
`bar_number` (نقابة membership number), `phone`, `office_address`.

**`app_settings`** holds user preferences. Its row is created automatically
with defaults:

- `language`: `ar` or `en`, default Arabic.
- `theme`: system, light or dark.
- `date_format`: `dd/MM/yyyy` or `yyyy-MM-dd`.
- `week_starts_on`: 0–6, default 6 (Saturday, the Egyptian work week).
- `lock_timeout_minutes`: idle minutes before the vault auto-locks, default 15.
- `usage_counters_enabled`: 0/1 flag. Usage counters are opt-in.

## 3. Core legal records

### `clients`: the people or companies the lawyer represents

- `internal_number`: the office's own file number, unique and required.
- `full_name` (required), `national_id`, `email`, `address`, `notes`.
- `primary_phone` is the phone as typed. `normalized_phone` is a cleaned-up
  copy used for duplicate detection and search.
- `archived_at`.

### `powers_of_attorney`: توكيلات

- `internal_sequence`: the office's own unique reference.
- `official_number`: the number from the notary (الشهر العقاري). It is allowed
  to repeat because it isn't unique across offices.
- `issue_year`, `issue_date`, `notary_office`, `notes`, `archived_at`.

### `power_of_attorney_clients`: links POAs and clients (many-to-many)

- Its primary key is `(power_of_attorney_id, client_id)`. One POA can cover
  several clients, for example heirs signing together.
- Deleting a POA removes its links. A client that still has a link can't be
  deleted.
- **Rule from 0003:** a client can have at most one active (non-archived) POA.
  Two triggers enforce it, one on linking and one on un-archiving a POA. Either
  aborts with `CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY`.

### `power_of_attorney_lawyers`

The lawyers named on a POA: `full_name`, `bar_number`, `notes`. These are text
records, not links to `lawyer_profile`. They are deleted together with their
POA.

### `cases`: الدعاوى

- `internal_number`: unique office reference.
- `official_number`, `official_year` (Gregorian, 1800–9999) and
  `judicial_year` (the "89" in «لسنة 89 قضائية», added in 0002 because it can't
  fit the Gregorian range).
- `case_type`, `court_name`, `circuit_name` (الدائرة), `subject`, `notes`.
- `litigation_degree`: `FIRST_INSTANCE`, `APPEAL`, `CASSATION` or `OTHER`.
- `status`: `ACTIVE`, `SUSPENDED` or `CLOSED`.
- `filed_on`, `closed_on`, `archived_at`.

### `case_clients`: which clients are parties to which case (many-to-many)

- Its primary key is `(case_id, client_id)`.
- `legal_capacity` is the client's role in the case, such as plaintiff,
  defendant or heir. `notes`.
- `power_of_attorney_id` is **retired**. It is always NULL, and triggers
  reject any non-NULL write to it. Instead, a case shows its client's POA through the
  **`client_current_poa` view**: the client's active POA, or if there is none,
  their newest archived one. The column still exists only because SQLite can't
  drop a column that an index and a foreign key use.

### `case_opponents`: الخصوم

`full_name`, `legal_capacity`, `lawyer_name` (the opponent's lawyer), `phone`,
`address`, `notes`. Each belongs to one case and is deleted with it.

### `hearings`: الجلسات

- `case_id` and `hearing_date` are required. `hearing_time` is optional.
- `previous_hearing_id` points to an earlier hearing, so adjournments
  (التأجيلات) form a chain. If the earlier hearing is deleted, this becomes
  NULL.
- `hearing_type`, `location`, `circuit_name`, `required_documents`, `notes`.
- `decision_text`: what the court decided (قرار الجلسة).
- `status`: `SCHEDULED`, `COMPLETED` or `CANCELLED`, plus `completed_at`.

### `tasks`

- `title`, `details`, `notes`, `due_date` (required).
- `completed` (0/1) and `completed_at`. A CHECK keeps them consistent:
  completed tasks must have a time, open tasks must not.
- `case_id` **or** `client_id`, never both (enforced by a 0003 trigger). The
  reasoning: a case already knows its clients, so a client's page shows their
  direct tasks plus the tasks of their cases. If the linked case or client is
  deleted, the link becomes NULL and the task stays.

## 4. Financial records

| Table | Columns | Rules |
|---|---|---|
| `case_fee_agreements` | `case_id` (UNIQUE), `amount_minor`, `agreement_date`, `notes` | The agreed fee (الأتعاب). At most one per case. |
| `payments` | `case_id`, `payer_client_id`, `amount_minor`, `payment_date`, `payment_method` (CASH / BANK_TRANSFER / CHEQUE / ELECTRONIC / OTHER), `notes` | The foreign key `(case_id, payer_client_id)` points to `case_clients`, so **the payer must be a client of that case**. That link can't be removed while a payment uses it. |
| `expenses` | `case_id` or `client_id` (never both), `amount_minor`, `expense_date`, `expense_type` (COURT_FEE / TRANSPORT / OFFICE_SUPPLIES / EXPERT_FEE / OTHER), `notes` | Money the office spent. With neither link set, it's a general office expense. |

The amount still owed on a case is the fee agreement minus its payments. It
isn't stored anywhere; the app calculates it.

## 5. `attachments`: documents

This table stores information about files the app has copied into its own
managed folder:

- `original_filename` (the user's name for the file) and `stored_filename` (the
  generated name on disk).
- `relative_path`, always inside the vault. The table never stores an outside
  path.
- `mime_type`, `file_size_bytes`, `sha256` (to check the file hasn't changed).
- `category`: IDENTIFICATION, POWER_OF_ATTORNEY, CASE_FILE, COURT_DECISION,
  EVIDENCE, RECEIPT, CORRESPONDENCE or OTHER.
- `description`, `document_date`.
- **Exactly one owner**: `client_id`, `case_id`, `power_of_attorney_id` or
  `expense_id`. A CHECK requires exactly one to be set. Deleting the owner
  deletes the attachment row.

## 6. Supporting tables

| Table | Used for |
|---|---|
| `search_index` | A flattened search table: `(entity_type, entity_id)` → `title`, `subtitle`, `normalized_text`. Covers clients, cases and POAs, with Arabic text normalized for prefix search. The app rebuilds it from the real tables. |
| `backup_history` | Each backup attempt: `started_at`, `status` (RUNNING / SUCCEEDED / FAILED), `archive_size_bytes`, `error_code`. A CHECK requires `completed_at` once the backup finishes. The latest successful row drives the "last backup" status. It deliberately stores no destination path. |
| `usage_counters` | Opt-in counts only, such as `CASE_CREATED` or `BACKUP_CREATED`. No record data. |

## 7. What happens on delete

- **Deleting a case** removes its client links, opponents, hearings, fee
  agreement and attachments. Its tasks and expenses stay, with the case link
  set to NULL. A case with any payment can't be deleted, because the payment
  blocks removal of its `case_clients` row.
- **Deleting a client** is blocked while they are linked to any case or POA.
  Otherwise their direct tasks and expenses stay with the link set to NULL,
  and their attachments are deleted.
- **Deleting a POA** removes its client links, lawyers and attachments.
- **Deleting a payer's link to a case** is blocked while a payment references
  it.

## Review notes

Observations from reviewing the schema on 2026-10-13. Apart from documenting
item 1, nothing has been changed.

1. **Deleting a case that has payments is blocked.** Deleting a case tries to
   remove its `case_clients` rows, and payments block that removal. This is
   probably intended for financial integrity, and is now written down in
   `database-schema.md` and section 7. The app has no permanent deletion yet,
   so users can't hit it today.
2. **Hearings and cases don't enforce the consistency tasks do.** Tasks tie
   `completed`/`completed_at` together with a CHECK, but
   `hearings.status`/`completed_at` and `cases.status`/`closed_on` have no such
   rule. Nothing stops `closed_on` from being earlier than `filed_on`.
3. **Adjournment chains can cross cases.** Nothing requires
   `previous_hearing_id` to point to a hearing in the same case.
4. **Some links have no foreign key and can go stale.** `search_index` points
   to records by type and ID only, so it relies on the app to clean it up when
   records are deleted.
5. **Some indexes are redundant.** `internal_number` / `internal_sequence` are
   already `UNIQUE`, which creates an index, so the extra `idx_*_active_*`
   partial indexes add little.
6. **Old data may break the 0003 rules.** Its triggers only check new writes,
   so a vault that already had two active POAs for one client keeps both until
   one is archived or the client is removed from it. Editing a POA doesn't
   re-check links it already has. The view picks the newest one.

None of these is urgent. Items 2 and 3 are the only ones that could let wrong
data in; the case form does check the filing/closing date order.
