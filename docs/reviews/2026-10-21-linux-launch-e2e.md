# Linux public-launch end-to-end verification

Execution: 2026-10-22, Fedora x86-64, Wayland session with Xwayland `DISPLAY=:0`,
`TZ=Africa/Cairo`. Task identifier/report date: 2026-10-21. Windows physical
checks belong to the owner; macOS is outside this launch.

Linux launch-ready: NO

The requested **automated Fedora gate passes**: every native scenario, all three
release packages, the AppImage checks and all standard validation are green.
No failing automated scenario or known unfixed app bug remains from this run.
The conservative public-launch verdict remains NO because the feature inventory
explicitly requires real GNOME/AppIndicator and KDE tray acceptance. An isolated
watcher and exported-menu activation cannot certify shell icon/menu presentation,
pointer interactions or desktop host-loss recovery. Those checks remain open;
this machine has no active desktop tray host. Package installation/update/removal
and the owner's physical Windows checks are also outside this evidence. The
fixture is not substituted for those documented device checks.

## Implemented files

- `scripts/launch-native-e2e.mjs`: bilingual launch journeys through real native
  IPC/UI, with runner-side export/ZIP inspection and actual permission-based
  unlink failure/retry.
- `scripts/launch-tray-e2e.mjs`, `scripts/launch-tray-host.py`,
  `scripts/launch-tray-session.mjs`, `scripts/launch-session-bus.conf`: owned-window
  close, process exit, lock/hide/native Show-menu activation, persisted preference
  and isolated host/no-host fixtures. The private buses have no service directories
  and cannot auto-activate desktop/keyring services.
- `scripts/launch-artifacts.mjs` and adjacent tests: independent CSV record,
  byte/hash/count and ZIP privacy checks, including refusal variants.
- `scripts/desktop-e2e.mjs`, `scripts/guide-desktop.mjs`: XDG isolation and orderly
  driver shutdown; existing scenario assertions remain intact.
- `src-tauri/src/desktop_e2e.rs`, export/support services: fixed picker choices
  compiled only with `desktop-e2e`, with normal/refusal/isolation tests.
- `src/features/deletion/components/PermanentDeleteAction.tsx` and adjacent tests:
  reuse the translated Cancel label and verify cancellation in both languages.
- `scripts/normalize-appimage-runtime.mjs` and adjacent tests: publish from a
  sibling temporary directory and preserve the original on repack failure.
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
No system-wide package installation, agent branch operation or commit, container
visual command or canonical screenshot comparison is part of this run. During
the usage-limit interruption the supervisor committed the earlier WIP and merged
main plus the owner-requested deletion simplification. Resumed validation uses
that integrated code, rebuilt before all native suites. Resumed changes remain
uncommitted. After the memory interruption, every final Cargo/build command uses
`CARGO_BUILD_JOBS=2`. Builds and suites run serially. Each suite is followed by
an owned-process cleanup check before the next starts; Rust test execution is
also limited to two threads.

`xdotool` was absent. An RPM was downloaded into a runner-created temporary
folder and extracted there; no root privileges or system installation were used.
The current GNOME session has no registered StatusNotifier host. Final no-host
and host-present close tests both use isolated `dbus-run-session` buses: the
first has no watcher, the second has a minimal StatusNotifierWatcher fixture.
Native appindicator
registration, real X11 window-close requests, lock/hide and activation of the
exported native Show menu over D-Bus are exercised. Each private bus has isolated
XDG roots and no auto-activation service directories, following the
[D-Bus configuration contract](https://dbus.freedesktop.org/doc/dbus-daemon.1.html).
This fixture does not establish actual GNOME/KDE menu presentation or pointer actions.

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
export CARGO_BUILD_JOBS=2 TZ=Africa/Cairo
pnpm build:desktop:e2e
TZ=Africa/Cairo DISPLAY=:0 GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  LEGALMASTER_E2E_OUTPUT_DIRECTORY=test-results/launch-e2e/final/desktop pnpm test:desktop
TZ=Africa/Cairo DISPLAY=:0 NATIVE_AUDIT_OUTPUT=test-results/launch-e2e/final/office pnpm test:office
TZ=Africa/Cairo DISPLAY=:0 NATIVE_CONTROLS_OUTPUT=test-results/launch-e2e/final/controls pnpm test:desktop:controls
TZ=Africa/Cairo DISPLAY=:0 LAUNCH_E2E_OUTPUT=test-results/launch-e2e/final/launch \
  LAUNCH_TRAY_OUTPUT=test-results/launch-e2e/final pnpm test:launch:linux
CARGO_BUILD_JOBS=2 TZ=Africa/Cairo pnpm build:linux
node scripts/verify-appimage-runtime.mjs src-tauri/target/release/bundle/appimage
D=$(mktemp -d)
CARGO_BUILD_JOBS=2 RUST_TEST_THREADS=2 XDG_DATA_HOME="$D" cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features
rm -rf "$D"
```

The temporary xdotool directory must be on `PATH` and its extracted library
folder on `LD_LIBRARY_PATH` if this dependency is not installed. Host-present
tray tests additionally require Python GObject bindings, `gdbus` and `dbus-run-session`.

## Feature-inventory coverage audit

The following are the workflows or workflow variants without a complete native
end-to-end proof in the three pre-existing suites. A rendered control, seeded IPC
record or backend unit test alone is not described as a complete UI-to-OS journey.
The audit includes failure variants where the basic feature has native coverage.

| Inventory area                 | Missing or partial end-to-end workflows before this work                                                                                                                                                                                     | Launch-gate treatment                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access/security                | Recovery-key clipboard content, text-file save and physical print; actual minute-based inactivity lock and activity resets; replacement recovery key then rejection of the old key; disconnected-network enforcement in these three commands | Existing native setup/unlock/manual lock/password/recovery and restart checks retained; other variants remain device or focused-test gaps                                   |
| Shared navigation/presentation | Table pagination beyond 25 real native rows and header sorting; suggested-number collision/concurrent save; suggested descriptive-value reuse; unsaved-route draft protection; rapid duplicate submission; system-theme OS changes           | Component coverage exists; no complete native journey claimed                                                                                                               |
| Dashboard/search               | Every dashboard record link and selected hearing; Arabic/digit normalization and literal wildcard searches against the real native index; identical-label disambiguation; dependent refresh after every mutation                             | Existing keyboard search/deep-link and office integrity coverage retained; unexercised variants remain gaps                                                                 |
| Clients                        | Probable-duplicate warning confirm/cancel against real native records; phone clipboard contents; every list-filter combination                                                                                                               | Main create/edit/archive/restore, tabs, accounts and documents already covered                                                                                              |
| POAs                           | Inline client creation within the actual desktop POA form; real search/filter permutations; upload/open/reveal of POA-owned documents; active-POA conflict and archive/relink via UI                                                         | Existing multi-client/lawyer forms and relationship service checks retained                                                                                                 |
| Cases                          | Status/filter combinations; editing per-client legal capacity/notes independently of membership; all archived-write refusals through visible global entry points                                                                             | Existing case reference/chronology, relationship payment protection, opponents and archive coverage retained                                                                |
| Hearings/agenda                | Court/circuit defaults and free-form time variants; selected-day detail links and past-day styling across all modes; decision-chain deletion conflict through UI                                                                             | Existing hearing CRUD, follow-up and calendar period checks retained                                                                                                        |
| Tasks                          | All Today/overdue/upcoming/completed view boundaries combined with case/client filters                                                                                                                                                       | Existing create/edit/complete/reopen/delete coverage retained                                                                                                               |
| Documents                      | Global owner selection/import across every owner; successful system viewer open/reveal; native import IO failure compensation                                                                                                                | Existing managed bytes, metadata/remove, missing-file refusal and single-owner checks retained                                                                              |
| Finances                       | Every payment-method/expense-category selection through UI; all case/client/global finance-filter combinations; every archived finance mutation entry point                                                                                  | Existing exact amounts, summaries, payment/expense CRUD and payer protection retained                                                                                       |
| Backups/restore                | Successful file-manager reveal; foreign unlocked-workspace replacement through UI; superseded/locked preparations installed through UI; actual process interruption/restart at journal stages; both Backups and Settings entry points        | Existing fresh/incomplete/password/recovery and repeated same-vault restore retained; fault/replay service tests are not physical UI acceptance                             |
| Exports                        | Complete and single-case warning/picker/scope/document/manifest journeys; collision refusal; cancel; file-manager reveal; missing/modified document and IO failure through UI                                                                | New bilingual native export scenarios verify normal output, scope, counts, BOM, bytes/hashes, cancellation and collisions; other variants remain gaps                       |
| Permanent deletion             | Archived-client and case deletion; whole-vault reset; backup-first picker cancellation; single-click Delete/Cancel; managed unlink failure/retry; shared-owner/stale-session refusal through UI                                              | New bilingual native deletion scenarios; service integrity/fingerprint/interrupt tests retained                                                                             |
| Support bundle                 | About inclusion/exclusion confirmation; picker cancel/save; actual ZIP entries/redaction; existing destination refusal; permission/disk-full UI                                                                                              | New bilingual native UI/ZIP scenarios inject fictional sensitive log canaries; physical picker/permission/disk-full remain gaps                                             |
| Tray/lifecycle                 | Default-off close quits; enabled close locks before hide; unavailable host with persisted enabled preference quits; host-loss recovery; tray Show/Lock/Quit menu; single-instance reveal; busy-operation veto; window-state restoration      | New no-host and isolated-host native lifecycle scenarios; real GNOME/KDE presentation/pointer, Lock/Quit menu, single-instance and long-operation device checks remain gaps |
| Settings/OS                    | Developer contact system handlers; clipboard; recovery print; permission/disk-full behavior                                                                                                                                                  | Profile/date/week/lock/theme and bilingual direction already covered; OS handlers remain physical checks                                                                    |
| Backend-only capabilities      | Expense-owned upload has no UI; search-index rebuild has no UI; counters have no UI                                                                                                                                                          | Keep service checks; do not invent a user workflow                                                                                                                          |

This is a scope audit, not a claim of 100% control/state coverage. Existing tests
that use IPC to seed or inspect records prove service integration; UI creation
is proved separately by the desktop/office/control suites. New aggregate
client→case→hearing→task→payment→document checks use real command creation,
then native page inspection. They supplement those existing UI creation journeys.

## Execution results

The final serial rerun passed **121 native scenario executions**, with zero
failures and zero owned processes remaining after each suite. This count includes
Arabic/English repeats and the default-off check on both private tray buses; it
is not a claim of 121 distinct features. All reports below are under
`test-results/launch-e2e/final/`.

Source: `a4b7d340a119a79ba370d542708bb22e657e96d5` plus this working tree.
Native harness SHA-256:
`04b1938e1514a768f1c38c374fa718caf5b2de7179b98cf61b59500c441ec6cd`. The rebuild and every report with a checksum match.

| Command / configuration            | Passed | Failed | Processes remaining | Evidence                       |
| ---------------------------------- | -----: | -----: | ------------------: | ------------------------------ |
| pnpm test:desktop                  |     11 |      0 |                   0 | `desktop/results.json`         |
| pnpm test:office                   |     72 |      0 |                   0 | `office/capture-manifest.json` |
| pnpm test:desktop:controls         |     18 |      0 |                   0 | `controls/results.json`        |
| Launch scenarios, Arabic + English |     16 |      0 |                   0 | `launch/results.json`          |
| Tray, no host                      |      2 |      0 |                   0 | `tray-no-host/results.json`    |
| Tray, registered host fixture      |      2 |      0 |                   0 | `tray-host/results.json`       |

`native-commands.json` records suite exits and process-group cleanup;
`tray-session-commands.json` records both private-bus exits.

### Core desktop

| Scenario                                                                   | Result |
| -------------------------------------------------------------------------- | ------ |
| `initialize-client-case-attachment-backup-restore`                         | passed |
| `wrong-password-refusal`                                                   | passed |
| `cancel-restore-preserves-active-data`                                     | passed |
| `corrupt-restore-preserves-active-data`                                    | passed |
| `native-picker-responsive-cancellation-and-lock`                           | passed |
| `fresh-installation-restores-a-portable-backup-with-the-original-password` | passed |
| `recovery-key-restore-stages-a-new-password`                               | passed |
| `incomplete-installation-restores-a-portable-backup`                       | passed |
| `opponent-form-announces-missing-name`                                     | passed |
| `settings-display-tab-deep-link-shows-saved-labels`                        | passed |
| `restart-persistence`                                                      | passed |

### Office workflows

| Scenario                                           | Arabic | English |
| -------------------------------------------------- | ------ | ------- |
| `initialize-through-ui-and-save-recovery-key`      | passed | passed  |
| `wrong-password-preserves-locked-gate`             | passed | passed  |
| `recovery-gate-hides-stale-unlock-error`           | passed | passed  |
| `client-create-through-ui`                         | passed | passed  |
| `case-create-through-ui`                           | passed | passed  |
| `seed-exactly-ten-clients-seven-complete-cases`    | passed | passed  |
| `whole-office-relations-ledgers-and-hearing-chain` | passed | passed  |
| `global-search-keyboard-deep-link`                 | passed | passed  |
| `client-edit-save-persists-through-ui`             | passed | passed  |
| `task-complete-reopen-through-ui`                  | passed | passed  |
| `long-case-label-fits-hearing-dialog`              | passed | passed  |
| `hearing-decision-follow-up-through-ui`            | passed | passed  |
| `financial-exact-minor-unit-summary`               | passed | passed  |
| `poa-linked-cases-unique-for-shared-clients`       | passed | passed  |
| `power-of-attorney-create-edit-through-ui`         | passed | passed  |
| `case-edit-and-opponent-create-through-ui`         | passed | passed  |
| `calendar-popup-clickable-inside-dialog`           | passed | passed  |
| `payment-save-and-payer-options-through-ui`        | passed | passed  |
| `expense-without-links-save-through-ui`            | passed | passed  |
| `task-create-edit-through-ui-delete-via-ipc`       | passed | passed  |
| `attachment-add-through-ui`                        | passed | passed  |
| `invalid-money-and-payer-refused`                  | passed | passed  |
| `duplicate-identifiers-and-invalid-case-refused`   | passed | passed  |
| `invalid-mutations-preserve-entire-office`         | passed | passed  |
| `attachment-single-owner-and-cancel-refused`       | passed | passed  |
| `attachment-metadata-edit-remove-preserves-source` | passed | passed  |
| `all-detail-tabs-and-settings-sections`            | passed | passed  |
| `archive-confirm-cancel-and-restore-all-records`   | passed | passed  |
| `case-fee-validation-and-save-through-ui`          | passed | passed  |
| `settings-profile-save-through-ui`                 | passed | passed  |
| `settings-general-save-through-ui`                 | passed | passed  |
| `backup-create-validate-cancel-corrupt-through-ui` | passed | passed  |
| `repeated-same-vault-restore-three-times`          | passed | passed  |
| `password-change-and-recovery-real-vault`          | passed | passed  |
| `restart-locked-and-data-persisted`                | passed | passed  |
| `narrow-viewport-rtl-ltr-and-navigation`           | passed | passed  |

### Additional controls

| Scenario                                                          | Result |
| ----------------------------------------------------------------- | ------ |
| `all-sidebar-navigation-links`                                    | passed |
| `client-search-archive-filter-clear`                              | passed |
| `case-archive-and-restore-buttons`                                | passed |
| `opponent-empty-form-visible-feedback`                            | passed |
| `opponent-create-edit-cancel-remove`                              | passed |
| `task-delete-cancel-confirm-through-ui`                           | passed |
| `hearing-create-edit-date-and-delete-through-ui`                  | passed |
| `client-and-poa-archive-confirmations`                            | passed |
| `case-relationships-save-and-paid-client-removal-refused`         | passed |
| `attachment-ui-edit-missing-open-cancel-confirm-remove`           | passed |
| `finance-inspect-edit-delete-cancel-confirm-and-exact-totals`     | passed |
| `hearing-and-task-every-text-field-persists`                      | passed |
| `settings-persisted-select-values-visible`                        | passed |
| `settings-theme-save-and-revert-through-ui`                       | passed |
| `settings-profile-every-field-and-date-week-lock-preferences`     | passed |
| `calendar-month-week-list-period-buttons`                         | passed |
| `case-reference-and-chronology-commands-preserve-data-on-refusal` | passed |
| `case-account-failed-read-retry-restores-real-data`               | passed |

### Launch workflows

| Scenario                                                        | Arabic | English |
| --------------------------------------------------------------- | ------ | ------- |
| `vault-setup-lock-unlock-and-locked-command-refusal`            | passed | passed  |
| `client-case-hearing-task-payment-document-chain`               | passed | passed  |
| `full-and-case-export-cancel-scope-hashes-and-collision`        | passed | passed  |
| `support-bundle-dialog-cancel-redaction-existing-file-refusal`  | passed | passed  |
| `deletion-preview-session-refusal-preserves-archived-case`      | passed | passed  |
| `permanent-case-client-single-confirm-cancel-and-managed-files` | passed | passed  |
| `whole-vault-single-confirm-cancel-backup-and-restore`          | passed | passed  |
| `whole-vault-single-confirm-default-without-backup`             | passed | passed  |

### Tray without a host

| Scenario                                 | Result |
| ---------------------------------------- | ------ |
| `default-off-native-close-quits`         | passed |
| `persisted-toggle-on-without-host-quits` | passed |

### Tray with a registered host fixture

| Scenario                         | Result |
| -------------------------------- | ------ |
| `default-off-native-close-quits` | passed |
| `toggle-on-locks-before-hiding`  | passed |

### Packages and standard validation

All final commands below exited 0. Build/test processes ran serially with
`CARGO_BUILD_JOBS=2`; Cargo tests also used `RUST_TEST_THREADS=2` and a fresh
`TemporaryDirectory` as `XDG_DATA_HOME`, removed after completion (equivalent to
the guarded shell command above). No bare Cargo test was run.

| Validation                                                                                      | Result                                                                | Evidence under `final/`                      |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| `pnpm build:desktop:e2e`                                                                        | PASS; rebuilt after both merges                                       | `build-desktop.log`                          |
| `pnpm test:desktop`                                                                             | PASS — 11/11                                                          | `desktop/results.json`                       |
| `pnpm test:office`                                                                              | PASS — 72/72                                                          | `office/capture-manifest.json`               |
| `pnpm test:desktop:controls`                                                                    | PASS — 18/18                                                          | `controls/results.json`                      |
| `pnpm test:launch:linux`                                                                        | PASS — 16 bilingual + 4 tray executions                               | `launch/results.json`, `tray-*/results.json` |
| `pnpm build:linux`                                                                              | PASS — deb, rpm, normalized AppImage                                  | `build-linux.log`, `release-artifacts.json`  |
| `node scripts/verify-appimage-runtime.mjs src-tauri/target/release/bundle/appimage`             | PASS, both in build command and explicitly afterward                  | `appimage-runtime.log`                       |
| `node scripts/verify-release-boundary.mjs src-tauri/target/release/legalmaster-solo`            | PASS — no harness markers                                             | `release-boundary.log`                       |
| Packaged AppImage native launch/close                                                           | PASS — visible owned window, default Close exits, zero processes left | `release-smoke.json`                         |
| `pnpm test`                                                                                     | PASS — 668 Vitest tests (62 files), 97 script tests; no skips         | `pnpm-test.log`                              |
| `pnpm lint`                                                                                     | PASS                                                                  | `lint.log`                                   |
| `pnpm typecheck`                                                                                | PASS                                                                  | `typecheck.log`                              |
| `pnpm format:check`                                                                             | PASS                                                                  | `format-check.log`                           |
| Isolated `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features`              | PASS — 234 (179 unit + 55 integration); no ignored/filtered tests     | `cargo-test.log`                             |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`                                     | PASS                                                                  | `cargo-fmt.log`                              |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS                                                                  | `clippy.log`                                 |
| `git diff --check`                                                                              | PASS                                                                  | `diff-check.log`                             |

The final documentation edit is followed by another format/whitespace check;
its outcomes are retained in `documentation-checks.json`. Earlier failed or
interrupted attempts are not counted as passes in this table. The non-fatal
Vite chunk-size warning and fixture Gio deprecation notice remain in the logs.

The additional packaged-AppImage scenario launches the actual normalized release
artifact via extract-and-run on X11, with a private non-activating bus and newly
created XDG data/config/cache/runtime directories. It finds only an owned visible
native window and sends a native Close request, then requires clean process exit.
It does not inspect renderer content, use WebDriver, initialize a real vault,
install the package, exercise FUSE mounting or certify native Wayland rendering.
The disposable directories are removed after exit.

Produced release files (paths relative to `src-tauri/target/release/bundle/`):

| Package                                    |     Bytes | SHA-256                                                            |
| ------------------------------------------ | --------: | ------------------------------------------------------------------ |
| `deb/Legal Masr_0.1.0_amd64.deb`           |  10868134 | `cd3cfb674e6fd0343243b9a8b4bd324b7187985babf0e0f1258c724dfa84613d` |
| `rpm/Legal Masr-0.1.0-1.x86_64.rpm`        |  10868848 | `d4bb8a6915b292a7e6c037ce65ded5daee7449c17406724b5cdc4b516ba211dd` |
| `appimage/Legal Masr_0.1.0_amd64.AppImage` | 120383992 | `9e78636a838b9d3c731149f8d077148df1877a607e671d3ad08c78898fa9bba3` |

Environment details are retained in `environment.json`: Fedora 44 kernel
`7.2.10-200.fc44.x86_64`, Node `v22.21.1`, pnpm `10.33.0`, Cargo/Rust `1.93.0`.
These are Fedora-built verification artifacts, not evidence that an Ubuntu-built
release was installed or that other distribution versions are compatible.

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

- **Untranslated deletion Cancel:** the native journey exposed `forms.cancel`,
  a key absent from both catalogs. The component now uses existing `common.cancel`.
  A new test asserts the literal Arabic/English labels and cancellation without
  destructive IPC, so a missing translation cannot pass by comparing the same
  missing key on both sides.
- **Fedora AppImage strip failure:** linuxdeploy's bundled strip rejected modern
  `.relr.dyn` sections. Linux build commands set its supported `NO_STRIP=1`;
  optimized Rust compilation, all three bundles, normalization and runtime checks
  remain enabled. Symbols retained in copied libraries can increase size. See
  [upstream](https://github.com/linuxdeploy/linuxdeploy/issues/272) and its
  [implementation](https://github.com/linuxdeploy/linuxdeploy/blob/master/src/core/appdir.cpp).
- **Cross-filesystem AppImage normalization:** repacking under `/tmp` and renaming
  to `/home` failed with `EXDEV`. Staging now lives beside the destination, which
  permits atomic publication. Script tests cover successful replacement and a
  failed repack preserving the original and cleaning staging.
- **Native harness readiness:** awaited iteration handles WebDriver element
  collections; localized button lookup waits for the requested visible control
  during a cached-data refresh, then performs one native action with no replay.
- **Tray harness lifecycle:** native Quit invalidates the WebKit session, so a
  fresh driver launches the same disposable vault. Locked startup correctly uses
  Arabic before encrypted preferences load; BaseUI disabled switches are checked
  through `aria-disabled`. Direct X11 mapping bypassed GTK visibility and failed
  the reveal interaction. The fixture now activates the exported native Show
  menu, then requires the password gate and a successful unlock. No production
  tray behavior or assertion was weakened.
- **Owner-requested deletion simplification:** the final scenarios assert one
  Delete/Cancel dialog, no text/password inputs, no partial-deletion backup
  checkbox, and a default-off reset backup option. They retain cancellation,
  locked/stale-token refusal and file-cleanup failure/retry checks. Reset is
  exercised with backup/restore and without backup. The removed word/password
  journeys in earlier failed logs are historical, not current acceptance tests.

Final reruns supersede all pre-interruption results; those earlier logs are
retained separately.

## Remaining release risks

The required GNOME/AppIndicator and KDE shell acceptance in the feature inventory
remains the reason for the NO verdict. Passing the fixture does not close that
release gate. Windows physical checks, Windows↔Linux portable restore, actual installers,
physical printing/viewer/clipboard/desktop-handler behavior, real GNOME/KDE tray
presentation and approved visual comparison remain separate gates. A successful
package build does not establish install/update/uninstall behavior. Permission
injection is not a physical disk-full or power-loss exercise.
