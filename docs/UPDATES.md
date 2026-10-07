# Signed application updates

Legal Masr uses Tauri 2's native updater behind application-specific Rust
commands. Automatic checking and downloading are optional; installation always
requires the user's explicit action and a fresh validated encrypted backup.

## Enable release signing once

1. Generate a permanent Tauri updater key pair **on a trusted local machine**:

   ```sh
   pnpm tauri signer generate -w ~/.tauri/legal-masr.key
   ```

2. Keep the private key and its password in a secure backup outside the
   repository. Do not generate a different key for each release.
3. In GitHub repository Settings → Secrets and variables → Actions, configure:

   | Kind                | Name                                 | Value                                             |
   | ------------------- | ------------------------------------ | ------------------------------------------------- |
   | Repository variable | `LEGAL_MASR_UPDATER_PUBLIC_KEY`      | The contents of the generated `.pub` file         |
   | Repository secret   | `TAURI_SIGNING_PRIVATE_KEY`          | The contents of the generated private key file    |
   | Repository secret   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Its password (empty if intentionally unencrypted) |

4. Follow [RELEASING.md](RELEASING.md): synchronize the three version fields,
   validate, tag `vX.Y.Z`, and push the tag.

The public key is compiled into the application through
`LEGAL_MASR_UPDATER_PUBLIC_KEY`; the private key is used only by packaging and
signing steps. No updater permission is granted directly to the webview, and
React cannot select a download URL, signing key, install path, or install bytes.
Local builds without the public key remain functional and show updates as
unavailable. A half-configured release build fails rather than publishing an
unusable updater. Staging also checks that each signature identifies the
configured public key; native Tauri verification authenticates the package
before installation. The desktop E2E harness always disables the updater.

For a local signed packaging test, provide the same three environment variables,
run `node scripts/prepare-updater.mjs`, then build with
`pnpm tauri build --config release-updater.conf.json`. The generated configuration
contains only the public key. Never commit private keys or temporary credentials.

## Publish an update

The release workflow produces normal installers plus Windows NSIS signatures,
Linux AppImage signatures, and Intel/ARM macOS `.app.tar.gz` packages and
signatures. It stages these with `latest.json` and checksums in a draft
prerelease. Linux's signature is regenerated **after** AppImage normalization,
so it covers the exact final downloadable file.

Before publishing, review and edit the `notes` field of `latest.json` if richer
release notes are needed; regenerate its checksum in `SHA256SUMS.txt` if edited.
Release notes render as plain text. Test both installed versions and each
supported architecture. Publish the release as a **stable, latest release**
(clear draft and prerelease). GitHub's `releases/latest` endpoint excludes
prereleases; beta drafts never become automatic updates.

The built-in feed is:

```text
https://github.com/Mahmoud-s-Khedr/legal-masr/releases/latest/download/latest.json
```

Each manifest URL points to an immutable, version-tagged release asset in this
repository. Drafts are not advertised. Upload all packages/signatures and the
manifest before publishing. Do not mark an unsigned release as latest after
enabling the feed: older updater-enabled clients need its `latest.json` too.
Changing or deleting the public key variable will disable newly built clients,
not existing installations. Key rotation requires a deliberate transition
release trusted by the old key.

Existing users manually install the **first updater-enabled release**. After
that, later stable releases can arrive through the app. Keep the application
identifier (`com.legalmaster.solo`), vault location, and installer identity stable.

## User controls

Settings → About contains the current version and update controls:

- **Check manually** (default): no background release requests.
- **Check automatically and notify me**: checks after unlock, then at most every
  six hours during an unlocked session.
- **Check and download automatically**: also downloads/verifies available
  packages, then waits for the user to install.

The preference is stored locally, contains no legal/profile data, and survives
application replacement. In-flight downloads finish if the preference changes;
automatic installation never occurs. Verified download bytes are held in native
memory for this application session; restarting requires another download.

To install, save all work, acknowledge the restart, and click **Back up, install
and restart**. A modal prevents further editing. Rust creates and validates a
fresh encrypted backup using the existing vault service. A locked vault,
insufficient disk space, or failed backup stops installation. Signature or
network failures never replace the app. Installer failures offer another
verified download or manual installation. A successful upgrade is announced
when the new version starts. macOS/Linux restart through Tauri; Windows NSIS
closes and relaunches the application during installation.

## Delivery support

| Distribution                       | Update path                                  |
| ---------------------------------- | -------------------------------------------- |
| Windows x86-64 NSIS installation   | Native updater                               |
| Windows portable ZIP               | Download/replace manually                    |
| Linux x86-64 AppImage              | Native updater                               |
| Linux `.deb`/`.rpm`                | Package manager/manual installation          |
| macOS Intel / Apple Silicon `.app` | Native updater for the matching architecture |

NSIS installs an application-directory marker identifying managed Windows
installations; portable downloads do not include it. Linux update eligibility
uses Tauri's captured AppImage environment. Missing permissions or disk space
can still prevent installation; never recommend deleting the user's vault.

## Data, privacy, and recovery

Only the public feed and package URLs are requested. GitHub receives ordinary
network metadata (including IP address). No legal records, user profile,
installation UUID, case/document counts, passwords, keys, or hostname are sent.
Automatic checks are disabled by default; network failures do not block work.

Encrypted database, attachments, security metadata, and backups remain in the
existing OS application-data directory. Compatible numbered migrations run on
unlock after restarting. **Never edit a shipped migration**; add a new migration
and test an upgrade using an existing populated vault. Pre-reset legacy vaults
still require their existing explicit conversion path.

Backups protect records, but a database migration is not automatically reversed
by reinstalling the previous application. Before a schema-changing release,
test backup/restore and document a compatible recovery path. Updater signatures
are independent of Windows Authenticode and macOS Developer ID/notarization;
existing OS signing limitations still apply.

## Required release validation

Use a disposable repository fork and point the test build’s compiled feed and
release-path constants to that fork for update rehearsal. Keep the production
constants unchanged. On real Windows, Linux AppImage, and both macOS architectures:

1. Install a signed updater-enabled older version; populate a vault and attach a
   document. Verify manual mode makes no background request.
2. Publish a newer stable test release with a matching key and all four manifest
   targets. Check, download, install, restart, and unlock. Confirm records and
   attachments persist and a fresh backup validates.
3. Test notify and automatic-download preferences, lock/unlock, offline startup,
   an unavailable feed, a modified package/signature, and failed backup creation.
   Confirm no unintended installation or restart occurs.
4. Confirm portable Windows and Debian/RPM deliveries offer only manual updates.
5. For schema changes, test migrations and backup recovery before publication.

Do not use a real client vault for these tests. Never publish test updates to the
production latest-release feed without the intended stable release review.
