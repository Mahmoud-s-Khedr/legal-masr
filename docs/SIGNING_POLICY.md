# Signing policy

## Current policy

Linux:
Unsigned local development builds.

Windows:
Authenticode signing is required for public launch. The owner must obtain a certificate; no self-signed certificate.

macOS (deferred):
Existing development signing configuration is outside the first public release.

Tauri updater:
Separate signing system. Disabled unless explicitly configured.

`SHA256SUMS.txt` is an integrity aid only. It is not a code signature.

## Explicit exclusions

The repository and CI do not contain Windows certificates, updater private keys, certificate passwords, fake secrets, or generated signing keys. Public Windows artifacts must not be described as signed until Authenticode signing and verification are complete.

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

Future macOS release signing and notarization will be specified when macOS returns to launch scope.

If automatic updates are later adopted, generate the Tauri updater key pair once outside CI, commit only the public key in updater configuration, and store the private key and password separately as GitHub secrets. Only then enable updater artifacts and use `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
