# Backup format

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Current manual backup format

A successful manual backup is written in the application's local data directory
under Backups/ as `LegalMasr-backup-YYYY-MM-DD-HHmm.lmsbackup`, named after the
lawyer's local date and time (the interface supplies the stamp; the backend only
accepts the exact `YYYY-MM-DD-HHmm` shape). A second backup in the same minute
gets `-2`, `-3`, … so no backup is ever overwritten. The success message names
the file. «حفظ نسخة في مكان آخر…» copies the latest backup to a destination the
lawyer chooses in the native save dialog (written to a temporary name, flushed,
compared byte for byte, then renamed); «إظهار في المجلد» reveals it in the file
manager. The app never sends a path to the interface.

The archive is an XChaCha20-Poly1305 encrypted envelope whose key is derived
from the unlocked database master key in a separate cryptographic context. Its
authenticated plaintext is a ZIP archive containing database.sqlite, generated
files under attachments/, manifest.json, and checksums.json.

### Envelope versions

- **Version 1** (earlier releases): `{version, nonce, ciphertext}`. It opens only
  in the vault that made it.
- **Version 2** (current): adds `keyring`, a copy of the vault's `security.json`
  key envelope (the master key wrapped by the Argon2id password key and by the
  recovery key). It contains no plaintext key. A new installation can therefore
  restore it with the password that was in use when the backup was made, or with
  the recovery key. A version that disagrees with the presence of `keyring` is
  rejected as invalid.

Security consequence: anyone holding a version 2 file can attempt offline
password guesses against it, slowed only by Argon2id (19 MiB, 2 iterations) and
the 12-character minimum. A version 1 file could not be opened away from its
vault at all. This is the price of restoring on a new computer; the Backups page
tells the lawyer to keep the copy somewhere safe.

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

The restore runs in two steps. Choosing the file validates it and shows its
creation date and document count, with a warning that anything added or changed
after that date will not appear afterwards; only the confirmation starts the
replacement. The chosen file is remembered in memory under a one-time token, so
the interface never handles its path; locking forgets it. A backup from another
installation is reported as such (`BACKUP_FROM_OTHER_VAULT`) rather than as
damaged, and closing the file dialog is silent.

On a new installation (no vault artifacts at all), the welcome screen offers
«لديّ نسخة احتياطية من جهاز آخر». It accepts only version 2 files
(`BACKUP_NOT_PORTABLE` otherwise) and opens them with the backup's password, or
with the recovery key plus a new password (the recovery path then rewraps the
password envelope). A wrong secret (`BACKUP_SECRET_INVALID`) keeps the choice so
the lawyer can retry. The restore installs an empty vault sealed with the
backup's own key envelope through the setup journal, then runs the ordinary
journaled restore into it. If that second step fails cleanly, the empty vault is
removed again so the lawyer is back at the welcome screen.

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

Restoring a backup from another installation over an existing vault is refused;
moving an office is done from the welcome screen of the new installation.
Version 1 backups stay tied to the vault that made them. A restore still replaces
documents added after the backup (they remain in the emergency snapshot, which
the interface cannot yet open). There are no automatic backups, retention or
history list, and none of this has been validated on Windows or macOS devices.
