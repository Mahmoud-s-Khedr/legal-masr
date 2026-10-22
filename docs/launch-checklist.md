# Windows and Linux public beta launch checklist

Scope: Windows 10/11 x64 and Linux x64 packages (deb, rpm, AppImage). macOS is deferred. “Implemented” records repository work; it does not mean physical platform acceptance or owner approval.

## Repository and CI work completed

| Item                                           | Status and evidence                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Permanent deletion                             | Implemented with one final confirmation; see [deletion review](reviews/2026-10-21-permanent-deletion.md).                                                                                  |
| Unencrypted case and full-installation exports | Implemented with warnings and documented format; see [export review](reviews/2026-10-21-exports.md).                                                                                       |
| Redacted support bundle                        | Implemented as a user-saved local bundle; see [support-bundle review](reviews/2026-10-21-support-bundle.md).                                                                               |
| Optional system tray                           | Implemented with default-off preference and lock-on-hide; see [tray review](reviews/2026-10-21-tray.md).                                                                                   |
| Data-flow fixes                                | Implemented and reviewed; see [data-flow review](reviews/2026-10-21-review-of-data-flow-fixes.md).                                                                                         |
| ZIP security upgrade                           | ZIP upgraded to 9.0.5 with restore compatibility and hostile-entry coverage; see [ZIP review](reviews/2026-10-21-zip-advisories.md).                                                       |
| Windows desktop CI harness fixes               | Harness readiness, fixed checkpoints, and redacted failure categories implemented; Windows WebView2 success remains unverified. See [CI review](reviews/2026-10-21-windows-desktop-ci.md). |
| Release candidate files                        | Version `0.2.0`, bilingual changelog and draft-release notes prepared; no tag or release created.                                                                                          |
| Release workflow                               | Workflow builds Windows/Linux artifacts and creates or updates a draft prerelease only. See [release workflow](../.github/workflows/release.yml).                                          |

## Owner-only gates, in required order

1. ~~**Approve visual baselines**~~ — **done 2026-10-22**: the owner reviewed the 68 captures in `tests/visual/review.html` and approved them; `node scripts/verify-visual-manifest.mjs tests/visual/baseline --approved` passes. Any later baseline update resets the manifest to `candidate` and needs a new approval.
2. **Physical Windows 10/11 checks:** installation, update/removal, unlock, documents, backup, restore and recovery. The parallel Linux e2e report also confirms these physical Windows checks remain open.
3. **Physical Linux desktop checks:** Debian/RPM/AppImage installation, update and removal; verify tray behavior and core journeys on GNOME with and without AppIndicator, and KDE. Automated checks pass, but these physical checks remain open per the [Linux launch e2e report](reviews/2026-10-21-linux-launch-e2e.md).
4. **Make the Authenticode signing decision** and obtain/configure a real certificate if signing is chosen. Current Windows artifacts are unsigned and may trigger SmartScreen or publisher warnings; see [signing policy](SIGNING_POLICY.md).
5. **Complete Egyptian privacy/legal review**, then publish the privacy notice and terms.
6. **Tag `v0.2.0`** to run the release workflow and produce a draft prerelease. Review artifact names, notes and checksums before any publication decision.

## Linux end-to-end verdict

Verdict: **Linux launch-ready: NO**. The parallel run reports that every automated check passes, but real GNOME tray checks (with and without AppIndicator), KDE tray checks, package install/update/removal checks, and physical Windows checks remain. See the [Linux launch e2e report](reviews/2026-10-21-linux-launch-e2e.md) (expected after merge).

## Other launch work still open

- Install, backup, recovery and export user guides; define a support process.
- Confirm independent checksum review on the actual draft artifacts.
- Physical platform validation remains a release blocker (visual baselines approved 2026-10-22).

No release tag, GitHub release, or publication has been created by this preparation.
