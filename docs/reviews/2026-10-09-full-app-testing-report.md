# Legal Masr — end-to-end testing and bug report

Date: 9 October 2026. Application revision: `2dda15a5c8c43218d18c097e24728a153fa52703`.

**Verdict: not ready for use with real client data.** The main local record workflows passed. Four defects were confirmed, including a backup disaster-recovery blocker. Every defined page surface was exercised, but this is **not a claim that every control has passed a real desktop end-to-end test**. OS integrations and several secondary workflows have only component/service coverage or remain unverified. The action matrix and explicit gaps below define the actual coverage.

No production application code, migrations, existing visual baselines, or user vaults were changed. New audit runners and this evidence set are the deliverables. All records and attachments used for testing were fictional. Disposable vaults, backups, passwords, and recovery keys are excluded from retained evidence.

## Test environment and evidence

The native tests used a freshly rebuilt Tauri desktop harness on Linux with WebKit, real IPC, SQLCipher, encrypted backups, and managed attachment copies. The harness substitutes allowlisted fictional files for native file-picker choices; it does not prove physical dialog behavior. Its binary checksum is recorded in the [native manifest](evidence/2026-10-09/full-test/native/capture-manifest.json).

Browser checks used the development capture bridge, whose mutations are no-ops. These establish renderer behavior, not database persistence. The canonical comparisons ran in the repository's pinned Playwright Ubuntu container. Arabic/RTL and English/LTR were exercised at 1366×768 and 1440×900; renderer checks also exercised 760×900. Browser fixtures use a fixed 3 October clock; native workflows use the actual 9 October date in Africa/Cairo.

Open the [HTML report](2026-10-09-full-app-testing-report.html) for embedded evidence and a searchable screenshot gallery. The [visible-control inventory](evidence/2026-10-09/full-test/visible-controls.csv) contains 3,212 control observations across the route/locale/viewport matrix. An observation is an inventory entry, **not an individual successful click assertion**. JSON results and logs are linked below; the final consolidated results include rerun provenance.

## Validation results

| Layer/check                                         | Result                                                                                                                   | Evidence                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend tests, controlled complete rerun           | **321 passed / 41 files**                                                                                                | [Full log](evidence/2026-10-09/full-test/frontend-tests-serial.log)                                                                                                            |
| Node test suites for scripts                        | **60 passed**                                                                                                            | [Full log](evidence/2026-10-09/full-test/script-tests.log)                                                                                                                     |
| Rust unit/integration tests                         | **99 passed**                                                                                                            | [Full log](evidence/2026-10-09/full-test/rust-tests.log)                                                                                                                       |
| Browser route/tab/form/keyboard checks              | **176 passed**                                                                                                           | [Results](evidence/2026-10-09/full-test/browser/results.json)                                                                                                                  |
| Canonical screenshot comparison and keyboard checks | **69 passed**: 68 comparisons + 1 interaction test                                                                       | [Full log](evidence/2026-10-09/full-test/canonical-visual.log)                                                                                                                 |
| Main native workflow matrix                         | **66 unique locale/scenario checks passed after harness corrections**                                                    | [Consolidated results](evidence/2026-10-09/full-test/final-results.json)                                                                                                       |
| Additional native control checks                    | **11 passed / 2 failed** across 13 unique checks: opponent validation and blank settings values are the product failures | [Consolidated results](evidence/2026-10-09/full-test/final-results.json)                                                                                                       |
| Standard native smoke journeys                      | **5 passed**                                                                                                             | [Results](evidence/2026-10-09/full-test/desktop-smoke/results.json)                                                                                                            |
| Backup portability experiment                       | Original-vault validation and destination preservation passed; **3 defect observations**                                 | [Results](evidence/2026-10-09/full-test/portability/results.json)                                                                                                              |
| Typecheck, lint, formatter                          | Passed on final audit files                                                                                              | [Typecheck](evidence/2026-10-09/full-test/typecheck-final.log), [lint](evidence/2026-10-09/full-test/lint-final.log), [format](evidence/2026-10-09/full-test/format-final.log) |
| Cargo formatting / clippy with warnings denied      | Passed                                                                                                                   | [Formatting](evidence/2026-10-09/full-test/rust-format.log), [clippy](evidence/2026-10-09/full-test/rust-clippy.log)                                                           |
| Renderer and production Rust coverage policy        | Passed the repository's proposed floors                                                                                  | [Policy results](evidence/2026-10-09/full-test/coverage-policy.log)                                                                                                            |
| Native harness build / normal Debian debug package  | Passed                                                                                                                   | [Harness build](evidence/2026-10-09/full-test/native-build.log), [normal build](evidence/2026-10-09/full-test/production-debug-build.log)                                      |
| Production binary excludes test harness markers     | Passed                                                                                                                   | [Boundary scan](evidence/2026-10-09/full-test/production-boundary.log)                                                                                                         |

Renderer coverage was 86.26% statements/lines, 82.75% branches, and 74.14% functions. Production Rust coverage was 42.49% lines, 40.34% regions, and 40.37% functions. These are code-coverage measurements, not feature-completeness percentages. In particular, passing the current Rust floor does not establish exhaustive failure-path coverage.

The initial parallel frontend run had one 5-second hearing-workflow timeout. That test passed independently, and all 321 tests then passed in a complete single-worker coverage run. The original failure is retained in the [initial log](evidence/2026-10-09/full-test/frontend-tests.log); it is classified as test timing instability under concurrent work, not a reproduced product defect.

## Confirmed bugs

### BUG-01 — P1: a standalone backup cannot recover a fresh installation

**Impact:** a lawyer who loses the original vault/security material can retain an intact backup and the original password yet be unable to restore their records. This is a release blocker. It re-confirms the existing B01 risk with fresh execution evidence.

Reproduction:

1. Create a disposable source installation using a known password; create a client and a backup.
2. Validate that backup in the source vault: succeeds.
3. Launch a separate empty installation: setup offers no restore control.
4. Initialize the destination with the **same original password**, copy only the source backup into its permitted test backup location, and attempt validation and restore.

**Expected:** an authenticated disaster-recovery workflow can open the standalone backup using its documented recovery material, without requiring the lost source installation.

**Actual:** both `backup_validate` and `backup_restore` return `BACKUP_CORRUPTED`. The destination client survives; the source client is not restored. No restore button exists on fresh-install setup. The archive is demonstrably valid in its original vault, so the error also gives misleading corruption advice for this case.

Evidence: [executed results](evidence/2026-10-09/full-test/portability/results.json), [fresh-install screen](evidence/2026-10-09/full-test/portability/fresh-install-setup.png), [reproduction runner](../../scripts/audit-backup-portability.mjs). `src-tauri/src/services/backup_service.rs` uses the current unlocked master key for validation/restore; this code observation explains the reproduced key mismatch but is not itself the test evidence.

Recommended acceptance: an authenticated portable key envelope and a fresh-install import flow; original-password restore into a new vault with managed attachments; failure leaves the destination unchanged; subsequent Windows↔macOS exercises. Same-vault restore passes do not close this bug.

### BUG-02 — P2: saving an empty opponent form gives no validation feedback

**Impact:** Save opponent appears unresponsive and the user receives no explanation. Assistive technology also has no error/invalid-field indication to announce.

Reproduction:

1. Open a case → Parties → Add opponent.
2. Leave Opponent name empty.
3. Click Save opponent.

**Expected:** a visible required-name message, an invalid-field indication associated with the input, and retained draft values.

**Actual:** the dialog stays open with zero error alerts and zero elements marked `aria-invalid="true"`. No opponent is created. A valid name subsequently works: native creation, editing, cancellation, and removal all passed.

Evidence: [native screenshot](evidence/2026-10-09/full-test/native-controls-rerun/opponent-empty-form-visible-feedback.png), [native DOM measurements](evidence/2026-10-09/full-test/native-controls-rerun/opponent-validation.json), [independent Chromium measurements](evidence/2026-10-09/full-test/bugs/opponent-empty-en.json). This was reproduced in both the browser renderer and real Linux desktop. `CasePartiesPanel.tsx` does not pass the name error into `Field`; the shared `Field` sets its accessibility error attributes from that prop.

Recommended acceptance: invalid submit visibly identifies the name field and exposes its error through `aria-describedby`/`aria-invalid`; valid submit creates exactly one opponent; failure retains the draft.

### BUG-03 — P3: English case page displays an Arabic fallback

Reproduction:

1. Select English and open a case with an opponent whose legal capacity and lawyer name are empty.
2. Open Parties and inspect the opponent row.

**Expected:** an English fallback such as “No capacity recorded.”

**Actual:** the row displays `دون صفة مسجلة` even though surrounding app labels are English. Arabic record names are legitimate user data; this particular string is hardcoded application copy in `CasePartiesPanel.tsx`.

Evidence: [English Parties screenshot](evidence/2026-10-09/full-test/browser/en-tab--cases-demo-case-14-1.png). This evidence uses a fictional fixture record; no native persistence claim is needed for this renderer text defect.

Recommended acceptance: a translation key with Arabic and English entries and a regression assertion for an opponent with both optional fields absent.

### BUG-04 — P2: native settings display blank persisted selection values

**Impact:** a desktop user cannot see the currently saved interface language, appearance, or date format when opening Display and calendar.

Reproduction:

1. Initialize a real Linux desktop vault in English.
2. Open Settings → Display and calendar without opening the dropdowns first.
3. Read persisted settings over real IPC and wait up to five seconds for their labels to appear.

**Expected:** the loaded language, appearance, and date-format labels are visible in the closed selects.

**Actual:** the first three displayed values remain empty; Saturday and 60 are shown in the other selects. The backend reports `language: "en"` and `dateFormat: "dd/MM/yyyy"`. Selecting Dark and saving does persist and render dark mode, but the untouched language/date-format labels remain blank. A separate fresh-vault rerun reproduced the blank labels after the wait. The Chromium fixture screen shows populated values, so this native regression would be missed by screenshot fixtures alone.

Evidence: [native screenshot after the wait](evidence/2026-10-09/full-test/native-select-check/settings-persisted-select-values-visible.png), [persisted/displayed measurements](evidence/2026-10-09/full-test/native-select-check/settings-select-values.json), [native dark-theme screenshot](evidence/2026-10-09/full-test/native-controls-rerun/settings-dark-theme.png), [populated Chromium comparison](evidence/2026-10-09/full-test/browser/en-tab--settings-1.png).

Recommended acceptance: reproduce with asynchronous settings loading in the real WebKit desktop, verify all three labels before interaction and after saving/reopening, and repeat in both locales. The exact root cause remains unconfirmed; investigate the form-reset/Select integration rather than treating a fixture pass as sufficient.

## Page coverage: ordered steps and health

All 17 surfaces below have fresh Arabic and English captures at all three renderer sizes. The screenshot links show the English desktop view; the HTML gallery includes the complete matrix. “Pass” applies to the executed route/render checks, not to every possible action on that page.

| Step | Surface / route                | Health and evidence                                                                                                                                                                |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | First-run setup / access gates | Render and native setup/unlock/recovery passed; fresh-install restore absent — BUG-01. [Screen](evidence/2026-10-09/full-test/browser/en-1440-onboarding.png)                      |
| 2    | Today `/`                      | Route, hearing/task presentation and derived summaries passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-dashboard.png)                                               |
| 3    | Clients `/clients`             | Route, table, native search/no-results/clear and archive filter passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-clients.png)                                        |
| 4    | New client `/clients/new`      | Native create and renderer required-field validation passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-new-client.png)                                                |
| 5    | Client detail `/clients/:id`   | Tabs, edit persistence and archive/restore passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-client-detail.png)                                                       |
| 6    | Powers of attorney list        | Route and navigation passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-powers-of-attorney.png)                                                                        |
| 7    | New power of attorney          | Create/edit and required internal sequence passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-new-poa.png)                                                             |
| 8    | Power of attorney detail       | Five tabs, linked-case deduplication and archive/restore passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-poa-detail.png)                                            |
| 9    | Cases `/cases`                 | Route/table and navigation passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-cases.png)                                                                               |
| 10   | New case `/cases/new`          | Native create, client selection and invalid/no-client rejection passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-new-case.png)                                       |
| 11   | Case detail `/cases/:id`       | Six tabs and principal workflows passed; opponent feedback and English copy failed — BUG-02/03. [Screen](evidence/2026-10-09/full-test/browser/en-1440-case-detail.png)            |
| 12   | Agenda `/calendar`             | Month/week/list, period controls, hearing create/decision/follow-up/delete passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-agenda.png)                              |
| 13   | Tasks `/tasks`                 | Five views, create/edit/complete/reopen/delete passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-tasks.png)                                                           |
| 14   | Documents `/attachments`       | Global/scoped list and owner-managed workflows passed; physical open/reveal remains unverified. [Screen](evidence/2026-10-09/full-test/browser/en-1440-attachments.png)            |
| 15   | Finance `/finances`            | Payment/expense workflows, payer restriction, fee validation and exact totals passed. [Screen](evidence/2026-10-09/full-test/browser/en-1440-finances.png)                         |
| 16   | Backups `/backups`             | Same-vault create/validate/restore/cancel/corrupt refusal passed; standalone portability failed — BUG-01. [Screen](evidence/2026-10-09/full-test/browser/en-1440-backups.png)      |
| 17   | Settings `/settings`           | Six sections, profile/general save and theme persistence passed; native closed-select labels failed — BUG-04. [Screen](evidence/2026-10-09/full-test/browser/en-1440-settings.png) |

## Buttons, forms, and business-rule action matrix

Native checks below include actual persistence assertions. Where test setup or verification used IPC directly, the action is identified separately; it is not counted as a click on a nonexistent UI control.

| Area                              | Executed normal path                                                                                                           | Executed rejection/cancel path                                                                                                             | Limit / remaining coverage                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access                            | Setup, recovery-key acknowledgement, lock/unlock, restart locking, password change/recovery                                    | Empty setup, wrong password, wrong current password, invalid recovery key, old-password refusal after change                               | Change/recovery normal and failure checks include direct IPC; not every security-form control has a native click assertion. Password visibility and idle-lock behavior have component tests. Native sleep/resume remains unverified. |
| Shared shell                      | All 10 sidebar links clicked natively; global-search exact result opens its file; palette opens/closes; mobile drawer Escape   | Keyboard focus return exercised by canonical test; locking removes legal-record caches in frontend tests                                   | External contact buttons only have contract/component coverage; no external contact was sent or opened for certification. Quick-add choices are covered by existing component workflows, not every native menu click.                |
| Client forms                      | Native create/edit with changed address; relationships/account/documents tabs                                                  | Duplicate internal number refused; invalid fields and rejected save retain drafts in frontend tests; native search/no-results/clear/filter | Probable-duplicate confirm/cancel and inline-client create have frontend coverage; not a complete new native flow for both.                                                                                                          |
| Client/POA/case archive           | Native confirmation cancellation and commit for clients/POAs, then restore; native case archive/restore                        | Cancel preserves records                                                                                                                   | Case Archive acts immediately; no confirmation exists for that reversible action. This is recorded behavior, not a failed requirement.                                                                                               |
| POA forms                         | Native create/edit, multiple-client links, linked-case uniqueness                                                              | Required sequence and rejected save tested                                                                                                 | Lawyer add/remove and all optional-field combinations are component/service coverage rather than a full native matrix.                                                                                                               |
| Case forms/relationships          | Native create/edit, relationship-note save and source lookup                                                                   | Empty client list refused; removing a paid client through the relationship editor displays an error and preserves both relationships       | Extensive schema/component coverage includes dates/identifiers/POA restrictions; not every combination was clicked natively.                                                                                                         |
| Opponents                         | Native create/edit; remove cancellation/confirmation                                                                           | Empty name fails silently — BUG-02                                                                                                         | English fallback defect — BUG-03.                                                                                                                                                                                                    |
| Hearings                          | Native create, calendar selection, exact deep-link editor, decision with persisted next-hearing chain, delete cancel/confirm   | Invalid forms and rejected saves covered by frontend/Rust tests; deletion failure covered by frontend workflow test                        | Long-label dialog fits its actual containing dialog; see harness triage below.                                                                                                                                                       |
| Agenda/Today                      | Native month/week/list and previous/next/today controls; renderer date-specific cards                                          | Derived dates/completion and unavailable hearing/task states tested in frontend/service suites                                             | Physical notifications and all timezone/OS combinations remain unverified.                                                                                                                                                           |
| Tasks                             | Native create/edit/complete/reopen; task-delete cancel/confirm                                                                 | Invalid fields, missing deep link, mutation failure and cache refresh tested                                                               | Some create/edit verification uses direct IPC; test names distinguish this from native clicks.                                                                                                                                       |
| Fee agreement                     | Native zero-value rejection and exact 3000.25 EGP save                                                                         | Zero/invalid values rejected                                                                                                               | Not an exhaustive numeric fuzzing campaign.                                                                                                                                                                                          |
| Payments                          | Native payer options limited to selected case; 100.01 EGP save; exact summary                                                  | Zero amount and unrelated payer rejected through real IPC                                                                                  | Inspect/edit/filter controls have frontend workflow coverage; not every such control was exercised against a real vault.                                                                                                             |
| Expenses                          | Native 12.50 EGP save without client/case links                                                                                | Negative amount rejected; failed saves retain draft in frontend tests                                                                      | Expense-owned attachment upload has no UI; full expense inspect/edit/filter native coverage is incomplete.                                                                                                                           |
| Managed attachments               | Native add, metadata edit through UI, remove cancel/confirm, source-byte preservation, backup restore byte equality            | Cancelled picker, two-owner payload, missing managed-file Open, copy/metadata/remove failures                                              | Actual file-picker UI is substituted. Successful physical viewer launch and Show in folder are not certified. Backend error/path behavior and frontend buttons are tested separately.                                                |
| Backup controls                   | Native create, validate, restore confirm, re-unlock; three repeated restores per locale plus standard smoke journey            | Restore-dialog cancel, picker cancel, corrupt refusal, unchanged destination, corrupt integration inventory cases                          | No portable recovery, scheduling/retention/history UI, configurable destination, or accessible emergency-snapshot recovery certified.                                                                                                |
| Settings                          | Native profile save, general save, dark theme selection/persistence/revert; all six sections in renderer                       | Required profile, rejected settings mutations, password validation and notification permission refusal covered by frontend tests           | BUG-04 in native loading. Notification/autostart/counter switches have component/service coverage, not physical OS sign-off.                                                                                                         |
| Localization/layout/accessibility | RTL/LTR assertions, keyboard tabs/dialog Escape/focus return, 102 route/locale/viewport measurements with no document overflow | Main form validation messages asserted in both locales                                                                                     | No screen-reader, comprehensive contrast, 200% zoom, high-contrast-mode, or accessibility-conformance certification.                                                                                                                 |

## Harness triage and reliability

Initial native capture attempts were blocked by old `.field-error`, `.dialog-surface`, checkbox-picker and date-picker selectors. Those selectors were corrected in the **new audit runner**, leaving application behavior unchanged. A duplicate-number check was updated from the old generic error to `CLIENT_NUMBER_TAKEN`. An exact client search result is now selected rather than assuming the first ranked result is always that client. WebDriver's clear operation was replaced with actual keyboard clearing for the list search. The task-delete setup now invokes the real `task_create` command.

A strict form-width assertion initially reported a hearing layout failure. Fresh geometry showed a 736px form with a 752px scroll width inside a 768px dialog whose own scroll width was also 768px. The form footer intentionally extends into dialog padding. The meaningful containing-dialog check passed in both locales; this is **not a product overflow bug**. Native calendar clicks also worked, but an obsolete assertion required ISO display while the saved date preference displays day/month/year. The corrected checks passed without changing product code. Earlier raw failures are retained, with later results superseding them in [final-results.json](evidence/2026-10-09/full-test/final-results.json).

The canonical comparisons prove agreement with the current checked-in candidates, not approval against an external design reference. Screenshots captured too early in entrance transitions were refreshed with animation handling. Gallery images are final renderer captures; native screenshots are included selectively where their state was inspected. Intermediate native tab captures are not presented as proof that their named panel had settled.

## Explicit gaps and release risks

1. **Windows and macOS:** no physical run, installer/update/uninstall, platform-native dialog, sleep/resume, autostart, or notification validation was executed. A Linux debug Debian build does not pass supported-platform acceptance.
2. **Some buttons remain component/service-only:** secondary payment/expense inspect/edit/filter combinations; every quick-add item; inline-client/probable-duplicate confirmation combinations; POA lawyer controls; successful physical attachment viewer/reveal; external contact launch controls. Their existence is inventoried, and relevant automated coverage ran, but they are not all real-desktop E2E passes.
3. **Backup disaster recovery:** BUG-01 is reproduced. Successful same-vault restores cannot establish standalone or cross-device recovery. The emergency snapshot recovery UI and retention policy remain unverified/incomplete.
4. **Known missing product workflows:** expense attachment upload, visible client JSON export, case/full-installation exports, stable CSV/manifest export, permanent record/application-data deletion, automatic backup/history/destination controls, restore preview, and tray behavior remain outside completed UI coverage because the planned interfaces are absent or unfinished. These are existing plan gaps, not newly invented buttons or fresh regressions.
5. **Scale and interruption:** no large-vault performance soak, disk-full native UI campaign, process-crash timing sweep, long-running operation/lock race campaign, or multi-day reminder run. Repository/service tests cover selected integrity/rollback failures, not every physical interruption.
6. **Accessibility and security scope:** keyboard/RTL/error checks are useful evidence but not a formal accessibility audit or penetration test. Recovery/security tests do not prove the absence of all transient secret copies or side channels.

## Reproduction and handoff

The new runners are [browser audit](../../scripts/full-app-browser-audit.mjs), [native workflow audit](../../scripts/full-app-native-audit.mjs), [additional native controls](../../scripts/full-app-native-controls.mjs), and [backup portability experiment](../../scripts/audit-backup-portability.mjs). Native runners must execute serially because they share the Tauri driver port, and they require a desktop display and the rebuilt isolated harness.

```bash
pnpm build:desktop:e2e
# Terminal 1: fictional renderer fixture server
VITE_CAPTURE_MODE=true pnpm vite --host 127.0.0.1 --port 4173
# Terminal 2: renderer checks
node scripts/full-app-browser-audit.mjs
# Native runs, one at a time; all use disposable marked test vaults
TZ=Africa/Cairo node scripts/full-app-native-audit.mjs --functional-preflight
TZ=Africa/Cairo node scripts/full-app-native-controls.mjs
TZ=Africa/Cairo node scripts/audit-backup-portability.mjs
```

The opponent-validation and native-settings assertions intentionally fail while BUG-02/04 remain unfixed. Portability reports `defect-confirmed` outcomes; its process succeeding means the experiment completed, not that portability passed. Keep this distinction when rerunning the evidence.

Prioritize portable backup recovery, then native settings labels and opponent feedback, then the translation correction. Retest normal and rejection paths after each fix and complete the supported-platform matrix before approving use with real legal data. No bugs were fixed as part of this testing/reporting task.
