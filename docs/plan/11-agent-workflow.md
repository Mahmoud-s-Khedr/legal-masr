# AI-agent operating model

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 20. AI-agent operating model

The project should be designed for agents to execute small, verifiable tasks rather than broad instructions such as "build the cases module."

## 20.1 Required repository instructions

Create `AGENTS.md` containing:

```text
1. Read PROJECT_PLAN.md and relevant architecture documents before editing.
2. Work only on the assigned issue.
3. Do not add features outside the acceptance criteria.
4. Do not change the database schema without a migration.
5. Do not edit an applied migration.
6. Do not access the database directly from React.
7. Do not expose arbitrary filesystem, shell or HTTP access to React.
8. Do not add cloud services.
9. Do not add analytics or telemetry.
10. Do not log personal or legal data.
11. Preserve Arabic RTL behavior.
12. Store money as integer minor units.
13. Store date-only fields without timezone conversion.
14. Add tests for new business rules.
15. Run all required validation commands before completion.
16. Update relevant documentation when contracts or behavior change.
17. Report assumptions and unresolved risks explicitly.
```

## 20.2 Agent task template

Each task should contain:

```text
Title:
One precise implementation objective.

Context:
Why the feature exists and which documents govern it.

Allowed scope:
Files and modules that may be changed.

Requirements:
Numbered functional requirements.

Non-goals:
Features the agent must not add.

Data changes:
Migration requirements and constraints.

Security considerations:
Sensitive operations and prohibited behavior.

Acceptance criteria:
Observable results that must pass.

Tests:
Required unit, integration and UI tests.

Validation commands:
Exact commands the agent must run.

Deliverables:
Code, migration, tests and documentation.
```

## 20.3 Example agent task

```text
Title:
Implement case creation service and command.

Context:
Cases belong to one primary client and are created through the Rust
application boundary. React must not execute SQL.

Allowed scope:
src-tauri/src/domain/cases
src-tauri/src/repositories/cases
src-tauri/src/services/cases
src-tauri/src/commands/cases
src-tauri/migrations
src/bridge

Requirements:
1. Add the cases table using a new migration.
2. Implement CaseRepository::create.
3. Implement CreateCaseService.
4. Validate that the client exists and is not archived.
5. Insert the search-index entry in the same transaction.
6. Expose case_create Tauri command.
7. Return a CaseDto.

Non-goals:
Case UI, parties, events, documents and finances.

Acceptance criteria:
1. Valid case creation succeeds.
2. Missing client returns CLIENT_NOT_FOUND.
3. Archived client returns CLIENT_ARCHIVED.
4. Transaction rollback leaves no case or search entry.
5. No SQL exists in the command module.
6. No database command is exposed to React.

Tests:
Repository integration tests and service tests.
```

## 20.4 Task sizing

Each agent task should normally require:

* One focused behavior
* One migration at most
* A small group of related files
* Clear tests
* Reviewable diff

Avoid tasks such as:

```text
Build the entire legal system.
Implement all case management.
Improve the architecture.
Add security.
Make the UI professional.
```

These tasks permit uncontrolled scope and weak verification.

## 20.5 Parallel agent work

Agents may work in parallel only when their modules do not share an unstable contract.

Safe parallel work examples:

* Client UI after client command contract is frozen
* Arabic translation and case repository tests
* Windows release workflow and frontend accessibility
* Documentation and isolated UI components

Unsafe parallel work examples:

* Multiple agents modifying the same migration sequence
* Database and frontend agents independently inventing DTOs
* Backup and security agents independently designing encryption
* Multiple agents changing application state initialization

One agent or developer must own integration decisions.

---

# 21. Pull request requirements

Every pull request must include:

* Problem being solved
* Scope
* Screenshots for UI changes
* Database migration summary
* Security implications
* Tests added
* Validation commands run
* Known limitations
* Documentation changed

## Required checks

Frontend:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Rust:

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
cargo audit
```

Desktop:

```bash
pnpm tauri build
```

Platform packaging builds may run in CI rather than every local change.

---

# 22. Definition of done

A feature is complete only when:

1. Acceptance criteria pass.
2. Domain rules exist in the Rust service layer.
3. Database changes have migrations.
4. Errors use stable codes.
5. Tests cover normal and failure behavior.
6. Arabic and RTL behavior is verified.
7. Keyboard behavior is verified.
8. Sensitive data is absent from logs.
9. No unnecessary permission is added.
10. No network dependency is introduced.
11. Documentation is updated.
12. CI passes.
13. Backup and migration implications are reviewed.
14. Empty, loading and failure states exist.
15. The feature is usable without internet access.

"Code compiles" is not sufficient.

---

# 23. Product validation checkpoints

## Checkpoint A — Technical feasibility

After Phase 1:

* Is SQLCipher stable on every target?
* Can backup and restore work reliably?
* Is the binary size acceptable?
* Is the security flow understandable?

If not, stop and revise architecture before building features.

## Checkpoint B — Workflow usefulness

After Phase 4:

* Do lawyers use the dashboard daily?
* Do they record hearing outcomes?
* Can they find the next hearing faster than using paper?
* Which data fields are consistently ignored?
* Which missing field blocks real work?

Remove unused complexity rather than adding more screens.

## Checkpoint C — Data trust

After Phase 7:

* Do users understand where data is stored?
* Can they restore a backup themselves?
* Do they trust local-only operation?
* Are they confused about external versus managed documents?
* Can they move to a new computer?

## Checkpoint D — Public readiness

Before version 1.0:

* Privacy review passed.
* Restore tested on all platforms.
* Installers signed.
* Update process tested.
* No critical or high-severity security issue remains.
* Beta users have used the application for real legal work.
* Product terminology has been reviewed by practicing lawyers.
