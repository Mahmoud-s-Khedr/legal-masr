# Fix pass for the 2026-10-09 independent review

Date: 9 October 2026. Base revision `2dda15a`, working tree uncommitted (nothing committed or pushed). Linux only (Fedora, WebKitGTK through `tauri-driver`). Fictional data and throw-away passwords throughout; no real vault was touched. Evidence: [`evidence/2026-10-09/fix-pass/`](evidence/2026-10-09/fix-pass/) (new folder; no existing evidence file, visual baseline or old report was modified).

Source of findings: [independent review](2026-10-09-independent-review.md). Where it disagreed with the full-app testing report, the review was followed.

## Summary

| Item | Finding                                                           | Result                                                                                                                       |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1    | BUG-02 opponent form shows no validation feedback (P3)            | Fixed, tested (component, native)                                                                                            |
| 2    | BUG-04 Settings Display tab blank labels on direct entry (P3)     | Fixed, tested (component, native)                                                                                            |
| 3    | BUG-03 / F10 hardcoded Arabic and Arabic comma in English UI (P3) | Fixed, tested                                                                                                                |
| 4    | A3 entity-picker buttons without an accessible name (P3)          | Fixed, tested                                                                                                                |
| 5    | A2 corrupt backup gets the wrong error code (P3)                  | Fixed with item 6, tested                                                                                                    |
| 6    | BUG-01 + A1 portable backup recovery (P1)                         | Implemented after design approval; tested on Linux. **Release blocker not closed** (Windows↔macOS and physical devices open) |

## 1. BUG-02: opponent form feedback

- **Change.** `CasePartiesPanel.tsx` passes a localized message to `Field` for all six fields: "required" for the name, "invalid" for the others, as `TasksPage` does. `Field` then sets `aria-invalid="true"` and `aria-describedby` itself.
- **Files.** `src/features/cases/components/CasePartiesPanel.tsx`.
- **Tests added.** `CasePartiesPanel.test.tsx` (9): English and Arabic, empty and whitespace-only name, message text, `aria-invalid`, `aria-describedby` pointing at the alert, focus on the field, draft retained, no bridge call; valid save. The four validation tests fail on the old component. Native: scenario `opponent-form-announces-missing-name` (Arabic). Review script `bug02-opponent-validation-native.mjs ar` also shows the message and zero opponents persisted for empty and whitespace names.
- **Not verified.** English native run of the new scenario (the harness UI is Arabic; the review script was run in Arabic only). In the native Arabic script, typing a value and then clearing it after a failed submit showed no error again; the same sequence re-shows the error in jsdom. I did not investigate, so it may be how the script fills the input.

## 2. BUG-04: Settings Display tab labels

- **Change.** `SettingsPage` is split: an outer component handles loading and load failure, and `SettingsWorkspace` mounts only once settings exist, with `useForm` `defaultValues` from them. Base UI therefore sees defined values on its first render. The profile request is still started by the outer component so the profile form behaves as before.
- **Files.** `src/features/settings/pages/SettingsPage.tsx`.
- **Tests added.** In `SettingsPage.workflows.test.tsx` (7): labels (language, theme, date format, week start) for a direct mount and after a tab click, in English and Arabic, using non-default stored values; no controlled/uncontrolled console error; an untouched save sends exactly the stored values; load failure shows the error and no form. The two direct-mount tests fail on the old page. Native: scenario `settings-display-tab-deep-link-shows-saved-labels`; review script `bug04-settings-entry-paths-native.mjs` shows all five entry paths populated (English).
- **Not verified.** Arabic run of the reviewer's native entry-path script; a hand-operated back button (the script uses `history.back()`); the console warning natively (asserted in the component test only).

## 3. BUG-03 / F10

- **Change.** `'دون صفة مسجلة'` is now `cases.parties.noDetails` in both catalogues. All twelve `.join('، ')` sites (dashboard, agenda, tasks, finances, cases, POAs) use `format.list()`, which joins with `, ` or `، ` by interface language. A fixed separator was chosen over `Intl.ListFormat` so output does not depend on ICU data in each web view (`Intl.ListFormat` in Arabic yields "A وB").
- **Files.** `CasePartiesPanel.tsx`, `DashboardPage.tsx`, `AgendaPage.tsx`, `TasksPage.tsx`, `FinancesPage.tsx`, `CaseListPage.tsx`, `CaseDetailPage.tsx`, `PowersOfAttorneyPage.tsx`, `PowerOfAttorneyDetailPage.tsx`, `src/lib/format.ts`, `src/i18n/LocalePresentation.tsx`, both catalogues.
- **Tests added.** English and Arabic fallback for an opponent with no capacity and no lawyer, and the joined form with both; `formatNameList` unit tests; a case with two clients in English (`A, B`) and Arabic (`A، B`).

## 4. A3: picker button names

- **Change.** The open, clear and chip-remove buttons in `combobox.tsx` get localized names (`forms.showOptions`, `forms.clearSelection`, `forms.removeItem`; the entity picker passes `Remove <name>`). Keyboard behaviour is unchanged.
- **Tests added.** `pickerAccessibility.test.tsx` (13): no focusable control without an accessible name on the Task (with preselected case and client), Case (with a client chip), POA, Payment and Expense forms in both languages, plus a self-check that the audit helper reports an unnamed button. Twelve of the 13 fail on the old combobox.
- **Not verified.** WebKit and screen readers; the reviewer's Chromium ARIA probes were not re-run (the dev server could not start; see below).

## 5 and 6. Backup error contract and portable recovery

The design was written to `docs/plan/07-backup-format.md`, shown to you, and approved on all three questions before any backup code changed (backup strength equals password strength; a backup opens with the password current when it was made or the recovery key; Settings also restores backups made by another installation). The note was then updated to match what was built; two refinements are worth knowing: a damaged password envelope cannot be told from a wrong password, and with no credential a wrong key cannot be told from damage.

- **Format v2.** The envelope header carries a copy of the vault's `security.json` content (password and recovery envelopes). The body is still encrypted under the backup key derived from the master key, and the header is bound to it as authenticated data. Argon2 parameters from the header are bounded before use. New backups are always v2. v1 archives restore in the installation that made them; on any other installation they return `BACKUP_KEY_MISMATCH` and the UI explains they must be opened on the original device.
- **Error contract.** Garbage, truncated, tampered and inventory failures: `BACKUP_CORRUPTED`. Wrong password or recovery key: the existing `INVALID_PASSWORD` / `RECOVERY_KEY_INVALID`. New codes: `BACKUP_KEY_MISMATCH` and `BACKUP_NEWER_VERSION` (envelope, manifest or database newer than this build), with Arabic and English text. An unreadable file stays `OPERATION_FAILED`.
- **Entry points.** "Restore from a backup" on fresh setup and on the `INCOMPLETE` gate; in Settings → Backups after `BACKUP_KEY_MISMATCH`. Not on the locked unlock gate or `INTERRUPTED`. The file path stays in Rust behind a one-time token (`backup_select_for_restore`, `backup_restore_selected`); a mistyped secret keeps the selection.
- **Journal and snapshots.** All checks happen in staging, so every failure leaves the destination unchanged (tests compare the whole tree). The journal gains `had_database`, `had_security`, `adopt_security` (defaults keep old intents readable; unknown fields fail closed). A backup from another installation (or with no usable vault) installs its own `security.json`; the old one is moved into the emergency snapshot. A backup from the same installation keeps the current password.
- **Migration.** None.
- **Files (Rust).** `backup/mod.rs`, `vault_operation.rs`, `errors/mod.rs`, `state.rs`, `security/mod.rs`, `dto/mod.rs`, `services/{app,backup}_service.rs`, `commands/backup.rs`, `lib.rs`, `desktop_e2e.rs`, `tests/onboarding_flow.rs`, `tests/spike_e2e.rs`. **(Frontend)** `bridge/{commands,types,errors}.ts`, `features/backups/{api,components,pages}`, `features/onboarding/pages/OnboardingPage.tsx`, `app/App.tsx`, both catalogues, `scripts/desktop-e2e.mjs`. **Docs** `plan.md`, `plan/{05,07,09,10}`.
- **Rust tests added (25: 18 in `backup`, 3 in `vault_operation`, 4 service-level).** Restore into an empty installation with the original password (records, byte-identical attachment, locks, unlocks with the original password) and with the recovery key in several copied forms; wrong password; wrong recovery key; every altered header field and ciphertext; truncated, empty, plain-text, random, JSON-without-version, bad-base64 and non-backup files; envelope, manifest and database newer than the build; oversized key-derivation parameters (refused in under two seconds); v1 on the same and on another installation; a rewritten v1/v2 header; same-installation restore keeps the password; foreign restore into an unlocked vault adopts the password and keeps the old generation; `INCOMPLETE` destination; pending journal; stale staging; header contents. Journal: every interruption step for every combination of what existed and whether security is adopted (80 cases), an old-format intent, an unknown-field intent. Service level (mock app): fresh installation with wrong then correct password and unlock; recovery key; `INCOMPLETE` recovery and refusal on a healthy locked vault; pending operation.
- **Frontend tests added.** `RestoreFromBackup.test.tsx` (24), App gate tests for setup / `INCOMPLETE` / `INTERRUPTED`, the restore flow ending at the unlock screen, Settings tests for the other-installation path.
- **Native tests.** `fresh-installation-restores-a-portable-backup-with-the-original-password` and `incomplete-installation-restores-a-portable-backup` (wrong password, then the original, then unlock, records, attachment bytes). The existing cancelled and corrupt restore checks now assert the exact refusal message instead of any alert.

## Validation actually run

See `evidence/2026-10-09/fix-pass/validation-summary.txt`.

| Command                                                       | Result                                               |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`            | clean                                                |
| `pnpm vitest run`                                             | 44 files, 386 tests passed (321 before)              |
| `node --test scripts/*.test.mjs`                              | 60 passed                                            |
| `cargo fmt --check`, `cargo clippy --all-targets -D warnings` | clean (also with `--all-features`)                   |
| `cargo test --locked`                                         | 124 passed (99 before); `--all-features` also passed |
| `pnpm build:desktop:e2e`, `pnpm test:desktop`                 | 9 of 9 scenarios passed (five existing, four new)    |
| `pnpm capture:visual:canonical`                               | 65 passed, **4 failed** (see below)                  |

## Visual baselines: decision needed

The only affected comparisons are the setup screen, where a "Restore from a backup" link now sits under the form: `onboarding-ar-1366x768`, `onboarding-ar-1440x900`, `onboarding-en-1366x768`, `onboarding-en-1440x900`. The layout still fits at 1366×768. **I did not regenerate any baseline.** Run `pnpm update:visual:canonical` and review the four images if you accept the change.

## Could not verify

- Windows and macOS in every respect, including the Windows↔macOS backup exercise, physical native dialogs, installers, directory durability on Windows, power loss, and screen readers.
- Portability across operating systems: the Linux restore into an empty installation is **not** a portability pass.
- English native run of the opponent scenario, Arabic native run of the Settings entry-path script, and the Chromium probes: the vite dev server could not start because `node_modules/.vite` contains root-owned files (left by the container-based visual comparison), so the reviewer's Chromium scripts were not re-run.
- Coverage floors (`pnpm check:coverage`) were not run; the new Rust and renderer code may move the numbers.

## Unresolved risks and choices

- **Backup strength now equals password strength** (approved). There is no limit on restore attempts, as there is none on unlock.
- A backup opens with the password valid when it was made; changing the password later does not re-seal older backups (approved, stated in the UI).
- v1 backups made on another machine cannot be restored anywhere else. Nothing can fix that retroactively.
- A power loss between staging and the journal write leaves staging files that make a fresh installation report `INCOMPLETE`; restore remains available from there. Not tested against real power loss.
- There is still no restore preview, attempt limit, snapshot browser, automatic backup or retention (existing roadmap blockers).
- The `onboarding_flow` Rust integration tests delete the app-data path that `tauri::test::mock_app` resolves (`~/.local/share/com.legalmaster.solo/LegalMasterSolo` on Linux, an existing developer vault location). I ran every integration run with `XDG_DATA_HOME` pointing at a throwaway directory and left the real one untouched, but a plain `cargo test` would delete it. I did not change that behaviour.
- The opponent form revalidation observation under item 1 is unexplained.
- Not changed, as out of scope: the audit-runner hazards H1–H6, A4 (locked gate language) and the other findings in the review.

## Things I chose not to do

- No visual baseline regeneration, commits or pushes.
- No change to existing migrations (none needed) or to any existing evidence file or old report.
- The restore-from-backup entry was deliberately not added to the locked unlock screen.
