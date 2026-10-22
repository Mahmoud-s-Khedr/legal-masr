# Roadmap and phases

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Current implementation status — 2026-10-22

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

## Public-beta readiness — 2026-10-22

Implementation is complete for permanent deletion, unencrypted exports, a
redacted support bundle, optional tray behavior, data-flow fixes, ZIP security
updates, and Windows desktop CI harness improvements. Evidence is linked from
[the launch checklist](../launch-checklist.md). These implementations do not
complete owner approval or physical platform acceptance.

Remaining launch gates are: approve visual baselines; complete physical Windows
10/11 checks; complete physical Linux desktop checks (GNOME with and without
AppIndicator, and KDE); decide Authenticode signing; complete Egyptian
privacy/legal review and publish the privacy notice and terms; then tag the
release candidate to create a draft release. Cross-device and repeated physical
restore acceptance, user guides and support process also remain open. See the
[launch checklist](../launch-checklist.md) for the ordered owner gates and the
pending Linux e2e verdict placeholder.

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
validation and remaining risks. This closes the implementation scope for deletion. Exports and support are also implemented (below). Public launch is
scoped to Windows and Linux; macOS is excluded from this launch. Physical target
platform acceptance and the other public-release blockers remain open.

## Blocker #3, part 2 status — 2026-10-21

Documented complete-installation and case CSV/document/manifest exports are
implemented with plaintext warnings, asynchronous native folder selection,
serialized snapshot reads, verified document copies and no-overwrite publication.
See [the format](../export-format.md) and
[validation report](../reviews/2026-10-21-exports.md). Physical Windows/Linux acceptance remains open.

## Blocker #3, part 3 status — 2026-10-21

Manual redacted support bundles are implemented in Settings → About with a
localized content/exclusion list, native save picker, safe settings/system/schema
metadata, allow-listed logs, timestamped stable codes and a bilingual README.
There is no automatic sending. The [report](../reviews/2026-10-21-support-bundle.md)
records verification and outstanding Windows/Linux device acceptance. The release still requires owner approval and physical platform acceptance; implementation does not certify launch.
