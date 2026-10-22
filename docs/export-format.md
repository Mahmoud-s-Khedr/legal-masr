# Legal Masr data export format — version 1

Implemented on 2026-10-21 for Windows and Linux. Exports are user-initiated,
**unencrypted** disclosures of confidential records and document copies. They
are **not backups**, contain no encrypted database or security envelopes, and
cannot be restored/imported into Legal Masr. Use the separate encrypted backup
workflow for application recovery.

## Creation and scope

Backups and Settings → Backups offer a separate unencrypted-export card. Case
detail offers **Export this case**, including on archived cases. An Arabic/English
warning must be confirmed before the native folder picker opens. Cancelling the
picker writes nothing. The chosen folder must exist outside the managed vault.
The picker and export IO run on worker threads; the picker does not hold the
vault operation gate. Export IO holds that gate and the managed-document guard.
One read transaction fixes all CSV records to a consistent database snapshot.
Session checks during rows, file chunks and before publication abort stale work.

The new subfolder is `LegalMasr-export-YYYY-MM-DD-HHmm`, using local calendar time
at confirmation. A case adds `-case-<internal_number>`. Unicode letters/numbers,
ASCII hyphen and underscore are preserved in the internal number; each UTF-8 byte
of every other character is encoded as `~HH` (uppercase hex). For example,
`قضية/12` becomes `قضية~2F12`. Encoding also escapes `~`, so it is reversible.
An existing target (including an empty directory or symlink) is refused; choose
another parent or retry in another minute. Very long internal numbers can exceed
filesystem component/path limits and fail safely; they are never truncated.

A sibling `.LegalMasr-export-<UUID>.partial` directory receives all files. Files
are flushed and the completed directory is renamed without replacement. Linux
uses `renameat2(RENAME_NOREPLACE)`; Windows uses its non-replacing rename. A
normal failure attempts to remove staging. A crash, power loss or cleanup
permission failure can leave confidential `.partial` data, which is incomplete
and must be removed manually. No incomplete final-name folder is published.
Unix directories/files are created with modes 0700/0600 (subject to umask);
Windows inherits the chosen parent's ACL. Export does not promise forensic erasure
or power-loss durability. Linux filesystems lacking no-replace rename fail safely.

Installation scope includes **all** clients, cases, POAs, relationships, opponents,
POA lawyers, hearings, tasks, fee agreements, payments, expenses and attachment
metadata, including archived and unlinked office/client records. Only managed
files referenced by exported attachment metadata are copied; orphan files are
excluded. Settings, profile, installation identity, normalized search data,
search index, backup history, counters, migration rows, spike fixtures and
`pending_file_deletions` are excluded. This is a complete **domain-data** export,
not an installation image.

Case scope includes:

- Exactly the selected case, its client relationships/opponents, hearings, tasks,
  fee agreement, payments and expenses directly linked to that case.
- Exactly the clients linked to that case, and each client's current POA via
  `client_current_poa` (active, otherwise newest archived, as in the case UI).
  Older POAs are included only in installation exports. Selected POAs include
  their descriptive lawyers; POA/client links are restricted to selected clients.
- Documents owned by the case, selected clients/POAs or selected case expenses.
  Shared client/POA records and documents are included whole and may themselves
  contain other confidential information; the confirmation explicitly warns of
  this. Files are not inspected or redacted internally.
- No other cases are pulled in through a shared client/POA. Client-only and office
  tasks/expenses and their expense documents are excluded. A hearing's
  `previous_hearing_id` becomes null if it refers to another case's hearing;
  the other hearing is excluded. Source records are never modified.

## CSV conventions and types

Every CSV exists, even with no records (header only), and has these stable rules:

- UTF-8 with BOM bytes `EF BB BF` for Arabic in Windows Excel.
- Comma delimiter, ASCII snake-case headers, CRLF between records. Newlines inside
  text remain unchanged. Every text field is double-quoted; internal double quotes
  are doubled. Integers are plain base-10 digits, without grouping or locale digits.
- Null is an unquoted empty field; an actual empty string is `""`. Consumers that
  need to distinguish these must retain CSV quote information.
- Spreadsheet guard: prepend one ASCII apostrophe to text starting with an
  apostrophe, tab, CR or LF, or whose first non-whitespace character is `=`, `+`,
  `-` or `@`. Quote/escape the resulting text as above. After parsing CSV, removing
  exactly one initial apostrophe from any text value beginning with one recovers
  the original value. This includes international phone numbers beginning `+`.
  Apply this decoding only to text fields, never numeric fields or document bytes.
  Spreadsheet import as text is still recommended to preserve IDs/leading zeros
  and avoid automatic date/number conversion; desktop Excel behavior is unverified.
- Rows sort by the first two columns using SQLite's default binary ordering.
  Primary IDs (or the pair of relationship IDs) make that ordering deterministic.
- `id` and all `*_id` columns are UUID text references. `internal_number`,
  `internal_sequence`, official numbers, national IDs, phone/bar numbers are text.
- `amount_minor` is a positive integer of EGP minor units (100 = EGP 1).
  No floating-point or formatted money column is emitted.
- `official_year`, `judicial_year`, `issue_year`, `file_size_bytes` are integers;
  `archived` and `completed` are integer booleans (0/1).
- `filed_on`, `closed_on`, `issue_date`, `hearing_date`, `due_date`, `agreement_date`,
  `payment_date`, `expense_date`, `document_date` are timezone-free ISO `YYYY-MM-DD`
  strings. `hearing_time` is optional local `HH:MM`. Legal dates are never converted
  to timestamps. `created_at`, `updated_at`, `archived_at`, `completed_at` preserve
  stored audit timestamp text. Manifest `createdAt` is an RFC3339 UTC timestamp.
- `status`, `litigation_degree`, `payment_method`, `expense_type`, `category` are
  untranslated schema enum text (see [database schema](database-schema.md)).
  All other columns are UTF-8 text. Optional fields remain nullable as defined in
  the source schema; `previous_hearing_id` may additionally be null by case scoping.
  `archived` is derived only for clients/cases/POAs: 1 iff `archived_at` is non-null.
  Dependent records retain their parent IDs; archive status is read through those
  parents rather than adding a second independent archive state.

## Exact files and ordered columns

| File                            | Columns, in order                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clients.csv`                   | `id, internal_number, full_name, national_id, primary_phone, email, address, notes, archived_at, archived, created_at, updated_at`                                                                                           |
| `cases.csv`                     | `id, internal_number, official_number, official_year, judicial_year, case_type, litigation_degree, court_name, circuit_name, status, filed_on, closed_on, subject, notes, archived_at, archived, created_at, updated_at`     |
| `powers_of_attorney.csv`        | `id, internal_sequence, official_number, issue_year, issue_date, notary_office, notes, archived_at, archived, created_at, updated_at`                                                                                        |
| `case_clients.csv`              | `case_id, client_id, legal_capacity, notes, created_at, updated_at`                                                                                                                                                          |
| `case_opponents.csv`            | `id, case_id, full_name, legal_capacity, lawyer_name, phone, address, notes, created_at, updated_at`                                                                                                                         |
| `power_of_attorney_clients.csv` | `power_of_attorney_id, client_id, created_at`                                                                                                                                                                                |
| `power_of_attorney_lawyers.csv` | `id, power_of_attorney_id, full_name, bar_number, notes, created_at, updated_at`                                                                                                                                             |
| `hearings.csv`                  | `id, case_id, previous_hearing_id, hearing_date, hearing_time, hearing_type, location, circuit_name, required_documents, notes, decision_text, status, completed_at, created_at, updated_at`                                 |
| `tasks.csv`                     | `id, client_id, case_id, title, details, notes, due_date, completed, completed_at, created_at, updated_at`                                                                                                                   |
| `case_fee_agreements.csv`       | `id, case_id, amount_minor, agreement_date, notes, created_at, updated_at`                                                                                                                                                   |
| `payments.csv`                  | `id, case_id, payer_client_id, amount_minor, payment_date, payment_method, notes, created_at, updated_at`                                                                                                                    |
| `expenses.csv`                  | `id, case_id, client_id, amount_minor, expense_date, expense_type, notes, created_at, updated_at`                                                                                                                            |
| `attachments.csv`               | `id, client_id, case_id, power_of_attorney_id, expense_id, original_filename, stored_filename, relative_path, export_path, mime_type, file_size_bytes, sha256, category, description, document_date, created_at, updated_at` |

`case_clients.power_of_attorney_id` is retired/always null and is omitted; use the
exported POA/client links. `clients.normalized_phone` is derived and omitted;
`primary_phone` retains the original. `relative_path` is the original managed
basename, not an absolute device path. `export_path` is the portable relative path
`documents/<stored_filename>`. Exactly one attachment owner ID is non-null.

`documents/` always exists. Copies keep generated managed filenames/extensions;
`original_filename` records the lawyer's original name. Source names must be flat,
Windows-safe, unique ignoring case, and match `stored_filename = relative_path`.
Symlinks, missing/nonregular files, invalid paths/names, duplicate names and
size/SHA-256 mismatches fail the whole export. Document bytes are copied without
modification and checked against database metadata. Unreferenced files are ignored.

## Manifest JSON schema

`manifest.json` is UTF-8 JSON without BOM. Its complete v1 shape is:

```json
{
  "formatVersion": 1,
  "applicationVersion": "0.1.0",
  "schemaVersion": 5,
  "createdAt": "2026-10-21T10:34:00Z",
  "encrypted": false,
  "scope": "installation",
  "caseId": null,
  "files": {
    "clients.csv": {
      "rowCount": 2,
      "sizeBytes": 420,
      "sha256": "<64 lowercase hexadecimal characters>"
    },
    "documents/example.txt": {
      "rowCount": null,
      "sizeBytes": 12,
      "sha256": "<64 lowercase hexadecimal characters>"
    }
  }
}
```

The example file sizes/hashes/names are illustrative. `formatVersion` and
`schemaVersion` are positive integers; `applicationVersion` is the producing app's
version string. `scope` is `installation` or `case`; `caseId` is null for the former
and the selected case UUID for the latter. `files` is an object keyed by every
exported CSV/document's relative forward-slash path. Each entry has a nonnegative
integer `sizeBytes` and SHA-256 over the **exact bytes**, including CSV BOM/CRLF.
`rowCount` is a nonnegative integer excluding the CSV header (not the count of text
lines, since cells can contain newlines); it is null for binary documents.
The manifest excludes itself to avoid recursive hashing. There are no other data
files. Hashes detect accidental corruption; they do not authenticate an unencrypted
export against intentional replacement of both files and manifest.

## Versioning promise

Format version 1 fixes filenames, ordered CSV columns, types, null/quoting/formula
guard rules, scope and path semantics. Changes to these rules require a new export
format version, independently of the database migration and application versions.
Manifest consumers should ignore additional JSON fields, but must refuse unknown
format versions. Existing migrations are immutable; this feature adds no migration.
There is no importer, restore compatibility promise or encrypted export variant.
