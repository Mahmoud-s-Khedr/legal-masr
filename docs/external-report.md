Yes. With the constraint now explicit—**one Egyptian lawyer, one computer, completely free, completely offline, no external APIs**—I would define LegalMaster Solo very differently from a general “law-firm management system.”

The product should essentially replace the solo lawyer's **secretary + agenda + case notebook + archive cabinet + simple bookkeeper**, while staying fast and trustworthy on ordinary hardware. That framing also matches how mature solo-practice products describe the problem: the solo lawyer has to handle matter management, calendaring, documents and billing without support staff. ([smokeball.com][1])

For Egyptian litigation specifically, the Bar's own workflow strongly reinforces preparation → رول → attendance → decision → next hearing → required follow-up. ([نقابة المحامين المصرية][2])

So this is the **full feature universe I think makes sense for LegalMaster Solo**.

I’ll use:

- **P0** = fundamental Solo feature
- **P1** = very valuable
- **P2** = useful / practice-dependent
- **Optional** = nice, but don't complicate the core
- **No** = deliberately exclude from this product

---

# 1. Today / Tomorrow command center — P0

This may become the most important screen in the application.

The lawyer opens LegalMaster and immediately sees:

### Today

- today's hearings
- today's legal procedures/work
- today's appointments
- today's tasks
- deadlines today
- overdue tasks
- overdue follow-ups
- payments expected today
- documents expected today
- POAs/documents expiring soon

### Tomorrow

Same concept:

- tomorrow's hearings
- tomorrow's procedures
- tomorrow's tasks
- required documents
- what needs preparation
- court/circuit
- roll number if known
- previous decision
- requested action

### Upcoming

- next 7 days
- next 30 days
- upcoming deadlines
- upcoming hearings
- POA expirations
- company-document expirations
- expected fee installments

### Quick actions

- new client
- new case
- new hearing
- record hearing result
- new task
- new legal activity
- new payment
- new expense
- attach document

I would make this screen answer:

> **What do I need to care about now?**

rather than merely display statistics.

---

# 2. Lawyer agenda / calendar — P0

One unified calendar for everything.

It should contain:

- hearings
- legal activities/procedures
- tasks
- deadlines
- client meetings
- consultations
- payment dates
- POA expiry
- document expiry
- reminders

Views:

- day
- week
- month
- agenda/list
- court-day view

Filters:

- hearings only
- court/prosecution/expert work
- client
- case
- completed
- pending
- deadline type

Important: **do not require a time for everything**.

A lawyer may know:

> نيابة شبين الكوم — الثلاثاء

without knowing 09:30.

Your other report made an excellent point here: location/grouping can be more meaningful than an artificial exact appointment time.

---

# 3. Hearing-roll / court-day mode — P0

I would make this a first-class feature.

Egyptian practice guidance explicitly discusses reviewing the court roll and recording the matter's roll position before the hearing; local competitors independently emphasize daily and weekly hearing rolls. ([نقابة المحامين المصرية][2])

For each hearing:

- roll number
- case number
- court
- circuit
- client
- opponent
- client's capacity
- last hearing
- last decision
- next requested action
- documents required
- notes for pleading
- hearing time, if applicable

Then support:

### Daily court sheet

Grouped by:

```text
Court
  Circuit
    Roll #4 — Case...
    Roll #18 — Case...
```

### Print

- A4 print
- compact print
- PDF
- office name/logo
- date
- perhaps blank space for handwritten decisions

That last one is especially nice.

The lawyer could print tomorrow's roll, physically write on it in court, then enter results later.

---

# 4. Hearing preparation / نوتة الجلسة — P0

A hearing shouldn't merely be:

```text
date
court
notes
```

Have an optional **Preparation** section:

- previous decision
- requested documents
- documents available/missing
- intended requests
- legal points
- opponent's previous requests
- witnesses needed
- amounts/fees that need paying
- memo/document to submit
- private preparation notes

This aligns extremely closely with the workflow described by the Egyptian Bar. ([نقابة المحامين المصرية][2])

One button:

> **Prepare for hearing**

could assemble the relevant information automatically from the case.

No AI required.

---

# 5. Record hearing result — P0

This should be one extremely polished workflow.

After the hearing:

### Record

- decision
- decision category
- hearing notes
- judgment issued?
- documents submitted
- documents received
- expense incurred
- next hearing?
- follow-up required?
- client should be updated?

Then allow:

```text
Record decision
      ↓
Create next hearing
      ↓
Create required follow-up task
      ↓
Record expense
```

without reopening four pages.

The Bar guidance specifically describes recording the court decision and then following up what must be done before the next hearing. ([نقابة المحامين المصرية][2])

This may be one of LegalMaster's signature interactions.

---

# 6. Client management — P0

## Individual

- Arabic full name
- English name optionally
- National ID optionally
- phone numbers
- WhatsApp number
- email
- address
- occupation
- notes
- preferred contact method
- tags
- archive status

## Company

- company name
- trade name
- legal form
- commercial registration
- tax number
- address
- phone/email
- authorized representatives
- contact persons
- notes

## Client page

Show:

- active cases
- closed cases
- consultations
- POAs
- documents
- tasks
- upcoming hearings
- legal activities
- account balance
- fee agreements
- payments
- expenses
- notes
- timeline

### Duplicate detection — P0

Check:

- same National ID
- same phone
- same company registration
- similar names

You already have probable duplicate handling. Keep it.

---

# 7. General contacts / parties directory — P1

Don't make every human being a client.

Create reusable contacts for:

- opponent
- opposing lawyer
- witness
- expert
- company representative
- arbitrator
- consultant
- other legal contact

Then one person can participate in several cases.

Useful fields:

- name
- type
- phone
- address
- office
- notes
- cases they appear in

This also makes **conflict checking** significantly stronger.

---

# 8. Conflict checking — P1

A solo lawyer absolutely can need this.

When creating a new client or matter, search:

- clients
- opponents
- opposing lawyers
- related parties
- company representatives
- archived clients
- notes if desired

Example:

> أحمد محمد عبد الله appears as an opponent in 2 previous matters.

No AI needed.

Clio also treats firm-wide conflict checking across contacts and matter-related records as a core legal client-management capability. ([Clio][3])

---

# 9. Case management — P0

Core case fields:

- internal case ID
- official case number
- year
- court
- circuit
- jurisdiction
- case type
- subtype
- subject
- description
- filing date
- current status
- current litigation stage
- client(s)
- client legal capacity
- opponent(s)
- opposing lawyers
- related POA
- notes

And relations to:

- hearings
- activities
- tasks
- deadlines
- judgments
- documents
- money
- contacts

---

# 10. Litigation stages — P1, close to P0

Do not assume one case has one immutable number/status forever.

Model stages such as:

- first instance
- appeal
- cassation
- retrial if relevant
- execution/enforcement
- other configurable stage

Each stage may have:

- case number
- year
- court
- circuit
- start date
- end date
- result
- judgment
- notes

Al-Mohamy Pro currently explicitly advertises tracking litigation through first instance, appeal, cassation and enforcement. ([برنامج المحامي][4])

This gives you much better legal history.

---

# 11. Case overview — P0

This should be incredibly good.

At the top:

```text
Case
Client
Opponent
Court / Circuit
Current stage
Status
```

Then answer immediately:

### What happened last?

> Last hearing: 2 September
> Decision: Adjourned for submission of documents.

### What's next?

> Hearing: 19 September
> Prepare memorandum before 17 September.

### What's missing?

> 2 required documents not received.

### Money

> Agreed: 15,000 EGP
> Paid: 10,000
> Remaining: 5,000
> Expenses: 1,450

### Important warnings

> POA expires in 42 days.

This is much more useful than dumping information across tabs.

---

# 12. Case timeline — P1

One of my favorite additions.

Chronologically combine:

- case creation
- litigation stage changes
- hearings
- decisions
- judgments
- legal procedures
- tasks completed
- documents added
- payments
- expenses
- notes
- POA events

Example:

```text
04 Jan   Case opened
11 Jan   Statement filed
20 Jan   Bailiff notice submitted
28 Jan   Hearing
         Adjourned for expert assignment
04 Feb   Expert office follow-up
22 Feb   Expert session
15 Mar   Expert report deposited
19 Mar   Hearing
04 Apr   Judgment
```

This is how a lawyer thinks about:

> “What happened in this case?”

---

# 13. Legal activities / procedures — P1

I still strongly recommend this concept.

Egyptian products repeatedly distinguish hearings from administrative/legal work, experts, prosecution, bailiffs and execution. ([برنامج المحامي][4])

Possible types:

- expert session
- expert-office follow-up
- expert report
- prosecution investigation
- police report
- police-station follow-up
- bailiff/service procedure
- filing
- court registry work
- document retrieval
- enforcement procedure
- opposition
- appeal filing
- cassation filing
- notary work
- real-estate registry
- commercial registry
- government office
- company incorporation procedure
- client meeting
- consultation
- other

Fields:

- type
- case/client
- authority/place
- date
- optional time
- status
- description
- result
- next action
- next follow-up date
- expense
- attachments

Crucially:

**custom types**.

Don't try to encode every Egyptian legal procedure into your schema.

---

# 14. Judgments / rulings — P1

Separate from ordinary hearing notes.

Record:

- judgment date
- judgment type
- operative result
- full notes
- stage
- in-person/default/etc. where applicable
- judgment document
- appealable?
- appeal deadline entered by lawyer
- appeal filed?
- resulting stage

A judgment is important enough to deserve structure.

---

# 15. Deadlines — P0/P1

Make **deadline** a distinct concept from task.

Examples:

- appeal deadline
- document-submission deadline
- expert-report deadline
- fee installment
- POA expiry
- company-document expiry
- contractual deadline
- custom deadline

Fields:

- title
- due date
- related case/client/POA
- source/reason
- notes
- reminder schedule
- completed/satisfied
- related task

## Important distinction

### Deadline

> آخر ميعاد للطعن: 15 أكتوبر.

### Task

> إعداد صحيفة الاستئناف.

They're connected but aren't the same thing.

---

# 16. Automatic statutory deadline calculation — not initially

I'd support:

> lawyer manually enters a deadline

and perhaps generic date calculations like:

> +15 days
> +30 days

But I would **not initially have LegalMaster claim legal accuracy by saying “the statutory appeal deadline is X.”**

That becomes legal-domain logic that needs constant maintenance, jurisdiction/practice-area understanding and updates.

Could come later as a clearly maintained module.

---

# 17. Tasks / follow-up — P0

Expand your existing task model slightly.

Fields:

- title
- details
- notes
- due date
- optional time
- priority
- reminder
- status
- client
- case
- hearing
- activity
- deadline
- attachments

Statuses:

- pending
- completed
- cancelled

Potentially:

- waiting

because legal work often becomes:

> waiting for client/document/expert/authority.

### Views

- Today
- Overdue
- Upcoming
- Waiting
- Completed
- All

### Recurring tasks — P2

For administrative reminders:

- monthly
- yearly
- custom recurrence

---

# 18. Task templates / procedural checklist library — P1

This could save a solo lawyer a lot of typing.

Examples created by the lawyer:

> File appeal

creates:

- prepare documents
- obtain copy of judgment
- prepare pleading
- pay fee
- file
- confirm case number

Or:

> New corporate client

creates custom checklist.

Competitors also advertise ready-made litigation task templates, but you can do this entirely deterministically/offline. ([برنامج المحامي][4])

Let lawyers create their **own templates**.

---

# 19. Appointments / consultations — P1

A solo lawyer still manages prospective and existing-client meetings.

Record:

- person
- phone
- date/time
- topic
- consultation fee
- notes
- documents brought
- outcome

Possible outcome:

- no action
- follow-up
- became client
- create case
- create non-litigation matter

You do not need a CRM sales pipeline.

Just a useful consultation log.

---

# 20. Non-litigation matters — P1/P2

Not everything a lawyer does is a lawsuit.

Examples:

- contract drafting
- legal opinion
- company formation
- property registration
- negotiations
- due diligence
- administrative proceeding
- legal consultation

Instead of forcing these into fake “cases”, consider a broader:

```text
Matter
├── Litigation Case
└── Non-Litigation Matter
```

This is architecturally elegant, although I wouldn't necessarily refactor before beta.

---

# 21. Powers of attorney — P0

You already have this. Deepen it.

Fields:

- internal ID
- official number
- issuing authority
- issue date
- POA type
- client(s)
- lawyer(s)
- related cases
- description
- powers/scope
- valid from
- expiry date
- no expiry
- revoked
- revocation date
- notes
- scanned copy
- physical original status

### Alerts

- expires in 90 days
- 30 days
- 7 days

POA-expiry tracking is directly advertised by local offline competitors. ([برنامج المحامي][4])

---

# 22. Company/legal-entity document tracking — P2

Only useful for relevant practice areas, so hide it unless enabled.

Track:

- commercial registration
- tax card
- licenses
- articles/incorporation docs
- association/chamber documents
- issue date
- expiry date
- reminder
- attachment

Local systems explicitly advertise this because corporate lawyers apparently encounter it often enough to productize it. ([برنامج المحامي][4])

---

# 23. Document archive — P0

You already have managed attachments.

Make the document system richer:

- file
- display name
- category
- description
- document date
- tags
- owner
- case/client/POA/activity
- created date
- source
- notes

Categories might include:

- pleading
- memorandum
- judgment
- hearing document
- evidence
- contract
- POA
- receipt
- invoice
- identification
- expert report
- correspondence
- other

---

# 24. Built-in document preview — P1

Very useful.

Preview locally:

- PDF
- image
- text

Possibly office formats through OS opening instead of building complex renderers.

Don't turn LegalMaster into LibreOffice.

---

# 25. Physical-original document register — P2

I would include it eventually, probably optional.

For important originals:

- description
- owner/client
- received date
- received from
- physical storage location
- current holder
- handed out date
- expected return date
- returned date
- handover notes
- receipt/evidence attachment

Professional Legal A explicitly advertises tracking borrowed POAs/documents outside the office. ([التحول الرقمي لمكاتب المحاماة][5])

That's quite relevant to a solo practice even without employees: documents may be with the lawyer, client, expert, another lawyer, authority, etc.

---

# 26. Document templates — P1

This is probably more useful than an AI drafting assistant.

Let the lawyer create Word/HTML-like templates containing:

```text
{{client.name}}
{{client.national_id}}
{{case.number}}
{{case.year}}
{{case.court}}
{{case.circuit}}
{{opponent.name}}
{{hearing.date}}
{{lawyer.name}}
```

Then:

> Generate document

could produce:

- letter
- client statement
- standard petition
- receipt
- engagement agreement
- cover page
- case summary
- hearing sheet

Completely offline.

Completely deterministic.

Fast.

No hallucinations.

Smokeball strongly emphasizes this exact automation approach for solos: use matter data to auto-fill repetitive legal documents. ([Smokeball][1])

---

# 27. Personal template/library archive — P1

Separate from case documents.

A lawyer develops valuable reusable material over years:

- pleading templates
- standard clauses
- contracts
- memoranda
- forms
- letters
- procedural checklists
- preferred wording

Provide:

```text
My Library
```

with:

- folders/categories
- tags
- search
- favorites
- description
- editable copy
- generate from template

This can become extremely valuable without any cloud or AI.

---

# 28. Notes — P0

Allow notes at several levels:

- client note
- case note
- hearing note
- activity note
- private general note

Support:

- pinned note
- date
- tags
- rich text or simple formatting
- attachments

And optionally:

# Quick Notes / Inbox

The lawyer writes:

> اتصل بأحمد بخصوص قضية 234

then organizes it later.

Very useful for chaotic daily work.

---

# 29. Finance — P0

The goal is **legal-office money tracking**, not QuickBooks.

## Fee agreement

- agreed fee
- agreement date
- fee model
- notes
- attachment
- case/matter

Fee models could be:

- fixed
- installments
- hourly
- percentage
- custom

## Payment schedule

- installment
- expected date
- amount
- status

## Payments

- amount
- date
- payer
- case
- payment method
- notes
- receipt number

## Expenses

- amount
- date
- category
- client
- case
- activity/task
- notes
- receipt attachment

Categories:

- filing fee
- photocopies
- transport
- expert
- bailiff
- court fee
- stamps
- other

---

# 30. Client financial statement — P0

This should be printable and understandable by a normal client.

```text
Agreed legal fees           15,000
Paid                         8,000
Remaining                    7,000

Case expenses:
  Filing                        550
  Bailiff                       120
  Copies                         80
                              -----
Total expenses                  750
```

Allow:

- date range
- one case
- all client cases
- include/exclude detailed expenses

Local offline products explicitly advertise fee schedules, actual expenses, payments, outstanding balances and PDF statements. ([برنامج المحامي][4])

---

# 31. Receipts — P0/P1

Generate printable receipts.

Fields:

- receipt number
- client
- amount
- date
- payment method
- purpose
- case
- lawyer details

PDF/print.

No accounting system required.

---

# 32. Office expenses — P2

Because a solo lawyer also runs the office:

- rent
- electricity
- Internet
- stationery
- transportation
- subscriptions
- equipment
- other

Potentially separate:

```text
Client/case expense
vs.
Office operating expense
```

Then simple monthly report.

Useful, but not important enough to complicate beta.

---

# 33. Full accounting — No

Don't add:

- general ledger
- double-entry accounting
- balance sheet
- chart of accounts
- payroll
- depreciation
- accounts payable

That's an accounting product.

---

# 34. Time tracking — Optional/P2

Useful for some commercial lawyers.

Less useful for many litigation-focused Egyptian solos.

Support eventually:

- start/stop timer
- manual time entry
- case
- activity
- description
- billable/non-billable
- hourly rate

But make the entire feature optionally disabled.

Don't put a timer in every lawyer's face.

---

# 35. Search — P0

This can become one of LegalMaster's killer features.

Global search should find:

- client name
- phone
- National ID
- company
- case number
- internal file number
- opponent
- opposing lawyer
- court
- circuit
- POA
- hearing
- judgment
- activity
- notes
- document filename
- eventually document contents

### Filters

```text
Clients
Cases
Hearings
Documents
POAs
Activities
Tasks
```

---

# 36. Full-text search without AI — P1

You already use SQLite/SQLCipher.

SQLite FTS5 provides efficient local full-text search, including prefix, phrase, boolean, proximity and relevance-ranked queries. ([SQLite][6])

This means you can potentially search:

> "عقد بيع ابتدائي"

across:

- case notes
- hearing decisions
- activity notes
- extracted document text

with **zero network and zero LLM**.

This is exactly the kind of “smart feature” I want in Solo.

---

# 37. Reporting / printing center — P0/P1

This deserves its own area.

Reports:

### Daily

- today's work
- tomorrow's work
- hearing roll
- court sheet
- overdue work

### Case

- case summary
- complete case history
- hearing history
- timeline
- upcoming actions
- documents list
- financial statement

### Client

- client profile
- cases
- case-status report
- upcoming hearings
- financial statement
- documents

### Finance

- payments
- expenses
- unpaid amounts
- installments
- monthly income
- monthly expenses

### POA

- expiring POAs
- POAs by client
- inactive/revoked

### Documents

- physical originals currently outside
- missing/requested documents

Outputs:

- print
- PDF
- CSV where appropriate

Local competitors repeatedly advertise printable hearing rolls, case summaries and financial reports, so this is a strong Egyptian-market requirement rather than merely enterprise reporting. ([برنامج المحامي][4])

---

# 38. Client-friendly status report — P1

This is my alternative to a client portal for Solo.

One click:

> Generate client update

Output:

```text
Case: 1234/2026
Latest hearing: 4 September
Decision: ...
Next hearing: 19 September
Required from client:
- Copy of ...
- Original ...

Financial balance: ...
```

PDF or copyable text.

No server.

No login.

No portal.

---

# 39. Offline communication helpers — P1

Because you don't want external APIs:

LegalMaster should **prepare communication**, not deliver it.

Examples:

### Copy WhatsApp message

```text
الأستاذ أحمد،
نحيط سيادتكم بأن جلسة اليوم...
الجلسة القادمة بتاريخ...
والمطلوب...
```

Button:

> Copy

The lawyer pastes it into WhatsApp.

Potentially:

> Open WhatsApp

using a standard external URL/application handler with pre-filled text, but **LegalMaster itself does not call an API or send data to your server**.

Same concept for:

- client hearing result
- fee reminder
- document request
- appointment reminder

This gets much of the value of competitor WhatsApp automation without building cloud infrastructure. Competitors clearly regard these communications as useful—the Egyptian Professional Legal A, for example, markets daily WhatsApp reminders for hearings, administrative work and experts. ([التحول الرقمي لمكاتب المحاماة][5])

---

# 40. Contacts/address book — P1

Since it's offline, maintain a small legal address book:

- clients
- other lawyers
- experts
- courts
- prosecution offices
- police stations
- notaries
- expert offices
- other authorities

Potential fields:

- name
- type
- address
- phone
- notes

And allow quick association with activities/cases.

---

# 41. Court / circuit / authority dictionaries — P1

Avoid entering:

> محكمة شبين الكوم الابتدائية

300 times.

Maintain reusable:

- courts
- circuits
- prosecution offices
- expert offices
- police stations
- notaries
- authorities

Autocomplete.

Allow custom entries.

---

# 42. Import / migration — P1

If you want adoption, this is much more important than AI.

Support progressively:

### CSV / Excel

Import:

- clients
- cases
- contacts

With:

- preview
- column mapping
- validation
- duplicate detection
- error report
- rollback

### Existing LegalMaster backup

Obviously.

### Maybe Access/other programs later

Only after discovering what lawyers actually use.

---

# 43. Export / data ownership — P0

Offline/free software must never trap the lawyer.

Export:

- clients
- cases
- hearings
- activities
- tasks
- finance
- POAs
- metadata
- documents

Formats:

- CSV
- JSON
- PDF reports
- complete portable LegalMaster archive

The lawyer should always be able to leave.

---

# 44. Backup — P0, release critical

This matters more than another ten features.

### Manual backup

- create encrypted backup
- choose destination

### Automatic local backup — P0/P1

For example:

- every day
- on exit
- keep last N backups

Possible destinations:

- second folder
- USB
- external drive

No cloud connection from LegalMaster.

### Backup status

> Last successful backup: Yesterday 18:42

### Warnings

> No backup has been created for 14 days.

---

# 45. Restore — P0

Must be extremely safe.

- select backup
- verify integrity
- show backup metadata
- created date
- app/database version
- number of records if possible
- confirm
- restore
- relock

And test:

> restore to a completely different PC.

Your research report correctly puts cross-device recovery before additional product features.

---

# 46. Backup history — P1

Show:

- date
- size
- status
- manual/automatic
- verified?
- location label without exposing unsafe paths unnecessarily

And retention:

> Keep last 30.

---

# 47. Security — P0

Your existing architecture is already serious here.

Keep:

- encrypted SQLCipher vault
- password
- recovery key
- manual lock
- automatic inactivity lock
- no network access
- managed attachments
- safe error messages

Add/ensure:

- clear renderer cache on lock
- lock reliably on sleep
- protect pending file handles/tokens
- atomic DB migrations
- integrity checks
- secure temporary files
- encrypted backup
- safe deletion where feasible

Those renderer-lock issues are already documented in your current implementation review.

---

# 48. Privacy dashboard — P1

Since privacy can be a selling point:

```text
Your data is stored:
Local computer only

Internet connection:
Not required

Cloud account:
None

Telemetry:
Disabled / None

Last backup:
...

Database:
Encrypted
```

This is partially marketing, partially reassurance.

Al-Mohamy Pro explicitly markets local encrypted/offline storage as a competitive feature. ([برنامج المحامي][4])

---

# 49. Password / recovery workflow — P0

Must be idiot-proof.

- setup
- password
- recovery key
- explain recovery key
- printable recovery sheet
- confirm user saved it
- password change
- recovery process

Never depend on your company server to reset passwords.

Because offline means **you cannot save them**.

---

# 50. Installation / updates — P0

The installer matters.

- simple installer
- no database installation
- no server
- no command line
- no admin gymnastics unless unavoidable
- automatic DB migration
- clear version number

For updates:

The app can remain **fully operational offline** while updates themselves are manually installed.

I would not make an Internet connection part of normal application behavior.

---

# 51. Customization — P1

Lawyers use different terminology and workflows.

Allow:

- default language
- theme
- date format
- first day of week
- default reminder
- office/lawyer profile
- office logo
- custom task types
- custom activity types
- custom case categories
- expense categories
- document categories
- tags

Avoid full no-code “build your own database” complexity.

---

# 52. Arabic / RTL — P0

Already strong in your frontend.

Ensure:

- Arabic default
- correct RTL
- numbers remain readable
- phone/case IDs use BDI handling
- proper Arabic PDF reports
- Arabic search normalization if possible

Potential search normalization:

- أ / إ / آ
- ة / ه depending desired matching behavior
- ى / ي
- diacritics ignored

But preserve original entered text.

---

# 53. Keyboard productivity — P1

Desktop software should be faster than a website.

Useful:

- global search shortcut
- quick-create shortcut
- save shortcut
- Escape closes dialogs
- keyboard navigation
- recent records
- command palette eventually

A lawyer who uses LegalMaster every day will appreciate this enormously.

---

# 54. Recent / favorites — P1

Show:

- recent cases
- recent clients
- favorite/pinned matters
- recently opened documents

Small feature, disproportionate usability benefit.

---

# 55. Archive rather than delete — P0

For:

- clients
- cases
- POAs
- templates

Keep history.

Potential permanent deletion should be explicit and dangerous.

---

# 56. Activity history / undo — P1

Even with one user, this can help answer:

> What did I change?

You don't need enterprise audit logs.

But useful records could include:

- record created
- hearing changed
- payment changed
- document removed
- case archived

Potential:

> Recently deleted
> Restore

especially valuable.

---

# 57. Personal office dashboard — P2

Not enterprise analytics.

Useful numbers only:

- active cases
- hearings this month
- outstanding fees
- expenses this month
- income this month
- clients owing money
- overdue follow-ups

No useless pie charts.

---

# 58. Practice-area configuration — P2

A criminal lawyer and a corporate lawyer shouldn't see exactly the same UI.

During onboarding:

> What work do you usually do?

- civil
- criminal
- family/personal status
- commercial
- corporate
- labor
- administrative
- real estate
- mixed/general practice

Then enable appropriate optional fields/templates.

Do not create completely separate apps.

---

# 59. Local-only “smart features” I WOULD add

Here's the interesting part.

## A. OCR — Yes, probably P1

This is the clearest offline intelligence feature.

Use OCR to turn scanned images/PDF pages into searchable text.

Tesseract has official Arabic support, including `tessdata_fast` models designed for the speed/accuracy tradeoff; official Arabic trained data exists. ([GitHub][7])

That means:

```text
Scan judgment
      ↓
OCR locally
      ↓
Store extracted text
      ↓
Search later
```

No API.

No account.

No GPU.

No LLM.

### Important

OCR text should be treated as:

> machine-extracted searchable text

not authoritative legal content.

---

# 60. Document scanning / cleanup — Yes

Not even generative AI.

Local image processing can do:

- crop
- deskew
- rotate
- contrast
- black/white
- remove background/shadows
- combine pages
- create PDF

Lexa itself now markets an on-device scanner as a useful legal feature, which validates the UX demand even though your implementation can remain fully offline. ([Lexa AI][8])

For a paper-heavy profession, this could be excellent.

---

# 61. OCR + full-text search — absolutely yes

This combination is much more valuable to me than a mediocre local chatbot.

```text
Scanned PDFs
     ↓
Arabic OCR
     ↓
SQLite FTS5
     ↓
Search every case document locally
```

SQLite FTS5 already gives full-text indexing/querying without introducing an AI runtime. ([SQLite][6])

This is:

- cheap
- fast
- private
- deterministic
- genuinely useful

I would absolutely pursue it.

---

# 62. Smart duplicate matching — Yes

Local algorithms:

- normalize Arabic name
- fuzzy similarity
- compare phone
- National ID
- company registration

Then:

> Possible duplicate: 87% similarity.

No LLM required.

---

# 63. Smart field extraction — Maybe

From OCR text, use basic patterns to suggest:

- dates
- case number
- phone
- National ID
- amounts

But:

> **suggest, don't auto-save.**

Example:

```text
Detected:
Case number: 1245/2026
Date: 14/09/2026

[Accept]
```

This can be regex/rules initially.

No AI needed.

---

# 64. Automatic timeline generation — Yes, but deterministic

You don't need AI.

The application already knows:

- hearing dates
- decisions
- activities
- documents
- tasks
- judgments
- payments

Just sort them.

Voilà:

> case timeline.

---

# 65. Automatic “next work” surfacing — Yes

Again, no AI.

Rules:

```text
next hearing in 3 days
+ incomplete linked task
→ show warning
```

or:

```text
POA expires in 20 days
→ show warning
```

or:

```text
hearing decision exists
+ no next hearing/task
→ show "No follow-up recorded"
```

This **feels intelligent** while being deterministic.

I'd rather have this than an LLM.

---

# 66. Template suggestions — Yes

Based on case/activity type:

> This is an appeal stage.
> Available templates:
>
> - Appeal checklist
> - Client update
> - Hearing preparation

No model needed.

---

# 67. Local voice dictation — Optional later

Possible with something such as a small local Whisper-family model.

But I would **not bundle it initially**.

Reasons:

- larger application
- CPU load
- Arabic quality needs serious testing
- microphone/privacy UX
- model deployment complexity

Could someday be an optional pack:

> Install Offline Dictation

Core LegalMaster shouldn't depend on it.

---

# 68. Local embeddings / semantic search — Optional experiment, not core

Something like:

> Find documents related to "إنهاء عقد إيجار"

even where exact words differ.

Technically possible with small embedding models.

But it adds:

- model runtime
- model distribution
- indexing complexity
- performance work
- Arabic-quality evaluation

FTS5 should come first.

Maybe years later.

---

# 69. Local LLM assistant — No for default Solo

This is where I agree with your concern completely.

To get worthwhile Arabic legal generation you start moving toward:

- hundreds of MB to multiple GB model downloads
- significant RAM
- CPU/GPU requirements
- slower laptops
- quantization decisions
- model licensing
- model updating
- weak hardware differences
- questionable legal accuracy

And then somebody with an old office PC installs your “lightweight legal organizer” and suddenly it sounds like a jet engine because LegalMaster wants to summarize a PDF.

😂

No.

Not core.

---

# 70. AI legal research — No

Without an external service, you would need to ship/manage:

- Egyptian legal corpus
- judgments
- updates
- embeddings/index
- local model
- citation logic
- update mechanism

That is practically another product.

Cloud competitors such as Lexa are already building AI drafting/research/document summarization as SaaS functionality. ([Lexa AI][8])

Let them fight that battle for now.

---

# 71. AI drafting — No

Same reason.

Your deterministic templates probably produce more value initially.

Especially:

```text
my trusted template
+
known case/client data
=
correct predictable document
```

versus:

```text
LLM
=
maybe brilliant, maybe nonsense
```

---

# 72. AI summarization — No by default

A genuinely useful legal-document summarizer requires a capable model.

Small local models may run, but I'd rather not compromise:

- installer size
- RAM
- performance
- quality

Optional extension in the distant future.

---

# 73. Things I would explicitly EXCLUDE from Solo

This is important.

### No HR

- employees
- salaries
- attendance
- vacations

### No team administration

- roles
- permissions
- assignment between lawyers
- departments
- internal chat

### No multi-branch

### No cloud synchronization

### No account/login server

The **vault password** is not a cloud account.

### No client portal

### No mobile synchronization

### No online payments

### No automated WhatsApp API

### No email synchronization

### No website builder

### No marketing CRM

### No lead scoring

### No advertising

### No full accounting ERP

### No giant bundled LLM

### No cloud AI

### No telemetry containing client/case data

### No external legal-data integrations for now

That gives LegalMaster Solo a very clean boundary.

---

# 74. The product architecture I would conceptually aim for

The core domain becomes:

```text
Client
├── Contacts
├── Cases / Matters
├── POAs
├── Documents
└── Financial Account

Case
├── Parties
├── Litigation Stages
├── Hearings
│   ├── Preparation
│   ├── Decision
│   └── Next Hearing
├── Legal Activities
├── Judgments
├── Deadlines
├── Tasks
├── Documents
├── Notes
├── Timeline
└── Finance
```

And then surrounding the domain:

```text
Calendar
Today/Tomorrow
Search
Reports
Templates
Finance
Document Library
Backup/Restore
Settings
```

That's essentially the whole solo practice.

---

# 75. Navigation I would eventually target

```text
Today
Calendar

Clients
Cases
Matters
POAs

Tasks
Documents
Finances

Templates
Reports

Backups
Settings
```

Inside a **Case**:

```text
Overview
Timeline
Parties
Stages
Hearings
Activities
Deadlines
Tasks
Documents
Finance
Notes
```

I would avoid putting all 15 domain concepts into the global sidebar.

The global navigation stays small.

Complexity lives **inside the case**.

---

# 76. My actual priority order

If we ignore what already exists and ask what the _finished LegalMaster Solo_ should prioritize, I'd rank the value roughly like this:

|  Order | Capability                            |
| -----: | ------------------------------------- |
|  **1** | Reliable backup/recovery/export       |
|  **2** | Clients + cases                       |
|  **3** | Today/Tomorrow                        |
|  **4** | Hearings                              |
|  **5** | Decision → next hearing → next action |
|  **6** | Hearing preparation + hearing roll    |
|  **7** | Tasks/reminders                       |
|  **8** | Documents                             |
|  **9** | Case overview                         |
| **10** | Finance + client statement            |
| **11** | Legal activities/procedures           |
| **12** | Litigation stages                     |
| **13** | Deadlines                             |
| **14** | Case timeline                         |
| **15** | Judgments                             |
| **16** | POA lifecycle                         |
| **17** | Reports/printing                      |
| **18** | Universal search                      |
| **19** | Document templates                    |
| **20** | Consultations/non-litigation matters  |
| **21** | Conflict checking                     |
| **22** | Import/migration                      |
| **23** | OCR + document-content search         |
| **24** | Physical-original tracking            |
| **25** | Practice-specific optional tools      |

That would make an extremely complete solo-lawyer product **without HR, SaaS, collaboration, client portals, cloud infrastructure or generative AI**.

And I think the most important design philosophy is this:

> **LegalMaster Solo should automate information the software already knows before trying to “think.”**

If it knows the previous decision, next hearing, missing tasks, case documents, outstanding money and POA expiration, it can already behave remarkably intelligently with ordinary software engineering. OCR + FTS + good rules + templates + great workflow design will probably deliver **far more real value per megabyte and per CPU cycle than a local LLM**.

[1]: https://www.smokeball.com/solutions/firm-size/solo-firm?utm_source=chatgpt.com 'Solo Lawyer Software | Practice Management for Attorneys'
[2]: https://egyls.com/%D9%85%D8%A8%D8%A7%D8%AF%D8%A6-%D8%A7%D9%84%D8%B9%D9%85%D9%84-%D8%A8%D8%A7%D9%84%D9%85%D8%AD%D8%A7%D9%85%D8%A7%D8%A9/?utm_source=chatgpt.com 'مبادئ العمل بالمحاماة - نقابة المحامين المصرية'
[3]: https://www.clio.com/features/contact-management/?utm_source=chatgpt.com 'Law Firm Client Management With AI | Clio'
[4]: https://mohamy.pro/ 'برنامج المحامي | برنامج إدارة مكاتب المحاماة بدون إنترنت 2026'
[5]: https://professionallegala.com/ 'برنامج إدارة مكاتب المحاماة - Professional Legal A | التحول الرقمي للمحامين'
[6]: https://www.sqlite.org/fts5.html?utm_source=chatgpt.com 'SQLite FTS5 Extension'
[7]: https://github.com/tesseract-ocr/tessdoc/blob/main/tess3/Data-Files.md?utm_source=chatgpt.com 'tessdoc/tess3/Data-Files.md at main · tesseract-ocr/tessdoc · GitHub'
[8]: https://lexaai.io/en/features 'Lexa AI features for law firms · Lexa AI'
