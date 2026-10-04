# Egyptian lawyers: workflows, competing software, and product opportunities

**Report date:** 2026-09-06 (Africa/Cairo)  
**Product:** LegalMaster Solo  
**Status:** Research and ideation; not an approved implementation phase  
**Research method:** Browserbase Search and Fetch, supplemented by sources inspected earlier in the same research conversation

## 1. Purpose and recommendation

LegalMaster Solo will be a free, Arabic-first, offline desktop application for
individual Egyptian lawyers. It should deliver useful daily work while creating
opportunities for voluntary feedback that can inform a later legal SaaS.

The strongest initial product hypothesis is:

> Lawyers will return to Solo if it reliably helps them prepare for tomorrow
> and finish today's follow-up.

The research suggests prioritising preparation, hearing decisions, next actions,
documents, and understandable financial records. Installation, migration, and
recovery deserve the same attention as new features.

Offline operation and avoiding subscriptions are already advertised by competing
products. LegalMaster should distinguish itself through a complete free solo
workflow, ease of adoption, Egyptian terminology, and demonstrated reliability.
This is a proposed positioning, not a validated competitive advantage.

The free product should remain useful for its intended audience. The later SaaS
should earn adoption through demonstrated needs for shared work, rather than
withholding essential recovery or export capabilities from Solo.

## 2. Evidence and limitations

The research examined Egyptian Bar Association guidance and reports, a public
user discussion, and vendor product pages. Browserbase Search returned URLs;
Fetch retrieved page contents. These operations did not require a browser
session. No competitor software was installed, no sales demonstrations were
attended, and no practitioners were contacted.

Evidence is classified as follows:

| Evidence type             | What it supports                                       | What it does not establish                                           |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Professional guidance     | Documented procedures and recommended practice         | How often every lawyer follows that practice today                   |
| Bar Association reporting | A reported event or local practical difficulty         | National prevalence or an independent economic assessment            |
| Public user account       | One person's reported experience and workaround        | A representative sample or independently verified identity           |
| Vendor page               | Advertised features, positioning, and displayed prices | Product quality, security, adoption, or actual customer satisfaction |
| Product inference         | A hypothesis derived from the evidence                 | A confirmed user requirement                                         |

Much of the practical guidance dates from 2020–2023. It informs workflow
discovery, not a verified catalogue of current legal requirements. Procedures
vary by practice area and court. No statutory deadline or fee calculator should
be implemented from these articles alone.

Vendor pages were inspected during the research session on 2026-09-06 local
time. Prices below are observations, not confirmed quotations. User counts,
testimonials, security claims, certification claims, and promised savings were
not independently verified. No reliable market-share estimate or representative
survey of Egyptian lawyers was established.

## 3. Workflows and problems

### 3.1 Preparation, attendance, and follow-up are connected

A Bar Association practice guide describes reviewing the file, preparing a
short **نوتة**, checking the court roll, attending, and recording the decision
in the case file, personal agenda, office agenda, and computer. It then describes
completing the required work before the next hearing. The note can also help a
colleague appearing on the original lawyer's behalf. [S1]

**Product inference:** Reduce repeated recording. One hearing-result workflow
should update case history and the agenda, with an optional next task.

Proposed sequence:

```text
Prepare the hearing → Record the decision → Set the next hearing, if any
                                        → Create the next action, if needed
```

A fictional example:

> القرار: التأجيل لتقديم مستندات  
> الجلسة القادمة: ٢٠ أكتوبر  
> المطلوب: استلام المستندات من الموكل قبل ١٠ أكتوبر  
> المتابعة: الاتصال بالموكل يوم ٧ أكتوبر

A preparation brief could show client and case identifiers, court/circuit,
previous decision, intended requests, required papers, and an optional roll
position. Keep **رقم الرول** distinct from **رقم القضية**. Test a printable
**كشف جلسات** grouped by court and circuit.

### 3.2 Administrative work needs follow-up outside hearings

Al Bayan Al Zahabi advertises court-service papers, submission and follow-up
dates, expert sessions, and non-litigation work such as company formation and
property-registration work. This is evidence of the workflows the vendor
considers commercially important, not a frequency estimate. [S5]

A 2021 Bar Association report on judicial-service digitisation describes papers
passing between the court registry, bailiffs' office, and serving officer,
followed by recording the result and returning it to the court file. The report
does not prove current nationwide deployment of that system. [S9]

**Product inference:** Existing client/case-linked tasks should accommodate
actions such as following up an announcement at **قلم المحضرين** or collecting
a document, without requiring a fictional hearing.

A dedicated announcement tracker or non-litigation matter module needs further
validation and explicit scoping. The current payment model requires a case;
non-litigation billing is therefore a domain decision, not just a new screen.

### 3.3 Waiting and uncertain timing affect the working day

A Bar Association report describes a Badrashin initiative to contact lawyers
when investigations were ready, addressing waiting in prosecution corridors.
This is a dated local example rather than evidence of nationwide waiting
times. [S2]

**Product inference:** The daily view should remain useful when exact times are
unknown. Grouping by location and showing the necessary papers may be more
useful than requiring every activity to have a precise appointment time.

### 3.4 Financial records must explain the agreed work and expenses

A Bar Association discussion of a fee dispute illustrates the importance of
the agreed scope and additional work outside that agreement. [S3]

An April 2025 Bar Association statement reports protests against increased
judicial-service charges. This documents a cost concern; it does not establish
average lawyer income or willingness to pay for software. [S4]

**Product inference:** Provide a readable statement of agreed fees, payments,
actual expenses, and outstanding amounts, with agreement and receipt
attachments. Make case-linked expense entry convenient. Do not label a balance
overdue unless its due date is recorded, or treat money held for a client as
earned fees.

### 3.5 Compatibility and migration can block adoption

In a 2023 forum discussion, an Egyptian participant identifying himself as a
legal adviser reported replacing an old law-office program that worked on
Windows XP/7 but not Windows 10/11. He also reported Office compatibility
problems with an alternative. This is one self-reported account. [S6]

**Product inference:** Straightforward installation, understandable support,
portable exports, and migration assistance could remove meaningful barriers.
An import wizard remains a proposed scope addition; preview, validation,
duplicate handling, and safe retry would be essential.

### 3.6 Digital copies do not track physical originals

Bar Association guidance about representation ending discusses returning
documents, papers already deposited, supplying copies, and a financial
statement. [S10]

**Product inference:** Managed attachments answer where the digital copy is.
An original-document register could answer who holds the original and whether
it was returned. Candidate information includes receipt date, custody status,
physical filing reference, and handover evidence. Validate demand before
expanding the schema.

## 4. Competing products

These are Egyptian or regional offerings with Egyptian-market signals.
Capabilities in this table are vendor claims, not tested behaviour.

| Product                         | Advertised offer                                                                                                                          | Commercial information observed                                                        | Lesson to investigate                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Qanoony Pro [S7]                | Cloud system; cases, hearings, tasks, finances, staff permissions, lawyer/client apps, training and support; an Egypt contact is provided | Packages and demo requests; no numeric price verified                                  | Firms may buy coordination, client communication, and onboarding support together                               |
| Professional Legal A [S8]       | Desktop/mobile/browser access; local-server or external hosting options; branch permissions, reminders, document borrowing, backups       | Advertises one-time ownership without monthly/yearly subscriptions; quotation required | Data control and avoiding subscriptions are already competitive messages; physical handovers are worth studying |
| Al Bayan Al Zahabi [S5]         | Detailed hearing agenda, experts, court-service papers, daily administrative work, associated expenses, printable reports                 | No price verified; older page footer means current availability needs confirmation     | Egyptian workflow detail extends beyond a generic case calendar                                                 |
| Al-Mohamy Pro [S11]             | Windows application, offline/local storage, hearing roll, POAs, tasks, expenses, printable outputs                                        | Advertises EGP 5,000 permanent licence and a four-day trial                            | Closest overlap with Solo's offline/no-subscription positioning                                                 |
| El-Mostanad — Scheme Code [S12] | Client files/history, employee permissions, accounts, customisation; vendor lists a Cairo address                                         | Page displays EGP 15,000; licence duration and included services unclear               | Some buyers seek implementation and customisation as well as software                                           |

A Mizan download page appeared in search results advertising a free program.
Its content fetch returned HTTP 429. Licence, provenance, and capabilities
remain unverified, so it is excluded from the substantive comparison. [S13]

### Implications for positioning

- Hearing agendas, financial records, reminders, and printed reports recur
  across the inspected offers. They are candidate baseline expectations.
- Offline operation and one-time payment already have competitors.
- Training and support are explicitly marketed. Ease of adoption deserves
  validation alongside feature demand.
- Mobile access, client apps, permissions, and branch coordination are useful
  SaaS discovery topics, but remain outside the current Solo scope.
- Feature repetition and vendor testimonials do not establish actual use or
  satisfaction. Avoid treating the largest feature list as the winning design.

## 5. Implications for the current project

The earlier source review in this conversation found that the core entities
already exist. See [frontend architecture report](frontend-architecture-report.md),
[functional modules](plan/04-functional-modules.md), and
[existing technical findings](review-2026-09-05.md).

Specific observations from that review:

- Today renders today's hearings and tasks but does not render the upcoming
  hearings described in the report; hearing entries lack case/client context.
- Dashboard query failures can be presented like an empty schedule.
- The hearing decision form already supports a decision and optional next
  hearing, but not a next task in the same workflow.
- The case overview is sparse; related records are distributed across tabs.
- Case creation lists clients as checkboxes, which may become cumbersome as
  the list grows.
- Current attachments track managed digital copies, not physical custody.

These observations were based on source inspection, not a fresh usability
session. The earlier run passed 37 frontend tests across 13 files. That result
does not validate the proposed features, competitor claims, desktop usability,
or public-beta readiness.

### Proposed priorities

| Priority                | Improvement                                                                  | Validation question                                               | Scope status                                                           |
| ----------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Before public beta      | Installation, cross-device recovery, exports, and existing security fixes    | Can a lawyer adopt and recover the app without technical help?    | Existing release obligations; all current blockers still apply         |
| First product increment | Today/tomorrow preparation view and printable hearing sheet                  | Does it replace a real preparation step?                          | UI/output proposal requiring scoped acceptance criteria                |
| First product increment | Decision → next hearing → follow-up task                                     | Does it reduce repeated entry or forgotten work?                  | Extension of existing workflow; define transaction and retry behaviour |
| Next                    | Case overview with latest decision, next action, required documents, balance | Can the lawyer prepare or answer a client question quickly?       | Presentation proposal                                                  |
| Next                    | Readable client statement and convenient expense entry                       | Does it reduce effort explaining fees and expenses?               | Presentation/output proposal; preserve existing money rules            |
| Validate first          | Original-document custody and structured announcement follow-up              | Are notes inadequate frequently enough to justify more structure? | Potential domain additions                                             |
| Validate first          | Import assistance and non-litigation work                                    | What records and workflows prevent adoption?                      | Potential domain/import additions                                      |

Do not represent these as completed work or an approved roadmap. The
[current roadmap](plan/10-roadmap-and-phases.md) remains authoritative.

### Boundaries

Keep the free product Arabic-first, offline, and suitable for one lawyer on one
computer. Preserve RTL behaviour, integer minor-unit money, and timezone-free
date-only values. Rust remains responsible for business rules and privileged
operations; React does not gain database or arbitrary filesystem access.

No cloud service, telemetry, or automatic case-data collection is proposed for
Solo. Browserbase was used as a research tool, not added to the application.

Statutory deadline calculation, AI legal advice, court integrations, full
accounting, mobile apps, client portals, and team permissions are outside this
iteration. Any future implementation must follow the contribution rules,
including numbered immutable migrations and normal/failure-path business tests.

## 6. Learning from Solo for a later SaaS

### Product relationship

Keep core records, search, reminders, backup, restore, and export free for the
intended solo workflow. Offer a later SaaS around validated shared-work needs:
concurrent access, assignment, permissions, review, central administration, and
controlled client communication.

Solo-user enthusiasm does not validate firm purchasing demand. Some solo users
will never want cloud software. Run a separate research track with small-office
decision-makers and learn how they coordinate, purchase, migrate, and evaluate
confidentiality requirements.

Do not build future firm abstractions into Solo merely to prepare for SaaS.
Documented data portability can preserve a migration path without expanding
the current architecture prematurely.

### Proposed four-week pilot

This is a suggested experiment, not a recruited cohort or a completed study.

1. Recruit 8–12 solo lawyers across civil, family, and criminal work, with
   varied technical comfort. Separately interview 3–5 small-office
   decision-makers about collaboration.
2. Observe installation and one realistic workflow using fictional or redacted
   information. Record where help is required and what users expect next.
3. Check in after one week and four weeks: what was used, what stayed on paper,
   what required support, and what caused abandonment?
4. Record each problem's trigger, existing workaround, frequency, consequence,
   and supporting example before suggesting a feature.
5. Choose one repeated problem, prototype an improvement, and return to the
   same participants to see whether it helps.

Suggested interview prompts:

- Walk me through preparing for your last court day.
- Where did you record the decision afterward?
- Show me how you track an announcement awaiting a result.
- How do you know who holds an original document?
- How do you explain a remaining balance to a client?
- What would happen if your laptop stopped working tonight?
- What does your current tool do well enough that you would not replace it?
- For office owners: tell me about the last time two people needed to update
  the same file. What happened, and what did it cost in time or rework?

### Feedback collection and success signals

Use optional interviews and a user-initiated support route. An external feedback
page could be reached through the permitted support website; automatic
submission from the app would require separate product/privacy review.

Collect problem descriptions rather than client files. Any submitted diagnostic
material should be previewed and redacted. Contact consent should be separate
from the feedback itself and from any SaaS-interest list. Do not require an
account or marketing consent to use Solo.

Useful pilot signals, collected through observation and voluntary follow-up:

| Signal                                                      | How to collect it                        | Interpretation                                          |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| First client and case created without help                  | Observed setup task                      | Tests the existing ten-minute activation goal           |
| Hearing outcome and next action recorded correctly          | Fictional task and subsequent interview  | Tests the central daily workflow                        |
| Continued use at weeks one and four                         | Voluntary participant report             | Early retention signal, not population-wide telemetry   |
| Paper/Excel steps still required                            | Walkthrough of a redacted working day    | Identifies missing or inconvenient workflows            |
| Successful recovery on another computer                     | Controlled disaster exercise             | Tests a release-critical promise                        |
| Support time per participant                                | Research/support notes without case data | Tests whether free distribution is sustainable          |
| Repeated shared-work problem and commitment to a SaaS pilot | Separate office-owner interviews         | Stronger demand evidence than a generic feature request |

Maintain a feedback register with an anonymous participant code, practice area,
task, problem, workaround, frequency, consequence, proposed experiment, and
outcome. Keep optional contact details separately. Avoid storing identifying
case examples, document paths, credentials, or unredacted screenshots.

## 7. Open questions and decisions

- Which initial practice area gains the most from the current domain model?
- Is a printed daily sheet sufficient for court work, or is desktop-only access
  a major adoption barrier for the intended users?
- Which migration formats actually occur: Excel, Access, paper, or other tools?
- Do lawyers need structured announcement and original-document tracking, or
  are well-designed tasks and notes sufficient?
- What support effort can a free product sustain?
- Which office collaboration problems justify paying for a SaaS, and who makes
  that purchasing decision?
- What are competitors' actual export, restore, support, and licence terms?
  Public pages are insufficient to settle these questions.

Recommended next decision: define acceptance criteria for the first daily
workflow prototype and the pilot, while continuing to close existing beta
blockers. No implementation or external outreach is authorised by this report.

## 8. Sources

### Professional practice and user evidence

- **S1 — Egyptian Bar Association, “مبادئ العمل بالمحاماة,” 1 July 2020.**
  Preparation notes, court roll, recording decisions, and follow-up.
  <https://egyls.com/مبادئ-العمل-بالمحاماة/>
- **S2 — Egyptian Bar Association, investigation-attendance report, 16 January 2020.**
  Local Badrashin waiting/notification initiative; not a national survey.
  <https://egyls.com/دفتر-حضور-التحقيق-انطلاقة-لراحة-أصحا/>
- **S3 — Egyptian Bar Association, discussion of Article 82 and fee agreements,
  27 December 2021.** Scope and additional-work dispute; discusses an older judgment.
  <https://egyls.com/تعليق-محكمة-النقض-على-المادة-82-من-قانون/>
- **S4 — Egyptian Bar Association, statement on court-fee protests, 28 April 2025.**
  Professional body's account of objections to judicial-service charges.
  <https://egyls.com/239470-2/>
- **S6 — Officena, law-office software discussion, 3–5 May 2023.**
  Self-reported Windows/Office compatibility and replacement difficulties.
  <https://www.officena.net/ib/topic/119166-مشروع-برنامج-مكتب-المحامى-هل-من-مساعده-من-أهل-الخبرة/>
- **S9 — Egyptian Bar Association, judicial-service digitisation report,
  10 November 2021.** Procedure example; deployment coverage not established.
  <https://egyls.com/تفاصيل-مشروع-وزارة-العدل-لميكنة-مراسل/>
- **S10 — Egyptian Bar Association, documents/accounts at representation ending,
  20 January 2022.** Inspected earlier in this research conversation.
  <https://egyls.com/ما-يجب-أن-يقدمه-المحامي-إلى-موكله-عند-ان/>

### Vendor pages

- **S5 — TSoft, Al Bayan Al Zahabi.** Features; publication date not established.
  <https://tsoft-it.com/frmlawyersystem.aspx>
- **S7 — Qanoony Pro, landing page and FAQ.** Cloud positioning, packages,
  permissions, mobile/client apps, training, and support.
  <https://www.qanoony.pro/lander> and <https://www.qanoony.pro/faq>
- **S8 — Professional Legal A.** Ownership, deployment options, reminders,
  document borrowing, and backup claims.
  <https://professionallegala.com/>
- **S11 — Al-Mohamy Pro.** Offline Windows product and advertised EGP 5,000
  permanent licence/four-day trial.
  <https://mohamy.shop/>
- **S12 — Scheme Code, El-Mostanad.** Features and displayed EGP 15,000 price.
  <https://schemecode.com/en/products/Lawyer-Management-System-%28El-Mostanad%29>
- **S13 — Mizan download listing, search metadata dated 14 March 2026.**
  Search result only; content fetch blocked with HTTP 429. Excluded from
  verified feature/pricing comparisons.
  <https://www.myeg-soft.com/2026/03/mizan-law-office-management-software.html>
