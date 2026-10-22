# Roadmap and phases

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Current implementation status — 2026-08-24

| Correction-plan phase                | Status      | Evidence / remaining work                                                                                                       |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Stabilize and inventory          | Complete    | Baseline inventory and reference capture map recorded.                                                                          |
| 1 — Canonical SQLite model           | Complete    | Sole pre-release migration 0001 (canonical schema and settings singleton); clean and superseded-schema refusal integrity tests. |
| 2 — Rust domain/persistence          | Complete    | Canonical services, repositories, commands, file compensation, and domain tests.                                                |
| 3 — Bridge/frontend types/hooks      | Complete    | Typed DTOs, contracts, schemas, query keys/invalidation tests.                                                                  |
| 4 — Shared component/shell alignment | Complete    | Frozen RTL navigation and accessible shared controls.                                                                           |
| 5 — Feature implementation           | Complete    | Canonical client/POA/case/hearing/task/finance/attachment/settings/search workflows.                                            |
| 6 — Test matrix/migration safety     | Complete    | Automated checks and Linux debug Debian build were previously recorded as passing.                                              |
| 7 — Documentation/visual sign-off    | In progress | Documentation and static boundary scan are being closed; fresh running-app visual captures are still required.                  |

## Public-beta blockers

1. Seeded running-app screenshot comparison at 1440×900 and 1366×768 against
   the approved Stitch screens, followed by correction of meaningful defects.
2. Portable cross-device restore using the original password, plus repeated
   restore exercises on Windows and Linux. Format v2 backups restore into an
   empty or incomplete installation with the original password or recovery key
   (implemented and tested on Linux, 2026-10-09); Windows↔Linux and repeated
   physical-device exercises remain open.
3. Documented case/full-installation exports, permanent deletion, and redacted
   support bundle.
4. Tray behavior.
5. Native Windows and Linux runner, package, install/update, and device checks.
6. Egyptian privacy legal review before public claims or release.

Restore preparation and preview are implemented. Notifications, reminders,
autostart and hearing-roll printing were removed on 2026-10-13. See the
[current feature inventory](../feature-list-and-testing.md).

## Later work

After those blockers are closed, hardening covers performance, accessibility,
Arabic copy, installer testing, migration fixtures, dependency/security review,
privacy review, failure-state review, and backup disaster exercises. A public
release also requires Authenticode-signed Windows delivery, a reviewed privacy notice,
terms, recovery/backup/install guides, release notes, support process, export
format documentation, and download integrity information.

Do not introduce users/roles/teams, cloud services, accounting systems,
generic event/party/transaction abstractions, task priorities, or telemetry
into LegalMaster Solo to satisfy this roadmap.

## Blocker #3, part 1 status — 2026-10-21

Guided permanent client/case/whole-vault deletion is implemented with preview,
localized confirmation, optional pre-deletion backup, password re-authentication
for reset, transactional rows/search, tracked file cleanup and cache refresh.
Shared records are refused conservatively; see [Privacy](06-privacy.md).
The [implementation report](../reviews/2026-10-21-permanent-deletion.md) records
validation and remaining risks. This closes the implementation scope for deletion;
exports remain blocker #3 work; support implementation is recorded below. Public launch is
scoped to Windows and Linux; macOS is excluded from this launch. Physical target
platform acceptance and the other public-release blockers remain open.

## Blocker #3, part 3 status — 2026-10-21

Manual redacted support bundles are implemented in Settings → About with a
localized content/exclusion list, native save picker, safe settings/system/schema
metadata, allow-listed logs, timestamped stable codes and a bilingual README.
There is no automatic sending. The [report](../reviews/2026-10-21-support-bundle.md)
records verification and outstanding Windows/Linux device acceptance. Complete
exports and the other release blockers remain open; this does not certify launch.
