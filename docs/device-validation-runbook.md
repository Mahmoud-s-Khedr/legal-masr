# Physical-device validation handoff

Status: **pending execution**. Automated test success does not pass these gates.
Use only fictional legal records and disposable source documents. Test Windows
10, Windows 11, macOS Intel and macOS Apple Silicon independently. Record the
exact commit and package SHA-256, not just the application version.

For each device, copy [the evidence template](device-validation-template.md),
assign a tester, and record OS version/build and architecture. Use a dedicated
OS test account and a fresh normal production vault. Never install a
`desktop-e2e` binary for this exercise. Preserve evidence outside the vault;
never attach vaults, backups, security envelopes, passwords, recovery keys, or
screenshots containing them to CI or defect reports.

| Criterion                | Procedure                                                                                                        | Required evidence                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Installation             | Install the checksummed package; launch and initialize a fictional vault                                         | Result and packaging/permission defects                            |
| Upgrade                  | Create a client, case and managed attachment with the previous approved package; install the new package over it | Records and byte checksum unchanged                                |
| Restart persistence      | Close and relaunch; verify locked gate; unlock and inspect records                                               | Pass/fail; no password capture                                     |
| Native attachment picker | Cancel; then select a disposable file from the client/case/POA owner view                                        | Cancel makes no record; selection copies file and preserves source |
| Open/reveal              | Open and reveal a managed attachment, including a missing-file failure                                           | Actual target application/folder behavior; stable error only       |
| Native backup picker     | Cancel restore and validation; select a valid archive and a corrupt archive                                      | Cancellation preserves live data; corruption refuses replacement   |
| Notifications            | Grant, deny and revisit permission; schedule a fictional reminder                                                | Platform permission and delivery behavior; privacy-safe content    |
| Autostart                | Enable, log out/reboot and verify startup; disable and repeat                                                    | Enabled/disabled behavior and startup locked gate                  |
| Sleep/resume             | Unlock, leave a legal record open, sleep and resume                                                              | Locked gate and removed cached record display                      |
| Visual/keyboard          | Inspect Arabic RTL and English LTR at 1366×768 and 1440×900; navigate by keyboard; open/close dialogs            | Viewport, clipping, focus, date/money/filename direction defects   |
| Same-vault restore ×3    | Follow the restore exercise below three times on the same vault                                                  | Three distinct iteration results                                   |
| Uninstall                | Uninstall and record data-retention behavior, then reinstall                                                     | Installer removal and retained/deleted user-data behavior          |

For each same-vault restore iteration:

1. Create client A, case A, and managed attachment A. Record a SHA-256 of the
   original fictional source and managed bytes using OS tools.
2. Create a manual backup and retain it locally. Add client B, edit case A and
   change attachment metadata after the snapshot.
3. Restore the snapshot through the native picker. Verify the locked gate,
   unlock with the same password, and confirm A's snapshot values, absence of
   B, and the original attachment checksum. Confirm the selected source remains
   unchanged. Restart and check persistence again.
4. Record the iteration, result and defects. A pass requires all checks; do not
   infer the result from a previous iteration.

Cross-device Windows→macOS and macOS→Windows restore is a **separate blocked
criterion**. The current backup key derives from the unlocked vault's random
master key. An independently initialized destination cannot restore with only
the original password. Record expected refusal and preservation of the new
vault as safety evidence, but keep portability **blocked**. Copying a security
envelope is not a portability pass. Repeat both directions and all repeated
restore exercises after a portable restore design is implemented.

Native automated Linux/Windows setup follows the [official Tauri manual
WebDriver setup](https://v2.tauri.app/develop/tests/webdriver/manual-setup/).
macOS remains in this physical-device matrix. CI results and mock tests cannot
replace native permission, installer, sleep/resume or physical display checks.
