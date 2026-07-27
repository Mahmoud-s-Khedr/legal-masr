# LegalMaster Solo — Detailed Project Plan

**Document status:** Active implementation plan
**Product:** LegalMaster Solo
**Target market:** Individual Egyptian lawyers
**Primary platforms:** Windows and macOS
**Product model:** Free, offline-first desktop application
**Core stack:** Tauri 2, React, TypeScript, Rust, SQLCipher/SQLite
**Initial release language:** Arabic, with an English-ready localization structure

---

This plan was split into topic-scoped files under [`docs/plan/`](plan/) so it's easier to read and to reference from issues, PRs and agent tasks. Each file is self-contained and links back here.

| File                                                          | Covers                                                                                                                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-product-requirements.md](plan/01-product-requirements.md) | Product definition, product goals, non-goals, target user/personas, product principles (offline-first, local ownership, simplicity), main navigation, v1.0 success criteria                        |
| [02-architecture.md](plan/02-architecture.md)                 | Technical architecture, prohibited architecture, repository structure, Rust application layering & command naming, frontend engineering standards, performance targets, final architecture summary |
| [03-data-model.md](plan/03-data-model.md)                     | Database model (all tables and proposed schema), database migration rules and process                                                                                                              |
| [04-functional-modules.md](plan/04-functional-modules.md)     | Onboarding, dashboard, clients, cases, hearings/events, tasks, calendar/reminders, documents, financial tracking, global search, settings                                                          |
| [05-security.md](plan/05-security.md)                         | Application security and unlocking (password/recovery-key envelope design), network policy, Tauri permissions, logging, support bundle, dependency security                                        |
| [06-privacy.md](plan/06-privacy.md)                           | Privacy-by-architecture principle, Egyptian data-protection law context, privacy and data-management tools, export and deletion workflows                                                          |
| [07-backup-format.md](plan/07-backup-format.md)               | Backup archive structure, manifest, backup creation/restore process, backup encryption                                                                                                             |
| [08-release-process.md](plan/08-release-process.md)           | Application updater flow and privacy, Windows/macOS packaging, CI/CD, release artifacts                                                                                                            |
| [09-testing.md](plan/09-testing.md)                           | Rust unit/integration tests, frontend tests, contract tests, backup tests, migration tests, manual platform test matrix                                                                            |
| [10-roadmap-and-phases.md](plan/10-roadmap-and-phases.md)     | Implementation phases 0–9, suggested branch sequence, post-MVP roadmap, immediate implementation order                                                                                             |
| [11-agent-workflow.md](plan/11-agent-workflow.md)             | AI-agent operating model, agent task template, pull request requirements, definition of done, product validation checkpoints                                                                       |

The security, database and backup foundations (see phase 1 in [10-roadmap-and-phases.md](plan/10-roadmap-and-phases.md)) must be proven before the application grows. This prevents LegalMaster Solo from repeating the principal mistake of the previous project: implementing a large feature surface before validating the deployment architecture.

## Implementation status — 2026-07-27

Phases 2 and 3 are complete; Phases 4 and 5 are in progress. The Tauri/React scaffold, Arabic RTL lock and first-run screens, Rust-only SQLCipher boundary, password and recovery-key envelopes, migrations through `0005_financial_tracking.sql`, clients, cases, events, tasks, documents, global search, and the initial finance ledger are implemented. The backup archive encrypts the database and managed documents and validates per-file SHA-256 checksums before restore.

Phase 6 is in progress: EGP-only fee agreements, transactions, reversals, summaries, and the finance register are implemented, while case/client detail summaries and a complete printable statement remain. Phase 7 is in progress only for archive contents/checksum validation and managed-document restore; portable cross-device restore, automatic backup/retention/history, exports, permanent deletion, privacy tools, and support bundles remain. Native Windows/macOS runner execution and physical-device packaging validation, Phase 0 research, and Phase 1's cross-platform exit criterion remain incomplete.
