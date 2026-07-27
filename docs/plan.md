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

| File | Covers |
| --- | --- |
| [01-product-requirements.md](plan/01-product-requirements.md) | Product definition, product goals, non-goals, target user/personas, product principles (offline-first, local ownership, simplicity), main navigation, v1.0 success criteria |
| [02-architecture.md](plan/02-architecture.md) | Technical architecture, prohibited architecture, repository structure, Rust application layering & command naming, frontend engineering standards, performance targets, final architecture summary |
| [03-data-model.md](plan/03-data-model.md) | Database model (all tables and proposed schema), database migration rules and process |
| [04-functional-modules.md](plan/04-functional-modules.md) | Onboarding, dashboard, clients, cases, hearings/events, tasks, calendar/reminders, documents, financial tracking, global search, settings |
| [05-security.md](plan/05-security.md) | Application security and unlocking (password/recovery-key envelope design), network policy, Tauri permissions, logging, support bundle, dependency security |
| [06-privacy.md](plan/06-privacy.md) | Privacy-by-architecture principle, Egyptian data-protection law context, privacy and data-management tools, export and deletion workflows |
| [07-backup-format.md](plan/07-backup-format.md) | Backup archive structure, manifest, backup creation/restore process, backup encryption |
| [08-release-process.md](plan/08-release-process.md) | Application updater flow and privacy, Windows/macOS packaging, CI/CD, release artifacts |
| [09-testing.md](plan/09-testing.md) | Rust unit/integration tests, frontend tests, contract tests, backup tests, migration tests, manual platform test matrix |
| [10-roadmap-and-phases.md](plan/10-roadmap-and-phases.md) | Implementation phases 0–9, suggested branch sequence, post-MVP roadmap, immediate implementation order |
| [11-agent-workflow.md](plan/11-agent-workflow.md) | AI-agent operating model, agent task template, pull request requirements, definition of done, product validation checkpoints |

The security, database and backup foundations (see phase 1 in [10-roadmap-and-phases.md](plan/10-roadmap-and-phases.md)) must be proven before the application grows. This prevents LegalMaster Solo from repeating the principal mistake of the previous project: implementing a large feature surface before validating the deployment architecture.

## Implementation status — 2026-07-27

Phase 1 is in progress. The Tauri/React scaffold, Arabic RTL lock and first-run screens, Rust-only SQLCipher boundary, password and recovery-key envelopes, initial migration, encrypted backup creation/validation, focused cryptographic tests, lockfile-enforced validation workflow, and cross-platform draft-release workflow are implemented. Linux x86-64 packaging has been validated locally; the release workflow produces unsigned Windows NSIS and ad-hoc-signed, unnotarized Intel/Apple Silicon macOS artifacts with SHA-256 checksums.

Native Windows/macOS runner execution and physical-device packaging validation remain incomplete, as do Phase 0 lawyer-workflow research and the remaining Phase 1 exit criteria. No product feature phase has started.
