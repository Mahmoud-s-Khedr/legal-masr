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
flag/schema value, and requires one exact archive inventory: exactly one
database, manifest, and checksum file, plus flat attachment entries only. It
rejects duplicate or unexpected ZIP names and requires the checksum map to
cover every database/attachment entry with no extras. It then verifies every
checksum. Malformed archives, missing entries, wrong keys, and mismatches fail
safely.

## Restore

Restore first validates and authenticates the selected archive. It extracts
attachments into a staging directory, writes the database to a staging file,
opens it with SQLCipher, rejects newer schemas, applies compatible migrations,
and runs SQLite integrity_check.

Only after validation does the replacement operation flush its staged database,
attachment files and (on Unix) directory entries, then write and flush an
immutable `vault-operation.json` intent. It moves the previous database and
attachment directory into a unique `EmergencySnapshots/<operation-id>/`
directory together with a copy of the current `security.json`. These snapshots
are retained; later restores never reuse or prune earlier generations.

Replacement is idempotent and rolls forward after interruption. Startup status,
unlock and recovery finish a valid pending operation before accessing the vault.
A blocked rename retains the intent, old generation and remaining staged data;
startup reports `INTERRUPTED` and disables setup/unlock if recovery cannot
complete. Corrupt archives fail before replacement and leave the active vault
unchanged. Windows directory durability and actual sharing violations still
require physical-device evidence; file contents are flushed on every platform.
The instrumentation tests simulate failure after each transition, not OS process
kills or power loss.

Emergency-snapshot selection, authenticated restore/export and confirmed deletion
are not yet exposed in the UI. Do not treat snapshot retention alone as completion
of the recovery workflow.

Attachment mutations are serialized with backup and restore, so the archive
cannot pair a database snapshot with a different attachment-directory state.
After a successful restore the vault locks and the UI drops its cached records;
the lawyer unlocks it again before viewing restored data.

## Known gaps

Portable cross-device restore with the original password is not yet designed or
validated: the current archive key derives from the active vault master key.
There is no restore preview, destination selection, automatic backups,
retention, history list, or repeated Windows/macOS device validation. These are
public-beta blockers.
