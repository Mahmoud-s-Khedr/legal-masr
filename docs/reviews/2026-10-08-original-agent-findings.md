<!-- Preserved evidence appendix: original claims, not a fresh verification pass. See the continuation report for qualifications and launch decision. -->

# Recovered completed review reports

## Continuation audit (2026-10-08)

All six completed static agents delivered detailed reports through SubagentHandback. The interim report condensed these heavily; this file preserves the complete reports, including original confidence qualifiers, low-severity findings, coverage tables, and test gaps. Original agent wording such as "confirmed" means the original agent claimed confirmation; it is not an independent continuation verification. Treat the two explicitly rejected claims below as rejected even though their original text is retained in the archival sections.

Independent read-only continuation checks:

- Arabic and English catalogues each contain 738 flattened keys; missing Arabic keys: []; missing English keys: []; empty values: []. The plan's 880 figure describes lines, not keys.
- `generate_handler!` registers 69 commands and `src/bridge/commands.ts` invokes the same 69 unique command names; missing bridge commands: []; unregistered invocations: []. The original plan's 67 count was inaccurate. The full original per-command contract table follows in Agent 6's report.
- `app_service::initialize` checks only `security_path.exists()` before renaming a new database over `db_path` (`src-tauri/src/services/app_service.rs:46-48,90`). The earlier first-pass finding about setup overwriting an existing database when security.json is absent is supported by current code and was omitted from the interim blocker list. Preserve it as an additional high-priority data-loss finding. Actual overwrite semantics differ by OS; Linux rename replaces the destination. No production vault was accessed.
- `db::open_db` still calls `Connection::open` (`src-tauri/src/db/mod.rs:47`), which has CREATE semantics; `migrate` lacks a newer-schema rejection. This supports the original missing-vault and downgrade findings, while the crash/power-loss behavior remains inferred rather than freshly fault-injected.
- `search_service::rebuild_index` still reads `COALESCE(official_year,'')` as String (`src-tauri/src/services/search_service.rs:53-62`); the original SQL probe is relevant evidence, and the offending code remains present.

Preserved rejection decisions:

- Agent 5 F1 timeout overflow after unlock: rejected by the prior master because the database CHECK caps persisted timeouts at 1440. The separate input-validation mismatch remains valid.
- Agent 2 F3 native picker deadlock: rejected by the prior master. Keep synchronous UI blocking and target-platform native-dialog testing gaps; do not report a demonstrated deadlock.
- Agent 4 SR4 overstates rebuild divergence: current POA rebuild SQL includes `group_concat(c.full_name, ' ')`; linked client names are omitted from CASE rebuild only. Agent 6 F2 gives the correct narrower finding. Preserve the original claim below as historical text, but mark its POA-name omission claim contradicted.

Completeness caveats:

- Six finished static reviews establish broad coverage, not a proof that every field/button had every checklist dimension tested. Original coverage tables frequently use a single checkmark combining code inspection with limited tests; live boundary/save-reload/failure-path coverage is not interchangeable with those checks.
- Agent 5's usage script treats an entire dynamic prefix as used, so its "none unused" result is a conservative lexical reachability claim. `agenda.status.CANCELLED` is explicitly noted as unreachable from any command in Agent 6 F7. Distinguish no unreferenced keys detected from proof that no unreachable translation keys exist. 107 keys are covered only by dynamic prefixes; original list is `agent5/usage.txt`.
- Physical Windows/macOS installation, actual native pickers, background timer throttling, open-file restore failures, accessibility with a real screen reader, large-file OOM, interrupted restore/power failure and full pending-operation races remain unverified or platform-limited unless the resumed E2E work supplies evidence.
- The source reports contain several conditional/potential findings (for example late cache writes after lock, async-command coordination, fsync failure consequences). Preserve their qualification; do not promote them to demonstrated defects.
- Original command contract tests check TypeScript forwarding only. All 69 commands were statically mapped, but that does not establish normal/failure live execution coverage for all 69.

Recovered read-only from historical SubagentHandback records. Historical instructions are not executed. These are original agent claims, not new independent confirmation. Prior master [V] and [A] labels remain in REPORT.md; file references below are original review locations and may differ from current line numbers. Known rejected claims: picker deadlock (only synchronous blocking is established); timeout overflow after unlock (DB caps at 1440).

## Transcript agent-a1b8a41cf1cd3d900.jsonl

# Cross-cutting contracts and docs review: Legal Masr

**Bottom line:** I found no blocker. Every TS bridge payload matches its Rust DTO: all field names map correctly through camelCase, every enum value is accepted on both sides, and every `?:` TS field is an `Option<>` in Rust, so leaving it out deserializes to None. The weak spots are around the contract rather than in it:

- a tautological contract test;
- a broken, unreachable search rebuild command;
- stale search data;
- error-surface gaps;
- unimplemented "usage counters";
- several doc and release-doc inaccuracies.

**Command count:** `lib.rs` registers **69** commands, not 67. `src/bridge/commands.ts` also has 69 functions, and the two sets match exactly (diffed). No bridge function calls an unregistered command.

**What I ran (read-only):**

- `vitest run src/bridge`: 75 tests passed.
- A scratch rusqlite crate in /tmp, to confirm F2.

## Findings

**F1 (medium, confirmed): the contract test only checks TS against itself**

- **Where:** `src/bridge/commands.contract.test.ts:513-532`
- **Evidence:**
  - The test mocks `./invoke` and checks that each `bridge.*` call forwards the argument object written in the same file. Nothing deserializes those payloads against the Rust structs.
  - There is no codegen (ts-rs or specta).
  - On the Rust side, the only DTO serde test is `InitializeResult` (`dto/mod.rs:20`).
- **Failure scenario:** someone renames a Rust field (say `payer_client_id` to `payer_id`). The TS test still passes, and at runtime the command fails with a Tauri "invalid args" string (see F4).
- **Fix:** add a Rust test that runs `serde_json::from_value::<Dto>` on the same fixture JSON (shared fixture files), or generate the TS types with ts-rs/specta.
- **Coverage:** the test covers all 69 commands on the TS side and none on the Rust side.

**F2 (medium, confirmed): `search_rebuild_index` crashes on real data and builds a different index from normal saves**

- **Where:** `src-tauri/src/services/search_service.rs:46-58` and `:67-71`
- **The crash:**
  - The query does `COALESCE(official_year, '')` on an INTEGER column, then reads it with `row.get::<_, String>`.
  - My scratch crate confirmed the result: `Err(InvalidColumnType(0,"COALESCE(y, '')",Integer))`.
  - So any vault with at least one case that has a judicial year makes the rebuild fail with OPERATION_FAILED.
- **The divergence from normal saves:**
  - Rebuild indexes client phone; saving a client does not (`client_service.rs:17-30`).
  - Rebuild leaves out case client names, which `case_service::index` includes.
  - So a successful rebuild would make search by client name stop finding cases.
- **Exposure today:** the command is untested and the UI never calls it.
- **Fix:** use `CAST(official_year AS TEXT)` or read it as `Option<i64>`. Put the normalized-text recipe in one shared function. Add a test.

**F3 (medium, confirmed): renaming a client leaves case and POA search entries stale**

- **Where:** `client_service.rs:82-118`
- **Evidence:**
  - Client update only upserts the CLIENT search row.
  - CASE and POA rows embed client names in `normalized_text` (`case_service.rs:57-80`, `power_of_attorney_service.rs:24-44`).
  - Nothing reindexes them, startup does not rebuild, and the rebuild command is unreachable and broken (F2).
- **Failure scenario:** rename a client, then search the new name. Their cases and POAs are not found, while the old name still finds them.
- **Fix:** inside the client-update transaction, reindex the linked cases and POAs.

**F4 (medium, confirmed): raw Tauri argument errors reach the user**

- **Where:** `src/bridge/errors.ts:46`
- **Evidence:** `errorMessage` does `if (typeof error === 'string') return error;`.
  - When IPC deserialization fails (missing field, wrong type, u8 overflow, negative u32), Tauri rejects with a plain English string such as "invalid args `input` for command …: missing field …".
  - That bypasses the `Error` serializer, so the Arabic UI shows the raw internal message.
- **Fix:** map unknown strings to the localized fallback and send the string only to dev diagnostics.

**F5 (medium, confirmed): database constraint failures show up only as a generic OPERATION_FAILED**

- **Duplicate identifiers:**
  - A duplicate client, case, or POA internal number hits the UNIQUE constraint. The resulting `rusqlite::Error` maps to OPERATION_FAILED (`errors/mod.rs:99`).
  - There is no DUPLICATE code in TS or Rust, so the user is never told the number is taken.
- **Lock timeout range:**
  - The DB allows `lock_timeout_minutes BETWEEN 1 AND 1440` (migration line 48).
  - Rust checks only `== 0` (`settings_service.rs:28`, `app_service.rs:40`).
  - The TS schema has `min(1)` and no maximum (`settings.schema.ts:9`).
  - Entering 2000 passes TS and Rust validation, then fails at the CHECK with a generic error.
- **Fix:** add specific error codes for UNIQUE violations, and enforce `max(1440)` in both zod and Rust.

**F6 (low, confirmed): some paths store `""` instead of NULL for cleared optional fields**

- **Where:** `client_service.rs:63-74` and `:98-110`; `settings_repository.rs:65` (profile); `finance_repository` fee agreement notes and date.
- **Evidence:**
  - These paths have no `clean()`, unlike the case, hearing, task, finance, POA and document services.
  - `ClientForm` with zod `.trim().optional()` sends `""` when a field is cleared (`ClientDetailPage.tsx:329`).
  - Result: the DB holds `""` for national_id, email and so on, and `normalized_phone` becomes `""`.
- **Fix:** apply `clean()` on these paths.

**F7 (low, confirmed): dead or misleading command surface**

- **Registered but never called by the UI:**
  - `client_export` (it also opens a folder dialog with no desktop-e2e stub).
  - `hearing_get` (only the captureBridge fixture uses it).
  - `search_rebuild_index` (see F2).
- **"Create" commands that can update:** `*_create` commands that take an `id` (`hearing_create`, `task_create`, `power_of_attorney_create`) actually update, because the same `save()` handles both.
- **Error codes that are never emitted:** `CASE_MUST_HAVE_CLIENT` and `CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED`. `case_service` returns VALIDATION_FAILED instead.
- **Unreachable status:** HearingStatus `CANCELLED` exists, but no command can produce it.
- **Contract fields with no UI:** `reminderMinutes` (hearing and task), plus fee `agreementDate` and `notes`.
  - Every fee save sends only the amount, and the upsert overwrites those two columns with NULL.

**F8 (medium, docs and feature, confirmed): usage counters are never recorded**

- **Evidence:** the `usage_counters` table is never written anywhere in `src-tauri/src`. Only the consent flag is stored (`settings_repository::update_usage_counters`), so the Settings toggle does nothing.
- **Docs that claim they exist:**
  - README:48-49 ("aggregate opt-in usage counters").
  - `database-schema.md:123`.
  - `plan/03:24`.
  - The guide (en:1053, "Local counters are optional…").
- **Fix:** implement the counters, or remove the toggle, the table and the claims.

**F9 (low, confirmed): capture fixtures ship in the production bundle (inert)**

- **Evidence:**
  - The flags are guarded correctly: `captureModeEnabledFor(import.meta.env.DEV, …)` compiles to `bA(!1,…)` in `dist/assets/index-*.js`. Seeding and diagnostics are also DEV-gated.
  - But the fixture data ("demo-client-adel", DEMO strings) is still in the production JS, because `invoke.ts` imports it statically.
- **Fix:** use a dynamic import behind `if (import.meta.env.DEV)`.

**F10 (low): `vite.config.ts:38` uses `envPrefix: ['VITE_', 'TAURI_']`**

- This is broader than the recommended `TAURI_ENV_`. A future `import.meta.env.TAURI_SIGNING_PRIVATE_KEY` reference would be inlined into the bundle. Nothing references it today, and the release workflow sets no such secrets.
- **Fix:** use `'TAURI_ENV_'`.

**F11 (medium, release docs, confirmed): RELEASING.md lists the wrong artifact names**

- `docs/RELEASING.md:18-29` lists `LegalMaster-Solo_<version>_…`.
- `scripts/release-assets.mjs:84-92` and the `release.yml` notes produce `Legal-Masr_<version>_…`.
- A reviewer following the doc will think the draft is wrong.
- **Branding drift:**
  - BUILDING, RELEASING and plan docs say "LegalMaster Solo".
  - `productName` is "Legal Masr", the identifier is `com.legalmaster.solo`, and the crate and package are `legalmaster-solo`.
  - The window title is Arabic-only, even in English mode.

**F12 (medium, release, confirmed): macOS and Windows builds ship with little native testing**

- **macOS:** both macOS architectures are built and shipped (`release.yml` matrix), but the desktop e2e runs only on ubuntu and windows (`desktop.yml:21`).
- **Rust tests:** `cargo test` runs only on ubuntu, so no Rust unit tests run on Windows or macOS.
- **Lint coverage:**
  - clippy and test run with `--all-features`, which turns on `desktop-e2e`.
  - So the production-only `#[cfg(not(feature="desktop-e2e"))]` branches are never linted or tested: the window-state and single-instance plugins, and the real `choose_backup` dialog.
  - Packaging builds do still compile them.
- **Release validate job:** it omits the `pnpm audit` and `cargo audit` steps that `validate.yml` runs.
- **Windows offline install:** NSIS uses the default WebView2 `downloadBootstrapper`, so installing on a Windows 10 machine without WebView2 needs internet, which conflicts with the offline positioning. The portable zip also assumes WebView2 is present.
- **BUILDING.md:** it says packaging waits only for "that job" (validate); it actually also waits on visual and desktop.
- **Checked and fine:**
  - Versions are consistent at 0.1.0 across package.json, Cargo.toml and tauri.conf.json, and `release-assets verify-version` enforces it.
  - macOS uses `signingIdentity "-"` (ad-hoc), as SIGNING_POLICY says.
  - There is no updater, which matches the docs.
  - The desktop-e2e feature cannot reach release: `build-desktop-e2e.mjs` uses a separate target dir with `--debug --no-bundle`, release builds pass no `--features`, and `verify-release-boundary.mjs` scans the binary for harness markers.

**F13 (medium, docs, confirmed): `docs/forms-inventory.md` does not match the forms**

- **Unlock:** the doc says "at least 12 characters", but `unlockSchema` is `min(1)` (`onboarding.schema.ts:23`).
- **Setup and Recovery:** the doc omits the required confirm-password field (`setupSchema`, `recoverySchema`).
- **POA:**
  - Linked clients are not marked required, yet Rust rejects an empty `client_ids` with a generic VALIDATION_FAILED (`power_of_attorney_service.rs:53-54`), and the form has no client-side check.
  - Issue year is derived silently from the issue date (`PowerOfAttorneyForm.tsx:70`).
- **Hearing and Task:** neither form exposes a reminder field. The doc correctly omits it, but `plan/04:135` says tasks have an "optional reminder".

**F14 (medium, docs, confirmed): `plan/03-data-model.md` and `plan/04` describe search and startup inaccurately**

- **`plan/03:86`:** says startup "rebuilds derived search data where required, and checks integrity". Neither happens. `integrity_check` runs only in tests (`db/mod.rs:231`), and nothing calls `rebuild_index`.
- **`plan/03:73`, `plan/04:164`, `database-schema.md:120`:** describe "normalized B-tree prefix/exact" lookup.
  - The actual query is `normalized_text LIKE '%q%'` (`search_repository.rs:35-37`): a substring match with a full scan, which cannot use `idx_search_index_normalized_prefix`.
  - LIKE wildcards (`%`, `_`) typed by the user are not escaped there, nor in the client, case and POA list queries.

**F15 (medium, docs, confirmed): user-guide callouts are generated and often wrong**

- **Where:** `scripts/guide-content.mjs:817-826`. The English callouts match on substrings of the field label.
- **Wrong callouts in `docs/user-guide/en/guide.md`:**
  - "Court case number: Choose the case related to this record." (lines 455, 465, 557)
  - "Case type: Choose the case…" (457, 467, 559)
  - "Subject of the case: Choose the case…" (474, 566)
  - "Clients: Choose an existing client; payment payers must belong to the case" on case creation.
- **Placeholder text:** "review the value or enter the relevant information…" appears 94 times, and "review this section and follow the instructions above" 43 times.
- **Arabic vs English:** the Arabic callouts are a different, generic text, so the two guides are not equivalent.
- `traceability.md` only checks screen rendering, not callout accuracy.

**F16 (low, docs): the deletion summary in `database-schema.md:127-129` is incomplete**

- It says "Deleting a case cascades to its case-client links…".
- But `payments` has an `ON DELETE RESTRICT` foreign key to `case_clients`, so deleting any case with payments fails.
- No delete command exists today, but the summary should say so.

**F17 (low, README): README claims that do not hold**

- "Designed for Windows and macOS", while Linux deb, rpm and AppImage are also shipped.
- The usage-counters claim (F8).
- "backup history": only the latest successful backup is surfaced.

**F18 (low): password length is counted differently on each side**

- zod `min(12)` counts UTF-16 code units; Rust `chars().count() < 12` counts code points.
- A 12-unit password made of astral characters (for example 6 emoji) passes TS and gets a generic VALIDATION_FAILED from Rust.

**Data model (migration 0001 vs `database-schema.md`):**

- Every table, column and constraint in the migration is described or consistent. All tables are STRICT, as documented.
- Indexes cover the common queries: hearings by `(case_id, hearing_date)` and `(hearing_date, status)`; tasks by `(due_date, completed)`, case and client; payments and expenses by case or client plus date; attachments per owner; `case_clients(client_id)` and `(poa_id)`; and the foreign-key child sides.
- Gaps:
  - Search, client list and case list use `%q%` LIKE, so they always do full scans. That is acceptable for a solo-lawyer data size.
  - `idx_clients_active_internal_number`, `idx_cases_active_internal_number` and `idx_powers_of_attorney_active_sequence` duplicate the UNIQUE autoindexes.
- No missing index is significant.

## Command table (69)

- All DTO field names and enums match. "Test" means the TS-side envelope is checked by the contract test; no command's Rust deserialization is tested (F1).
- Caller paths are under `src/features` unless they start with `components/` or `app/`.
- Where a "Rust args" cell is empty, the command takes only `app` and `state`.

| Command                         | Rust args                      | TS args                       | DTO     | Test | Frontend caller                      |
| ------------------------------- | ------------------------------ | ----------------------------- | ------- | ---- | ------------------------------------ |
| app_get_status                  | —                              | —                             | ✓       | TS   | onboardingApi, lib/vaultCache        |
| app_initialize                  | input: InitializeInput         | {input}                       | ✓       | TS   | onboardingApi                        |
| app_unlock                      | password                       | {password}                    | ✓       | TS   | onboardingApi                        |
| app_lock                        | —                              | —                             | ✓       | TS   | onboardingApi                        |
| app_change_password             | current_password, new_password | {currentPassword,newPassword} | ✓ (F18) | TS   | settingsApi                          |
| app_recover_access              | recovery_key, new_password     | {recoveryKey,newPassword}     | ✓       | TS   | onboardingApi                        |
| backup_create                   | —                              | —                             | ✓       | TS   | backupsApi                           |
| backup_latest_successful        | —                              | —                             | ✓       | TS   | backupsApi                           |
| backup_validate                 | —                              | —                             | ✓       | TS   | backupsApi                           |
| backup_restore                  | —                              | —                             | ✓       | TS   | backupsApi                           |
| settings_get                    | —                              | —                             | ✓       | TS   | settingsApi                          |
| settings_open_developer_contact | contact                        | {contact}                     | ✓       | TS   | components/layout/DeveloperContacts  |
| settings_update                 | input                          | {input}                       | F5      | TS   | settingsApi                          |
| profile_get                     | —                              | —                             | ✓       | TS   | settingsApi                          |
| profile_update                  | profile                        | {profile}                     | F6      | TS   | settingsApi                          |
| settings_set_autostart          | enabled                        | {enabled}                     | ✓       | TS   | settingsApi                          |
| settings_set_usage_counters     | enabled                        | {enabled}                     | F8      | TS   | settingsApi                          |
| client_create                   | input                          | {input}                       | F5/F6   | TS   | clientsApi (+dev seed)               |
| client_update                   | input                          | {input}                       | F3/F6   | TS   | clientsApi                           |
| client_get                      | id                             | {id}                          | ✓       | TS   | clientsApi                           |
| client_list                     | input                          | {input}                       | ✓       | TS   | clientsApi                           |
| client_archive                  | id                             | {id}                          | ✓       | TS   | clientsApi                           |
| client_restore                  | id                             | {id}                          | ✓       | TS   | clientsApi                           |
| client_export                   | id                             | {id}                          | ✓       | TS   | **none** (F7)                        |
| power_of_attorney_create        | input                          | {input}                       | ✓ (F7)  | TS   | powersOfAttorneyApi                  |
| power_of_attorney_update        | input                          | {input}                       | ✓       | TS   | powersOfAttorneyApi                  |
| power_of_attorney_get           | id                             | {id}                          | ✓       | TS   | powersOfAttorneyApi                  |
| power_of_attorney_list          | input                          | {input}                       | ✓       | TS   | powersOfAttorneyApi                  |
| power_of_attorney_archive       | id                             | {id}                          | ✓       | TS   | powersOfAttorneyApi                  |
| power_of_attorney_restore       | id                             | {id}                          | ✓       | TS   | powersOfAttorneyApi                  |
| hearing_create                  | input                          | {input}                       | ✓ (F7)  | TS   | hearingsApi                          |
| hearing_update                  | input                          | {input}                       | ✓       | TS   | hearingsApi                          |
| hearing_get                     | id                             | {id}                          | ✓       | TS   | **none** (F7)                        |
| hearing_list                    | input                          | {input}                       | ✓       | TS   | hearingsApi                          |
| hearing_record_decision         | input                          | {input}                       | ✓       | TS   | hearingsApi                          |
| hearing_delete                  | id                             | {id}                          | ✓       | TS   | hearingsApi                          |
| case_create                     | input                          | {input}                       | F5      | TS   | casesApi                             |
| case_update                     | input                          | {input}                       | ✓       | TS   | casesApi                             |
| case_get                        | id                             | {id}                          | ✓       | TS   | casesApi                             |
| case_list                       | input                          | {input}                       | ✓       | TS   | casesApi                             |
| case_archive                    | id                             | {id}                          | ✓       | TS   | casesApi                             |
| case_restore                    | id                             | {id}                          | ✓       | TS   | casesApi                             |
| case_add_opponent               | input                          | {input}                       | ✓       | TS   | casesApi                             |
| case_update_opponent            | input                          | {input}                       | ✓       | TS   | casesApi                             |
| case_remove_opponent            | id                             | {id}                          | ✓       | TS   | casesApi                             |
| search_global                   | query                          | {query}                       | ✓ (F14) | TS   | searchApi                            |
| search_rebuild_index            | —                              | —                             | ✓ (F2)  | TS   | **none**                             |
| task_create                     | input                          | {input}                       | ✓ (F7)  | TS   | tasksApi                             |
| task_update                     | input                          | {input}                       | ✓       | TS   | tasksApi                             |
| task_list                       | input                          | {input}                       | ✓       | TS   | tasksApi                             |
| task_complete                   | id                             | {id}                          | ✓       | TS   | tasksApi                             |
| task_reopen                     | id                             | {id}                          | ✓       | TS   | tasksApi                             |
| task_delete                     | id                             | {id}                          | ✓       | TS   | tasksApi                             |
| dashboard_get_summary           | today                          | {today}                       | ✓       | TS   | dashboard/pages/DashboardPage        |
| attachment_select_source        | —                              | —                             | ✓       | TS   | documents/components/AttachmentPanel |
| attachment_add                  | input                          | {input}                       | ✓       | TS   | documentsApi                         |
| attachment_list                 | input                          | {input}                       | ✓       | TS   | documentsApi                         |
| attachment_update               | input                          | {input}                       | ✓       | TS   | documentsApi                         |
| attachment_open                 | id                             | {id}                          | ✓       | TS   | documentsApi                         |
| attachment_reveal               | id                             | {id}                          | ✓       | TS   | documentsApi                         |
| attachment_remove               | id                             | {id}                          | ✓       | TS   | documentsApi                         |
| fee_agreement_save              | input                          | {input}                       | ✓ (F7)  | TS   | financesApi                          |
| payment_save                    | input                          | {input}                       | ✓       | TS   | financesApi                          |
| payment_list                    | input                          | {input}                       | ✓       | TS   | financesApi                          |
| expense_save                    | input                          | {input}                       | ✓       | TS   | financesApi                          |
| expense_list                    | input                          | {input}                       | ✓       | TS   | financesApi                          |
| finance_case_summary            | id                             | {id}                          | ✓       | TS   | financesApi                          |
| finance_client_summary          | id                             | {id}                          | ✓       | TS   | financesApi                          |
| reminders_refresh               | today, now_time                | {today,nowTime}               | ✓       | TS   | app/App.tsx                          |

**Notes on the table:**

- **Money:** amounts are i64 on the Rust side. TS `parseMoneyToMinor` caps each amount at `Number.isSafeInteger`; Rust has no upper bound, but sums beyond 2^53 are not realistic.
- **Dates:** date-only strings are validated server-side for cases, finance and hearings.

## Not verified

- The real installer and runtime on Windows and macOS.
- Whether Tauri's exact deserialization error text matches what F4 assumes. That it arrives as a plain string follows from Tauri's `InvokeError` for argument errors.

**Key files:**

- `src-tauri/src/lib.rs`
- `src-tauri/src/dto/mod.rs`
- `src/bridge/commands.ts`
- `src/bridge/types.ts`
- `src/bridge/errors.ts`
- `src/bridge/commands.contract.test.ts`
- `src-tauri/src/services/search_service.rs`
- `src-tauri/src/services/client_service.rs`
- `src-tauri/migrations/0001_canonical_legal_masr.sql`
- `docs/RELEASING.md`
- `docs/forms-inventory.md`
- `docs/plan/03-data-model.md`
- `scripts/guide-content.mjs`
- `.github/workflows/release.yml`
- `vite.config.ts`

## Transcript agent-a2819a070a0d4fcd2.jsonl

## Review: Clients, Powers of Attorney (POA), Documents/Attachments

I made no changes to the repo. `git status` shows only the `.gitignore` change that was there before I started. Two findings (F1, F4) were checked with throwaway probes outside the repo, both since deleted:

- **F1:** a vitest probe in /tmp/lmprobe that rendered the real components.
- **F4:** a sqlite3 script that rebuilt the foreign key behaviour.

Existing tests pass:

- **Vitest:** domainForms, workflows, documents and bridge, 139 tests.
- **Cargo:** `cargo test --lib`, 52 tests.

### Findings

**F1 — HIGH — Saving a client from inside the POA form also submits the POA form** (confirmed)

- **Where:** src/features/powersOfAttorney/components/PowerOfAttorneyForm.tsx:59-80 and :277-282; src/components/ui/Dialog.tsx:44 (dialogs render in a Base UI portal).
- **Cause:** `InlineClientCreateDialog` renders a `<ClientForm>` (its own `<form>`) inside the POA `<form>`'s React tree. React submit events bubble through portals. RHF `handleSubmit` calls `preventDefault` but not `stopPropagation`, so the outer `onSubmit` also runs.
- **Probe result:** after filling the POA number and clicking "حفظ الموكل وربطه بالتوكيل", the POA `onSubmit` was called twice with `{"internalSequence":"TA-1","clientIds":[],"lawyers":[]}`.
- **Scenario A:** no client selected yet. The backend returns `VALIDATION_FAILED` and the add-POA dialog shows a confusing "تعذر حفظ التوكيل" error.
- **Scenario B:** client A is already ticked, then the lawyer adds client B inline. The POA is created early with only A. PowersOfAttorneyPage then closes the dialog and navigates away, so B is never linked. The second call hits the UNIQUE `internal_sequence` constraint.
- **Test gap:** domainForms.test.tsx "creates a client from a power of attorney…" never asserts that the POA submit was not called.
- **Fix:** in `InlineClientCreateDialog`, stop propagation on the inner form's submit (wrap it in `<div onSubmit={e => e.stopPropagation()}>` or pass a `stopPropagation` prop to `ClientForm`). Alternatively, ignore the event in the outer handler when `event.target !== event.currentTarget`.

**F2 — HIGH — A duplicate client internal number or POA internal number gives a generic, unexplained error** (confirmed)

- **Where:** migration 0001 line 57 (`internal_number … UNIQUE`) and line 75 (`internal_sequence … UNIQUE`); errors/mod.rs:99 maps `Sql(_)` to `OPERATION_FAILED`.
- **Messages shown:**
  - New client page: "تعذر إتمام العملية. لم تتغير بياناتك؛ حاول مرة أخرى".
  - Client edit dialog (ClientDetailPage.tsx:336-339): `records.saveRetry`, which ignores the error code.
  - POA add/edit (PowersOfAttorneyPage.tsx:115-119, PowerOfAttorneyDetailPage.tsx:394-398): `poa.saveError`, which also ignores the code.
- **Scenario:** a lawyer re-uses file number "CL-12". Retrying can never succeed, and nothing says the number is taken.
- **Fix:**
  - Add `Error::DuplicateInternalNumber` (or check before insert/update in client_service and power_of_attorney_service), or map `SQLITE_CONSTRAINT_UNIQUE` on these columns.
  - Add the code to `appErrorCodes` and to the ar/en `errors.*` translations.
  - Show it on the internal-number field via `errorMessage(...)`.
  - Add a failure-path test.

**F3 — HIGH (plausible) — Native pickers and the export folder dialog block inside sync commands**

- **Where:** document_service.rs:195-201 (`blocking_pick_file`), client_service.rs:194 (`blocking_pick_folder`).
- **Relation to known issue:** related to the known "sync on main thread" item, but with a separate consequence. Tauri documents `blocking_*` dialogs as not to be used on the main thread. On macOS (NSOpenPanel must run on the main thread), and possibly with GTK on Linux, the main thread waits on itself and the app can hang when "اختيار ملف" is clicked.
- **Why tests don't catch it:** desktop E2E skips the real picker (`#[cfg(feature = "desktop-e2e")]` `desktop_e2e::selection`), so no automated test runs it.
- **Fix:** make these commands `async`, or use the callback `pick_file` with a oneshot channel.
- **To confirm:** check on a real macOS/Windows device (device-validation-runbook row "Native attachment picker").

**F4 — HIGH (latent, confirmed in SQL) — Editing a POA that a case uses always fails**

- **Where:** power_of_attorney_repository.rs:44-53 (`replace_clients` runs `DELETE FROM power_of_attorney_clients WHERE power_of_attorney_id=?` and then re-inserts); migration lines 138-140 (`case_clients` has `FOREIGN KEY (power_of_attorney_id, client_id) … ON DELETE RESTRICT`); `PRAGMA foreign_keys=ON` (db/mod.rs:50).
- **Repro:** the sqlite3 script failed with "FOREIGN KEY constraint failed" even though the same row is re-inserted in the same transaction.
- **Scenario:** once any `case_clients` row has `power_of_attorney_id` set, every POA save fails with the generic `OPERATION_FAILED`, even a notes-only edit. Such rows can come from `case_create` (it accepts `powerOfAttorneyId`), from a restored backup, or from future UI.
- **Fix:**
  - Diff the client set instead of delete-all: delete only removed clients, insert only new ones.
  - Before removing a client that a case still uses with this POA, return a specific translated error.
  - Add a test.

**F5 — MEDIUM — Cleared or blank optional client fields are stored as `""`, not NULL** (confirmed by probe)

- **Where:** client.schema.ts:6-10 (`z.string().trim().optional()`); client_service.rs:130-135, :166-171 (no `clean()`, unlike POA and document services).
- **Probe:** `ClientForm` submits `{"nationalId":"","primaryPhone":"","email":"","address":"","notes":""}` even for untouched fields.
- **Effects:** the DB holds `''`; `normalized_phone` is `''`; the search-index subtitle is `Some("")`; the export shows empty strings; any future `IS NULL` logic or unique index on national ID would break.
- **Fix:** apply `clean()` in client_service for all optional fields, or map empty strings to undefined in the zod schema.

**F6 — MEDIUM — No validation of national ID, phone or email anywhere**

- **Where:** ClientForm.tsx:51-64; client_service.rs:100. The hint `clients.form.nationalIdHint` says "14 رقمًا" but nothing enforces it.
- **What gets through:** `type="email"` is disabled by `noValidate`; the backend accepts any text, Arabic-Indic digits, letters, and any length. Missing digits, 13- or 15-digit IDs and malformed emails are all saved.
- **Fix:** add zod rules (allow an empty value, or 14 digits after converting Arabic-Indic digits; phone digits/+/spaces; email format) mirrored in Rust, with translated field errors.

**F7 — MEDIUM — Duplicate detection misses Arabic-Indic phones and near-identical names**

- **Where:** normalize.rs:1-3 (`normalize_phone` keeps only `is_ascii_digit`); client_repository.rs:397 (`full_name = ?2` exact match).
- **Scenarios:**
  - "٠١٠٠١٢٣٤٥٦٧" normalizes to `""`, so it is filtered out (client_service.rs:114) and never matches "01001234567".
  - "أحمد علي" vs "احمد علي", or a double space between names, is not flagged.
  - Candidates include archived clients with no archived marker.
- **Fix:** convert Arabic-Indic digits in `normalize_phone`; compare `normalize_text(full_name)` (store a normalized-name column, which needs a new migration); also compare `national_id`.

**F8 — MEDIUM — "Add the client anyway" saves stale values**

- **Where:** NewClientPage.tsx:27, :72; PowerOfAttorneyForm.tsx:335, :373.
- **Scenario:** after the duplicate warning, the lawyer edits a field (for example corrects the phone) and clicks "إضافة الموكل رغم التشابه". The `pendingValues` snapshot is saved and the edit is silently lost.
- **Fix:** clear the warning and `pendingValues` on any form change, or re-submit the current form values with `confirmDuplicate=true`.

**F9 — MEDIUM — List search is not normalized and differs from global search**

- **Where:** client_repository.rs:357-364; power_of_attorney_repository.rs:144-150.
- **Gaps:**
  - Raw `LIKE '%q%'`, so "احمد" does not find "أحمد".
  - Arabic-Indic digits do not match Latin digits.
  - A phone search uses the formatted `primary_phone`, not `normalized_phone`, so "01001234567" does not match "0100 123 4567".
- **Note:** this is separate from the known unescaped-LIKE item.
- **Fix:** search the normalized columns, or reuse `normalize_text` on both sides.

**F10 — MEDIUM — POA list: the search placeholder promises notary office, and searching by client name hides co-clients**

- **Where:** power_of_attorney_repository.rs:146-152; `poa.searchPlaceholder` in ar/en.
- **Placeholder:** "ابحث برقم التوكيل أو الموكل أو مكتب التوثيق", but `notary_office` is not in the WHERE clause.
- **Co-clients:** the `c.full_name LIKE ?2` filter applies before `GROUP BY`, so `group_concat` only contains the matching client. A POA for "أحمد، سارة" searched by "سارة" shows only "سارة".
- **Fix:** move the name match into `EXISTS(...)` as the `client_id` filter already does; add `notary_office LIKE`.

**F11 — MEDIUM — Global search index is inconsistent and goes stale**

- **Phone not indexed on create/update:** client_service.rs:90 indexes `"{internal_number} {full_name}"` without the phone, but `rebuild_index` (search_service.rs:45) includes the phone. Phone search works only after a manual rebuild.
- **Stale POA entries:** a client rename (client_service.rs:175) does not re-index the POAs whose index text includes client names (power_of_attorney_service.rs:24-44).
- **Frontend:** client mutations (clientsApi.ts:16, 25, 36, 44) invalidate only `clients.all`, not `search.all` or `powersOfAttorney.all`.
- **Archived records:** they stay in the index with no marker.
- **Fix:** share one client index function between upsert and rebuild; re-index affected POAs on client update; invalidate search and POA queries.

**F12 — MEDIUM — Client file hides the client's archived cases**

- **Where:** ClientDetailPage.tsx:27 calls `useCaseList({ clientId: id })` with `include_archived` defaulting to false (case_repository.rs:140). The POAs tab passes `includeArchived: true` (line 28).
- **Effect:** the tab count and list omit archived cases, and `CaseStatusBadge archived` can never be true there.
- **Fix:** pass `includeArchived: true`.

**F13 — MEDIUM — POA edit form hides linked archived clients but still submits them**

- **Where:** PowerOfAttorneyForm.tsx:40 (`useClientList({})` returns active clients only), :41-42 (`selectedClientIds` keeps all linked IDs), :123-139.
- **Effect:** the lawyer cannot see or untick the archived client, and the form re-saves it silently.
- **Also:** the checkbox list has no search and renders every client. With hundreds of clients it is unusable.
- **Fix:** show the selected archived clients (with an "archived" badge); add a filter box.

**F14 — MEDIUM — A typed but un-added lawyer is silently dropped**

- **Where:** PowerOfAttorneyForm.tsx:152-188, :66-76. The lawyer is only added via "إضافة محامٍ".
- **Scenario:** the lawyer types a name and bar number, then clicks "حفظ التوكيل". The lawyer is not saved and there is no warning.
- **Fix:** auto-add pending non-empty input on submit, or block the submit with a message.

**F15 — MEDIUM — POA form has no client-side validation; every failure shows one generic message**

- **Required client:** `clientIds` must be non-empty (power_of_attorney_service.rs:54), but the UI does not mark it as required or check it.
- **Required number:** the internal number relies on the native `required` tooltip, which is in the OS language.
- **Dates:**
  - **Enter bypasses normalization:** the date is read from FormData (line 63). If "٣/١٠/٢٠٢٦" is typed and Enter pressed, the DatePicker's on-blur normalization never runs. `issueYear` becomes `Number("٣/١٠")` = NaN (sent as null) and `issueDate` fails `valid_date`.
  - **Impossible dates:** an invalid date such as "2026-02-30" is not caught in the UI.
- **Result:** all of these return `VALIDATION_FAILED` and show only `poa.saveError`.
- **Fix:** validate in the UI (client count, `normalizeTypedDate`); use `errorMessage()`.

**F16 — MEDIUM — Attachment metadata errors force a re-pick and show a misleading message**

- **Where:** AttachmentPanel.tsx:230-249; document_service.rs:44-61.
- **Scenario:** the document date is typed as "3/10/2026" and Enter is pressed, or "2026-02-30" is entered. Nothing is checked in the UI and the backend returns `VALIDATION_FAILED` before consuming the token. The UI has already cleared the source (`setSource(null)`) and shows `documents.copyError` ("تعذر حفظ نسخة من الملف. اختره مرة أخرى"), which says the copy failed when the problem was the date.
- **Fix:** validate or normalize the date before submitting; keep the token unless the error is a source or copy error; map `VALIDATION_FAILED` to a date or field message.

**F17 — MEDIUM — Attachment add loads the whole file into memory, with no size limit**

- **Where:** document_service.rs:125-137 (`copy` then `read` of the entire file for hashing), :245.
- **Scenario:** a multi-GB scanned PDF or video can use huge amounts of RAM or crash the app, on the main thread.
- **Fix:** stream the hash (`io::copy` into a `Sha256` writer) and set a configurable size cap with a translated error.

**F18 — MEDIUM — `client_export` is incomplete and leaks other clients' data**

- **Where:** client_service.rs:232-273.
- **Missing:** POAs, POA and case attachments (only client-owned attachment metadata, no files), case tasks without `client_id`, and fee agreements.
- **Leaked:** fully hydrated shared cases, including co-clients' names and internal numbers, opponents, and all hearings.
- **File handling:** writes plaintext JSON (national ID, phone, notes) to `client-{uuid}.json`, silently overwriting an existing file, with a non-atomic `fs::write`.
- **Reachability:** no UI calls it (documented in 04-functional-modules.md), and its folder picker is subject to F3.
- **Fix:** define a scope (include POAs; redact co-clients), check for an existing file, write atomically, and test it.

**F19 — LOW — Not-found IDs show "load error" instead of "not found"**

- **Where:** ClientDetailPage.tsx:39-45; PowerOfAttorneyDetailPage.tsx:163-169.
- **Cause:** the backend returns `CLIENT_NOT_FOUND` / `POWER_OF_ATTORNEY_NOT_FOUND` as errors, so `isError` shows `records.loadError` ("حاول مرة أخرى") and the `notFound` branch can never run.
- **Related:** client_repository.rs:349 maps every SQL error, including "DB locked", to `ClientNotFound`. errors.CLIENT_NOT_FOUND says "ربما أُرشف", but archived records still load.

**F20 — LOW — Edit dialogs reopen with the previous failure message**

- **Where:** `update.isError`, `save.isError` and `actionError` are not reset when a dialog closes (ClientDetailPage.tsx:336; PowerOfAttorneyDetailPage.tsx:394; PowersOfAttorneyPage.tsx:115).
- **AttachmentPanel:** clicking "Remove" after a failed open shows "تعذر فتح المستند" inside the remove confirmation (lines 358-363, 461).
- **Fix:** call `mutation.reset()` and `setActionError(null)` when a dialog opens.

**F21 — LOW — Editing a POA drops a year-only `issue_year`**

- **Where:** PowerOfAttorneyForm.tsx:70.
- **Scenario:** records with `issue_year` but no `issue_date` (allowed by the schema, possibly from legacy data or restore) lose the year on any edit.

**F22 — LOW — Attachment remove reports failure after it has already deleted the record**

- **Where:** document_service.rs:179-181. If deleting the staged file fails after the DB delete, an error is returned although the record is gone. The UI shows `removeError` and an orphan `.deleting` file is left. This is tested as "reported", but the message is misleading.

**F23 — LOW — Backend allows anything the UI doesn't offer**

- No length limits on any text field.
- POA and attachments can be linked to archived clients; edits and attachment adds are allowed on archived clients and POAs.
- POA `client_ids` that don't exist give `OPERATION_FAILED`, not `CLIENT_NOT_FOUND`.
- `issue_year` and `issue_date` can disagree.
- Archiving an already-archived record overwrites `archived_at`.

**F24 — LOW — UI and accessibility nits**

- POA detail clients tab (PowerOfAttorneyDetailPage.tsx:314): client name not wrapped in `<bdi>`.
- POA client checkboxes: `aria-label` is the name only, so two clients with the same name are indistinguishable.
- The global Documents owner for a POA shows only "توكيل" with no number.
- `AttachmentOwner` fetches the full case and client lists.
- Client list search runs on every keystroke with no debounce.
- Sort order is `ORDER BY full_name` / `internal_sequence` in binary order: hamza variants are scattered and "TA-10" sorts before "TA-2".
- No pagination.
- `tel:` link in the client header (ClientDetailPage.tsx:73): behaviour in the Tauri webview is unverified.
- Duplicate-candidate links on the new client page navigate away and lose the draft.

**F25 — LOW (plausible) — Opening an attachment runs executables**

- **Where:** document_service.rs:323-326. `open_path` on an attached .exe, .bat or .sh runs it. There is no file-type allowlist or warning.

### Errors mapping

- Every `Error` variant these commands can return has a code in `appErrorCodes` and translations in ar and en.
- The gap is usage: client edit, POA save and attachment add/update ignore the code and show generic text (F2, F15, F16).
- `Sql`, `Io` and `Json` all become `OPERATION_FAILED`, which hides unique-constraint failures (F2).

### Test gaps

- No service-level tests for:
  - client create/update/duplicate detection, including Arabic digits.
  - Empty-string to NULL conversion.
  - POA save when a case uses the POA (F4).
  - POA list search output.
  - Client export.
- No UI tests for:
  - The nested-form submit (F1).
  - The stale duplicate confirmation (F8).
  - A pending lawyer entry (F14).
  - Date normalization on Enter (F15/F16).
  - Archived linked clients in the POA form (F13).
  - Specific duplicate-number error messages.

### Coverage table

**Clients list:**

| Item                                        | Status    |
| ------------------------------------------- | --------- |
| Title, kicker, description (ar/en)          | ✓         |
| Add button → /clients/new                   | ✓         |
| Search box (aria-label ✓)                   | F9, F24   |
| Show archived checkbox                      | ✓         |
| Loading / error / empty / no-results states | ✓         |
| Columns: name, internal no., phone, status  | ✓ (bdi ✓) |
| Sorting / pagination                        | F24       |

**New client:**

| Item                                    | Status                |
| --------------------------------------- | --------------------- |
| Full name (required, trimmed, labelled) | ✓; duplicate check F7 |
| Internal number                         | F2                    |
| National ID                             | F5, F6                |
| Phone                                   | F5, F6, F7            |
| Email                                   | F5, F6                |
| Address                                 | F5                    |
| Notes                                   | F5                    |
| Save button (pending/disabled ✓)        | ✓                     |
| Cancel                                  | ✓                     |
| Error display                           | F2                    |
| Duplicate warning and confirm           | F7, F8, F24           |
| Navigate to detail after create         | ✓                     |
| Invalidation                            | F11                   |

**Client detail:**

| Item                            | Status                    |
| ------------------------------- | ------------------------- |
| Loading                         | ✓                         |
| Error / not-found               | F19                       |
| Header: name, number, phone     | ✓ (`tel:` F24)            |
| New case (hidden when archived) | ✓                         |
| Edit                            | F2, F20, F23              |
| Archive confirm                 | ✓                         |
| Restore                         | ✓                         |
| Summary facts                   | ✓ (F5)                    |
| Cases tab                       | F12                       |
| POAs tab                        | ✓ (no create-from-client) |
| Account tab                     | ✓                         |
| Attachments tab                 | see attachment panel      |
| Export                          | F18 (no UI)               |

**POA list:**

| Item                                                 | Status               |
| ---------------------------------------------------- | -------------------- |
| Add dialog                                           | F1, F2, F15          |
| Search                                               | F9, F10              |
| Show archived                                        | ✓                    |
| States                                               | ✓                    |
| Columns: internal no., official no., clients, status | F10 (clients column) |
| Clickable rows                                       | ✓                    |

**POA form:**

| Item                             | Status                  |
| -------------------------------- | ----------------------- |
| Internal number                  | F2, F15                 |
| Official number                  | ✓                       |
| Issue date                       | F15, F21                |
| Notary office                    | ✓ (not searchable, F10) |
| Client checkboxes                | F13, F24                |
| Add new client inline            | F1, F8                  |
| Lawyer name, bar no., notes, add | F14                     |
| Remove lawyer                    | ✓                       |
| Notes                            | ✓                       |
| Save (busy ✓)                    | F15                     |
| Cancel                           | ✓                       |

**POA detail:**

| Item              | Status               |
| ----------------- | -------------------- |
| States            | F19                  |
| Header            | ✓                    |
| Edit              | F4, F20              |
| Archive / restore | ✓                    |
| Summary tab       | ✓                    |
| Clients tab       | F24                  |
| Lawyers tab       | ✓                    |
| Cases tab         | ✓                    |
| Documents tab     | see attachment panel |

**Attachment panel / Documents page:**

| Item                                                            | Status   |
| --------------------------------------------------------------- | -------- |
| List states                                                     | ✓        |
| Filename bdi, extension mark, category, date, size, description | ✓        |
| Owner link                                                      | F24      |
| Open                                                            | F25      |
| Show in folder                                                  | ✓        |
| Edit metadata (clearing description/date → NULL works)          | F16      |
| Remove (destructive confirm ✓)                                  | F20, F22 |
| Add: pick file                                                  | F3       |
| Category select (8 values match the DB CHECK)                   | ✓        |
| Description                                                     | ✓        |
| Date                                                            | F16      |
| Save                                                            | F16, F17 |
| Global page is read-only                                        | ✓        |

**Cross-cutting:**

| Item                                                                                                   | Status                                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| i18n: all 213 `t()` keys present in ar and en                                                          | ✓; copy mismatches in F6 (ID hint), F10 (POA placeholder), F19 (not-found text) |
| Form labels bound to inputs (`Field` htmlFor/aria-describedby ✓, wrapping labels in POA/attachments ✓) | ✓                                                                               |
| Money in minor units, date-only values                                                                 | ✓                                                                               |
| Transactions: create/update/archive and index in one transaction                                       | ✓                                                                               |
| Attachment copy rollback                                                                               | ✓                                                                               |

## Transcript agent-a2ade864b51dae158.jsonl

## Agent 5 review: app shell, onboarding, shared UI, i18n, error mapping, RTL and a11y

I found two blockers or near-blockers in the shell. The translation catalogue is in very good shape: nothing is missing, no keys are unused, and only two hard-coded strings turned up.

**Validation run:**

- Existing tests: `vitest run src/app src/components src/i18n src/bridge src/features/onboarding` gave 9 files and 113 tests, all passing.
- My throwaway scripts and tests are in `/tmp/legal-masr-review/agent5/`:
  - `parity.py`, `usage.py`, `jsx.cjs` (a TypeScript-AST scan for hard-coded strings), `css.py`, `contrast.py`.
  - `sheet.test.tsx`, `dp.test.tsx` and `cb.test.tsx`, run with a tmp vitest config that imports repo modules.
- No repo files were edited.

### Findings

**F1. BLOCKER: a large auto-lock timeout locks the app straight after every unlock.**

- **Where:** `src/components/layout/Shell.tsx:30`, `src/features/settings/schemas/settings.schema.ts:9`, `src-tauri/src/services/settings_service.rs:28`
- **Scenario:** The user sets the timeout to 40000 minutes ("about a month"). After that, every unlock locks again almost at once.
- **Evidence:**
  - The timer is `setTimeout(onLock, lockTimeoutMinutes * 60_000)`.
  - The front end only checks `z.number().int().min(1)` with no maximum, and the backend only rejects 0.
  - Browser and WebView timers store delays as a signed 32-bit number, so anything above 2,147,483,647 ms (35,791 minutes, about 24.8 days) wraps. Values from 35,792 to about 71,582 minutes become a delay of about 0 ms.
  - The setting can only be changed while unlocked, so the user is effectively locked out of the UI.
- **Fix:** Clamp the timeout front and back (for example 1–1440 minutes, with a `max` on the input). In `Shell`, clamp the delay to 2³¹−1 or chain the timers.
- **Confidence:** High for the overflow mechanism. I did not reproduce it in the native WebView.

**F2. HIGH: the mobile/narrow-window menu button opens the search palette, not the navigation drawer.**

- **Where:** `src/components/layout/Shell.tsx:83-84, 105, 177-219`
- **Scenario:** At window widths of 980 px or less the sidebar is hidden. That includes the allowed minimum of 760 px and common 1366/1280 laptops at 125–150% scaling. Clicking the hamburger opens the command palette, and the drawer renders behind it but is unusable.
- **Evidence:**
  - Two `Sheet.Root`s are nested. Every `Sheet.Trigger` and both `Sheet.Portal`s sit inside the inner (palette) root, and Base UI `Dialog.Trigger`/`Portal` bind to the nearest root context.
  - I reproduced it with Base UI 1.8. After clicking the trigger the state was `drawer=false palette=true`, and both popups mounted. The drawer popup was `aria-hidden` (outside the palette's focus trap) and focus went to the palette input.
  - The drawer's `onNavigate` and lock handlers call `setDrawerOpen(false)`, which does nothing because the drawer state was never true, so the overlays stay open.
  - Ctrl+K at this width also shows both overlays.
- **Fix:** Use two sibling `Sheet.Root`s, each with its own trigger and portal (or Base UI detached triggers via `handle`). Add a test that opens the menu and asserts the drawer nav is reachable.
- **Confidence:** High.

**F3. HIGH: a `DatePicker` wired with react-hook-form `register()` shows an empty field while the form still holds the old date.**

- **Where:** `src/components/ui/DatePicker.tsx:55-60`; used at `src/features/cases/forms/CaseCoreFields.tsx:110,113`, for the case create and case edit fields `filedOn` and `closedOn`.
- **Scenario:** On "edit case" the filed and closed dates look empty, but submitting keeps the old dates. Users will retype dates they think are missing, cannot see a date in order to clear it, and validation errors can refer to values they cannot see.
- **Evidence:**
  - The internal `textValue` is initialised from `value ?? defaultValue`, and `register()` passes neither; RHF sets the DOM value through the ref, and the next React render overwrites it.
  - Reproduced: with `defaultValues {filedOn:'2026-01-05'}` the input shows `""` before and after a re-render, and submit sends `{"filedOn":"2026-01-05"}`.
- **Fix:** Use RHF `Controller` for `DatePicker`, or have `DatePicker` read the DOM value on the ref callback (`useImperativeHandle` / sync from `ref.value`).
- **Confidence:** High.

**F4. HIGH: dark mode fails contrast on primary and destructive buttons and all "active" accents.**

- **Where:** `src/styles/styles.css:53-71, 73-90` (dark tokens), `4749` (`--color-primary-foreground:#fff`), `733-736`, `861`, plus the white-on-accent rules at about 342, 1397, 2369, 2440, 2560, 2629.
- **Evidence:**
  - White on dark `--accent` #52b8a5 is 2.40:1. This affects default `Button`, `.shared-tabs .active`, `.segmented .active`, today's calendar badge, `.button-link` and the finance-net card.
  - The destructive button (white on #ffb4ab) is 1.70:1.
  - Only `.create-button` has a dark override (line 3150).
- **Fix:** Add a `--on-accent` token (dark value around #06201b, as `.create-button` already uses) and use it for `--color-primary-foreground` and every `color:#fff` on accent or danger.
- **Confidence:** High (computed).

**F5. MEDIUM: the Ctrl+K shortcut does not work with the Arabic keyboard layout.**

- **Where:** `src/components/layout/Shell.tsx:56`
- **Evidence:** It checks `event.key.toLowerCase() === 'k'`. With the Arabic layout active, `event.key` is 'ن'. Egyptian lawyers type in Arabic most of the time.
- **Fix:** Check `event.code === 'KeyK'`. Also, the `<kbd>Ctrl K</kbd>` hint (line 112) is hard-coded and wrong on macOS, where the shortcut is ⌘K.
- **Confidence:** High.

**F6. MEDIUM: the interface language chosen before unlocking is never kept.**

- **Where:** `src/i18n/index.ts:14-24`, `src/components/layout/LanguageSwitcher.tsx:16-30`, `src/app/App.tsx:29-37`
- **Scenario:**
  - The app always starts in Arabic, so an English user sees the Arabic unlock screen on every launch.
  - If they switch to English on the lock screen, settings are unavailable while locked (`useSettings` is only enabled when unlocked), so nothing is saved.
  - After unlock, `LocaleSync` switches back to the stored language. This is intended per App.test, but it is surprising.
- **Fix:** Keep a non-sensitive UI language preference outside the vault (a localStorage hint) and use it for the initial `lng`. If the user toggles before unlock, write it after unlock.
- **Confidence:** High.

**F7. MEDIUM: if the app closes during the recovery-key step, the key is lost for good.**

- **Where:** `src/app/App.tsx:163-169`, `src/features/onboarding/pages/OnboardingPage.tsx:86-104`
- **Scenario:** After setup the vault is already initialised and unlocked. The key exists only in React state. Closing the window, a crash or a reload before ticking "I saved it" means the next start goes straight to unlock with no key ever shown.
- **Evidence:** There is no command to regenerate the recovery key (I grepped Rust and TS). The step also has no copy or print button, and its `<code aria-label>` label is ignored because the code role cannot be named.
- **Fix:** Add a "regenerate recovery key" action in Settings → Security (re-wrap with the master key, after asking for the password). Add a copy-to-clipboard button.
- **Confidence:** High.

**F8. MEDIUM: the auto-lock timer only resets on `pointerdown` and `keydown`, and the "lifecycle gap" check can lock unexpectedly.**

- **Where:** `src/components/layout/Shell.tsx:23-52`, `src/lib/lifecycleLock.ts`
- **Scenario:**
  - Someone reading a long case file with the mouse wheel or trackpad, with no clicks, is locked out after the timeout and loses unsaved dialog drafts.
  - The 1-second interval locks whenever it sees a gap of 5 s or more. That covers any blocked JS thread and, on WebView2, a minimized window whose timers get heavily throttled, not only system sleep.
  - `onLock` is a new inline function on every `AppContent` render (`App.tsx:128`), so the effect tears down and re-arms on each render.
- **Fix:** Also listen for `wheel`, `scroll` and `pointermove` (throttled). Use `useCallback` for `onLock`. Consider `visibilitychange` together with a much larger gap threshold.
- **Confidence:** Medium. I did not test the throttling behaviour natively.

**F9. MEDIUM: date typing conflicts with native form validation.**

- **Where:** `src/components/ui/DatePicker.tsx:83-84`
- **Scenario:** In a form without `noValidate`, the user types `٣/١٠/٢٠٢٦` or `3/10/2026` (the format the Arabic placeholder suggests) and presses Enter. Normalisation only runs on blur, so native validation against `pattern="[0-9]{4}-…"` blocks the submit. The error bubble shows the `title` text, which tells them to type exactly what they just typed.
- **Evidence:**
  - Forms without `noValidate`: TasksPage:344, AgendaPage:570/669, FinancesPage:432/548, PowerOfAttorneyForm:59, CaseEditForm:41, AttachmentPanel:305.
  - The English placeholder says `YYYY-MM-DD` while the English title says `DD/MM/YYYY`.
- **Fix:** Drop `pattern`, normalise on Enter/change as well, and validate in the schema. Align the placeholder and title in both languages.
- **Confidence:** High.

**F10. LOW: hard-coded Arabic text and an Arabic list separator show in the English UI.**

- **Where:** `src/features/cases/components/CasePartiesPanel.tsx:45`, plus about 12 `.join('، ')` call sites (AgendaPage:72/530/601, TasksPage:131, DashboardPage:255/424, CaseListPage:111, FinancesPage:114, PowersOfAttorneyPage:91, CaseDetailPage:146, PowerOfAttorneyDetailPage:89/242).
- **Evidence:** `|| 'دون صفة مسجلة'` is hard-coded.
- **Fix:** Use a t() key, and `Intl.ListFormat` or a localized separator.
- **Confidence:** High.

**F11. LOW: some error and toast text bypasses translation.**

- **Where:** `src/bridge/errors.ts:46`, `src/app/providers.tsx` (Toaster)
- **Evidence:**
  - `errorMessage` returns string errors as-is. Tauri rejects with English strings, for example argument-deserialisation errors, and these reach users unlocalised.
  - Sonner's close button aria-label stays the English "Close toast" (no `closeButtonAriaLabel` / `containerAriaLabel` passed).
  - The toast position is not mirrored for RTL.
- **Fix:** Map string errors to the fallback (log only in dev). Pass translated aria labels to `Toaster`.

**F12. LOW: onboarding polish.**

- **Where:** `src/features/onboarding/pages/OnboardingPage.tsx`, `src/features/onboarding/schemas/onboarding.schema.ts:6`, `src/components/ui/Field.tsx`
- **Details:**
  - The mutation `error` lingers. A failed unlock, then switching to recovery and back, still shows the old "wrong password".
  - There is no Caps Lock warning.
  - The password is not cleared or refocused after a failure.
  - The show/hide control uses `aria-pressed` and also flips its label (it should be one or the other).
  - The minimum length is 12 on both sides, but the front end counts UTF-16 units (zod `.min`) while Rust counts `chars()`. Six emoji pass the front end and the backend rejects them with VALIDATION_FAILED.
  - The gate screens ignore the dark/system theme because `ThemeSync` only mounts when the app is ready.

**F13. LOW: smaller accessibility gaps.**

- **Where:** `src/app/App.tsx:155`, `src/components/ui/DatePicker.tsx:121`, `src/components/ui/Dialog.tsx:88-141`, `src/components/ui/Tabs.tsx:29-33`, `src/components/layout/LanguageSwitcher.tsx:10`, `index.html`
- **Details:**
  - The `Skeleton` loading `aria-label` sits on a role-less div and is never announced.
  - Calendar day buttons are labelled only with the day number, with no month or weekday, and in Western digits even in Arabic.
  - `ConfirmDialog`'s description is a plain `<p>` not linked through `Dialog.Description`, so it is not announced; destructive confirms are not `alertdialog`.
  - Tab counts are `aria-hidden`.
  - `LanguageSwitcher` shows "English"/"العربية" without a `lang` attribute.
  - The `index.html` title is fixed in Arabic and never follows the language.

**F14. LOW: light-theme contrast.**

- **Where:** `src/styles/styles.css:18-48`
- **Details:** `--muted` on `--canvas-warm` is 4.24:1, `--gold` text on paper is 4.09:1, and on `--gold-soft` it is 3.78:1. These are below AA 4.5 for normal text.

**F15. LOW: data could re-enter the cache after lock.**

- **Where:** `src/lib/vaultCache.ts`
- **Details:** `getMutationCache().clear()` does not stop the `onSuccess` of a mutation already in flight. A save that resolves after `clearVaultCache` can `setQueryData` record data back while the app is locked. Command ordering makes this unlikely today.
- **Fix:** Have mutation `onSuccess` handlers check `appStatus.unlocked`, or bump a lock epoch and ignore late results.
- **Confidence:** Low to medium.

### Checked and found OK

- **Error mapping:** All 21 `code()` variants in `errors/mod.rs` (Io, Sql, Json and Zip all map to OPERATION_FAILED) are listed in `errors.ts` and `types.ts` and translated in both languages. Unknown codes fall back to the caller's message.
- **Gate transitions:** setup → recovery-key → ready, locked → unlock, recovery → back to unlock, and backup restore → `clearVaultCache` → unlock are all correct. A failed lock keeps the current state.
- **CSS directionality:** Logical properties are used throughout. The only physical rules are deliberate `dir`-scoped overrides (date picker and password inputs) and LTR `code` blocks.
- **Fonts:** The Cairo Arabic and Latin woff2 files are present in `public/fonts`.
- **`Field`:** The `htmlFor`/id binding, `aria-describedby` and `aria-invalid` work, and they reach `Select`, `DatePicker`, `PasswordInput` and `Checkbox`.
- **`Checkbox`:** It is correctly named when wrapped in a `<label>` (verified).
- **Other components:** `Tabs` and `Select` use the Base UI DirectionProvider, so RTL arrow keys are handled. `Switch` mirrors in RTL.
- **Bidi:** Directional chevrons are swapped in RTL (AgendaPage). Phone numbers, national IDs and emails use `<bdi>`.

### Appendix A: translation parity (`ar` and `en` each have 738 flat keys)

- **Missing in either language:** none.
- **Empty values:** none.
- **Non-string values:** none.
- **Identical in both:** `gate.fields.languageAr` ("العربية") and `gate.fields.languageEn` ("English"). This is intentional.
- **Interpolation mismatch:** `backups.staleAdvice_two`, `dashboard.inDays_two` and `dashboard.overdueDays_two` have no `{{count}}` in Arabic. This is correct, because the Arabic dual form spells out the number.
- **Plural families:** `backups.staleAdvice`, `dashboard.inDays` and `dashboard.overdueDays` have all six forms (zero/one/two/few/many/other) in both languages.
- **`count` used without plural forms:** `gate.passwordHint`, `gate.passwordTooShort` (always 12, so the "حرفًا" form is correct), `cases.form.selectedClients`, `tasks.count`, `agenda.openTaskCount` and `agenda.completedTaskCount`. All are "Label: {{count}}" patterns, so grammar is fine.
- **Latin words in Arabic strings:**
  - `settings.privacy.*` mentions the folder "LegalMasterSolo" (correct per `db/mod.rs:30`).
  - `settings.privacy.documentsNote` names BitLocker or FileVault only, which is wrong on Linux. This is copy for another reviewer.

### Appendix B: usage analysis (all `.ts`/`.tsx` in src, with dynamic keys resolved against their enum types)

- **Literal t() keys missing from the catalogue (would show the raw key):** none, in app code or tests.
- **Dynamic key patterns (33 sites):** In every case the full set of values the variable can take is defined in both languages:
  - Error codes (21)
  - Case status and degree
  - Hearing status
  - Document category (8)
  - Payment method and expense type
  - Search groups (CLIENT, CASE, POWER_OF_ATTORNEY)
  - Task views and empty views; task state (completed, overdue, today, upcoming)
  - Gate kicker, title and intro for the four sub-gates
  - Settings tabs, themes, and about-contact kinds
  - Finance add, register and empty states
  - The `cases.detail` edit/new/inspect entries
- **Defined but never used:** none. Every key is either used as a literal or reachable through a dynamic prefix. 107 keys are reachable only through dynamic prefixes; the list is in `/tmp/legal-masr-review/agent5/usage.txt`.

### Appendix C: hard-coded user-visible strings (TypeScript-AST scan of JSX text and label/title/placeholder/alt/aria attributes, plus a grep for Arabic literals)

1. `src/components/layout/Shell.tsx:112`: `<kbd>Ctrl K</kbd>` (aria-hidden, but wrong on macOS and not localized)
2. `src/features/cases/components/CasePartiesPanel.tsx:45`: `'دون صفة مسجلة'`
3. `src/components/layout/LanguageSwitcher.tsx:10`: `'العربية'` / `'English'` (acceptable as endonyms, but `lang` is missing)
4. The `'، '` list separator at about 12 sites (see F10)
5. `src/components/ui/select.tsx`: the default placeholder `'—'` (neutral)
6. Sonner's built-in English "Close toast" aria-label (third-party)

### Coverage

| Area                                                                                                               | Checked                                                   |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `App.tsx` gate state machine, ThemeSync, LocaleSync, ReminderSync, lock error                                      | ✓ (F6, F7, F8, F15)                                       |
| `router.tsx` NAV_GROUPS and routes                                                                                 | ✓ OK                                                      |
| `providers.tsx` (DirectionProvider, Toaster)                                                                       | ✓ (F11)                                                   |
| `Shell.tsx` (nav, drawer, palette, Ctrl+K, lock, idle timer, footer)                                               | ✓ (F1, F2, F5, F8)                                        |
| `Icon`, `RecordHeader`, `PageHeader`                                                                               | ✓ OK (all icons aria-hidden)                              |
| `LanguageSwitcher`                                                                                                 | ✓ (F6, F13)                                               |
| `DeveloperContacts`                                                                                                | ✓ OK (bdi with dir=ltr, pending/failed states)            |
| Onboarding: setup, unlock, recovery, recovery-key screens, schema, API                                             | ✓ (F7, F12)                                               |
| `Dialog` / `ConfirmDialog`                                                                                         | ✓ (F13)                                                   |
| `DatePicker`                                                                                                       | ✓ (F3, F9, F13)                                           |
| `Select`, `Field`, `Tabs`, `Switch`, `Checkbox`, `Button`, `Input`, `Textarea`, `Skeleton`, `Sheet`, dropdown menu | ✓ (no loading-state variant on `Button`, only `disabled`) |
| i18n init, `LocalePresentation`, both catalogues                                                                   | ✓ (Appendices A and B)                                    |
| `bridge/errors.ts`, `invoke.ts`, `types.ts` error codes vs `errors/mod.rs`                                         | ✓ (F11)                                                   |
| `styles.css` (logical properties, mirroring, focus-visible, dark mode, contrast, breakpoints at 760/980)           | ✓ (F2, F4, F14)                                           |
| `index.html`, fonts                                                                                                | ✓ (F13)                                                   |

**Unresolved risks:**

- F1 and F8 were checked by reasoning about WebView timer behaviour, not on a native build.
- I did not do a visual check of the 760×560 layout.
- F15 depends on how the backend orders commands.

## Transcript agent-a4a69c940769d12de.jsonl

## Agent 1 report: security, vault lifecycle, backup/restore, attachments, migrations, logging

**Validation:** `cd src-tauri && cargo test` passes (66 tests: 52 unit and 14 integration, 0 failed). I did not edit the repo. I ran two throwaway probes:

- `/tmp/legal-masr-review/agent1/probe`: a crate that links `legalmaster_lib` and calls `db`, `backup` and `security` directly.
- `/tmp/legal-masr-review/agent1/take`: a standalone check of what happens to the key bytes when the vault locks.

Probe results:

- (a) `open_db` on a missing vault file silently creates it, and `migrate` brings it to schema 1.
- (d) `migrate` returns Ok on a database that records schema version 99.
- (c) After a restore, attachments added since the backup are permanently gone. Only `legalmaster.pre-restore-*.bak` (database only) survives.
- (f) 10 `open_db` calls take 83 ms, which confirms the raw-key PRAGMA path (no per-open key derivation).
- Lock probe: in an `-O` build the 32 key bytes are still in the mutex memory after `lock()`.

Line numbers refer to each file as it is in the repo.

---

### Findings

**F1 — HIGH — The "emergency copy" from a restore deletes all attachments added after the backup**

- **Where:** `src-tauri/src/backup/mod.rs:304-334`. UI copy is `backups.restoreWarning` / `restoreHint` in `src/i18n/*/common.json`.
- **Scenario:**
  1. The lawyer restores a 2-week-old backup (by mistake, or to recover one record).
  2. Every document attached since then is deleted for good.
  3. The pre-restore database is kept as `.bak`, but its attachment rows now point to files that no longer exist.
  4. Nothing in the app can bring back the `.bak`.
- **Why it matters:** the UI tells the user "Legal Masr keeps an emergency copy of your current data automatically", which is not true for documents.
- **Evidence:**
  ```rust
  let documents_emergency = documents_root.with_extension("pre-restore");
  ...
  if documents_emergency.exists() { let _ = fs::remove_dir_all(documents_emergency); }
  ```
  Probe (c) output after restore: only `A.pdf` remains, `B.pdf` is gone, and `legalmaster.pre-restore-….bak` is present.
- **Fix:** keep the attachments directory next to the `.bak` with the same restore id. Better: write a full automatic pre-restore `.lmsbackup` archive. Add a UI path to undo a restore, and correct the copy until then.
- **Confidence:** confirmed.

**F2 — HIGH — Native reminders only run while the vault is unlocked and the Shell is mounted**

- **Where:**
  - `src/app/App.tsx:39-65`: `ReminderSync` is rendered only when `gate === 'ready'` (line 124).
  - `src-tauri/src/services/reminder_service.rs:31`: `state.unlocked()?`.
- **Scenario:**
  - The app starts locked, including at autostart login.
  - It auto-locks after 15 minutes by default, and also on the 5 s "lifecycle gap" (F7).
  - So a lawyer who unlocks at 09:00 and then works elsewhere gets no 13:00 hearing reminder.
  - Autostart combined with reminders gives no benefit until the user unlocks.
- **Evidence:**
  ```tsx
  if (gate === 'ready') { return (<> ... <ReminderSync /> ...
  ```
  ```rust
  let master = state.unlocked()?;
  ```
- **Fix:** while the vault is unlocked, compute the day's generic reminder schedule (time and type only, no content) and keep it in Rust memory or in a small non-sensitive schedule file. Run a Rust-side timer that fires the generic notification even when locked. At minimum, tell the user in the UI that reminders require the app to be unlocked.
- **Confidence:** confirmed.

**F3 — MEDIUM-HIGH — Unlock silently creates a new empty vault when `legalmaster.sqlite` is missing; an interrupted restore leads straight there**

- **Where:**
  - `src-tauri/src/services/app_service.rs:124-125`
  - `src-tauri/src/db/mod.rs:47` (`Connection::open` creates the file)
  - `src-tauri/src/backup/mod.rs:310-324`
- **Scenario (interrupted restore):**
  1. Power loss or a crash happens after line 310 renames the live database to `pre-restore-N.bak` and before line 324 puts the staged copy in place.
  2. On next launch `security.json` exists, so the app shows Unlock. The password is correct.
  3. `open_db` creates a brand-new encrypted database and `migrate` fills it. The lawyer sees an empty practice and no error.
  4. The original attachments may still be in `attachments.pre-restore`. If the user then restores again, line 307 runs `fs::remove_dir_all(&documents_emergency)` and deletes them.
- **Other triggers:** antivirus quarantine, the user moving the file, or sync tools.
- **Evidence:** probe (a) prints `missing db created? true schema=1`. There is no startup recovery for `*.pre-restore*` or `*.restore.tmp`.
- **Fix:**
  - Open the database with `OpenFlags::SQLITE_OPEN_READ_WRITE` without `CREATE` everywhere except `initialize`, and map "not found" to a dedicated `VAULT_MISSING` code.
  - Write a restore journal/marker file and, at startup, roll forward or roll back an interrupted restore.
  - Never `remove_dir_all` an existing `attachments.pre-restore`.
- **Confidence:** confirmed (crash window inferred from the code; empty-vault creation confirmed by probe).

**F4 — MEDIUM — `lock()` leaves the master key in memory; the zeroize call has no effect**

- **Where:** `src-tauri/src/services/app_service.rs:130-136`.
- **Evidence:**
  ```rust
  if let Some(mut key) = state.master_key.lock()...?.take() { key.zeroize(); }
  ```
  `take()` moves the bytes out and only writes the `None` tag, so the old payload stays in the mutex memory. The zeroize then clears the moved copy only. The release-mode probe shows `is_none=true residual 0xAB bytes=32`.
- **More copies that are never wiped:**
  - every `state.unlocked()` returns a `Copy`, so each command leaves a copy on its stack;
  - derived password and recovery keys in `app_service`;
  - `backup_key`;
  - the `format!("x'{}'", hex::encode(master))` PRAGMA string at `db/mod.rs:48`;
  - IPC password `String`s;
  - the recovery-key `String`.
- **Fix:**
  - Call `guard.zeroize()` on the `Option` in place (zeroize implements this for `Option<Z>`), or store the key in `Zeroizing<[u8;32]>` / `secrecy::SecretBox`.
  - Wipe derived keys and the hex PRAGMA string with `Zeroizing<String>`.
  - Hand out `&` access instead of copies.
- **Confidence:** confirmed.

**F5 — MEDIUM — Unlock accepts a database with a newer schema (downgrade risk)**

- **Where:** `src-tauri/src/db/mod.rs:67-84`; `src-tauri/src/services/app_service.rs:125` and `:196`.
- **Scenario:** the user installs v0.2 (schema 2), then reinstalls v0.1. v0.1 unlocks and writes to the v2 schema with v1 assumptions: NOT NULL/CHECK failures, lost columns, or silent corruption. Restore checks for this (`backup/mod.rs:289`); unlock and recover do not.
- **Evidence:** probe (d) prints `migrate on v99 db -> Ok`.
- **Fix:** in `migrate()` or `unlock()`, return a dedicated error (for example `SCHEMA_NEWER_THAN_APP`, mapped in the frontend) when `schema_version > latest_schema_version()`.
- **Also:** there is no automatic pre-migration snapshot before migrating the live vault. Recommended once migration 0002 exists.
- **Confidence:** confirmed.

**F6 — MEDIUM — Recovery key is not printable or savable and can never be shown or regenerated again (plan requirement not met)**

- **Where:** `src/features/onboarding/pages/OnboardingPage.tsx:86-104`; `app_service.rs:177-210`.
- **Scenario:**
  - The plan (05-security "Recovery") requires the key to be "printable or savable explicitly". The UI only renders `<code>{recoveryKey}</code>` with a checkbox, so the user has to transcribe 64 hex characters by hand.
  - If the app crashes or is closed on that screen, the vault is already initialized and the key is lost for good.
  - `recover_access` never rotates the recovery envelope, and there is no "generate new recovery key" command, so a leaked or lost key cannot be replaced.
- **Fix:**
  - Add explicit Print and Save actions (save through a Rust native-save command).
  - Format the key in groups.
  - Add a password-gated "regenerate recovery key" command that rewraps `recovery_envelope`.
  - Consider rotating the key after a recovery has been used.
- **Confidence:** confirmed (no print, save or regenerate code exists).

**F7 — MEDIUM — The 5 s "lifecycle gap" lock overrides the user's timeout whenever the WebView throttles timers**

- **Where:** `src/lib/lifecycleLock.ts:4`; `src/components/layout/Shell.tsx:23-52`.
- **Scenario:**
  - Chromium/WebView2 applies intensive throttling (about 1 timer per minute) to hidden pages after 5 minutes.
  - macOS App Nap coalesces timers of occluded WKWebViews.
  - So simply minimizing the app, or leaving it behind Word, for a few minutes locks it even if the user chose 60 minutes.
  - NTP clock steps of 5 s or more also lock it.
- **Evidence:**
  ```ts
  setInterval(detectLifecycleGap, 1_000);
  currentTime - lastCheckAt >= LIFECYCLE_LOCK_GAP_MS; /* 5_000 */
  ```
- **Related gaps in the same effect:**
  - Activity only resets on `pointerdown`/`keydown`; `wheel`, `scroll`, `mousemove` and `touch` do not count, so a lawyer reading by scrolling is locked out.
  - Fail-open: `if (!lockTimeoutMinutes) return;` (Shell.tsx:24) means that if `useSettings` errors or is still loading, there is no inactivity lock and no gap lock at all.
- **Fix:**
  - Detect resume in Rust (power events on Windows and macOS, or a monotonic-versus-wall-clock gap check), or raise the gap threshold well above throttling intervals (for example 2-5 minutes).
  - Add `wheel`/`scroll` activity events.
  - Fall back to the default timeout of 15 when settings are unavailable.
- **Confidence:** plausible (throttling behaviour is platform-documented; not reproduced on a device).

**F8 — MEDIUM — Opening an attachment hands the managed copy to the OS shell with no type allow-list**

- **Where:** `src-tauri/src/services/document_service.rs:232-237` (the extension is kept verbatim) and `:320-327` (`open_path`).
- **Scenario A — execution:** a client emails `عقد.pdf.exe`, `.lnk`, `.hta`, `.js`, `.bat` or `.html`. The lawyer attaches it and clicks Open, and Windows `ShellExecute` runs it. The Rust-side opener API is not limited by capability scopes.
- **Scenario B — evidence integrity:** Open edits the canonical copy in place (Word or Preview autosave, Word `~$` lock and `~WRL*.tmp` files created inside `attachments/`). The stored `sha256`/`file_size_bytes` silently become stale, and the stray files are swept into backups (see F11).
- **Fix:**
  - Block or confirm before opening executable or script extensions.
  - Consider opening a read-only temporary copy.
  - Verify the sha256 on open, or at least show a warning when it does not match.
- **Confidence:** confirmed (code); exploit requires user action.

**F9 — MEDIUM (conditional) — Lock, unlock, change-password and restore do not coordinate with each other or with in-flight commands**

- **Where:**
  - `app_service.rs:130` (`lock` does not take `security_operations`);
  - `app_service.rs:173` and `:208` (unconditionally write `Some(master)`, so `change_password` also acts as an unlock);
  - `backup/mod.rs:310` (renames the live database while other commands may hold connections).
- **Today:** sync commands run on the main thread (known #4), so these interleavings are serialized.
- **Once #4 is fixed with async commands or `spawn_blocking`:**
  - An auto-lock that lands during `change_password`'s two Argon2 runs is undone: the backend ends up unlocked while the UI shows locked.
  - Restore on Windows fails or corrupts while another command holds a connection.
  - Commands that copied the key before the lock keep working after it.
- **Fix:** add an `RwLock` "vault generation" guard. Normal commands take a read lock; lock, restore and unlock take the write lock. `change_password`/`recover` should only set the key if the vault was unlocked or the operation is an explicit unlock.
- **Confidence:** plausible (latent).

**F10 — MEDIUM-LOW — Restore fails on Windows whenever any attachment is open in an external app**

- **Where:** `backup/mod.rs:312` (`fs::rename(documents_root, &documents_emergency)`).
- **Scenario:** a Word or Acrobat handle without `FILE_SHARE_DELETE` blocks the directory rename. Rollback works, but the user only sees a generic `OPERATION_FAILED` with no hint to close documents.
- **Fix:** before the swap, check that files can be opened exclusively (or try a pre-rename), and return a specific `ATTACHMENT_IN_USE` code.
- **Confidence:** plausible.

**F11 — LOW-MEDIUM — Leftover temp files are never cleaned and end up in backups; a "deleted" document can live on in backups**

- **Where:**
  - `backup/mod.rs:79-92` archives every regular file in `attachments/`;
  - `document_service.rs:238` writes `.{id}{ext}.partial`;
  - `document_service.rs:168/179-181` stages deletes as `*.deleting`.
- **Scenario:**
  - A crash during an attachment copy, or the post-commit `remove(staged)` failing (the code returns Err after the row is already deleted; test `post_commit_cleanup_failure_is_reported…` confirms), leaves `uuid.deleting` behind.
  - Every later backup includes it and it is restored. For privacy and deletion, a document the user deleted persists.
  - Office `~$` files (F8) behave the same way.
- **Fix:**
  - At unlock, sweep `*.partial` / `*.deleting` that have no matching database row.
  - In `backup::create`, include only files referenced by `attachments.relative_path` in the snapshot.
- **Confidence:** confirmed (code).

**F12 — LOW-MEDIUM — Restore does not fsync the staged database or attachments before swapping them in**

- **Where:** `backup/mod.rs:284-287`: `fs::File::create(target)` plus `io::copy`, and `fs::write(&staging, db_bytes)`. No `sync_all` and no directory fsync.
- **Scenario:** a power loss right after a "successful" restore can leave a truncated `legalmaster.sqlite` or zero-length attachments under their final names. `migrate` commits (which fsyncs) only if a migration actually ran.
- **Same gap elsewhere:**
  - `initialize` renames (`app_service.rs:90-99`) without a directory fsync;
  - attachment copy (`fs::copy`) is not synced before the database commit.
- **Fix:** `sync_all` each staged file, fsync the parent directories after renames (Unix), and use `MoveFileEx` with `MOVEFILE_WRITE_THROUGH` on Windows.
- **Confidence:** plausible.

**F13 — LOW — A failed backup write leaves a partial `.tmp` behind on every attempt**

- **Where:** `backup/mod.rs:118-123`.
- **Evidence:**
  ```rust
  let mut file = fs::File::create(&temp)?;
  file.write_all(&payload)?;
  file.sync_all()?;
  ```
  The `?` returns before any cleanup. The name includes a nanosecond timestamp, so with a full disk each retry leaves another large `legalmaster-backup-*.tmp`. The snapshot temp at line 51 is cleaned correctly.
- **Fix:** wrap the write in a closure that removes `temp` on error, like `write_security_atomically` does.
- **Confidence:** confirmed.

**F14 — LOW — The backup snapshot contains its own RUNNING history row, and restore replaces backup history**

- **Where:** `services/backup_service.rs:15` (`start()`) runs before `backup::create` takes the snapshot.
- **Scenario:**
  - Every archive contains a `backup_history` row with status RUNNING and no `completed_at`. After a restore it stays RUNNING forever.
  - The restored history also drops every backup made after the archive, so "latest successful backup" can say "none" or show an old date right after a restore, which prompts confusing stale-backup advice.
  - Restore events are not recorded either.
- **Fix:** record history outside the snapshot (or copy the history rows across a restore), and add a RESTORED entry.
- **Confidence:** confirmed (code ordering).

**F15 — LOW — Single-instance plugin is registered last, and its callback does nothing**

- **Where:** `src-tauri/src/lib.rs:37` (`.plugin(tauri_plugin_single_instance::init(|_, _, _| {}))`, after dialog, notification, autostart and opener).
- **Scenario:**
  - The Tauri docs require single-instance to be registered first, otherwise other plugins initialise in the second process before it exits.
  - The empty callback means that launching the app again (common with autostart, when the window is minimized) shows nothing, so users think it is broken.
- **Fix:** register it first, and in the callback unminimize, show and focus the `main` window.
- **Confidence:** confirmed (code); impact plausible.

**F16 — LOW — Release logs carry no error codes or operation facts**

- **Where:** `src-tauri/src/errors/mod.rs:216-224` logs only when `detailed_diagnostics_enabled()` is true, which requires `cfg!(debug_assertions)`. `logging.rs` logs only startup.
- **Effect:** in release builds the 14-day logs contain only "application starting". The plan's allowed facts (error code, migration number, backup status, duration) and the future support bundle's "failed operation codes" are never captured.
- **Privacy check:** no personal data, paths or keys are logged (OK).
- **Fix:** always log `error_code` (it is a stable string), plus migration and backup status, without `diagnostic_detail`.
- **Confidence:** confirmed.

**F17 — LOW — Secrets stay in renderer memory**

- **Where:**
  - `src/app/App.tsx:102`: the `recoveryKey` React state is never cleared after "saved" or on lock, so it lives for the whole session.
  - React Query keeps mutation `variables` (`password`, and `recoveryKey`/`newPassword`) and the initialize result `{recoveryKey}` until gcTime (5 minutes) after unmount. `clearVaultCache` clears mutation caches only on lock, not after unlock or setup.
- **Plan:** "Do not place passwords or keys in frontend state."
- **Fix:** `setRecoveryKey('')` in `onRecoveryKeySaved`; set `gcTime: 0` on the auth mutations, or call `mutation.reset()` after success.
- **Confidence:** confirmed.

**F18 — LOW — Argon2 parameters are hard-coded at the OWASP minimum; no bounds check on the values read; crypto errors reported as wrong password**

- **Where:** `app_service.rs:54` (`19_456, 2, 1`); `security/mod.rs:51-55`.
- **Details:**
  - The plan requires benchmarking on low-end hardware; this was not done, and unlock is rare, so 64 MiB with t=3 is affordable.
  - Values read from `security.json` are not bounded: an edited `memory_kib` can OOM the app.
  - A corrupted `security.json` (bad base64 salt, bad parameters) is reported as `INVALID_PASSWORD`, which sends the user into password retries instead of "vault file damaged".
  - There is no unlock attempt backoff. This is informational, since an attacker with disk access attacks offline anyway.
- **Confidence:** confirmed.

**F19 — LOW — Attachment add reads the whole file into memory, has no size limit, and burns the picker token on validation errors**

- **Where:** `document_service.rs:125-137` (`fs::copy` then `fs::read` of the entire file for sha256); `:222` (`take_document_source` before `validate_owners` at `:229`).
- **Scenario:**
  - A 3 GB scan video exhausts memory on the main thread.
  - A single file of 4 GiB or more also fails every later backup forever: `SimpleFileOptions::default()` has no `large_file(true)`, so the zip writer errors.
  - `CLIENT_NOT_FOUND` and similar errors consume the token, so the user has to pick the file again.
- **Fix:** hash while streaming the copy; set a maximum size; use `large_file(true)` or stream the archive; validate owners before taking the token.
- **Confidence:** confirmed (code); 4 GiB zip behaviour from zip-crate semantics.

**F20 — LOW — Locked or missing-file states are poorly surfaced in the UI**

- **Details:**
  - A command returning `APP_LOCKED` while the UI is on 'ready' only shows a toast; nothing refetches `appStatus` or moves to the unlock gate. Add a global `onError` handler that calls `clearVaultCache` when the code is `APP_LOCKED`.
  - Open or reveal on a file deleted outside the app returns `ATTACHMENT_SOURCE_MISSING`, but `AttachmentPanel.tsx` shows the generic `documents.openError`, so the user cannot tell the file is gone.
  - When `remove` fails after commit, the list is not invalidated: the row stays visible and the next click returns `ATTACHMENT_NOT_FOUND`.
  - All error codes are present in `bridge/errors.ts` and in both locale files (OK).
- **Confidence:** confirmed.

**F21 — LOW — Detail added to known #1: the user cannot find the backup to copy it off-device**

- **Detail:** `backup_create` returns the path, but `BackupsPage` shows only "Backup created successfully". The `offsiteAdvice` copy tells the user to copy the file to a USB drive, but the file sits in a hidden AppData/Library folder and there is no "reveal backup" action.
- **Confidence:** confirmed.

**F22 — LOW — `initialize` leftover and Windows-path corner cases**

- **Leftover temp database:** a crash during setup leaves `legalmaster.tmp`, encrypted with a discarded key. The next `initialize` fails once with "file is not a database" and only then deletes it (`app_service.rs:69-83`). It should delete any existing `temp_db` first.
- **Shared recovery file on Windows:** `temp_security = security.tmp` shares the `security.previous` recovery path with `security.json`. On Windows, a crash inside `write_security_atomically(security.tmp)` leaves a `security.previous` that `recover_interrupted_security_write` will promote to `security.json` on the next start. Use a distinct name, or write directly to `security.json` as the last step. This needs two crashes, so it is very unlikely.
- **Confidence:** plausible.

### Missing test coverage (failure paths)

- Restore rollback at each rename step (`backup/mod.rs` 312, 317 and 324 failure branches), restore with an existing `attachments.pre-restore`, and restore rejecting a newer schema.
- Unlock or recover when the database is missing, or with a newer schema; a corrupted `security.json`; the Windows two-step security write and its recovery.
- `backup::create` failures (write or validate failure leaves no files), and a backup where `attachments/` contains `.partial`/`.deleting` files.
- `lock()` actually zeroizing memory; `change_password` when locked or with a wrong current password at the service level.
- Frontend: auto-lock timer, lifecycle gap behaviour in Shell, and the `APP_LOCKED` response while 'ready'.

### Checked and OK

- XChaCha20-Poly1305 nonces are fresh 24-byte OsRng values for each wrap and each backup; the 24-byte nonce length is checked on unwrap.
- The master key is random, not derived from the password. Password and recovery envelopes are independent. Changing the password only rewraps the key.
- The `backup_key` domain-separated SHA-256 of a random key is acceptable.
- The SQLCipher raw-key `x'..'` PRAGMA path works (no per-open key derivation, about 8 ms per open). The spike test confirms no plaintext in the database or the backup ciphertext.
- Zip handling:
  - archives are AEAD-authenticated under the installation key, so outside zip bombs or crafted archives are not possible;
  - the inventory is exact, duplicate names and checksums are enforced, and `enclosed_name` is used;
  - `..` and `.` entries fail safely when files are created.
- Corrupt-restore staging leaves the live data unchanged (tested). Rollback branches are logically correct apart from crash windows (F3).
- Migration v1 runs inside a transaction; populated legacy vaults are refused without being changed (tested).
- `security.json` write is atomic on Unix (temp file, fsync, rename).
- Capabilities are minimal: no fs, shell, opener or dialog JS permissions. The opener is used only from Rust with managed paths or fixed developer URLs.
- The CSP blocks remote content (no `base-uri`/`form-action`; minor).
- Picker source tokens are one-time, cleared on lock, and refused while locked.
- Attachment stored names are UUID-based (no traversal). A missing file can still be removed; a failed DB write rolls back the file and a failed file step rolls back the DB (tests).
- Logs contain no personal data, paths or keys; 14-day pruning works.
- Error diagnostics withhold SQLite messages and paths. Every Rust error code is in the frontend set and in both locales.
- `clearVaultCache` cancels queries, removes all non-status queries and the mutation cache, then refetches status. The restore and lock flows both call it.
- Reminder notification text is generic.
- The `desktop-e2e` feature is off by default.
- `mock_app` tests use an empty identifier (`~/.local/share/LegalMasterSolo`), so they do not touch the real vault (`com.legalmaster.solo`).

## Transcript agent-a4e109b5e629b2bb0.jsonl

# Legal Masr pre-launch review: Cases, Hearings/Agenda, Tasks, Reminders

This was a read-only review. I edited nothing in the repo.

**Validation run**

- `npx vitest run src/features src/components/ui/DatePicker.test.tsx`: 11 files, 107 tests, all pass.
- `cargo test --offline -q case`: passes.
- One extra check to prove F1: a throwaway vitest harness in /tmp (since deleted) rendered `CaseEditForm` with `filedOn: '2026-01-15'`. The date input's DOM value was `''` right after render, after a rerender and after opening the calendar. Yet the submitted value was `"filedOn":"2026-01-15"`.

## Findings

### F1 · HIGH · src/features/cases/forms/CaseCoreFields.tsx:110,113 + src/components/ui/DatePicker.tsx:189,219

**The Edit Case dialog hides the saved filing and closing dates.**

- **What happens:** a case has تاريخ القيد = 2026-01-15. The lawyer opens تعديل. Both date fields look empty and the calendar shows no selected day, but the form keeps and submits the old value. Lawyers will retype dates or assume the data was lost. "Clearing" a field that already looks empty does nothing.
- **Cause:** `DatePicker` keeps its own state, `useState(value ?? defaultValue ?? '')`, and renders `value={textValue}`. RHF `register()` passes no `value` or `defaultValue`. It writes the default straight into the DOM through the ref, and React then forces the field back to `''`.
- **Fix:** use `<Controller>` with `value`/`onChange` for both date fields. Alternatively, have DatePicker read the ref-assigned DOM value on mount, or accept RHF's `defaultValue`.
- **Test gap:** no test edits a case that has dates.
- Confidence: confirmed by the harness above.

### F2 · HIGH · src-tauri/src/services/hearing_service.rs:80-85; AgendaPage.tsx:266-273; CaseDetailPage.tsx:389-396

**"Edit hearing" is shown on completed hearings, but the backend always rejects the save.**

- **Backend guard:** `if existing.as_ref().is_some_and(|item| item.case_id != input.case_id || item.status != "SCHEDULED") { return Err(Error::Validation); }`
- **UI:** the edit button is rendered without any status check in the agenda day panel and the case hearings timeline.
- **No way to correct a decision:** `DecisionForm` is only offered for SCHEDULED hearings and there is no un-complete command. A typo in قرار الجلسة or in the hearing notes can never be fixed.
- **What the user sees:** `agenda.saveError` ("…حاول مرة أخرى"), which suggests retrying will help. It won't.
- **Fix:** do one of the following:
  - allow editing a completed hearing's metadata and its decision text (an "edit decision" action);
  - or hide/disable Edit for non-SCHEDULED hearings and add a "correct decision" flow.
  - In either case, show the backend error message instead of the generic one.
- Confidence: confirmed.

### F3 · HIGH · DB CHECK `official_year BETWEEN 1800 AND 9999` (migrations/0001:117); case_service.rs:48; label `cases.fields.judicialYear` = "السنة القضائية"

**Egyptian judicial-year numbering cannot be entered.**

- Cassation, Supreme Administrative Court and Courts of Appeal cite cases as «الطعن رقم 1234 لسنة 89 ق».
- If a lawyer types 89 in the field labelled السنة القضائية, the backend returns VALIDATION_FAILED and they see a generic error.
- `OfficialReference` also renders «لسنة 2026» with no «ق» suffix.
- **Fix:**
  - allow small judicial years, or add a calendar-vs-judicial year type flag (this needs a new migration);
  - render «لسنة N ق» when the year is judicial;
  - add a client-side range message.
- Confidence: confirmed in code; the domain point is a strong plausible.

### F4 · MEDIUM · src-tauri/src/errors/mod.rs:99; CaseDetailPage.tsx:648-651; NewCasePage.tsx:46

**A duplicate case internal number shows a misleading "try again" error.**

- `cases.internal_number` is UNIQUE, including archived cases. A collision surfaces as `Sql` → OPERATION_FAILED: "تعذر إتمام العملية. لم تتغير بياناتك؛ حاول مرة أخرى."
- The edit dialog ignores the error code entirely and always shows `records.saveRetry`.
- Retrying never succeeds, and the user is never told the number is already used. The hint "رقم تختاره لترتيب ملفات مكتبك" doesn't mention that it must be unique.
- **Fix:**
  - pre-check in the service and return a dedicated `CASE_NUMBER_TAKEN` error, or map SQLite constraint code 2067 on `cases.internal_number`;
  - translate it and attach it to the field;
  - use `errorMessage()` in the edit dialog.
- Confidence: confirmed.

### F5 · MEDIUM · src/features/cases/schemas/case.schema.ts:14,20-29; case_service.rs:21-23,42-56

**Case form validation is weaker than the backend's, and nothing ties the error to a field.**

- `officialYear: z.union([z.number().int(), z.nan()])`: years like 99999, 0 or -5 pass client validation. The HTML `min={1900} max={2200}` does nothing because the form is `noValidate`, and 1900 also disagrees with the backend's 1800.
- `filedOn`/`closedOn` accept any string, so `errorFor('filedOn')` can never fire. Typing `2026-02-30`, or `3/10/2026` and pressing Enter before the field loses focus, sends an invalid string. The backend replies VALIDATION_FAILED with no indication of which field is wrong.
- Neither the client nor the backend checks:
  - closed date ≥ filed date;
  - status CLOSED having a closed date;
  - an ACTIVE case not having a closed date.
- **Fix:** add a zod `refine` with ISO-date regex plus a real-date check, a year range matching the DB (after F3), a `closedOn >= filedOn` rule and a status/closedOn consistency rule. Mirror them in `validate_case` and add Rust tests.
- Confidence: confirmed.

### F6 · MEDIUM · src/features/cases/forms/CaseCoreFields.tsx:47-53 (`type="number"` with `valueAsNumber`)

**A judicial year typed in Arabic-Indic digits may be silently dropped.**

- If the WebView rejects «٢٠٢٤» in a number input, `valueAsNumber` is NaN. `NewCasePage:38` and `CaseDetailPage:633` turn NaN into `undefined`, so the year is cleared with no error.
- **Fix:** use a text input with `inputMode="numeric"`, normalise Arabic-Indic digits (as `normalizeTypedDate` already does), then parse.
- Confidence: plausible; depends on the WebView.

### F7 · MEDIUM · src/i18n/ar/common.json:644 (`cases.searchPlaceholder`) vs case_repository.rs:140

**The case list search box promises more than it searches.**

- The placeholder says "ابحث برقم القضية أو المحكمة أو الموكل" / "Search by case number, court or client".
- The SQL only matches `internal_number`, `official_number` and `official_year`. Searching by client name or court returns «لا توجد قضايا مطابقة».
- Arabic-Indic digits are not normalised either, so «٤٤٧» does not find 447.
- **Fix:** add court name and client names to the WHERE (or reuse the normalized `search_index`), normalise the query, or change the copy.
- Confidence: confirmed.

### F8 · MEDIUM · services/client_service.rs:82-113 (update only calls `upsert_search_entry` for CLIENT)

**Renaming a client leaves case search entries stale.**

- The case search index stores the client names (case_service.rs:59-83).
- After a client rename, global search for the new name doesn't find their cases, while the old name still does, until a manual index rebuild.
- **Fix:** in client update, re-index every case linked through `case_clients` inside the same transaction.
- Confidence: confirmed.

### F9 · MEDIUM · AgendaPage.tsx:575-585 (HearingForm); TasksPage.tsx:391-399 (TaskForm); hearing_repository.rs:227; task_repository.rs:165

**Per-item reminders are wiped on every edit and cannot be set from the UI.**

- Neither form sends `reminderMinutes`. Both UPDATE statements write `reminder_minutes=?`, so any edit resets the reminder to NULL (the global default).
- The docs promise tasks an "optional reminder", but no UI control exists.
- Demo-seeded values (120/90) disappear on the first edit.
- **Fix:** carry `initial.reminderMinutes` through the forms, or make the backend keep the existing value when the field is absent. Add a reminder field if the feature is intended.
- Confidence: confirmed.

### F10 · MEDIUM · src-tauri/src/services/reminder_service.rs:12-20,35; reminder_repository.rs:104-109

**Reminders only fire on the day of the event, even though Settings allow leads of up to 7 days.**

- Candidates are only items whose date equals `today`. Settings accept a lead of up to 10080 minutes (settings.schema.ts:8; SettingsPage.tsx:315-320).
- A lead of 1440 ("a day before") fires at the first refresh on the hearing day, never the day before.
- A 00:30 hearing with a 60-minute lead never fires early.
- **Fix:** query for items with date in [today, today + ceil(lead/1440)], compute due-ness against date+time, and dedupe per entity.
- **Related, low:**
  - The notification text "لديك جلسة اليوم…" / title "ليجال مصر" is Arabic-only Rust text, also shown in the English UI.
  - One `show()` failure aborts the whole loop (`map_err(|_| Error::Operation)?`), so later candidates are never delivered.
  - Reminders fire for hearings and tasks of archived cases.
- Positives:
  - permission denied is handled (`ReminderSync` skips when permission isn't granted);
  - dedupe through the `reminder_deliveries` primary key works;
  - notification copy is privacy-safe.
- Confidence: confirmed.

### F11 · MEDIUM · case_service.rs (no archived checks); hearing_service.rs:63-100; task_service.rs:31-69; AgendaPage.tsx:560 / TasksPage.tsx:101 / CaseDetailPage.tsx:71 use `useCaseList({})`, which excludes archived cases

**Archived cases behave inconsistently.**

- **What the app allows:**
  - editing an archived case;
  - adding hearings, tasks and opponents to it;
  - its hearings and tasks keep appearing in Agenda, Today and reminders.
- **What breaks:** the case pickers in HearingForm and TaskForm, and the task filter, omit archived cases. So an edit or add from an archived case's own detail page shows an empty case Select (or a raw id), and task rows lose their case label (TasksPage:225).
- Archiving happens on one click with no confirmation (CaseDetailPage:166-173).
- **Fix:** decide the rule. Either block writes on archived cases with a specific error and hide them from Agenda/Today/reminders, or include archived cases in the pickers. Add a confirmation dialog for archive.
- Confidence: confirmed (the behaviour); the rule itself is a product decision.

### F12 · MEDIUM · AgendaPage.tsx:650-694 (DecisionForm); hearing_service.rs:125-172

**Recording a decision is irreversible and has no guards.**

- An empty decision with no next date still marks the hearing COMPLETED ("تم نظرها"). The agenda then shows "سُجل القرار" even though no decision exists.
- The next-hearing date is not checked against the source hearing's date, so a typo like 2025 creates a hearing in the past.
- Future-dated hearings can be decided from the timeline and agenda, but the summary card only allows it when `date <= today`.
- Together with F2, a mis-click can't be undone.
- **Fix:** require a decision text or a next date, require next date > hearing date, confirm when the decision is empty, and add an undo/edit path.
- Confidence: confirmed.

### F13 · MEDIUM · Dashboard (dashboard_service.rs) and Agenda

**Past hearings without a decision are not flagged anywhere.**

- Today lists today's and upcoming SCHEDULED hearings only (`from_date: today`).
- A hearing from last week with no recorded قرار disappears from Today and shows as plain "مجدولة" in the agenda.
- The case card calls it «الجلسة القادمة» (CaseDetailPage:104-110 picks the oldest SCHEDULED hearing, even a past one).
- **Fix:** add a "جلسات بانتظار تسجيل القرار" bucket to Today, mark past SCHEDULED hearings in the agenda, and relabel the case card when the hearing is past.
- Confidence: confirmed.

### F14 · MEDIUM · AgendaPage.tsx:591-604

**The case can be changed when editing a hearing, but the backend rejects it.**

- The case Select stays enabled when editing. Changing it hits `item.case_id != input.case_id` → Validation, and the user sees the generic save error.
- **Fix:** disable the case Select when `initial` is set.
- Confidence: confirmed.

### F15 · LOW-MEDIUM · Error mapping across these features

**Specific error codes are mapped but almost never shown.**

- All Rust error variants used here are in `appErrorCodes` and translated in both languages.
- But every dialog shows a fixed generic message: agenda.saveError, agenda.decisionError, tasks.saveError, records.saveRetry, cases.parties.saveError.
- So HEARING_NOT_FOUND, TASK_NOT_FOUND, VALIDATION_FAILED and CASE_NOT_FOUND are never surfaced, and every message says "try again". Only NewCasePage uses `errorMessage()`.
- CaseDetail turns CASE_NOT_FOUND into `records.loadError`; `cases.detail.notFound` is unreachable.
- Opponent update returns CASE_NOT_FOUND for a missing opponent (case_repository.rs:192,198).
- **Fix:** use `errorMessage(err, fallback)` everywhere and branch on `CASE_NOT_FOUND` in the detail page.
- Confidence: confirmed.

### F16 · LOW-MEDIUM · src/features/tasks/pages/TasksPage.tsx:295-306

**Task delete confirmation has no pending state, no error and no double-click guard.**

- Compare the hearing delete dialog, which has `pending`, `error` and an `!isPending` guard.
- A double click sends two deletes; the second gets TASK_NOT_FOUND. A failure leaves the dialog open with no message.
- **Fix:** pass `pending={remove.isPending}` and `error={remove.isError ? … : undefined}`, and guard against a pending delete.
- Confidence: confirmed.

### F17 · LOW · src/features/cases/components/CasePartiesPanel.tsx:45

**Hard-coded Arabic «دون صفة مسجلة» shows in the English UI.**

- **Fix:** add an i18n key, e.g. `cases.parties.noCapacity`.
- Also hard-coded: the Arabic comma `'، '` separator in CaseListPage:117, AgendaPage:72/601 and TasksPage:173, used in the English UI too.
- Confidence: confirmed.

### F18 · LOW · DatePicker.tsx:169-173,217-218,254-256

**DatePicker accepts several formats but hints and validates inconsistently, and is weak for screen readers.**

- The Arabic placeholder says «مثال: 3/10/2026»; the English one says `YYYY-MM-DD`.
- The native `pattern` is `[0-9]{4}-…`. In native-validated forms (HearingForm, TaskForm), typing `3/10/2026` or `٣/١٠/٢٠٢٦` and pressing Enter (no blur, so no normalisation) shows a pattern error whose title says to type DD/MM/YYYY — the exact format just typed.
- Calendar day buttons are labelled only "23", with no month, year, today or selected state for screen readers.
- **Fix:** normalise on submit/Enter (or drop `pattern`), align the placeholders, and keep the default `aria-label` (full date).
- Confidence: confirmed (code); Enter-key behaviour is plausible.

### F19 · LOW · Stale mutation errors

**Old error messages reappear when a dialog is reopened.**

- After a failed save the user cancels; reopening the dialog shows the old error, because the `isError` of add/update, save, decide or remove is never reset on close.
- Affected: CasePartiesPanel:439-443, AgendaPage:337/363/309, TasksPage:326, CaseDetailPage:648/686/719/745.
- `caseFeedback` ("تم حفظ التعديلات") is never cleared.
- The opponent remove error renders outside the ConfirmDialog, behind the modal.
- **Fix:** call `mutation.reset()` in `onOpenChange(false)`, and pass `error` to ConfirmDialog.
- Confidence: confirmed.

### F20 · LOW · Whitespace-only names and titles

**Whitespace-only required fields reach the backend and come back as a generic error.**

- Opponent name, task title and decision text are protected only by native `required`, which accepts " ". The backend then returns Validation, shown as a generic error.
- **Fix:** trim before checking and show a field error.
- Confidence: confirmed.

### F21 · LOW · Task semantics

- `task_complete` on a task that is already complete overwrites `completed_at` (task_repository.rs:172), so it isn't idempotent.
- A task's linked client isn't checked against its linked case's clients.
- TasksPage has no loading state: the empty-view message flashes while loading (lines 209-214).
- `?date=` and `?case=` URL params aren't validated.
- Confidence: confirmed.

### F22 · LOW · Agenda presentation and accessibility

- The month grid is 42 tab stops with no arrow-key navigation and no grid role.
- The week view has no "today" marker.
- The day-details panel isn't announced when a day is selected.
- The agenda loads every hearing and task ever (`useHearings({})` and tasks view ALL), with no date window. That will get slow with years of data.
- `agenda.status.CANCELLED` / "ملغاة" is unreachable: nothing sets CANCELLED.
- The litigation degree label «الدرجة القضائية» would read more naturally as «درجة التقاضي».
- Positives:
  - the week starts on Saturday by default;
  - DST is safe (local `new Date(y, m, d)`, no UTC parsing);
  - same-day ordering is by time, with untimed hearings first.
- Confidence: confirmed.

### F23 · LOW · case_repository.rs:140,152-156

**Client names in the case list can split or reorder.**

- `group_concat(cl.full_name, '، ')` is split back on `'، '`, so a client name containing «، » becomes two names.
- The concatenation order isn't deterministic.
- **Fix:** return a JSON array or use an ordered subquery.
- Confidence: confirmed.

## Coverage table

✓ = checked, no issue.

| Page / area        | Field or button                                                                                 | Result                                 |
| ------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| Case list          | Search box                                                                                      | F7                                     |
| Case list          | Status filter, show-archived checkbox, "Add case"                                               | ✓                                      |
| Case list          | Table: internal number, court case number «رقم N لسنة Y», clients                               | F23, F17 (separator)                   |
| Case list          | Status badge                                                                                    | ✓                                      |
| Case list          | Loading / error / empty / no-results states                                                     | ✓                                      |
| New case           | Client picker (search, select, empty state, `?client=` param)                                   | ✓                                      |
| New case           | At least one client required                                                                    | ✓ (zod plus backend)                   |
| New case           | Internal number                                                                                 | F4                                     |
| New case           | Court case number                                                                               | ✓                                      |
| New case           | Judicial year                                                                                   | F3, F5, F6                             |
| New case           | Case type                                                                                       | ✓                                      |
| New case           | Litigation degree                                                                               | ✓ (label wording F22)                  |
| New case           | Status                                                                                          | ✓                                      |
| New case           | Court, circuit                                                                                  | ✓                                      |
| New case           | Filed on / closed on                                                                            | F5, F18                                |
| New case           | Subject, notes                                                                                  | ✓ (trimmed; clearing works)            |
| New case           | Save (pending/disabled), cancel                                                                 | ✓                                      |
| New case           | Error display                                                                                   | F4                                     |
| Case detail        | Header, badges, meta                                                                            | ✓                                      |
| Case detail        | Edit button                                                                                     | F1, F4                                 |
| Case detail        | Archive / restore                                                                               | F11 (no confirmation)                  |
| Case detail        | Tabs and counts                                                                                 | ✓                                      |
| Case detail        | Not-found / load error                                                                          | F15                                    |
| Case detail        | Summary facts                                                                                   | ✓                                      |
| Case detail        | Next-hearing card                                                                               | F13                                    |
| Case detail        | Last decision                                                                                   | ✓                                      |
| Case detail        | Account summary                                                                                 | ✓ (finance is out of scope)            |
| Case detail        | Clients panel                                                                                   | ✓ (read-only by design)                |
| Opponents panel    | Add / edit opponent dialog                                                                      | F17, F19, F20                          |
| Opponents panel    | Name, capacity, lawyer, phone, address, notes                                                   | ✓ (trimmed via `clean()`)              |
| Opponents panel    | Remove, with confirmation                                                                       | ✓ (has a confirm; error placement F19) |
| Case detail        | Hearings tab: list, add, edit, record decision                                                  | F2, F11, F12                           |
| Case detail        | Tasks tab: checkbox, add, edit                                                                  | F9, F11                                |
| Case edit dialog   | All core fields                                                                                 | F1, F3, F5, F6                         |
| Case edit dialog   | Clients preserved on save                                                                       | ✓                                      |
| Case edit dialog   | Save error                                                                                      | F4, F15                                |
| Agenda             | Month / week / list views                                                                       | F22                                    |
| Agenda             | Previous / next / today navigation                                                              | ✓                                      |
| Agenda             | Today highlighting                                                                              | ✓ month view, F22 week view            |
| Agenda             | Week start (Saturday default)                                                                   | ✓                                      |
| Agenda             | Day details panel                                                                               | F13                                    |
| Agenda             | Deep links: `?hearing=`, `?create=`, `?date=`, `?case=`                                         | ✓ (`?date=` not validated, low)        |
| Agenda             | Add hearing                                                                                     | ✓                                      |
| Agenda             | Edit hearing                                                                                    | F2, F14                                |
| Agenda             | Delete hearing (confirm, pending, error)                                                        | ✓ (stale error F19)                    |
| Agenda             | Record decision                                                                                 | F12                                    |
| Hearing form       | Case                                                                                            | F11, F14                               |
| Hearing form       | Date                                                                                            | F18                                    |
| Hearing form       | Time (`HH:MM`, clearable)                                                                       | ✓                                      |
| Hearing form       | Type, location, circuit, preparation, notes                                                     | ✓                                      |
| Hearing form       | Reminder                                                                                        | F9                                     |
| Hearing form       | Save (pending)                                                                                  | ✓                                      |
| Hearing form       | Save error                                                                                      | F15                                    |
| Decision form      | Decision text                                                                                   | F12, F20                               |
| Decision form      | Next-hearing date                                                                               | F12                                    |
| Decision form      | Details carried over to the next hearing, in one transaction                                    | ✓                                      |
| Tasks page         | Views: today / overdue / upcoming / completed / all                                             | ✓                                      |
| Tasks page         | Case and client filters, clear filters                                                          | F11                                    |
| Tasks page         | Rows, status badge                                                                              | ✓                                      |
| Tasks page         | Complete / reopen checkbox                                                                      | ✓ (idempotency F21)                    |
| Tasks page         | Delete                                                                                          | F16                                    |
| Tasks page         | Deep link `?task=`                                                                              | ✓                                      |
| Tasks page         | Loading state                                                                                   | F21                                    |
| Task form          | Title                                                                                           | F20                                    |
| Task form          | Due date                                                                                        | F18                                    |
| Task form          | Case, client                                                                                    | F11, F21                               |
| Task form          | Details, notes                                                                                  | ✓                                      |
| Task form          | Complete / reopen inside the dialog (draft kept)                                                | ✓                                      |
| Task form          | Reminder                                                                                        | F9                                     |
| Task form          | Save                                                                                            | F15                                    |
| Reminders          | Scheduling and lead time                                                                        | F10                                    |
| Reminders          | Dedupe                                                                                          | ✓                                      |
| Reminders          | Permission denied                                                                               | ✓                                      |
| Reminders          | Locked app                                                                                      | ✓ (silently retried)                   |
| Reminders          | Copy and privacy                                                                                | F10 (Arabic-only)                      |
| Backend            | Transactions: case create/update/archive, decision plus next hearing                            | ✓                                      |
| Backend            | Hearing / task save (single statements)                                                         | ✓                                      |
| Backend            | Foreign keys and cascades (cases are archived, never deleted; payments restrict `case_clients`) | ✓                                      |
| Backend            | Search index sync                                                                               | F8                                     |
| Backend            | At least one client per case                                                                    | ✓ (validated in `validate_case`)       |
| Query invalidation | Hearings → hearings / today / agenda / case summary                                             | ✓                                      |
| Query invalidation | Tasks → tasks / today / agenda / case / client                                                  | ✓                                      |
| Query invalidation | Cases → cases.all, detail, POA, search                                                          | ✓                                      |
| Query invalidation | Opponents → case detail                                                                         | ✓                                      |
| i18n               | Arabic/English key parity                                                                       | ✓ (no missing keys)                    |
| i18n               | Hard-coded strings                                                                              | F17, F10                               |

## Test gaps

- Editing a case that has dates (F1).
- Editing a completed hearing (F2).
- Duplicate internal number (F4).
- Date and year validation, including `closedOn` < `filedOn` (F5).
- Hearing and task edits keeping `reminderMinutes` (F9).
- Multi-day reminder lead (F10).
- Rules for archived cases (F11).
- Next-hearing date earlier than the hearing, and an empty decision (F12).
- Changing the case while editing a hearing (F14).
- Task delete failing or double-clicked (F16).
- Case search re-indexed after a client rename (F8).
- Case list search by client name or court (F7).

## Unresolved risks

- F6: whether the WebView accepts Arabic-Indic digits in a number input. Check on WebKitGTK and WebView2.
- Whether the Base UI Select's `required` actually blocks native submit in HearingForm.
- Archive semantics (F11) need a product decision.

## Transcript agent-a7a84715231cec2dc.jsonl

## Pre-launch review: Finances, Dashboard, Search, Settings, Backups

I read the code only and edited nothing. I ran the existing tests for this area: 11 files, 46 tests, all passing. I found no Critical or High issues. There are 9 Medium and 32 Low findings. Each one below was checked against the exact code; line numbers are in the original files.

### Findings

**F1 — Medium — Overpayment is hidden.** `src-tauri/src/repositories/finance_repository.rs:115`

- **Scenario:** The agreed fee is 10,000 EGP and the lawyer receives 12,000. "Outstanding" shows 0.00. Nothing on the case page, the Finances page or the client page shows the 2,000 EGP credit.
- **Evidence:** `outstanding_minor: (agreed - received).max(0),`
- **Fix:** Add `overpaid_minor = max(received - agreed, 0)`, or allow a negative balance, and show a "credit/overpaid" chip in both case-account views.
- **Confidence:** High.

**F2 — Medium — Editing a payment's case or payer (or an expense's case or client) leaves the old account stale.**

- **Where:** `src/features/finances/api/financesApi.ts:20-25, 32-37`; `src/lib/queryInvalidation.ts:9-13, 53-57`
- **Scenario:** On Finances with `?case=A`, the user edits a payment and moves it to case B. The ledger list refreshes and the payment disappears. The summary panel for case A still counts it under "Received" until the page remounts. The same happens to the old payer's client account.
- **Evidence:** `onSuccess: (payment) => queryInvalidation.payment(queryClient, { caseId: payment.caseId, payerClientId: payment.payerClientId })`. Only the new IDs are invalidated.
- **Fix:** Pass the `initial` IDs through the mutation variables and invalidate both the old and new case/client accounts. Simpler: invalidate `['cases']` and `['clients']` account keys by predicate.
- **Confidence:** High.

**F3 — Medium — The client account doesn't match the spec or its own wording.** `finance_repository.rs:120-136`, `ClientDetailPage.tsx:279-306`

- **Scenario:** The spec (04-functional-modules) says "Case and client account summaries calculate agreed, received, outstanding, expenses, and net cash". The client summary has no agreed or outstanding figure.
- **Scenario (expenses):** The note says it covers "Payments and expenses recorded for this client across all their cases". But the query only counts `expenses WHERE client_id = ?`. An expense linked only to the client's case (the common "court fee for case X" entry) is left out, so the client's "Net" is overstated.
- **Fix:** Aggregate fees, outstanding and expenses over the client's cases through `case_clients`, or reword the note. Decide how multi-client cases are attributed.
- **Confidence:** High.

**F4 — Medium — Finances only knows about non-archived cases and clients.** `FinancesPage.tsx:59-60, 210-215, 300-307, 464, 589`

- **Scenario 1:** Payments on an archived case show "—" in the Case column and no client name.
- **Scenario 2:** The filter can't select an archived case.
- **Scenario 3:** Editing such a payment shows an empty Case select. The value isn't among the items, so the placeholder is shown.
- **Scenario 4:** Inspecting it shows "—" for case and client.
- **Evidence:** `useCaseList({})` and `useClientList({})`. The backend defaults to `archived_at IS NULL` (`case_repository.rs:140`).
- **Fix:** Use `includeArchived: true` for the lookup maps and edit selects, with an "(archived)" suffix.
- **Confidence:** High.

**D1 — Medium — The dashboard shows hearings and tasks of archived cases as "Case details unavailable".** `DashboardPage.tsx:29, 62`; `dashboard_service.rs:14-31`; `hearing_repository.rs:39`

- **Scenario:** A case is archived while it still has a scheduled hearing. The hearing keeps appearing in "Today" and "Upcoming" with the text "تفاصيل القضية غير متاحة". The case lookup list excludes archived cases, and the hearing query has no archive filter.
- **Fix:** Join `cases` and exclude archived cases in the dashboard queries (or label them), and look up cases with `includeArchived`.
- **Confidence:** High.

**S1 — Medium — Lock-timeout bounds disagree between frontend, service and database, so large values fail silently.**

- **Where:** `settings.schema.ts:9` (`z.number().int().min(1)`, no max); `settings_service.rs:28` (`|| input.lock_timeout_minutes == 0`, no max); migration `0001…sql:48` (`CHECK (lock_timeout_minutes BETWEEN 1 AND 1440)`).
- **Scenario:** The user enters 2000 and saves. The database CHECK fails with OPERATION_FAILED. The optimistic update briefly applies 2000, then rolls back. The security tab shows no error (see S2), so the user believes it saved.
- **Fix:** Add `.max(1440)` to the zod schema and `> 1440` to the service, set `max="1440"` on the input, and add tests.
- **Confidence:** High.

**S2 — Medium — The lock-timeout form gives no feedback.** `SettingsPage.tsx:352-371`

- **Problem:** It has no validation message, no success message, no save-error message and no pending-disabled state.
- **Scenario:** The validation message `settings.display.invalid` and `updateSettings.isError`/`isSuccess` are only rendered in the General tab. An empty or 0 value, or an invalid hidden general field, blocks the submit with nothing shown.
- **Scenario (shared form):** The form uses the shared `handleSubmit`, so it also saves any unsaved edits from the General tab (language, theme and so on).
- **Fix:** Give it its own form or render errors and status in this tab, and add `disabled={updateSettings.isPending}`.
- **Confidence:** High.

**SR1 — Medium — Client phone numbers are not searchable.** `client_service.rs:17-31` vs `search_service.rs:45`

- **Scenario:** The user searches "01012345678". No result appears, even though the client's phone is shown as the result subtitle.
- **Evidence (live path):** `normalize_text(&format!("{} {}", client.internal_number, client.full_name))` does not include the phone. Only `rebuild_index` adds `{primary_phone}`.
- **Evidence (rebuild never runs):** `search_rebuild_index` is registered, but the UI and startup never call it.
- **Fix:** Index the normalized phone in `upsert_search_entry`, and run a one-off rebuild after migrating or restoring.
- **Confidence:** High.

**SR2 — Medium — Renaming a client leaves case and power-of-attorney entries stale.** `client_service.rs:82-117`; `case_service.rs:59-80`; `power_of_attorney_service.rs:24-45`

- **Scenario:** Case and power-of-attorney (POA) search text includes linked client names. Client `update` only re-indexes the client row. After renaming "أحمد" to "أحمد محمود", searching the new name finds no cases or POAs, but the old name still does.
- **Fix:** In client update, re-index every case and POA linked to the client in the same transaction.
- **Confidence:** High.

**SR3 — Medium — Arabic normalization is incomplete.** `src-tauri/src/normalize.rs:5-29`

- **Missing:** ة→ه, tatweel ـ (U+0640, which is outside the stripped U+064B–065F range), Persian digits ۰–۹, Persian ی/ک, and ؤ/ئ.
- **Scenario:** "محكمه" doesn't find "محكمة". "مـحمد" (with tatweel) doesn't match "محمد". The frontend money parser accepts Persian digits, but search doesn't.
- **Fix:** Extend the mapping, run a re-index migration or rebuild, and add unit tests (none exist for `normalize_text`).
- **Confidence:** High.

**SR4 — Low — The rebuild index disagrees with the live index.**

- **Problem:** `rebuild_index` drops client names from case and POA entries but adds phone and official year to client entries. The live index does the opposite.
- **Result:** If rebuild is ever wired up, search behaviour changes.
- **Fix:** Share one indexing function per entity.
- **Where:** `search_service.rs:68-131`.

**SR5 — Low — Archived records appear in search with no marker.** `search_repository.rs:173-187`

- **Fix:** Add an archived flag to `SearchHit` and show a badge.

**SR6 — Low — The palette shows "No matching results." while loading and on error.** `GlobalSearch.tsx:39, 96`

- **Evidence:** `const { data: hits = [] }` has no `isFetching` or `isError` branch.

**SR7 — Low — Search keyboard and cache gaps.**

- **Keyboard:** Enter with no arrow selection does nothing; it should open the first hit (`GlobalSearch.tsx:88`).
- **Cache:** Client and case mutations never invalidate `search.all`, so a previously typed query briefly shows stale hits.
- **Accessibility:** `role="option"` elements sit inside `section/ul/li` without `role="group"` or `presentation`, which weakens the listbox semantics.

**F5 — Low — Payment and expense save errors persist across dialogs.** `FinancesPage.tsx:337-341`; `CaseDetailPage.tsx:817-821`

- **Scenario:** A save fails and the user cancels. Opening "Add expense" immediately shows "Could not save the entry". The mutations are never `reset()` when the dialog closes.

**F6 — Low — Finance save errors are not mapped per code.**

- **Problem:** Every failure shows the generic `entrySaveError` or `feeSaveError`. That includes VALIDATION_FAILED for a payer not on the case or an invalid date such as 2026-02-30, CASE_NOT_FOUND, PAYMENT_NOT_FOUND and APP_LOCKED.
- **Fix:** Use `errorMessage(error, …)` as BackupsPage does.

**F7 — Low — Payments and expenses cannot be deleted.**

- **Problem:** There is no `payment_delete` or `expense_delete` command (`lib.rs:107-111`).
- **Scenario:** A duplicate entry (for example from a double save; each create gets a new UUID) can only be edited, never removed, so totals stay inflated.

**F8 — Low — The ledger shows the empty state while loading.** `FinancesPage.tsx:189`

- **Evidence:** `!records.length` is checked before `isLoading`.

**F9 — Low — Account figures show 0.00 while loading or after an error.** `CaseDetailPage.tsx:116, 328-334, 477-495`; `ClientDetailPage.tsx:193, 292-304`

- **Evidence:** `?? 0` is used for every figure.
- **Scenario:** A failed summary shows "Agreed fee 0.00" with an empty fee input, which invites re-entering the fee.

**F10 — Low — The fee agreement can't be cleared, and its date and notes are wiped on save.** `finance_repository.rs:46`; `CaseDetailPage.tsx:514`

- **Evidence:** The upsert sets `agreement_date = excluded.agreement_date, notes = excluded.notes`, and the UI only sends `amountMinor`.
- **Clearing:** A fee can't be removed or set to "no fee", because `amount_minor > 0` is required.
- **Untrimmed notes:** Fee notes skip `clean()`.

**F11 — Low — Summaries for unknown IDs return zeros instead of NOT_FOUND.** `finance_repository.rs:97-136`

**F12 — Low — An expense's client and case are not checked against each other.** `finance_service.rs:157-174`

- **Scenario:** An expense can link case X with a client who isn't on case X, so the case and client accounts then disagree.

**F13 — Low — `useCase('')` fires `case_get('')` on every Finances mount and when the payment form has no case.**

- **Where:** `casesApi.ts:16-17` (no `enabled`), used at `FinancesPage.tsx:61, 424`.
- **Result:** Wasted CASE_NOT_FOUND error queries.

**F14 — Low — The inspection dialog omits the payment method and expense type.** `FinancesPage.tsx:366-394`

**F15 — Low — Amount inputs lack `dir="ltr"` (the fee input has it), and errors don't set `aria-invalid` or `aria-describedby`.** `FinancesPage.tsx:484-489, 597-602, 511, 624`

**F16 — Low — Empty-value select options show "—" instead of their label.** `select.tsx:38`

- **Evidence:** `value={value || null}` maps `''` to null.
- **Affected:** The method select's "Not specified" and the expense form's "No case" / "No client" options show the default "—" placeholder.

**F17 — Low — The Arabic list separator "، " is used in the English UI.**

- **Where:** `FinancesPage.tsx:114`, `DashboardPage.tsx:255, 424`, and the backend `group_concat(… '، ')`.

**D2 — Low — The Today page date doesn't roll over at midnight.** `DashboardPage.tsx:23`

- **Evidence:** `localDateOnly()` only recomputes on render, and `refetchOnWindowFocus` is false.
- **Scenario:** If the dashboard stays mounted past midnight (for example a long lock timeout), it shows yesterday's agenda.

**D3 — Low — Past hearings without a recorded decision appear nowhere on Today.** `DashboardPage.tsx:57`

- **Evidence:** The filter `hearingDate > date` excludes them, and the backend fetches every future hearing with no upper bound.

**D4 — Low — The "Cases" and "Clients" widgets show the first 5 alphabetically, not the most recent.** `DashboardPage.tsx:251, 263`

- **Detail:** Case numbers sort as text ("10" before "2").

**D5 — Low — The "Hearings within 7 days" count excludes today's hearings.** `DashboardPage.tsx:57-58`

- **Detail:** This is inconsistent with the label.

**S3 — Low — The usage-counter toggle has no effect.**

- **Problem:** The `usage_counters` table is never written or read anywhere. The UI says "Only totals are kept, such as the number of cases or backups".
- **Privacy:** Nothing is sent anywhere, so there is no telemetry problem. The copy is misleading.
- **Fix:** Implement local-only counting or hide the toggle.

**S4 — Low — The version in About is hard-coded.** `SettingsPage.tsx:587`

- **Evidence:** `version: '0.1.0'` will drift from `tauri.conf.json`. Use `getVersion()`.

**S5 — Low — Change-password flow gaps.** `SettingsPage.tsx:113-124`

- **Unhandled rejection:** `await changePassword.mutateAsync` has no try/catch, so a wrong password produces an unhandled promise rejection.
- **No current-password check:** An empty current password is submitted.
- **Generic error:** The message is the same for INVALID_PASSWORD and other failures, although `errors.INVALID_PASSWORD` exists.
- **Same password allowed:** A new password equal to the current one is accepted.

**S6 — Low — A failed profile load leaves Save disabled forever with no message.** `SettingsPage.tsx:40, 208`

**S7 — Low — Notification status issues.** `SettingsPage.tsx:46, 125-130`

- **Initial state:** It starts as `'unknown'` and doesn't read the current permission, so "Allow notifications" shows even when already granted.
- **Unhandled errors:** Plugin errors are not caught.

**S8 — Low — Autostart state can drift from the OS.** `settings_service.rs:61-76`

- **Partial failure:** The OS autolaunch is changed before the database update. If the database write fails, the OS and database disagree.
- **Never re-read:** The switch shows the database value and never calls `is_enabled()`, so a user removing the startup entry in the OS isn't reflected.

**B1 — Low — Cancelling the file picker in "Check an older backup" shows "The file is damaged, or is not a Legal Masr backup."** `BackupsPage.tsx:118-122`

- **Evidence:** `choose_backup` returns `Error::Cancelled` (`backup_service.rs:70`), and every error, including APP_LOCKED, maps to `validateFailed`.

**B2 — Low — Cancelling the restore picker shows a red "The action was cancelled." alert.** `BackupsPage.tsx:144-148`

**B3 — Low — A failed latest-backup query shows "No successful backup yet" plus the first-backup advice.** `BackupsPage.tsx:56-74`

- **Detail:** There is no `isError` branch.

**B4 — Low — The restore success message is never seen.**

- **Evidence:** `clearVaultCache` locks the app immediately (`backupsApi.ts`), so `restoreSuccess` ("Open Legal Masr again…") never shows.
- **Result:** The user just lands on the lock screen with no explanation. Show a message on the lock screen, or wording such as "unlock to continue".

**B5 — Low — Create, validate and restore don't disable each other while one is pending.**

- **Mitigation:** This is mostly masked by the already-known synchronous commands.

**T1 — Test gaps.**

- **Search:** No Rust tests for `normalize_text`, for search-index consistency (client rename, phone) or for `rebuild_index`.
- **Dashboard:** No test for `dashboard_service`, the archived-case filter, or the boundary dates.
- **Finances:** No test for overpayment or for the old-case invalidation in F2.
- **Settings:** No validation tests for lock timeout (0, 1440, 1441), the change-password failure paths, or the lock-form and autostart/usage-counter error paths.
- **Backups:** No test for picker cancel.
- **Existing:** `finance_service` has one trivial unit test; the summaries are only covered by `canonical_domain_matrix.rs:278-284`.

### Areas checked and found fine

- **Money parsing:** `parseMoneyToMinor` handles Western, Arabic-Indic and Persian digits, both decimal marks, strict thousands groups, the safe-integer limit, and rejects zero or negative values. It is used for all three amount inputs.
- **Money storage and display:** Totals and summaries are integer sums. Display goes through Intl EGP with `<bdi>`.
- **Payer rule:** The service check plus the composite foreign key with RESTRICT enforce that the payer belongs to the case.
- **Date filters:** From/to are inclusive (`>=`/`<=`).
- **Default dates:** These use local `localDateOnly`.
- **Notes and method:** Cleared notes and payment method correctly become NULL on update.
- **Translations:** All `t()` keys exist in both ar and en with parity, including the dynamic keys.
- **Hard-coded strings:** None found apart from F17.
- **Error codes:** Every Rust `Error` maps to a translated `errors.*` key.
- **Language:** Language persists and flips `dir` via `applyDocumentDirection`; a failed `LanguageSwitcher` change rolls back.
- **Developer contact:** It uses fixed URLs only (mailto, tel, wa.me, t.me, LinkedIn), requires the app to be unlocked, and is tested.
- **Restore:** It requires confirmation, and on success the backend locks and the frontend clears the cache.
- **Dashboard links:** All deep links resolve.

### Coverage

**Finances page**

| Item                         | Result      |
| ---------------------------- | ----------- |
| Add payment / expense button | ✓           |
| Tabs                         | ✓           |
| Case filter                  | F4          |
| Client filter                | F4          |
| Clear filters                | ✓           |
| Case summary panel           | F1, F2      |
| Total line                   | ✓           |
| Ledger table                 | F4, F8, F17 |
| View (inspect) button        | F14         |
| Edit button                  | F4          |
| Save error                   | F5, F6      |

**Payment form**

| Item   | Result                                               |
| ------ | ---------------------------------------------------- |
| Case   | F4, F13                                              |
| Payer  | ✓                                                    |
| Amount | F15                                                  |
| Date   | ✓ (an invalid date only gives the generic error, F6) |
| Method | F16                                                  |
| Notes  | ✓                                                    |
| Cancel | ✓                                                    |
| Save   | F2, F7                                               |

**Expense form**

| Item          | Result       |
| ------------- | ------------ |
| Case / client | F4, F12, F16 |
| Amount        | F15          |
| Date          | ✓            |
| Type          | ✓            |
| Notes         | ✓            |
| Save          | F2           |

**Case detail, account tab**

| Item                 | Result |
| -------------------- | ------ |
| Four summary figures | F1, F9 |
| Fee input / Save     | F10    |
| Fee messages         | ✓      |
| Payments list / Add  | ✓      |
| Expenses list / Add  | ✓      |
| Inspection dialog    | F14    |
| Dialog error         | F5, F6 |

**Client detail, account tab**

| Item                      | Result |
| ------------------------- | ------ |
| Received / Expenses / Net | F3, F9 |
| Open-ledger link          | ✓      |

**Dashboard**

| Item                                | Result |
| ----------------------------------- | ------ |
| Date kicker                         | D2     |
| Add hearing / Add task              | ✓      |
| Hearings today stat                 | ✓      |
| Tasks today stat                    | ✓      |
| Overdue stat                        | ✓      |
| Week-ahead stat                     | D5     |
| Overdue panel and complete checkbox | ✓      |
| Today's hearings                    | D1     |
| Today's tasks                       | ✓      |
| Upcoming hearings                   | D1, D3 |
| Cases / Clients widgets             | D4     |
| Loading / error / retry             | ✓      |
| Empty states                        | ✓      |

**Search**

| Item                | Result        |
| ------------------- | ------------- |
| Header input        | SR6, SR7      |
| Ctrl/Cmd+K palette  | ✓             |
| Arrow keys / Escape | ✓             |
| Enter               | SR7           |
| Groups              | ✓             |
| Navigation          | ✓             |
| Indexing            | SR1, SR2, SR4 |
| Normalization       | SR3           |
| Archived records    | SR5           |

**Settings**

| Item                               | Result                                         |
| ---------------------------------- | ---------------------------------------------- |
| Tabs / URL tab param               | ✓                                              |
| Profile fields                     | ✓                                              |
| Profile save                       | S6                                             |
| Language                           | ✓                                              |
| Theme                              | ✓                                              |
| Date format                        | ✓                                              |
| Week start                         | ✓                                              |
| Reminder minutes                   | ✓ (front, back and database all allow 0–10080) |
| General save / messages            | ✓                                              |
| Lock timeout                       | S1, S2                                         |
| Autostart                          | S8                                             |
| Notifications                      | S7                                             |
| Password fields / submit           | S5                                             |
| Usage counters                     | S3                                             |
| Recovery note                      | ✓                                              |
| Privacy page / Manage-backups link | ✓                                              |
| Backups tab                        | B1–B5                                          |
| About version                      | S4                                             |
| Developer contacts                 | ✓                                              |
| Language switcher                  | ✓                                              |

**Backups page**

| Item                     | Result |
| ------------------------ | ------ |
| Latest-backup card       | B3     |
| Stale advice             | ✓      |
| Create                   | ✓      |
| Validate                 | B1     |
| Restore and confirmation | B2, B4 |
| Offsite advice           | ✓      |
| Concurrent actions       | B5     |

**Cross-cutting**

| Item                             | Result                                            |
| -------------------------------- | ------------------------------------------------- |
| Errors mapped to translations    | ✓ in the backend and Backups; F6 and S5 in the UI |
| i18n parity                      | ✓                                                 |
| RTL `<bdi>` on amounts and dates | ✓                                                 |
| Tests                            | T1                                                |

### Main files involved

- `/home/mk/Projects/CV_projects/legal-masr/src/features/finances/pages/FinancesPage.tsx`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/finances/api/financesApi.ts`
- `/home/mk/Projects/CV_projects/legal-masr/src/lib/queryInvalidation.ts`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/repositories/finance_repository.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/services/finance_service.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/dashboard/pages/DashboardPage.tsx`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/services/dashboard_service.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/normalize.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/services/search_service.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/services/client_service.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/search/components/GlobalSearch.tsx`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/settings/pages/SettingsPage.tsx`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/settings/schemas/settings.schema.ts`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/services/settings_service.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/migrations/0001_canonical_legal_masr.sql`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/backups/pages/BackupsPage.tsx`
- `/home/mk/Projects/CV_projects/legal-masr/src-tauri/src/services/backup_service.rs`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/cases/pages/CaseDetailPage.tsx`
- `/home/mk/Projects/CV_projects/legal-masr/src/features/clients/pages/ClientDetailPage.tsx`
