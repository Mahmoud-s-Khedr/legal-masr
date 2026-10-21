# Review of the data-flow fixes

**Date:** 2026-10-21. **Scope:** all 18 modified files and the five untracked source/documentation files on `chore/remove-reminders-autostart-roll-export`, including the two earlier reviews. Evidence image folders were excluded from detailed review. Read `docs/plan.md` and the architecture, functional-module, testing and contribution topics before editing. Changes remain uncommitted; no schema changes were required.

## Findings and fixes

| Severity | Location                                                                                                              | Defect and resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium   | `src/features/tasks/pages/TasksPage.tsx:407`                                                                          | Historical client filters now include archived clients, but Add task copied the filter ID into the draft even though its picker excluded that client. A blank-looking picker silently submitted an archived relationship. **Fixed:** seed new tasks only from a known active client; retain an existing task's archived client. Tests submit active/archived filter drafts and verify the exact payload, plus historical label/disabled-option preservation.                                                                                                                                                                                                                                            |
| Medium   | `src/features/cases/pages/CaseDetailPage.tsx:592`                                                                     | Failed case/client lookup reads disabled Add payment/Add expense without showing their failure or offering recovery. Retrying the account/ledger could not recover these independent queries. **Fixed:** show localized loading/error/Retry for each lookup on Account, preserving usable ledgers/totals. Tests reproduce both lookup failures, retry the affected query, verify actions recover and open the payment form, and assert ledgers/accounts are not refetched.                                                                                                                                                                                                                              |
| Low      | `src/lib/dependentQueries.test.tsx:120`; `src/features/cases/pages/CaseDetailPage.test.tsx:207`; archive-picker tests | POA tests modeled archive/restore as removing members and incorrectly expected client-owned cases to disappear after a POA edit. They did not observe the client's actual POA-history query. Section-retry tests never checked their claimed read isolation; archived-option absence could pass without an open popup. **Fixed:** model update versus archive/restore separately, observe POA history, preserve case membership, check all dependent caches/read counts on rejected edits, count section reads, and await a visible active option before checking archive exclusion. Normal and rejected-mutation paths remain covered. Updated the implementation report's description of these tests. |
| Low      | `docs/reviews/2026-10-14-system-input-output-data-flow.md:567`                                                        | Expense creation was documented with an `OTHER` default; the form defaults to `COURT_FEE`. **Fixed:** correct the inventory; successful and rejected expense-save tests now assert the default type and integer amount actually submitted.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

The two application defects were reproduced before their fixes: the focused run failed three cases (two lookup recovery cases and one archived filter case), with 22 passing. The corrected focused regressions pass. A strengthened picker assertion initially exposed a test that had not opened the popup; focus/ArrowDown now makes that assertion meaningful. Typecheck also caught an incorrect archive field in the revised mock; it now uses the real `CasePowerOfAttorneyRef.archived` contract.

## Contract assessment

The shared Rust validation is used by create/update and enforces the requested reference/chronology rules. Optional references/dates and equal dates remain supported. No additional confirmed Rust or query-invalidation defect was found: broad client/case/POA/search invalidation includes former owners and marks inactive caches stale. The read guards hide failed cached totals and retain fee drafts. Both new translation keys (`records.sectionLoading`, `records.sectionLoadError`) exist in Arabic and English; fixes reuse existing labels and preserve inherited RTL and direction-isolated values.

The 2026-10-15 report described the intended behavior, but its complete archive-selection/retry and regression-evidence claims needed the corrections above. Its historical native screenshots and execution counts were not re-certified in this review.

## Validation results

| Check                                                                                           | Result                                                                        |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm test`                                                                                     | Passed: 609 renderer tests in 58 files, plus 80 Node script tests             |
| `pnpm lint`                                                                                     | Passed                                                                        |
| `pnpm typecheck`                                                                                | Passed after correcting the revised mock                                      |
| `pnpm format:check`                                                                             | Passed                                                                        |
| Isolated `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features`              | Passed: 179 tests; doc-tests passed                                           |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`                                     | Passed                                                                        |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed                                                                        |
| `git diff --check`                                                                              | Passed                                                                        |
| Script syntax / added translation-key parity                                                    | Both changed/new native scripts parse; both added keys exist in both catalogs |

Rust tests ran with `D=$(mktemp -d)` and `XDG_DATA_HOME="$D"`, preserving the cargo exit status and deleting only that disposable directory afterward. The command runner rejected shell `rm -rf`, so cleanup used Python `shutil.rmtree` on that same directory. No developer vault was accessed. Validation logs are under ignored `test-results/review-2026-10-21/`.

## Decisions and unresolved risks

- An archived client filter remains useful for historical browsing; a new task from that filter starts unlinked. An already-saved archived client link remains visible and retained. A seed is accepted only when its client lookup confirms it is active.
- Native desktop suites, container visual commands and fresh screenshots were not run, as requested. Source review and renderer/Rust tests do not certify physical Windows/Linux dialogs, assistive technology or target-platform acceptance. Capture adapters were reviewed and syntax-checked only; evidence image folders were not re-audited.
- Whole-family invalidation intentionally favors correctness over fewer reads. Existing persisted cases violating the tightened validation are not rewritten and must be corrected before editing. The earlier audit's other product decisions/release blockers remain outside this review.

## Visual regression on PR #10

Inspected `gh run view 39639695625 --log`, downloaded its artifacts into disposable
temporary directories, and compared the case-detail expected/actual images with
`CaseDetailPage`, `QuerySection`, the capture spec, route matrix and fictional
`captureBridge` responses. The four failures were a defect (decision **a**): the
summary's three account metrics and open-task metric had been split into separate
`facts-compact` grids. This introduced a third row and a divider, growing the card
and pushing the footer down (48 extra page pixels at 1366×768; 46 at 1440×900).
`QuerySection` returns its children without a wrapper on success; no missing mock,
loading row or lookup failure caused these images.

Restored one two-column definition list with the existing independent account and
task guards inside it. Loading/error/Retry still protect failed reads, and the
other metrics remain usable. No shared component, fixture, baseline, translation,
Rust or schema changes were needed. Added Arabic/English success regressions
(which failed against the split grids) and independent account/task failure/retry
checks. All 24 case-detail tests pass.

| Check                           | Result                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| `pnpm test`                     | Passed: 613 renderer tests in 58 files and 80 Node script tests  |
| `pnpm capture:visual:canonical` | Passed: 71 checks including all 68 captures; baselines unchanged |
| `pnpm lint`                     | Passed                                                           |
| `pnpm typecheck`                | Passed                                                           |
| `pnpm format:check`             | Passed                                                           |
| `git diff --check`              | Passed                                                           |
| Rust tests, format and clippy   | Not run: no Rust changes, as permitted by this task              |

The canonical comparison uses the task's explicit container exception. Restored
user ownership with the prescribed Alpine `chown` command; no root-owned entries
remain under `node_modules/.vite`, `test-results` or `tests/visual`. Logs are under
ignored `test-results/pr10-*.log`. No baseline update or native desktop suite was
run. Physical Windows/Linux acceptance remains outside this visual fix; no known
scoped defect remains. All changes remain in the working tree.
