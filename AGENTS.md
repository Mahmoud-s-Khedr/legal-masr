# LegalMaster Solo contribution rules

1. Read `docs/plan.md` and the relevant topic document before editing.
2. Work only within the assigned phase and acceptance criteria.
3. Never access the database from React or expose arbitrary filesystem, shell, or HTTP access to it.
4. All schema changes require a new immutable numbered migration.
5. Preserve Arabic RTL behavior; money uses integer minor units and date-only values stay timezone-free.
6. Do not add cloud services, telemetry, or logs containing personal/legal data, passwords, keys, or document paths.
7. Add normal and failure-path tests for business rules, and report validation results and unresolved risks.
