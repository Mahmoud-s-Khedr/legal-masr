# Roadmap and phases

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 18. Implementation phases

## Phase 0 — Lawyer workflow research

**Status:** Not started

**Duration:** One week, overlapping with technical spike.

Interview and observe approximately 10 individual Egyptian lawyers.

Do not ask only, "Which features do you want?"

Ask them to demonstrate:

* How they identify tomorrow's hearings.
* How they record a hearing outcome.
* How they locate an old case.
* How they organize client files.
* How they track money.
* What information they write on paper.
* Which information they refuse to place online.
* What happens when a hearing is rescheduled.
* How they back up their current files.

### Deliverables

* Interview notes
* Workflow map
* Terminology glossary
* Final case fields
* Final event types
* Top five daily tasks
* Revised wireframes
* Confirmed product vocabulary

### Exit criteria

* At least five lawyers independently confirm the core workflow.
* No critical daily workflow is absent from the plan.
* Vocabulary is understandable without explanation.

---

## Phase 1 — Technical and security spike

**Status:** In progress

### Scope

* [x] Tauri 2 bootstrap
* [x] React/Vite bootstrap
* [x] SQLCipher build (local compile proof)
* [x] Rust database boundary
* [x] Password envelope
* [x] Recovery envelope
* [x] Migration system
* [ ] Windows build
* [ ] macOS Intel build
* [ ] macOS Apple Silicon build
* [~] Backup proof of concept — encrypted creation and validation implemented; restore remains

### Deliverable

A small application that can:

1. [x] Initialize an encrypted database.
2. [x] Insert a sample record.
3. [ ] Close and reopen as an automated end-to-end test.
4. [x] Reopen with password.
5. [x] Reject wrong password.
6. [x] Change password.
7. [x] Recover using recovery key.
8. [x] Create and validate an encrypted backup.
9. [ ] Restore.
10. [ ] Build on all target platforms.

### Exit criteria

No feature module begins until this phase passes. It has not passed yet.

---

## Phase 2 — Application foundation

### Scope

* Repository structure
* Tauri permissions
* Error contract
* Logging
* React providers
* Routing
* RTL foundation
* Design tokens
* Main layout
* Localization
* Settings storage
* Onboarding
* Lock screen
* Window state
* Single instance

### Acceptance criteria

* Application opens in Arabic RTL.
* Onboarding completes.
* Application locks and unlocks.
* No direct SQL exists in frontend code.
* No unrestricted frontend filesystem access exists.
* CI validates Rust and TypeScript.

---

## Phase 3 — Clients and cases

### Scope

* Client schema and migrations
* Client CRUD
* Client search
* Duplicate warnings
* Case schema and migrations
* Case CRUD
* Parties
* Archiving
* Client and case detail screens
* Basic search index

### Exit criteria

A lawyer can maintain clients and cases without using another module.

---

## Phase 4 — Events, calendar, tasks and dashboard

### Scope

* Case events
* Hearing workflow
* Event outcomes
* Next-hearing creation
* Tasks
* Calendar
* Dashboard
* Overdue logic
* Missing-outcome warnings
* Native notifications
* Optional autostart and tray behavior

### Exit criteria

The application provides a useful daily agenda.

This is the first version suitable for a closely supervised lawyer alpha.

---

## Phase 5 — Documents and global search

### Scope

* Managed document copies
* External file references
* File categories
* Native open and reveal
* Missing-file detection
* Case-folder export
* Global search
* Arabic normalization
* Search-index rebuild

### Exit criteria

A lawyer can locate both records and document metadata from one search field.

---

## Phase 6 — Financial tracking

### Scope

* Fee agreement
* Transactions
* Payments
* Expenses
* Reversals
* Client summary
* Case summary
* Printable statement

### Exit criteria

The lawyer can answer:

* What was agreed?
* How much was received?
* What remains?
* Which expenses were paid?

---

## Phase 7 — Backup, restore and privacy tools

### Scope

* Encrypted backup archive
* Automatic backup
* Retention
* Validation
* Restore preview
* Atomic restore
* Complete export
* Client export
* Case export
* Permanent-deletion workflows
* Privacy screen
* Support bundle

### Exit criteria

No public beta is released until restore has been tested repeatedly on all target platforms.

---

## Phase 8 — Beta hardening

### Scope

* Bug fixing
* Performance
* Accessibility
* Arabic copy review
* Installer testing
* Data migration testing
* Security review
* Privacy legal review
* Failure-state review
* Backup disaster exercises

### Beta group

* 10–20 lawyers
* Mix of Windows versions
* At least two Mac users
* Different legal practice areas
* New and experienced lawyers

### Beta feedback categories

* Daily usefulness
* Confusing terminology
* Missing workflow steps
* Data-entry time
* Search quality
* Reminder reliability
* Backup understanding
* Stability
* Reasons for stopping use

---

## Phase 9 — Public release

### Requirements

* Signed Windows installer
* Signed and notarized macOS builds
* Public privacy notice
* Terms of use
* Backup guide
* Recovery guide
* Installation guide
* Update manifest
* Release notes
* Support process
* Export format documentation
* Public website
* Download checksums

---

# 19. Suggested branch sequence

```text
main
├── chore/project-bootstrap
├── spike/sqlcipher-cross-platform
├── feat/security-envelope
├── feat/database-migrations
├── feat/onboarding
├── feat/app-shell-rtl
├── feat/client-management
├── feat/case-management
├── feat/case-parties
├── feat/case-events
├── feat/task-management
├── feat/dashboard
├── feat/calendar
├── feat/native-reminders
├── feat/document-management
├── feat/global-search
├── feat/case-finances
├── feat/backup-create
├── feat/backup-restore
├── feat/privacy-exports
├── feat/application-updater
├── chore/windows-release
└── chore/macos-release
```

Branches should be short-lived. The list represents dependency order, not a requirement to keep long-running branches open.

---

# 25. Post-MVP roadmap

## Version 1.1

Only after version 1.0 usage proves demand:

* Printable hearing agenda
* Better document previews
* Import from CSV
* Improved case statements
* Configurable case statuses
* Additional Arabic report templates
* Optional encrypted document vault
* Better migration tools

## Version 1.2

Potential additions:

* Local document templates
* Microsoft Word template filling
* Calendar export
* More advanced finance summaries
* Optional encrypted external backup integration

## LegalMaster Firms

A separate product or deployment model:

* Centralized backend
* Multiple users
* Role-based access control
* Secretary restrictions
* Accountant restrictions
* Shared cases and calendars
* Audit logs
* Department access
* Approval workflows
* Managed backups
* Egyptian hosting where required
* Custom integrations
* LegalMaster Solo import

Do not gradually insert these features into LegalMaster Solo until it becomes another oversized system.

---

# 26. Immediate implementation order

Start in this exact order:

```text
1. Lawyer workflow interviews
2. Repository and documentation
3. SQLCipher Windows/macOS spike
4. Password and recovery-key design
5. Migration system
6. Verified backup and restore prototype
7. Onboarding and lock screen
8. Arabic RTL application shell
9. Clients
10. Cases and parties
11. Hearings and legal events
12. Tasks
13. Dashboard and calendar
14. Reminders
15. Documents
16. Global search
17. Financial tracking
18. Full backup and restore
19. Privacy and exports
20. Beta testing
21. Signed Windows release
22. Signed and notarized macOS release
```

The security, database and backup foundations must be proven before the application grows. This prevents LegalMaster Solo from repeating the principal mistake of the previous project: implementing a large feature surface before validating the deployment architecture.
