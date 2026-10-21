# Guided permanent deletion — 2026-10-21

Scope: public-beta blocker #3, part 1. Current public-launch targets are Windows
and Linux; macOS is excluded. No commits or branch operations were performed.

## Implementation

- Rust service/commands/DTOs: `src-tauri/src/services/deletion_service.rs`,
  `commands/deletion.rs`, `dto/deletion.rs`, module/handler registration and stable
  error codes. Existing `AppState::operation()` admission serializes deletion with
  backup/restore; the preview capability is cleared on lock.
- `src-tauri/migrations/0005_pending_file_deletions.sql` and the migration list add
  a STRICT native-only outbox. Existing numbered migrations/FKs are unchanged.
  Rows, outbox entries and partial-deletion search refresh commit together;
  managed files are unlinked afterward. Directory sync precedes clearing the
  outbox where supported. Failed removals remain tracked.
- `src-tauri/src/vault_operation.rs` adds a fixed durable reset marker and
  restartable cleanup through existing status/setup/restore recovery. The whole
  database is closed before unlink for Windows compatibility. Setup remains
  blocked while reset cleanup is incomplete.
- `src/features/deletion/api` and `components` supply a shared typed flow using
  existing alert-dialog, field, checkbox and button components. Archived detail
  pages expose client/case actions; Settings → Privacy exposes the danger zone
  and pending-file retry. Both locale catalogs, bridge contracts/session boundary,
  query invalidation, service/integration and React tests are updated.
- Plan topics, the schema reference and feature/testing inventory now describe
  implemented deletion and outstanding release work.

## Conservative decisions

1. A client must be archived, with every exclusive case/POA archived too. Shared
   cases or POAs refuse the entire operation with `DELETION_SHARED_INTEGRITY`;
   no links are silently detached. Exclusive POAs, their descriptive lawyers,
   case relationships/opponents, hearings, tasks, payments, fee agreements,
   expenses and documents are removed. Office-only records and other clients
   remain.
2. A case must be archived and have at most one client. Multi-client cases are
   refused to avoid removing another client's account/history. Its scoped work,
   finance and expense-owned documents are removed; clients/POAs remain.
   Retained cross-case hearing references and shared managed-file paths also
   block partial deletion. This intentionally favors refusal over guessing.
3. Preview returns record counts by table, existing managed-file count and, for
   reset, all vault-file count including backups/snapshots. Rust binds a random
   native token to the target, session generation and domain fingerprint; it
   checks the exact localized word (`حذف` / `DELETE`) and recomputes the plan.
   A changed domain requires another preview, even when counts are unchanged.
4. Backup first is initially selected. Existing encrypted backup runs before any
   record deletion. Partial-delete backups remain vault-local and retain earlier
   copies of deleted records. Reset requires current-password re-authentication;
   its optional backup must be successfully copied to a chosen location outside
   the vault. Cancel, failed authentication or failed backup/copy stops deletion.
   The preview counts precede this optional additional backup.
5. Reset removes domain/local rows in one transaction and the vault database,
   envelopes, managed copies, local backups, temporary artifacts and emergency
   snapshots afterward. The durable marker records authorization before the
   transaction; a crash resumes the authorized reset rather than presenting
   partially deleted data as a healthy workspace. Known safe diagnostic logs and
   files outside the vault remain. Welcome appears only after cleanup succeeds.
6. Unlink failure is a committed-deletion result with counts and retry, not a
   rollback claim. Partial operations retry only their own queued files; Settings
   can retry all pending removals. Missing files are already complete. Traversal,
   directory symlinks and retained paths cannot grant access outside managed
   storage. Reset unlinks symlinks without following their targets.
7. No forensic/secure-erasure promise is made. UI copy explicitly covers SSDs,
   disks and backup media. No new dependencies, services, network access,
   telemetry or sensitive logging were added.

## Validation

Validation results are recorded below. Every Rust test
invocation sets `XDG_DATA_HOME` to a newly created temporary directory and removes
only that directory afterward. The command runner rejected the shell `rm -rf`
cleanup wrapper before execution, so Python `TemporaryDirectory` provides the
same environment isolation and cleanup around the exact cargo test arguments.
No native desktop or visual/container suites were run.

| Check                                                       | Result                                      |
| ----------------------------------------------------------- | ------------------------------------------- |
| Rust tests, locked, all features, temporary `XDG_DATA_HOME` | Passed: 196 tests                           |
| `pnpm test`                                                 | Passed: 629 frontend + 80 Node script tests |
| `pnpm lint`                                                 | Passed                                      |
| `pnpm typecheck`                                            | Passed                                      |
| `pnpm format:check`                                         | Passed                                      |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Passed                                      |
| Clippy, all targets/features, warnings denied               | Passed                                      |
| `git diff --check`                                          | Passed                                      |

New coverage includes preview counts, archive/shared-integrity refusal, wrong
text/token/target/session, changed same-count records, transaction rollback,
post-commit unlink failures/retry, missing/retained files, traversal/symlink
safety, reset interruption, password refusal, backup failure/preservation and
restoring the saved pre-reset copy. React coverage includes cancel, wrong text,
password clearing, optional backup, preview expiry, file-failure retry, navigation,
cache invalidation/clearing, bilingual confirmation and archived-only placement.
The first Rust pass caught and fixed a nullable-SQL shared-path check. An early
frontend full run under concurrent cold Rust compilation had two workflow/gate
timing failures. An intermediate run started before the last suggestion-cache
edit was complete and failed the new cache assertion. The completed, stable
source passes all checks; no test timeouts or assertions were relaxed. The existing
DraftForm test emits a non-failing i18next setup warning.

## Unresolved risks

- No physical Windows or Linux desktop/installer/native-picker walkthrough was
  performed. Windows file-sharing locks, antivirus interference, directory flush
  behavior and real power loss still require disposable-device acceptance.
- Permission-denied or sharing-locked files can remain on disk until retry
  succeeds. Partial failures stay queued in the encrypted DB; whole reset retains
  its recovery marker. This feature cannot erase outside backups or storage
  remnants. Safe diagnostic logs remain by design.
- Preview hashes and the existing backup implementation can take time on large
  vaults; no large-vault performance measurement was run.
- Export/support-bundle parts of blocker #3 and the other public-release blockers
  remain open. Automated implementation validation does not certify launch readiness.
