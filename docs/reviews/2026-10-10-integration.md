# Canonical offline integration — 2026-10-10

The current local UI is preserved and the useful remote functionality is integrated
into one implementation. This review supersedes the unfinished integration handoff
and earlier competing backup descriptions. This is a development merge, not public
beta approval.

## History and scope

The recovery branch `recovery/local-ui-2026-10-10` retains local commit `66393f9`.
Integration uses an isolated worktree and a real merge of remote `5f688ab` into that
local history. Origin was fetched again and had no additional changes. The final
merge retains both parents and fast-forwards local `main`; no push is
part of this task. Numbered SQL migrations are unchanged. Development vaults and
source documents were never deleted or used as test fixtures.

Incoming changes were reviewed across the desktop workflow, repositories/services,
bridge, forms, pages, styles, tests, CI and documentation, including automatically
merged files. The local layouts, typography, spacing, footer/contact links, form
fieldsets, action ordering, Settings initialization and not-found routes remain the
reference. No cloud service, telemetry or runtime network dependency was added.

## Integrated behavior

- Native file dialogs run off the event loop. Navigation stays inside the bundled
  app, phone numbers copy without replacing the window, routes reset scrolling,
  and the language chosen before unlocking is saved after unlock.
- Arabic spelling and Arabic/Persian digits normalize for search and identifiers.
  Phone digits match, wildcard characters are literal, lists sort naturally, cases
  and powers of attorney search related clients and richer references, and identical
  result names select by entity identity. Client/relationship edits update dependent
  index entries transactionally.
- Forms suggest unused internal numbers, preserve the office's sequence/year
  pattern, offer richer choices and empty guidance, report specific validation,
  accept flexible time entry and submit canonical validated values. Calendar dates
  require four explicit year digits; two-digit years are refused, including on blur
  and Enter. Money remains integer minor units and dates remain timezone-free.
- Dirty drafts include custom entity/date/select controls and selected files.
  Reverting edits makes a draft clean. Escape, close and Cancel use an accessible
  discard confirmation; outside clicks cannot dismiss the form. Pending submissions
  cannot be dismissed or submitted twice, and failed saves retain the draft.
- Cases show court/next-hearing information and pending decisions. Agenda entries
  include time, case and court, repeatable create links, court/circuit defaults,
  past-day toggling and hearing-roll printing. Decided hearings remain on today's
  dashboard. Printing collapses unrelated content and avoids blank pages.
- Global document creation selects an active owner and opens its add form once.
  Discarded custom owner choices reset before reopening.
- Payment/expense deletion requires confirmation, updates affected account totals,
  and refuses attached expenses with an explanation. Single-client cases default
  their payer. Archived cases are read-only in React and Rust, including global
  pages; both existing and proposed owners are checked during reassignment and
  expense-owned documents resolve their owning case.
- Recovery keys can be copied, printed and saved, and replaced after current-password
  confirmation. The unused usage-counter control and its React hook were removed.

## One backup and restore implementation

The authoritative contract is [the backup specification](../plan/07-backup-format.md).
The canonical v2 archive authenticates its mandatory security header and encrypted
contents, verifies exact manifest/checksum/document inventories, checks safe names
on Windows as well as Linux, and bounds password derivation before using untrusted
parameters. Other formats are refused. Older readers, alternate key stores,
superseded commands and the obsolete portability audit script are removed; fixtures
are generated directly in the final format.

Setup, incomplete recovery and Settings reuse choose → authenticate/prepare →
preview → confirm. Only tokens, filenames and summaries cross IPC; native paths,
prepared keys and staged snapshots stay in Rust. Preparation leaves live data
unchanged. Cancellation, supersession and lock clear preparation and reject late
results. Operations share an exclusive gate; session generations are checked after
native dialogs and at the renderer boundary.

Empty, incomplete and unlocked destinations may restore authenticated archives,
including foreign vaults. Healthy locked destinations and unfinished journals
refuse replacement. Same-key password restore preserves current security; foreign
restore adopts authenticated backup security. Recovery restore requires a new
password and matching confirmation, staged inside the same journaled replacement.
Replaced workspace files remain in emergency snapshots, and completion is locked
with a notice identifying the password to use.

Creation and save-copy use unique temporary files, flushing, verification and cleanup
on failure, with collision-safe local-date filenames. Save-copy and reveal actions
use native dialogs. Restore history is settled from the validated snapshot.

## Visual review

Fresh pristine captures were made from the recovery commit before implementation,
using fictional Arabic/English data at 1366×768 and 1440×900 plus targeted 800×900
and dark views. Both reference and candidate were captured in the pinned Ubuntu
24.04 / Playwright 1.63.0 Chromium container, with a fixed clock and Africa/Cairo.
The [84-image comparison](evidence/2026-10-10/local-ui-comparison.json) records
dimensions and hashes: 37 images are identical. Changed areas were inspected side
by side and accepted only for the requested features or demonstrated defects:
case columns, detailed agenda, number suggestions/date hints, recovery/backup
controls, richer case labels and task status presentation.

Rejected incoming visual changes include removal of the local footer/contact links,
reordering Cancel before the action, broad table-header wrapping and an unrelated
narrow Settings layout change. Local POA fieldsets and Settings/not-found behavior
are retained. The old screenshot baseline was replaced only after this comparison.
Visual thresholds remain 0.2 and 0.001 differing-pixel ratio. The manifest retains
candidate status because release approval is a separate gate.

## Validation

The final Rust run used a disposable `XDG_DATA_HOME` inside a Linux network
namespace with only loopback enabled. The native run uses an isolated DBus/Xvfb
session in the same kind of network namespace; browser PDF tests use a Docker
container with `--network none`. Tests never use the development vault.

| Check                                                                 | Result                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Frontend format / ESLint / TypeScript                                 | Passed                                                                                  |
| Renderer tests / script tests                                         | 573 / 60 passed                                                                         |
| Renderer coverage / unchanged coverage floors                         | Statements and lines 87.80%, branches 85.14%, functions 78.59%; all floors passed       |
| Rust format / Clippy, all features and targets, warnings denied       | Passed                                                                                  |
| Rust tests and production coverage, networking disabled               | 159 passed; regions 57.53%, functions 59.81%, lines 61.95%                              |
| Rust tests with all features, networking disabled                     | 160 passed                                                                              |
| RustSec audit                                                         | Exit 0, no vulnerability findings; six unmaintained and one unsoundness warnings remain |
| Fresh local UI comparison                                             | 84 captures reviewed; 37 identical; only feature/defect differences accepted            |
| Canonical baseline update and final comparison / checksummed manifest | 71 checks passed in each run / 68 captures verified                                     |
| Complete offline Linux native journeys                                | 11 passed, including real GTK picker responsiveness, cancellation and locking           |
| Printing with networking disabled                                     | 2 passed; hearing roll and synthetic recovery key each produce one isolated A4 page     |
| Normal Linux debug desktop package                                    | Debian package built; normal binary passes harness-boundary scan                        |

The [complete native outcome report](evidence/2026-10-10/desktop-offline.json)
records all 11 scenarios and the tested harness binary hash. The
[final validation summary](evidence/2026-10-10/validation.json) records counts and
coverage. Earlier timeout/interruption attempts are not counted as passing
evidence. Renderer concurrency was reduced for the final run without changing
assertions, coverage floors or timeouts. A concurrent Playwright output-directory
collision was resolved by running capture suites sequentially; thresholds are
unchanged.

The [dependency audit summary](evidence/2026-10-10/dependency-audit.json) records all
remaining warnings without ignored advisories. Binary and package SHA-256 values:

- Normal debug binary: `3ea892615e9b1834baf1834f440e8862fede16e6f5ee520e4ccd0608901b1eb1`
- Debian debug package: `4daa54245108f699e76912acc70600c19d134b6badf2b12cf02694985090de0f`

## Remaining platform and release risks

Physical Windows and macOS validation was not performed. File sharing, directory
durability, native picker/WebView behavior and cross-platform backup restoration
remain platform acceptance work. No claim of physical-printer validation is made.

RustSec audit reports GTK/Tauri transitive maintenance warnings and the existing
`glib` 0.18.5 VariantStrIter unsoundness warning. Its fix requires glib ≥0.20, while
the current Tauri GTK3/WebKit stack depends on 0.18. Application code does not call
the listed iterator functions; this observation does not clear the upstream risk.
See [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
The available event-listener fix was applied by updating the lockfile to 5.4.2;
see [RUSTSEC-2026-0221](https://rustsec.org/advisories/RUSTSEC-2026-0221.html).
No advisory is ignored and no coverage floor or visual threshold is weakened.

Other roadmap release work, including automatic backup/retention, full export UI,
permanent deletion, emergency-snapshot management and a redacted support bundle,
remains outside this integration's acceptance scope. Emergency snapshots are never
automatically pruned. Crash-abandoned prepared directories are inert encrypted
database/copied attachment staging, not resumable tokens; startup orphan pruning is
not implemented. The integration does not certify public-beta readiness.
