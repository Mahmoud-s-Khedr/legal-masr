# LegalMaster Solo

Arabic-first, offline-first desktop practice organizer for individual Egyptian lawyers.

## Current milestone

The project is in the Phase 1 technical/security spike. It currently provides a Tauri desktop shell, Arabic lock/onboarding screens, a SQLCipher-backed local database, password/recovery-key envelopes, a foundation migration, and encrypted database backup validation.

It intentionally does **not** yet contain client, case, document, financial, or network features. Lawyer workflow research must validate those product fields before Phase 3 begins.

## Local development

```bash
pnpm install
pnpm tauri dev
```

Validation:

```bash
pnpm build
(cd src-tauri && cargo test && cargo check)
```

## Data and security

All database access stays in Rust. Passwords and recovery keys are never stored in React state beyond the current form input and never leave the device. The initial document uses a random database master key wrapped with Argon2id-derived password material and a separate recovery envelope.

This remains a technical spike, not a release-ready security audit. Cross-platform packaging, restore, documents, and independent cryptographic review are required before public use.
