# Functional modules

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

Application security and unlocking (§8.2) moved to [05-security.md](05-security.md).
Backup and restore (§8.12) moved to [07-backup-format.md](07-backup-format.md).

---

# 8. Detailed functional modules

## 8.1 First-run onboarding

**Implemented with a deviation from the steps below:** onboarding only asks
for the lawyer's name and a password, with a language toggle available at
any time (not just during setup). Backup configuration and creation are not
part of onboarding at all — they are never a barrier to entry — and live
permanently in Settings → Backups instead (see §8.14). The managed-document
directory, reminder configuration, and other profile fields are deferred to
later settings/profile screens rather than required upfront.

### Required steps

1. Enter the lawyer's name and choose a password.
2. Create the first encrypted database.
3. Show the recovery key once.

### Deferred to Settings (not part of onboarding)

* Interface language (available as a toggle at any time, not onboarding-only)
* Managed-document directory
* Backup directory, creation, validation and restore
* Reminder behavior
* Full lawyer profile (bar number, phone, email, address, logo, etc.)

### Lawyer profile fields

* Full name
* Bar registration number, optional
* Phone number
* Email, optional
* Office address, optional
* Logo, optional
* Default currency, initially EGP
* Preferred date format
* Default reminder times

### Acceptance criteria

* The application cannot reach the dashboard before database initialization succeeds.
* A failed initialization must not leave a partially created database.
* The user receives a clear recovery warning.
* Reaching the dashboard never requires creating or verifying a backup first.
* No profile data is transmitted externally.

---

## 8.3 Dashboard

The dashboard is the primary daily screen.

### Sections

#### Today

* Today's hearings
* Today's appointments
* Today's deadlines
* Today's tasks

#### Coming soon

* Tomorrow
* Next seven days
* Next thirty days

#### Attention required

* Overdue tasks
* Hearings without recorded outcomes
* Cases with no future event
* Overdue payments
* Failed backup warning
* Backup older than configured threshold

#### Recent activity

* Recently opened cases
* Recently updated clients
* Recently imported documents

### Dashboard actions

* Add client
* Add case
* Add hearing
* Add task
* Record payment
* Create backup

### Acceptance criteria

* Dashboard loads from local data without a network request.
* Date calculations use the local timezone.
* Overdue status is deterministic and tested.
* Clicking an item opens its source entity.
* Empty states explain the next useful action.
* No analytics charts in the MVP.

---

## 8.4 Clients

### Client fields

* Internal UUID
* Client type:

  * Individual
  * Organization
* Full name or organization name
* National ID, optional
* Registration number, optional
* Primary phone
* Additional phones
* Email, optional
* Address, optional
* Notes
* Archived status
* Creation and update timestamps

### Client screen

The client detail page contains:

* Basic information
* Active cases
* Archived cases
* Upcoming events
* Documents
* Financial summary
* Notes
* Export action
* Archive action

### Client rules

* Do not permanently delete a client with linked cases without an explicit cascading-deletion workflow.
* Archiving is the default removal mechanism.
* Duplicate warnings should use normalized phone number and name.
* National ID is optional.
* The application must not require data the lawyer does not need.

### Acceptance criteria

* Add, edit, view, archive and restore clients.
* Find a client by name or phone.
* Display all related cases.
* Export one client and related records.
* Prevent accidental duplicate creation where a probable duplicate exists.

---

## 8.5 Cases

**Implemented with a deviation:** a case may have more than one client. The
case's client list is a set of one or more client IDs with exactly one marked
primary (`case_clients` join table — see
[03-data-model.md](03-data-model.md)), not a single `Client ID` field.

### Case fields

* Internal UUID
* Client IDs (one or more, one marked primary)
* Case number
* Judicial year
* Court
* Circuit
* Case type
* Client's legal capacity
* Current case status
* Filing date, optional
* Closed date, optional
* Case summary
* Opposing parties
* Important notes
* Created timestamp
* Updated timestamp
* Archived timestamp

### Initial statuses

```text
DRAFT
ACTIVE
SUSPENDED
JUDGMENT_ISSUED
APPEALED
ENFORCEMENT
CLOSED
ARCHIVED
```

Status labels shown to the user must be Arabic and configurable only through future migrations, not through an MVP workflow engine.

### Case detail sections

* Overview
* Parties
* Timeline
* Hearings and events
* Tasks
* Documents
* Finances
* Notes

### Case parties

Each party contains:

* Name
* Role
* Phone, optional
* Address, optional
* Notes

Initial roles (implemented without `CLIENT`/`CO_CLIENT` — clients on a case
are tracked via `case_clients`, not as a party role):

```text
OPPONENT
WITNESS
EXPERT
OTHER
```

### Acceptance criteria

* Create, edit, view and archive a case.
* A case has at least one client, with exactly one marked primary.
* A case can contain multiple other parties.
* A case number and judicial year can be searched separately or together.
* A case timeline is presented chronologically.
* A closed case remains searchable.
* Destructive deletion is separated from normal archiving.

---

## 8.6 Hearings and legal events

Use a unified case-event model rather than a hearings-only table.

### Event types

```text
HEARING
EXPERT_SESSION
PROSECUTION_APPOINTMENT
INVESTIGATION
ENFORCEMENT_PROCEDURE
ADMINISTRATIVE_APPOINTMENT
CLIENT_APPOINTMENT
DEADLINE
OTHER
```

### Event fields

* Case ID, optional for general appointments
* Client ID, optional
* Event type
* Title
* Date
* Start time, optional
* End time, optional
* All-day flag
* Court or location
* Circuit, optional
* Preparation notes
* Required documents
* Outcome
* Decision
* Next action
* Completion status
* Reminder configuration
* Creation and update timestamps

### Hearing workflow

Before the hearing:

* Date and court
* Required preparation
* Required documents
* Reminder

After the hearing:

* Record outcome
* Record decision
* Record next action
* Optionally create next hearing
* Optionally create task

### Missing-outcome warning

When a hearing date has passed and no outcome has been entered, it appears under dashboard attention items.

### Acceptance criteria

* Add an event from the case or calendar.
* Record the event outcome.
* Create the next hearing from the previous hearing.
* Copy relevant court and case fields automatically.
* Display case events in timeline and calendar views.
* Prevent impossible end-before-start times.
* Preserve date-only events without timezone conversion errors.

---

## 8.7 Personal tasks

Tasks are personal reminders for the lawyer. They are not assigned to users.

### Fields

* Title
* Description
* Client ID, optional
* Case ID, optional
* Due date
* Due time, optional
* Priority
* Status
* Reminder configuration
* Completed timestamp

### Statuses

```text
OPEN
COMPLETED
CANCELLED
```

### Priorities

```text
LOW
NORMAL
HIGH
URGENT
```

### Acceptance criteria

* Create tasks from the dashboard, client, case or event.
* Mark tasks complete.
* Reopen completed tasks.
* Filter by date, case, client, priority and status.
* Overdue tasks appear on the dashboard.
* No assignee field exists.

---

## 8.8 Calendar and reminders

### Calendar views

* Day
* Week
* Month
* Agenda list

### Calendar items

* Hearings
* Deadlines
* Client appointments
* Expert sessions
* Tasks with due dates
* Other legal events

### Reminder behavior

Store reminder schedules in the database. On application start or unlock:

1. Load upcoming reminder records.
2. Register or refresh native notifications.
3. Mark expired reminders appropriately.
4. Prevent duplicate notifications.
5. Recalculate reminders when an event changes.

Native notifications are available through Tauri's notification plugin. For dependable reminders when the main window is closed, the application should offer optional autostart and minimize-to-tray behavior.

### Required disclosure

The settings screen must explain:

> Reminders cannot appear while the application is completely closed unless launch-at-startup/background operation is enabled.

### Acceptance criteria

* Reminders persist across restarts.
* Editing an event cancels obsolete reminder schedules.
* Deleting an event removes its reminders.
* Notifications never include highly sensitive case descriptions by default.
* Default notification text should contain only enough information to identify the action safely.

Example:

```text
جلسة اليوم الساعة 10:00
القضية رقم 1234 لسنة 2026
```

---

## 8.9 Documents

### Supported file types

Initial support:

* PDF
* DOCX
* DOC
* Images
* TXT
* XLSX
* Other files as generic attachments

### Document storage modes

#### Managed copy

The application copies the selected document into its managed directory.

Benefits:

* Included in backup
* Stable path
* Can be exported with the case

#### External reference

The application records a reference to an existing file.

Benefits:

* Avoids duplication
* Suitable for existing lawyer folder structures

Limitations must be shown clearly:

* The file may become unavailable if moved or deleted.
* External files are not automatically included in application backup.

### Document fields

* Internal UUID
* Client ID, optional
* Case ID, optional
* Original filename
* Stored filename
* Relative managed path, optional
* External path, optional
* Storage mode
* MIME type
* File size
* SHA-256 checksum
* Category
* Description
* Document date, optional
* Imported timestamp
* Missing-file status
* Archived timestamp

### Initial categories

```text
PLEADING
COURT_DECISION
EVIDENCE
CONTRACT
POWER_OF_ATTORNEY
IDENTIFICATION
RECEIPT
CORRESPONDENCE
OTHER
```

### File behavior

* Use native file-selection dialogs.
* Validate the source exists before import.
* Use generated internal filenames.
* Preserve original filename as metadata.
* Copy atomically.
* Calculate checksum after copying.
* Verify checksum.
* Open files using the operating system's default application.
* Reveal files in the system file manager.
* Never execute imported files automatically.

Tauri provides official file-system and dialog APIs for scoped local file operations and native file selectors. Its permission model should be configured narrowly rather than granting unrestricted frontend filesystem access.

### Attachment encryption decision

For MVP:

* The SQLCipher database is encrypted.
* Managed attachments are normal files protected by the device's user account and full-disk encryption.
* Onboarding and settings must strongly recommend BitLocker or FileVault.
* Marketing must not claim that documents are application-encrypted.

A separately encrypted document vault can be investigated after the MVP because editing encrypted DOCX and similar files through external applications introduces complex temporary-file and reconciliation behavior.

### Acceptance criteria

* Import managed document.
* Add external reference.
* Detect missing referenced files.
* Open and reveal document.
* Reassign document to another category.
* Export all managed documents for a case.
* Remove a managed document only after explicit confirmation.
* Avoid deleting an external source file when removing its application reference.

---

## 8.10 Financial tracking

This module is a simple case-finance ledger, not accounting software.

### Fee agreement

Each case can contain:

* Agreed fee
* Currency
* Agreement date
* Notes

Store money as integer minor units, never floating-point values.

For EGP:

```text
1 EGP = 100 piastres
```

### Transaction types

```text
FEE_PAYMENT
CASE_EXPENSE
REFUND
OTHER_INCOME
OTHER_EXPENSE
```

### Transaction fields

* Client ID
* Case ID, optional
* Type
* Amount in minor units
* Currency
* Transaction date
* Payment method
* Description
* Receipt document ID, optional
* Created timestamp
* Updated timestamp

### Payment methods

```text
CASH
BANK_TRANSFER
CARD
MOBILE_WALLET
OTHER
```

### Calculations

```text
Amount received =
  sum(FEE_PAYMENT + OTHER_INCOME - REFUND)

Outstanding legal fee =
  agreed fee - applicable received payments

Net cash =
  income - refunds - expenses
```

### Screens

* Case financial summary
* Client financial summary
* Transaction form
* Date-filtered transaction list
* Printable statement

### Acceptance criteria

* Add, edit and reverse a transaction.
* Avoid silently deleting financial history.
* Display currency consistently.
* Validate positive amounts.
* Generate a simple client statement.
* Clearly separate lawyer fees from case expenses.
* Do not produce tax or formal accounting claims.

---

## 8.11 Global search

### Searchable fields

* Client names
* Client phone numbers
* Case numbers
* Judicial years
* Court names
* Circuits
* Case types
* Opposing-party names
* Case summaries
* Hearing outcomes
* Task titles
* Document filenames

### Arabic normalization

Search normalization should account for common input differences:

* Remove Arabic diacritics.
* Normalize variants of Alef.
* Normalize Arabic and Western digits.
* Normalize whitespace.
* Normalize phone numbers.
* Preserve original text for display.

Do not overwrite the user's original text with normalized text.

### Implementation

For the first release, use a dedicated denormalized search index maintained by application services.

Example:

```text
search_index
├── entity_type
├── entity_id
├── title
├── subtitle
├── normalized_text
└── updated_at
```

Avoid introducing Elasticsearch or another search server.

### Acceptance criteria

* Search results appear after a short debounce.
* Results are grouped by entity type.
* Selecting a result opens the relevant record.
* Updating an entity updates its search index in the same transaction.
* Rebuild-search-index command exists for recovery and migrations.

---

## 8.13 Privacy and data-management tools

See [06-privacy.md](06-privacy.md).

---

## 8.14 Settings

### General

* Language
* Theme
* Date format
* First day of week
* Default currency
* Default calendar view

### Profile

* Lawyer information
* Logo
* Contact information

### Reminders

* Default reminder times
* Notification permission
* Launch at startup
* Minimize to tray
* Notification privacy level

### Documents

* Managed document directory
* Default storage mode
* Allowed file-size warning threshold

### Backup

* Backup location
* Frequency
* Retention
* Test backup
* Restore

### Security

* Change password
* Lock timeout
* Recovery-key status
* Lock now
* Security guidance

### Privacy

* Data locations
* Network behavior
* Privacy notice
* Export all data
* Delete all application data

### Updates

* Current version
* Check for updates
* Automatic update check
* Release notes
