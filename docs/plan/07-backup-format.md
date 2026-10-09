# Backup format

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Current manual backup format

A successful manual backup is written in the application's local data directory
under Backups/ with a .lmsbackup extension. The destination is not yet
user-configurable.

The archive is an XChaCha20-Poly1305 encrypted envelope whose key is derived
from the database master key in a separate cryptographic context. Since format
v2 the envelope header also carries a copy of the vault's password and
recovery-key envelopes, so the master key (and with it the archive) can be
recovered from the password or recovery key alone; see
[Portable recovery](#portable-recovery-format-v2). Its authenticated plaintext
is a ZIP archive containing database.sqlite, generated files under
attachments/, manifest.json, and checksums.json.

manifest.json records format version (equal to the envelope version),
application version, schema version, creation timestamp, whether the database is
encrypted, and managed attachment count. checksums.json maps every
database/attachment archive entry to a SHA-256 checksum. It contains no
destination path.

## Creation and validation

1. Create a consistent SQLCipher database snapshot with SQLite's backup API.
2. Copy files from the managed attachment directory.
3. Write checksums, manifest, and ZIP payload.
4. Encrypt with a fresh nonce, binding the header (including the copied
   security envelopes) as associated data; write to a temporary file, flush,
   and rename.
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

Restore first validates and authenticates the selected archive (with the active vault key, or with the backup's own password or recovery key). It extracts
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

## Portable recovery (format v2)

Status: implemented 2026-10-09 and covered by Rust and native Linux tests.
Windows↔macOS portability is **not** established and stays a separate
physical-device gate (see [09-testing.md](09-testing.md)). Approved decisions:
backup strength equals password strength (accepted); a backup opens with the
password current when it was made, or the recovery key (accepted); Settings may
also restore a backup made by another installation (accepted).

### Why a v1 archive cannot be opened elsewhere

The vault master key is 32 random bytes made at setup. The SQLCipher database
and the v1 archive key (`SHA-256(master ‖ "LegalMasterSolo/backup/v1")`) both
derive from it. Only the two envelopes in `security.json` turn the password or
recovery key into that master key, and a v1 archive did not carry them. A second
installation draws a different random master, so decryption could never succeed,
with or without the password.

### Format v2

```
.lmsbackup (JSON)  {
  "version": 2,
  "security": { version, salt, memory_kib, iterations, parallelism,
                password_envelope, recovery_envelope },   // = security.json
  "nonce": ..., "ciphertext": ...   // XChaCha20-Poly1305(backup_key(master), zip)
}
```

- The `security` block is the vault's own `security.json` content, copied when
  the backup is made. No password or recovery key is needed to _create_ a
  backup. The master key never changes and the archive is still encrypted under
  the backup key derived from it.
- Open with the password: Argon2id(password, header salt/parameters) → unwrap
  `password_envelope` → master → backup key → decrypt. Open with the recovery
  key: the existing normalized recovery-key material → unwrap
  `recovery_envelope` → the same path.
- The header is bound to the body as authenticated data: a fixed-order,
  length-prefixed encoding of the format version, every `security` field and the
  nonce. Changing any of them makes the body fail authentication.
- The header is untrusted input, so its Argon2 cost is bounded before any
  derivation (memory ≤ 256 MiB, iterations 1–10, parallelism 1–8,
  memory ≥ 8 × parallelism); anything else is `BACKUP_CORRUPTED`.
- A v1 envelope never has a `security` block and a v2 envelope always has one;
  a file that breaks that rule was rewritten and is `BACKUP_CORRUPTED`.
- A backup opens with the password that was current when it was made, or with
  the recovery key (which does not change when the password does). Changing the
  password later does not re-seal older backups; the interface says so.

Security consequence: a v1 backup was protected by a 256-bit random key that
never left the device. A v2 backup is protected by the password (minimum 12
characters, Argon2id 19 MiB / 2 passes, the same strength as `security.json`
plus the database today) or by the 256-bit recovery key. A leaked backup is as
guessable as the password is weak. This is inherent in "restore with only the
password". There is no attempt limit on restore, as there is none on unlock.

### Format versions and v1 compatibility

- New backups are always v2. The ZIP layout and all inventory and checksum rules
  are unchanged; the manifest `formatVersion` must equal the envelope version.
- A v1 archive restores in the installation that made it (any vault holding the
  same master key), exactly as before. It cannot be opened on another
  installation; the lawyer is told to open it on the original device and make a
  new backup. Selecting one in the portable restore screen shows that message
  instead of a credential form.
- An envelope version above 2, or a manifest or database schema newer than this
  build, is `BACKUP_NEWER_VERSION`, detected before anything is staged.

### Error contract

One code per user decision; no code covers two different causes.

| Situation                                                                       | Code                                |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| Not a backup: garbage, non-JSON, empty, truncated, bad base64 or nonce          | `BACKUP_CORRUPTED`                  |
| v2, a header field other than the password envelope altered; ciphertext altered | `BACKUP_CORRUPTED`                  |
| Inventory, manifest or checksum mismatch; staged database fails its checks      | `BACKUP_CORRUPTED`                  |
| v2, the typed password did not unwrap the master key                            | `INVALID_PASSWORD` (existing)       |
| v2, the typed recovery key did not unwrap the master key                        | `RECOVERY_KEY_INVALID` (existing)   |
| v1, or a v2 opened with the active vault key, and that key is not the file's    | `BACKUP_KEY_MISMATCH` (new)         |
| Envelope, manifest or database schema newer than this build                     | `BACKUP_NEWER_VERSION` (new)        |
| File unreadable (missing, permissions)                                          | `OPERATION_FAILED` (I/O, unchanged) |

Two limits of what the cryptography can tell apart: damage to the password
envelope itself is indistinguishable from a wrong password (`INVALID_PASSWORD`),
and without credentials a wrong key and a damaged body look the same to the
cipher (`BACKUP_KEY_MISMATCH`). Once a credential has unwrapped the master key,
any later failure is damage or tampering. Arabic and English catalogue entries
exist for both new codes; messages never contain a path or file name.

### Restore without an unlocked vault

New native commands; React never sees a path:

- `backup_select_for_restore` opens the native picker (a fixture in the test
  harness), reads only the header, stores the path in `AppState` under a
  one-time token and returns `{ token, formatVersion }`. A new selection
  replaces the old one; locking clears it. It is refused (`APP_LOCKED`) on a
  healthy locked vault and (`VAULT_INTERRUPTED`) while a journal is pending.
- `backup_restore_selected(token, { kind: "password" | "recoveryKey", secret })`
  restores. Secrets are zeroized at the command boundary like `app_unlock`. A
  mistyped secret keeps the selection so it can be retried without choosing the
  file again; every other outcome ends it. The vault locks afterwards.

The existing no-argument `backup_validate` and `backup_restore` remain for
same-installation use with the active vault key and return the new codes.

Entry points (one shared component: choose file → password or recovery key →
result):

1. Setup (`EMPTY`): "Restore from a backup" below the setup form.
2. `INCOMPLETE` gate (including the `VAULT_MISSING` outcome): beside "Retry".
3. Settings → Backups, after `BACKUP_KEY_MISMATCH`, for backups made by another
   installation: "Restore with the backup's password or recovery key", with a
   warning that the workspace is replaced and a copy kept.

Not offered on the locked unlock gate (a healthy vault is not replaced from an
unauthenticated screen) nor on `INTERRUPTED` (a pending operation finishes
first).

### Which security material the restored vault keeps

- The archive's master key equals the active vault's: the current
  `security.json` stays, so the current password keeps working.
- Different master key, or no usable active vault: the restored workspace adopts
  the archive's `security` block as its `security.json` and unlocks with the
  backup's password and recovery key. The replaced file is moved, with the old
  generation, into the emergency snapshot.

### Journal and emergency snapshots

Authentication, validation, staging and the SQLite integrity check all happen in
`*.restore.tmp` staging before any live file is touched. A wrong password or
recovery key, a damaged, tampered or truncated file, a newer version, or a failed
check removes the staging files and leaves the destination byte-identical
(tests hash the whole tree before and after).

On success the existing journal is extended, not replaced:

- `vault-operation.json` remains an immutable intent flushed before the first
  live rename. It gains `had_database`, `had_security` and `adopt_security`;
  they default to the previous behaviour when an older intent is read. A journal
  naming a field this build does not know fails closed (`VAULT_INCOMPLETE`).
- When security is adopted a staged `security.restore.tmp` is installed with the
  database and attachments after the old `security.json` is moved into
  `EmergencySnapshots/<operation-id>/`. When it is kept, it is copied there as
  before.
- Whatever existed (database, `security.json`, attachments, including the
  leftovers of an `INCOMPLETE` install) is moved, never deleted. Missing pieces
  are skipped, and a fresh installation creates no snapshot at all.
- Recovery rolls forward idempotently after interruption; tests interrupt every
  step for every combination of what existed and whether security is adopted.
- Staging left by an attempt that never wrote the intent is removed at the start
  of the next restore. A power loss in that window leaves staging files that
  make the installation report `INCOMPLETE`, from which restore is available.
- Restore holds the attachment and security locks like the existing restore.

### Database migration

None. The schema, `schema_migrations` and every migration are untouched; the
change is confined to the archive header, the restore journal (a JSON file) and
Rust/React code. Restored databases still go through the forward-only migration
step.

### What is and is not verified

Rust unit and service tests, plus native Linux journeys (fresh installation and
`INCOMPLETE` installation, wrong password then original password, byte-identical
attachment). Not verified: Windows, macOS, physical file dialogs, Windows
directory durability, power loss, and any Windows↔macOS exercise.

## Known gaps

Windows↔macOS portable restore has not been exercised on physical devices; the
Linux automated restore into an empty installation does not pass that gate.
There is no restore preview, destination selection, automatic backups,
retention, history list, attempt limit, or repeated Windows/macOS device
validation. The emergency-snapshot browser, authenticated export and confirmed
deletion are still absent. These are public-beta blockers.
