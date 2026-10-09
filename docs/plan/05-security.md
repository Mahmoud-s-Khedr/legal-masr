# Security

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 8.2 Application security and unlocking

### Security design

Use a randomly generated 256-bit database master key.

The key must not be derived directly and permanently from the password. Instead:

1. Generate a random database master key.
2. Generate a random password salt.
3. Derive a key-encryption key using Argon2id.
4. Encrypt the database master key using authenticated encryption.
5. Store only:

   - Crypto format version
   - Argon2 parameters
   - Salt
   - Nonce
   - Encrypted master key

6. Use the recovered master key to open SQLCipher.
7. Create a separate recovery-key envelope for the same master key.
8. Every backup embeds a copy of both envelopes so the password or recovery key
   can open it without this installation (see [07-backup-format.md](07-backup-format.md)).

### Security file

```json
{
  "version": 1,
  "kdf": {
    "algorithm": "argon2id",
    "memoryCost": 0,
    "iterations": 0,
    "parallelism": 0,
    "salt": "base64"
  },
  "passwordEnvelope": {
    "algorithm": "xchacha20poly1305",
    "nonce": "base64",
    "ciphertext": "base64"
  },
  "recoveryEnvelope": {
    "algorithm": "xchacha20poly1305",
    "nonce": "base64",
    "ciphertext": "base64"
  }
}
```

Actual Argon2 parameters must be benchmarked on lower-end Windows hardware. They must not be copied blindly from an AI-generated example.

### Lock behavior

- Lock application on launch.
- Lock after configurable inactivity.
- Lock when the device resumes from sleep.
- Clear sensitive in-memory state where practical.
- On a successful lock, clear renderer caches containing legal records and
  pending native file-picker source tokens as well as the Rust master key.
- Do not place passwords or keys in frontend state.
- Password processing occurs only in Rust.
- Never write secrets to logs.
- Allow password change by rewrapping the master key.
- Do not re-encrypt the entire database merely to change the password.

### Recovery

The recovery key should:

- Be generated during onboarding.
- Be displayed once.
- Be printable or savable explicitly.
- Never be sent to LegalMaster.
- Allow setting a new password.
- Not allow LegalMaster support to recover user data remotely.

### Security spike requirement

Before building product modules, prove all of the following:

- Create encrypted database on Windows.
- Close and reopen it.
- Reject an incorrect password.
- Change password.
- Recover with recovery key.
- Create an encrypted backup.
- Restore backup.
- Build the same code on Intel and Apple Silicon macOS targets.
- Verify no plaintext client data appears in the database file with a normal text search.

This spike is a release blocker.

---

# 12. Privacy and security controls

## 12.1 Network policy

The Rust application should have no general-purpose HTTP client available to feature modules.

Only the update subsystem may perform network requests.

The Content Security Policy must block unnecessary remote content:

```text
default-src 'self'
connect-src 'self' <approved-update-domain>
img-src 'self' asset: data:
style-src 'self' 'unsafe-inline'
script-src 'self'
object-src 'none'
frame-src 'none'
```

The final policy must be tested against the actual Tauri asset protocol and build.

## 12.2 Tauri permissions

Grant the smallest required capabilities.

React should not receive:

- Arbitrary shell execution
- Arbitrary process execution
- Unrestricted filesystem access
- Direct database access
- General HTTP access

File access should happen through narrow Rust commands or tightly scoped plugin permissions. Tauri's capability system supports limiting plugin permissions to specific windows and operations.

## 12.3 Logging

Logs may contain:

- Application version
- Operating system family
- Internal error code
- Operation duration
- Migration number
- Backup status

Logs must not contain:

- Client names
- National IDs
- Phone numbers
- Case numbers
- Case descriptions
- File contents
- Document paths
- Passwords
- Encryption keys
- SQLCipher keys

Use rotating local logs with a small retention limit.

## 12.4 Support bundle

A user-approved support bundle may include:

- Application version
- Operating system
- Safe configuration summary
- Redacted logs
- Schema version
- Failed operation codes

It must exclude the database and documents by default.

The user creates the bundle manually and decides how to send it.

## 12.5 Dependency security

CI should run:

```text
pnpm audit or equivalent review
cargo audit
cargo deny
license checks
dependency update checks
```

No dependency should be added solely because an AI agent prefers it.

Every dependency requires:

- A concrete use case
- Active maintenance
- Compatible license
- Platform compatibility
- Acceptable binary-size impact
- Security review for privileged plugins

## Vault lifecycle remediation — 2026-10-08

Database creation uses a separate native `create_db` function that refuses an
existing filename. All ordinary opens use SQLite flags without CREATE and refuse
missing, empty, corrupt, legacy or newer-schema databases. Setup refuses existing
database/security artifacts, managed-file directories, backup/snapshot directories
and interrupted-operation artifacts. Status returns `vaultState` (`EMPTY`,
`LOCKED`, `UNLOCKED`, `INCOMPLETE`, `INTERRUPTED`) alongside initialized/unlocked flags.
Incomplete and interrupted states cannot show setup or unlock forms.

Setup installs a flushed staged database/security pair through the same durable
intent mechanism used by restore. See [07-backup-format.md](07-backup-format.md)
for recovery and remaining platform limitations. Native session keys and owned
worker key copies use `Zeroizing` buffers. Authentication command strings and
initialization DTOs clear their owned buffers on drop; this is not a guarantee
that a runtime/compiler created no transient copies. Password changes require an
unlocked session and authenticate the current password before rewriting security.

The renderer clears the recovery-key state after acknowledgment, resets successful
authentication mutation observers and uses immediate garbage collection for
unobserved auth mutations. Idle locking uses a 30-minute fallback on settings
load failure, tracks scroll/wheel activity, and keeps a stable callback reference.
The existing delayed-timer lifecycle-gap heuristic remains; replacing it with a
native resume signal and reproducing target-device throttling are open tasks.
The 2026-10-10 integration adds operation admission, native session generations,
selection invalidation and renderer late-result rejection. Native pickers and heavy
backup work are asynchronous; cancellation and lock clear transient restoration
state. See [07-backup-format.md](07-backup-format.md) and the
[integration review](../reviews/2026-10-10-integration.md).
