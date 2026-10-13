# PR #9 merge-readiness review — 2026-10-14

Scope: finish the feature removals and relationship corrections already in
[PR #9](https://github.com/Mahmoud-s-Khedr/legal-masr/pull/9). This review does
not add the missing export, deletion, tray or support-bundle features.

## Findings and corrections

- Demo tasks and the demo case expense still supplied both `caseId` and
  `clientId`, violating migration `0003` and Rust validation. The redundant
  client links are removed. Seeder tests check every task/expense payload and
  verify that a failed task stops later financial writes. The screenshot bridge
  also uses case-only task/expense fixtures; a regression test checks list,
  dashboard and mutation fixtures. That test failed before the fixture repair.
- The browser suite still clicked the removed hearing-roll print button.
  It now asserts that the control and print surface are absent. Recovery-key
  printing remains covered.
- CI compared the changed onboarding password controls, POA form and Agenda
  against old screenshots. Changed Arabic/English screens were inspected;
  all 68 candidate captures are regenerated in the pinned Ubuntu/Chromium
  environment. The manifest remains `candidate`, with unchanged comparison
  tolerances. Screenshot acquisition gets a 15-second deadline for two stable
  frames on slow workers. This is regression evidence, not final design approval.
- The Linux restore journey timed out at its partial-text client selector.
  It now locates the client link structurally and asserts the complete restored
  name, matching the existing case verification. Additional fixed checkpoints
  distinguish navigation, rendering and identity failures without logging data.
- Prettier refused three Markdown files. Formatting is corrected. Plan and
  device-test references to removed features, manual restore portability,
  expense ownership, derived POAs and the backend-only counter setting are
  aligned with the code. The gallery derives its capture count from the matrix.

No schema migration is edited by these follow-up fixes. The PR adds immutable
`0003` (relationship rules) and `0004` (removed reminder/autostart state).

## Validation

| Check                                                         | Result                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Format, lint and TypeScript checks                            | Passed                                                                 |
| Seeder tests                                                  | 7 passed                                                               |
| Frontend coverage suite                                       | 579 passed; statements/lines 88.00%, branches 85.32%, functions 79.67% |
| Node script tests                                             | 60 passed                                                              |
| Rust format and clippy, all targets/features, warnings denied | Passed                                                                 |
| Rust tests, all features                                      | 177 passed                                                             |
| Rust coverage                                                 | Passed; production regions 57.69%, functions 60.58%, lines 62.15%      |
| Coverage floors                                               | All seven passed without changing floors                               |
| Canonical screenshot generation and manifest                  | 71 browser tests passed; 68 candidate captures verified                |
| Canonical screenshot comparison                               | 71 passed in a separate clean run; pixel tolerances unchanged          |
| Native Linux desktop suite                                    | 11 scenarios passed, including incomplete-installation restore         |
| Linux debug Debian package and production harness scan        | Passed                                                                 |
| Production pnpm audit                                         | Passed; no known vulnerabilities reported                              |
| Cargo audit                                                   | Passed with 7 existing transitive advisory warnings                    |

An early frontend run overlapped source edits; the overloaded parallel coverage
run hit four five-second test timeouts. Final frontend evidence comes from a
fresh run with one worker and unchanged test assertions/time limits. One local
Rust coverage attempt was interrupted; the complete rerun passed. The initial
browser comparison was also interrupted after reproducing stale snapshots;
the final candidate is generated and compared separately.

Rust, native and package evidence predates the final capture-fixture-only
correction. That correction changes development fixtures and tests; published-head
CI rechecks the complete tree.

## Remaining acceptance

Physical Windows/macOS installers, dialogs, printing, sleep/resume and
cross-platform restoration remain pending. Final visual design approval remains
pending. Cargo audit retains Tauri/GTK transitive maintenance/unsoundness
warnings; this PR does not introduce dependency upgrades. These are existing
release limitations, separate from the PR's automated merge checks.
