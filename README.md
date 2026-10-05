<div dir="rtl">

# ليجال مصر

**مكتبك القانوني على جهازك.**

تطبيق مكتبي للمحامي المصري الفردي، يجمع الموكلين والقضايا والجلسات والمهام والأتعاب والمستندات في مكان واحد. كل شيء محفوظ على جهازك ومشفّر بكلمة مرورك، دون حساب ودون إنترنت.

- **يومك في شاشة واحدة:** جلسات اليوم بموعدها ومحكمتها وما تحتاج تحضيره، ومهامك المستحقة والمتأخرة، وجلسات الأيام القادمة.
- **ملف كامل لكل قضية:** رقم ملفك الداخلي ورقم الدعوى بالمحكمة («رقم 447 لسنة 2026»)، والموكلون والخصوم، والجلسات وقراراتها، والمستندات، والأتعاب.
- **من القرار إلى الجلسة القادمة في خطوة واحدة:** سجّل قرار الجلسة وتاريخ التأجيل معًا، فتظهر الجلسة الجديدة في الأجندة وملف القضية.
- **أتعابك واضحة:** المتفق عليه والمحصل والمتبقي لكل قضية، مع الدفعات والمصروفات بالجنيه المصري.
- **التوكيلات في مكانها:** رقم التوكيل ومكتب التوثيق والموكلون والمحامون المذكورون، والقضايا المرتبطة بكل توكيل.
- **خصوصية حقيقية:** قاعدة البيانات مشفّرة بكلمة مرورك، ولا تُرسل بيانات موكليك إلى أي جهة، والنسخ الاحتياطية مشفّرة وتحت تصرفك.
- **عربي أولًا:** واجهة عربية كاملة من اليمين إلى اليسار، وتواريخ ميلادية بأسماء الشهور المصرية، مع واجهة إنجليزية اختيارية.

ليجال مصر مصمم لأجهزة ويندوز وماك، وهو الآن في مرحلة ما قبل الإصدار التجريبي.

</div>

# Legal Masr

**Your law office, on your computer.**

A desktop app for the Egyptian solo lawyer that brings clients, cases, hearings, tasks, fees and documents together in one place. Everything stays on your computer, encrypted with your password, with no account and no internet required.

- **Your day on one screen:** today's hearings with time, court and what to prepare; tasks due and overdue; and the hearings coming up.
- **A complete file for every case:** your internal file number and the court case number ("No. 447 of 2026"), clients and opponents, hearings and their decisions, documents and fees.
- **From decision to next hearing in one step:** record the hearing decision and the postponement date together, and the new hearing appears in the agenda and the case file.
- **Clear fees:** agreed, received and outstanding for each case, with payments and expenses in Egyptian pounds.
- **Powers of attorney where you need them:** number, notary office, clients, named lawyers and the cases that use each one.
- **Real privacy:** the database is encrypted with your password, client data is never sent anywhere, and backups are encrypted and under your control.
- **Arabic first:** a full right-to-left Arabic interface with Gregorian dates and Egyptian month names, plus an optional English interface.

Legal Masr is designed for Windows and macOS and is currently pre-beta.

---

The sections below are for developers. The repository, crate and data-folder
names keep the original `legalmaster` identifiers so existing installations and
backups keep working.

## Current implementation

The canonical Legal Masr domain is implemented through migration
`0001_canonical_legal_masr.sql`: clients, powers of attorney, cases and their
client relationships/opponents, hearings, tasks, managed-copy attachments,
fee agreements, payments, expenses, reminders, local search, and aggregate
opt-in usage counters.

The application uses a Tauri 2 / React / TypeScript shell and a Rust-only
SQLCipher boundary. The UI is Arabic RTL by default, supports English as a
preference, keeps legal dates as `YYYY-MM-DD` values, and stores EGP values as
integer minor units. Native file selection/open/reveal happens through narrow
Rust commands; React does not access SQLite or arbitrary local paths.

Available privacy and recovery features include password/recovery-key vault
access, locking, local manual encrypted backups with checksum validation,
staged restore with rollback protection, backup history, native safe
reminders, optional autostart, and an in-app privacy/data-location screen.

## Known release blockers

This is not ready for a public beta. The following work remains:

- visual sign-off from fresh seeded application captures at 1440×900 and
  1366×768;
- repeated portable restore and native Windows/macOS runner/device validation;
- automatic backup/retention and restore preview;
- documented full-installation and case exports, permanent deletion, and a
  redacted support bundle.

See [the finalized correction plan](docs/finalized-domain-correction-plan.md)
and its [Phase 7 report](docs/finalized-domain-phase-7-report.md) for the
current decision record and evidence.

## Local development

```bash
pnpm install
pnpm tauri dev
```

For sanitized developer diagnostics in a development build only:

```bash
VITE_DETAILED_DIAGNOSTICS=true pnpm tauri dev
```

To populate a newly initialized, empty development vault with non-production
Arabic demo data through the same typed app APIs used by the UI, opt in at
launch:

```bash
VITE_SEED_DEMO_DATA=true pnpm tauri dev
```

The seeder runs only in a development build, skips every non-empty vault, and
does not create attachments or access SQLite from React. It is intended for
local visual and workflow testing only.

Diagnostics contain only a command name, stable error code, and allow-listed
implementation facts. They never contain legal records, document paths,
passwords, or encryption keys.

## Validation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all-features)
pnpm tauri build --debug --bundles deb
```

Format frontend and project files with `pnpm format`; format Rust with
`cd src-tauri && cargo fmt`.

## Security and data handling

The database master key is random and is wrapped separately for the password
and recovery key using Argon2id and authenticated encryption. Managed
attachments are normal local files protected by the operating-system account
and full-disk encryption; they are not individually application-encrypted.

See [docs/BUILDING.md](docs/BUILDING.md) for local build prerequisites,
[docs/RELEASING.md](docs/RELEASING.md) for the draft-release workflow, and
[docs/SIGNING_POLICY.md](docs/SIGNING_POLICY.md) for current signing policy.
