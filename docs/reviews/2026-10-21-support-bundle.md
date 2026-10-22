# Manual redacted support bundle

Implementation date: 2026-10-22. Task/report identifier: 2026-10-21; public-beta
blocker #3, part 3. Windows and Linux launch scope; macOS acceptance is excluded.
Changes remain in the working tree; no commit, branch or schema change.

## Implemented files and behavior

- `src-tauri/src/services/support_bundle_service.rs`: native picker, safe metadata,
  bounded log collection, ZIP creation and destination handling, with adjacent
  normal/failure/privacy tests. Entries are `README.txt`, `system.json`,
  `recent-codes.log` and optional numbered `logs/NN.log` files.
- `src-tauri/src/commands/support_bundle.rs`, command/service module registration
  and `src-tauri/src/lib.rs`: worker dispatch, operation gate and session checks.
  The renderer supplies no destination or arbitrary file-read capability.
- `src-tauri/src/logging.rs`, `src-tauri/src/errors/mod.rs`: exact-structure
  allow-list redaction; all builds log stable command-error codes without dynamic
  diagnostic details. A test captures the actual tracing formatter and serializer.
- `src/bridge/commands.ts` and its contract test, settings API, SettingsPage and
  `SupportBundleSection.tsx` / adjacent tests: About entry beside support contacts,
  inclusion/exclusion dialog, async save, cancellation, pending state, success and
  contextual errors. Both i18n catalogs contain the complete Arabic/English copy.
- Plan security/privacy/functional/roadmap status, feature inventory and launch
  checklist updated. Existing migrations and database schema are unchanged.

## Conservative decisions

Only language (`ar`/`en`) and theme (`system`/`light`/`dark`) settings are exported.
Unknown values become null; profile, free-form settings and legal rows are never
serialized. OS metadata is limited to the numeric Linux kernel version or Windows
major/minor/build (null if unavailable), OS family and architecture. No hostname,
distribution label, service-pack text, username or environment value is exported.
No new dependency, telemetry or application network call was added.

Log collection accepts only fixed logger filenames, skips symlinked files, refuses
a symlinked log directory and replaces filenames with fixed archive names. It
keeps the newest complete lines within 1 MiB per file, at most 14 files and 200
recent recognized error codes. Exact UTC timestamps, this build's startup version,
known OS values and enumerated error codes are reconstructed. Unknown lines,
fields, old debug-detail structures, malformed/partial lines and unsupported
codes are dropped. Path/contact/long-number checks provide a second rejection
layer. No raw log bytes are copied. The bilingual README explains these limits,
the included information, exclusions and manual sharing.

Saving requires a fresh `.zip` filename outside the canonical vault tree. Existing
files and symlinks are refused consistently across platforms. Writes are flushed;
a write failure attempts to remove the partial file and returns an opaque existing
error code. The picker holds no operation gate; generation and unlock checks run
again before writing. The app does not send the bundle or attach it to a contact.

## Validation

All Rust test invocations use a newly created temporary `XDG_DATA_HOME` and clean
it afterward with Python's `TemporaryDirectory`; the shell's recursive-remove
wrapper was rejected, so no bare cargo test was used. No real vault was accessed.
Native desktop and container/visual suites were deliberately not run.

| Check                                                                                           | Result                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm test`                                                                                     | Passed: 639 Vitest tests and 91 script tests                       |
| Isolated `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features`              | Passed: 213 tests (158 unit, 55 integration); doc tests passed (0) |
| `pnpm lint`                                                                                     | Passed                                                             |
| `pnpm typecheck`                                                                                | Passed                                                             |
| `pnpm format:check`                                                                             | Passed                                                             |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`                                     | Passed                                                             |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed                                                             |
| `git diff --check`                                                                              | Passed                                                             |

The first frontend run exposed a new mutation/bridge test failure, which was
fixed, and an unchanged app-lock test timed out under compilation load. Its
isolated rerun and the final full frontend rerun passed. The new test compile
errors and Clippy warning were corrected before the final successful checks.

Seeded privacy tests inspect every ZIP entry for client/Arabic names, Linux and
Windows home paths, email, Latin/Arabic phone and national-ID numbers, and a
password-like token in logs and settings. Additional tests cover exact entries,
known/unknown settings, byte/file/code limits, missing/invalid/symlinked logs,
new/existing/invalid destinations, symlink aliases into the vault, injected partial
write failure cleanup, numeric OS-version sanitization, locked/stale sessions and
Arabic/English dialog listing, cancel, native cancel, success, pending and retry.

## Remaining risks

Physical Windows/Linux save dialogs, Windows version FFI, package behavior,
permissions, disk-full handling and power-loss behavior remain unverified.
The injected write-failure test does not constitute a physical disk-full test.
Recent events can be absent until the non-blocking logger flushes; bounded or
unrecognized history is intentionally omitted. Failure to remove a partial ZIP
on a damaged/unwritable filesystem may leave a partial redacted archive. Local
hostile filesystem races are outside the guarantee; only reconstructed safe
fields can enter the archive even if log files change during collection.
This implementation does not certify public launch or close unrelated blockers.
