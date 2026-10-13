# Link consistency review — 2026-10-13

Scope: relationships between clients, cases, tasks, expenses and powers of attorney.
Prompted by three symptoms in the running app: a task could link a client who is not
on its case, a POA's Cases tab was empty although its client had cases, and a case
showed a client "without POA" although the client had one.

## Method

The vault is SQLCipher-encrypted, so the audit read the schema, the Rust services and
the forms, and ran 28 probes against a throwaway database built from migrations
`0001`+`0002` (25 inputs that should be rejected were accepted). The vault itself was not
read; it was deleted on request because it only held test data.

## Rules decided with the product owner

- A task, expense or session is linked to a **case**; the client view derives it. A task or
  expense with no case may link a client directly. Never both.
- A client has **one active power of attorney**; a POA may have several clients and
  lawyers. Archived POAs do not block a new one.
- A case's POA is **derived** from its client; a case shows none only if the client has
  none. An archived POA is still shown, marked archived.
- Internal numbers stay free text; screens add context («توكيل 1 · رقم 12134 لسنة 2026»).

## Changes

Migration `0003_case_or_client_links.sql` (triggers, a `client_current_poa` view and data
repair; no table rebuild), Rust services and repositories, bridge types, task/expense
forms, POA form, case clients panel, POA detail, and `EntityPicker` (a value cleared
from outside left the old label in the input). See `database-schema.md` and
`plan/03-data-model.md`.

## Validation

- `cargo test --locked`: 128 lib tests and all integration suites pass (20 new in
  `tests/case_client_poa_links.rs`, 12 of which failed before the change); clippy
  `-D warnings` and `cargo fmt --check` clean. Run with a temporary `XDG_DATA_HOME`.
- `pnpm typecheck`, `pnpm lint`, Prettier, Vitest (585 tests) and script tests (64) pass.
- Not run: the native desktop audits/E2E, the visual capture comparison, a manual pass in
  `pnpm tauri dev`, and any Windows/macOS device. Visual baselines that show a POA title
  will differ (title now carries the «توكيل» prefix).

## Unresolved risks

- The triggers guard new writes only. A vault that already has a task with both links keeps
  the case link (the migration clears the client), but one with two active POAs for a client
  keeps both until edited; the view picks the newest.
- `case_clients.power_of_attorney_id` and its foreign key remain as dead schema.
- A multi-client case's expense appears in each client's view and total; the case summary
  is the source of truth.
- The error for a second active POA does not name the holding POA; the POA form disables
  and labels such clients instead.

## Deferred (audit items not in this change)

Real-date and time checks in the schema, case closed/status rules, hearing state and
previous-hearing rules, attachment path/hash checks, client national-ID/email/phone
validation, empty-string-to-NULL, text length limits, SUM overflow, and overpayment display.
