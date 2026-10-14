# Form inventory

This inventory describes the user-facing data-entry, access, and settings forms currently rendered by the application. Create and edit variants that share a component are listed once. Required fields are marked **required**; all others are optional unless stated otherwise.

## Access and vault

### Initial vault setup

- Lawyer full name — **required**
- Password — **required**, at least 12 characters
- Password confirmation — **required**, must match the password

The language switcher is available before setup. The recovery-key step requires
acknowledgment that the key has been saved before entering the workspace.

**Code evidence:** [OnboardingPage.tsx](../src/features/onboarding/pages/OnboardingPage.tsx) (`SetupForm`)

### Unlock vault

- Password — **required**, at least 12 characters

**Code evidence:** [OnboardingPage.tsx](../src/features/onboarding/pages/OnboardingPage.tsx) (`UnlockForm`)

### Recover vault access

- Recovery key — **required**
- New password — **required**, at least 12 characters
- Password confirmation — **required**, must match the new password

**Code evidence:** [OnboardingPage.tsx](../src/features/onboarding/pages/OnboardingPage.tsx) (`RecoveryForm`)

## Core records

### Client

- Internal number — **required**
- Full name — **required**
- National ID
- Primary phone
- Email
- Address
- Notes

**Code evidence:** [ClientForm.tsx](../src/features/clients/forms/ClientForm.tsx)

### Case

- Internal number — **required**
- Official case number
- Judicial year
- Status
- Court name
- Circuit name
- Case type
- Litigation degree
- Filing date
- Closing date
- Subject / summary
- Notes
- Linked clients — at least one is **required**; searchable multi-selection stores IDs

**Code evidence:** [CaseCreateForm.tsx](../src/features/cases/forms/CaseCreateForm.tsx), [CaseEditForm.tsx](../src/features/cases/forms/CaseEditForm.tsx), and [CaseCoreFields.tsx](../src/features/cases/forms/CaseCoreFields.tsx)

### Case opponent

- Opponent full name — **required**
- Legal capacity
- Lawyer name
- Phone
- Address
- Notes

**Code evidence:** [CasePartiesPanel.tsx](../src/features/cases/components/CasePartiesPanel.tsx) (`OpponentForm`)

### Case fee agreement

- Agreed fee amount in EGP — a positive amount is required to save

**Code evidence:** [CaseDetailPage.tsx](../src/features/cases/pages/CaseDetailPage.tsx)

### Power of attorney

- Internal sequence — **required**
- Official power-of-attorney number
- Issue date
- Notary office
- Notes
- Linked clients — select existing clients or add a new client inline; a newly created client is selected automatically
- Named lawyers — zero or more entries, each with:
  - Full name
  - Bar number
  - Notes

**Code evidence:** [PowerOfAttorneyForm.tsx](../src/features/powersOfAttorney/components/PowerOfAttorneyForm.tsx) and [ClientForm.tsx](../src/features/clients/forms/ClientForm.tsx)

## Schedule and tasks

### Hearing

- Case — **required**
- Date — **required**
- Time
- Hearing type
- Location or court
- Circuit
- Required documents
- Notes

**Code evidence:** [AgendaPage.tsx](../src/features/hearings/pages/AgendaPage.tsx) (`HearingForm`)

### Hearing decision

- Decision text
- Next-hearing date

Choosing a next-hearing date creates a follow-up hearing using the current hearing's core details; it can later be edited independently.

**Code evidence:** [AgendaPage.tsx](../src/features/hearings/pages/AgendaPage.tsx) (`DecisionForm`)

### Task

- Title — **required**
- Due date — **required**
- Linked case
- Linked client
- Details
- Notes

Existing tasks also expose a complete/reopen status action.
The case and client links are mutually exclusive.

**Code evidence:** [TasksPage.tsx](../src/features/tasks/pages/TasksPage.tsx) (`TaskForm`)

## Financial records

### Payment

- Case — **required**
- Paying client — **required** and limited to clients linked to the selected case
- Amount in EGP — **required**, positive
- Payment date — **required**
- Payment method
- Notes

**Code evidence:** [FinancesPage.tsx](../src/features/finances/pages/FinancesPage.tsx) (`PaymentForm`)

### Expense

- Amount in EGP — **required**, positive
- Date — **required**
- Expense type — **required**
- Linked case
- Linked client
- Notes

An expense can have neither a linked case nor a linked client.
It cannot have both links.

**Code evidence:** [FinancesPage.tsx](../src/features/finances/pages/FinancesPage.tsx) (`ExpenseForm`)

## Documents

### Attachment

- Local file selected through the native picker — **required** when adding an attachment
- Category
- Description
- Document date

Editing an attachment changes only its category, description, and document date.

**Code evidence:** [AttachmentPanel.tsx](../src/features/documents/components/AttachmentPanel.tsx)

## Settings

### Lawyer profile

- Lawyer name — **required**
- Bar number
- Phone
- Office address

**Code evidence:** [SettingsPage.tsx](../src/features/settings/pages/SettingsPage.tsx) (profile section)

### Display and calendar

- Language
- Theme
- Date format
- Week-start day

**Code evidence:** [SettingsPage.tsx](../src/features/settings/pages/SettingsPage.tsx) (general section)

### Security

- Auto-lock timeout
- Password change:
  - Current password — **required**
  - New password — **required**, at least 12 characters
  - Password confirmation — **required** and must match the new password

**Code evidence:** [SettingsPage.tsx](../src/features/settings/pages/SettingsPage.tsx) (security section)

### Recovery key replacement

- Current password — **required** to replace the recovery key
- Completion action after viewing/saving the replacement key

**Code evidence:** [RecoveryKeySection.tsx](../src/features/settings/components/RecoveryKeySection.tsx)

### Backup validation and restoration

- Backup file selected through the native picker — **required**
- Authentication method: password or recovery key, when the active vault key cannot prepare the archive
- Backup password or recovery key — **required** when authenticating explicitly
- Recovery restore: new password and matching confirmation — **required**, at least 12 characters
- Prepared preview and explicit replacement confirmation for restore

Validation and cancellation do not replace the workspace. Restore preparation,
authentication and confirmation are shared by setup, Backups and Settings.

**Code evidence:** [RestoreFromBackup.tsx](../src/features/backups/components/RestoreFromBackup.tsx)

Notifications, reminder lead time and autostart have been removed. Local usage
counter consent is backend-only and has no current settings form.

## Other interactive controls

The application also has non-data-entry controls: global search; client, case, and power-of-attorney archive filters; task and finance case/client filters; agenda date/view selection; and backup create, validate, and restore confirmation.

## Shared controls and case relationship editor (2026-10-08)

Data-entry forms use React Hook Form, Zod, and official Field/FieldGroup
compositions. Failed saves retain drafts; duplicate submissions and portal child
submissions are isolated by DraftForm. FormDialog provides size variants,
scrolling, and a persistent action footer.

Case Parties → Clients in this case → Edit exposes linked client chips and each
relationship's legal capacity and notes; the client's POA is shown read-only. Archived
retained relationships remain visible; new archived clients cannot be added.
Removing a payer fails without changing stored links. Relationship edits use
`case_set_clients`, independently from the core case form.

POA creation lives at `/powers-of-attorney/new`; editing uses a large FormDialog.
Case and POA client pickers search names, internal numbers, and phones. Inline
creation prefills the typed name, supports duplicate confirmation, selects the
created client, and leaves the parent draft intact on failure or cancellation.

Date fields use Calendar/Popover with month/year selection, Today, optional
Clear, accessible full date labels, Western-digit output, and Arabic-digit input.
TimeField suggests 15-minute intervals and accepts exact `HH:mm`. AmountInput
shows EGP and parses decimal text to integer minor units at submission.
Court, circuit, case/hearing type, notary, and legal capacity use free-text
comboboxes with suggestions from existing records. Reminder and lock presets
retain saved custom values.
