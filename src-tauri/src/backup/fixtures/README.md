# Format-v2 compatibility fixture

`format-v2-zip-2.4.2.lmsbackup` is an encrypted format-v2 backup generated on
2026-10-21 **before upgrading zip**, using the production `backup::create`
function and locked zip 2.4.2 at revision
`601a6cd44972b1e283f321619284ac3c1bcbf61c`.

It contains only fictional test data from `source_with_backup()`:

- One client with internal number `CL-SOURCE` and the test name أحمد.
- One managed `scan.bin` attachment: bytes 0 through 255, repeated to 4096 bytes.
- A schema-0004 SQLCipher database, manifest and checksums in the original ZIP
  layout, inside the authenticated v2 JSON envelope.
- The public test password `a secure local password` and the existing test
  recovery key (`RECOVERY` in `backup/mod.rs`). These are test credentials only.

The one-time generator, run under a temporary `XDG_DATA_HOME`, was:

```rust
#[test]
#[ignore]
fn generate_zip_2_4_2_fixture() {
    let source = source_with_backup();
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/backup/fixtures");
    fs::create_dir_all(&fixtures).unwrap();
    fs::copy(&source.backup, fixtures.join("format-v2-zip-2.4.2.lmsbackup")).unwrap();
}
```

The generator was removed afterward. Do not regenerate this fixture with a newer
writer: it is fixed evidence of the old writer's layout. The regression test
authenticates and restores this file, then verifies the client, attachment bytes
and restored password. Newly created backups exercise the same restore assertions.
