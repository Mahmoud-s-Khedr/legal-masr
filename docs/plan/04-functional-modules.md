# Functional modules

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Implemented workflows

### Vault and settings

First run collects the lawyer name and a password, creates the encrypted vault,
and displays a recovery key once. The lock screen unlocks locally; password
change rewraps the master key and recovery sets a replacement password.

Settings provide profile (name, bar number, phone, office address), Arabic or
English UI, theme, date format, week start, default reminder lead time, lock
timeout, autostart, notification permission, aggregate usage-counter consent,
manual backup controls, privacy/data-location information, and About. Backup
setup never blocks onboarding. About credits developer Mahmoud Khedr and offers
email, phone, WhatsApp, Telegram, and LinkedIn contact actions. The workspace
footer repeats these contact options and links directly to About. Contact actions
use a narrow Rust command with fixed destinations; no renderer-supplied URL or
message content is opened.

### Clients, POAs, and cases

Clients have a unique internal number, name, optional national ID/contact
details/notes, archive/restore, duplicate warning, search, relationships,
account summary, and attachments.

Powers of attorney support unique internal sequence, non-unique official
number, issue details, multiple clients, descriptive lawyers, linked cases,
attachments, archive/restore, list/search, and a tabbed detail view.

Cases have explicit internal and optional official identifiers, court/circuit,
type/litigation degree, status, dates, subject, notes, one or more client
relationships (each with legal capacity, optional client-owned POA, and notes),
lightweight opponents, archive/restore, account, hearings, tasks, and
attachments. There is no generic party model or global case legal capacity.

### Hearings, agenda, Today, and tasks

Hearings are case-scoped. A decision updates its source hearing and can create
an independently editable next hearing linked by `previous_hearing_id` in the
same transaction. Today shows today's hearings/tasks, overdue tasks, and
upcoming hearings. Agenda supports month/week/list views using date-only data.

Tasks have title, details, notes, required due date, optional client/case link,
optional reminder, and a semantic completion checkbox. Today, Overdue,
Upcoming, Completed, and All are derived list views. There is no priority,
assignee, time-of-day, source-event, or cancellation workflow.

Reminder selection and delivery deduplication cover canonical hearing and task
records. Notification copy is privacy-safe. Autostart is optional; tray behavior
and physical Windows/macOS notification/autostart validation remain open.

### Finance

A case can have one fee agreement. Payments are separate from expenses. Payment
payers are restricted to the clients linked to the selected case; both the
service and the database enforce that relationship. Expenses use a constrained
type and have independently optional client/case links. Case and client account
summaries calculate agreed, received, outstanding, expenses, and net cash from
integer EGP minor units. The module is not accounting software.

### Attachments

Attachments are managed copies only. A native picker returns a one-use source
token to Rust; Rust validates and copies the selected file to the managed
attachment directory, hashes it, inserts metadata, and cleans up on failure.
Each attachment has exactly one client/case/POA/expense owner. The UI can list,
edit metadata, open, reveal, and remove it. It does not expose a browser
preview, an external-reference mode, or arbitrary paths.

### Search and presentation

Global search indexes Clients, Cases, and POAs using normalized Arabic/digit
prefix/exact lookup and opens the matching deep link. The shared RTL shell
contains Today, Agenda, Clients, Powers of Attorney, Cases, Tasks, Documents,
Finance, Backups, Settings, and Lock Application. The global Documents view is
read-only: new attachments must be added from their client, case, POA, or
expense owner so every attachment has exactly one owner. Values whose direction
must not flip (dates, identifiers, money, phones, filenames, versions) use
`<bdi>`.

## Current gaps and release risks

The illustrated-guide audit also confirmed that the case-client relationship
panel is read-only: creation selects clients, but case editing preserves their
relationships and does not expose client reassignment, legal-capacity editing,
or POA selection. Expense-owned attachments are supported by Rust, but the
expense dialogs do not expose an attachment-upload control. Client JSON export
also remains a backend command without a visible UI action. The guide documents
these limits rather than providing instructions for unavailable controls.

- Backups are manual and saved to the app-data backup folder; there is no
  configurable destination, automatic schedule, retention policy, or history
  list UI.
- Restore has validation and staged rollback protection but no preview and has
  not been repeatedly proven as portable across devices using the original
  password.
- The current client export is a manually chosen `client-{id}.json` file.
  Documented full-installation, case, and stable CSV/manifest exports are not
  implemented.
- Permanent client/case/application-data deletion and redacted support-bundle
  workflows are not implemented.
- Case-folder export, minimize-to-tray behavior, and physical target-platform
  validation remain incomplete.
