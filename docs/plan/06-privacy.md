# Privacy

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Privacy by architecture

LegalMaster Solo is local-first: feature modules have no general-purpose HTTP
client, React has no database or arbitrary filesystem access, and the product
does not use cloud accounts, analytics, telemetry, or legal-record logs.
Application data, managed attachments, local backups, search index, and backup
history stay on the device unless the lawyer explicitly chooses a native file
operation.

The local-only design reduces vendor processing but does not certify a lawyer's
legal compliance. Before public release, an Egyptian privacy lawyer must review
the privacy notice and marketing must not claim blanket legal compliance.

## Implemented controls

- SQLCipher database with password and recovery-key envelopes. Authentication
  inputs are collected locally in the renderer and sent through typed commands;
  cryptographic processing and the database master key remain in Rust.
- Managed-copy attachments accessed only by opaque ID/source-token commands;
  React never receives an arbitrary local path capability.
- Settings → Privacy identifies the local-data model, managed-document storage,
  and network policy. Aggregate-counter consent remains backend-only; the UI
  has no opt-in control.
- The app shows no operating-system notifications, so no record details are
  surfaced outside the unlocked window.
- Local daily logs include only version, OS family, stable error codes, and
  allow-listed diagnostic facts; raw SQLite messages and personal/legal data
  are withheld.
- Manual encrypted backup, validation, staged restore, and latest successful
  backup metadata are available locally.

## Data-management status

There is no per-client export command. Complete-installation and case exports
are available as unencrypted CSV/document folders; encrypted backups remain the
separate recovery workflow.

The following privacy/data-management requirements remain unimplemented and
are release blockers:

- a manually generated redacted support bundle containing only approved system,
  version, safe settings, schema version, and error-code information.

No deletion workflow may promise forensic erasure from SSDs or third-party
backup media.

## Data-management status — 2026-10-21

Guided permanent deletion is implemented for archived clients, archived cases,
and the whole vault. The dialog shows per-table record counts and managed-file
counts; a native, session-bound preview token and the localized word (`حذف` or
`DELETE`) are required by Rust. Any domain change requires another preview.

Client deletion refuses shared cases/POAs and requires its exclusive cases and
POAs to be archived too. Case deletion refuses cases with multiple clients.
Retained cross-case hearing references and shared managed-file paths also block
partial deletion. The removed scope includes hearings, tasks, payments, fee
agreements, expenses and their attachments; direct office records are preserved.
Client deletion additionally removes exclusive POAs, lawyers and attachments.

Optional backup runs through the existing backup service before deletion.
Client/case backups stay in the vault and retain their previous records. Whole
vault deletion requires password re-authentication, and its optional backup must
be saved outside the vault. Existing vault-local backups and emergency snapshots
are removed; outside copies and safe diagnostic logs are retained.

Rows and search updates commit in one transaction. Migration `0005` adds an
encrypted native-only file-removal outbox; post-commit failures are counted and
retryable in the dialog or Settings → Privacy. A durable native reset marker
makes whole-vault cleanup restartable and blocks first-run setup until cleanup
finishes. No promise of forensic/secure erasure is made. Automated evidence and
remaining Windows/Linux device checks are in the
[deletion report](../reviews/2026-10-21-permanent-deletion.md).

## Export status — 2026-10-21

Complete-installation export is available in the separate unencrypted-export card
on Backups and Settings → Backups; case detail also exports active/archived cases.
Both require an explicit confidentiality warning before an asynchronous native
folder picker. The chosen folder must be outside the vault. The renderer receives
only a folder name and session-bound reveal token, never an arbitrary path.

Exports include archived records and verified managed document copies, with a
stable CSV/manifest contract. Case scope includes linked clients and their current
or archived fallback POAs, but no other cases or client-only/office tasks/expenses.
Shared client/POA documents are disclosed whole, as the warning explains. Export
folders and crash-left `.partial` folders contain plaintext and remain the user's
responsibility; vault deletion does not remove outside exports. Full scope,
columns, formula guards and failure semantics are documented in
[the export format](../export-format.md). Automated results and outstanding device
checks are in [the export report](../reviews/2026-10-21-exports.md). The redacted
support bundle remains unimplemented.
