# Privacy

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 4.5 Privacy by architecture

Egypt's Personal Data Protection Law No. 151 of 2020 governs electronic processing of personal data, and its executive framework was operationalized by Ministerial Decree No. 816 of 2025. Legal summaries identify a one-year compliance transition ending on **November 1, 2026**. The application's local-only design reduces the amount of case information processed by LegalMaster as a vendor, but it does not by itself certify the lawyer's legal compliance.

Before public release:

* An Egyptian privacy lawyer must review the privacy notice.
* Marketing must not claim "fully compliant with Egyptian law" without written legal review.
* The software must clearly explain which information remains on the device and which limited requests contact the internet.

---

# 8.13 Privacy and data-management tools

### Required tools

* Export one client and all linked data.
* Export one case.
* Export complete installation.
* Archive client.
* Archive case.
* Permanently delete a client through a guided workflow.
* Permanently delete a case through a guided workflow.
* Remove document metadata.
* Remove managed document files.
* Display application data location.
* Display backup locations.
* Display network policy.
* Display current application version.
* Display privacy notice.

### Complete export

Provide:

```text
export/
├── clients.csv
├── cases.csv
├── events.csv
├── tasks.csv
├── financial-transactions.csv
├── documents.csv
├── documents/
└── export-manifest.json
```

This format should be documented and stable enough to support later migration into LegalMaster Firms.

### Deletion workflow

Permanent deletion should:

1. Display affected records.
2. Explain attached documents.
3. Require explicit text confirmation.
4. Create an optional emergency backup.
5. Delete within one database transaction where possible.
6. Remove managed files only after the database operation is prepared.
7. Report any file-deletion failure.
8. Avoid claiming guaranteed forensic erasure on SSDs or third-party backup systems.
