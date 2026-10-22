# Overnight launch-readiness run — summary (2026-10-21 → 2026-10-22)

Goal: get LegalMaster Solo ready for a public launch on **Windows and Linux**
(macOS deferred). Codex (`gpt-6.1-sol`, docs on `gpt-6-luna`) wrote all code.
Claude managed the run: prompts, Codex usage limits, diff review, independent
validation, commits, PRs, CI and merges. Nothing was tagged or published.

## Bottom line

- **All automated checks are green on Linux**, and Windows CI (build + desktop
  suite) is green again.
- **Linux launch-ready: NO** — only because the remaining gates need real
  devices (see [Owner-only gates](#owner-only-gates)). No known failing test or
  unfixed app bug remains. Details:
  [Linux launch e2e report](2026-10-21-linux-launch-e2e.md).
- Version **0.2.0** is prepared (changelog, Arabic/English release notes), but
  not tagged.

## Merged pull requests

| PR           | Change                                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #10          | Codex review of the previously uncommitted data-flow work: dependent data refreshes, failed reads show Retry, case validation aligned; case-summary layout regression fixed |
| #11          | Security: `zip` 2.4.2 → 9.0.5 (RUSTSEC-2026-0367/0368/0369); backups refuse symlink/directory entries; old-format backups still restore                                     |
| #12          | Windows nightly desktop CI fixed (CDP harness synchronization after the picker change of 2026-10-08)                                                                        |
| #13          | Launch scope set to Windows + Linux                                                                                                                                         |
| #14          | Guided permanent deletion (archived client, archived case, whole workspace) with durable file-removal outbox and restart recovery                                           |
| #15          | Unencrypted CSV + document exports (installation and single case) with verified copies and a hashed manifest                                                                |
| #16          | Redacted, manually saved support bundle (allow-list log reconstruction; nothing is sent)                                                                                    |
| #17          | Optional keep-running-in-tray (off by default; locks before hiding; Linux fallback when no tray host)                                                                       |
| #18          | Owner request: deletion is now a single "Are you sure?" dialog (no typed word, no password)                                                                                 |
| #19          | Linux end-to-end launch verification, new launch/tray scenarios, AppImage and harness fixes _(merge pending CI at time of writing)_                                         |
| release prep | Version 0.2.0, CHANGELOG, release notes, launch checklist, release-workflow heredoc fix, this summary _(PR pending)_                                                        |

## Test results (Linux, Fedora x86-64, final run)

| Suite                                                           | Result                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Native `test:desktop` / `test:office` / `test:desktop:controls` | 11 / 72 / 18 passed                                                                    |
| New `test:launch:linux` launch / tray scenarios                 | 16 / 4 passed                                                                          |
| Frontend (Vitest) / script (Node) tests                         | 668 / 97 passed                                                                        |
| Rust tests (isolated `XDG_DATA_HOME`)                           | 234 passed                                                                             |
| `build:linux`                                                   | `.deb`, `.rpm`, AppImage produced; AppImage policy and launch/close checks pass        |
| Lint, typecheck, Prettier, rustfmt, clippy `-D warnings`        | pass                                                                                   |
| Canonical visual comparison                                     | 71 passed (baselines updated only where UI intentionally changed, e.g. export actions) |
| GitHub CI on every merged PR                                    | validate, visual, desktop (Ubuntu), Linux + Windows package builds: all green          |

Bugs found by the end-to-end run and fixed: untranslated Cancel label in the new
deletion dialog, Fedora AppImage strip failure, cross-filesystem AppImage
normalization, incomplete WebView storage isolation in the native runners.

## Codex usage

Weekly usage went from 44 % to 93 %; the weekly limit was **never hit**, so the
redeemable reset was **not used** (it expires 22 Oct, 10:36 PM). The 5-hour limit
was hit twice (≈20:30 and ≈05:30); both times work waited for the reset as agreed.

| Task                                                | Approx. weekly cost |
| --------------------------------------------------- | ------------------- |
| Review of uncommitted work (#10)                    | 3 %                 |
| Windows CI investigation + fixes (#12)              | 3 %                 |
| PR #10 visual regression                            | 2 %                 |
| zip advisories (#11)                                | 3 %                 |
| Permanent deletion (#14)                            | 6 %                 |
| Launch scope (#13)                                  | 2 %                 |
| Exports (#15, two sessions)                         | 8 %                 |
| Support bundle (#16)                                | 4 %                 |
| Tray (#17)                                          | 3 %                 |
| Linux end-to-end verification (#19, three sessions) | 16 %                |
| Deletion simplification (#18)                       | 1 %                 |
| Release prep                                        | 2 %                 |

Interruptions: two runs were stopped by the 5-hour limit (resumed from the saved
Codex session), and three runs were stopped by Claude Code because the machine
ran out of memory (other workloads); they were restarted only after the owner
said so, with reduced build parallelism.

## Owner-only gates

In order:

1. **Approve the visual baselines** (`pnpm verify:visual` → approved manifest);
   the release workflow requires it.
2. **Physical Windows 10/11 checks**, including installer, SmartScreen behaviour,
   pickers, tray and a Windows ↔ Linux backup restore.
3. **Physical Linux desktop checks**: tray on GNOME with and without the
   AppIndicator extension and on KDE; install, update and removal of the
   `.deb`, `.rpm` and AppImage.
4. **Authenticode signing decision** (see `docs/SIGNING_POLICY.md`).
5. **Egyptian privacy/legal review**, and publishing the privacy notice and terms.
6. Then tag `v0.2.0` to produce the **draft** prerelease, review it, and publish
   it yourself.

Deliberate product decision recorded: with the single-confirmation deletion,
anyone who can use the unlocked app can reset the whole workspace with one click.
