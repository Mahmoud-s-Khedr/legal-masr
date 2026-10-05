# CI investigation — 2026-10-06

[Run 37385566294](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/37385566294)
failed only its native initialization/client/case/attachment/backup/restore
journey. Four other journeys passed. The uploaded report contained a generic
scenario error and no operation checkpoint, so the exact original cause
cannot be established from that artifact.

## Reproduction and changes

Work started from `de1d579`. A Fedora native run passed. An Ubuntu 24.04
container with the same WebKit/driver version as CI (`2.52.6`) passed a focused
backup/restore probe and two complete suites, then failed its third suite at
`edit-after-backup`; restart persistence also failed. Operation checkpoints
were added in `e34a890` before that reproduction. The reported checkpoint is
an operation category, not a record name, path or raw driver message.

The runner previously used WebdriverIO scrolling through wheel actions and
animation-frame callbacks, with a DOM fallback affected by the application's
smooth scrolling. Button clicks now use synchronous DOM scrolling with
`behavior: instant` before waiting for clickability and issuing a real native
WebDriver click. This removes scrolling animation and frame scheduling from
this harness interaction. It is a plausible correction for the intermittent
failure, not proof of the exact cause in the original GitHub run.

Linux now completes all configured attempts, retains each available sanitized
report, removes stale reports before each attempt, and fails overall if any
attempt fails or produces no report. Fixed allowlisted checkpoints make
future native failures actionable without retaining secrets, paths or DOM.

The full frontend suite also exposed a dashboard test that assumed the real
calendar date was October 5. Only that test now freezes its local clock to
fictional October 5 at noon and restores real timers afterward.

## Validation

- `pnpm test`: 221 frontend tests in 25 files and 44 Node tests passed.
- `TZ=America/Los_Angeles pnpm exec vitest run src/features/workflows.test.tsx`:
  43 tests passed, including the fixed local-date assertion.
- Lint, typecheck, formatting and frontend/native builds passed.
- After synchronous scrolling: three consecutive Ubuntu 24.04/Xvfb suites
  passed all five scenarios each, including wrong password, cancelled/corrupt
  restore, restart persistence, restored records and attachment bytes.
- Shell execution tests verify one PR attempt, failure retention across three
  attempts, and rejection of missing/stale reports. Diagnostic tests reject
  arbitrary checkpoint data.

Native binary SHA-256: `72e379b8e1344335eef3217aa22bf1a50ed02284092224b0ac6f09579132ba31`.
The Ubuntu image used Node 24.20.0; GitHub CI pins Node 22.21.1. The container
binary was built through the Tauri CLI with the existing frontend output.
A preliminary plain Cargo development build could not load onboarding and
was discarded as a mismatched reproduction, not application evidence.
Sanitized reports are ignored under
`test-results/desktop/ubuntu-fixed-run-{1,2,3}.json`.
Measurements describe `e34a890` plus the synchronous-scroll change, before its
commit. No database, production behavior, permissions or visual baseline
changes were made.

## Unresolved gates

The original failure remains unconfirmed. Validate the final committed fix on
GitHub, where the Node version and runner environment match the workflow.
Windows/macOS physical validation and existing visual/coverage approval gates
remain open. Passing these native regression journeys does not close them.
