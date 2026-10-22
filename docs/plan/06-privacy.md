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

There is no per-client export command; the encrypted backup is the only way
to take records out of the application.

The following privacy/data-management requirements remain unimplemented and
are release blockers:

- complete-installation, case, and documented CSV/manifest exports.

Support bundles are implemented as described below; target-device acceptance
remains open.

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

## Support bundle status — 2026-10-21

Settings → About offers a manual redacted ZIP beside the support contacts. A
localized dialog lists the exact contents and exclusions before the native save
picker opens. Nothing is sent or attached to a contact action automatically.

The only settings are allow-listed language and theme values (unknown values are
null). System metadata contains the compiled app version, OS family, numeric OS
version (Linux kernel or Windows major/minor/build; null when unavailable),
architecture and actual schema/migration number. Up to 14 fixed-name local log
files are read with a 1 MiB cap each. Only recognized startup/error structures
survive; recent-codes.log holds up to 200 recognized codes with UTC timestamps.
Raw diagnostic text, original filenames, unknown lines and unexpected fields are
dropped. README.txt explains contents and exclusions in Arabic and English.
Database files, records, documents, backups, credentials, names, office details,
contacts, national IDs, usernames and local paths are excluded. The user chooses
a fresh ZIP filename outside the vault; existing files are never overwritten.
See the [report](../reviews/2026-10-21-support-bundle.md) for validation and limits.
