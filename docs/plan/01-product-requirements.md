# Product requirements

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

---

# 1. Product definition

LegalMaster Solo is a small desktop application that helps an individual Egyptian lawyer manage:

- Clients
- Cases
- Hearings and legal events
- Deadlines and personal tasks
- Case documents
- Fees, payments and expenses
- Local backups

The application is designed for a single lawyer using one computer. It is not a law-firm ERP and does not contain organizational management features.

## Product positioning

> برنامج مجاني للمحامي الفردي لإدارة القضايا والجلسات والموكلين على جهازه، بدون اشتراك وبدون رفع بيانات القضايا إلى الإنترنت.

The principal differentiators are:

- Free
- Arabic-first
- Simple enough for daily use
- Works without an internet connection
- No mandatory account
- No cloud database
- No case-data collection
- Designed specifically for individual Egyptian lawyers

---

# 2. Product goals

## 2.1 Primary goals

The first public version must allow a lawyer to:

1. Find today's hearings and deadlines immediately.
2. Add and locate a client quickly.
3. Create and maintain a case record.
4. record every hearing result and next action.
5. Store or reference case documents.
6. Track agreed fees, received payments and case expenses.
7. Search the application globally.
8. back up and restore all managed information.
9. operate completely offline.
10. move their data to a future LegalMaster Firms system.

## 2.2 Business goals

The free product should:

- Build recognition for the LegalMaster name.
- Generate relationships with Egyptian lawyers.
- Demonstrate your understanding of legal workflows.
- Create qualified leads from firms needing collaboration and permissions.
- Establish a reusable foundation for customized firm systems.
- Produce a portable data format that can later be migrated to a hosted system.

## 2.3 Non-goals

The MVP will not include:

- Multiple users
- Employees
- Roles and permissions
- Task assignment between people
- Departments
- Cloud synchronization
- Mobile applications
- Client portals
- Full accounting
- Payroll
- Electronic invoicing
- WhatsApp or SMS integrations
- Court system integrations
- AI assistants
- OCR
- Embeddings or vector search
- Legal research
- Contract generation
- Document automation
- Attendance management
- Workflow builders
- Remote technical administration

Any agent proposing one of these features must treat it as out of scope unless the product plan is explicitly revised.

---

# 3. Target user

## Primary persona

An Egyptian lawyer who:

- Works alone or with informal administrative assistance.
- Uses a Windows laptop or desktop.
- May also use a MacBook.
- Currently organizes work using notebooks, paper files, Microsoft Word, Excel, phone calendars or folders.
- Needs to know the next hearing and required preparation.
- Is not necessarily technically experienced.
- Does not want to configure a server or database.
- Is concerned about client confidentiality.
- Expects Arabic and right-to-left interfaces.

## Secondary persona

A very small office may use the application on one shared computer. This is allowed but not formally supported as a collaborative workflow.

The application must never imply that multiple people can safely use the same installation with separate permissions.

---

# 4. Product principles

Every design and implementation decision must follow these principles.

## 4.1 Offline by default

All core features must work without internet access.

The only permitted network functionality in version 1.0 is:

- Checking for application updates
- Downloading a user-approved application update
- Opening the LegalMaster website or support page

No client, case, document, payment or usage information may be sent with update requests.

## 4.2 Local data ownership

The lawyer owns and controls the data.

The application must provide:

- Visible data-storage location
- Backup
- Restore
- Export
- Data deletion
- No vendor lock-in
- A documented migration archive

## 4.3 Simplicity over extensibility

Do not build abstractions for hypothetical firm features.

For example:

- No generic permissions engine
- No organization table
- No tenant identifier
- No workflow engine
- No plugin framework
- No microservices
- No local HTTP API
- No generalized metadata framework

The code should remain modular, but the product model should remain specific.

## 4.4 Daily utility over reporting

The dashboard should answer:

- What do I have today?
- What is coming tomorrow?
- What is overdue?
- What needs preparation?
- Which clients owe money?

It should not begin with charts or executive analytics.

For privacy principles (§4.5), see [06-privacy.md](06-privacy.md).

---

# 7. Application navigation

The main navigation should contain only:

```text
الرئيسية
الموكلون
القضايا
الجدول
المهام
المستندات
المالية
النسخ الاحتياطي
الإعدادات
```

A global search field should remain visible in the application header.

## Main window behavior

- Arabic RTL by default.
- Sidebar navigation.
- Keyboard-accessible controls.
- Responsive down to small laptop screens.
- Persistent window size and position.
- Unsaved-change confirmation before navigation.
- Single application instance.
- Optional minimize-to-tray behavior.
- Optional launch-at-startup for reliable reminders.

Tauri provides official plugins for native notifications, single-instance behavior and autostart on Windows and macOS.

---

# 24. Success criteria for version 1.0

The release is successful when:

- A new lawyer installs it without technical assistance.
- A lawyer can create the first client and case within ten minutes.
- Today's hearings can be understood immediately from the dashboard.
- A hearing outcome and next hearing can be recorded in one workflow.
- A case can be found by number, client, opponent or phone.
- Managed data can be backed up and restored on another computer.
- The application operates without a network connection.
- No case data is transmitted to LegalMaster.
- At least several beta lawyers continue using it weekly after the initial trial.
- Law firms begin asking about shared access, permissions and centralized deployment.
