# Installing LegalMaster Solo on macOS

Choose the DMG matching the Mac processor:

- `macos_x64.dmg` for Intel Macs.
- `macos_arm64.dmg` for Apple Silicon Macs.

Open the DMG and drag **LegalMaster Solo.app** to Applications. The builds are ad-hoc signed with identity `-`, but they are not notarized. macOS Gatekeeper may initially block the application; this is expected.

To approve it, try opening the app once, then go to **System Settings → Privacy & Security** and choose the available option to open LegalMaster Solo. Confirm the prompt and launch it again.

Ad-hoc signing does not make the application Apple-verified and does not remove Gatekeeper warnings. Before using a beta update, back up existing data. Test that the encrypted database opens and that documents and backups work after installation.
