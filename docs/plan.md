# LegalMaster Solo — Project plan

**Product:** LegalMaster Solo
**Target:** individual Egyptian lawyers
**Platforms:** Windows and macOS
**Model:** offline-first desktop application
**Stack:** Tauri 2, React, TypeScript, Rust, SQLCipher/SQLite

The topic-scoped plan documents remain the product reference:

| File                                                          | Covers                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| [01-product-requirements.md](plan/01-product-requirements.md) | Product definition and principles                  |
| [02-architecture.md](plan/02-architecture.md)                 | Implemented architecture and trust boundary        |
| [03-data-model.md](plan/03-data-model.md)                     | Canonical schema and migration policy              |
| [04-functional-modules.md](plan/04-functional-modules.md)     | Implemented workflows and known gaps               |
| [05-security.md](plan/05-security.md)                         | Security, permissions, logging, and support policy |
| [06-privacy.md](plan/06-privacy.md)                           | Privacy-by-architecture and data-management status |
| [07-backup-format.md](plan/07-backup-format.md)               | Current backup and restore format                  |
| [08-release-process.md](plan/08-release-process.md)           | Packaging and release process                      |
| [09-testing.md](plan/09-testing.md)                           | Automated and manual validation matrix             |
| [10-roadmap-and-phases.md](plan/10-roadmap-and-phases.md)     | Current roadmap and release blockers               |
| [11-agent-workflow.md](plan/11-agent-workflow.md)             | Contribution and verification workflow             |
| [database-schema.md](database-schema.md)                      | Current database tables, relationships, and rules  |

## Current status — 2026-08-24

The canonical domain implementation (correction-plan Phases 0–6) is complete:
SQLCipher baseline migration `0001`, Rust services and commands, typed bridge,
Arabic RTL workflows, automated domain/backup/UI coverage, and a Linux debug
bundle have been validated. Phase 7 is in progress: documentation is being
aligned with the implementation, a source-boundary scan is complete, and
fresh visual sign-off is blocked until a seeded running-app capture environment
is available.

The product is not yet public-beta ready. Cross-device restore, automatic
backup/retention, documented complete exports, permanent deletion, a redacted
support bundle, visual capture comparison, and physical Windows/macOS
validation remain release risks. The authoritative correction decision record
is [finalized-domain-correction-plan.md](finalized-domain-correction-plan.md);
its evidence and risks are recorded in
[finalized-domain-phase-7-report.md](finalized-domain-phase-7-report.md).
