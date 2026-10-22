# LegalMaster Solo — Project plan

**Product:** LegalMaster Solo
**Target:** individual Egyptian lawyers
**Platforms:** Windows 10/11 x64 and Linux x64 (deb, rpm, AppImage); macOS deferred
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

The product is not yet public-beta ready. Cross-device restore, documented
complete exports, permanent deletion, a redacted
support bundle, visual capture comparison, and physical Windows and Linux validation
remain release risks. The authoritative correction decision record
is [finalized-domain-correction-plan.md](finalized-domain-correction-plan.md);
its evidence and risks are recorded in
[finalized-domain-phase-7-report.md](finalized-domain-phase-7-report.md).

## Pre-launch remediation — 2026-10-08

The current review remains **do not launch**. The complete issue/coverage
inventory is tracked in the [remediation register](reviews/2026-10-08-remediation-register.md),
with [scoped contribution tasks](reviews/2026-10-08-remediation-tasks.md) and
[execution evidence](reviews/2026-10-08-remediation-progress.md). Initial vault
creation/opening, journaled replacement and snapshot-retention fixes are implemented;
the operation/session coordinator and the remaining workflow/release work are open.
This work does not certify phase acceptance or public-beta readiness.

A later [beta-readiness pass](reviews/2026-10-08-beta-pass.md) fixed the reproducible editing, layout, theme and
error-message defects and added migration `0002`. The recommendation is unchanged: do not give testers real client
data until backups are portable and restore-safe (B01/B02) and the app has been run on Windows and Linux.

## Canonical offline integration — 2026-10-10

The local UI is the design reference. Remote functionality is integrated through
existing components, with one canonical authenticated backup implementation and
one choose/authenticate/preview/confirm restore flow across setup, incomplete vaults
and Settings. Recovery restore stages a new password in the same journal; foreign
vault replacement requires authentication. Old backup readers, alternate key stores
and superseded commands are removed. Numbered migrations are unchanged.

The operation/session coordinator, archived-owner checks and dependent search
refresh are implemented. The final contract is in
[plan/07-backup-format.md](plan/07-backup-format.md). Integration evidence and remaining
platform risks are recorded in [the integration review](reviews/2026-10-10-integration.md).
Physical Windows/Linux journeys and the remaining roadmap release blockers are
still open; this development merge does not certify public-beta readiness.

## Public launch scope — 2026-10-21

The first public release targets Windows 10/11 x64 and Linux x64 (deb, rpm,
AppImage). macOS is deferred; source support is retained while macOS packaging
and release jobs are excluded. Windows Authenticode signing, physical Windows
and Linux validation, privacy/legal review, approved screenshot comparison,
exports, permanent deletion, support bundle, tray behavior, and launch materials
remain open. See the [launch checklist](launch-checklist.md).

## Current product scope — 2026-10-14

The [feature inventory and testing guide](feature-list-and-testing.md) describes
the implemented pre-beta workflows. Notifications, reminder values, autostart,
hearing-roll printing and individual client export have been removed. Automatic
backup schedules, retention policies, a configurable primary backup destination
and backup-history UI are out of scope. Immutable migrations `0001`–`0004`
define the current schema. Restore preparation and preview are implemented;
physical Windows/Linux acceptance and the remaining export/deletion/support
work remain open. Local aggregate-counter consent remains backend-only.

## Permanent deletion implementation — 2026-10-21

Public-beta blocker #3 part 1 (guided permanent deletion) is implemented for
archived clients, archived cases and all vault data. Migration `0005` adds a
transactional file-cleanup outbox. The [deletion report](reviews/2026-10-21-permanent-deletion.md)
records decisions, automated validation and unverified device risks. Exports,
support bundles and other release blockers remain open. The current public
launch targets Windows and Linux; macOS is outside this launch scope.

## Documented exports — 2026-10-21

Public-beta blocker #3 part 2 is implemented: complete domain-data and single-case
exports produce BOM UTF-8 CSVs, verified managed documents and a SHA-256/count
manifest in a user-chosen folder. These exports are unencrypted disclosures, not
backups. See the [versioned export format](export-format.md) and
[implementation/validation report](reviews/2026-10-21-exports.md). No schema change
was needed. Physical Windows/Linux acceptance and other launch blockers remain open.

## Support bundle implementation — 2026-10-21

Public-beta blocker #3 part 3 is implemented: Settings → About can manually save
a redacted diagnostics ZIP after displaying a localized inclusion/exclusion list.
The user controls sharing; no data is sent. See the
[support-bundle report](reviews/2026-10-21-support-bundle.md) for validation,
conservative decisions and remaining Windows/Linux physical checks. Other
launch blockers remain open. Schema migrations are unchanged.

## Optional tray implementation — 2026-10-22

Blocker #4 implementation is present for Windows and Linux, with default-OFF
settings, immediate lock on hide, single-instance reveal, guarded Quit and Linux
host fallback. Migration `0006` adds the persisted preference. Automated results
and conservative decisions are recorded in [the tray report](reviews/2026-10-21-tray.md).
Physical Windows 10/11, GNOME with/without AppIndicator and KDE acceptance remain
open; this does not certify public-launch readiness.
