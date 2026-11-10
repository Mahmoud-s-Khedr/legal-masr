# Patched SQLCipher source selection

`libsqlite3-sys` 0.39.1 passes the version check for
[RUSTSEC-2026-0459](https://rustsec.org/advisories/RUSTSEC-2026-0459.html),
but its `bundled-sqlcipher` feature pins `sqlcipher-src =419.0.6`. That
package contains SQLCipher 4.19.0 / SQLite 3.53.4, which is still affected.
Changing only rusqlite would leave the application vulnerable.

This private compatibility crate satisfies that exact build dependency and
re-exports the unmodified API from registry package `sqlcipher-src =420.0.0`
(SQLCipher 4.20.0 / SQLite 3.54.1). It contains no native source copy. Both the
forwarding crate and the actual registry package/checksum appear in
`src-tauri/Cargo.lock`; the old native sources are never compiled.

The application retains bundled SQLCipher, vendored OpenSSL, statement caching,
backup, custom SQL functions and checked unsigned integer conversions.
Rusqlite's defaults are disabled because its
new default wasm backend is unnecessary for the desktop application.

`src-tauri/tests/sqlcipher_runtime.rs` checks the actual linked engine versions,
encrypted WAL writes, backup/reopen, wrong-key rejection and ciphertext at rest.
The existing security/backup tests cover the application lifecycle and old backup
fixture. No audit exception or schema migration is required.

Remove this crate and the `[patch.crates-io]` entry when an upstream
`libsqlite3-sys` release selects fixed SQLCipher sources. Keep the linked-engine
regression tests: an audit of Rust package versions alone cannot detect this
native-source mismatch.
