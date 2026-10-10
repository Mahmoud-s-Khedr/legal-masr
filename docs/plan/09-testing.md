# Testing strategy

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Automated coverage

Rust unit and integration coverage includes:

- clean canonical migration, legacy-vault rejection without mutation, foreign
  key/integrity checks, strict booleans/money, duplicate internal identifiers,
  attachment single-owner integrity, and payment payer membership;
- client/POA/case relationships and archive paths, opponents, hearing decision
  chains, derived task views, fee/payment/expense summaries, and search index;
- managed attachment durability, copy failure cleanup, removal behavior, native
  path resolution, backup creation/validation/restore, and corrupt restore
  staging safety;
- password/recovery envelopes, safe error diagnostic redaction, reminder
  deduplication, and local settings validation;
- portable backup recovery (format v2): restore into an empty and an incomplete
  installation with the password and with the recovery key, wrong password and
  wrong recovery key, every altered header field, truncated/garbage/non-JSON
  files, newer envelope/manifest/database versions, bounded key-derivation cost,
  rejection of every other format, preview/cancellation leaving live data unchanged, and
  every journal interruption for the new replacement fields.

Frontend Vitest/React Testing Library coverage includes bridge payload
contracts, typed error mapping, canonical query invalidation including failure
scope, forms, dialogs, task completion, payer filtering, optional expense
links, Arabic RTL/mixed-direction rendering, and primary workflow pages.

Renderer coverage keeps the production scope in `app`, `bridge`, `components`,
`features`, `i18n`, and `lib`, excluding tests and fixtures. Vitest writes
`coverage/renderer/coverage-summary.json` and `coverage/renderer/lcov.info`.
Rust coverage builds without desktop harness features, retains raw LLVM export
and LCOV under `coverage/rust/`, and produces a production summary and LCOV.
The scoped summary excludes integration files, inline test modules and the
native harness, merging generic instantiations by source coordinates.

`tests/coverage-policy.json` contains proposed floors derived from three clean
runs of the same source tree. `pnpm check:coverage` enforces all seven metrics
and fails on missing/malformed reports. Floors require explicit source review;
CI never rewrites them. The dated evidence distinguishes the uncommitted tree
measurements from validation on a final committed revision. Renderer cleanup
cannot remove Rust reports because their output directories are separate.

Playwright asserts 68 full-page screenshots across 17 routes, Arabic/English and
1366×768/1440×900. It uses pinned Ubuntu 24.04 Chromium, a fixed fixture clock,
Africa/Cairo, light theme, disabled animations, loaded fonts/images and route
readiness checks. Threshold is 0.2; maximum differing-pixel ratio is 0.001.
Tracked candidates and their checksummed manifest are in `tests/visual/baseline`;
actuals, diffs, traces and HTML reports are ignored. `pnpm verify:visual` checks
all combinations, safe filenames, PNG structure/dimensions and hashes. Use
`pnpm update:visual:canonical` to propose a baseline and
`pnpm capture:visual:canonical` to compare. CI only compares. Initial visual
approval is pending; release validation requires an approved manifest. The current local implementation, captured before integration in Arabic/English at
both desktop sizes plus targeted narrow/dark views, is the visual reference. Review the [candidate gallery](../../tests/visual/review.html).

Native WebdriverIO journeys use `tauri-driver` on Linux/Windows, real IPC,
SQLCipher and encryption. The compile-time `desktop-e2e` feature is disabled by
default; `pnpm build:desktop:e2e` builds in a separate target directory. It
refuses unmarked launches and uses a unique runner-created temporary vault and
allowlisted dialog fixtures. `pnpm test:desktop` exercises initialization,
records, attachments, backup/restore, locked gate, wrong passwords, silent picker cancellation
and corrupt restore (asserting the specific refusal message), restore
of a verified save-copy into a fresh and an incomplete installation, recovery-key
restore with a new password, a real Linux picker heartbeat with lock/reunlock,
the opponent form's validation feedback, the Settings display tab opened by deep
link, and restart persistence. Reports are retained after each scenario and contain sanitized outcomes
and binary checksums only. No vaults, backups, secrets or security-screen captures
are uploaded. Packaging binaries are scanned for harness markers.

Print-media tests verify that hearing rolls and synthetic recovery-key sheets
exclude workspace chrome and unrelated records and fit a single A4 page for the
fixture. Offline validation uses a network namespace for Rust/native journeys and
Docker `--network none` for browser PDF checks. These checks do not certify physical
printers or Windows/macOS. See the [integration review](../reviews/2026-10-10-integration.md).

The driver must return a successful local `/status` response before a journey
launches; startup polls every 250 ms for up to 30 seconds and records only a
fixed startup/session/scenario error code. The backup/restore journey also
records an allowlisted operation checkpoint on failure. It never retains raw
WebDriver errors, DOM, paths, passwords, or vault data. Session failures are
classified in memory into fixed startup diagnostics (missing DevTools port,
version mismatch, occupied profile, application exit, connection refusal or
request timeout); only these categories are retained in JSON and CI output.
Windows launches the marked application directly with a reserved loopback debugging
port, waits for the local WebView endpoint and its `tauri.localhost` page target,
then drives that target through the Chrome DevTools Protocol. The CDP adapter
scrolls targets into view and sends browser pointer events so composite inputs
receive focus and pointer handlers. It rejects disabled or obscured clicks and
supports scoped dialog queries, field collections, attributes and enabled-state
polling used by the restore and validation journeys. DOM/protocol regression
tests cover these interactions and refusal paths. Linux sidebar navigation uses
focus plus Enter and waits for the requested route after activation. Current EdgeDriver
builds can attach a separate blank page to this WebView2 setup, so Windows does
not use it. Linux retains Tauri's WebDriver application-launch path.
WebView2 150+ ignores environment-supplied browser arguments on elevated hosts,
including GitHub's Windows runners. The separate Windows harness build supplies
port 9222 through Tauri's `additionalBrowserArgs` configuration, which uses the
WebView2 API. It preserves the configured window and Wry 0.55.1's default browser
arguments. The runner verifies that the port is free before each launch, waiting
briefly for a closing process to release it, and then waits for its local endpoint;
production build configuration has no debug-port override.
Closing a session also stops the application, so restart persistence exercises a
new application process against the same vault and a new disposable WebView profile.
These debugging settings apply only to the separate marked harness binary. Windows
process shutdown terminates the owned tree before deleting its temporary vault,
preventing a surviving process from reusing an old marker.
Temporary-directory removal retries briefly for Windows profile locks to clear.
The Linux preflight uses the supported `tauri-driver --help` command. Linux and Windows finish
all configured attempts even after a failure and keep each available sanitized
per-run JSON outcome; the job fails after the final attempt if any attempt
failed or did not produce a report. Each attempt removes the previous report
first so stale results cannot be retained as new evidence.

PRs run Linux smoke plus all visual comparisons. Nightly and release validation
run Linux/Windows desktop suites three times; Windows matches its driver to the
installed WebView2 version. macOS remains in the physical-device matrix.
Failure evidence and coverage reports are retained for seven days, including
when a coverage floor fails.

## Coverage map

The suite is intentionally layered; no single test type proves the whole
application.

| Layer                              | What it proves                                                                                                                                | Important failure paths                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust unit/service tests            | Input validation, safe error mapping, password/recovery envelopes, date-only and money rules, reminder timing, and managed-file compensation  | invalid passwords/dates/money, missing records, failed file copy/delete, malformed notification times                                                                                                          |
| Rust repository/schema integration | SQLCipher/SQLite invariants and transactions using a real database                                                                            | duplicate identifiers, invalid FK relationships, unsupported task states, invalid attachment ownership, payer outside its case, archive/delete rules                                                           |
| Backup integration                 | Encrypted snapshot, manifest/checksum inventory, staged restore, rollback protection, and restore from the backup's own password/recovery key | bad nonce/key/checksum, wrong password or recovery key, altered header, missing or unlisted archive entries, duplicate ZIP names, path traversal, newer schema, corrupt restore leaving active vault unchanged |
| Frontend component/workflow tests  | Typed bridge payloads, rendered RTL forms, query invalidation, navigation, and accessible controls                                            | locked vault does not query settings, locking clears legal-record cache, invalid forms, rejected mutations, absent payer options, keyboard/dialog behavior                                                     |
| Build/package checks               | Type compatibility, lint/static rules, formatter conformance, and desktop packaging                                                           | compilation or bundle regressions; package creation is not a substitute for target-device testing                                                                                                              |
| Manual target-device matrix        | Native dialogs, OS notifications/autostart, sleep/resume locking, installer behavior, encrypted restore, and visual/accessibility quality     | OS-specific permission, lifecycle, rendering, install, and recovery failures that mocks cannot establish                                                                                                       |

The automated suite establishes contract and regression confidence. Candidate
screenshot repeatability does not establish design approval, and disposable
desktop journeys do not pass physical Windows/macOS or portable disaster-restore
gates.

## Required validation commands

Run format check, lint, typecheck, frontend tests, frontend coverage,
frontend build, Rust format, clippy with warnings denied, full Cargo tests,
Rust coverage, coverage-floor verification, baseline manifest verification,
canonical visual comparisons, native desktop journeys, and a normal debug Tauri
Debian build with a harness-boundary scan. The dated hardening report records the
exact current run results. Failures must be fixed or described as an unresolved
release risk; they must not be skipped.

## Manual release matrix

| Area                                      | Linux dev |  Windows | macOS Intel | macOS Apple Silicon |
| ----------------------------------------- | --------: | -------: | ----------: | ------------------: |
| Vault initialize/unlock/recovery          |  Required | Required |    Required |            Required |
| Managed attachment picker/open/reveal     |  Required | Required |    Required |            Required |
| Native notification and autostart         |  Required | Required |    Required |            Required |
| Manual backup and corrupt-archive refusal |  Required | Required |    Required |            Required |
| Repeated restore/disaster exercise        |  Required | Required |    Required |            Required |
| Installer/update/uninstall                |       N/A | Required |    Required |            Required |
| 1440×900 and 1366×768 visual comparison   |  Required | Required |    Required |            Required |

No visual, notification, autostart, installer, or device claim is satisfied by
unit tests alone. The current correction-plan closeout still needs approval of
the seeded viewport baseline and physical Windows/macOS validation.

## Physical-device handoff

Use [the device runbook](../device-validation-runbook.md) and
[the evidence template](../device-validation-template.md) on Windows 10,
Windows 11, macOS Intel and Apple Silicon. All physical execution remains
pending. Run three same-vault restore iterations per device. Windows↔macOS
portable restore remains a separate physical gate. Format v2 backups carry the
password and recovery envelopes and restore into an empty installation on Linux
(automated), but a Linux automated restore must not be counted as a Windows or
macOS portability pass: make a backup on one platform, restore it into a fresh
installation on the other with the original password, and record the result.

See [the hardening evidence](../testing-hardening-report-2026-10-05.md) for actual
counts, coverage, defects, artifacts and pending acceptance gates.
Use [the continuation handoff](../test-hardening-handoff-2026-10-05.md) to resume
the remaining approval, platform, coverage and engineering work.
