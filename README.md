# LegalMaster Solo

Arabic-first, offline-first desktop practice organizer for individual Egyptian lawyers.

## Current milestone

The project contains the Phase 1 security spike and Phase 2 application foundation: a Tauri desktop shell, Arabic-first onboarding and lock screens, a SQLCipher-backed local database, password/recovery-key envelopes, immutable migrations, encrypted backup creation/validation/restore, settings storage, and a guarded application shell.

It intentionally does **not** yet contain client, case, document, financial, or network features. Lawyer workflow research must validate those product fields before Phase 3 begins.

## Local development

```bash
pnpm install
pnpm tauri dev
```

### Development diagnostics

To show sanitized command diagnostics in the browser console and relevant failure panels, run:

```bash
VITE_DETAILED_DIAGNOSTICS=true pnpm tauri dev
```

The flag is ignored in release builds. Diagnostics contain only a command name, stable error code, and allow-listed implementation facts (for example, a missing SQLite column); they never include legal records, document paths, passwords, or encryption keys.

Validation:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all-features)
pnpm tauri build --debug --bundles deb
```

Format frontend and project files with `pnpm format`; Rust code is formatted with `cd src-tauri && cargo fmt`.

## Data and security

All database access stays in Rust. Passwords and recovery keys are never stored in React state beyond the current form input and never leave the device. The initial document uses a random database master key wrapped with Argon2id-derived password material and a separate recovery envelope.

See [docs/BUILDING.md](docs/BUILDING.md) for Fedora prerequisites and local Linux builds, [docs/RELEASING.md](docs/RELEASING.md) for the draft-release workflow, and [docs/SIGNING_POLICY.md](docs/SIGNING_POLICY.md) for the unsigned Windows and ad-hoc macOS policy.
