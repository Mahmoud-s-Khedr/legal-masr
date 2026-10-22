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

# 15. Windows and Linux packaging (macOS deferred)

## Windows

Initial target:

- Windows 10 and Windows 11
- x86-64
- Per-user NSIS `.exe` installer
- No administrator privileges where possible
- Unsigned until the owner obtains an Authenticode certificate; no self-signed certificate

Tauri builds Windows installers through its CLI on Windows, using the MSVC target and WebView2.

## Linux

Initial target:

- x86-64
- Unsigned Debian `.deb`, Fedora-compatible `.rpm`, and AppImage packages
- Native Ubuntu GitHub Actions build

The portable Windows archive and Linux AppImage distribute an application
binary, not a portable application-data directory. User data remains in the
normal operating-system location.

## macOS deferred

macOS is outside the first public release. Existing source support remains; packaging and release jobs are deferred.

## CI/CD

Use GitHub Actions with:

- Windows runner
- Validation workflow on pull requests
- Debug validation artifacts for Windows installer/portable archive and Linux Debian/RPM/AppImage packages
- Tag/manual draft-release workflow
- Unsigned Windows x86-64 NSIS installer
- Windows x86-64 portable archive
- Linux x86-64 Debian, RPM, and AppImage packages

The official `tauri-action` builds native Tauri binaries for Windows and Linux and can attach them to GitHub Releases.

## Release artifacts

```text
LegalMaster-Solo_<version>_windows_x64-setup.exe
LegalMaster-Solo_<version>_windows_x64-portable.zip
LegalMaster-Solo_<version>_linux_x64.deb
LegalMaster-Solo_<version>_linux_x64.rpm
LegalMaster-Solo_<version>_linux_x64.AppImage
SHA256SUMS.txt
```

## Public beta candidate — 0.2.0

The first Windows/Linux public-beta candidate is `0.2.0`. The version must
match in the frontend package, Tauri configuration and Rust package, and its
tag must be exactly `v0.2.0`. The draft body is maintained bilingually in
[the versioned release notes](../release-notes/v0.2.0.md); the workflow copies
that file into the draft. The workflow creates or updates a GitHub draft
prerelease only and does not publish it. Owner gates are tracked in the
[launch checklist](../launch-checklist.md).
