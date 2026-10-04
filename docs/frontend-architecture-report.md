# LegalMaster Solo frontend architecture report

**Date:** 2026-09-05  
**Scope:** Current React/TypeScript frontend as implemented in `src/`. This is
an implementation report, not a claim that all public-beta requirements are
complete.

## 1. Purpose and trust boundary

LegalMaster Solo is a local, offline-first desktop application. The frontend
is a React application rendered by Tauri in a desktop WebView. It presents
workflows, collects user input, manages transient UI state, and requests typed
operations from Rust.

It is deliberately **not** a database or filesystem client. The frontend has
no SQLite client, SQL statements, general HTTP client, shell execution, or
arbitrary filesystem access. Rust owns SQLCipher access, business-rule
validation, transactions, encryption, native dialogs, managed-file operations,
backups, and native opening/reveal operations.

```text
React pages and components
        |
        | typed Tauri invoke calls
        v
src/bridge/commands.ts
        |
        v
Rust Tauri commands, services, and repositories
        |
        +--> SQLCipher/SQLite vault
        +--> managed attachment directory
        +--> narrow native integrations
```

The Tauri capability configuration grants the renderer only core window,
notification-permission, and window-state operations. File selection/opening,
autostart, and database work are performed by narrow Rust command paths.

## 2. Build and application startup

### Build model

Vite compiles and bundles the TypeScript/React application into static assets.
Tauri packages those assets and loads them in a native WebView for production.
There is no Node.js application server in the product.

Development uses `pnpm dev` for the Vite development server and `pnpm tauri
dev` to run the desktop shell against it. Production uses the built `dist/`
assets configured in `src-tauri/tauri.conf.json`.

### Entry point

`src/main.tsx` finds the root element and renders `<App />` inside React Strict
Mode. Strict Mode helps find unsafe effects in development; it does not change
the production rendering model.

`src/app/providers.tsx` installs the global TanStack Query provider and imports
the i18n setup before children render.

### Initial vault gate

`src/app/App.tsx` first obtains `app_get_status` through the typed bridge. Its
result has two booleans:

| Vault status               | UI shown                         |
| -------------------------- | -------------------------------- |
| Not initialized            | Setup/onboarding form            |
| Initialized and locked     | Password unlock form             |
| Recovery selected          | Recovery-key/password reset form |
| New vault just initialized | One-time recovery-key display    |
| Initialized and unlocked   | Main shell and routed workspace  |

The main shell is not rendered while the vault is locked. This prevents pages
from issuing their normal domain queries before a successful unlock.

## 3. Typed bridge and error boundary

The bridge has three layers:

1. `src/bridge/types.ts` defines serializable TypeScript DTOs, inputs, status
   shapes, and stable error-code types.
2. `src/bridge/commands.ts` exposes named domain operations such as
   `clientCreate`, `hearingRecordDecision`, `attachmentAdd`, and
   `restoreBackup`.
3. `src/bridge/invoke.ts` calls Tauri's `invoke` API and forwards failures to
   development-only safe diagnostics.

The frontend sends inputs using the exact Rust command and argument names. For
example, `bridge.clientCreate(input)` invokes `client_create` with `{ input }`.
Rust deserializes the input, checks that the vault is unlocked where needed,
performs validation and persistence, and returns a DTO or stable error.

`src/bridge/errors.ts` accepts only recognized stable error codes before using
their safe message. Unknown values fall back to a generic user-visible error.
This avoids rendering arbitrary native error strings that could contain paths,
database details, or private record content.

Development diagnostics require both a development build and
`VITE_DETAILED_DIAGNOSTICS=true`. They contain only the command name, stable
code, and Rust allow-listed diagnostic detail.

## 4. Routing and workspace shell

`src/app/router.tsx` defines the workspace routes. `Shell` wraps the router
once the vault is unlocked.

| Route                     | Page            | Primary capabilities                                                          |
| ------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `/`                       | Today dashboard | Today’s hearings/tasks, overdue tasks, upcoming hearings, quick actions       |
| `/calendar`               | Agenda          | Month/week/list hearing views and hearing workflows                           |
| `/clients`                | Client list     | Search/filter, archive state, open/create clients                             |
| `/clients/new`            | New client      | Create a client and handle probable duplicates                                |
| `/clients/:id`            | Client detail   | Summary, linked records, attachments, account, edit/archive/restore/export    |
| `/powers-of-attorney`     | POA list        | List, search, create, archive/restore POAs                                    |
| `/powers-of-attorney/:id` | POA detail      | Clients, lawyers, linked cases, attachments, edit/archive/restore             |
| `/cases`                  | Case list       | Search/filter by status/client/archive state                                  |
| `/cases/new`              | New case        | Create canonical case and client relationships                                |
| `/cases/:id`              | Case detail     | Summary, parties, hearings, tasks, attachments, account, edit/archive/restore |
| `/tasks`                  | Tasks           | Derived views and task create/edit/complete/reopen/delete workflows           |
| `/finances`               | Finance         | Payments, expenses, filtering, add/edit workflows                             |
| `/attachments`            | Attachment page | Managed attachment listing and operations                                     |
| `/backups`                | Backup page     | Create, validate, and restore backups                                         |
| `/settings`               | Settings        | Profile, preferences, security, privacy, backup, and about controls           |

### Shell behavior

`src/components/layout/Shell.tsx` provides:

- right-side primary navigation in Arabic RTL layouts;
- a responsive drawer with keyboard focus containment on smaller screens;
- global search;
- quick-create links for clients, cases, hearings, and tasks;
- language switching;
- manual lock actions;
- inactivity locking based on the saved lock timeout.

The shell supports Escape to close menus/drawers, returns focus to the opening
button where appropriate, and implements arrow/Home/End movement in the
quick-create menu.

## 5. Localization, RTL, and presentation rules

`src/i18n/index.ts` installs Arabic and English resource files from
`src/i18n/ar/common.json` and `src/i18n/en/common.json`. Arabic is the default
and fallback language.

On every language change, `applyDocumentDirection` updates both `lang` and
`dir` on the root HTML element:

```text
Arabic  -> lang="ar", dir="rtl"
English -> lang="en", dir="ltr"
```

The language switcher changes the live UI immediately and persists the choice
through `settings_update` after the vault is available.

The component and page code uses `<bdi>` around values whose visual direction
must remain stable inside Arabic content: dates, internal identifiers, money,
phones, filenames, and versions. Shared CSS lives in `src/styles/styles.css`
and supplies the desktop shell, responsive drawer, cards, tables, dialogs,
focus styles, and RTL-aware layout behavior.

Legal date-only values stay as `YYYY-MM-DD` strings. `src/lib/dateOnly.ts`
creates today's date from local calendar components rather than converting it
through UTC. Money is displayed as EGP but submitted to Rust as integer
piastres/minor units.

## 6. Data fetching and cache lifecycle

The frontend treats Rust commands as a local typed API and uses TanStack Query
for data reads and writes.

### Query client defaults

`src/lib/queryClient.ts` configures queries with:

- no automatic retry;
- no refetch solely because the window gains focus.

This is important for an encrypted vault: a locked-vault response should be
handled explicitly rather than retried in the background.

### Query keys

`src/lib/queryKeys.ts` is the single catalog of cache keys. It defines stable
keys for status, settings, profile, lists, detail records, account summaries,
attachments, finance, agenda, Today, and search. Feature code does not invent
ad-hoc key arrays.

Examples:

```text
['clients', 'list', filters]
['cases', caseId]
['tasks', 'list', filters]
['payments', 'list', filters]
['today', 'summary', date]
```

### Queries

Feature API modules expose hooks such as `useClientList`, `useCase`,
`useHearings`, `useTaskList`, and `useAttachments`. Pages use the hook data to
render loading, empty, success, and failure states.

Settings and profile queries are explicitly enabled only when the status query
reports that the vault is unlocked. This prevents a locked-vault query failure
from poisoning the cache before the user unlocks.

### Mutations and invalidation

After a successful write, the feature hook either updates the exact DTO cache
or invalidates affected views. `src/lib/queryInvalidation.ts` centralizes
cross-domain rules. For example:

- task changes refresh task lists, Today, agenda, and affected client/case
  detail data;
- hearing changes refresh hearings, Today, agenda, and the case summary;
- payment changes refresh payments and related case/client account summaries;
- attachments refresh attachment lists and affected owner details;
- POA or case-client relationship changes refresh linked POA, case, client,
  and search data.

Restore is special: after Rust replaces the vault and locks it, the restore
mutation clears the entire cache and refetches app status before any previous
record can render.

## 7. Forms and validation model

The frontend performs usability validation but does not act as the business
authority.

- Onboarding, client, case, and settings forms use React Hook Form and Zod
  schemas.
- Focused dialogs and simple editors also use local React state where that is
  clearer.
- Rust validates every submitted input again before persistence.

Examples of frontend assistance:

- client creation handles `CLIENT_PROBABLE_DUPLICATE` by showing candidates and
  allowing an explicit confirm action;
- a case form requires one or more client relationships;
- finance forms accept decimal EGP input and convert it safely to integer minor
  units;
- payment forms load the selected case and show only that case's linked clients
  as possible payers;
- date fields use native date controls but Rust also rejects invalid dates.

## 8. Feature modules

### Today, Agenda, hearings, and reminders

The dashboard uses the current local date to request a summary of hearings,
tasks, overdue tasks, and upcoming hearings. The agenda offers month, week,
and list views over date-only hearing data.

Hearing workflows create/edit a case-scoped hearing, record a decision, and
can request creation of a separately editable next hearing linked to the
completed source hearing. They can also delete hearings where allowed.

While unlocked, `ReminderSync` in `App.tsx` checks native notification
permission and asks Rust to refresh due reminders on mount, every minute, and
when the document becomes visible. Rust generates privacy-safe notification
copy.

### Clients and powers of attorney

Client pages manage canonical client identity/contact fields, duplicates,
archive/restore, client relationships, account summary, managed attachments,
and the current JSON client export.

POA pages manage an internal sequence, optional official number/date/notary
details, multiple client relationships, descriptive lawyer rows, linked cases,
attachments, and archive/restore behavior.

### Cases

Case pages manage internal/official identifiers, court/circuit/type/litigation
data, status, date-only fields, subject/notes, one or more clients, legal
capacity, optional client-owned POA references, and lightweight opponents.

The detail page organizes related workflows into summary/edit, client/party,
hearing, task, attachment, and account views. It does not expose a generic
party or event model.

### Tasks

Tasks have title, details, notes, a required due date, optional client/case
links, optional reminder minutes, and a completed checkbox. The frontend
presents derived Today, Overdue, Upcoming, Completed, and All views. It has no
task priority, assignee, time-of-day, or cancellation workflow.

### Finance

The finance page separates payments from expenses. A payment must choose a
case and a payer among that case's clients. An expense can be associated with
neither, either, or both a client and case. The frontend displays EGP amounts,
but its bridge contract uses integer minor units. Case/account screens display
fee agreement, received amount, outstanding amount, expenses, and net cash.

### Attachments

Attachment management is a managed-copy workflow:

```text
React asks Rust to open the native picker
  -> Rust stores the selected path internally
  -> React receives source token and safe filename
  -> React submits token plus owner/category/metadata
  -> Rust copies, hashes, stores metadata, and returns attachment DTO
```

React receives no absolute source path. It can list attachments and request
metadata updates, open, reveal, or removal by attachment ID only. Each add
request supplies exactly one owner: client, case, POA, or expense.

### Backups

The backup page invokes Rust to create an encrypted manual backup in the
application backup directory, validate a user-selected archive, or restore one
after a two-step confirmation. The page can display metadata for the latest
successful backup but does not receive destination paths.

### Settings

Settings cover lawyer profile; Arabic/English; theme; date format; first day of
week; default reminder lead time; lock timeout; password change; autostart;
notification permission; local aggregate counter consent; privacy/data-location
information; backup controls; and About/version content.

## 9. Locking and sensitive UI state

The frontend exposes manual lock controls and configures an inactivity timer
from the saved setting. It unmounts the main shell once the status query reports
that Rust has locked the vault. Rust zeroizes its in-memory master key.

There are active review findings in `docs/review-2026-09-05.md` that affect
this area:

1. Ordinary lock currently invalidates only app status; it does not clear all
   data-bearing TanStack Query records from the renderer heap.
2. The visibility-change approach does not guarantee a lock on every device
   sleep/resume event.
3. Pending attachment source tokens are not cleared on lock and the picker
   command is not first guarded by an unlock check.

These are documented risks, not completed behavior.

## 10. Accessibility and interaction conventions

The shared UI includes visible focus treatment, semantic buttons, dialogs,
tabs, menu roles, labels, keyboard navigation, Escape behavior, and focus
return/containment in relevant overlays. Tests cover representative keyboard
and RTL/mixed-direction behaviors.

The responsive mobile drawer acts as an accessible modal dialog. Its Tab/Shift
Tab handling keeps focus inside the drawer until it is dismissed.

## 11. Development-only support

The optional demo seeder runs only when both conditions hold:

- the build is a Vite development build;
- `VITE_SEED_DEMO_DATA=true` is set.

It seeds only an unlocked, empty development vault by calling the same typed
bridge commands used by the real UI. It does not open SQLite from React and it
does not create attachments.

## 12. Automated frontend coverage

Vitest and React Testing Library cover bridge contracts, safe diagnostic
mapping, date-only formatting, query invalidation, onboarding gates, forms,
dialogs, task interaction, finance payer filtering, optional expenses, and
RTL-related rendering behavior.

The 2026-09-05 review run passed frontend lint, typecheck, 37 tests across 13
test files, and the production frontend build. The build emitted a 556.05 kB
minified JavaScript chunk warning; code splitting should be considered during
performance hardening.

## 13. Important non-goals and product gaps

The frontend intentionally does not provide cloud accounts, multi-user roles,
generic parties/events/transactions, a browser document preview, arbitrary
file paths, a generic filesystem browser, or a web API server.

Current public-beta blockers outside the frontend's delivered workflows
include seeded visual sign-off at the target viewports, portable cross-device
restore validation, automatic backup/retention/history, restore preview,
complete documented exports, permanent deletion flows, a redacted support
bundle, physical Windows/macOS validation, and privacy legal review.
