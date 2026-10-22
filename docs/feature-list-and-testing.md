# Legal Masr — Feature list and testing guide

Review date: 2026-10-21 (deletion and export update). Version: pre-beta 0.1.0.

Legal Masr is an offline desktop app for individual Egyptian lawyers. It manages clients, cases, powers of attorney, hearings, tasks, documents, and finances inside a password-protected local workspace.

This inventory reflects the code reviewed alongside the project plan.

## Test preparation

Use a disposable workspace with fictional data. Launch the desktop application with `pnpm tauri dev`; browser-only mode cannot fully test storage, native dialogs, or OS actions. Create two fictional clients, one case linking both, a power of attorney, and a small sample document.

Perform restore, deletion, password, and interruption scenarios only against disposable test data. Backend-only scenarios require the existing development/test harness or automated tests.

## Access, security, and recovery

| Feature                            | What it does                                                           | How to test it                                                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-run setup                    | Creates the encrypted workspace using your lawyer name and password.   | Enter a name and matching passwords of at least 12 characters. Confirm setup succeeds. Try missing fields, a short password, and mismatched confirmation; setup should refuse them.                              |
| Recovery-key issuance              | Displays a recovery key after setup.                                   | Complete setup, save the displayed key, and confirm you have stored it before continuing.                                                                                                                        |
| Copy, save, and print recovery key | Lets you preserve the key through clipboard, a text file, or printing. | Exercise each action. Check the saved/copied value matches. Print preview should contain the recovery card without unrelated app content. Canceling a file dialog should be harmless.                            |
| Password unlock                    | Opens the workspace locally.                                           | Restart the app. Try an incorrect password, then the correct one. Wrong credentials must leave records inaccessible.                                                                                             |
| Manual lock                        | Immediately hides the workspace and clears cached legal records.       | Open a client, select Lock, then unlock. Confirm records disappear while locked and reappear afterward.                                                                                                          |
| Automatic inactivity lock          | Locks after the configured idle period.                                | Set the timeout to one minute. Leave the app untouched and verify it locks. Repeat while interacting; activity should reset the timer.                                                                           |
| Password change                    | Changes the password while preserving records.                         | In Settings → Security, enter the current password and a valid replacement. Lock and verify the new password works and the old one fails. Wrong current passwords and mismatched confirmation should be refused. |
| Forgotten-password recovery        | Uses the recovery key to set a replacement password.                   | From Unlock, open recovery and supply the saved key and matching new passwords. Confirm existing records remain available. Try an invalid key; access must remain locked.                                        |
| Recovery-key replacement           | Invalidates a lost or exposed key and issues another.                  | In Settings → Security, authenticate with the current password and replace the key. Verify recovery works with the new key and fails with the old one.                                                           |
| Local encrypted persistence        | Stores the database locally using encryption.                          | Create records, close the app, restart, and unlock. Confirm records persist. Developer checks should confirm the database cannot be opened without its encryption key.                                           |
| Offline operation                  | Supports normal daily work without internet or an online account.      | Disconnect networking and exercise creation, search, editing, documents, finances, and backups.                                                                                                                  |

Managed document copies are **not individually encrypted on disk**, although the database and backup archive are encrypted.

## Navigation, presentation, and shared controls

| Feature                         | What it does                                                                                                  | How to test it                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace navigation            | Provides Today, Agenda, Tasks, Clients, Cases, Powers of Attorney, Documents, Finance, Backups, and Settings. | Visit every sidebar section. Open record links and return. Check the correct page appears and navigation resets scrolling.                           |
| Quick-add shortcuts             | Opens new-client, new-case, hearing, and task forms.                                                          | Use each header Add shortcut. Repeat hearing/task shortcuts while already on their page; the form should open each time.                             |
| Arabic and English              | Supports Arabic RTL and English LTR layouts.                                                                  | Switch languages on the lock screen and inside the app. Check navigation, forms, dialogs, and errors; restart and confirm the preference persists.   |
| Mixed-direction values          | Keeps identifiers, dates, money, phones, and filenames readable inside Arabic screens.                        | Use Arabic names with Latin filenames, phone numbers, and identifiers. Inspect lists, detail pages, and dialogs for reversed or misplaced values.    |
| Light, dark, and system themes  | Changes application appearance.                                                                               | Save each theme in Settings. Inspect forms and dialogs, then restart. For System, change the OS appearance and check the app follows it.             |
| Table sorting                   | Sorts client, case, POA, and finance tables by column.                                                        | Click column headings twice and check ascending/descending order. Include identifiers such as 2 and 10.                                              |
| Table pagination                | Displays record tables in pages of 25 rows.                                                                   | Create more than 25 records. Navigate between pages and verify every record remains accessible. Apply a filter and check pagination updates.         |
| Suggested internal numbers      | Suggests unused identifiers using existing numbering patterns.                                                | Create several numbered records, then open another creation form. Check the suggestion is unused and can be overridden.                              |
| Searchable entity selectors     | Helps choose clients, cases, and POAs using search and keyboard controls.                                     | Type part of a name or identifier, select using the keyboard, and save. Confirm the intended record was linked.                                      |
| Suggested descriptive values    | Offers common or previously used values for fields such as court, capacity, and notary office.                | Open these controls, choose a suggestion, then enter a custom value. Confirm both can be saved.                                                      |
| Date entry and calendar picker  | Accepts calendar selection and supported typed dates, including Arabic digits.                                | Enter `03/10/2026`, `2026-10-03`, and equivalent Arabic digits. Select a calendar day. Invalid dates and two-digit calendar years should be refused. |
| Timezone-free legal dates       | Preserves calendar dates without shifting them across time zones.                                             | Save a hearing/task date, change the machine’s timezone, restart, and confirm the stored date is unchanged.                                          |
| Unsaved-draft protection        | Warns before discarding edited forms.                                                                         | Edit text, change a selection, or choose a document; then press Escape, close, or Cancel. Keep the draft once and discard it once.                   |
| Failed-save draft retention     | Keeps entered values when saving fails.                                                                       | Trigger a duplicate identifier or another validation error. Confirm the form remains populated so you can correct and retry.                         |
| Duplicate-submission protection | Prevents repeated clicks from creating duplicate records.                                                     | Double-click Save during a pending operation. Confirm only one record is created.                                                                    |

## Optional system tray — implementation 2026-10-22

Settings → Display provides **Keep running in the tray when the window is
closed**, default OFF. It is stored in encrypted settings (migration `0006`).
When ON and tray support is available, Close locks immediately and hides the
window. Show and a second launch reveal/focus it; Lock now uses the existing
vault lock service; Quit exits regardless of the toggle. Busy operations refuse
Close/Quit/Lock now and show a localized message; retry after completion. Tray tooltip
and menu contain no client/case data. Left-click reveal applies where the
platform supports tray clicks; Linux uses its menu.

At locked startup, settings cannot be decrypted: close-to-quit and Arabic tray
labels apply until first unlock loads the preference. The setting stays in memory
across later locks. Missing tray support disables the toggle with an explanation
and preserves normal close-to-quit. On Linux this includes no registered
StatusNotifier host, missing indicator libraries or creation failure; logs use
only `TRAY_UNAVAILABLE`. Host loss restores the visible locked window within the
native monitor interval (two seconds plus a bounded property query). Restart the
app after enabling or restoring desktop tray support. Saved window state never
restores hidden visibility after a tray Quit.

Automated coverage includes all close-decision combinations, busy/shutdown
admission, native lock events/token clearing, migration/default/boolean
constraints, persisted settings, React save/failure/unavailable behavior and
renderer cache/late-IPC clearing. See [the report](reviews/2026-10-21-tray.md)
for actual validation outcomes. The following device checks are **required and
not performed in this change**. Use disposable fictional vaults only.

| Platform                             | Required manual checks                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10 x64                       | Install; initial toggle OFF closes/exits; enable/save/restart/unlock and close to tray; icon, menu and tooltip in Arabic/English; left click and Show restore/unminimize/focus; unlock required; Lock now clears open records and drafts; second launch reveals the hidden instance; Quit exits while visible and hidden; relaunch is visible.                                                                                                  |
| Windows 11 x64                       | Repeat Windows 10 checks, including the notification-area overflow panel, scaling and keyboard menu access.                                                                                                                                                                                                                                                                                                                                     |
| GNOME with AppIndicator extension    | Verify indicator dependencies installed, host detected and toggle enabled; repeat close/lock/show/single-instance/Quit in Arabic/English. Use the tray menu if left-click events are unavailable. Disable the extension while hidden: window must return locked, toggle disabled; restart after re-enabling.                                                                                                                                    |
| GNOME without AppIndicator extension | Even with libappindicator/ayatana installed, toggle is disabled with explanation, Close exits with the stored preference ON, next launch is visible, and logs contain only the stable failure code. Repeat with indicator libraries absent and the session bus unavailable.                                                                                                                                                                     |
| KDE Plasma                           | Verify StatusNotifier icon/menu, Arabic/English labels, focus/unminimize, immediate lock, second-instance reveal and hidden/visible Quit. Remove/disable the tray host while hidden and verify locked-window fallback.                                                                                                                                                                                                                          |
| Every supported target               | While backup, restore commit and permanent deletion hold the operation gate, try Close and tray Quit: operation continues, visible localized refusal, no hidden stranded window or process exit; retry after completion. Try failed lock/hide/menu creation in a disposable test build; verify visible recovery and normal-close fallback. Repeat with native pickers, multiple monitors, logout/restart and restricted filesystem permissions. |

## Today dashboard and search

| Feature                        | What it does                                                                            | How to test it                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today dashboard                | Shows today’s hearings, due tasks, overdue tasks, and upcoming hearings.                | Create items for yesterday, today, and a future date. Verify each appears in the appropriate area.                                                       |
| Hearing details on Today       | Shows hearing context and recorded decisions.                                           | Add a hearing with time, court, and preparation details. Record its decision; confirm it remains visible with decision information.                      |
| Dashboard record links         | Opens the relevant case, hearing, or task.                                              | Follow each dashboard link and verify it opens the exact item selected.                                                                                  |
| Global search                  | Searches clients, cases, and powers of attorney.                                        | Search names, internal/official references, phone digits, and related client names. Select results and confirm the correct detail page opens.            |
| Arabic and digit normalization | Matches supported spelling variants and Arabic/Persian/Latin digits.                    | Search an Arabic name using a supported spelling variant and repeat a numeric search using different digit scripts. Expected records should still match. |
| Literal wildcard handling      | Treats characters such as `%` and `_` as text rather than unrestricted search patterns. | Search those characters. Verify results match literal content rather than every record.                                                                  |
| Keyboard search                | Opens search with Ctrl+K or Command+K.                                                  | Open it, type a query, navigate with arrows, select with Enter, and close with Escape.                                                                   |
| Identically named results      | Distinguishes records by identity.                                                      | Create two clients with the same name and different numbers. Select each search result and verify its own file opens.                                    |
| Search refresh after edits     | Updates linked search information when clients or relationships change.                 | Rename a linked client or change case-client relationships. Search again and verify the new relationship/name is reflected.                              |

Global search does not search inside document contents.

## Clients

| Feature                          | What it does                                                                                                  | How to test it                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create client                    | Stores internal number, name, optional national ID, phone, email, address, and notes.                         | Create a populated client and reopen it. Missing name/number and reused internal numbers should be refused.                                                                                                               |
| Possible-duplicate warning       | Warns when a new client resembles an existing one.                                                            | Create another client with matching identifying details. Review the warning; cancel once, then explicitly confirm a separate fictional client.                                                                            |
| Edit client                      | Updates client details.                                                                                       | Change contact details and notes, save, restart, and verify persistence. Cancel another edit and confirm it was not saved.                                                                                                |
| Client list search               | Finds clients and optionally includes archived records.                                                       | Search by name, number, and phone. Toggle Show archived and verify the result set changes appropriately.                                                                                                                  |
| Client summary and phone copying | Displays identity/contact details and copies the phone number.                                                | Inspect a populated and minimally populated client. Copy the phone and verify the clipboard value.                                                                                                                        |
| Linked cases                     | Shows the client’s cases and supports starting a case with that client selected.                              | Link the client to a case, open its Cases tab, follow the link, and use Add case for client.                                                                                                                              |
| Linked powers of attorney        | Shows POAs containing the client.                                                                             | Add the client to a POA and confirm it appears in the client’s POA tab.                                                                                                                                                   |
| Client account                   | Shows payments received from that client, expenses linked to the client or to any of its cases, and net cash. | Record a payment from the client, a client-linked expense, and an expense on one of its cases. Verify all count and totals change after edits/deletions. Shared case fees and expenses are not apportioned among clients. |
| Client documents                 | Stores documents owned by that client.                                                                        | Add a document from the client’s document tab. Confirm its owner is that client.                                                                                                                                          |
| Archive and restore client       | Hides a client from active lists without deleting its records.                                                | Archive, verify disappearance from the normal list, enable Show archived, open and restore. Confirm relationships and documents remain.                                                                                   |

## Powers of attorney — POAs

| Feature                   | What it does                                                                        | How to test it                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create POA                | Stores an internal sequence, official reference, issue details, notes, and clients. | Create a POA with one or more clients. Missing internal sequence or clients should fail. Reusing an internal sequence should fail; repeating an official number is allowed. |
| Multiple clients          | Associates one POA with several clients.                                            | Select both fictional clients. Save and check the POA and both client files.                                                                                                |
| Inline client creation    | Creates and selects a client inside the POA draft.                                  | Choose Add client from the POA form. Save the client; confirm it is selected while the POA remains an unsaved draft.                                                        |
| Named lawyers             | Records descriptive lawyer names, bar numbers, and notes.                           | Add several lawyers, save, reopen, and edit them. A blank lawyer name should be refused. These entries are not app accounts.                                                |
| POA detail tabs           | Shows summary, clients, lawyers, linked cases, and documents.                       | Open each tab and verify its information and record links.                                                                                                                  |
| POA case links            | Shows the cases of clients whose current POA this is.                               | Add a client of the POA to a case. Confirm the case appears once, including when several case clients share the POA.                                                        |
| One active POA per client | Refuses to give a client a second active POA.                                       | Add a client who already has an active POA to another POA, or restore an archived POA whose client now has another active one. Expect refusal without losing the draft.     |
| POA search                | Searches identifiers, notary details, and related clients.                          | Search each kind of value and confirm the expected POA appears.                                                                                                             |
| POA documents             | Stores managed copies owned by the POA.                                             | Add a sample authorization document and verify ownership and persistence.                                                                                                   |
| Archive and restore POA   | Hides/restores the record without deleting documents.                               | Archive, show archived records, restore, and verify clients and attachments remain.                                                                                         |

## Cases

| Feature                              | What it does                                                                                                   | How to test it                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create case                          | Stores identifiers, court/circuit, case type, litigation degree, status, dates, subject, notes, and clients.   | Create a populated case. Missing internal number or all clients should fail; duplicate internal numbers should fail.                                                 |
| Separate case references             | Distinguishes internal number, official number, Gregorian year, and judicial year.                             | Save an official reference with year 2026 and another with judicial year 89. Verify display. A year without an official number should be refused.                    |
| Date-order validation                | The case form refuses a closing date earlier than the filing date.                                             | Enter a valid date pair, then reverse them. The invalid pair should fail without saving. (The database itself does not enforce this.)                                |
| Case status                          | Supports Active, Suspended, and Closed.                                                                        | Change status and verify list filtering. Closing a case should not silently reschedule hearings or tasks.                                                            |
| Case search and filters              | Searches case references and related details, with status/archive filters.                                     | Search by client, court, opponent, and identifiers. Exercise each status and Show archived.                                                                          |
| Case summary                         | Shows case identity, next hearing, latest decision, and open tasks.                                            | Add several hearings/tasks and record a decision. Check the summary and its links update.                                                                            |
| Edit core case details               | Changes court, references, status, dates, subject, and notes.                                                  | Edit and save these fields. Confirm client relationships remain intact.                                                                                              |
| Edit case clients                    | Adds/removes clients independently of core case details.                                                       | Open Clients and opponents → client Edit. Add a client and remove an unpaid client. Saving with no clients should fail.                                              |
| Per-client legal capacity and notes  | Stores each client’s role separately.                                                                          | Give two clients different capacities and notes. Save and reopen; each should retain its own values.                                                                 |
| Derived client POA                   | Shows each case client’s current POA: the active one, else the newest archived one. It is not chosen per case. | Give a case client a POA and open the case: it appears with a link. Archive it and confirm it is shown as archived; add a new active POA and confirm it replaces it. |
| Payment protection on client removal | Prevents removing a case client who has recorded payments.                                                     | Add a payment from a linked client, then try removing that client from the case. Expect refusal and unchanged relationships.                                         |
| Opponent management                  | Adds, edits, and removes opponents with capacity, lawyer, phone, address, and notes.                           | Exercise all three actions. A blank name should fail; canceling removal should preserve the opponent.                                                                |
| Case-specific tabs                   | Groups hearings, tasks, documents, and the account under the case.                                             | Create one of each item and confirm it appears in the correct tab and global page.                                                                                   |
| Archive and restore case             | Hides/restores the case independently of Closed status.                                                        | Archive, show archived, restore, and confirm all dependent records remain.                                                                                           |
| Archived-case read-only protection   | Prevents mutations to an archived case and its related records.                                                | Archive a populated case. Try editing or adding related items through both its tabs and global pages. Restore and verify editing becomes available again.            |

The case summary keeps agreed fee, received, outstanding and open tasks in one
two-column grid after successful reads. Check Arabic and English; if either the
account or task read fails, its localized error and Retry remain available while
the other metrics stay usable. PR #10 regression evidence is recorded in
[the data-flow review](reviews/2026-10-21-review-of-data-flow-fixes.md#visual-regression-on-pr-10).

## Hearings and agenda

| Feature                       | What it does                                                                              | How to test it                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Create hearing                | Stores case, date, optional time, type, location, circuit, required documents, and notes. | Add a hearing and verify it in Agenda and the case file. Missing case/date and invalid dates should fail.                       |
| Court/circuit defaults        | Prefills hearing location details from the chosen case.                                   | Select a case with court/circuit values. Check the defaults and verify you can change them.                                     |
| Flexible time entry           | Converts supported everyday time input into a canonical time.                             | Enter `9:30`, save, and inspect it. Try an impossible time; expect a field error and retained draft.                            |
| Edit scheduled hearing        | Changes details of hearings awaiting a decision.                                          | Edit date/time/preparation details. Confirm the agenda updates. A decided hearing should not offer unsupported editing actions. |
| Record hearing decision       | Completes the source hearing and stores its decision.                                     | Record a decision without a next date. Verify the decision appears and no follow-up is created.                                 |
| Decision plus next hearing    | Creates a linked follow-up together with the decision.                                    | Record a decision and next date. Verify both changes. Edit the follow-up and confirm the previous hearing remains unchanged.    |
| Delete hearing                | Removes a hearing after confirmation.                                                     | Cancel deletion once, then confirm. Verify it disappears from the agenda and case list.                                         |
| Month, week, and list views   | Presents hearings and tasks in different calendar layouts.                                | Put hearings/tasks on several dates and switch views. Confirm they remain associated with the correct days.                     |
| Date navigation and past days | Navigates calendar periods and controls past-day visibility where offered.                | Move backward/forward, return to today, and toggle past-day display.                                                            |
| Selected-day details          | Shows hearing/task details and actions for a chosen date.                                 | Select a populated day, open a record, and use Add hearing for that date. Repeat the action to verify it reopens.               |

## Tasks

| Feature             | What it does                                                                              | How to test it                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Create task         | Stores title, required due date, an optional case **or** client link, details, and notes. | Create case-linked, client-linked, and unlinked tasks. Missing title/date should fail; a task cannot link both.   |
| Edit task           | Updates the task’s saved details.                                                         | Change title, due date, links, and notes; save and reopen.                                                        |
| Task views          | Provides Today, Overdue, Upcoming, Completed, and All.                                    | Create tasks due yesterday, today, and tomorrow; complete one. Verify each view includes the expected records.    |
| Case/client filters | Narrows task lists by their associations.                                                 | Create tasks for different owners, apply each filter, then clear filters.                                         |
| Complete and reopen | Toggles task completion while preserving the record.                                      | Complete via checkbox or dialog, inspect Completed, then reopen. The open dialog should update its action/status. |
| Delete task         | Removes a task after confirmation.                                                        | Cancel once, then confirm and check it disappears from global and case views.                                     |

Tasks have no priority, assignee, or due time.

## Documents and attachments

| Feature                   | What it does                                                           | How to test it                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Global document list      | Lists documents with metadata and ownership.                           | Add documents to different clients/cases/POAs and inspect the combined list and owner links.                                                     |
| Add from global Documents | Starts creation by choosing an active owner.                           | Choose Add document, select owner type and record, then continue. Verify the correct add form opens once.                                        |
| Native file selection     | Uses the OS picker to choose a source file.                            | Select a sample file. Repeat and cancel; cancellation should create no attachment or freeze the app.                                             |
| Managed document copies   | Copies the source into app storage without changing it.                | Attach a file, then rename or move the original source. The app’s copy should remain accessible.                                                 |
| Single-owner enforcement  | Gives each attachment exactly one client, case, POA, or expense owner. | Check ownership in the UI. Backend tests should reject zero or multiple owners.                                                                  |
| Document metadata         | Stores category, description, and document date.                       | Add metadata, edit it, and reopen. Confirm the underlying file contents remain unchanged.                                                        |
| Open document             | Opens the managed copy using its system application.                   | Open a PDF/image/text document. Verify the correct app launches. A missing managed file should produce an error.                                 |
| Reveal document           | Opens the managed copy’s location in the file manager.                 | Select Reveal and verify the correct file/location is shown.                                                                                     |
| Remove document           | Deletes the managed copy and metadata after confirmation.              | Cancel once, then remove. Confirm it disappears while the original source file remains.                                                          |
| Failed-import cleanup     | Avoids leaving partial attachments after failed imports.               | Using a disposable test fixture, make the source unavailable before saving. Confirm failure leaves no attachment record or partial managed file. |

There is no built-in document-content preview, OCR, or external-file-reference mode.

## Fees, payments, and expenses

| Feature                      | What it does                                                                 | How to test it                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case fee agreement           | Stores one agreed-fee amount per case.                                       | Save EGP 10,000, then update it. Confirm the case account reflects the replacement amount. Invalid amounts should fail.                                 |
| Record payment               | Stores case, payer, amount, date, optional method, and notes.                | Record EGP 2,000.25 from a linked client. Verify it appears in Finance and the case/client account.                                                     |
| Restricted payment payers    | Allows payment only from clients linked to that case.                        | Select different cases and inspect payer options. For a single-client case, verify automatic selection. Backend tests should reject an unrelated payer. |
| Payment methods              | Supports cash, bank transfer, cheque, electronic, and other.                 | Save payments using different methods and check their displayed details.                                                                                |
| Inspect and edit payment     | Opens transaction details and permits corrections.                           | Inspect, edit amount/date/method/notes, and verify the ledger and totals update.                                                                        |
| Delete payment               | Removes an incorrect payment after confirmation.                             | Cancel once, then confirm. Verify received and outstanding amounts recalculate.                                                                         |
| Record expense               | Stores amount, date, type, notes, and an optional case **or** client link.   | Create case-linked, client-linked, and unlinked expenses. Verify all are accepted with valid amounts; linking both is refused.                          |
| Expense categories           | Supports court fees, transport, office supplies, expert fees, and other.     | Save one expense of each type and inspect the ledger.                                                                                                   |
| Inspect and edit expense     | Shows details and supports corrections.                                      | Change amount/type/links and save. Check the affected account totals update.                                                                            |
| Delete expense               | Removes an expense after confirmation, unless it owns attachments.           | Delete an ordinary expense. With an attachment-bearing backend fixture, verify deletion is refused with an explanation.                                 |
| Finance filters              | Filters payments/expenses by case and client.                                | Create transactions across several records, apply filters, and check only matching transactions appear.                                                 |
| Case account calculations    | Calculates agreed, received, outstanding, expenses, and net cash.            | With fee **10,000**, payment **2,000.25**, and case expense **250.10**, expect outstanding **7,999.75** and net cash **1,750.15** where displayed.      |
| Exact money storage          | Stores amounts in integer piastres to avoid floating-point rounding.         | Save fractional amounts, edit them, and verify exact totals. Zero/negative payments or expenses and unsupported precision should fail.                  |
| Financial archive safeguards | Blocks changes connected to archived cases, including reassignment attempts. | Archive a case with transactions. Try changing/deleting them or moving them to an active case; expect refusal.                                          |

This is fee and cash tracking, not a complete accounting system.

## Backups and restoration

| Feature                                 | What it does                                                                          | How to test it                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual encrypted backup                 | Creates an archive containing the database and managed documents.                     | Add records and a document, then Create backup. Confirm success and updated latest-backup information.                                                        |
| Latest-backup status                    | Shows successful backup time/size and missing/stale-backup advice.                    | Inspect a workspace with no backup, create one, and check the status. Test stale advice with a controlled older fixture.                                      |
| Save backup copy                        | Copies the latest backup to a chosen destination.                                     | Save to a disposable folder or USB drive. Verify the copy matches the original archive; canceling should be harmless.                                         |
| Reveal backup                           | Opens the backup location.                                                            | Select Reveal and verify the file manager shows the correct archive.                                                                                          |
| Validate backup                         | Authenticates and checks a backup without replacing live data.                        | Select a valid backup and complete preparation. Confirm validation succeeds and records remain unchanged.                                                     |
| Restore preview                         | Shows backup creation time, document count, and password guidance before replacement. | Prepare a restore and inspect the preview. Cancel; current data must remain intact.                                                                           |
| Same-workspace restore                  | Replaces current records/documents with a snapshot and ends locked.                   | Backup, create a later record, then restore. Unlock and confirm the later record is absent and backed-up documents open correctly.                            |
| Restore on a fresh installation         | Restores an authenticated backup through setup.                                       | Use a separate disposable app-data environment, select Restore, and authenticate with the backup password. Verify restored records/documents after unlocking. |
| Replace another unlocked workspace      | Allows authenticated restoration of a different vault.                                | Restore workspace A’s backup over disposable workspace B. Follow the password notice and verify A’s data appears.                                             |
| Recovery-key restore                    | Restores using the backup recovery key and a new password.                            | Select recovery authentication, supply the key and matching new passwords, restore, then unlock with the new password.                                        |
| Invalid-backup refusal                  | Rejects damaged, unsupported, incomplete, or incorrectly authenticated backups.       | Try a wrong password and a damaged copy of an archive. Verify failure leaves current records and documents unchanged.                                         |
| Restore cancellation/session protection | Invalidates canceled, superseded, or locked-session preparations.                     | Prepare and cancel, choose another archive, or lock before completion. Old prepared operations must not install later.                                        |
| Interrupted-restore recovery            | Uses journaled replacement and retains the previous workspace in emergency snapshots. | Exercise automated interruption tests with disposable fixtures. Verify replay completes safely or leaves the vault locked with an interruption error.         |
| Shared backup tools                     | Makes the same backup/restore controls available in Backups and Settings.             | Create/validate/restore from both entry points and verify consistent behavior.                                                                                |

Fresh-installation restore is implemented and tested locally. **Physical Windows↔Linux portability still requires device testing.**

The [2026-10-21 ZIP advisory review](reviews/2026-10-21-zip-advisories.md) records
the zip 9.0.5 upgrade, fixed zip-2.4.2 format-v2 restore fixture, new-writer
roundtrip and hostile-archive checks. Symlink entries and absolute/parent paths
are refused before staging; regular-file permissions from the archive are
ignored. These are automated backend checks; physical Windows↔Linux restore
acceptance remains pending for the public-launch scope (macOS is outside it).

## Unencrypted data exports — 2026-10-21

| Feature                | What it does                                                                                                                              | Test instructions                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complete domain export | Separate Backups/Settings card writes all legal records, archived records, CSV relationships, documents and a manifest outside the vault. | Cancel the warning and picker; then confirm into a disposable folder. Verify BOM Arabic CSVs, integer money, ISO dates, archived flags, hashes/counts and document bytes.            |
| Case export            | Case detail exports the selected active/archived case, direct records, linked clients/current or fallback POAs and scoped documents.      | Share a client/POA with another case; export one case and verify the other case's records, tasks, expenses and documents are absent. Shared client/POA documents are included whole. |
| Safe publication       | Stages in a `.partial` sibling and renames without overwriting.                                                                           | Repeat in the same minute/parent and verify refusal. With disposable fixtures, remove/damage a managed file or inject an IO failure and verify no final-name folder appears.         |
| Reveal and errors      | Success shows folder name and native Show in folder; cancellation is harmless, failure remains retryable.                                 | Verify file manager behavior on Windows/Linux; move the output and test reveal error. Confirm warning strings in Arabic/English and responsive native picker.                        |

The [versioned format](export-format.md) defines exact columns, scope, formula
guards, manifest and plaintext staging limits. These exports cannot restore the
app. Automated evidence and unexecuted device checks are in the
[export report](reviews/2026-10-21-exports.md); the manual instructions here do not
claim target-device execution.

## Guided permanent deletion — 2026-10-22

| Feature                | Behavior                                                                                                                                                                                                                                           | Disposable-data checks                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client deletion        | Archived-client action opens one confirmation with native case/document counts; Delete removes direct records and exclusive archived cases/POAs and their dependent records/files.                                                                 | Cancel must call no commit; one Delete click must commit once. Confirm shared records and unarchived dependents show the existing localized refusal. Verify lists, accounts and search refresh.                                       |
| Case deletion          | Archived-case action uses the same one-dialog confirmation with document count. Removes hearings, tasks, payments, fee agreement, expenses and scoped attachments; clients/POAs remain.                                                            | Confirm counts and cancellation, then delete once. Verify retained clients and refreshed tasks, agenda, accounts, documents and search. Multi-client cases must be refused.                                                           |
| Whole-vault reset      | Settings → Privacy → Danger zone; one confirmation with stronger whole-workspace wording and client/case/document counts. No typed word or password. Removes records, managed files, local backups and restore snapshots, then returns to welcome. | Anyone with the unlocked app can now reset with one confirmation. Check Arabic RTL and English summaries. Verify reset both with and without the optional backup using disposable data.                                               |
| Backup first           | Reset-only checkbox, unchecked on every opening. Uses the existing encrypted backup service and saves outside the vault before deletion. Client/case deletion offers no backup checkbox.                                                           | Select the checkbox explicitly, cancel the picker or inject backup failure and verify records remain. After success, restore the saved copy in a disposable workspace. Outside backups keep earlier copies of deleted records.        |
| File-removal failures  | Row transaction remains committed; failure counts are shown and pending files are tracked by migration `0005`.                                                                                                                                     | Use injected unlink failures. Retry in the result dialog or Settings → Privacy; a pending whole-reset marker resumes at restart and blocks setup until cleanup succeeds.                                                              |
| Integrity and sessions | Shared files, cross-case hearing references, changed data, stale tokens and lock/unlock invalidate/refuse deletion. Operation admission remains serialized with other vault work.                                                                  | Exercise service tests for unchanged-count edits, forged/wrong-target tokens, stale sessions, shared/archive refusal and cleanup retry. React tests cover loading, busy refusal, duplicate clicks, cancellation and one-click commit. |

The native preview loads silently inside the dialog; Delete stays disabled until
it succeeds. A refused or stale preview can be fetched again in the same dialog.
No flow promises forensic/secure erasure from SSDs or backup media. Safe diagnostic
logs and copies outside the vault are retained. The manual checks above are
instructions, not claimed device-test results. Automated evidence and Windows/Linux
limitations are in the [deletion report](reviews/2026-10-21-permanent-deletion.md).

## Settings and OS integration

| Feature                      | What it does                                                                                                                                                                                                                            | How to test it                                                                                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lawyer profile               | Stores name, bar number, phone, and office address.                                                                                                                                                                                     | Edit and save the profile, restart, and verify persistence.                                                                                                                                                                                  |
| Date-format preference       | Supports day/month/year and ISO display.                                                                                                                                                                                                | Change the preference and inspect lists, details, and transaction inspection dialogs. Stored dates should remain unchanged.                                                                                                                  |
| Week-start preference        | Changes the calendar’s first weekday.                                                                                                                                                                                                   | Save another week start and inspect Agenda.                                                                                                                                                                                                  |
| Privacy information          | Explains local storage, documents, backups, and network behavior.                                                                                                                                                                       | Open Settings → Privacy and verify the information matches the implemented storage model.                                                                                                                                                    |
| About and developer contacts | Shows app details and email, phone, WhatsApp, Telegram, and LinkedIn actions.                                                                                                                                                           | Inspect About and footer contacts. Activate each intentionally and verify the correct system handler opens without replacing the workspace.                                                                                                  |
| Redacted support bundle      | Settings → About lists contents/exclusions, then manually saves one ZIP using the native picker. Includes only system/schema metadata, language/theme, allow-listed logs and timestamped codes, plus bilingual README. Nothing is sent. | Check the list in Arabic/English; cancel before saving and in the picker; save to a new filename outside the vault; inspect ZIP entries; try an existing filename or unwritable folder and verify a localized error with no success message. |

File-opening and recovery-key printing behavior need physical-device checks. Support-bundle native picker,
Windows OS-version retrieval, permission and disk-full journeys also need physical
Windows/Linux validation. Automated support-bundle evidence is recorded in the
[implementation report](reviews/2026-10-21-support-bundle.md).

## Implemented backend capabilities without a complete visible UI

| Capability                | Explanation                                                                                   | How to test it                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Expense-owned attachments | Backend supports document ownership by an expense; expense dialogs do not expose upload.      | Create an expense attachment through the test harness. Verify ownership and that expense deletion is blocked until attachments are removed. |
| Search-index rebuild      | Reconstructs the local search index. No visible maintenance action.                           | Exercise `search_rebuild_index`; verify searches find expected records afterward and locked access is refused.                              |
| Local usage counters      | Backend retains optional aggregate counters; the current settings UI has removed the control. | Use backend tests to check consent behavior and local storage. This is not a current user-facing settings feature.                          |

## Removed features

These were removed on 2026-10-13 and are not planned. Migration `0004` drops their stored settings and the reminder delivery log.

- Notification permission and hearing/task notifications.
- Default reminder lead time (and per-hearing/per-task reminder values).
- Optional autostart (launch at sign-in).
- Hearing-roll printing from Agenda.
- Automatic backup schedules, retention policies, configurable primary backup destination, and backup-history UI.
- Individual client JSON export (`client_export`).

## Features still missing or incomplete

These should not be counted as available:

- Emergency-snapshot browsing/export/deletion UI.
- Multi-user accounts, collaboration, cloud synchronization, and online access.
- Physical Windows/Linux acceptance for installers, native dialogs, printing, and cross-platform restore.

## Review validation

The earlier 2026-10-14 validation and PR follow-up are recorded in the
[PR #9 readiness review](reviews/2026-10-14-pr-9-readiness.md). The review covers
the feature removals, relationship rules, development fixtures and regression
checks. Physical-device acceptance remains separate.

| Check                                                              | Result                                          |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, frontend build | Passed                                          |
| `pnpm test` — frontend                                             | 579 tests passed                                |
| `pnpm test` — Node scripts                                         | 60 tests passed                                 |
| Rust format, clippy with all targets/features and warnings denied  | Passed                                          |
| `cargo test --manifest-path src-tauri/Cargo.toml --all-features`   | 177 tests passed                                |
| Frontend/Rust coverage and existing coverage floors                | Passed                                          |
| Canonical browser comparison                                       | 71 tests passed; 68 candidate captures verified |
| Native Linux desktop journeys                                      | 11 scenarios passed                             |
| Linux debug Debian package and production harness scan             | Passed                                          |

Tests emitted non-failing mock/setup warnings. Native Linux desktop journeys ran
against disposable fixtures. No manual target-device walkthrough or physical
Windows/Linux validation was performed during this review. The manual steps
above are test instructions, not a claim that every step was executed. The
application remains pre-beta.

## References

- [Project plan](plan.md)
- [Functional modules](plan/04-functional-modules.md)
- [Backup specification](plan/07-backup-format.md)
- [Export format](export-format.md)
- [Canonical offline integration review](reviews/2026-10-10-integration.md)

## Desktop CI harness update — 2026-10-21

Windows CDP click readiness now waits for stable visible, enabled and unobscured
targets before dispatch, with no action replay. Text reads wait for element
creation. Fixed fine-grained checkpoints and exact allowlisted harness/app error
categories retain no raw exceptions, DOM, selectors or field values. Cancel and
corrupt restore preservation journeys wait for dialog removal; corrupt restore
also checks the localized damaged-file alert and its dismissal before navigation.
Script regressions exercise delayed recovery rendering, asynchronous cancellation
and adapter success/refusal paths. Windows and Linux native CI acceptance must
still be rerun; unit checks do not certify launch readiness. Details and actual
validation are in [Implementation run 2](reviews/2026-10-21-windows-desktop-ci.md#implementation-run-2).
