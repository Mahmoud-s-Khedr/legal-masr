# Release process

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 14. Update and release system

Tauri's updater can later use a signed static JSON manifest and GitHub Releases or another static host. Update manifests include platform-specific URLs and signatures. The updater plugin is not currently included or configured, so this application does not generate updater artifacts, signatures, keys, or a `latest.json` manifest.

## Update flow

1. Check update manifest.
2. Compare semantic version.
3. Display release notes.
4. Ask user to create or verify a recent backup.
5. Download signed update.
6. Verify update signature.
7. Install.
8. Restart.
9. Run migration process if needed.
10. Display successful-update notice.

## Update privacy

The update request must not include:

- Installation UUID
- Lawyer profile
- Case count
- Document count
- Usage history
- Device hostname
- User account name

A normal static manifest request may reveal standard network metadata such as IP address to the hosting provider. This should be disclosed in the privacy notice.

---

# 15. Windows and macOS packaging

## Windows

Initial target:

- Windows 10 and Windows 11
- x86-64
- Per-user NSIS `.exe` installer
- No administrator privileges where possible
- Unsigned public beta installer; no self-signed certificate

Tauri builds Windows installers through its CLI on Windows, using the MSVC target and WebView2.

## macOS

Initial targets:

- Apple Silicon
- Intel
- Separate DMG files initially

Separate builds reduce the risk introduced by combining SQLCipher, vendored cryptography and universal binaries. A universal build may be added after both architectures are stable.

Current browser-distributed beta builds use Tauri ad-hoc signing (`signingIdentity: "-"`) and are not notarized. Users may need to approve the app through Privacy & Security. Future public Developer ID distribution can add paid signing and notarization independently.

## CI/CD

Use GitHub Actions with:

- Windows runner
- Intel macOS target build
- Apple Silicon macOS target build
- Validation workflow on pull requests
- Tag/manual draft-release workflow
- Unsigned Windows x86-64 NSIS installer
- Ad-hoc signed, unnotarized Intel and Apple Silicon DMGs

The official `tauri-action` builds native Tauri binaries for Windows and macOS and can attach them to GitHub Releases.

## Release artifacts

```text
LegalMaster-Solo_<version>_windows_x64-setup.exe
LegalMaster-Solo_<version>_macos_x64.dmg
LegalMaster-Solo_<version>_macos_arm64.dmg
SHA256SUMS.txt
```
