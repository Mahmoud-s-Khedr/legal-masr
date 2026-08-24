# Testing strategy

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Automated coverage

Rust unit and integration coverage includes:

- clean canonical migration, legacy-vault rejection without mutation, foreign
  key/integrity checks, strict booleans/money, duplicate internal identifiers,
  attachment single-owner integrity, and payment payer membership;
- client/POA/case relationships and archive paths, opponents, hearing decision
  chains, derived task views, fee/payment/expense summaries, and search index;
- managed attachment durability, copy failure cleanup, removal behavior, native
  path resolution, backup creation/validation/restore, and corrupt restore
  staging safety;
- password/recovery envelopes, safe error diagnostic redaction, reminder
  deduplication, and local settings validation.

Frontend Vitest/React Testing Library coverage includes bridge payload
contracts, typed error mapping, canonical query invalidation including failure
scope, forms, dialogs, task completion, payer filtering, optional expense
links, Arabic RTL/mixed-direction rendering, and primary workflow pages.

## Required validation commands

Run format check, lint, typecheck, frontend tests, frontend build, Rust format,
clippy with warnings denied, full Cargo tests, and a debug Tauri Debian build.
The Phase 7 report records the exact current run results. Failures must be
fixed or described as an unresolved release risk; they must not be skipped.

## Manual release matrix

| Area                                      | Linux dev |  Windows | macOS Intel | macOS Apple Silicon |
| ----------------------------------------- | --------: | -------: | ----------: | ------------------: |
| Vault initialize/unlock/recovery          |  Required | Required |    Required |            Required |
| Managed attachment picker/open/reveal     |  Required | Required |    Required |            Required |
| Native notification and autostart         |  Required | Required |    Required |            Required |
| Manual backup and corrupt-archive refusal |  Required | Required |    Required |            Required |
| Repeated restore/disaster exercise        |  Required | Required |    Required |            Required |
| Installer/update/uninstall                |       N/A | Required |    Required |            Required |
| 1440×900 and 1366×768 visual comparison   |  Required | Required |    Required |            Required |

No visual, notification, autostart, installer, or device claim is satisfied by
unit tests alone. The current correction-plan closeout still needs fresh seeded
viewport captures and physical Windows/macOS validation.
