# Linux public-launch end-to-end verification

Execution: 2026-10-22, Fedora x86-64, Wayland session with Xwayland `DISPLAY=:0`,
`TZ=Africa/Cairo`. Task identifier/report date: 2026-10-21. Windows physical
checks belong to the owner; macOS is outside this launch.

Linux launch-ready: NO — verification is in progress; this line will be updated
only from retained execution results.

## Implemented files

- `scripts/launch-native-e2e.mjs`: bilingual launch journeys through real native
  IPC/UI, with runner-side export/ZIP inspection and actual permission-based
  unlink failure/retry.
- `scripts/launch-tray-e2e.mjs`, `scripts/launch-tray-host.py`: owned-window close,
  process exit, lock/hide/reveal, persisted preference and isolated host fixture.
- `scripts/launch-artifacts.mjs` and adjacent tests: independent CSV record,
  byte/hash/count and ZIP privacy checks, including refusal variants.
- `scripts/desktop-e2e.mjs`, `scripts/guide-desktop.mjs`: XDG isolation and orderly
  driver shutdown; existing scenario assertions remain intact.
- `src-tauri/src/desktop_e2e.rs`, export/support services: fixed picker choices
  compiled only with `desktop-e2e`, with normal/refusal/isolation tests.
- `package.json`: explicit `test:launch:linux` command. Plan testing, release and
  functional status plus the feature inventory link this evidence and its gaps.
  There is no schema change.

## Scope and conservative decisions

All native records are fictional. The existing compile-time `desktop-e2e` binary
requires a nonce and marker in a direct temporary child, refuses unmarked
launches, and overrides the vault root. Both native runners now also isolate
`XDG_DATA_HOME`, `XDG_CONFIG_HOME` and `XDG_CACHE_HOME` under that root, so WebView
storage and OS preferences do not use the developer's normal locations. No real
vault is inspected. Cargo tests use a newly created temporary `XDG_DATA_HOME`.
No system-wide package installation, branch operation, commit, container visual
command or canonical screenshot comparison is part of this run.

`xdotool` was absent. An RPM was downloaded into a runner-created temporary
folder and extracted there; no root privileges or system installation were used.
The current GNOME session has no registered StatusNotifier host. No-host close
behavior is tested on that session. Host-present tests use an isolated
`dbus-run-session` and a minimal StatusNotifierWatcher fixture; native appindicator
registration, real X11 window-close requests, lock and hide are exercised. This
fixture does not establish actual GNOME/KDE menu presentation or pointer actions.

The fixed native picker-choice mechanism is extended for export folders and
support ZIPs. Production picker behavior is unchanged. No renderer command,
filesystem access, shell access, network access, schema or migration is added.
Support-bundle inspection occurs in the runner, not in React. Reports retain
fixed scenario/checkpoint names and checksums, never raw IPC/WebDriver exceptions,
record dumps, credentials, recovery keys, archives or temporary workspace paths.

## Reproducible commands and evidence

Evidence is under ignored `test-results/launch-e2e/`. Per-scenario JSON reports
are authoritative; command logs record build/check failures. Run native commands
serially because they share driver port 4444. Use the built harness executable,
not the release binary, for the disposable native scenarios.

```bash
TZ=Africa/Cairo pnpm build:desktop:e2e
TZ=Africa/Cairo DISPLAY=:0 GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  LEGALMASTER_E2E_OUTPUT_DIRECTORY=test-results/launch-e2e/desktop pnpm test:desktop
TZ=Africa/Cairo DISPLAY=:0 NATIVE_AUDIT_OUTPUT=test-results/launch-e2e/office pnpm test:office
TZ=Africa/Cairo DISPLAY=:0 NATIVE_CONTROLS_OUTPUT=test-results/launch-e2e/controls pnpm test:desktop:controls
TZ=Africa/Cairo DISPLAY=:0 pnpm test:launch:linux
TZ=Africa/Cairo pnpm build:linux
node scripts/verify-appimage-runtime.mjs src-tauri/target/release/bundle/appimage
D=$(mktemp -d)
XDG_DATA_HOME=$D cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features
rm -rf "$D"
```

The temporary xdotool directory must be on `PATH` and its extracted library
folder on `LD_LIBRARY_PATH` if this dependency is not installed. Host-present
tray tests additionally require Python GObject bindings and `dbus-run-session`.

## Feature-inventory coverage audit

The following are the workflows or workflow variants without a complete native
end-to-end proof in the three pre-existing suites. A rendered control, seeded IPC
record or backend unit test alone is not described as a complete UI-to-OS journey.
The audit includes failure variants where the basic feature has native coverage.

| Inventory area                 | Missing or partial end-to-end workflows before this work                                                                                                                                                                                     | Launch-gate treatment                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access/security                | Recovery-key clipboard content, text-file save and physical print; actual minute-based inactivity lock and activity resets; replacement recovery key then rejection of the old key; disconnected-network enforcement in these three commands | Existing native setup/unlock/manual lock/password/recovery and restart checks retained; other variants remain device or focused-test gaps             |
| Shared navigation/presentation | Table pagination beyond 25 real native rows and header sorting; suggested-number collision/concurrent save; suggested descriptive-value reuse; unsaved-route draft protection; rapid duplicate submission; system-theme OS changes           | Component coverage exists; no complete native journey claimed                                                                                         |
| Dashboard/search               | Every dashboard record link and selected hearing; Arabic/digit normalization and literal wildcard searches against the real native index; identical-label disambiguation; dependent refresh after every mutation                             | Existing keyboard search/deep-link and office integrity coverage retained; unexercised variants remain gaps                                           |
| Clients                        | Probable-duplicate warning confirm/cancel against real native records; phone clipboard contents; every list-filter combination                                                                                                               | Main create/edit/archive/restore, tabs, accounts and documents already covered                                                                        |
| POAs                           | Inline client creation within the actual desktop POA form; real search/filter permutations; upload/open/reveal of POA-owned documents; active-POA conflict and archive/relink via UI                                                         | Existing multi-client/lawyer forms and relationship service checks retained                                                                           |
| Cases                          | Status/filter combinations; editing per-client legal capacity/notes independently of membership; all archived-write refusals through visible global entry points                                                                             | Existing case reference/chronology, relationship payment protection, opponents and archive coverage retained                                          |
| Hearings/agenda                | Court/circuit defaults and free-form time variants; selected-day detail links and past-day styling across all modes; decision-chain deletion conflict through UI                                                                             | Existing hearing CRUD, follow-up and calendar period checks retained                                                                                  |
| Tasks                          | All Today/overdue/upcoming/completed view boundaries combined with case/client filters                                                                                                                                                       | Existing create/edit/complete/reopen/delete coverage retained                                                                                         |
| Documents                      | Global owner selection/import across every owner; successful system viewer open/reveal; native import IO failure compensation                                                                                                                | Existing managed bytes, metadata/remove, missing-file refusal and single-owner checks retained                                                        |
| Finances                       | Every payment-method/expense-category selection through UI; all case/client/global finance-filter combinations; every archived finance mutation entry point                                                                                  | Existing exact amounts, summaries, payment/expense CRUD and payer protection retained                                                                 |
| Backups/restore                | Successful file-manager reveal; foreign unlocked-workspace replacement through UI; superseded/locked preparations installed through UI; actual process interruption/restart at journal stages; both Backups and Settings entry points        | Existing fresh/incomplete/password/recovery and repeated same-vault restore retained; fault/replay service tests are not physical UI acceptance       |
| Exports                        | Complete and single-case warning/picker/scope/document/manifest journeys; collision refusal; cancel; file-manager reveal; missing/modified document and IO failure through UI                                                                | New bilingual native export scenarios verify normal output, scope, counts, BOM, bytes/hashes, cancellation and collisions; other variants remain gaps |
| Permanent deletion             | Archived-client and case deletion; whole-vault reset; backup-first picker cancellation; wrong confirmation/password; managed unlink failure/retry; shared-owner/stale-session refusal through UI                                             | New bilingual native deletion scenarios; service integrity/fingerprint/interrupt tests retained                                                       |
| Support bundle                 | About inclusion/exclusion confirmation; picker cancel/save; actual ZIP entries/redaction; existing destination refusal; permission/disk-full UI                                                                                              | New bilingual native UI/ZIP scenarios inject fictional sensitive log canaries; physical picker/permission/disk-full remain gaps                       |
| Tray/lifecycle                 | Default-off close quits; enabled close locks before hide; unavailable host with persisted enabled preference quits; host-loss recovery; tray Show/Lock/Quit menu; single-instance reveal; busy-operation veto; window-state restoration      | New no-host and isolated-host native lifecycle scenarios; real GNOME/KDE/menu/single-instance and long-operation device checks remain gaps            |
| Settings/OS                    | Developer contact system handlers; clipboard; recovery print; permission/disk-full behavior                                                                                                                                                  | Profile/date/week/lock/theme and bilingual direction already covered; OS handlers remain physical checks                                              |
| Backend-only capabilities      | Expense-owned upload has no UI; search-index rebuild has no UI; counters have no UI                                                                                                                                                          | Keep service checks; do not invent a user workflow                                                                                                    |

This is a scope audit, not a claim of 100% control/state coverage. Existing tests
that use IPC to seed or inspect records prove service integration; UI creation
is proved separately by the desktop/office/control suites. New aggregate
client→case→hearing→task→payment→document checks use real command creation,
then native page inspection. They supplement those existing UI creation journeys.

## Execution results

Pending final execution results.

## Bugs and fixes

- **Isolation hardening:** the existing runners isolated the vault but did not
  explicitly isolate Linux XDG storage for the WebView and native preferences.
  Both now place data/config/cache inside the marked temporary root. The guide
  runner also awaits the existing driver-stop helper before deleting its root
  or starting the next session. No production storage path is changed.
- **Missing native input tool:** xdotool was absent; a temporary extracted Fedora
  RPM supplied it. The real-picker scenario passed with its original assertions.
- **Initial office run invalidated:** rebuilding the test binary while the first
  bilingual run was active changed its checksum between locales. The suite
  correctly refused English startup. The initial report/log remain in
  `office-initial/` and `office-initial.log`; the fresh complete fixed-binary
  rerun passed all 72 scenarios. No assertion was removed or loosened.
- **New test implementation checks:** initial lint rejected unused browser-global
  declarations; those were removed. Artifact-verifier regressions cover embedded
  CSV newlines/quotes, corrupt bytes/counts/BOM/paths, unexpected support entries
  and sensitive content. New Rust fixture tests reject cancellation, arbitrary
  choices and symlink escapes.

Further native and packaging results are recorded below after execution.

## Remaining release risks

Windows physical checks, Windows↔Linux portable restore, actual installers,
physical printing/viewer/clipboard/desktop-handler behavior, real GNOME/KDE tray
presentation and approved visual comparison remain separate gates. A successful
package build does not establish install/update/uninstall behavior. Permission
injection is not a physical disk-full or power-loss exercise.
