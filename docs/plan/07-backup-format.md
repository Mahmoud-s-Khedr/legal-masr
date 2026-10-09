# Canonical backup and restore

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Archive

The application is offline. Manual backups are written under the local `Backups/`
folder as `legal-masr-YYYY-MM-DD-HH-mm-ss-<UUID>.lmsbackup`. The timestamp follows
local calendar time; the UUID prevents collisions. Save-copy and reveal actions
use narrow native commands. Paths and prepared encryption keys never reach React.

There is exactly one supported format: envelope version **2**, with mandatory
`security`, `nonce` and `ciphertext` fields. Other versions, missing fields and
unknown envelope/security fields are rejected as `BACKUP_CORRUPTED`, with an
unsupported/invalid-backup explanation. There are no older-format readers,
conversion tools, alternate key stores, or compatibility command wrappers.
Existing numbered database migrations remain immutable.

The security header contains the password and recovery envelopes for the master
key. XChaCha20-Poly1305 authenticates the complete header as associated data,
including version, salt, Argon2 parameters, both key envelopes and the body nonce.
The body key is SHA-256 of the master key and the domain separator
`LegalMasterSolo/backup/canonical/v2`. A new 24-byte nonce is generated each time.
The encrypted ZIP contains exactly:

- `database.sqlite`: a consistent SQLCipher snapshot made with SQLite's backup API;
- `attachments/<generated-name>`: flat managed attachment entries;
- `manifest.json`: format/application/schema versions, UTC creation time,
  encrypted-database flag and document count;
- `checksums.json`: SHA-256 for every database and attachment entry, with no extras.

Validation rejects duplicate/unexpected ZIP entries, traversal, unsupported file
names, checksum/count mismatches, newer database schemas, invalid databases and
attachment metadata mismatches. Flat names must also be valid on Windows;
case-insensitive collisions are refused. Staged databases receive integrity and
foreign-key checks. Existing database migrations run only on the staged copy.

Untrusted header parameters are checked before password derivation. Argon2id is
bounded to 262,144 KiB, 10 iterations and 8 lanes, with nonzero parameters and
minimum memory of eight KiB per lane. Generated security material uses 19,456 KiB,
two iterations and one lane, a 32-byte salt, and fixed-size key envelopes. Holding
an archive permits offline password guessing: archive strength depends on the
password. Passwords/recovery keys and prepared plaintext buffers are zeroized
when native transient state is dropped.

Creation writes a unique temporary file, flushes it, reopens and authenticates it,
then atomically publishes a collision-safe name and flushes its directory. Save
copies use unique temporary files, flush and compare bytes before publication,
and remove temporary files on failure. The latest successful summary contains
only time and size. History retains stable failure codes, never secret data.

## One reusable workflow

Setup, incomplete-installation recovery and Settings share
**choose → authenticate and prepare → preview → confirm**.

1. `backup_select_for_restore()` returns `{token, fileName}` after the native
   picker and envelope checks. The selected path remains native.
2. `backup_prepare_restore(token, credential)` authenticates and fully validates
   the staged snapshot. `credential` is null for an active-key attempt, or
   `{kind: "password", secret}` / `{kind: "recoveryKey", secret, newPassword,
confirmPassword}`. It returns `{token, createdAt, documentCount, passwordSource}`.
3. Preview reports the creation time, document count and password to use. Live
   files remain unchanged. Validation-only uses the same preparation step.
4. `backup_commit_restore(token)` consumes the prepared token once and installs
   that validated snapshot. `backup_cancel_restore()` clears both selection and
   preparation, deletes staging and invalidates pending picker/preparation results.

A new selection supersedes the previous one. Wrong credentials may retry the
selected file. Renderer credentials are cleared before awaiting preparation and
are never kept in a mutation cache. Cancellation, unmounting, lock, successful
replacement and workspace cache clearing discard transient state.

Empty and incomplete installations can restore after authenticating the archive.
An unlocked installation can replace its own or a different vault. A healthy
locked installation refuses replacement, as does any unfinished journal.
Password restore preserves the current security file when the master key matches;
otherwise it adopts the authenticated backup security file. Recovery-key restore
requires a new password of at least twelve characters and matching confirmation.
Its new password envelope is staged with the replacement, so password reset and
restoration form one journaled operation. Same-key recovery preserves the current
recovery envelope; foreign recovery adopts the backup's recovery envelope.

Replacement flushes staging, records an immutable `vault-operation.json` intent,
and retains replaced database, attachments and security in a unique
`EmergencySnapshots/<operation-id>/` directory. Snapshots are never automatically
pruned. Journal replay rolls forward idempotently after interruption. A failed
rename retains the intent and remaining files; the vault stays locked and reports
`VAULT_INTERRUPTED` if replay cannot finish. Successful restoration ends locked;
the gate explains whether to use the current, backup or newly chosen password.
Emergency snapshot browsing/export/deletion is separate future recovery UI work.

## Session and native behavior

Native pickers run on worker threads and never hold the vault-operation gate.
Commands recheck session generation after asynchronous work; cancellation also
invalidates selection requests. Vault commands share a nonblocking exclusive gate,
reporting `OPERATION_BUSY` for overlaps. Lock invalidates outstanding sensitive
results immediately. Prepared state is stored only if both the selection and
session still match. React's IPC boundary rejects late responses across lock,
unlock, password/security changes and replacement.

Normal and failure tests cover authentication, tampering, bounded parameters,
unsupported formats, staged preview/cancellation, stale tokens, destination states,
attachment preservation and journal interruptions. Physical Windows/macOS file
sharing, directory durability and cross-platform restoration remain validation
gates until actually exercised. This implementation does not certify release
readiness. See [09-testing.md](09-testing.md) and the integration review report.
