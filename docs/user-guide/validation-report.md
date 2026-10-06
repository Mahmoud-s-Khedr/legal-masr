# User-guide validation report

The guides cover the current Legal Masr 0.1.0 interface in Arabic and English,
including all main routes, record tabs, forms, important dialogs, and selected
failure states. Screenshots use the real Linux Tauri/WebKit desktop application,
real IPC and SQLCipher persistence, and disposable fictional data. Native file
selection uses the existing allowlisted desktop-test adapter.

Final artifact counts, source revision, binary checksum, and per-scenario results
are recorded in [capture-manifest.json](capture-manifest.json) and
[artifact-validation.json](artifact-validation.json). The [coverage table](traceability.md)
links every screen to its screenshots and lists the functional outcomes. The working
tree includes this contribution; the commit alone does not identify its complete
source. Screenshot hashes bind the delivered images to the manifest.

Each language documents 89 screen states with 100 annotated screenshots and a
115-page A4 PDF. All six Markdown, offline HTML, and PDF deliverables passed
artifact verification. The HTML opens directly from disk without HTTP requests;
the PDFs embed fonts and images, retain selectable text and internal navigation,
and contain no development-machine file links.

Visual review covered all 200 annotated images and all 230 PDF pages through
contact sheets, with full-size Arabic case-edit and English hearing-edit PDF
pages checked for readability. No missing images or clipped content were
observed. Long screenshots use overlapping parts; chapter divider pages and
continued explanations are intentional.

## Automated checks

| Check                                                                      | Result                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Frontend tests with coverage                                               | 227 passed in 25 files                                              |
| Node script tests                                                          | 48 passed, including four guide-publishing safeguard tests          |
| Rust unit/integration tests (`cargo test --all-features`)                  | 63 passed                                                           |
| Rust formatting and clippy (`--all-targets --all-features -- -D warnings`) | Passed                                                              |
| Canonical browser visual comparison                                        | 65 passed; 64 candidate captures verified                           |
| Typecheck and lint                                                         | Passed                                                              |
| Linux debug DEB build                                                      | Passed; existing Vite chunk-size warning remains                    |
| Production binary boundary check                                           | Passed; desktop test harness markers absent                         |
| Native bilingual functional scenarios                                      | 70 passed: 35 per language; zero failures                           |
| Native screen-render checks                                                | 166 passed: 83 per language; access states covered by gate journeys |
| Existing native desktop smoke suite                                        | 5 passed                                                            |
| Guide artifact verification and repository formatting                      | Passed                                                              |

All seven configured coverage floors pass. Renderer coverage: statements/lines
82.93%, branches 81.22%, functions 74.92%. Production Rust coverage: regions
33.92%, functions 34.62%, lines 35.67%. These are repository-level measurements,
not a claim of complete workflow coverage.

## Defects corrected

| Defect                                                                        | Result                                                                                       | Regression evidence                                                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Search keyboard selection referred to a different ID from the selected option | Assistive technology can follow the selected result; empty results have no active descendant | Frontend normal/empty-result tests and native keyboard deep-link assertion                                     |
| Completing a task left its open dialog showing the old completion action      | Tasks and case task dialogs switch between Complete and Reopen after success                 | Frontend completion/reopening, unsaved-draft preservation, and failed-completion tests; native complete/reopen |
| Finance inspection used a fixed Arabic money formatter and raw ISO dates      | Inspection follows the selected language and date preference                                 | Arabic/English inspection tests and fresh bilingual captures                                                   |
| Dialog rerenders reset focus to the first control                             | Updating errors or data preserves focus while editing                                        | A regression test failed before the fix and passes after it; existing Escape/focus-return check passes         |
| Select and date-picker portals appeared underneath dialog surfaces            | Their controls can be selected with the mouse inside dialogs                                 | Native payer-option click/save and calendar-day click tests; refreshed calendar capture                        |
| Recovery displayed an error from a failed unlock attempt                      | Each access form displays its own operation error                                            | Frontend gate-switch and recovery-refusal regression; native stale-error check                                 |
| Long case labels widened hearing dialogs and clipped controls                 | Dialog grid tracks and select values stay within the dialog width                            | Native long-label dialog overflow assertion and bilingual hearing edit captures                                |
| A POA linked through two clients repeated the same case                       | Linked case IDs and case counts are unique                                                   | The Rust multi-client regression failed before `SELECT DISTINCT` and passes after it; native DTO assertion     |

The POA repository query now returns distinct case IDs. No public command interfaces or database schemas changed. No migration, cloud service,
telemetry, or personal/legal-data logging was added.

## Validation layers

| Layer                 | Evidence                                                                                                                                                                                  | Limits                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Frontend              | Vitest/React Testing Library, coverage, typecheck, lint, build                                                                                                                            | Component tests cannot establish native stacking, persistence, or OS permissions              |
| Script tools          | Node tests, including incomplete bilingual inventories, unsafe filenames, duplicate images, invalid callout bounds, and malformed PNGs                                                    | These validate publishing safeguards, not legal workflows                                     |
| Rust                  | Unit/integration tests, format, clippy, production coverage                                                                                                                               | Real encrypted storage and business invariants; not physical-device UX                        |
| Existing visual suite | 64 Arabic/English route captures at two desktop viewports plus keyboard/dialog journey                                                                                                    | Candidate repeatability; baseline remains unapproved                                          |
| Native guide journeys | Real UI creation/editing, search, task status, hearing decisions, payments, optional-link expenses, attachments, archive/restore paths, password recovery, restart, and restore exercises | Screen-render outcomes mean the screen was reached, not that every action on it was exercised |
| Documents             | Local links/images, PNG hashes/dimensions, matching inventories, RTL/LTR, phone-width HTML, no HTTP requests, selectable PDF text and PDF structure                                       | OS PDF-viewer differences remain possible                                                     |

The native journey distinguishes UI actions from direct IPC checks. Client,
case, POA, payment, expense, task, and attachment creation include UI saves.
Archive-state setup and some removals use real IPC; restore buttons and task
completion use the UI. Password rewrapping/recovery and repeated restore
exercises additionally use real IPC. Each language runs three independent
same-vault restore iterations and verifies the restored attachment bytes and
unchanged source bytes. These checks do not establish cross-device portability.

Initial harness issues were corrected: an open command palette blocked later
controls, hidden select options were included in a locator, a hearing test chose
the upcoming hearing but asserted today's hearing ID, and refusal assertions
assumed more specific error codes than the services return. Final results must
be read from the final manifest, rather than those superseded attempts.

## Remaining product and platform limits

- Case-client relationships are read-only after creation in the current UI;
  legal-capacity editing, client reassignment, and POA linking are unavailable.
- Expense-owned attachments and individual client JSON exports exist in Rust
  without corresponding upload/export actions in the current screens.
- Duplicate internal identifiers are safely rejected, but currently return a
  generic operation error; the troubleshooting chapter advises checking them.
- Cross-device restore with only the original password remains blocked by the
  vault-derived archive key. Automatic backups/retention, destination selection,
  restore preview, full/case exports, and permanent client/case deletion remain
  outside this contribution.
- Windows/macOS installer behavior, real file-picker interaction, successful
  external document open/reveal, notification permissions/delivery, autostart,
  and sleep/resume remain physical-device checks. Linux/native and browser tests
  do not pass those gates.
- The visual baseline remains a candidate. Guide generation does not approve it.
- Vite continues to emit its existing large-chunk warning during successful
  builds; this work does not change application bundling architecture.
