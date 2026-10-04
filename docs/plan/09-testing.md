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

## Coverage map

The suite is intentionally layered; no single test type proves the whole
application.

| Layer                              | What it proves                                                                                                                               | Important failure paths                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust unit/service tests            | Input validation, safe error mapping, password/recovery envelopes, date-only and money rules, reminder timing, and managed-file compensation | invalid passwords/dates/money, missing records, failed file copy/delete, malformed notification times                                                          |
| Rust repository/schema integration | SQLCipher/SQLite invariants and transactions using a real database                                                                           | duplicate identifiers, invalid FK relationships, unsupported task states, invalid attachment ownership, payer outside its case, archive/delete rules           |
| Backup integration                 | Encrypted snapshot, manifest/checksum inventory, staged restore, and rollback protection                                                     | bad nonce/key/checksum, missing or unlisted archive entries, duplicate ZIP names, path traversal, newer schema, corrupt restore leaving active vault unchanged |
| Frontend component/workflow tests  | Typed bridge payloads, rendered RTL forms, query invalidation, navigation, and accessible controls                                           | locked vault does not query settings, locking clears legal-record cache, invalid forms, rejected mutations, absent payer options, keyboard/dialog behavior     |
| Build/package checks               | Type compatibility, lint/static rules, formatter conformance, and desktop packaging                                                          | compilation or bundle regressions; package creation is not a substitute for target-device testing                                                              |
| Manual target-device matrix        | Native dialogs, OS notifications/autostart, sleep/resume locking, installer behavior, encrypted restore, and visual/accessibility quality    | OS-specific permission, lifecycle, rendering, install, and recovery failures that mocks cannot establish                                                       |

The automated suite establishes contract and regression confidence. It does
not claim physical Windows/macOS behavior, screenshot parity, or a real-world
backup disaster exercise; those remain explicit manual release gates.

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
