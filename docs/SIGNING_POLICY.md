# Signing policy

## Current policy

Linux:
Unsigned local development builds.

Windows:
Unsigned public beta installer. No self-signed certificate.

macOS:
Ad-hoc signed using signing identity `"-"`.
Not notarized.
Users may need to approve the app manually.

Tauri updater:
Separate signing system. Disabled unless explicitly configured.

`SHA256SUMS.txt` is an integrity aid only. It is not a code signature.

## Explicit exclusions

The repository and CI do not contain Apple certificates, Windows certificates, updater private keys, certificate passwords, Apple credentials, fake secrets, or generated signing keys. Windows artifacts must not be described as Authenticode-signed. Ad-hoc macOS signing does not remove Gatekeeper warnings and does not make the application Apple-verified.

## Future commercial signing

When real Windows signing credentials and an explicit enablement decision exist, the Windows path is:

```text
Build executable
→ sign executable
→ build installer
→ sign installer
→ timestamp
→ verify
→ publish
```

That work must use real credentials stored outside the repository, clean temporary sensitive files in an `always()` cleanup step, and leave the current unsigned path unchanged until enabled.

Future macOS Developer ID distribution requires an imported `.p12` certificate, its password, a signing identity, Apple notarization credentials, notarization, stapling, and verification. It is independent of the current ad-hoc path.

If automatic updates are later adopted, generate the Tauri updater key pair once outside CI, commit only the public key in updater configuration, and store the private key and password separately as GitHub secrets. Only then enable updater artifacts and use `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
