# Test hardening handoff — 2026-10-05

## Resume here

The automated hardening implementation is committed. Release
acceptance is still open. This handoff records work to resume later; it does not
approve the visual baseline, coverage floors or a release.

Read `AGENTS.md`, [the project plan](plan.md),
[the testing strategy](plan/09-testing.md) and
[the validation evidence](testing-hardening-report-2026-10-05.md) before editing.
The project-plan overview is dated August 24 and still describes capture setup
as unavailable; the October 5 evidence describes the current test infrastructure.
Check the working tree and current commit before relying on any recorded result.

The implementation and candidate assets are in commit
`e0f34416514a3ad64bab7769cda84bddd39079d2`, based on
`33c7f15ce6bb54bc70ad9740ba8a1b96631e9a3c`. Measurements below were taken before
that commit; committing does not replace the pending committed-revision runs.
Preserve any later changes; do not reset, clean or regenerate baselines merely
to start a new session. No remote CI run, Windows execution or physical-device
pass has been recorded.

## Completed and verified

| Area                            | Recorded result                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend and workflow tests     | 187 tests in 23 files passed                                                             |
| Node verification/checker tests | 29 passed                                                                                |
| Rust all-feature tests          | 62 passed; production coverage runs execute 61                                           |
| Visual comparisons              | Two consecutive runs passed 64 comparisons plus one keyboard/focus test each             |
| Visual regression proof         | Test-only 120 px dashboard padding caused all four language/viewport comparisons to fail |
| Native desktop                  | Three Fedora Linux/Xvfb runs passed all five scenarios each                              |
| Coverage                        | Three runs per layer; proposed floors pass the deterministic checker                     |
| Static/build checks             | Formatter, lint, typecheck, frontend build, Rust formatter and Clippy passed             |
| Normal packaging boundary       | Debug Debian package built; normal binary contained no desktop harness markers           |

The layout probe changed only the test page, not application source or baseline
images. Ignored visual reports currently contain its **expected failures**.
Use a normal comparison run to produce a fresh clean report. Test counts and
checksums describe the measured tree; rerun relevant checks after new changes.

## Remaining acceptance gates

### H1 — First visual baseline approval

**Status:** blocked on a full visual audit and corrections before user approval.

Start with [the 64-image gallery](../tests/visual/review.html) and
[baseline instructions](../tests/visual/README.md). The manifest at
`tests/visual/baseline/manifest.json` is `candidate`. Original Stitch reference
assets are missing, so pixel/design parity is unverified. Some English workflow
pages retain Arabic content, and a long fictional email wraps in a narrow
contact card.

On October 5 the user raised concern that most images may be broken or outdated.
Only representative captures had been visually inspected; the extent of the
problem has not been established across all 64 images. The candidate was
presented for approval too early. Passing comparisons and PNG integrity checks
establish repeatability and file validity, not correct layouts, translations,
fixture content or agreement with the intended design. The snapshots were
freshly generated with a fixed fictional date; this does not establish that
their content or design is current.

Keep the existing baseline unapproved and treat it as diagnostic review
material. Do not use it as the accepted design reference or regenerate it simply
to turn comparisons green. The fixes are deferred to a later session.

Next actions:

1. Recover the original design references if available and audit every image in
   the complete route/language/viewport matrix against current intended screens.
   Record unavailable references explicitly. For each image, record its filename,
   route, locale, viewport, observed problem, expected result and audit outcome;
   distinguish application defects, fixture problems and capture defects.
2. Check localization, RTL/LTR direction, clipping, wrapping, spacing, missing
   content/assets and stale fixture content. Fix identified defects with relevant
   regression coverage, then use the separate canonical update command and
   review every regenerated candidate before presenting it for approval.
3. Obtain explicit user approval for the exact candidate. Record approver, date,
   reviewed revision and reference limitations before setting status to approved.
4. Run manifest verification and two consecutive canonical comparisons after
   approval. Confirm the deliberate layout probe still fails.

**Done when:** all 64 images have recorded audit outcomes, identified defects are
resolved or explicitly accepted by the user, the exact baseline has recorded
approval, all 64 comparisons pass
on two consecutive runs, integrity failure tests pass, and release validation's
approved-manifest check succeeds. CI must never update screenshots.

### H2 — Native Ubuntu and Windows execution

**Status:** Linux local evidence exists; Ubuntu CI and Windows evidence pending.

Review `.github/workflows/desktop.yml` and `scripts/desktop-e2e.mjs`. Linux PR
smoke runs once; nightly/release Linux and Windows jobs run three times. Windows
must match `msedgedriver` to the installed WebView2 runtime. `tauri-driver` is
pinned to 2.1.0. macOS remains manual.

Next actions: execute the configured jobs on the reviewed revision, resolve any
platform failures, and retain three consecutive successful runs on each
platform. Check initialization/records/attachment/backup/restore, wrong
password, cancelled and corrupt restore, and restart persistence. Record binary
checksum, OS/runtime/driver versions, revision and sanitized scenario outcomes.
Verify packaging uses normal builds without `desktop-e2e`; do not package or
install harness binaries for device validation.

**Done when:** all five scenarios pass three consecutive times on both automated
platforms, disposable vault isolation is verified, and normal packaging binaries
pass the harness-boundary scan. Workflow configuration alone is not evidence.

### H3 — Coverage policy review and committed-revision evidence

**Status:** proposed floors; measurements taken on an identical uncommitted tree.

Review `tests/coverage-policy.json`, `scripts/check-coverage.mjs`,
`scripts/rust-coverage.mjs` and `scripts/scope-rust-coverage.mjs`. Preserve separate
renderer and Rust output directories. Raw LLVM percentages include inline tests;
use the scoped production Rust report for policy decisions.

Next actions: review the implementation commit and settle any further changes,
collect three clean measurements of the same final revision, preserve each
pair of reports, and review the floors and provenance explicitly. The initial
rule remains minimum of three runs, rounded down to one decimal, minus one
percentage point. Do not lower floors automatically to make a failure pass.

| Layer           | Current proposed floors                                        |
| --------------- | -------------------------------------------------------------- |
| Renderer        | Statements 82.8%, branches 78.4%, functions 73.0%, lines 82.8% |
| Rust production | Regions 32.3%, functions 33.1%, lines 33.9%                    |

**Done when:** reviewed floors have committed-revision measurement evidence,
unchanged runs pass, below-floor/missing/malformed reports fail, and both layers'
reports remain available after checker failure. CI must never rewrite floors.

### H4 — Physical-device matrix

**Status:** all devices pending; testers and machines unassigned.

Use [the runbook](device-validation-runbook.md) and
[the evidence template](device-validation-template.md). Assign a tester for each
of Windows 10, Windows 11, macOS Intel and macOS Apple Silicon. Use checksummed
normal packages, dedicated test accounts, fictional records and disposable
source documents.

**Done when:** every device records install/upgrade/uninstall, restart
persistence, native picker cancellation/selection, attachment open/reveal,
notification permissions, autostart, sleep/resume locking, both visual viewports
in Arabic/English, keyboard/dialog behavior, and three repeated same-vault
restore exercises. Record commit, checksum, OS version, architecture, tester,
results and defects. An automated pass does not substitute for these checks.

### H5 — Portable cross-device restore dependency

**Status:** blocked on a separate backup-format design and implementation.

Read [the backup-format document](plan/07-backup-format.md). Current archives
require the original random master key. The original password alone cannot
restore an archive into an independently initialized destination vault.

Next actions: scope a separate portable-restore design with compatibility,
security and failure-preservation criteria; implement and test that design;
then repeat Windows→macOS and macOS→Windows exercises. Until then, expected
refusal with destination data preserved is safety evidence only. Copying a
security envelope must never count as a portability pass.

**Done when:** independently initialized destinations restore records and
attachment bytes using the designed portable credentials, both directions pass,
wrong credentials/corrupt archives preserve active data, and physical repeated
restore evidence is updated. Do not close this gate through test-only adapters.

## Engineering follow-ups to triage

These are known limitations, distinct from approval and execution gates. No fix
is being claimed in this handoff.

| Issue                          | Current behavior and starting point                                                                                                                                                                                      | Acceptance for a future fix                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Attachment post-commit cleanup | `src-tauri/src/services/document_service.rs`: metadata deletion has committed, live file is staged away, cleanup may fail leaving `.deleting` bytes; an error is returned. UI asks the user to refresh/check the record. | Define safe recovery/retry semantics and add deterministic failure tests; preserve referenced files and original sources; never claim rollback or success when cleanup failed. |
| English workflow content       | Review gallery and relevant workflow pages/catalogs; some labels/content remain Arabic under English direction.                                                                                                          | Review intended translation scope, translate approved content, test both directions and update candidate images for explicit review.                                           |
| Narrow contact-card wrapping   | Client-detail candidate shows the long fictional email wrapping.                                                                                                                                                         | Decide intended wrapping/overflow behavior, verify long mixed-direction content at both viewports, and obtain visual approval.                                                 |
| Large frontend chunk warning   | Existing frontend build warning; no performance assessment was performed.                                                                                                                                                | Measure actual startup/bundle impact before changing loading behavior; preserve workflow and native desktop tests.                                                             |
| Stale project-plan overview    | `docs/plan.md` retains August status despite October infrastructure.                                                                                                                                                     | Reconcile documentation with accepted evidence while keeping unresolved gates explicit.                                                                                        |

Other product backlog items in the roadmap, such as automatic backup/retention
and exports, remain separate scope. This handoff does not mark them complete.

## Commands for the next session

Run from the repository root unless indicated. Install the pinned dependencies
and platform prerequisites first; canonical visual commands require Docker.
Native Linux journeys require Xvfb and WebKit's native driver. Windows requires
the matching WebView2 driver; use the workflow as the setup reference.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
pnpm test:rust:coverage
pnpm check:coverage
pnpm verify:visual
pnpm capture:visual:canonical
pnpm build:desktop:e2e
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 xvfb-run --auto-servernum pnpm test:desktop
pnpm tauri build --debug --bundles deb
node scripts/verify-release-boundary.mjs src-tauri/target/debug/legalmaster-solo
```

Run `pnpm probe:visual:canonical` separately: exit failure for all four dashboard
comparisons is expected. `pnpm update:visual:canonical` is only for a deliberate
new candidate, never ordinary verification. After recorded user approval, check:

```bash
node scripts/verify-visual-manifest.mjs tests/visual/baseline --approved
```

For coverage and desktop repeatability, preserve each run's artifacts before the
next run overwrites them. See the validation report for existing local artifact
locations and checksums. `/tmp` transcripts and ignored reports may disappear;
the tracked evidence report survives. CI artifact retention is seven days, so
record durable sanitized conclusions before artifacts expire.

## Constraints and next-session closeout

Preserve the React/Rust trust boundary, Arabic RTL, integer minor-unit money and
timezone-free dates. Schema changes require new immutable numbered migrations.
Use fictional data. Do not log or upload legal records, document paths, vaults,
backup archives, security envelopes, passwords, keys or security-screen captures.

Start by preserving/reviewing the current changes, checking available artifacts,
and choosing one remaining item. Assign an owner and record blockers instead of
assuming approvals or machine availability. For each resolved item, update the
dated evidence with exact revision, commands, counts, platform, outcome and
artifact references. Record user approvals explicitly. Leave every outstanding
gate open until its acceptance criteria are satisfied.
