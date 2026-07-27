# Testing strategy

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 16. Testing strategy

This application handles professionally sensitive records. Testing cannot be omitted.

## 16.1 Rust unit tests

Test:

* Money calculations
* Date and overdue calculations
* Arabic normalization
* Phone normalization
* Password-envelope operations
* Recovery-key operations
* Backup manifest validation
* Checksum generation
* Domain validation
* Error conversion

## 16.2 Repository integration tests

Use temporary encrypted databases.

Test:

* Migrations
* CRUD
* Foreign keys
* Archiving
* Transaction rollback
* Search-index synchronization
* Cascading deletion rules
* Financial summaries
* Concurrent command behavior

## 16.3 Frontend tests

Use Vitest and React Testing Library.

Test:

* Forms
* Validation
* Empty states
* Loading states
* Error states
* RTL layout behavior
* Navigation
* Unsaved-change warnings
* Finance display
* Dashboard grouping

## 16.4 Contract tests

Mock the Tauri bridge and verify:

* Command names
* Request payloads
* Response DTOs
* Error codes
* Optional fields
* Date serialization

## 16.5 Backup tests

Mandatory scenarios:

* Normal backup
* Empty database backup
* Large document backup
* Interrupted backup
* Wrong password
* Corrupted archive
* Missing document
* Insufficient disk space
* Restore over existing installation
* Restore from previous application version
* Checksum mismatch
* Backup path unavailable

## 16.6 Migration tests

For each released version:

```text
old test fixture
    → run current migrations
        → verify record counts
        → verify critical fields
        → verify foreign keys
        → verify search rebuild
```

## 16.7 Manual platform test matrix

Before every public release:

| Area                |  Windows | macOS Intel | macOS Apple Silicon |
| ------------------- | -------: | ----------: | -------------------: |
| Install             | Required |    Required |             Required |
| Uninstall           | Required |    Required |             Required |
| Create database     | Required |    Required |             Required |
| Unlock              | Required |    Required |             Required |
| Import document     | Required |    Required |             Required |
| Native notification | Required |    Required |             Required |
| Autostart           | Required |    Required |             Required |
| Backup              | Required |    Required |             Required |
| Restore             | Required |    Required |             Required |
| Update              | Required |    Required |             Required |
