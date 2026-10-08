# Remediation register — 2026-10-08

Baseline: `1502f73e3fd5bde4171953a607747b82cf67628e`. The existing `.gitignore` change and review artifacts are preserved.

[Machine-readable register](2026-10-08-remediation-register.json) contains 1234 separately identified scenarios/constituents/coverage assertions, including 146 scoped original findings and 69 command coverage entries. [Contribution tasks](2026-10-08-remediation-tasks.md) divide the work by phase. [Execution evidence and open work](2026-10-08-remediation-progress.md) describe the implemented subset.

Original identifiers are scoped by report domain, e.g. `security-backups/F3` and `clients-poas-documents/F3` are different findings. Each entry records its source line, scenario, owner phase, acceptance, normal/failure tests, disposition and evidence status. Prior observations and static signatures are never an acceptance pass.

Run `node scripts/verify-remediation-register.mjs` to check unique IDs, every original finding, medium constituent, coverage assertion and the 69-command inventory. This checks traceability, not product behavior.

Agreed defaults: plaintext managed attachments; reminders only while open/unlocked with lead/catch-up work; archives read-only until restored; completed-hearing text/notes correction without chain changes; confirmed finance deletion; separate client/shared-case totals; usage-counter surface removal with dormant storage retained; unsigned Windows/ad-hoc macOS public beta, with signing/updating deferred. Money stays in integer minor units, legal dates stay timezone-free, RTL/offline/Rust boundary remain mandatory.

Corrections retained: picker deadlock and timeout overflow are rejected claims. Giant-vault failure and timer throttling require reproduction. Moved local-key zeroization already existed; remaining copies/lifetimes are the concern. CASE rebuild omits client names; the POA rebuild includes them. Independent optional expense links remain allowed.

| ID  | Owner phase | Evidence status       |
| --- | ----------- | --------------------- |
| B01 | 2           | open                  |
| B02 | 1           | partial               |
| B03 | 1           | partial               |
| B04 | 2           | open                  |
| B05 | 3           | open                  |
| B06 | 3           | open                  |
| B07 | 3           | open                  |
| B08 | 3           | open                  |
| B09 | 3           | open                  |
| B10 | 3           | open                  |
| B11 | 5           | open                  |
| B12 | 2           | reproduction-required |
| B13 | 4           | open                  |
| B14 | 1           | partial               |
| H01 | 5           | open                  |
| H02 | 4           | open                  |
| H03 | 4           | open                  |

No full implementation phase is marked accepted by these partial results. Physical supported-platform, cross-device and Egyptian legal-review gates remain blocking.
