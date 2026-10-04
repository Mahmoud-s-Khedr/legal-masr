# Device validation evidence

- Date:
- Tester:
- Commit:
- Package/version:
- Package SHA-256:
- Production build (desktop-e2e disabled):
- OS and exact build:
- Architecture:
- Previous package/commit for upgrade:
- Overall result: pending / passed / failed / blocked

| Criterion                           | Result  | Evidence description                                                                     | Defect ID |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------- | --------- |
| Install                             | pending |                                                                                          |           |
| Upgrade                             | pending |                                                                                          |           |
| Restart persistence                 | pending |                                                                                          |           |
| Picker cancellation/selection       | pending |                                                                                          |           |
| Open/reveal including missing file  | pending |                                                                                          |           |
| Backup cancellation/corrupt refusal | pending |                                                                                          |           |
| Notification grant/deny             | pending |                                                                                          |           |
| Autostart enable/disable            | pending |                                                                                          |           |
| Sleep/resume locking                | pending |                                                                                          |           |
| Arabic 1366×768                     | pending |                                                                                          |           |
| Arabic 1440×900                     | pending |                                                                                          |           |
| English 1366×768                    | pending |                                                                                          |           |
| English 1440×900                    | pending |                                                                                          |           |
| Keyboard/dialog focus return        | pending |                                                                                          |           |
| Same-vault restore iteration 1      | pending |                                                                                          |           |
| Same-vault restore iteration 2      | pending |                                                                                          |           |
| Same-vault restore iteration 3      | pending |                                                                                          |           |
| Uninstall/reinstall                 | pending |                                                                                          |           |
| Windows→macOS portable restore      | blocked | Archive requires the original random master key; original password alone is insufficient |           |
| macOS→Windows portable restore      | blocked | Repeat after portable restore redesign; copied security envelope is not a pass           |           |

For each restore iteration record pre/post fictional record expectations,
attachment byte checksum, original-source checksum, locked gate, and restart
result. Keep all archives local. Do not include document paths or secrets here.

Defects: stable code, reproducible steps using fictional data, expected/actual
behavior, severity, affected OS/build and retest result. Attach only redacted
product screenshots outside password/recovery screens.
