# Beta readiness review: functionality and UX — 2026-10-08 (second pass)

**Verdict: not ready for non-technical lawyers yet.** Most everyday screens work and look good. But a normal
lawyer will hit four things in their first week that break the app or put their files at risk:

1. **Adding a document, checking a backup, or restoring a backup freezes the app permanently.** You have to force-quit it.
2. **Clicking a client's phone number turns the whole window into a blank page.** There's no way back except quitting.
3. **Backups can't be found or copied off the computer**, and (still open from the previous pass) they can't be
   restored on another computer anyway.
4. **Search misses everyday Arabic spellings.** For example, «احمد» doesn't find «أحمد», and the Cases page can't
   search by client name or court even though its search box says it can.

None of these needs a redesign. Section [Suggested fix order](#suggested-fix-order) lists them in priority order:
roughly one focused week for the blockers and high-priority items, then a Windows/macOS run.

Baseline: `2dda15a` (main after PR #6). No application code was changed in this pass.

## Resolution status

Every finding below was worked on the branch `ccr-b4541bb6-tptglx` after this review. The original findings
are kept unchanged as the record of what was found; this table says what changed. Commit `13822b7` fixed B-1 and
B-2, `6722dc2` fixed B-4, `44537fe` fixed H-1…H-11, H-13 and H-14, and the commit that adds this section fixed B-3,
H-12 and the medium and polish items.

| Finding                     | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-1 picker freeze           | Fixed. Picker commands are async and wait for the dialog on a worker; vault work goes back to the main thread. A Linux desktop journey opens the **real** dialog, checks the window still answers, and cancels it with xdotool. It fails against the old code.                                                                                                                                                                                                                                                                                     |
| B-2 phone link              | Fixed. The phone is text with a «نسخ» button, and a Rust navigation guard refuses any top-level navigation away from the app.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| B-3 backups (with B01, B02) | Fixed, except B02 (see residual risks). Backups are named `LegalMasr-backup-YYYY-MM-DD-HHmm.lmsbackup`, the success message names the file, and the Backups page offers «حفظ نسخة في مكان آخر…» and «إظهار في المجلد». Backups now carry the vault's key envelope, so a new installation restores them from the welcome screen with the password used at the time, or with the recovery key and a new password (B01). Restore shows the backup's date and document count and warns that later changes will not appear before anything is replaced. |
| B-4 search                  | Fixed. List searches, pickers and the top bar all use one Arabic normalization (hamza and alef forms, ى/ي, ة/ه, diacritics, tatweel, Arabic-Indic digits) and match phones by digits. Case search covers client names, opponents, court and circuit. File numbers sort naturally.                                                                                                                                                                                                                                                                  |
| H-1 … H-11, H-13, H-14      | Fixed as proposed, each with tests. Payments and expenses can be deleted after confirmation (refused while they have attachments); archived cases are read-only until restored.                                                                                                                                                                                                                                                                                                                                                                    |
| H-12 restore messaging      | Fixed. Closing a file dialog is silent everywhere, «تالف» is said only for a damaged file, and after a restore the password screen says «تمت استعادة النسخة الاحتياطية…».                                                                                                                                                                                                                                                                                                                                                                          |
| Recovery key                | Copy, print and «حفظ كملف…» on the setup screen and in Settings, where «إنشاء مفتاح استرداد جديد» replaces a lost key after the password is confirmed. The hint and error no longer mention dashes. The 64-character format is unchanged.                                                                                                                                                                                                                                                                                                          |
| Jargon and vault messages   | The welcome screen and every `VAULT_*` message say what to do; vault failures on the gate show the support e-mail and phone as text.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Lock-screen language        | Kept after unlocking and saved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Agenda                      | At 1100 px the day's details sit beside the month; on narrower windows a chosen day scrolls into view. Week and list views show each hearing's time, case and court; the list starts today. «طباعة رول الجلسات» prints the day's roll with the lawyer's name, so the "printed" wording in setup and profile is now true.                                                                                                                                                                                                                           |
| Dashboard                   | A hearing decided today stays under today's hearings with its decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Daily-work items            | Pages open at the top; new clients and cases get the next free internal number (editable); legal capacity and hearing type offer ready answers; the Documents page has «إضافة مستند», which asks for the case, client or POA first.                                                                                                                                                                                                                                                                                                                |
| Wording and consistency     | «ج.م» instead of «EGP»; every dialog puts its action first and «إلغاء» after it; stale success messages and errors are cleared when the next dialog opens; support contacts moved from the footer to Settings → عن ليجال مصر; the usage-counters switch is gone.                                                                                                                                                                                                                                                                                   |
| Polish                      | The fee button sits beside its field; the new-POA page has the same header and card as the other editors; case and finance tables fit 1100 px without an inner scrollbar; the top search clears on Escape and shows ⌘ K on macOS.                                                                                                                                                                                                                                                                                                                  |

### Residual risks

- **B02 is still open.** A restore replaces documents added after the backup. The preview warns about it, and the
  replaced data is kept in `EmergencySnapshots/`, but there is no screen to bring it back.
- **Portable backups can be attacked offline.** A version 2 file contains the password- and recovery-key-wrapped
  vault key, so whoever holds it can try passwords at Argon2id speed. Version 1 files could not be opened anywhere
  else at all. See [`07-backup-format.md`](../plan/07-backup-format.md).
- Restoring another installation's backup over an existing vault is refused; moving an office goes through the
  welcome screen of the new installation. Version 1 backups stay tied to the vault that made them.
- The printed roll and the recovery-key printout use the system print dialog (`WebviewWindow::print`). They were
  checked in the Linux build only; Windows and macOS printing is unverified.
- The illustrated user guide (`docs/user-guide`) still describes the old backup limits and screens. Regenerate it
  with the capture pipeline before giving it to testers.
- Nothing here has run on Windows or macOS yet (unchanged from the review).

## How this was reviewed

- **Code:** every page, form, shared form control and the Rust command/service behind each button.
- **The real app, not the test build.** I built the normal debug app (`pnpm tauri build --debug --no-bundle`, without the
  `desktop-e2e` feature) and drove it with WebDriver on Linux (WebKitGTK under Xvfb, 1100×720, which is the default
  window size). That build uses the **real native file pickers**, which the automated desktop journeys always replace
  with a stub ([`desktop_e2e.rs`](../../src-tauri/src/desktop_e2e.rs)).
- **Flows exercised in Arabic:** first-run setup, recovery key, the empty dashboard, clients (create, duplicates,
  duplicate number, search), cases (create, validation, search, sort, edit, archive), parties (client capacity,
  linked POA, opponent), hearings (add, time input, record decision with postponement), agenda (month/week/list),
  tasks (create, views, bad date), fees/payments/expenses, POA (create, lawyers, remove middle lawyer, client rule),
  backups (create), settings (profile, theme, password change), lock/unlock with old and new passwords, force-quit
  and restart persistence, English mode, a 760 px window, and dark theme.
- **Automated suites** were re-run first (results under [Evidence](#evidence)).

Not covered: Windows and macOS (no access here), notifications, autostart, idle auto-lock timing, and
open/reveal/edit/remove of an existing attachment (I couldn't add one through the real picker, because of B-1).

---

## Blockers (fix before any lawyer uses it)

### B-1. The native file picker freezes the app forever (Add document, Check backup, Restore backup)

- **What a lawyer sees:** Case → المستندات → «إضافة مستند» → «اختيار ملف». No file chooser opens and the window
  stops responding. It can't be closed normally. Data saved earlier is safe, and the vault re-opens after a
  force-quit.
- **Evidence:** [screenshot](evidence/2026-10-08/beta-review-2/01-add-document-frozen.png) and the
  [main-thread stack](evidence/2026-10-08/beta-review-2/frozen-file-picker-stack.txt) captured with gdb on the frozen
  process.
- **Cause:** the commands are synchronous, so Tauri runs them on the main (UI) thread. Inside,
  `blocking_pick_file()` waits for a dialog that tauri-plugin-dialog creates with `run_on_main_thread(...)`
  (`tauri-plugin-dialog-2.7.2/src/desktop.rs:148`), but the main thread is the one waiting. That's a deadlock. The
  plugin's own docs say the blocking variants "cannot be executed on the main thread as it will freeze your
  application". The plugin uses the same dispatch on Windows and macOS, so expect the same freeze there.
- **Affected:** [`document_service.rs:198`](../../src-tauri/src/services/document_service.rs) (add document),
  [`backup_service.rs:69`](../../src-tauri/src/services/backup_service.rs) (check backup and restore),
  [`client_service.rs:194`](../../src-tauri/src/services/client_service.rs) (client export, not reachable from the
  UI today).
- **This reverses a previous decision.** The prelaunch review rejected the "picker deadlock" claim after tracing the
  dispatch inline. The trace was right that dispatch is inline; that is exactly why it deadlocks.
- **Fix:** make `attachment_select_source`, `backup_validate`, `backup_restore` and `client_export` async
  (`#[tauri::command(async)]`, or `async fn` that awaits the non-blocking `pick_file` callback through a oneshot
  channel). Then add one native journey that opens the **real** dialog and cancels it (on Linux, `xdotool` can
  send the Escape key), so CI can't miss this again. While doing it, the other heavy synchronous commands (backup
  create, attachment copy) would also benefit from running off the UI thread (B12 in the register).

### B-2. Clicking a client's phone number replaces the app with a blank page

- **What a lawyer sees:** Client file → click the phone number under the name. The window turns white and reads
  "The URL can't be shown". There's no back button and Alt+← does nothing. Quitting and reopening is the only way
  out, and the vault is locked again.
  [Screenshot](evidence/2026-10-08/beta-review-2/02-phone-link-blank-window.png).
- **Cause:** a plain `<a href="tel:…">` in
  [`ClientDetailPage.tsx:72`](../../src/features/clients/pages/ClientDetailPage.tsx) navigates the WebView itself.
  (The footer's developer links are fine because they go through `bridge.openDeveloperContact`.)
- **Fix:** show the number as text with a "copy" button, or open it through the opener command like the footer
  does. As a safety net, refuse every top-level navigation away from the app origin in Rust (`on_navigation`), so no
  future link can blank the window.

### B-3. Backups can't be found, moved off the computer, or restored elsewhere

- **What a lawyer sees:** «إنشاء نسخة احتياطية الآن» succeeds with "تم إنشاء النسخة الاحتياطية بنجاح" and the size.
  The yellow box below then says to copy the backup to a flash drive. But the app never says where the file is, and
  there's no "show in folder" or "save a copy to…" button.
  [Screenshot](evidence/2026-10-08/beta-review-2/03-backup-created-no-location.png).
  The file sits in the hidden app-data folder (`…/com.legalmaster.solo/LegalMasterSolo/Backups/` —
  `%APPDATA%` on Windows) under a name like `legalmaster-backup-1791456731583510030.lmsbackup`
  ([`backup_service.rs:17`](../../src-tauri/src/services/backup_service.rs), [`backup/mod.rs:116`](../../src-tauri/src/backup/mod.rs)).
  Settings → الخصوصية only says «داخل مجلد بيانات التطبيق».
- **Combined with previously open items:** backups are sealed with this installation's key, so they can't be
  restored on a new computer (B01); a restore deletes attachments added after the backup (B02); and restore can't be
  started at all today (B-1).
- **Fix:** offer «حفظ نسخة في…» (an async save dialog) with a dated name such as
  `LegalMasr-backup-2026-10-08-1052.lmsbackup`, plus «إظهار في المجلد». Show the destination in the success message,
  and finish B01/B02 before testers keep real files. If B01 can't make the beta, the welcome screen and Backups page
  must say plainly that a backup can only be restored on the same computer.

### B-4. Search misses everyday Arabic spellings; the Cases page can't search by client or court

| Where                                                | Typed                                               | Result                                                                                           |
| ---------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Clients page                                         | «أحمد»                                              | finds «أحمد محمود علي»                                                                           |
| Clients page                                         | «احمد», «ابراهيم», «مصطفي»                          | **nothing** ([screenshot](evidence/2026-10-08/beta-review-2/06-client-search-without-hamza.png)) |
| Clients page                                         | phone stored as `0122 333 4444`, searched `0122333` | nothing                                                                                          |
| Clients page                                         | phone typed with Arabic digits «٠١٠٠…»              | nothing                                                                                          |
| Client picker in the case form (and every picker)    | «احمد»                                              | nothing                                                                                          |
| Cases page («ابحث برقم القضية أو المحكمة أو الموكل») | «محمد», «أحمد», «شمال القاهرة», «استئناف»           | **nothing** ([screenshot](evidence/2026-10-08/beta-review-2/07-case-search-by-client.png))       |
| Top-bar search                                       | «احمد», «مصطفي»                                     | works (normalized index)                                                                         |
| Top-bar search                                       | a client's phone `01001234567`                      | nothing (the index written on create/update omits the phone; only a rebuild adds it)             |

- **Cause:** the list queries use a raw `LIKE` on the stored text:
  [`client_repository.rs:91`](../../src-tauri/src/repositories/client_repository.rs) and
  [`case_repository.rs:186`](../../src-tauri/src/repositories/case_repository.rs). The case query only looks at
  numbers and years. The pickers filter with `toLocaleLowerCase().includes()`
  ([`EntityPicker.tsx:70,134`](../../src/components/forms/EntityPicker.tsx)).
  [`client_service.rs:28`](../../src-tauri/src/services/client_service.rs) indexes `internal_number full_name`
  without the phone.
- **Fix:** route the list searches through the normalized `search_index`, or compare against
  `normalize_text`/`normalize_phone` values. Add client names and court to the case search, apply the same
  normalization in the JS picker filter, and index the phone on create and update.

---

## High: buttons and fields that fail or mislead

| ID   | What happens (verified in the running app unless marked "code")                                                                                                                                                                                                                                                     | Where                                                                                                                                                                            | Fix                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| H-1  | Top bar «إضافة ← إضافة جلسة» **does nothing** while you're on the Agenda page; «إضافة مهمة» does nothing on the Tasks page. The URL changes, but the dialog state was read from `?create=` only once, when the page first loaded.                                                                                   | [`AgendaPage.tsx:53`](../../src/features/hearings/pages/AgendaPage.tsx), [`TasksPage.tsx:51`](../../src/features/tasks/pages/TasksPage.tsx)                                      | React to `searchParams` in an effect, open the dialog, then remove `create` from the URL.                                       |
| H-2  | **Global search opens the wrong record** when two results have the same title. With two clients named «أحمد محمود علي» (the app allows this after the duplicate warning), clicking the second one opened the first.                                                                                                 | [`GlobalSearch.tsx:46,53`](../../src/features/search/components/GlobalSearch.tsx) matches by `title`                                                                             | Use `${entityType}:${entityId}` as the item value.                                                                              |
| H-3  | **Any form dialog closes on one click outside it, or on Escape, and throws away what was typed** (hearing, decision, task, payment, case/client edit, documents). There's no warning.                                                                                                                               | [`FormDialog.tsx`](../../src/components/forms/FormDialog.tsx)                                                                                                                    | Turn off outside-press dismissal for form dialogs and ask «تجاهل التغييرات؟» when the form is dirty.                            |
| H-4  | Pressing **Escape twice in the case's client picker removes every selected client**. The first press closes the list; the second clears the value silently.                                                                                                                                                         | [`EntityPicker.tsx`](../../src/components/forms/EntityPicker.tsx) (`EntityMultiPicker`)                                                                                          | Swallow Escape when the popup is closed (or ignore value changes caused by escape).                                             |
| H-5  | **A date typed with a two-digit year («3/10/26») in a case's تاريخ القيد/الانتهاء** submits, and the backend rejects it. The form shows only «تحقق من البيانات المدخلة ثم حاول مرة أخرى» at the bottom, with no field highlighted. ([screenshot](evidence/2026-10-08/beta-review-2/08-case-date-generic-error.png)) | [`case.schema.ts:23-32`](../../src/features/cases/schemas/case.schema.ts) (no date check), [`DatePicker.tsx:41`](../../src/components/forms/DatePicker.tsx) (4-digit years only) | Use `optionalDate` for both fields, and accept `dd/mm/yy` as 20yy in `normalizeTypedDate`.                                      |
| H-6  | **Hearing time «9:30» is rejected** with «تحقق من القيمة المدخلة»; only «09:30» in 24-hour form works, yet the app shows the time back as «9:30 ص». An afternoon session has to be typed «14:00». ([screenshot](evidence/2026-10-08/beta-review-2/09-hearing-time-9-30.png))                                        | [`TimeField.tsx`](../../src/components/forms/TimeField.tsx), [`formSchemas.ts:12`](../../src/lib/formSchemas.ts)                                                                 | Accept `9:30`, `9.30`, `٩:٣٠`, `2:00 م`, and normalize to `HH:mm`. Show ص/م choices in the list.                                |
| H-7  | **Year fields silently drop Arabic-Indic digits:** typing «٢٠٢٦» into سنة الدعوى leaves it empty, with no message. ([screenshot](evidence/2026-10-08/beta-review-2/10-year-arabic-digits.png))                                                                                                                      | [`CaseCoreFields.tsx:136,150`](../../src/features/cases/forms/CaseCoreFields.tsx) (`type="number"`)                                                                              | `type="text" inputMode="numeric"` plus digit normalization, as the money parser already does.                                   |
| H-8  | **The first thing a new lawyer is invited to do hits a dead end.** On an empty install, «إضافة جلسة» opens a form with an empty case list and no hint; saving shows «تحقق من القيمة المدخلة». The same applies to payments. ([screenshot](evidence/2026-10-08/beta-review-2/05-empty-vault-add-hearing.png))        | [`DashboardPage.tsx:74-89`](../../src/features/dashboard/pages/DashboardPage.tsx), `HearingForm` in AgendaPage                                                                   | With no cases, show «أضف قضية أولًا» with a button. Give the empty dashboard a 3-step start: موكل ← قضية ← جلسة.                |
| H-9  | **A power of attorney with no client can't be saved**, and the form doesn't say why: removing the client (or never picking one) gives the generic «تحقق من البيانات المدخلة».                                                                                                                                       | [`PowerOfAttorneyForm.tsx:25`](../../src/features/powersOfAttorney/components/PowerOfAttorneyForm.tsx) vs `power_of_attorney_service.rs:54`                                      | `clientIds.min(1)` with «اختر موكلًا واحدًا على الأقل».                                                                         |
| H-10 | **A payment or expense entered by mistake can't be deleted**, only edited, and the amount must stay above zero. There's no delete command at all.                                                                                                                                                                   | [`finance_service.rs`](../../src-tauri/src/services/finance_service.rs) (code)                                                                                                   | Add delete with confirmation (already an agreed default: "confirmed finance deletion").                                         |
| H-11 | **Archiving a case is a single click with no confirmation.** Clients and POAs ask first.                                                                                                                                                                                                                            | [`CaseDetailPage.tsx:189`](../../src/features/cases/pages/CaseDetailPage.tsx)                                                                                                    | Use the same `ConfirmDialog` as clients.                                                                                        |
| H-12 | Restore messaging (code; unreachable today because of B-1): on success the app locks immediately, so «تمت الاستعادة…» is never seen and the lawyer lands on the password screen without explanation. Cancelling «اختيار ملف للفحص» shows «الملف تالف، أو ليس نسخة احتياطية».                                        | [`BackupsPage.tsx:127,148`](../../src/features/backups/pages/BackupsPage.tsx), `backupsApi.ts`                                                                                   | Carry a one-time notice to the unlock screen; treat `OPERATION_CANCELLED` as silent; only say "damaged" for `BACKUP_CORRUPTED`. |
| H-13 | **Error text rarely says what's wrong.** Every invalid date, time, picker or amount shows «تحقق من القيمة المدخلة.»; any backend `VALIDATION_FAILED` becomes «تحقق من البيانات المدخلة ثم حاول مرة أخرى» with no field highlighted.                                                                                 | all forms                                                                                                                                                                        | Field-specific messages, e.g. «اكتب التاريخ مثل 15/11/2026», «اختر القضية».                                                     |
| H-14 | Pickers that list **cases** say «لا يوجد موكلون مطابقون» when nothing matches.                                                                                                                                                                                                                                      | [`EntityPicker.tsx:78,151`](../../src/components/forms/EntityPicker.tsx) (code)                                                                                                  | Pass the empty text as a prop.                                                                                                  |

## Medium: friction for lawyers who don't use technology much

**First run and security**

- **Recovery key:** 64 hexadecimal characters, with no «نسخ», «طباعة» or «حفظ كملف»
  ([screenshot](evidence/2026-10-08/beta-review-2/04-recovery-key.png)). Hand-copying 64 characters is where
  non-technical users fail. The hint and error also say «اكتبه كما هو بحروفه وشرطاته», but the key is shown with
  spaces, not dashes (`gate.recoveryKeyHint`, `errors.RECOVERY_KEY_INVALID`). Add print/save/copy, consider a shorter
  checksummed format, and add «إنشاء مفتاح جديد» in Settings (B05 remainder).
- **Jargon on the very first screen:** «الملفات المُدارة غير مشفّرة» (`gate.points.encrypted`). The `VAULT_*`
  messages say «مساحة العمل… احتفظ بالملفات المتبقية» without telling the lawyer what to actually do or whom to call.
- **Language chosen on the lock screen** reverts to the saved setting after unlocking, because the switcher can't
  save while locked.

**Daily work**

- **Hearings don't inherit the case's court and circuit** when added from the case page, so the lawyer retypes
  what the case already has.
- **At the default window size (1100×720)** the Agenda's day details sit _below_ the month grid; clicking a day
  seems to do nothing until you scroll
  ([screenshot](evidence/2026-10-08/beta-review-2/11-agenda-default-window.png)). The week view shows only counts
  («الجلسات: 1 · المهام المفتوحة: 0 · المكتملة: 0»), not case, court or time. The list view starts at the oldest date
  ever, not today.
- **Today's hearing disappears from «جلسات اليوم» once its decision is recorded**, so the dashboard says «لا توجد
  جلسات اليوم» on a day the lawyer attended court.
- **The page doesn't scroll back to the top on navigation**, so after saving a new case its title is off-screen
  ([screenshot](evidence/2026-10-08/beta-review-2/13-scroll-not-reset.png)).
- **Overdue tasks look the same as upcoming ones on the Tasks page:** «متأخرة», «اليوم» and «قادمة» are identical
  beige badges ([screenshot](evidence/2026-10-08/beta-review-2/12-task-status-badges.png)). The dashboard already
  uses red for overdue; use it here too.
- **Case lists sort as text:** «2026/100» before «2026/15» before «2026/9». The case list also lacks court and
  next-hearing columns, which are the two things lawyers scan for.
- **Case pickers** in task and payment forms show only the internal number, while the agenda's picker shows
  «2026/15 — أحمد محمود علي». The payer isn't pre-selected when a case has one client. The legal-capacity field has
  no ready answers (مدعي / مدعى عليه / متهم / مستأنف …).
- **Every client needs an invented «الرقم الداخلي»** before saving. Suggest the next free number.
- **There is no printing anywhere**, yet the setup and profile screens say the lawyer's name «يظهر في التقارير
  المطبوعة». Either remove that copy or add the one print-out Egyptian lawyers expect: tomorrow's hearing roll (رول
  الجلسات).
- **Archived cases stay fully editable** (hearings, payments, tasks can still be added). The agreed default was
  "read-only until restored".

**Wording and consistency**

- Latin placeholders and units in the Arabic interface: `DD/MM/YYYY`, `HH:mm`, `EGP`. An Arabic example placeholder
  already exists and is unused (`datePicker.placeholder`).
- **Save/Cancel order differs between dialogs.** The case-clients dialog puts «حفظ التعديلات» on the left; the
  form-dialog footer puts «إلغاء» first; page forms put «حفظ» first. Lawyers learn button positions; pick one.
- Success messages linger after unrelated actions (for example «تم حفظ اتفاق الأتعاب» stays after adding a
  payment), and the edit dialogs reopen with the previous error still shown.
- Expense rows on the case's Account tab show «—» instead of the expense type when there are no notes.
- The Documents page has no add button. It explains in text that documents are added from a client, case or POA,
  but most people will look for a button first.
- The developer's personal e-mail, phone and links appear in the footer of every screen. A «الدعم الفني» entry in
  Settings → عن ليجال مصر is more conventional for a product given to clients. (The previous pass raised this too.)
- The «إحصاءات استخدام مجمّعة» switch is still shown, although removing it was agreed. It invites a question the
  lawyer can't answer.

## Polish

- The fee form's «حفظ الأتعاب» is a full-width bar under a single field.
- In Settings at 1100 px the content column is narrow beside a small tab box, leaving a large empty area.
- The new-POA page lacks the card, kicker and description the new-client and new-case pages have.
- The finance table shows an inner horizontal scrollbar at the default width.
- The top-bar search keeps its text after Escape, and shows «Ctrl K» on macOS too.

## What works well (keep it)

- Arabic RTL is genuinely good: correct mirroring, Egyptian month names, «رقم 447 لسنة 2026» references, Arabic
  plurals. English mode also lays out correctly.
- The visual style is calm and consistent, and dark theme is polished
  ([screenshot](evidence/2026-10-08/beta-review-2/15-dark-case.png)).
- Duplicate-client warning with links to the matching records
  ([screenshot](evidence/2026-10-08/beta-review-2/16-duplicate-warning.png)); clear messages for a duplicate client,
  case or POA number.
- «تسجيل القرار» with a postponement date creates the next hearing and carries over court, circuit, time and
  preparation notes: exactly the lawyer's workflow.
- Money input accepts «١٥٬٠٠٠» and «15,000 جنيه», rejects ambiguous «15.000», and keeps integer piasters.
- Wrong password, password change (wrong current, too short, mismatch, success), lock and unlock with the new
  password, and data surviving a force-quit all behave correctly. Unlock takes under a second.
- Removing a lawyer from the middle of a POA's list keeps the right names. Linking a POA to a case client works.

## Still open from earlier reports

These are unchanged by this pass and still decide whether testers may hold real files: B01 (portable backups), B02
(restore deletes newer attachments), no run on Windows or macOS, B09 correction of a recorded decision, B05 remainder.
B-1 and B-3 above make B01/B02 more urgent, because today a lawyer can neither restore nor move a backup.

## Suggested fix order

| Order | Items                                                                   | Size   | Why first                                                               |
| ----- | ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| 1     | B-1 async pickers + a real-dialog native journey                        | S–M    | Three core buttons freeze the app on every platform                     |
| 2     | B-2 phone link + navigation guard                                       | S      | One click destroys the session                                          |
| 3     | H-1, H-2, H-3, H-4                                                      | S each | Buttons that silently do nothing, open the wrong record, or lose typing |
| 4     | B-4 search normalization (lists, pickers, case search)                  | M      | Lawyers search constantly; misses look like lost data                   |
| 5     | H-5…H-9, H-13, H-14 (input formats and messages)                        | M      | Removes most "تحقق من القيمة المدخلة" dead ends                         |
| 6     | B-3 save-to/show-in-folder + B01/B02                                    | M–L    | Needed before real client files                                         |
| 7     | H-10, H-11, H-12                                                        | S–M    | Correcting mistakes safely                                              |
| 8     | First-run guidance, recovery-key print/save, agenda layout, medium list | M      | First impression for non-technical users                                |
| 9     | Windows + macOS run of every step above                                 | M      | The targets have never been exercised                                   |

Every fix above should land with a normal-path and a failure-path test (AGENTS rule 7). For B-1 that test must use
the real dialog, not the `desktop-e2e` stub.

## Evidence

| Check                                                                                                  | Result                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`                                                     | pass                                                                                                     |
| `pnpm test`                                                                                            | 321 Vitest tests in 41 files and 60 script tests pass                                                    |
| `cargo test --all-features`                                                                            | 100 tests pass                                                                                           |
| `pnpm build:desktop:e2e` then `xvfb-run pnpm test:desktop`                                             | 5/5 native journeys pass (with the stubbed picker)                                                       |
| Real debug build driven by WebDriver (tauri-driver 2.1.0, WebKitWebDriver, Xvfb, 1100×720 and 760×600) | findings above; screenshots in [`evidence/2026-10-08/beta-review-2`](evidence/2026-10-08/beta-review-2/) |

The exploratory scripts were scratch tooling and are not committed. All data used was fictional; the vault was a
fresh, disposable one inside the review container.
