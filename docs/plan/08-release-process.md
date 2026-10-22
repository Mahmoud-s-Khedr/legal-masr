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

## Linux package verification — 2026-10-22

The integrated-build verification targets Debian, RPM and AppImage via
`pnpm build:linux`, followed by `scripts/verify-appimage-runtime.mjs`. The final
Fedora rerun produced all three packages, passed runtime-policy inspection and
an isolated AppImage X11 launch/close smoke check. Outputs, checksums and
success/failure are recorded in
[the Linux launch report](../reviews/2026-10-21-linux-launch-e2e.md). Packages
are not installed system-wide by this task. Generation and runtime-policy
inspection do not prove installer/update/uninstall or physical Windows checks.

The Linux build commands set `NO_STRIP=1` for linuxdeploy: its bundled strip
cannot parse the `.relr.dyn` sections in this Fedora host's libraries. This
preserves optimized application compilation and retains all bundle,
normalization and runtime verification steps; copied ELF symbols may make the
AppImage larger. See the upstream
[linuxdeploy report](https://github.com/linuxdeploy/linuxdeploy/issues/272) and
[NO_STRIP implementation](https://github.com/linuxdeploy/linuxdeploy/blob/master/src/core/appdir.cpp).

AppImage normalization stages beside the destination image, then renames the
completed result atomically. This supports hosts where `/tmp` is on a different
filesystem. A failed repack retains the original image and removes staging;
normal and failure-path script tests cover publication and cleanup.
