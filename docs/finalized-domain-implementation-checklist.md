# Finalized-domain implementation checklist

Status: Phase 0 complete; Phase 1 schema complete; Phase 2 POA/hearing/reminder/search
slices complete; Phase 3 POA/hearing bridge slices complete; Phase 4 shared
shell/primitives complete. This is an implementation
inventory for [`finalized-domain-correction-plan.md`](finalized-domain-correction-plan.md),
not a replacement for the active product plan.

## Baseline and compatibility audit — 2026-08-24

- `pnpm test`: passed (14 tests).
- `pnpm typecheck` and `pnpm lint`: passed.
- `cargo test`: passed before the schema correction (40 tests).
- The repository has no Git tags, remotes, release bundles, distribution
  history, or encrypted-vault fixtures. There is therefore no source-controlled
  evidence of a persisted-vault compatibility obligation.
- The active plan nevertheless describes a supervised alpha. Migration 0007
  is immutable and forward-only. It replaces the empty experimental baseline;
  its Rust preflight returns `LEGACY_DATA_MIGRATION_REQUIRED` without changing
  the schema when legacy domain rows exist. A real alpha vault must receive an
  explicitly scoped record/file conversion before it can be upgraded.
- `app_metadata` now contains installation data only. `schema_migrations` is
  the sole schema-version authority; migration 0007 backfills version 1 because
  historical databases recorded versions 2–6 only.

## Current-contract inventory

| Area              | Current contract to replace in Phase 2/3                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust commands     | `client_*`, `case_*`, `event_*`, `task_*`, `document_*`, `finance_*`, `search_*`, `dashboard_get_summary`, `reminders_refresh`, settings and backup commands                                                      |
| Rust repositories | `client`, `case`, `event`, `task`, `document`, `finance`, `search`, `reminder`, and `settings` repositories use the legacy tables                                                                                 |
| DTO/bridge        | `ClientDto` exposes client type/organization fields; `CaseDto` exposes one generic number and global legal capacity; events, documents, financial transactions, and priority/status tasks are legacy abstractions |
| Query keys        | `clients`, `cases`, `events`, `tasks`, `documents`, `finances`, `dashboard`, `search`, `profile`, and `settings`                                                                                                  |
| Existing routes   | `/`, `/calendar`, `/clients`, `/clients/new`, `/clients/:id`, `/cases`, `/cases/new`, `/cases/:id`, `/tasks`, `/documents`, `/finances`, `/backups`, `/settings`                                                  |

The detailed table-consumer scan found the legacy tables are used only by Rust
and typed bridge/frontend consumers; React contains no direct SQL access.
`open_db` already enables `PRAGMA foreign_keys = ON` for every SQLCipher
connection. The canonical migration also depends on that pragma in its schema
tests.

## Canonical schema decisions

- All domain tables are `STRICT`, carry non-null text UUID primary keys where
  applicable, use integer minor units, and retain date-only fields as text.
- Clients use unique `internal_number`; organization/contact sub-models are
  removed.
- Powers of attorney have client and descriptive-lawyer junctions. An official
  number may repeat; the internal sequence is unique.
- Case-client links have composite uniqueness plus legal capacity, notes, and a
  composite FK that permits only a POA belonging to that specific client.
- Hearings replace generic events; tasks use a constrained `completed` boolean.
- Payments reference `(case_id, payer_client_id)` in `case_clients`; expenses
  have independently optional client/case links.
- Attachments are managed-copy metadata only and have exactly one owner:
  client, case, POA, or expense.
- `backup_history` contains no destination path and `usage_counters` are
  aggregate counters only. `activity_history`, the generic ledger, external
  document references, and `spike_records` are removed.
- Normalized B-tree search is retained for exact/prefix search. FTS5 was not
  justified by the current small query surface and is deliberately deferred.

## Finalized-screen inventory and route map

All `screen.png` and matching `code.html` files under
`stitch_legal_masr_design_foundation/` were catalogued, and `legal_masr/DESIGN.md`
was read. The approved system is Arabic RTL, IBM Plex Sans Arabic, 260px
right-side navigation, 72px top bar, warm-paper canvas, and Egyptian-green
primary controls.

| Finalized feature/screens                                                              | Current route                              | Phase 4/5 reusable work                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Desktop shell (including 1440×900 and 1366×768) and component libraries/design systems | `Shell` on all ready routes                | frozen navigation, header, search, menus, table, dialog, feedback primitives |
| Today and agenda month/week/list                                                       | `/`, `/calendar`                           | Today sections; agenda calendar/list and hearing/task cards                  |
| Client list, add/edit, summary/cases/POAs/account/attachments                          | `/clients`, `/clients/new`, `/clients/:id` | client form, profile tabs, account and attachment rows                       |
| POA list, add/edit, populated/refined detail                                           | none                                       | POA form, clients/lawyers/cases/detail tabs                                  |
| Case list, add/edit, summary/parties/hearings/tasks/account/attachments                | `/cases`, `/cases/new`, `/cases/:id`       | case form, relationship editor, summary tabs                                 |
| Task list and add/detail/edit dialogs                                                  | `/tasks`                                   | task dialog, semantic completion control, derived filters                    |
| Finance payment/expense tabs and add/edit dialogs                                      | `/finances`                                | finance tabs, payment payer combobox, expense dialog                         |
| Settings profile/security, backup/restore, privacy/usage, about, confirmation dialogs  | `/settings`, `/backups`                    | settings tabs, confirmation dialog, privacy and backup history rows          |

## Visual baseline capture

The product has no browser-mode seed command: the normal React application
expects Tauri IPC and an encrypted local vault. Phase 0 captures use a
browser-only mocked Tauri bridge with representative Arabic records; no local
vault, document path, or personal data is read. Captures are stored under
`docs/visual-baseline/` at 1440×900 and 1366×768. They are a before/after
layout reference only, not visual sign-off.

## Phase 1 validation coverage

`db::tests::canonical_schema_enforces_domain_invariants_and_integrity` verifies
the clean migration, duplicate internal identifiers, invalid boolean/money,
invalid attachment ownership, invalid payment payer, `foreign_key_check`, and
`integrity_check`. `db::tests::populated_legacy_vault_is_rejected_without_schema_replacement`
verifies the failure path preserves a populated legacy schema.

## Deferred contracts and risk

Migration 0007 deliberately makes the old repositories, command DTOs, bridge
types, query hooks, and feature screens stale. Canonical POA, case, and hearing
vertical slices now exist, including their Tauri DTOs/commands; reminders query
canonical hearings/tasks and search rebuilding indexes Clients, Cases, and
POAs. The legacy client, task, attachment, finance, dashboard, backup, and
settings paths remain to be replaced; browser case callers await their Phase 3
contract migration. A canonical database therefore still cannot serve the full
application, and legacy task/document repository tests continue to fail on
removed columns rather than providing readiness evidence.

## Phase 3–4 implementation note — 2026-08-24

- POA persistence supports multiple clients, descriptive lawyers, archive and
  restore, linked-case visibility, and canonical search indexing. Case
  persistence now uses explicit internal/official identifiers, per-client legal
  capacity/POA/notes, and dedicated lightweight opponents. Dedicated hearing
  persistence supports CRUD plus a transactional decision/next-hearing chain.
  Rust repository normal/failure tests cover POA relationships, case-client POA
  ownership, missing cases, opponent persistence, hearing completion, and
  missing hearings.
- Tasks now persist only their legal due date, details/notes, optional client or
  case link, reminder, and completion state; Today, Overdue, Upcoming, and
  Completed are repository query views. Finance now has separate fee agreement,
  payment, and expense contracts; payment membership is validated by both the
  service and its `(case_id, payer_client_id)` database foreign key. Attachments
  are managed copies with one canonical owner, hash metadata, compensating file
  cleanup, native open/reveal, and staged removal.
- `types.ts` and `commands.ts` expose canonical client, case, POA, hearing,
  task, attachment, payment, expense, Today, and settings contracts. Agenda
  combines hearing and task query views; the legacy event bridge is removed.
- Phase 4 now has the approved frozen shell navigation: Today, Agenda,
  Clients, Powers of Attorney, Cases, Tasks, Finance, Settings, and Lock
  Application. Legacy Documents and Backups routes remain direct destinations
  until their Phase 5 replacement screens are implemented, but are no longer
  shell navigation destinations.
- Shared accessible `Dialog`, `ConfirmDialog`, `Tabs`, `PageHeader`, and
  `Toast` primitives plus canonical query-key/invalidation helpers are present.
  The invalidation helper covers payment, hearing, task completion, and
  POA/case-client write rules. The hearing mutation is connected; remaining
  write hooks will connect as their Phase 2 contracts land.
- Validation after these slices: `pnpm typecheck`, `pnpm test` (17 tests),
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and
  `cargo test --lib` (23 tests) pass. The canonical case integration test also
  passes. Full `cargo test` remains blocked by legacy task/document integration
  tests that still refer to removed `priority` and `documents` columns.
