# ZIP dependency advisory remediation — 2026-10-21

Scope: the format-v2 encrypted backup ZIP dependency and reader, for the public
Windows/Linux launch. macOS acceptance is outside this task. No schema, envelope,
command, renderer, translation, or vault-coordinator contract changes are needed.

## Findings and decision

The baseline local `cargo audit` reproduced three error-level vulnerabilities in
zip 2.4.2:

| Advisory                                                                   | Finding                                              | Patched range |
| -------------------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| [RUSTSEC-2026-0367](https://rustsec.org/advisories/RUSTSEC-2026-0367.html) | SUID/SGID preservation during extraction; high (7.3) | >=9.0.0       |
| [RUSTSEC-2026-0368](https://rustsec.org/advisories/RUSTSEC-2026-0368.html) | Extracted symlink targets outside the destination    | >=9.0.0       |
| [RUSTSEC-2026-0369](https://rustsec.org/advisories/RUSTSEC-2026-0369.html) | Permissions applied through symlinks; critical (9.1) | >=9.0.0       |

The [crates.io sparse index](https://index.crates.io/3/z/zip) lists 9.0.5 as the
latest stable 9.x release, with Rust 1.88 as its declared MSRV. The repository
declares no package MSRV and CI selects stable Rust; local Rust is 1.93.0. Select
9.0.5, preserve disabled defaults and the single requested `deflate` feature,
and update only zip and necessary dependencies with `cargo update -p zip`.

## Compatibility evidence

Before changing the dependency or writer, a one-time test called the existing
`source_with_backup()` helper and copied its output to
`src-tauri/src/backup/fixtures/format-v2-zip-2.4.2.lmsbackup`. The producer was
the existing `backup::create` at base revision
`601a6cd44972b1e283f321619284ac3c1bcbf61c`, using the locked zip 2.4.2 writer.
All records, attachment bytes, and credentials are fictional test data. The
temporary generator is removed after generation so upgraded code cannot silently
regenerate the old-writer evidence.

The fixture is 449,787 bytes with SHA-256
`ace32b833ecb943ee811402cd012ef60d8937b02f7cc8c4482b4eab3d646e0fa`.
Its provenance and generator are recorded in
[the fixture README](../../src-tauri/src/backup/fixtures/README.md). Its digest
is pinned by the regression test to prevent accidental regeneration.
A single-path `.gitignore` exception includes this fictional fixture while other
backup files remain ignored.

`old_zip_2_4_2_fixture_and_new_backups_validate_and_restore` uses both this fixed
fixture and a freshly created archive. It authenticates with the original test
password, validates the archive, prepares and commits through the existing vault
operation coordinator, unlocks the restored security file, and verifies
`CL-SOURCE`, the exact 4,096 attachment bytes, and the cleared operation journal.
It also rejects a wrong password without creating any destination files.

## Reader and API changes

- Adapt the newly fallible ZIP entry `name()` API; decoding failures retain the
  existing `BACKUP_CORRUPTED` error.
- Reject symlinks and directories in the validated inventory, including entries
  named as the database, manifest or checksums. The existing strict inventory and
  flat Windows-safe attachment names already reject absolute paths and every
  parent component; regression tests now cover Unix, drive, UNC and backslash
  forms explicitly. Failures precede creation of restore staging.
- Keep byte-copy restoration in the private staging directory. No ZIP extraction
  API, symlink creation, or archive permission application is used. Authenticated
  regular files with privileged or read-only attributes still restore their
  contents; Unix assertions compare actual permissions with a freshly created
  control file and check that privilege/sticky/execute bits were not installed.
- Construct hostile archives inside the tests, with authenticated envelopes and
  recomputed checksums. Symlink tests preserve valid database/metadata contents
  when checking entry types, and check that outside sentinel contents and
  permissions remain unchanged.
- `Error::Zip` still accepts zip's `ZipError`; no conversion rewrite was needed.
  Test the new owned archive-error detail variant and the existing missing-file
  variant to preserve the stable code and redacted ZIP diagnostics.

The lockfile was updated with `cargo update -p zip`, without a broad update.
Only zip's version changed; required new packages are `cfg_aliases`, `nix`,
`typed-path` and `zlib-rs`. Unneeded `arbitrary`/`derive_arbitrary` were removed,
and the existing flate2 version gained zip's required zlib-rs feature dependency.
No schema migration or user-visible string was added.

## Validation

Every Cargo test invocation used a fresh temporary `XDG_DATA_HOME`, cleaned by
Python's `TemporaryDirectory` after the command (equivalent to the requested
shell isolation). No developer vault was accessed. The initial full run exposed
an incorrect test assertion: zip 9's `unix_mode()` already masks privileged bits.
The test now reads raw central-directory attributes to establish malicious input
before checking restored filesystem permissions. Final rerun results follow.

| Check                                                                                           | Result                                                          |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Old-writer fixture generation with locked zip 2.4.2                                             | Passed before dependency update                                 |
| `pnpm test`                                                                                     | Passed: 579 Vitest tests, 60 Node tests                         |
| `pnpm lint`                                                                                     | Passed                                                          |
| `pnpm typecheck`                                                                                | Passed                                                          |
| `pnpm format:check`                                                                             | Passed                                                          |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`                                     | Passed                                                          |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed                                                          |
| Isolated `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features`              | Passed: 183 tests (131 unit, 52 integration), zero failures     |
| `pnpm build`                                                                                    | Passed; existing bundle-size warning                            |
| `git diff --check`                                                                              | Passed                                                          |
| `cargo audit --version`                                                                         | Installed: 0.22.2                                               |
| `cargo audit --file src-tauri/Cargo.lock --db <temporary advisory-db>`                          | Passed, exit 0; zero vulnerability errors, ten allowed warnings |
| `cargo tree --locked --manifest-path src-tauri/Cargo.toml -i zip`                               | Only zip 9.0.5, directly required by legalmaster-solo           |

The audit fetched 1,348 advisories and scanned the updated 522-package lockfile.
No other error-level advisory remains. No global tool installation was performed.

The frontend suite emitted its existing non-failing i18next setup warning; the
frontend build emitted the existing warning for a chunk larger than 500 KiB.
Visual/container captures and native desktop/office/control suites were not run,
as instructed. No Windows compiler/installer or physical Windows↔Linux restore
test ran here. Linux automated restoration is evidence for the format/library
update, not physical-platform release acceptance. macOS is out of launch scope.

## Remaining allowed audit warnings

The baseline has ten allowed warnings, rather than the seven in older reviews:

| Dependency         | Version | Advisory          | Category     |
| ------------------ | ------- | ----------------- | ------------ |
| proc-macro-error   | 1.0.4   | RUSTSEC-2024-0370 | unmaintained |
| unic-char-property | 0.9.0   | RUSTSEC-2025-0081 | unmaintained |
| unic-char-range    | 0.9.0   | RUSTSEC-2025-0075 | unmaintained |
| unic-common        | 0.9.0   | RUSTSEC-2025-0080 | unmaintained |
| unic-ucd-ident     | 0.9.0   | RUSTSEC-2025-0100 | unmaintained |
| unic-ucd-version   | 0.9.0   | RUSTSEC-2025-0098 | unmaintained |
| zbus_names         | 4.3.4   | RUSTSEC-2026-0371 | unmaintained |
| zvariant           | 5.13.1  | RUSTSEC-2026-0370 | unmaintained |
| zvariant_derive    | 5.13.1  | RUSTSEC-2026-0372 | unmaintained |
| glib               | 0.18.5  | RUSTSEC-2024-0429 | unsound      |

These are existing transitive findings, allowed by cargo-audit's current default
policy. No ignores or weakened audit configuration are introduced. They remain
dependency maintenance risks outside this focused update.
