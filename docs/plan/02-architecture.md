# Architecture

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 5. Technical architecture

## 5.1 High-level architecture

```text
┌─────────────────────────────────────────┐
│              React UI                   │
│                                         │
│ Routes, forms, tables, calendar, RTL    │
└────────────────────┬────────────────────┘
                     │ Typed Tauri commands
                     ▼
┌─────────────────────────────────────────┐
│          Rust application layer         │
│                                         │
│ Commands → Services → Repositories      │
│ Security → Documents → Backup           │
│ Notifications → Search → Migrations     │
└───────────────┬──────────────┬──────────┘
                │              │
                ▼              ▼
       SQLCipher/SQLite   Managed file directory
```

Tauri uses a Rust process with a webview-based frontend and message passing between them. It supports Windows and macOS without requiring the application to bundle a separate browser or Node.js runtime.

SQLite is appropriate as an application file format for desktop and record-management software and does not require a separate database server.

## 5.2 Explicitly prohibited architecture

The desktop application must not contain:

```text
Node.js backend
Express
Fastify
NestJS
PostgreSQL
Prisma
Docker
Redis
Background worker service
Local HTTP server
Vector database
Python runtime
OCR runtime
Embedded LLM
Browser-accessible database
```

## 5.3 Database access decision

Do not use the Tauri SQL plugin directly from React.

Although the official Tauri SQL plugin supports SQLite, it exposes a frontend-to-database interface through `sqlx`. LegalMaster should instead have a strict Rust application boundary, and React should invoke domain commands such as `create_case`, not execute SQL statements.

Use:

```text
React
  → typed Tauri command
    → Rust service
      → Rust repository
        → rusqlite
          → SQLCipher database
```

`rusqlite` currently provides build features for bundled SQLCipher with vendored OpenSSL, which makes it a viable candidate for cross-platform encrypted SQLite packaging. This must still be proven through an early Windows and macOS build spike before the rest of the application depends on it.

## 5.4 Recommended technology stack

### Desktop shell

* Tauri 2
* Rust stable
* Tauri capabilities and permissions
* Native updater
* Native notifications
* Native file dialogs
* Native opener
* Single-instance plugin
* Optional autostart plugin
* Window-state plugin


### Frontend

* React
* TypeScript
* Vite
* React Router
* TanStack Query
* React Hook Form
* Zod
* Tailwind CSS
* Radix UI or shadcn/ui
* TanStack Table
* date-fns
* i18next or an equivalent localization layer

### Rust

* `rusqlite`
* SQLCipher feature
* `serde`
* `serde_json`
* `uuid`
* `chrono` or `time`
* `thiserror`
* `tracing`
* `argon2`
* `chacha20poly1305`
* `rand`
* `sha2`
* `zip` or equivalent archive library
* Tauri official plugins where appropriate

Dependencies must be pinned through lockfiles.

---

# 6. Repository structure

Use a single repository and a single desktop application. A monorepo is unnecessary.

```text
legalmaster-solo/
├── .github/
│   ├── workflows/
│   │   ├── validate.yml
│   │   ├── build-windows.yml
│   │   ├── build-macos.yml
│   │   └── release.yml
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
│
├── docs/
│   ├── PROJECT_PLAN.md
│   ├── PRODUCT_REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── SECURITY.md
│   ├── PRIVACY.md
│   ├── BACKUP_FORMAT.md
│   ├── RELEASE_PROCESS.md
│   ├── TESTING.md
│   └── adr/
│       ├── 001-tauri-desktop.md
│       ├── 002-rust-database-boundary.md
│       ├── 003-sqlcipher.md
│       ├── 004-local-only-network-policy.md
│       └── 005-managed-documents.md
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── forms/
│   │   ├── layout/
│   │   ├── feedback/
│   │   └── data-display/
│   ├── features/
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── cases/
│   │   ├── events/
│   │   ├── tasks/
│   │   ├── documents/
│   │   ├── finances/
│   │   ├── search/
│   │   ├── backups/
│   │   └── settings/
│   ├── bridge/
│   │   ├── invoke.ts
│   │   ├── commands.ts
│   │   ├── errors.ts
│   │   └── types.ts
│   ├── i18n/
│   │   ├── ar/
│   │   └── en/
│   ├── lib/
│   ├── styles/
│   └── test/
│
├── src-tauri/
│   ├── capabilities/
│   │   └── main.json
│   ├── migrations/
│   │   ├── 0001_initial.sql
│   │   └── 0002_*.sql
│   ├── src/
│   │   ├── commands/
│   │   ├── domain/
│   │   ├── dto/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── db/
│   │   ├── security/
│   │   ├── backup/
│   │   ├── documents/
│   │   ├── notifications/
│   │   ├── search/
│   │   ├── errors/
│   │   ├── state.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── AGENTS.md
├── CONTRIBUTING.md
├── package.json
├── pnpm-lock.yaml
└── README.md
```

---

# 10. Rust application design

## 10.1 Layering

```text
Tauri command
    ↓
Application service
    ↓
Repository or infrastructure service
    ↓
Database/filesystem/operating system
```

### Commands

Commands are responsible for:

* Input deserialization
* Authentication/unlock check
* Calling one application service
* Returning a stable DTO or stable error

Commands must not contain SQL.

### Services

Services are responsible for:

* Business rules
* Transactions
* Cross-repository operations
* File/database consistency
* Search-index updates
* Activity records

### Repositories

Repositories are responsible for:

* SQL
* Row mapping
* Query composition
* Database persistence

Repositories must not know about React or Tauri windows.

## 10.2 Command naming

```text
app_get_status
app_initialize
app_unlock
app_lock
app_change_password
app_recover_access

dashboard_get_summary

client_create
client_update
client_get
client_list
client_archive
client_restore
client_export

case_create
case_update
case_get
case_list
case_archive
case_restore
case_export

event_create
event_update
event_complete
event_get
event_list
event_delete

task_create
task_update
task_complete
task_reopen
task_list
task_delete

document_import_managed
document_add_reference
document_open
document_reveal
document_update
document_remove
document_check_missing

finance_set_fee_agreement
finance_add_transaction
finance_reverse_transaction
finance_list_transactions
finance_get_case_summary
finance_get_client_summary

search_global
search_rebuild_index

backup_create
backup_validate
backup_preview_restore
backup_restore
backup_list_history

settings_get
settings_update
```

## 10.3 Error contract

Return stable machine-readable errors:

```json
{
  "code": "CLIENT_NOT_FOUND",
  "message": "Safe user-facing fallback",
  "details": null
}
```

Examples:

```text
APP_LOCKED
INVALID_PASSWORD
RECOVERY_KEY_INVALID
DATABASE_OPEN_FAILED
DATABASE_MIGRATION_FAILED
CLIENT_NOT_FOUND
CASE_NOT_FOUND
VALIDATION_FAILED
DOCUMENT_SOURCE_MISSING
DOCUMENT_COPY_FAILED
BACKUP_DESTINATION_UNAVAILABLE
BACKUP_CORRUPTED
RESTORE_INCOMPATIBLE
PERMISSION_DENIED
```

Do not expose raw SQL, paths containing personal names or Rust stack traces to the UI.

---

# 13. Frontend engineering standards

## 13.1 Feature structure

Each frontend feature should contain:

```text
feature/
├── api/
├── components/
├── forms/
├── pages/
├── schemas/
├── hooks/
├── types/
└── tests/
```

## 13.2 State management

* TanStack Query for Tauri command results and cache invalidation.
* React Hook Form for forms.
* Zod for frontend validation.
* Local component state for transient UI.
* A small store only for global UI state such as sidebar and theme.
* No Redux unless future complexity demonstrates a specific need.

The database remains the source of truth.

## 13.3 Forms

Every form must:

* Validate before submission.
* Preserve entered values when a save fails.
* Disable duplicate submission.
* Show field-specific errors.
* Warn before abandoning unsaved changes.
* Support Arabic text naturally.
* Use proper labels and keyboard focus.
* Avoid enormous all-in-one forms.

## 13.4 Accessibility

Minimum requirements:

* Complete keyboard navigation.
* Visible focus state.
* Semantic labels.
* Sufficient contrast.
* Screen-reader-friendly dialogs.
* No color-only status communication.
* Correct RTL layout without reversing numeric data incorrectly.

---

# 17. Performance and quality targets

These are engineering targets, not marketing guarantees.

## Application

* Installer target below 100 MB.
* No bundled Node.js, PostgreSQL or Python runtime.
* Main window visible within approximately three seconds on supported test hardware.
* No background CPU consumption while idle beyond reminder scheduling.
* Common list and detail operations should feel immediate.
* Search should remain usable with at least:

  * 10,000 clients
  * 20,000 cases
  * 100,000 events
  * 100,000 document metadata records

## Reliability

* Database foreign keys enabled.
* Writes performed through transactions.
* Files copied atomically.
* Backups validated after creation.
* Restore never destroys the current installation before validation.
* Application update creates a pre-migration backup.
* Unexpected process termination must not corrupt valid committed records.

---

# 27. Final architecture summary

```text
LegalMaster Solo
├── Tauri 2 desktop shell
├── React + TypeScript Arabic RTL UI
├── Narrow typed Tauri commands
├── Rust domain and application services
├── rusqlite + SQLCipher
├── Local managed-document directory
├── Native desktop reminders
├── Encrypted portable backups
├── Signed offline-capable updates
└── No server, cloud database or AI runtime
```

The project must remain a focused personal legal organizer. Its value comes from reliability, privacy, Arabic usability and accurate daily workflow—not from the number of technologies or features included.
