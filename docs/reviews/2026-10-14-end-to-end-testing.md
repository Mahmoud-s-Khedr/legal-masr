# End-to-end test review — 2026-10-14

This review extends the existing tests within the implemented pre-beta scope in
[the feature inventory](../feature-list-and-testing.md) and
[the form inventory](../forms-inventory.md). All native runs use marked,
disposable workspaces and synthetic records. No existing lawyer workspace,
production schema, migration, or application behavior is changed.

## What changed

- Added a native office fixture with exactly **10 clients and 7 cases** at the
  initial integrity checkpoint. It includes shared-client cases, clients without
  cases, active/suspended/closed cases, seven powers of attorney, opponents,
  hearings with predecessor chains, completed/overdue/upcoming tasks, fee
  agreements, every payment method and expense category, case/client/unlinked
  expenses, and managed PDF attachments. Later exercises deliberately create
  and remove additional records.
- Added independent reconciliation of every case and client account against
  payment/expense rows, case membership, exclusive ownership, hearing links,
  and active power-of-attorney uniqueness.
- Added whole-office comparisons after rejected mutations, canceled/invalid
  restores, three successive restores per locale, and restart. Comparisons
  include detailed records, relationships, accounts, settings, profile,
  attachment metadata, and SHA-256 hashes of managed document bytes. Snapshots
  remain in memory; the test does not export vault data or credentials.
- Extended native client/case/POA edits to check populated fields after saving;
  expanded the client form test to include every optional field. Added native
  finance inspection/edit/delete confirmation and cancellation checks, complete
  hearing/task text-field round trips, opponent details, office profile fields,
  and persisted date/week/lock preferences.
- Added 15 checker tests: one valid reconciled office, thirteen corrupted-office
  variants, and refusal to seed an unexpected workspace before any write. Four
  outcome tests ensure button, keyboard and renderer failures fail the sweep;
  an additional driver test verifies safe classification of missing native input tooling.
- Updated retired backup command calls to authenticated selection, preparation,
  cancellation and commit. Updated expected link-conflict error codes and the
  client selection needed for the one-active-POA rule.
- Fixed driver input of multiline text using Enter keys, waited for selected
  tabs, and bounded native protocol requests. Corrected renderer validation
  checks to use visible alerts and invalid controls rather than a particular
  internal CSS attribute.
- Browser audits release contexts during repeated Vite navigations. The control
  sweep now exits unsuccessfully when any recorded control fails.

## Repeatable commands

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml --all-features
pnpm build:desktop:e2e
pnpm test:e2e
```

`test:e2e` runs the existing native desktop suite, the bilingual realistic-office
suite, and the additional native controls suite in sequence. Individual commands
are `pnpm test:desktop`, `pnpm test:office`, and `pnpm test:desktop:controls`.
Linux requires `tauri-driver`, `WebKitWebDriver`, `xdotool`, and an X11 display.
A supported native driver/display is required. The harness refuses an unmarked
launch and removes its disposable vault on ordinary completion.

For renderer enumeration, start the development capture server in another
terminal (the fixture bridge makes no persistent mutations):

```bash
VITE_CAPTURE_MODE=true pnpm exec vite --config scripts/full-app-vite.config.ts --host 127.0.0.1 --port 4173
node scripts/full-app-browser-audit.mjs test-results/full-app/browser
QA_BASE_URL=http://127.0.0.1:4173 QA_OUTPUT=test-results/full-app/controls node scripts/full-app-control-sweep.mjs
```

These environment assignments are Bash syntax. Set the same environment
variables using the host shell when running on Windows.

## Evidence and interpretation

Native evidence is stored under `test-results/full-app/native-final/` and
`test-results/full-app/native-controls-final/`. Core desktop results are in
`test-results/full-app/desktop-core-final/`; distinct snapshot reruns are in
`test-results/full-app/native-distinct-restores/`. Renderer evidence includes a control
inventory and screenshots under `test-results/full-app/browser-clean/`, and
per-state/per-button outcomes under `test-results/full-app/controls/`.
`test-results/full-app/summary.json` consolidates counts, and
`test-results/full-app/button-outcomes.csv` lists control attempts. The renderer
summary `browser-verified.json` combines the full run with a focused POA tab
rerun after correcting route readiness. `test-results/` is ignored by Git. Test failure screenshots contain only
fictional workspace records; credential/recovery screens are excluded.

A renderer control outcome of `clicked` proves that the control can be activated
in that fixture state; it does not prove a database write or native OS action.
Native UI journeys and Rust tests establish those separate properties. Hidden
and disabled controls are recorded separately. Field inventories are not, by
themselves, field validation tests. This review does not claim every possible
state combination or 100% code coverage.

The first frontend run timed out in two tests while two fresh Rust builds ran
concurrently. Both passed on a serial targeted rerun, and the complete renderer
suite subsequently passed with coverage. Initial native failures were traced to
newline entry, a disabled stale picker option, wrong expected link-conflict
codes, and tab/driver waits; the initial failed run was interrupted and replaced
with a fresh complete run. Initial renderer validation checks were too specific
and long-lived browser contexts exhausted Chromium resources. Keep these initial
failures separate from the final run results.

## Final validation

| Validation                                                             | Result                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend suite with coverage                                           | **579 passed**, 57 files                                                                                                                         |
| Node script suite                                                      | **80 passed**                                                                                                                                    |
| Rust all-feature tests                                                 | **178 passed**                                                                                                                                   |
| Realistic office in Arabic/English                                     | **72 passed**, zero failures                                                                                                                     |
| Distinct snapshot restore rerun in Arabic/English                      | **14 passed**, zero failures; three distinct snapshots per locale                                                                                |
| Additional native controls and fields                                  | **16 passed**, zero failures                                                                                                                     |
| Existing desktop journeys                                              | **11 passed**, zero failures on the final full run                                                                                               |
| Renderer audit and POA readiness rerun                                 | **176 distinct checks passed**                                                                                                                   |
| Bilingual control sweep                                                | **106 states**, 36 route/locale completions, **843 button attempts**: 817 clicked and 26 hidden; zero failed buttons or uncaught renderer errors |
| Renderer/Rust coverage floors                                          | Passed, without changing the policy                                                                                                              |
| Lint, typecheck, formatting and whitespace checks                      | Passed                                                                                                                                           |
| Rust formatting and all-target/all-feature clippy with warnings denied | Passed                                                                                                                                           |
| Native harness build (includes frontend production build)              | Passed                                                                                                                                           |
| Existing screenshot manifest                                           | **68 candidate captures verified**; no canonical comparison claimed                                                                              |

Production renderer coverage: **88.01% lines/statements**, **85.33% branches**,
**79.67% functions**. Production Rust coverage: **62.15% lines**, **57.69% regions**,
**60.58% functions**. Coverage instrumentation excludes the native test harness.

Control attempt counts include the resumed portion of the sweep and repeated
calendar controls, not 843 distinct features. Hidden controls are reported, not
claimed as activated. Each completed route and its tabs have an inventory.

The supplemental controls review also corrected archive-confirmation and
unsaved-draft handling, moved transaction deletion into the inspection dialog,
and removed dependence on another test's account balance. Three restored
snapshots now have distinct task markers and current local timestamps, so an
older archive with otherwise identical records cannot accidentally pass.

The initial core run had ten passes and a native-picker failure because
`xdotool` was absent. The dependency was downloaded as a signature-verified
Fedora package and extracted under `/tmp/legalmasr-test-tools`, without changing
system packages. The focused picker rerun and final full desktop run passed with
that directory on `PATH`, `GDK_BACKEND=x11`, and
`WEBKIT_DISABLE_DMABUF_RENDERER=1`. The runner now reports
`DESKTOP_NATIVE_INPUT_UNAVAILABLE` at preflight instead of a generic scenario
failure when the dependency is missing.

No data-integrity failure was found in the tested workflows. This is evidence
on the current uncommitted working tree, not a Windows/macOS release sign-off.

## Remaining limits

Physical Windows/macOS installers, native file handlers, printing, external
contact handlers, and cross-platform restoration remain device acceptance work.
Native attachment/backup selection uses the allowlisted harness picker. Managed
file ownership, failure cleanup, and document hashes are tested, but a PDF viewer
or printer is not certified by those tests. Removed and unimplemented features
are not counted as working controls. Candidate screenshot inventory verification
is separate from canonical screenshot comparison and design approval.

A passing run gives evidence for the tested invariants and workflows; it cannot
guarantee the absence of every data-integrity defect.
