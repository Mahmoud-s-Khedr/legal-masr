# Testing report — 2026-10-04

## Assessment

This hardening milestone adds report-only coverage, exhaustive bridge
contracts, backup/restore UI safety tests, and the missing formatter gate. The
working tree passed **185 automated tests**:

| Layer                       |              Result |
| --------------------------- | ------------------: |
| Vitest/React tests          | 130 tests, 19 files |
| Release-asset Node tests    |             2 tests |
| Rust unit/integration tests |            53 tests |
| Total                       |      **185 passed** |

Coverage is intentionally informational in this milestone. CI prints its
summaries and retains the reports without a percentage threshold.

## Coverage and safety improvements

- Vitest V8 covers production renderer code under `app`, `bridge`,
  `components`, `features`, `i18n`, and `lib`, excluding tests, fixtures,
  development capture helpers, and the renderer entrypoint. The local baseline
  is 53.86% statements, 79.41% branches, 61.46% functions, and 53.86% lines.
- Frontend reports are `coverage/coverage-summary.json` and
  `coverage/lcov.info`; Rust coverage runs all features and writes
  `coverage/rust/lcov.info`. The local Rust baseline is 47.63% lines, 47.82%
  regions, and 41.77% functions.
- The bridge matrix has 68 typed representative calls and proves each exposed
  TypeScript method invokes its exact Tauri command and argument envelope.
- Backup UI tests cover latest-backup loading, present and empty states;
  successful and failed create/validate actions; cancelled restore; successful
  restore cache clearing plus status refetch; and understandable restore
  failures. The renderer remains confined to typed bridge calls and does not
  access SQLite or native filesystems.
- Validation and release CI run `pnpm format:check`, both coverage commands,
  and upload the JSON summary and both LCOV reports for seven days.

## Remaining risks

1. Visual testing is still broken: `pnpm verify:visual` lacks an approved
   baseline manifest, captures do not compare against approved screenshots,
   and visual comparison is not in CI.
2. No test drives React through real Tauri IPC to a disposable vault. Rust
   integration tests exercise real SQLite/SQLCipher, but this does not prove a
   full desktop journey.
3. Coverage has no reviewed baseline or ratchet. It must not be treated as a
   release threshold until stable reports have been assessed.
4. Clients, cases, POAs, documents/attachments, hearings, dashboard,
   onboarding, and shared navigation need broader direct UI tests.
5. Performance remains untested at realistic legal-record volumes. The build
   still reports a large JavaScript chunk.

Visual baseline repair and physical Windows/macOS validation remain explicit
public-beta blockers. Mock-based tests and coverage do not establish native
rendering, picker, notification, autostart, sleep/resume, installer, or
cross-device restore behavior.

## Validation evidence

| Command                                                    | Result                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                                | Passed: 130 Vitest tests plus 2 Node tests                                                                    |
| `pnpm test:coverage`                                       | Passed: terminal V8 summary plus `coverage/coverage-summary.json` and `coverage/lcov.info`; no threshold      |
| `cargo test --all-features`                                | Passed: 53 tests                                                                                              |
| `pnpm test:rust:coverage`                                  | Runs all Rust features, prints a `cargo-llvm-cov` summary, and writes `coverage/rust/lcov.info`; no threshold |
| `pnpm lint`                                                | Passed                                                                                                        |
| `pnpm typecheck`                                           | Passed                                                                                                        |
| `pnpm build`                                               | Passed, with a chunk-size warning                                                                             |
| `cargo fmt --check`                                        | Passed                                                                                                        |
| `cargo clippy --all-targets --all-features -- -D warnings` | Passed                                                                                                        |
| `pnpm format:check`                                        | Passed after formatting report documents and ignoring generated `test-results/` output                        |
| `pnpm verify:visual`                                       | Still fails: missing visual-baseline manifest                                                                 |
| Validation and release CI                                  | Run formatter and both coverage commands; retain coverage artifacts                                           |
