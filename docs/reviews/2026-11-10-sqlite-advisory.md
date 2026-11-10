# SQLite advisory remediation — 2026-11-10

## Failure

[Validate run 42723704934](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/42723704934)
passed frontend checks, Rust checks, coverage floors, desktop journeys and visual
comparison. Its dependency step failed on `cargo audit`: `libsqlite3-sys 0.30.1`
is affected by RUSTSEC-2026-0459 / CVE-2026-119375. The frontend production audit
passed. The audit failure prevented both debug packaging jobs from starting.

SQLite before 3.54.0 can disclose uninitialized page-cache memory when opening a
crafted database/WAL pair with mismatched page sizes. This is a native library
issue; retrying CI or weakening its audit gate does not fix it.

## Change

- Upgrade rusqlite 0.32.1 → 0.41.1 and libsqlite3-sys 0.30.1 → 0.39.1.
- Preserve bundled SQLCipher with vendored OpenSSL, backup, custom functions and
  statement caching. Disable the new default wasm backend for this desktop app.
- Address the upstream SQLCipher pin as well: libsqlite3-sys 0.39.1 still pins
  SQLCipher 4.19.0 / SQLite 3.53.4, which the advisory explicitly identifies as
  affected. A private source-API forwarding crate selects the unmodified registry
  SQLCipher 4.20.0 / SQLite 3.54.1 source package, with its checksum in Cargo.lock.
  See [patch rationale and removal criteria](../../patches/sqlcipher-src/README.md).
- Add linked-engine regression tests for fixed SQLite/SQLCipher versions and
  encrypted WAL writes, online backup/reopen, wrong-key rejection and ciphertext
  at rest. Existing lifecycle and old-backup-fixture tests remain in place.

Only the database wrapper, required cache dependencies and source selection
change in the lockfile. No audit ignore, schema migration, application network
access or user-data conversion is introduced. The Rust 1.89 minimum required by
rusqlite 0.41 is supported by the existing stable-Rust CI configuration.

## Validation

Validation results are recorded in the pull request. Full local Tauri compilation
requires GTK/WebKit development packages that are absent from this cloud image;
the attempted build fails at `glib-sys` because `glib-2.0.pc` is unavailable.
The focused runtime test can run separately with the same rusqlite features and
source patch, without linking Tauri. Full application tests and desktop journeys
must also pass in repository CI. Physical Windows/Linux acceptance remains a
release check.
