# Pre-launch remediation execution — 2026-10-08

**Status: partial implementation; do not launch.** The complete requested plan has
not been implemented. Traceability checks pass and the initial vault-safety work
is implemented. Phase 1 acceptance remains open; dependent phases 2–7 remain open.
The independent misleading encryption disclosure was corrected alongside this work.

Baseline is `1502f73e3fd5bde4171953a607747b82cf67628e`. Validation used the uncommitted
source snapshot identified in the validation manifest. Its file hashes remain
comparable after committing. The user's `.gitignore` edit and original review/evidence
artifacts were preserved. No migration, cloud service, telemetry, outgoing
communication, or general frontend DB/filesystem/shell/HTTP capability was added.

[Issue register](2026-10-08-remediation-register.md),
[machine-readable scenarios](2026-10-08-remediation-register.json) and
[contribution tasks](2026-10-08-remediation-tasks.md) retain 17 blocker/high IDs,
146 domain-scoped appendix findings, each medium/low constituent, 69 command
coverage entries and outstanding audit assertions. There are 1234 entries,
including child constituents and partial-coverage statements. Inventory validation
is separate from workflow acceptance; all grouped findings remain open or partial.
Picker deadlock/timeout-overflow rejection and narrowed zeroization/search claims
remain explicit. Giant-vault failure and timer throttling require reproduction.

## Implemented changes

- Explicit `create_db` reserves a new filename without replacement. Ordinary
  `open_db` has no SQLite CREATE flag and refuses missing, empty, corrupt-header,
  legacy and newer-schema databases. Migration refuses newer versions before
  making changes. Synthetic fixture creation now uses the explicit API.
- Setup refuses stranded database/security files, SQLite sidecars, staged files,
  attachment/backup/snapshot directories and pending-operation artifacts. Its
  timeout validation is 1–1440. Status adds `vaultState`; incomplete/interrupted
  states cannot show setup/unlock forms and discard an existing native key.
- Setup and restore flush staged contents and an immutable native-owned intent
  before live replacement. Recovery resumes idempotently before status/unlock/
  credential recovery. A blocked replacement keeps the intent and staged data;
  the vault locks and the renderer drops prior caches after an interrupted restore.
- Each restore retains a unique emergency directory containing the previous
  database and managed attachments plus the previous security envelope. Later
  restores preserve earlier generations. Corrupt archive validation occurs before
  replacement. Existing v1 archive authentication/portability behavior is unchanged.
- Session/worker key owners, credential command strings, initialization inputs,
  decrypted key buffers, recovery-material temporaries and backup key buffers use
  zeroizing storage. Password change requires an unlocked session and authenticates
  the current password before changing security. This does not prove elimination
  of all compiler, framework or PRAGMA-string copies.
- Authentication observers reset after success/gate replacement; unobserved auth
  mutations have immediate garbage collection. Recovery-key UI state clears after
  acknowledgment. Full session-epoch/mutation-retention acceptance is still open.
- Idle locking retains a 30-minute fallback when settings are unavailable, tracks
  scroll/wheel activity and uses the latest callback without restarting deadlines.
  Single-instance registration now precedes other plugins and focuses/shows the
  existing window. The harness disables that plugin, so native journeys do not
  verify second-launch behavior.
- Arabic and English onboarding/privacy copy explicitly distinguishes encrypted
  databases/backups from plaintext managed files. Optional disk encryption is
  described as something the user can enable, rather than assumed protection.

## Executed evidence

[Source hashes and validation manifest](evidence/2026-10-08/remediation-validation.json)
identify the exact source files tested; the work has no new commit revision yet.
[Fresh Linux native results](evidence/2026-10-08/remediation-native-results.json)
include the rebuilt harness binary hash.

| Check                                                                | Result                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm test`                                                          | 243 Vitest tests and 48 Node script tests passed                |
| Final gate, idle-lock, onboarding and catalogue checks               | 27 tests passed after the disclosure changes                    |
| `pnpm lint`, `pnpm typecheck`, frontend production build             | Passed; existing large-chunk warning retained                   |
| Prettier for changed files and Rust format                           | Passed                                                          |
| Rust tests, `--all-features`                                         | 81 passed                                                       |
| Rust tests, `--no-default-features`                                  | 80 passed                                                       |
| Rust clippy, all targets, production and all features, `-D warnings` | Passed                                                          |
| Traceability verifier                                                | 1234 entries, 146 scoped appendix findings, 69 commands checked |
| Rebuilt debug desktop harness and Linux native journeys              | All five journeys passed                                        |

The normal desktop debug build (`pnpm tauri build --debug --no-bundle`) also
passed with production features. This validates compilation/embedding, not an
installer or supported-device journey.

Native journeys cover setup/client/case/attachment/backup/restore, wrong password,
cancelled restore preserving active data, corrupt restore preserving active data,
and restart persistence. Native picker behavior is replaced by the existing
allowlisted fixture selector. This is no Windows/macOS device or picker pass.

New assertions cover missing DB unlock/recovery without creating a replacement or
rewrapping security, future schema byte preservation, partial setup refusal,
correct/wrong/locked password changes, idempotent journal recovery, malformed and
path-escape intents, blocked replacement preserving files, repeated restore
snapshot retention, and idle fallback/activity/callback deadlines. Interruption
injection exercises three setup and five restore checkpoints (with and without an
old attachment directory). These are filesystem-state simulations after instrumented
transitions, not actual process kills, power cuts, or every preparation/fsync boundary.

During development a zeroizing-buffer coercion failed compilation, clippy rejected
a needless borrow, and a fixture assertion incorrectly read `security.previous`
after its recovery rename. Those were corrected and validation rerun. The earlier
failures are not evidence of workflow acceptance.

## Later pass

A [beta-readiness pass](2026-10-08-beta-pass.md) (same day, baseline `a6324c1`) re-checked and fixed the reproducible editing, layout,
theme and error-message findings, added migration `0002`, and ran the native journeys again. It does not change the
statement above that Phase 1 acceptance is open, and it does not certify beta readiness.

## Remaining acceptance and risks

1. Phase 1 still needs the operation coordinator, bounded workers, commit/session
   epochs and complete late-result cache/secret interleaving tests. Commands remain
   synchronous. Do not introduce asynchronous command concurrency yet.
2. Emergency snapshots are retained on disk, but authenticated selection,
   restore/export and explicitly confirmed deletion are not exposed to users.
   Snapshot retention alone does not complete B02 or the recovery feature.
3. Unix directory entries are flushed; Windows directory durability is unimplemented
   and actual sharing violations/permission/disk-full/process-kill recovery remain
   unverified. Failed replacement can require closing the external app and retrying
   startup recovery. Old/staged generations remain preserved.
4. The delayed-timer lifecycle-gap heuristic still needs native resume replacement
   and target-device throttling reproduction. Physical single-instance behavior and
   the complete native-memory/renderer-retention audit are open.
5. Standalone password-only disaster restore still requires backup v2. Streaming,
   resource limits, destination/history/progress/preview, automatic retention,
   file-integrity/viewing protections, exports/deletion/support/tray and all retained
   domain/finance/search/reminder/settings/UI issues remain in their assigned tasks.
6. Coverage/advisory/license/release-boundary suites, complete field/enum/cache and
   visual/keyboard matrices, low-memory fixtures, offline installers, physical
   Windows/macOS/Linux packages, Windows↔macOS restore and Egyptian privacy approval
   were not completed. Existing guide artifacts await phase 7 regeneration and
   still contain prior screenshots/copy. No public-beta acceptance is claimed.
