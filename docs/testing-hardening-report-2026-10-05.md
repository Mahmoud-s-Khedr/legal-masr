# Test hardening evidence — 2026-10-05

This report records the remaining test hardening programme, using fictional
records and disposable vaults. Measurements were collected from an uncommitted
tree based on `33c7f15ce6bb54bc70ad9740ba8a1b96631e9a3c`. That implementation
was subsequently committed as `e0f34416514a3ad64bab7769cda84bddd39079d2`.
Committing does not establish fresh committed-revision coverage evidence.
No remote CI run, Windows execution or physical-device pass is claimed.
The source fingerprint and three coverage measurements are recorded in
[the proposed coverage policy](../tests/coverage-policy.json).

## Implemented changes and defects

### Visual comparisons

There are 64 screenshot assertions: 16 routes × Arabic/English ×
1366×768/1440×900, plus one keyboard navigation/dialog focus test. The browser
clock is fixed at the fixture date, timezone is Africa/Cairo, theme is light,
and capture waits for route content, fonts and decoded images. Animations are
disabled. The pixel threshold is 0.2 and maximum differing-pixel ratio is 0.001.

The canonical environment is Ubuntu 24.04 with Playwright 1.63.0 Chromium:
`mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`.
Approved images must be tracked in `tests/visual/baseline`; actuals, differences,
traces and reports are ignored. The separate update command refuses CI.
Manifest verification checks all 64 unique combinations, filename safety,
regular files, PNG CRC/decompression/dimensions and SHA-256 hashes. Nine
regression tests include missing entries/files, duplicates, corruption,
traversal, wrong dimensions and symlinks.

Corrections include an attachment fixture with two owners, a duplicate
upcoming-hearing fixture, English onboarding capture locale and an initial
image-decode race. The strict comparison caught that race before acceptance.
The [offline candidate gallery](../tests/visual/review.html) is ready for review.
Original Stitch reference assets are absent from this checkout; design parity
has not been established. The manifest remains **candidate**, and release
validation rejects it until the user approves the baseline.

Representative captures were inspected for readiness and layout. Existing
Arabic content remains in some English workflow pages, and a long fictional
email wraps in the narrow contact card. The gallery exposes these details for
review; repeatable screenshots do not establish translation or design quality.

### Attachment failure handling

Twelve component tests use typed bridge mocks with real query hooks and isolated
query clients. They cover loading/empty/populated owner-scoped results, add,
edit, remove, cancellation, read/picker/open/reveal failures, failed copy/source
selection, draft preservation, retries, pending submissions and invalidation.
Cancellation performs no mutation. A failed add requires a fresh selection
because the source token has been consumed; metadata remains available.

Rust filesystem and opener adapters allow deterministic partial-copy, read,
rename, deferred database-commit, deletion-staging, rollback, missing-managed-
file and post-commit cleanup failures. Partial-copy paths are removed, failed
pre-commit operations compensate their filesystem changes, and selected source
bytes remain unchanged. Source token storage and consumption check the vault
lock; tests reject reuse and selections arriving after locking.

A post-commit deletion cleanup failure has a precise residual state: database
metadata has been deleted, the live managed file has been staged away, and a
`.deleting` file remains because cleanup failed. The operation returns an
error; it does not claim rollback or success. Automatic recovery of that
residual staged file is not implemented.

### Workflow UI and focused fixes

Direct component tests now cover clients, cases, POAs, hearings, dashboard,
onboarding/security, scoped documents and shared navigation. They exercise
read/write refusal, loading and empty results, create/edit, duplicate
confirmation, relationship display, opponents, archive/restore, hearing
continuations/deletion, recovery retries and preservation of entered data.
Arabic direction, date-only display and existing integer-money tests still pass.

Tests exposed and fixed rejected async form handlers, read failures rendered as
empty results, missing upcoming dashboard results, unavailable hearing
edit/delete controls, UTC-derived hearing defaults and empty optional case
dates rejected by the native boundary. No schema changes were needed.

Native restore exposed a cache defect: clearing the query client removed the
parent status observer while a child mutation changed the vault. Lock/restore
now cancel outstanding reads, immediately gate the UI, remove record queries
and mutations, and fetch native status. Separate parent/child regression tests
verify both operations. A failed lock leaves the existing gate and cache intact
and reports an error without an unhandled rejection.

### Disposable native desktop harness

The Cargo `desktop-e2e` feature is disabled by default and builds into its own
target directory. A test binary refuses startup without a matching marker and
nonce in a runner-created direct child of the system temporary directory. Native
adapters select only allowlisted fixture files or cancellation. React receives
no filesystem or shell access. Real Tauri dispatch, services, encryption and
SQLCipher remain in use. Normal builds contain no test adapters or environment
variable handling for the harness.

Five native scenarios run in independently created temporary vaults:

1. Initialize → client → case → attachment → backup → edit → restore → locked
   gate → unlock → restored record values and attachment bytes.
2. Wrong-password refusal.
3. Cancelled restore preserves active data.
4. Corrupt restore preserves active data.
5. Persistence across application restart.

The runner checks filesystem bytes after closing the application, verifies the
original selected file, removes its temporary directory and emits sanitized
outcomes only. It captures no passwords, recovery screens, vaults or archives.
PR Linux smoke and nightly/release Linux+Windows repeated suites are configured.
Windows resolves the driver version from the installed WebView2 runtime.
macOS remains in the manual matrix.

## Executed validation

| Command/check                                                                      | Actual result                                                                                         |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`                                 | Passed                                                                                                |
| `pnpm test`                                                                        | 187 Vitest tests in 23 files and 29 Node tests passed; zero skipped/focused tests or unhandled errors |
| `pnpm test:coverage`                                                               | Three clean runs, each with 187 passing tests                                                         |
| `pnpm build`                                                                       | Passed; existing large-chunk warning remains                                                          |
| `cargo fmt --check`                                                                | Passed                                                                                                |
| `cargo clippy --all-targets --all-features -- -D warnings`                         | Passed                                                                                                |
| `cargo test --all-features`                                                        | 62 tests passed, none ignored                                                                         |
| `pnpm test:rust:coverage`                                                          | Three clean default-feature runs, 61 tests each                                                       |
| `pnpm check:coverage`                                                              | Passed; synthetic below-floor and malformed reports rejected by regression tests                      |
| `pnpm verify:visual`                                                               | All 64 candidate PNGs verified                                                                        |
| Canonical visual comparison                                                        | Two consecutive clean runs: 64 comparisons and one keyboard/focus test each                           |
| Canonical deliberate layout probe                                                  | Dashboard padding changed by 120 px; all four dashboard comparisons failed as expected                |
| Approved-manifest requirement                                                      | Candidate rejected as expected                                                                        |
| `pnpm build:desktop:e2e`                                                           | Passed in separate target directory                                                                   |
| `DISPLAY=:94 GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 pnpm test:desktop`   | Three consecutive Linux runs; all five scenarios passed each time                                     |
| `pnpm tauri build --debug --bundles deb`                                           | Normal Debian debug package built                                                                     |
| `node scripts/verify-release-boundary.mjs src-tauri/target/debug/legalmaster-solo` | No desktop harness markers in normal binary                                                           |

The native desktop executions used Fedora 44 under Xvfb, not the configured
Ubuntu CI image. No Windows runtime was available. The same native test binary
was used for all three runs, SHA-256:
`c6c7621dd148a4c8be4ea509e8ade8b706aa41d5b38b003306ec00e1b167aeb9`.
The debug Debian package SHA-256 is
`0f2190f06c4a3a1f1538ce5f880865022c3839f3144c325ac932459412814a38`;
this is local debug evidence, not an approved release package.

## Coverage measurements and proposed floors

The measurements use an identical uncommitted source tree. Before accepting
release evidence, repeat the three measurements on the final committed revision
and explicitly review the policy. Renderer and Rust scopes are separate.

| Metric              |    Run 1 |    Run 2 |    Run 3 | Proposed floor |
| ------------------- | -------: | -------: | -------: | -------------: |
| Renderer statements |   83.88% |   83.96% |   83.86% |          82.8% |
| Renderer branches   |   79.49% |   79.40% |   79.55% |          78.4% |
| Renderer functions  |   74.02% |   74.19% |   74.02% |          73.0% |
| Renderer lines      |   83.88% |   83.96% |   83.86% |          82.8% |
| Rust regions        | 33.3901% | 33.3901% | 33.3901% |          32.3% |
| Rust functions      | 34.1629% | 34.1629% | 34.1629% |          33.1% |
| Rust lines          | 34.9451% | 34.9451% | 34.9451% |          33.9% |

Each floor is the minimum measurement, rounded down to one decimal place, minus
one percentage point. Rust production counts are 2,157/6,460 regions,
151/442 functions and 1,337/3,826 lines. The raw LLVM export includes inline unit
modules and generic instantiations and reports higher percentages; those are
not production coverage. The scoped reporter excludes test modules/harnesses
and merges generic functions/regions by their source coordinates. Its own tests
cover filtering and merging. These percentages should not be compared directly
with historical reports that used the raw scope.

Ignored local artifacts are `coverage/renderer/`, `coverage/rust/`,
`coverage/measurements/run-{1,2,3}/`, `test-results/desktop/run-{1,2,3}.json`,
`test-results/visual/` and `playwright-report/`. The final visual report contains
intentional probe failures; clean-run results are recorded above. Temporary
command transcripts are `/tmp/legal-tests-final.log`,
`/tmp/legal-rust-final.log`, `/tmp/legal-visual-ready.log`,
`/tmp/legal-visual-probe.log`, `/tmp/legal-desktop-clean-{1,2,3}.log`,
`/tmp/legal-renderer-coverage{1,2,3}.log` and
`/tmp/legal-rust-final-coverage{1,2,3}.log`. CI retains failure evidence,
sanitized desktop JSON and separate renderer/Rust coverage for seven days,
even if the coverage checker fails. CI never updates baselines or floors.

## Remaining release gates

- The user must review and approve the first visual baseline. Design reference
  comparison remains unverified because the original assets are missing.
- Three native Windows passes and execution of the configured Ubuntu jobs remain
  pending. Workflow configuration is not execution evidence.
- Coverage floors require explicit review and three measurements on the final
  committed revision.
- Windows 10, Windows 11, macOS Intel and Apple Silicon physical validation is
  pending until testers and machines are available. Use the
  [runbook](device-validation-runbook.md) and
  [evidence template](device-validation-template.md), including three repeated
  same-vault restores per device.
- Windows↔macOS portable restore remains separately blocked: an archive cannot
  restore into an independently initialized vault with only the original
  password because its random master key is required. A copied security
  envelope does not pass this criterion. Backup-format redesign remains outside
  this programme.

Automated regression results do not close these approval and device gates.

The [continuation handoff](test-hardening-handoff-2026-10-05.md) records the next
actions, acceptance criteria, commands and engineering follow-ups for a later
session.
