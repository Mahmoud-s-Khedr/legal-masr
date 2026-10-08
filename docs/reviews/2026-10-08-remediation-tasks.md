# Remediation contribution tasks

Each task uses the repository contribution template. Execute in phase order; do not start dependent work until its contracts pass acceptance. The register assigns every source scenario an owner phase; constituent and coverage entries stay open until their exact assertions pass. These task statuses do not close grouped findings.

## P0-01 — Verify complete review traceability

- **Title:** Verify complete review traceability.
- **Context:** User remediation plan; [topic](../../docs/reviews/2026-10-08-prelaunch-review.md) and original findings in the register.
- **Allowed scope:** Phase 0 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Every blocker, scoped appendix finding, medium/low constituent, command and outstanding coverage assertion remains individually traceable.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Every blocker, scoped appendix finding, medium/low constituent, command and outstanding coverage assertion remains individually traceable. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `node scripts/verify-remediation-register.mjs`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Inventory verified; findings remain open.

## P1-01 — Separate database creation from existing-vault access

- **Title:** Separate database creation from existing-vault access.
- **Context:** User remediation plan; [topic](../../docs/plan/05-security.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Missing/empty/corrupt/legacy/newer databases cannot become workspaces; setup cannot replace existing artifacts. Preserve refused-file bytes.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Missing/empty/corrupt/legacy/newer databases cannot become workspaces; setup cannot replace existing artifacts. Preserve refused-file bytes. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Implemented; local normal/refusal tests pass.

## P1-02 — Journal setup and restore transitions

- **Title:** Journal setup and restore transitions.
- **Context:** User remediation plan; [topic](../../docs/plan/07-backup-format.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Flush staged data and intent before replacing files; recover a complete generation at every transition and sharing/permission/disk failure. Preserve pending intent on failure.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Flush staged data and intent before replacing files; recover a complete generation at every transition and sharing/permission/disk failure. Preserve pending intent on failure. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `cargo test --manifest-path src-tauri/Cargo.toml vault_operation`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Implemented on Unix; physical durability gates open.

## P1-03 — Expose retained emergency-snapshot recovery

- **Title:** Expose retained emergency-snapshot recovery.
- **Context:** User remediation plan; [topic](../../docs/plan/07-backup-format.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Keep database/files/security together in unique snapshots; allow authenticated restore/export and explicitly confirmed deletion through opaque IDs. Later restores retain prior snapshots.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Keep database/files/security together in unique snapshots; allow authenticated restore/export and explicitly confirmed deletion through opaque IDs. Later restores retain prior snapshots. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Storage retention implemented; recovery/export/deletion UI pending.

## P1-04 — Coordinate operations and invalidate session epochs

- **Title:** Coordinate operations and invalidate session epochs.
- **Context:** User remediation plan; [topic](../../docs/plan/02-architecture.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Admit ordinary bounded workers; lifecycle writes are exclusive and drain admitted work. Lock rejects new work immediately; pre-commit epoch checks and renderer result checks prevent late writes/cache restoration.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Admit ordinary bounded workers; lifecycle writes are exclusive and drain admitted work. Lock rejects new work immediately; pre-commit epoch checks and renderer result checks prevent late writes/cache restoration. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending; do not make commands asynchronous before acceptance.

## P1-05 — Clear owned native and renderer secrets

- **Title:** Clear owned native and renderer secrets.
- **Context:** User remediation plan; [topic](../../docs/plan/05-security.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Zeroize owned key/credential buffers on every return path; clear forms, mutation payloads/results, recovery state, tokens and caches after dismissal/success/lock/session replacement.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Zeroize owned key/credential buffers on every return path; clear forms, mutation payloads/results, recovery state, tokens and caches after dismissal/success/lock/session replacement. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Owned native buffers and auth observer cleanup implemented; complete retention/epoch audit pending.

## P1-06 — Use reliable idle and native-resume locking

- **Title:** Use reliable idle and native-resume locking.
- **Context:** User remediation plan; [topic](../../docs/plan/05-security.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Use 30-minute fallback on failed settings, wheel/scroll activity and stable callbacks. Native resume signals replace delayed-JavaScript-timer sleep inference. Reproduce minimized-device throttling.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Use 30-minute fallback on failed settings, wheel/scroll activity and stable callbacks. Native resume signals replace delayed-JavaScript-timer sleep inference. Reproduce minimized-device throttling. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm exec vitest run src/components/layout/Shell.lock.test.tsx`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Fallback/activity/callback tests pass; native resume pending.

## P1-07 — Register single-instance handling before other plugins

- **Title:** Register single-instance handling before other plugins.
- **Context:** User remediation plan; [topic](../../docs/plan/02-architecture.md) and original findings in the register.
- **Allowed scope:** Phase 1 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Second launches show, unminimize and focus the existing window without a second vault process. Verify on real supported OS builds.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Second launches show, unminimize and focus the existing window without a second vault process. Verify on real supported OS builds. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Implemented; physical second-launch evidence pending.

## P2-01 — Define and implement authenticated streaming backup v2

- **Title:** Define and implement authenticated streaming backup v2.
- **Context:** User remediation plan; [topic](../../docs/plan/07-backup-format.md) and original findings in the register.
- **Allowed scope:** Phase 2 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Portable bounded header/envelopes and ordered encrypted chunks authenticate format metadata; reject truncation/duplicates/reorder/unsupported versions. Keep validated v1 conversion with limitation copy.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Portable bounded header/envelopes and ordered encrypted chunks authenticate format metadata; reject truncation/duplicates/reorder/unsupported versions. Keep validated v1 conversion with limitation copy. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P2-02 — Restore standalone archives with destination credentials

- **Title:** Restore standalone archives with destination credentials.
- **Context:** User remediation plan; [topic](../../docs/plan/07-backup-format.md) and original findings in the register.
- **Allowed scope:** Phase 2 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Fresh-install restore works with backup-time password/recovery only, chooses destination password and new recovery key. Existing-vault replacement also authenticates current credentials. Wrong credentials preserve the vault.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Fresh-install restore works with backup-time password/recovery only, chooses destination password and new recovery key. Existing-vault replacement also authenticates current credentials. Wrong credentials preserve the vault. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test:desktop && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P2-03 — Bound streaming archive preparation and extraction

- **Title:** Bound streaming archive preparation and extraction.
- **Context:** User remediation plan; [topic](../../docs/plan/07-backup-format.md) and original findings in the register.
- **Allowed scope:** Phase 2 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Stream committed DB/file metadata with integrity checking, disk checks and limits of 1 GiB/file, 64 GiB/archive, 100000 files and 16 MiB metadata. Clean owned temporary files and abandoned RUNNING history.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Stream committed DB/file metadata with integrity checking, disk checks and limits of 1 GiB/file, 64 GiB/archive, 100000 files and 16 MiB metadata. Clean owned temporary files and abandoned RUNNING history. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending; dedicated low-memory fixtures required.

## P2-04 — Add native backup destination, progress and history controls

- **Title:** Add native backup destination, progress and history controls.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 2 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Use opaque native IDs for destination/export/reveal/history/preview. Preparation cancels safely; replacement cannot be cancelled. Cancellation is neutral and failures/loading/empty/history/completion are distinct.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Use opaque native IDs for destination/export/reveal/history/preview. Preparation cancels safely; replacement cannot be cancelled. Cancellation is neutral and failures/loading/empty/history/completion are distinct. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && pnpm test:desktop`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P2-05 — Protect managed originals during file operations

- **Title:** Protect managed originals during file operations.
- **Context:** User remediation plan; [topic](../../docs/plan/05-security.md) and original findings in the register.
- **Allowed scope:** Phase 2 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Stream/hash attachments, preserve picker tokens for correctable validation, restrict open types and use temporary viewing copies. Missing/modified files and committed-deletion cleanup failures are accurate. Plaintext managed files are clearly disclosed in both languages.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Stream/hash attachments, preserve picker tokens for correctable validation, restrict open types and use temporary viewing copies. Missing/modified files and committed-deletion cleanup failures are accurate. Plaintext managed files are clearly disclosed in both languages. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P3-01 — Normalize, save and regenerate recovery keys

- **Title:** Normalize, save and regenerate recovery keys.
- **Context:** User remediation plan; [topic](../../docs/plan/05-security.md) and original findings in the register.
- **Allowed scope:** Phase 3 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Accept exactly 64 hex digits with case/whitespace/hyphen normalization in both layers. Group/copy/native-save/print/ack and password-authenticated regeneration work; old keys cannot unlock current vault, backup-time keys remain valid.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Accept exactly 64 hex digits with case/whitespace/hyphen normalization in both layers. Group/copy/native-save/print/ack and password-authenticated regeneration work; old keys cannot unlock current vault, backup-time keys remain valid. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P3-02 — Make referenced POAs and inline clients editable safely

- **Title:** Make referenced POAs and inline clients editable safely.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 3 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Isolate portal submission and preserve drafts; transactionally diff membership, retain referenced links, reject referenced removals with a specific error. Display archived selections, filter clients, validate unadded lawyers and year/date consistency.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Isolate portal submission and preserve drafts; transactionally diff membership, retain referenced links, reject referenced removals with a specific error. Display archived selections, filter clients, validate unadded lawyers and year/date consistency. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P3-03 — Support controlled legal dates and explicit reference-year kinds

- **Title:** Support controlled legal dates and explicit reference-year kinds.
- **Context:** User remediation plan; [topic](../../docs/plan/03-data-model.md) and original findings in the register.
- **Allowed scope:** Phase 3 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** New immutable migration preserves prior years as UNSPECIFIED; judicial 1–9999 and Gregorian 1800–9999. Dates display/save/clear/reopen across forms with Arabic/Persian digits and real-date validation. Closing chronology and legacy warnings are explicit.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** New immutable migration preserves prior years as UNSPECIFIED; judicial 1–9999 and Gregorian 1800–9999. Dates display/save/clear/reopen across forms with Arabic/Persian digits and real-date validation. Closing chronology and legacy warnings are explicit. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P3-04 — Correct completed decisions without changing hearing chains

- **Title:** Correct completed decisions without changing hearing chains.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 3 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Corrections change decision text/notes only; case/completion/successor remain fixed. Require text or later next date, confirm empty text, reject future source hearings, and preserve item reminder settings.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Corrections change decision text/notes only; case/completion/successor remain fixed. Require text or later next date, confirm empty text, reject future source hearings, and preserve item reminder settings. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P3-05 — Enforce read-only archived records and validate links

- **Title:** Enforce read-only archived records and validate links.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 3 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Rust/UI reject archived writes/new links until restore, preserve existing links and labels, confirm archive, and exclude archived work from active schedules. Completion/archive are idempotent; deep links and draft navigation are guarded. Expense links remain independently optional.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Rust/UI reject archived writes/new links until restore, preserve existing links and labels, confirm archive, and exclude archived work from active schedules. Completion/archive are idempotent; deep links and draft navigation are guarded. Expense links remain independently optional. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P3-06 — Normalize contact fields and duplicate-warning drafts

- **Title:** Normalize contact fields and duplicate-warning drafts.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 3 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Blank optional fields become NULL; normalized national IDs have 14 digits; phone/email/required trims/length bounds align. Duplicate checks cover normalized identity, archived candidates, current values and changed-warning invalidation.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Blank optional fields become NULL; normalized national IDs have 14 digits; phone/email/required trims/length bounds align. Duplicate checks cover normalized identity, archived candidates, current values and changed-warning invalidation. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P4-01 — Guard repeated submissions and translate duplicate identifiers

- **Title:** Guard repeated submissions and translate duplicate identifiers.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 4 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Before the first await, guard every mutation; immediate click/Enter produces one record, while separate intentional identical submissions remain allowed. Number collisions including archives produce field errors; only missing rows map to NOT_FOUND.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Before the first await, guard every mutation; immediate click/Enter produces one record, while separate intentional identical submissions remain allowed. Number collisions including archives produce field errors; only missing rows map to NOT_FOUND. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P4-02 — Correct financial deletion, totals and moved-account caches

- **Title:** Correct financial deletion, totals and moved-account caches.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 4 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Preview/confirm payment/expense deletion and fee clearing; expense files use compensation. Preserve fee date/notes, show overpayment, separate client-owned finances from shared case totals, count linked cases once and invalidate old/new accounts.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Preview/confirm payment/expense deletion and fee clearing; expense files use compensation. Preserve fee date/notes, show overpayment, separate client-owned finances from shared case totals, count linked cases once and invalidate old/new accounts. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P4-03 — Use one normalized search/index recipe

- **Title:** Use one normalized search/index recipe.
- **Context:** User remediation plan; [topic](../../docs/plan/03-data-model.md) and original findings in the register.
- **Allowed scope:** Phase 4 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Save/rename/relationship/rebuild share transactional normalized indexing of advertised fields/phones. Escape literal substring wildcards, preserve co-clients with ordered arrays, rebuild existing indexes once and provide bounded lists/debounced/visible-range queries.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Save/rename/relationship/rebuild share transactional normalized indexing of advertised fields/phones. Escape literal substring wildcards, preserve co-clients with ordered arrays, rebuild existing indexes once and provide bounded lists/debounced/visible-range queries. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P4-04 — Compute reminders and Today from local schedules

- **Title:** Compute reminders and Today from local schedules.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 4 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Support 0–10080 minute leads across midnight, 09:00 untimed defaults, unlock catch-up and notification retry. Deduplicate by entity schedule/lead, summarize overdue items, exclude archives, roll Today at midnight/resume and show undecided hearings/recent creation order.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Support 0–10080 minute leads across midnight, 09:00 untimed defaults, unlock catch-up and notification retry. Deduplicate by entity schedule/lead, summarize overdue items, exclude archives, roll Today at midnight/resume and show undecided hearings/recent creation order. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P4-05 — Save settings independently and reconcile OS state

- **Title:** Save settings independently and reconcile OS state.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 4 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Independent sections align timeout 1–1440 and catch auth/plugin errors; permission/autostart load and partial compensation reflect OS state. Preserve explicit nonsensitive pre-unlock locale/theme; remove usage-counter surface and use runtime version.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Independent sections align timeout 1–1440 and catch auth/plugin errors; permission/autostart load and partial compensation reflect OS state. Preserve explicit nonsensitive pre-unlock locale/theme; remove usage-counter surface and use runtime version. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P5-01 — Separate dialogs and meet narrow/RTL/accessibility acceptance

- **Title:** Separate dialogs and meet narrow/RTL/accessibility acceptance.
- **Context:** User remediation plan; [topic](../../docs/plan/04-functional-modules.md) and original findings in the register.
- **Allowed scope:** Phase 5 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Navigation/search roots, focus/Escape and physical KeyK work; 760×560 Finance/long content remains usable. Both themes meet AA, calendar keyboard/labels and field/dialog relationships are complete; localized mixed-direction values and errors are safe.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Navigation/search roots, focus/Escape and physical KeyK work; 760×560 Finance/long content remains usable. Both themes meet AA, calendar keyboard/labels and field/dialog relationships are complete; localized mixed-direction values and errors are safe. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && pnpm capture:visual:canonical`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending; supported-device AT judgment required.

## P5-02 — Bound security metadata and test shared command contracts

- **Title:** Bound security metadata and test shared command contracts.
- **Context:** User remediation plan; [topic](../../docs/plan/05-security.md) and original findings in the register.
- **Allowed scope:** Phase 5 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Bound KDF metadata before derivation, separate corrupt/unsupported/incorrect credentials, benchmark low-end fixture. Shared JSON fixtures test Rust decode/encode and TS forwarding; create/update roles match advertised behavior.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Bound KDF metadata before derivation, separate corrupt/unsupported/incorrect credentials, benchmark low-end fixture. Shared JSON fixtures test Rust decode/encode and TS forwarding; create/update roles match advertised behavior. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P5-03 — Remove unsupported surface and production harness imports

- **Title:** Remove unsupported surface and production harness imports.
- **Context:** User remediation plan; [topic](../../docs/plan/02-architecture.md) and original findings in the register.
- **Allowed scope:** Phase 5 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Remove unsupported CANCELLED/error variants; document/test backend-only commands. Production imports exclude fixtures, Vite prefixes are narrow and diagnostics contain allowlisted codes/versions/stages/durations only.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Remove unsupported CANCELLED/error variants; document/test backend-only commands. Production imports exclude fixtures, Vite prefixes are narrow and diagnostics contain allowlisted codes/versions/stages/durations only. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm build && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P6-01 — Schedule opt-in automatic backups with safe retention

- **Title:** Schedule opt-in automatic backups with safe retention.
- **Context:** User remediation plan; [topic](../../docs/plan/07-backup-format.md) and original findings in the register.
- **Allowed scope:** Phase 6 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Native destination and narrow settings support open/unlocked daily/catch-up runs. Validate before retaining latest 10 successful automatic archives; never auto-delete manual/emergency snapshots; paths stay out of history/logs/diagnostics.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Native destination and narrow settings support open/unlocked daily/catch-up runs. Validate before retaining latest 10 successful automatic archives; never auto-delete manual/emergency snapshots; paths stay out of history/logs/diagnostics. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P6-02 — Export client/case/full data with scoped manifests

- **Title:** Export client/case/full data with scoped manifests.
- **Context:** User remediation plan; [topic](../../docs/plan/06-privacy.md) and original findings in the register.
- **Allowed scope:** Phase 6 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Document UTF-8 CSV/JSON and managed-file manifests; atomic plaintext exports do not overwrite silently. Client exports exclude co-client identifiers/unrelated payments/opponents; case/full previews explicitly describe broader contents.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Document UTF-8 CSV/JSON and managed-file manifests; atomic plaintext exports do not overwrite silently. Client exports exclude co-client identifiers/unrelated payments/opponents; case/full previews explicitly describe broader contents. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P6-03 — Permanently delete scoped records without harming shared data

- **Title:** Permanently delete scoped records without harming shared data.
- **Context:** User remediation plan; [topic](../../docs/plan/06-privacy.md) and original findings in the register.
- **Allowed scope:** Phase 6 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Impact preview, typed confirmation, optional verified backup and file compensation protect client/case/full deletion. Shared/reference dependencies require explicit resolution and failure restores consistency. Add existing-rule relationship/expense-file controls.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Impact preview, typed confirmation, optional verified backup and file compensation protect client/case/full deletion. Shared/reference dependencies require explicit resolution and failure restores consistency. Add existing-rule relationship/expense-file controls. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml --all-features`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P6-04 — Provide allowlisted support bundles and optional tray

- **Title:** Provide allowlisted support bundles and optional tray.
- **Context:** User remediation plan; [topic](../../docs/plan/06-privacy.md) and original findings in the register.
- **Allowed scope:** Phase 6 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Preview/save bundles excluding DB/files/paths/profile/credentials/raw exceptions. Tray shows lock state and Quit; locked reminders remain disabled.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Preview/save bundles excluding DB/files/paths/profile/credentials/raw exceptions. Tray shows lock state and Quit; locked reminders remain disabled. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm test && pnpm test:desktop`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending; OS tray evidence required.

## P7-01 — Regenerate bilingual guides and accurate release documentation

- **Title:** Regenerate bilingual guides and accurate release documentation.
- **Context:** User remediation plan; [topic](../../docs/plan/08-release-process.md) and original findings in the register.
- **Allowed scope:** Phase 7 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Explicit field/workflow guidance replaces heuristics across Markdown/HTML/PDF/screenshots/traceability, topic docs/schema/forms/README/recovery/install names. Describe plaintext files/exports, backup-time credentials and open/unlocked reminders.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Explicit field/workflow guidance replaces heuristics across Markdown/HTML/PDF/screenshots/traceability, topic docs/schema/forms/README/recovery/install names. Describe plaintext files/exports, backup-time credentials and open/unlocked reminders. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm guide:build && pnpm guide:verify && pnpm verify:visual`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending.

## P7-02 — Enforce production/harness and release dependency checks

- **Title:** Enforce production/harness and release dependency checks.
- **Context:** User remediation plan; [topic](../../docs/plan/08-release-process.md) and original findings in the register.
- **Allowed scope:** Phase 7 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Test Rust on Windows/macOS, retain Linux/Windows native journeys, review advisory/licenses, scan shipped binaries for harness content, configure offline WebView2 and document ZIP prerequisite. Unsigned/ad-hoc beta claims are accurate; no signing/updater guarantees.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Test Rust on Windows/macOS, retain Linux/Windows native journeys, review advisory/licenses, scan shipped binaries for harness content, configure offline WebView2 and document ZIP prerequisite. Unsigned/ad-hoc beta claims are accurate; no signing/updater guarantees. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `pnpm build && cargo test --manifest-path src-tauri/Cargo.toml --all-features && cargo audit`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Pending; installer checks require actual artifacts.

## P7-03 — Obtain supported-device and legal release evidence

- **Title:** Obtain supported-device and legal release evidence.
- **Context:** User remediation plan; [topic](../../docs/plan/08-release-process.md) and original findings in the register.
- **Allowed scope:** Phase 7 modules/tests and relevant docs; no dependent-phase feature work.
- **Requirements:** Final-revision artifacts pass Windows10/11, Intel/AppleSilicon macOS and shipped Linux checks; password-only Windows↔macOS disaster restore passes. Obtain Egyptian privacy review, notice/terms, release notes and support/install/recovery materials before publication.
- **Non-goals:** Cloud/network services, telemetry, unrelated domain changes, fabricated device/legal sign-off.
- **Data changes:** Only a new immutable numbered migration if needed; never edit `0001`.
- **Security considerations:** Rust owns DB/files; paths stay native behind IDs, logs exclude records/secrets/paths; disposable synthetic vaults for destructive checks.
- **Acceptance criteria:** Final-revision artifacts pass Windows10/11, Intel/AppleSilicon macOS and shipped Linux checks; password-only Windows↔macOS disaster restore passes. Obtain Egyptian privacy review, notice/terms, release notes and support/install/recovery materials before publication. Every linked scenario requires its own evidence; partial tests do not pass a full issue.
- **Tests:** Normal path, rejected input and failure/interruption preserving prior data; UI save/reload/clear and native/device checks wherever the linked source requires them.
- **Validation commands:** `docs/device-validation-runbook.md (physical/manual checklist)`. Final touched-code checks also include frontend format/lint/typecheck/build and Rust fmt/clippy in production/harness configurations.
- **Deliverables:** Reviewable code, applicable migration, regression tests, topic documentation and recorded evidence/risks.
- **Status:** Blocking external evidence; never replace with a mocked pass.
