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

- How they identify tomorrow's hearings.
- How they record a hearing outcome.
- How they locate an old case.
- How they organize client files.
- How they track money.
- What information they write on paper.
- Which information they refuse to place online.
- What happens when a hearing is rescheduled.
- How they back up their current files.

### Deliverables

- Interview notes
- Workflow map
- Terminology glossary
- Final case fields
- Final event types
- Top five daily tasks
- Revised wireframes
- Confirmed product vocabulary

### Exit criteria

- At least five lawyers independently confirm the core workflow.
- No critical daily workflow is absent from the plan.
- Vocabulary is understandable without explanation.

---

## Phase 1 — Technical and security spike

**Status:** In progress

### Scope

- [x] Tauri 2 bootstrap
- [x] React/Vite bootstrap
- [x] SQLCipher build (local compile proof)
- [x] Rust database boundary
- [x] Password envelope
- [x] Recovery envelope
- [x] Migration system
- [~] Windows x86-64 native build workflow implemented; GitHub runner and device validation pending
- [~] macOS Intel native build workflow with ad-hoc signature verification implemented; runner and device validation pending
- [~] macOS Apple Silicon native build workflow with ad-hoc signature verification implemented; runner and device validation pending
- [~] Backup proof of concept — encrypted creation and validation implemented; restore remains

### Deliverable

A small application that can:

1. [x] Initialize an encrypted database.
2. [x] Insert a sample record.
3. [x] Close and reopen as an automated end-to-end test.
4. [x] Reopen with password.
5. [x] Reject wrong password.
6. [x] Change password.
7. [x] Recover using recovery key.
8. [x] Create and validate an encrypted backup.
9. [x] Restore.
10. [ ] Build on all target platforms.

`src-tauri/tests/spike_e2e.rs` proves items 1–9 as a single automated
end-to-end test against a real on-disk SQLCipher file (not `:memory:`),
including a byte-level check that no plaintext sample value appears in the
database file or the backup archive.

Item 10 (native builds on Windows, macOS Intel and macOS Apple Silicon) still
requires a real GitHub Actions run on those runners — the CI/CD matrix exists
in `.github/workflows/release.yml`, but a Linux development machine cannot
validate it locally. Tracked as a follow-up: trigger the release workflow and
confirm all three artifacts build and pass their verification steps.

### Exit criteria

No feature module begins until this phase passes. The security/database spike
(items 1–9) is proven by automated test; only cross-platform build validation
(item 10) remains before this phase fully passes.

---

## Phase 2 — Application foundation

**Status:** Complete

### Scope

- [x] Repository structure — Rust split into `commands/services/repositories/dto/db/security/backup/errors/state`; frontend split into `app/components/features/bridge/i18n/lib/styles`.
- [x] Tauri permissions — unchanged minimal capability set (`core:window:default`, `dialog:allow-open`, `dialog:allow-save`, `window-state:default`); no unrestricted filesystem or shell access added.
- [x] Error contract — `{ code, message, details }` preserved and extended (`details` now carries typed payloads such as duplicate-client candidates).
- [x] Logging — `tracing` + `tracing-appender` daily-rotating file log under `<app data dir>/logs/`; only version/OS/error codes/durations logged, never names, phones, case numbers, paths or secrets.
- [x] React providers — `TanStack Query` (`QueryClientProvider`) and `i18next` wired in `app/providers.tsx`.
- [x] Routing — `react-router-dom` route table in `app/router.tsx`.
- [x] RTL foundation — `document.dir`/`lang` now driven reactively by the active i18next language.
- [x] Design tokens — existing CSS custom properties (`--ink`, `--jade`, `--sand`, `--gold`, `--muted`, `--line`) kept; no visual redesign performed.
- [x] Main layout — `components/layout/Shell.tsx`.
- [x] Localization — `i18next`/`react-i18next` with `ar`/`en` resource files; all previously hardcoded Arabic strings extracted into translation keys.
- [x] Settings storage — unchanged SQLite-backed `app_settings`.
- [x] Onboarding — revised (deviation from `04-functional-modules.md` §8.1):
      rebuilt on `react-hook-form` + `zod`, and simplified to name + password
      only, with no mandatory backup step. A language toggle
      (`components/layout/LanguageSwitcher.tsx`) is available on every screen,
      including before setup, instead of a one-time language choice during
      onboarding. Manual backup creation, validation and restore moved to
      Settings → Backups (`src/features/backups/`), reusing the already-tested
      `backup_create`/`backup_validate`/`backup_restore` commands — this is a
      deliberate product decision that backups must never be a barrier to
      entry, and it also fixes a real bug where an install that got stuck on
      the old mandatory backup screen stayed stuck on every subsequent unlock.
- [x] Lock screen — unchanged flow, rebuilt on `react-hook-form` + `zod`.
- [x] Window state — unchanged plugin.
- [x] Single instance — unchanged plugin.

### Acceptance criteria

- [x] Application opens in Arabic RTL.
- [x] Onboarding completes (name + password only; reaching the dashboard
      never depends on backup creation).
- [x] Application locks and unlocks.
- [x] No direct SQL exists in frontend code (`grep -rn "SELECT\|INSERT\|UPDATE\|DELETE" src/` returns no matches).
- [x] No unrestricted frontend filesystem access exists (capabilities file unchanged from Phase 1).
- [x] CI validates Rust and TypeScript (`pnpm lint/typecheck/test/build`, `cargo fmt/clippy/test` all pass).

---

## Phase 3 — Clients and cases

**Status:** Complete

### Scope

- [x] Client schema and migrations — `clients`, `client_contacts` in `0003_clients_and_cases.sql`.
- [x] Client CRUD — `client_create/update/get/list/archive/restore/export`.
- [x] Client search — basic `search_index` + `search_global`/`search_rebuild_index`.
- [x] Duplicate warnings — phone/name match surfaced as `CLIENT_PROBABLE_DUPLICATE` with candidate list; UI requires explicit confirmation to proceed.
- [x] Case schema and migrations — `cases`, `case_parties` in the same migration.
- [x] Case CRUD — `case_create/update/get/list/archive/restore/export`.
- [x] Parties — `case_parties` (`OPPONENT`/`WITNESS`/`EXPERT`/`OTHER`) with add/update/remove commands.
- [x] Archiving — clients and cases both support archive/restore, excluded from default list filters, still directly retrievable and searchable.
- [x] Client and case detail screens — `ClientDetailPage`, `CaseDetailPage`.
- [x] Basic search index — denormalized `search_index` table, upserted in the same transaction as each write.

**Deviation from the original data model, by explicit product decision:** a
case may have more than one client. `cases` does **not** carry a singular
`client_id` foreign key. Instead a `case_clients(case_id, client_id,
is_primary)` join table (see [03-data-model.md](03-data-model.md)) records
every client on a case, with a partial unique index enforcing exactly one
primary client per case. `case_parties.role` no longer includes
`CLIENT`/`CO_CLIENT` — `case_clients` is now the single source of truth for
who is a client on a case, and `case_parties` is exclusively for opponents,
witnesses, experts and other non-client participants. Case-client
relationship changes are their own commands (`case_attach_client`,
`case_detach_client`, `case_set_primary_client`), with service-layer guards
against removing a case's only client or its primary client without
reassignment first.

### Exit criteria

A lawyer can maintain clients and cases without using another module. Backed
by `src-tauri/tests/clients_and_cases_repository.rs` (14 repository-level
tests covering CRUD, duplicate detection, foreign-key and partial-unique-index
enforcement, archiving, and search-index synchronization) plus the
`ClientListPage`/`ClientDetailPage`/`CaseListPage`/`CaseDetailPage` frontend
screens.

---

## Phase 4 — Events, calendar, tasks and dashboard

**Status:** In progress

### Scope

- [x] Case events — immutable schema, typed Rust commands, and calendar route.
- [x] Hearing workflow — completion records outcome/decision/next action and can create a copied next hearing or linked task in one transaction.
- [x] Event outcomes and next-hearing creation.
- [x] Personal tasks — create, update, complete, reopen, list, and date/status/priority filtering through the typed bridge.
- [x] Calendar — date-only agenda display with day/week/month/agenda view selection.
- [x] Dashboard — local daily events/tasks plus deterministic overdue-task and missing-hearing-outcome attention counts.
- [x] Overdue and missing-outcome logic, covered by repository-level validation.
- [ ] Native notifications.
- [ ] Optional autostart and tray behavior.

### Exit criteria

The application provides a useful daily agenda.

This is the first version suitable for a closely supervised lawyer alpha.

---

## Phase 5 — Documents and global search

**Status:** In progress

### Scope

- [x] Managed document copies — generated internal filenames in the local app-data document directory, checksum calculation, and SQLCipher metadata.
- [x] External file references — metadata only; application removal never deletes the source file.
- [x] File categories — constrained schema and typed metadata support.
- [ ] Native open and reveal.
- [x] Missing-file detection.
- [ ] Case-folder export.
- [x] Global search — grouped client, case, event, task, and document results with deep links.
- [x] Arabic normalization — diacritics, Alef variants, Arabic/Western digits, and whitespace normalization.
- [x] Search-index rebuild — now rebuilds clients, cases, events, tasks, and documents.

### Exit criteria

A lawyer can locate both records and document metadata from one search field.

---

## Phase 6 — Financial tracking

**Status:** In progress

### Scope

- [x] EGP-only fee-agreement schema and upsert command.
- [x] Transaction schema and typed commands for payments, expenses, refunds, other income, and other expenses.
- [x] Positive integer-minor-unit and EGP validation.
- [x] Linked compensating reversals; a transaction cannot be reversed twice.
- [x] Case/client summary commands.
- [x] Finance register with entry form, list, reversal action, and browser print action.
- [ ] Finance summaries embedded in client and case detail views.
- [ ] Complete date-filtered client statement with Arabic labels and print layout.

### Exit criteria

The lawyer can answer:

- What was agreed?
- How much was received?
- What remains?
- Which expenses were paid?

---

## Phase 7 — Backup, restore and privacy tools

**Status:** In progress

### Scope

- [x] Encrypted archive containing the SQLCipher database, managed documents, manifest, and per-file SHA-256 checksums.
- [x] Archive validation rejects malformed manifests, missing checksum entries, and checksum mismatches.
- [x] Restore validates before mutation and restores managed documents alongside the database, with rollback for document replacement failures.
- [ ] Portable cross-device restore using the original application password.
- [ ] Automatic backups, retention, settings, and `backup_history`.
- [ ] Restore preview and whole-vault atomic swap.
- [ ] Complete, client, and case exports in the documented CSV/manifest format.
- [ ] Permanent-deletion workflows and full application-data deletion.
- [ ] Privacy screen and manually generated redacted support bundle.

### Exit criteria

No public beta is released until restore has been tested repeatedly on all target platforms.

---

## Phase 8 — Beta hardening

### Scope

- Bug fixing
- Performance
- Accessibility
- Arabic copy review
- Installer testing
- Data migration testing
- Security review
- Privacy legal review
- Failure-state review
- Backup disaster exercises

### Beta group

- 10–20 lawyers
- Mix of Windows versions
- At least two Mac users
- Different legal practice areas
- New and experienced lawyers

### Beta feedback categories

- Daily usefulness
- Confusing terminology
- Missing workflow steps
- Data-entry time
- Search quality
- Reminder reliability
- Backup understanding
- Stability
- Reasons for stopping use

---

## Phase 9 — Public release

### Requirements

- Signed Windows installer
- Signed and notarized macOS builds
- Public privacy notice
- Terms of use
- Backup guide
- Recovery guide
- Installation guide
- Update manifest
- Release notes
- Support process
- Export format documentation
- Public website
- Download checksums

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

- Printable hearing agenda
- Better document previews
- Import from CSV
- Improved case statements
- Configurable case statuses
- Additional Arabic report templates
- Optional encrypted document vault
- Better migration tools

## Version 1.2

Potential additions:

- Local document templates
- Microsoft Word template filling
- Calendar export
- More advanced finance summaries
- Optional encrypted external backup integration

## LegalMaster Firms

A separate product or deployment model:

- Centralized backend
- Multiple users
- Role-based access control
- Secretary restrictions
- Accountant restrictions
- Shared cases and calendars
- Audit logs
- Department access
- Approval workflows
- Managed backups
- Egyptian hosting where required
- Custom integrations
- LegalMaster Solo import

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
