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

- SQLCipher database with password and recovery-key envelopes; passwords and
  master keys do not leave Rust.
- Managed-copy attachments accessed only by opaque ID/source-token commands;
  React never receives an arbitrary local path capability.
- Settings → Privacy identifies the local-data model, network policy, and
  aggregate usage-counter opt-in. Counters are local aggregate values only.
- Native reminders use generic, privacy-safe text.
- Local daily logs include only version, OS family, stable error codes, and
  allow-listed diagnostic facts; raw SQLite messages and personal/legal data
  are withheld.
- Manual encrypted backup, validation, staged restore, and latest successful
  backup metadata are available locally.

## Data-management status

The current client export command writes one JSON file containing the selected
client and linked domain records to a user-chosen folder. It is not the stable
CSV/manifest export format and does not copy attachment files.

The following privacy/data-management requirements remain unimplemented and
are release blockers:

- complete-installation, case, and documented CSV/manifest exports;
- guided permanent deletion for client, case, and all application data;
- deletion impact preview, text confirmation, optional emergency backup, and
  clear managed-file failure reporting;
- a manually generated redacted support bundle containing only approved system,
  version, safe settings, schema version, and error-code information.

No deletion workflow may promise forensic erasure from SSDs or third-party
backup media.
