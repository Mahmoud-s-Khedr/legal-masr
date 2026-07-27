# Backup format

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 8.12 Backup and restore

Backup is part of the MVP, not a later enhancement.

SQLite's official online backup API can copy a live database without requiring the source database to remain locked for the entire operation.

### Backup archive structure

```text
legalmaster-backup-2026-07-27-143000.lmsbackup
└── encrypted payload
    ├── manifest.json
    ├── database.sqlite
    ├── documents/
    └── checksums.json
```

### Manifest

```json
{
  "formatVersion": 1,
  "applicationVersion": "0.5.0",
  "schemaVersion": 12,
  "createdAt": "2026-07-27T11:30:00Z",
  "platform": "windows-x86_64",
  "databaseEncrypted": true,
  "managedDocumentCount": 42
}
```

### Backup creation process

1. Validate backup destination.
2. Create temporary working directory.
3. Use the SQLite backup API to produce a consistent database copy.
4. Copy managed documents.
5. Generate checksums.
6. Generate manifest.
7. Create archive.
8. Encrypt the complete archive.
9. Write to a temporary destination file.
10. Flush and close the file.
11. Rename atomically to the final name.
12. Reopen and validate archive metadata.
13. Record successful backup.
14. Apply retention policy.

### Backup encryption

The complete archive must be encrypted because managed documents may not otherwise be application-encrypted.

Derive a backup-encryption key from the database master key using a separate cryptographic context. Never reuse a nonce.

### Automatic backups

Settings:

- Enabled or disabled
- Destination folder
- Frequency:

  - Daily
  - Every application exit
  - Manual only

- Retention count
- Last successful backup
- Last failure

### Restore process

Restore must never overwrite the active installation immediately.

1. Select backup.
2. Read and authenticate archive.
3. Validate format version.
4. Validate checksums.
5. Validate compatible schema.
6. Display backup summary.
7. Create emergency backup of current installation.
8. Extract to a temporary location.
9. Open restored database.
10. Run integrity checks.
11. Replace active files atomically.
12. Restart application.
13. Confirm restored record counts.

### Acceptance criteria

- Backups contain all managed data.
- External document references are recorded but not copied.
- Corrupted archives are rejected.
- Wrong passwords are rejected.
- Restore failure leaves current data untouched.
- Pre-update backup uses the same verified workflow.
- Backup failure remains visible until resolved.

---

## Related database table

See `backup_history` in [03-data-model.md](03-data-model.md) for the local record of backup runs.
