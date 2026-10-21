# Windows native desktop CI investigation — 2026-10-21

Investigation only. No application, test, workflow, schema or acceptance-status
changes. No validation suites or native journeys were run. GitHub inspection was
read-only; no artifacts were downloaded. Windows and Linux are the launch scope;
macOS is excluded from this investigation.

## Evidence and regression boundary

Repository: `Mahmoud-s-Khedr/legal-masr`. Run links below contain the retained
sanitized logs. Evidence came from `gh run list --workflow desktop.yml`,
`gh run view --json`, `--log-failed`, the green run's `--log`, and local Git
history/source comparisons.

| Evidence                                                     | Run / commit                                                                                                                      | Observed result                                                                                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Last green Windows run before this failure streak, October 7 | [37634826211](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/37634826211), `80c7427b079c154920be1479a254c7c965000412` | Windows job and all five then-existing scenarios passed in all three attempts. Linux passed.                                                                                                                        |
| First failing run after that green, October 8                | [37754088929](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/37754088929), `a6324c15512711856590ed1f92cb3e9523d67823` | Failed step: **Windows journeys**. Main journey failed at `create-case` in all three attempts; the other four scenarios passed each time. Linux passed.                                                             |
| First scheduled run after October 10 adapter repair          | [38126736088](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/38126736088), `7826173a972d3a4d82bfcaf95fc5ce448034186a` | First attempt: main, password-portable and incomplete-installation restore passed; cancel/corrupt failed at `initialize-continue`; recovery failed at `recovery-preview`. Repair did not restore a green suite.     |
| Latest, October 21                                           | [39564082942](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/39564082942), `601a6cd44972b1e283f321619284ac3c1bcbf61c` | Linux passed; Windows failed **Windows journeys**. Main journey passed attempts 1 and 3, failed attempt 2 at `create-case`. Cancel/corrupt failed all three. Wrong-password, Settings and restart passed all three. |

The listed scheduled runs October 8–21 all failed overall. October 14–21 used
the same `601a6cd` source. This predates October 17 and is not a universal startup
failure or a failure of every Windows scenario.

`git log 80c7427..a6324c1` and the endpoint diff identify the plausible original
trigger: `156f7d9` replaced UI primitives, including the client checkbox with a
Base UI combobox; `5e4d6bd` adjusted the desktop journey to click/type/select an
option. They reached the first failing tree through merge `a6324c1` (with merge
`0d95fd7` also in the range). The Windows CDP adapter and desktop workflow are
identical at the green/first-red endpoints. The old adapter executed
`HTMLElement.click()`, which did not focus the new picker or deliver its pointer
handlers. This agrees with the October 10 investigation and the original
`create-case` failures. The logs alone do not identify the individual picker call
that failed.

Later changes must be distinguished from that original regression:

- `c8195cd` introduced portable backup authentication; `5e12b8e` integrated the
  canonical restore UI, and expanded journeys exposed more adapter requirements.
- `7826173` added trusted CDP mouse events, enabled checks, scoped queries,
  collections and condition polling. The main journey subsequently passes, but
  the remaining synchronization gaps below are still present.
- `0e2c07d` changed client/POA associations; `4ffba4b` and merge `601a6cd` removed
  product features. These are after the original regression and after the
  October 11 cancel/corrupt/recovery failures, so cannot explain its onset.

## What the checkpoints actually establish

All latest failures have `DESKTOP_SCENARIO_FAILED` and
`NO_ALLOWLISTED_DIAGNOSTIC`. These are harness classifications, not Rust error
codes. `failedDesktopOutcome()` drops the original scenario exception and maps
only two exact Arabic alert strings. Its corruption string is also stale against
the current translation. No diagnostic therefore does not prove no app error.

The exact failing **workflow step** is established. The exact failing
**individual call/assertion** is not retained by the existing reports:

- `initialize-continue` remains the checkpoint throughout `h.client()`, opening
  restore, choosing/cancelling/corrupt-file handling and navigation afterward.
  Latest cancel/corrupt page state has `workspacePresent: true`, `gatePresent:
false`, `confirmationPresent: false`, and `loadErrorPresent: false` in every
  attempt. It does not establish an initialization failure.
- `create-case` / `seed-case` encompass route activation, picker input, option
  selection, save and waiting for the case heading. The same main journey passes
  twice in the latest run. Some seed failures have an alert; others do not.
- At `recovery-preview`, the next call is
  `h.click(strings.backups.restoreConfirm)`. The October 11 first attempt and
  October 21 second attempt remain at the gate with an alert and no workspace.
  Failure preparing the preview is possible; the retained log does not say why.

## Ranked hypotheses for the remaining failures

**1. Windows CDP synchronization defects — strongest explanation.** The original
picker incompatibility is established in source and prior investigation; the
current failures remain consistent with incomplete adapter semantics:

- Linux uses WebdriverIO/tauri-driver; Windows launches WebView2 directly and
  uses `scripts/desktop-e2e-cdp.mjs`. Linux route activation uses focus + Enter;
  Windows uses pointer clicks.
- CDP `waitForClickable()` tests only visibility and the node's own enabled
  attributes. `click()` scrolls, hit-tests once, then immediately throws
  `CDP_ELEMENT_OBSCURED` or dispatches a mouse sequence at that one coordinate.
  It does not wait for stable geometry or an overlay to disappear. Combobox
  popups and dialogs explicitly animate for 100 ms in the UI source.
- The cancel/corrupt journeys click Cancel and immediately navigate to clients.
  `RestoreFromBackup.cancel()` awaits native cancellation before calling
  `onCancel`; the dialog can still intercept the next click. The CDP click
  acknowledgement does not await that application operation. This explains a
  repeatable failure with no alert and a successfully initialized workspace;
  confirmation requires finer checkpoints and a fixed adapter error category.
- Initialization clicks Submit and immediately reads `.recovery-key` without
  waiting. CDP `getText()` returns an empty string when the node is absent;
  initialization awaits native work before rendering it. A subsequently awaited
  checkbox cannot repair an already captured empty key. Recovery preparation
  explicitly refuses an empty secret, fitting the gate/alert/absent-preview
  evidence. Whether this race occurred in those runs is not recorded.

**2. A Windows application/IPC failure during save or recovery preparation.**
Some seed/recovery failures contain alerts, so a genuine backend refusal remains
possible. A field-validation alert caused by missed input/selection is also
possible. Existing reports cannot separate these. Distinguish this hypothesis by
recording only allowlisted application error categories and fine operation
checkpoints: a stable selected client plus a typed native save/prepare refusal,
after synchronization is corrected, would favor an application defect. Do not
infer SQLCipher corruption or change vault coordination from these logs.

## Exact proposed fix, for a subsequent implementation run

1. In `scripts/desktop-e2e.mjs`, wait for `.recovery-key` to be displayed before
   reading it; require a nonempty value without including its contents in any
   assertion message/report. After Cancel, wait until `.restore-from-backup` and
   its dialog are gone before navigating. After selecting a client, wait for its
   selected chip before saving. Keep real pointer interaction and existing
   preservation/restore assertions.
2. In `scripts/desktop-e2e-cdp.mjs`, make clickable readiness poll visibility,
   enabled state (including disabled ancestors), stable target bounds and an
   unobscured hit point within the existing bounded timeout. Re-resolve the
   target while waiting and immediately before dispatch. Retry readiness only;
   never replay a dispatched destructive action. Preserve refusal for permanent
   overlays. Make `getText()` wait for the target to exist instead of silently
   returning empty for a missing node.
3. In `scripts/desktop-e2e.mjs` and `scripts/desktop-e2e-driver.mjs`, add fixed
   checkpoints before client creation/save, picker open/input/select, case save,
   restore choose/cancel/closed and recovery prepare. Retain a separate strictly
   allowlisted harness failure category for the existing fixed CDP errors and
   assertions. Update the allowlisted application diagnostics to the current
   translations, including recovery-secret and required-field categories. Never
   retain arbitrary exception messages, selectors, field values, DOM or paths.
4. Extend `scripts/desktop-e2e-cdp.test.mjs` and the existing desktop driver tests
   with transient overlay/moving target success, persistent overlay and disabled
   ancestor refusal, delayed element reads, and unknown-error redaction. Add
   focused regression coverage for delayed recovery rendering and async cancel
   completion. JSDOM pointer-message tests alone cannot certify WebView2 timing.

No production fix, dependency pin or workflow relaxation is justified yet. These
are proposed changes, not implemented or verified corrections.

## Confirmation and decisions

In the implementation run, run the requested unit/static checks (Rust tests only
with a fresh temporary `XDG_DATA_HOME`). After supervisor review/push, dispatch
`desktop.yml` on that revision. Require all three attempts on both Windows and
Linux to pass, including cancelled/corrupt restore preservation, all portable
restore variants and restart persistence. Repeat on a fresh Windows runner to
check stability. If it still fails, use the new fixed categories/checkpoints to
choose the next application or harness fix; do not suppress failures or upload
vaults, security screens or raw errors. No workflow was dispatched in this run.

| Validation in this investigation                                            | Result                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Read-only GitHub run/job/log inspection and local source/history comparison | Completed as described above                                   |
| Full validation list, visual commands and native desktop suites             | Not run, as explicitly requested                               |
| Windows reproduction / proposed fix confirmation                            | Not performed; requires a subsequent implementation and CI run |

Only this report is changed. Plan/testing implementation statuses are unchanged
because this run implements no behavior. Public-launch Windows acceptance remains
open. The last-green boundary and original picker mismatch are established; the
precise residual failure calls and a successful repair remain unverified.

## Implementation run 1

Implemented only proposed step 1 in `scripts/desktop-e2e.mjs`: initialization
waits for a displayed recovery key and polls for nonempty text without reporting
its value; both Cancel restore flows wait for the restore content and dialog to
be removed before navigation; all three client-picker selections wait for the
selected chip before saving. Existing pointer interactions and assertions remain.
Waits use the existing 15-second timeout. Each picker starts empty with one
matching seeded client, so its first displayed chip establishes selection.

Steps 2–4 remain unimplemented. Application, adapter, workflow and acceptance
statuses are unchanged. No native desktop suites were run; Windows/Linux timing
and successful CI repair remain unverified. Slice validation results follow.

| Slice validation                 | Result                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| `node --test scripts/*.test.mjs` | Passed: 60 tests                                                     |
| `pnpm lint`                      | Passed                                                               |
| `pnpm format:check`              | Passed after formatting this review; initial check flagged this file |
| `git diff --check`               | Passed                                                               |

Rust, visual and native desktop suites were skipped as instructed. No new
business rules or step 4 regression tests were added in this slice.
