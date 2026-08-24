# LegalMaster Solo

Arabic-first, offline-first desktop practice organizer for individual Egyptian
lawyers. Legal records, encryption material, managed attachments, search, and
backup history remain on the lawyer's device.

## Current implementation

The canonical Legal Masr domain is implemented through migration
`0007_canonical_legal_masr.sql`: clients, powers of attorney, cases and their
client relationships/opponents, hearings, tasks, managed-copy attachments,
fee agreements, payments, expenses, reminders, local search, and aggregate
opt-in usage counters.

The application uses a Tauri 2 / React / TypeScript shell and a Rust-only
SQLCipher boundary. The UI is Arabic RTL by default, supports English as a
preference, keeps legal dates as `YYYY-MM-DD` values, and stores EGP values as
integer minor units. Native file selection/open/reveal happens through narrow
Rust commands; React does not access SQLite or arbitrary local paths.

Available privacy and recovery features include password/recovery-key vault
access, locking, local manual encrypted backups with checksum validation,
staged restore with rollback protection, backup history, native safe
reminders, optional autostart, and an in-app privacy/data-location screen.

## Known release blockers

This is not ready for a public beta. The following work remains:

- visual sign-off from fresh seeded application captures at 1440×900 and
  1366×768;
- repeated portable restore and native Windows/macOS runner/device validation;
- automatic backup/retention and restore preview;
- documented full-installation and case exports, permanent deletion, and a
  redacted support bundle.

See [the finalized correction plan](docs/finalized-domain-correction-plan.md)
and its [Phase 7 report](docs/finalized-domain-phase-7-report.md) for the
current decision record and evidence.

## Local development

```bash
pnpm install
pnpm tauri dev
```

For sanitized developer diagnostics in a development build only:

```bash
VITE_DETAILED_DIAGNOSTICS=true pnpm tauri dev
```

To populate a newly initialized, empty development vault with non-production
Arabic demo data through the same typed app APIs used by the UI, opt in at
launch:

```bash
VITE_SEED_DEMO_DATA=true pnpm tauri dev
```

The seeder runs only in a development build, skips every non-empty vault, and
does not create attachments or access SQLite from React. It is intended for
local visual and workflow testing only.

Diagnostics contain only a command name, stable error code, and allow-listed
implementation facts. They never contain legal records, document paths,
passwords, or encryption keys.

## Validation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all-features)
pnpm tauri build --debug --bundles deb
```

Format frontend and project files with `pnpm format`; format Rust with
`cd src-tauri && cargo fmt`.

## Security and data handling

The database master key is random and is wrapped separately for the password
and recovery key using Argon2id and authenticated encryption. Managed
attachments are normal local files protected by the operating-system account
and full-disk encryption; they are not individually application-encrypted.

See [docs/BUILDING.md](docs/BUILDING.md) for local build prerequisites,
[docs/RELEASING.md](docs/RELEASING.md) for the draft-release workflow, and
[docs/SIGNING_POLICY.md](docs/SIGNING_POLICY.md) for current signing policy.
