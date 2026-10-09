# Independent review of the 2026-10-09 full-app testing report

Reviewer date: 9 October 2026. Application revision under test: `2dda15a` (working tree unchanged; `git diff` is empty). The testing report and its evidence were treated as claims to verify.

This is a separate review. It changes no application code, migration, visual baseline, or existing evidence file **with one disclosed exception** (see [Integrity notice](#integrity-notice-i-overwrote-one-existing-evidence-file)).

## Integrity notice: I overwrote one existing evidence file

While re-running the auditor's native runner, `scripts/full-app-native-audit.mjs` wrote its catch-all failure screenshot to a **hard-coded** path (`docs/reviews/evidence/2026-10-09/full-test/native/failure-${language}.png`, line 1345) that ignores the `NATIVE_AUDIT_OUTPUT` override I had set. My first attempt failed because the override directory did not exist, which triggered that path.

- File replaced: `full-test/native/failure-ar.png`. Original: 118,903 bytes, sha256 `5840d048…8e58` (per the manifest). Now: 97,491 bytes, sha256 `bb73ed31…7f54`, mtime 20:46:08 on 9 October.
- The original is **unrecoverable by me** (no VCS history for the untracked evidence; no copy found on disk). I did not edit `artifact-manifest.json` to hide the change. It now reports 1 mismatch of 455.
- Impact on conclusions: none that I can find. The file is a generic failure capture from the auditor's first run; `final-results.json`, the Markdown report and the HTML report contain no reference to it.
- All other 454 manifest hashes still match. The 454 matches and the single mismatch were both checked after my work.

The auditor should regenerate or drop that manifest entry. The runner hazard is also a finding (H5 below).

## What I executed, and what I did not

Executed (Linux only, Fedora, display `:0`, WebKitGTK via `tauri-driver`):

| Activity                                                                                                  | Result                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebuilt the native harness (`pnpm build:desktop:e2e`) from HEAD                                           | Binary sha256 identical to the auditor's (`c718bbba…ea222`). The rebuild was incremental (6.6 s), so it does not prove clean-build determinism. |
| Independent reproductions: 6 native scripts (serial, disposable fictional vaults) and 8 renderer scripts  | See findings. Scripts and raw outputs are in `evidence/2026-10-09/independent-review/`.                                                         |
| Auditor's `full-app-native-controls.mjs`, output redirected                                               | 11 passed / 2 failed. Same two failures as reported.                                                                                            |
| Auditor's `full-app-native-audit.mjs --functional-preflight`, output redirected                           | **66 / 66 passed, 0 failures** in one clean run.                                                                                                |
| `pnpm vitest run` (default parallelism)                                                                   | 321 passed / 41 files; the reported 5 s hearing timeout did **not** recur.                                                                      |
| `node --test scripts/*.test.mjs`                                                                          | 60 passed.                                                                                                                                      |
| `cargo test --locked` (src-tauri)                                                                         | 99 passed (76+3+8+2+1+8+1).                                                                                                                     |
| Renderer probes in Chromium against the capture-mode dev server                                           | See BUG-03, BUG-04, A3.                                                                                                                         |
| Artifact audit: 455 hashes, count reconciliation, mtimes, CSV parse, route table, AST scan of form fields | See evidence section.                                                                                                                           |

**Not executed:** the auditor's `audit-backup-portability.mjs` (it hard-codes its output into the committed evidence directory; I wrote an equivalent instead); typecheck, lint, Prettier, clippy, coverage, canonical Docker visual comparison, and the Debian package build (I only read their retained logs and confirmed the coverage numbers against the retained summaries); any Windows or macOS run; physical file dialogs; screen readers; WebKit with real pointer or keyboard input (all native interaction is WebDriver-driven, and my history-back test calls `window.history.back()`); Windows↔macOS portability. **Nothing here certifies Windows, macOS, or accessibility conformance.**

Blockers met: one transient WebDriver startup failure on a back-to-back native launch (the identical script passed on immediate retry); the shared port 4444 makes strictly serial execution necessary, as the report says.

## Verdicts

| Finding | Report severity | Verdict                 | My severity   | One-line reason                                                                                                                                                                       |
| ------- | --------------- | ----------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-01  | P1              | **Confirmed**           | P1 (blocker)  | Reproduced. But it is the documented design gap B01, not a regression, and the situation is worse than reported (no workaround; dead-end screen).                                     |
| BUG-02  | P2              | **Confirmed**           | P3            | Reproduced natively in both locales. Root cause is exact. No data loss; focus moves to the field; isolated to one form.                                                               |
| BUG-03  | P3              | **Confirmed**           | P3 (cosmetic) | Reproduced. Not new: filed as F10 on 2026-10-08, together with ~12 sibling Arabic-comma separators.                                                                                   |
| BUG-04  | P2              | **Partially confirmed** | P3            | Real, but **not native or WebKit specific** and not on the ordinary click path. Reproduced in Chromium. Cause identified. The report's "fixtures would miss it" explanation is wrong. |

## BUG-01: standalone backup cannot recover a fresh installation: confirmed

**Fresh evidence** (`results/bug01.json`, `results/bug01-fresh-install-restore.log`):

- Source vault validates its own backup in the same session and again after an app restart plus unlock. This rules out "validation only works in-session".
- Fresh installation, same password: `backup_validate` and `backup_restore` both return `BACKUP_CORRUPTED`. Destination client kept; source client absent; destination still usable afterwards (a second client was created).
- Control: the destination's own newest backup validates, so the validate path itself works for same-key archives.
- Fresh-install setup exposes four buttons (language switch, two show-password toggles, submit). There is no restore control.

**Cause (code, `src-tauri/src/security/mod.rs:179`, `backup/mod.rs:132`):** the vault master key is `random_32()` at initialisation, and the backup key is `SHA256(master ‖ context)`. A second installation with the same password gets a new random master key, so decryption can never succeed. The report's reproduction is therefore a faithful simulation of "reinstall on a new machine", but the failure is the documented design: `docs/plan/07-backup-format.md` "Known gaps" says portable restore "is not yet designed or validated", and `docs/plan/09-testing.md` says a copied security envelope must not be counted as portability.

**Things the report understates or gets slightly wrong:**

1. _"Same original password" is not the missing ingredient._ The archive also contains the SQLCipher database encrypted under the same master key, and the recovery key only unwraps the master key from `security.json`. Password plus recovery key without `security.json` also cannot recover anything.
2. _There is no manual workaround._ Test `results/bug01-security-json-only.log`: with the old `security.json` and the backup placed in a new installation, startup reports `INCOMPLETE`; unlock returns `VAULT_MISSING`; restore returns `APP_LOCKED` (restore needs an unlocked vault). The only on-screen control is "Retry".
3. _The `INCOMPLETE` screen contradicts itself._ Its message says to recover the workspace, and the catalogue text for `VAULT_MISSING` says "restore a verified backup", but the screen offers no restore action. See A1.
4. _"Misleading corruption advice" is fair but incomplete._ A valid archive under another key returns `BACKUP_CORRUPTED` ("damaged or invalid"). A plainly corrupt file returns a different code (A2). The two cases are classified inconsistently.

**Severity:** P1 stands and matches `docs/plan/10-roadmap-and-phases.md` blocker 2. The report's "re-confirms B01" is right; it is not new.

**Acceptance criteria (revised):**

- Backup archive carries a key envelope that can be opened from the password and, separately, from the recovery key, independent of the source installation's `security.json`. Requires a backup-format version bump and compatibility handling. This is not a database migration, but the format change belongs in `docs/plan/07-backup-format.md`.
- Fresh-install setup **and** the `INCOMPLETE` / `VAULT_MISSING` gates expose "Restore from a backup", with an authenticated flow that needs no unlocked vault.
- Restore into an empty installation yields records and byte-identical managed attachments; the vault locks afterwards (current behaviour) and unlocks with the original password.
- Failure (wrong password, corrupt, newer schema, truncated) leaves the destination untouched and returns distinct, user-meaningful codes (not one `BACKUP_CORRUPTED` for wrong-key, plus another for garbage).
- Rust tests for wrong password, wrong recovery key, tampered envelope, downgrade/upgrade of the format version; one native test for fresh-install restore. Same-vault restore passes do not close this.
- Windows↔macOS exercise stays a separate, physical gate.

## BUG-02: empty opponent form gives no validation feedback: confirmed, severity lowered

**Fresh evidence** (`results/bug02-en.json`, `results/bug02-ar.json`, screenshots), both locales:

| Step                       | Opponent dialog                                                                  | Positive control (Tasks empty submit, same app)                                     |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Empty name, Save           | dialog stays; `alerts: []`; `aria-invalid="true"` count 0; no `aria-describedby` | alert "Check the value you entered."; `aria-invalid="true"`; `aria-describedby` set |
| Whitespace-only name, Save | same; zero opponents persisted                                                   |                                                                                     |
| Valid name, Save           | exactly one opponent created                                                     |                                                                                     |

The positive control matters: it shows the harness can observe feedback when the app produces it, which excludes a measurement artefact.

**Root cause (verified in source, `CasePartiesPanel.tsx:193`, `FormField.tsx`):** `Field` receives no `error` prop, and `Field` overwrites the child's own `aria-invalid` via `cloneElement(..., { 'aria-invalid': error ? true : undefined })`. React-hook-form and Zod do reject the submission (the form never submits), so the error exists and is simply never rendered. This is a better explanation than the report's and explains why `aria-invalid` reads `null` rather than `"false"`.

**Nuance the report omits:** after the failed submit, focus moves to the empty name input, so the form is not wholly silent; it is "no message, no announcement". "Appears unresponsive" is slightly overstated.

**Blast radius:** an AST scan of every `Field` usage (`results/scan-field-error-omission.txt`) finds this omission **only** in `CasePartiesPanel.tsx` (6 fields). Payment, expense and task forms show feedback in the renderer probe.

**Severity:** P3. No data is lost, the failure is recoverable, and focus gives a weak cue. Treat it as P2 only if WCAG 3.3.1 (error identification) is a release criterion. The fix is small, so schedule it before beta regardless.

**Acceptance criteria:** invalid submit shows the localized required message under the name field in Arabic and English; the input exposes `aria-invalid="true"` and `aria-describedby` to the message; whitespace-only is treated as empty; draft retained; focus on the field; a regression test for both locales and for the whitespace case.

## BUG-03: English case page shows an Arabic fallback: confirmed, not new

Reproduced in the renderer fixture in both locales (`results/bug03-fallback-text-chromium.txt`): the English row reads `دون صفة مسجلة`. The source is `|| 'دون صفة مسجلة'` in `CasePartiesPanel.tsx`. The same defect, plus about a dozen `.join('، ')` Arabic-comma list separators (cases, POAs, tasks, finances, agenda, dashboard), was already recorded as **F10 (LOW)** in `2026-10-08-original-agent-findings.md`. The new report neither cites F10 nor mentions the separators. I verified the separators in source only, not at runtime.

Severity: P3, cosmetic. Acceptance: a translation key in both catalogues, `Intl.ListFormat` (or a locale separator) for joined names, and a regression assertion for an opponent with no capacity and no lawyer, in English and Arabic.

## BUG-04: native settings show blank selected values: partially confirmed

The reported symptom is real, but the report mischaracterises where and when it happens.

**Fresh evidence** (`results/bug04b.json`, `bug04c.json`, `bug04.json`, Chromium results):

| Route to the Display tab                                                                                                           | Native (real Tauri)         | Chromium fixture |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------- |
| Sidebar → Settings → **click** "Display and calendar" (Arabic: in-page navigation after Settings was already mounted, same effect) | **populated**, both locales | populated        |
| Deep link `/settings?tab=general` as the first Settings visit                                                                      | **blank** (3 of 5)          | **blank**        |
| Leave Settings, then history-back onto `/settings?tab=general`                                                                     | **blank**                   | **blank**        |
| In-session onboarding, then the auditor's `go('/')` + `go('/settings?tab=general')`                                                | **blank**                   | n/a              |
| In-session onboarding, then sidebar + tab click                                                                                    | populated (after render)    | n/a              |

So:

- **It is not native-only and not WebKit-specific.** Plain Chromium against the fixtures reproduces it. The report's claim that "the Chromium fixture screen shows populated values, so this native regression would be missed by screenshot fixtures" is wrong. The fixture audit simply reached the tab by clicking, which is the path that works.
- **The ordinary click path is unaffected**, so "a desktop user cannot see the currently saved language, appearance, or date format when opening Display and calendar" is overstated. It affects deep links and back-navigation onto that tab. I found no in-app link to `?tab=general`; the only in-app settings deep link is `?tab=about`. I did not test a real hand-operated back button.
- **No data loss.** In the blank state no dropdown option is marked selected, but saving without touching anything leaves persisted language/theme/date format unchanged, and choosing a value persists correctly (e.g. Dark), while untouched selects stay blank until the page is revisited.

**Root cause (now confirmed, not "unconfirmed" as the report says):** `useForm` in `SettingsPage.tsx` has no `defaultValues`. When the page mounts directly on the Display tab, `field.value` is `undefined` on the Selects' first render, so Base UI treats them as uncontrolled; the later `reset()` cannot change them. `weekStartsOn` is wrapped in `String(...)`, so it is always defined, which is exactly why Saturday and 60 displayed. Corroboration: Base UI logs "changing the uncontrolled value state of Select to be controlled" on the deep-link path (`results/bug04-console-warning-chromium.txt`), and the repository's own `SettingsPage.workflows.test.tsx` already printed the same warning on stderr in my full run. That test passes because it never asserts the visible labels.

**Auditor-harness note:** `settings-general-save-through-ui` navigates by deep link and asserts persistence only, so it passed on the exact path that shows blank labels. The failing check's `settings-select-values.json` holds the reading taken before the five-second wait; the failure is the later wait.

**Severity:** P3. **Acceptance criteria:** the three labels are visible for every entry route (click, deep link, history-back) in both locales, asserted in a native test and in a component test that mounts directly on the Display tab; no uncontrolled/controlled console warning; a no-touch save is idempotent.

## Evidence, provenance, and harness audit

**Verified sound:**

- Result counts reconcile: 84 results, 82 passed and 2 failed. This is 66 workflow + 11 control + 5 smoke passes, and 2 control failures.
- The manifest's 455 hashes matched before my work. The binary hash matches my rebuild.
- Rust 99, Node 60 and frontend 321 reproduce. Coverage figures match the retained summaries. The 102 overflow measurements are all 0.
- Retained screenshots show the states described.
- The 66 workflow scenarios now pass in one clean run, which supports the "superseded after harness correction" narrative.

**Concerns:**

- **H1: provenance of the superseded failures cannot be re-verified.** The runners are untracked, so the earlier runner revisions behind `native`, `native-rerun` and `native-final` no longer exist. Only the narrative supports "selectors were corrected". I confirmed the corrected runner passes, not why the earlier ones failed.
- **H2: post-hoc rewriting.** About 20 result JSONs share an mtime of 19:54:55, five minutes after their runs; their formatting is Prettier-style, not `JSON.stringify` output. Semantically benign, but they are not raw runner output.
- **H3: uneven binary provenance.** `binarySha256` is recorded only for the main native, rerun, final, and smoke results. Controls, extra, select-check and portability results record none. The binary's mtime (19:29) predates all of them, so it is inferable but not stated.
- **H4: the frontend timeout classification is unproven.** One failure with no recurrence in two later runs (mine included) is consistent with timing instability but is not a diagnosis.
- **H5: runner hazards.** `full-app-native-audit.mjs` does not create its output directory and hard-codes its failure screenshot path (caused my overwrite). `audit-backup-portability.mjs` writes into the committed evidence directory unconditionally, so the report's documented commands overwrite evidence. `full-app-native-controls.mjs` `check()` swallows errors into a generic `AUDIT_CONTROL_FAILED`.
- **H6: weak failure assertions.** The corrupt-restore checks (both the auditor's and `scripts/desktop-e2e.mjs`) wait for _any_ `[role="alert"]`, never the code or message. A garbage file returns `OPERATION_FAILED`, not `BACKUP_CORRUPTED` (A2).

## Coverage audit: what each number actually means

| Layer                               | What it is                                                                                                                                                                                                                                                                                                                                                                                       | Not                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 3,212 "control observations"        | Inventory only. Only **1,107 distinct** (page, tag, role, label, href) signatures; the rest are locale × viewport repeats. Includes aria-hidden Base UI hidden inputs in the 238 "unlabelled" rows.                                                                                                                                                                                              | Not 3,212 tested controls. No click assertion.                                       |
| 102 route renders                   | 17 surfaces × 2 locales × 3 viewports in Chromium with a no-op mutation bridge: visible selector, `dir`, screenshot, zero overflow, zero alerts.                                                                                                                                                                                                                                                 | No persistence, no WebKit, no interaction.                                           |
| Other browser checks (of 176 total) | 58 tab clicks (29 per locale), 10 empty-submit checks (5 forms × 2 locales, "a field error is visible"), 4 keyboard/mobile checks, 2 uncaught-error checks.                                                                                                                                                                                                                                      | Opponent, payment, expense and settings forms were not in the empty-submit set.      |
| 321 frontend / 60 script tests      | jsdom/mocked bridge and unit tests.                                                                                                                                                                                                                                                                                                                                                              | Not real IPC.                                                                        |
| 99 Rust tests                       | Service/repository/backup tests.                                                                                                                                                                                                                                                                                                                                                                 | Not through the renderer.                                                            |
| 66 native workflow results          | 33 scenarios × 2 locales, real IPC. By my static (heuristic) count **8 of 33 per locale perform no UI interaction** (IPC-only: financial summary, POA linking, invalid money/payer, duplicate identifiers, attachment single-owner, attachment metadata, repeated restore, password change/recovery), and `all-detail-tabs-and-settings-sections` only clicks and screenshots with no assertion. | "Through-UI" is only in names that deserve it; the rest are real-IPC service checks. |
| 13 native control checks            | English only. Opponent flows, search/archive filters, relationships, task delete, theme, calendar controls, attachment UI edit never ran natively in Arabic.                                                                                                                                                                                                                                     | Arabic native parity is not established for these.                                   |
| 5 smoke journeys                    | Existing suite.                                                                                                                                                                                                                                                                                                                                                                                  |                                                                                      |

**Overclaims and gaps:**

1. "Every defined page surface was exercised" is accurate only as a _rendering_ statement. The fixture matrix renders only the case-scoped variants of `/attachments` and `/finances`, and only the default (profile) tab of `/settings`.
2. Fixture screenshots of Settings tabs are reached by clicking; they cannot represent the deep-link state, which is how BUG-04 escaped.
3. Complete user-driven, persistence-verified end-to-end coverage is a small subset: initialise, client create, case create, wrong-password gate, and a few others. The report's own matrix says this; the headline "66 passed" invites a broader reading.
4. "Production Rust coverage 42%" and the "passed the proposed floors" claim are correct but are code coverage, as the report states.
5. All native interaction is WebDriver-simulated; the harness substitutes file-picker choices.

## Additional verified defects

| ID  | Severity | Finding                                                                                                                                                                                                                                                               | Verification                                                 |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A1  | P2       | `INCOMPLETE`/`VAULT_MISSING` gate tells the user to restore a backup but offers only "Retry". Unlock returns `VAULT_MISSING`; restore needs an unlocked vault. Combined with BUG-01, a user who reaches this state has no in-app route to their data.                 | Native (`bug01-security-json-only`)                          |
| A2  | P3       | A non-JSON/garbage backup returns `OPERATION_FAILED` ("The action could not be completed…") instead of `BACKUP_CORRUPTED`, because `decrypt()` propagates `serde_json::from_slice(...)?`. Wrong-key and garbage inputs get different codes. No test asserts the code. | Native + source                                              |
| A3  | P3       | The entity-picker chevron (`<button aria-haspopup="listbox">` containing only an icon) has no accessible name and is focusable, on Task, Case, POA and Finance forms. The report's inventory shows these as unlabelled rows but does not flag them.                   | Chromium ARIA snapshot; WebKit and screen readers not tested |
| A4  | Info     | The locked gate always renders in the Arabic default regardless of the saved language (presumably because settings live inside the encrypted vault; not verified), with a language switch. Possibly deliberate; needs a product decision.                             | Native observation                                           |
| A5  | Info     | Arabic-comma list separators in English UI (F10, not new).                                                                                                                                                                                                            | Source only                                                  |

## Contradictions found

1. BUG-04 "native regression missed by fixtures" versus reproducing it in Chromium (resolved above).
2. BUG-04 "root cause unconfirmed" versus a Base UI warning already emitted by the repository's own test suite.
3. BUG-01's framing as a fresh finding versus its status as a documented, tracked gap.
4. BUG-03 presented as new versus F10 of 2026-10-08.
5. BUG-02 "appears unresponsive" versus focus moving to the field.
6. "Three repeated restores per locale" is listed in the report's backup-controls row, but that scenario is IPC-only.

## Reproduction commands

All native scripts take an output directory as their first argument and must run **one at a time** (shared port 4444). They write only there, and they create it.

```bash
pnpm build:desktop:e2e
D=docs/reviews/evidence/2026-10-09/independent-review
TZ=Africa/Cairo node $D/scripts/bug01-fresh-install-restore.mjs   /tmp/review-out
TZ=Africa/Cairo node $D/scripts/bug01-security-json-only.mjs      /tmp/review-out
TZ=Africa/Cairo node $D/scripts/bug02-opponent-validation-native.mjs /tmp/review-out en   # then: ar
TZ=Africa/Cairo node $D/scripts/bug04-settings-entry-paths-native.mjs /tmp/review-out
TZ=Africa/Cairo node $D/scripts/bug04-blank-state-effects-native.mjs  /tmp/review-out
TZ=Africa/Cairo node $D/scripts/bug04-cold-start-native.mjs           /tmp/review-out

# Renderer probes (terminal 1, then terminal 2)
VITE_CAPTURE_MODE=true pnpm vite --host 127.0.0.1 --port 4173
for s in bug04-settings-entry-paths-chromium bug04-console-warning-chromium bug03-fallback-text-chromium \
         a11y-unnamed-controls-chromium a11y-picker-aria-snapshot-chromium scan-field-error-omission; do
  node $D/scripts/$s.mjs
done
```

Auditor runners, only with redirected output **and** with the caveat that `native/failure-*.png` is always written to the committed evidence directory on a catch-all failure:

```bash
mkdir -p /tmp/audit-out
NATIVE_CONTROLS_OUTPUT=/tmp/audit-out TZ=Africa/Cairo node scripts/full-app-native-controls.mjs
NATIVE_AUDIT_OUTPUT=/tmp/audit-out    TZ=Africa/Cairo node scripts/full-app-native-audit.mjs --functional-preflight
```

Fictional data and throw-away test passwords only. No real vaults were touched and no external message was sent. The retained outputs contain no vaults, archives or keys.

## Revised release-readiness recommendation

**Still not ready for real client data.** Nothing I found lowers the original verdict, and one item raises it.

**Blockers (unchanged or strengthened):**

1. **Portable disaster recovery** (BUG-01, B01) _plus_ an in-app restore path from `INCOMPLETE`/fresh states (A1). Without it, any lost or reinstalled machine means unrecoverable backups.
2. **Windows and macOS physical validation**: not performed by either report or this review.
3. The remaining roadmap blockers in `docs/plan/10-roadmap-and-phases.md` (automatic backups and retention, exports, permanent deletion, tray, installers, legal review) are unaffected.

**Not release blockers on their own:** BUG-02, BUG-03, BUG-04 and A2/A3 (all P3 by my assessment). Fix BUG-02 before a beta because it is small and affects accessibility. Fix BUG-04 with a deep-link/history-back regression test. Fix the corrupt-file classification (A2) together with the BUG-01 work, since both change the backup error contract.

**Process recommendations:** track the audit runners in version control; give every runner an output-directory option that is honoured everywhere and create it; record the binary hash in every native result; assert error codes (not just "an alert") in corrupt/rejection checks; report IPC-only scenarios as a separate line from UI-driven ones; and split the 3,212 observations into distinct controls before quoting a number.
