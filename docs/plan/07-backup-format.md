# Backup format

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Current manual backup format

A successful manual backup is written in the application's local data directory
under Backups/ with a .lmsbackup extension. The destination is not yet
user-configurable.

The archive is an XChaCha20-Poly1305 encrypted envelope whose key is derived
from the unlocked database master key in a separate cryptographic context. Its
authenticated plaintext is a ZIP archive containing database.sqlite, generated
files under attachments/, manifest.json, and checksums.json.

manifest.json records format version, application version, schema version,
creation timestamp, whether the database is encrypted, and managed attachment
count. checksums.json maps every database/attachment archive entry to a SHA-256
checksum. It contains no destination path.

## Creation and validation

1. Create a consistent SQLCipher database snapshot with SQLite's backup API.
2. Copy files from the managed attachment directory.
3. Write checksums, manifest, and ZIP payload.
4. Encrypt with a fresh nonce, write to a temporary file, flush, and rename.
5. Reopen and authenticate the result; reject/remove it if validation fails.
6. Record a SUCCEEDED or FAILED aggregate backup-history entry, including
   completion time, size when available, and a stable error code only.

Validation authenticates the envelope, checks the manifest version/encryption
flag/schema value, requires checksum entries, and verifies the checksum of each
declared archive file. Malformed archives, missing entries, wrong keys, and
mismatches fail safely.

## Restore

Restore first validates and authenticates the selected archive. It extracts
attachments into a staging directory, writes the database to a staging file,
opens it with SQLCipher, rejects newer schemas, applies compatible migrations,
and runs SQLite integrity_check.

Only then does it replace the live database and attachment directory. It
renames the active database to a pre-restore emergency file, swaps staged
attachments/database, and rolls back the live files if either replacement
fails. A corrupt restore therefore leaves the active vault and attachments
unchanged.

## Known gaps

Portable cross-device restore with the original password is not yet designed or
validated: the current archive key derives from the active vault master key.
There is no restore preview, destination selection, automatic backups,
retention, history list, or repeated Windows/macOS device validation. These are
public-beta blockers.
