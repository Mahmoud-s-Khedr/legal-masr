# Desktop CI driver repair — 2026-10-10

Scope: repair native regression automation; no production UI, database,
permissions, thresholds or workflow acceptance changes.

## Evidence and changes

The [scheduled run](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/38038373764)
failed on Windows in all three attempts. Case-creation and seed-case checkpoints
failed after initialization and client creation. The CDP adapter used
`HTMLElement.click()`, which does not focus the client combobox or deliver its
pointer handlers. It also omitted `waitUntil`, `isEnabled`, `$$`, scoped `$` and
`getAttribute`, although cancellation, recovery and opponent scenarios use them.
Several failures retained the initialization checkpoint because later operations
had not updated it; that checkpoint does not establish an initialization defect.

The adapter now scrolls and hit-tests the target and sends the browser's mouse
move/press/release sequence. Enabled-state waits reject disabled controls. It
supports collections, scoped CSS/XPath queries, attributes and condition polling.
Regression tests exercise pointer sequencing, obscured-click refusal,
disabled/timeout paths, recovery-field collections and scoped validation alerts.
A real Chromium check against the app's fictional capture fixtures selected a
client in the Arabic case form through the repaired CDP adapter.

The [push run](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/38014713937)
and [earlier run](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/38009821234)
failed on Linux at `restored-clients` during incomplete-installation restore;
other attempts passed. Sidebar navigation now focuses the link and presses Enter,
using the same activation approach already used for restored case links, then
waits for the requested pathname. This addresses the native WebKit click stall
without retrying or suppressing failed journeys. All configured CI attempts
still must succeed.

## Local validation

- `pnpm test`: 573 frontend tests in 55 files and 64 script tests passed.
- Desktop driver/workflow subset: 28 tests passed.
- CDP regression tests, including scoped XPath: 6 passed.
- Lint, typecheck, formatting and `git diff --check`: passed.
- `pnpm build:desktop:e2e`: passed, including the production frontend build.
- Real Chromium CDP checks: trusted pointer/focus behavior and the app's Arabic
  case client picker passed.
- Initial Fedora/X11 native execution: all ten non-picker journeys passed;
  native-picker cancellation failed because the host lacked `xdotool`.
  CI already installs it. The repeat uses a temporary extracted Fedora package
  outside the repository and leaves system packages unchanged.
- Complete native repeat with that prerequisite: all 11 journeys passed,
  including the real picker and incomplete-installation restore. Harness binary
  SHA-256: `da9acdd28e7b9530b84d18419cd88950ac5f217c211fb4211eb381e59ee02ade`.

## Remaining validation

Fresh GitHub Linux/Windows checks are required after pushing the change. Local
Chromium driver evidence does not certify WebView2 or a physical Windows/macOS
installation. Existing release blockers and visual approval gates remain open.
