# Creating a LegalMaster Solo beta release

## Prepare the release

1. Set the same semantic version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Run the local validation commands in [BUILDING.md](BUILDING.md).
3. Commit the version change and create an annotated tag named exactly `vX.Y.Z` for that version.
4. Push the tag, or run **Draft release** manually and supply that existing tag as `release_tag`.

The workflow rejects version mismatches and non-tag commits. It builds native Windows x86-64, Intel macOS, and Apple Silicon macOS installers, generates final names and `SHA256SUMS.txt`, then creates or updates one GitHub draft prerelease. It never publishes the release automatically.

Release-sensitive third-party Actions are commit-pinned. Update those pins only after reviewing the upstream release and commit; dependency automation should propose future updates.

## Review the draft

Confirm the release contains only:

```text
LegalMaster-Solo_<version>_windows_x64-setup.exe
LegalMaster-Solo_<version>_macos_x64.dmg
LegalMaster-Solo_<version>_macos_arm64.dmg
SHA256SUMS.txt
```

Verify the checksums independently. The Windows installer is unsigned and Windows may show a SmartScreen or publisher warning. macOS artifacts are ad-hoc signed and unnotarized; users may need to approve them in Privacy & Security. The documented Windows targets are Windows 10 and Windows 11. No macOS minimum system version is currently claimed beyond the architecture-specific build targets.

Before publishing a beta, back up data and complete manual tests on each platform: install, launch, encrypted database open/unlock, documents, and backup creation/restore. On macOS, also confirm the expected Gatekeeper flow; on Apple Silicon, confirm the installed binary is native ARM64. Record the expected unsigned Windows Authenticode state.

## Later signing work

Do not add empty secrets or placeholder certificates. The future Windows signing sequence and future Apple Developer ID prerequisites are documented in [SIGNING_POLICY.md](SIGNING_POLICY.md). The Tauri updater is deliberately out of scope until it is intentionally designed and supplied with a long-lived key pair.
