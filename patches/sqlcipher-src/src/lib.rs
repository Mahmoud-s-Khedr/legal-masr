//! Forward the source API expected by libsqlite3-sys to SQLCipher 4.20.0.
//!
//! The upstream 419.0.6 pin contains SQLite affected by RUSTSEC-2026-0459.
//! This crate contains no native sources; Cargo.lock identifies the actual
//! registry source package and checksum used to build SQLCipher.

pub use patched_sqlcipher_src::*;
