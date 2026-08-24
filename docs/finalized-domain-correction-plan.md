# Finalized Legal Masr correction plan

## Purpose and scope

This plan aligns the SQLite schema, Rust application layer, typed Tauri bridge,
Arabic RTL React application, tests, and documentation with the finalized
Legal Masr v1 product definition. It is an implementation plan, not a design
redesign. Approved/refined Stitch screens are the visual source of truth;
their generated HTML is reference material only.

## Working rules

- Keep React behind typed Tauri commands; Rust alone accesses SQLite and the
  managed attachment directory.
- Preserve Arabic-first RTL behavior, date-only values, and EGP integer minor
  units.
- No cloud services, users/roles/teams, accounting ledger, task priority,
  generic party/event/transaction abstractions, or personally identifying
  telemetry/logging.
- Every domain write that spans records or files is transactional or has a
  compensating cleanup path.
- Existing unrelated worktree changes are not overwritten.

## Migration decision gate

Before editing migrations, establish whether any alpha/beta installation has
persisted legal data that must be retained.

1. Inspect release tags, shipped bundles, distribution history, and any
   representative encrypted-vault fixtures available to the project.
2. If there is no released/persistent-data obligation, replace the experimental
   development baseline coherently while retaining `schema_migrations`.
3. If data must be retained, add one forward-only immutable migration that:
   - copies every convertible record explicitly;
   - rejects non-convertible records with a stable, actionable error rather
     than silently deleting them;
   - performs managed-file conversion in Rust where filesystem work is needed;
   - records only `schema_migrations` as schema history after conversion.
4. Write clean-database and legacy-fixture migration tests before relying on
   the migration in application startup.

The current repository describes a supervised alpha and immutable migrations,
so the default assumption is **forward migration unless the compatibility
audit proves that no persisted vaults exist**.

## Phase 0 — Stabilize and inventory

**Status: Complete (2026-08-24).**

1. [x] Re-run the baseline Rust and frontend checks and resolve existing test
       failures before mixing them with domain changes.
2. [x] Record the current schema, migration history, FK actions, table consumers,
       command names, DTOs, query keys, and UI routes in an implementation
       checklist.
3. [x] Inspect every `screen.png`, `code.html`, component-library screen, desktop
       shell, and `legal_masr/DESIGN.md`; map each finalized feature to its React
       route and reusable component needs.
4. [x] Capture the current application at 1440x900 and 1366x768 with seeded Arabic
       data so later design QA has a valid before/after comparison.

Exit criteria: [x] baseline failures are classified or fixed, migration strategy
is documented, and no implementation work proceeds on unverified contracts.

Evidence: [`finalized-domain-implementation-checklist.md`](finalized-domain-implementation-checklist.md)
and `docs/visual-baseline/`.

## Phase 1 — Canonical SQLite model

**Status: Complete as a schema foundation (2026-08-24).** Rust repositories,
commands, bridge DTOs, and UI remain Phase 2/3 work; the full legacy Rust suite
is intentionally not yet compatible with the canonical tables.

Build the finalized baseline or forward migration with `STRICT` domain tables
where supported, explicit non-null UUID keys, constraints, indexes, and FK
delete actions.

1. [x] Keep `app_metadata` installation-only; make `schema_migrations` the only
       schema-version authority. Remove `spike_records` and stale metadata.
2. [x] Reduce `lawyer_profile` and `app_settings` to finalized fields only.
3. [x] Rebuild `clients` around unique text `internal_number`; remove
       organizations/contacts that do not exist in approved UI.
4. [x] Add POA tables: `powers_of_attorney`, client/case junctions, and descriptive
       POA lawyers.
5. [x] Rebuild cases, `case_clients`, and `case_opponents`; enforce composite
       client-case uniqueness and client-specific POA validity.
6. [x] Replace generic hearing events with `hearings` plus a narrow
       `calendar_events` table only if finalized agenda screens require it.
7. [x] Simplify `tasks` to date, details, notes, optional links, reminder, and a
       constrained completion boolean.
8. [x] Replace the generic ledger with `case_fee_agreements`, `payments`, and
       `expenses`; use the payment composite FK to `case_clients`.
9. [x] Replace documents with managed-copy-only `attachments`, explicit single
       owner integrity, and expense/POA ownership support.
10. [x] Add `backup_history` and aggregate-only `usage_counters`; remove
        `activity_history` if it has no product-facing purpose.
11. [x] Establish the search strategy after measuring current query behavior:
        normalized indexed prefix/exact search by default, FTS5 only if justified
        and proven available.
12. [x] Ensure `PRAGMA foreign_keys = ON` occurs whenever a connection opens.

Exit criteria: [x] clean migration applies; `foreign_key_check` and
`integrity_check` pass; invalid booleans, money, duplicate identifiers,
invalid owners, and invalid payment payers are rejected by tests.

Evidence: migration `0007_canonical_legal_masr.sql` and
`db::tests::canonical_schema_enforces_domain_invariants_and_integrity`.

## Phase 2 — Rust domain and persistence contracts

Update repositories first, then services, then thin Tauri commands.

1. [x] Implement POA repositories/services/commands, including multiple clients,
       descriptive lawyers, linked cases, archiving, and search indexing.
2. [x] Replace case APIs with explicit internal/official numbers, CaseClient legal
       capacity/POA/notes, and lightweight opponents.
3. [x] Implement dedicated hearing commands. Recording a decision must update the
       source hearing and optionally create a separately editable next hearing
       linked by `previous_hearing_id`, in one transaction.
4. [x] Implement simple task creation/editing and completion/reversal, with Today,
       Overdue, Upcoming, and Completed derived by query—not priority.
5. [x] Split finance commands into fee agreement, payment, and expense APIs.
       Validate payer membership in both service and database layers.
6. [x] Convert document infrastructure to attachment infrastructure. Coordinate
       copy, hash, metadata insertion, cleanup on failure, native open/reveal, and
       safe removal.
7. [x] Update reminders, Today, Agenda, backup manifests/history, settings, and
       search index rebuilding for the new entities. Canonical hearing/task reminder
       selection and Client/Case/POA search rebuilding are complete. The Rust Today
       summary, backup history, settings, Agenda, and bridge/frontend callers now use
       canonical entities.
8. [x] Delete obsolete event DTOs, commands, repositories, and service paths after
       all callers are migrated.

Exit criteria: all required operations have normal and failure-path repository
and service tests; command handlers contain no SQL or business-rule logic.

## Phase 3 — Bridge, frontend types, and data hooks

**Status: Complete (2026-08-24).**

1. [x] Update `src/bridge/types.ts`, `commands.ts`, error mapping, and mock
       contracts atomically with Rust DTOs.
2. [x] Replace generic events/documents/financial transaction/task-priority and
       global-case-capacity types with finalized domain types.
3. [x] Update Zod schemas, React Hook Form defaults, TanStack Query query keys,
       and mutations.
4. [x] Define invalidation per write in the canonical query-key helper:
   - payment: payments, case account, client account;
   - hearing: hearings, case summary, Today, Agenda;
   - task completion: task lists, Today, Agenda, relevant case;
   - POA/case-client changes: POA, case, client relationship tabs, search.

   The helpers and their normal/failure-scope tests are complete. All canonical
   write hooks now use the shared query-key/invalidation contracts, and bridge
   payload contract tests cover the finalized command surface.

Exit criteria: [x] TypeScript has no stale DTO use, no broad `any`, and all
bridge payload contract tests pass.

## Phase 4 — Shared Stitch component and shell alignment

1. [x] Audit existing components before creating any new primitive.
2. [x] Refine the shared RTL shell to the approved frozen navigation: Today,
       Agenda, Clients, Powers of Attorney, Cases, Tasks, Finance, Settings, and
       Lock Application.
3. [x] Remove unsupported shell elements (SaaS account/avatar/bell/upgrade/cloud
       controls) and legacy navigation destinations.
4. [x] Add/reuse page-header, tabs, native inputs/selects, semantic table,
       badge, dialog, confirmation-dialog, toast, filters, and empty-state
       primitives. Attachment-row and money-display standardization remains with
       the relevant Phase 5 features.
5. [x] Make dialogs, menus, tabs, comboboxes, and checkboxes keyboard-accessible
       with visible focus, focus containment/return, and Escape behavior.

Exit criteria: [x] one shared shell renders all current feature routes; shared
components follow the Stitch system without pasted page HTML or duplicate
control systems. Attachment-row and money-display refinement remains Phase 5
feature work.

## Phase 5 — Feature implementation and visual parity

**Status: Feature implementation complete (2026-08-24); formal screenshot
comparison and visual sign-off remain Phase 7 work.**

Implement in dependency order, using the corresponding refined/final Stitch
screen at each step.

1. [x] Clients: list, add/edit, profile tabs, internal number, archive, accounts,
       linked cases/POAs, and attachments.
2. [x] Powers of Attorney: list, add/edit, details, clients, lawyers, linked cases,
       and POA scan attachments.
3. [x] Cases: list, add/edit, summary, CaseClient editor, opponents, account, and
       attachments.
4. [x] Hearings/Agenda/Today: dedicated hearing forms, decision/next-hearing flow,
       month/week/list agenda, and accurate derived states.
5. [x] Tasks: finalized add/edit/details dialogs, semantic interactive completion
       checkbox, and no priority/time/assignee controls.
6. [x] Finance: separate payment/expense tabs and dialogs, payer filtered to case
       clients, optional payment method, independently optional expense links.
7. [x] Attachments: managed-copy picker only, owner-specific lists, and no
       unavailable preview controls.
8. [x] Settings/backup/privacy: minimal profile/security, manual backup/restore
       and latest successful backup, aggregate opt-in usage counters, About.
9. [x] Global search: Clients, Cases, and POAs with normalized Arabic/digit lookup
       and correct deep links.

Use `<bdi>` for identifiers, dates, money, phones, filenames, and versions.

Exit criteria: each corrected page follows its approved refined screen and
implements the product behavior rather than generated Stitch artifacts.

## Phase 6 — Test matrix, migration safety, and cleanup

**Status: Complete (2026-08-24).**

1. [x] Schema: clean migration, legacy migration (if applicable), FK/integrity
       checks, all delete-policy tests.
2. [x] Domain: client uniqueness/archive; POA links and repeated official number;
       case capacity per relationship; opponents; hearing chains; task derivation;
       payment payer constraint/totals; all expense combinations.
3. [x] Files/backup: managed copy durability, failure cleanup, attachment removal,
       backup database+attachments+manifest, corrupt restore staging safety, latest
       successful backup metadata.
4. [x] UI: forms, tabs, dialogs, comboboxes, task checkbox, payer filtering,
       optional expense relationships, Case/Client/POA flows, RTL mixed text.
5. [x] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
       `pnpm build`, `cargo fmt --check`, clippy with warnings denied, full Cargo
       tests, and the relevant debug Tauri Debian build.

Exit criteria: [x] failures introduced by this work are fixed rather than skipped;
all acceptance invariants have automated coverage.

Evidence: `canonical_domain_matrix` integration coverage; managed-attachment and
backup restore safety tests; UI form/workflow tests; all listed validation commands
passed, including `pnpm tauri build --debug --bundles deb`.

## Phase 7 — Documentation and visual sign-off

**Status: In progress (2026-08-24).**

1. [x] Update data model, architecture, functional modules, backup format, privacy,
       testing, roadmap status, README, and this plan’s decision record so they
       describe the implemented result.
2. [ ] Compare seeded running-app captures against approved screens at 1440x900 and
       1366x768; correct meaningful spacing, RTL, typography, focus, table,
       dialog, overflow, and mixed-direction defects. Blocked: this environment has
       no approved browser/capture surface for a seeded running Tauri app. Old Phase
       0 baseline images are not valid sign-off evidence.
3. [x] Complete a final source scan for obsolete fields/features, React SQL access,
       arbitrary filesystem/shell/HTTP exposure, and unsafe personal-data logs.
4. [x] Produce the change, validation, and remaining-risk report:
       [finalized-domain-phase-7-report.md](finalized-domain-phase-7-report.md).

## Completion checklist

Do not mark the work complete until the domain, database, backend, frontend,
tests, and documentation acceptance criteria from the finalized correction
brief all pass. A compilable SQL change alone is not completion.
