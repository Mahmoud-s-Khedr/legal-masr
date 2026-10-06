// Canonical bilingual instructions. Capture IDs are shared across both guides.
export const chapters = [
  ['access', 'البداية وحماية الوصول', 'Getting started and protecting access'],
  ['daily', 'مساحة العمل ويومك', 'Workspace and your day'],
  ['clients', 'الموكلون', 'Clients'],
  ['poa', 'التوكيلات', 'Powers of attorney'],
  ['cases', 'القضايا', 'Cases'],
  ['agenda', 'الأجندة والجلسات', 'Agenda and hearings'],
  ['tasks', 'المهام والمواعيد النهائية', 'Tasks and deadlines'],
  ['documents', 'المستندات', 'Documents'],
  ['finance', 'الأتعاب والدفعات والمصروفات', 'Fees, payments, and expenses'],
  ['backups', 'النسخ الاحتياطي والاستعادة', 'Backup and restore'],
  ['settings', 'الإعدادات', 'Settings'],
];
export const bilingual = (ar, en) => ({ ar, en });
const screens = [];
function add(id, chapter, ar, en, arText, enText, action, kind = 'page') {
  screens.push({
    id,
    chapter,
    title: bilingual(ar, en),
    text: bilingual(arText, enText),
    action,
    kind,
  });
}
add(
  'setup',
  'access',
  'الإعداد لأول مرة',
  'First-run setup',
  'أدخل اسم المحامي وكلمة مرور لا تقل عن 12 حرفًا ثم أكدها واضغط بدء الاستخدام. لا تحتاج إلى حساب على الإنترنت. الاسم قابل للتعديل لاحقًا. احتفظ بكلمة المرور في مكان آمن.',
  'Enter the lawyer’s name and a password of at least 12 characters, confirm it, and choose Start using the app. No online account is needed. You can edit the name later. Keep the password safe.',
  { gate: 'setup' },
  'form',
);
add(
  'setup-validation',
  'access',
  'تصحيح بيانات الإعداد',
  'Correcting setup details',
  'إذا تركت الحقول المطلوبة فارغة، تظهر رسائل بجوارها. أكمل الاسم وكلمة المرور وتأكيدها ثم أعد المحاولة؛ لا تُنشأ مساحة بيانات حتى ينجح الإعداد.',
  'Leaving required fields empty shows messages beside them. Complete the name, password, and confirmation, then retry. Setup does not create a vault until it succeeds.',
  { gate: 'setup-validation' },
  'form',
);
add(
  'recovery-key',
  'access',
  'حفظ مفتاح الاسترداد',
  'Saving the recovery key',
  'يظهر مفتاح الاسترداد مرة واحدة بعد الإعداد. اكتبه واحفظه منفصلًا عن الجهاز؛ لا ترسله إلى الدعم. المفتاح في هذه الصورة محجوب عمدًا. ضع علامة حفظ المفتاح ثم تابع. مفتاح الاسترداد يعيد الوصول إلى هذه المساحة؛ النسخة الاحتياطية تحفظ السجلات والملفات.',
  'The recovery key appears once after setup. Write it down and store it separately from the computer; do not send it to support. Its value is intentionally hidden in this screenshot. Confirm you saved it, then continue. The key recovers access to this vault; a backup preserves records and files.',
  { gate: 'recovery-key' },
);
add(
  'unlock',
  'access',
  'فتح مساحة البيانات',
  'Unlocking the vault',
  'أدخل كلمة المرور واضغط فتح. تظهر هذه الشاشة بعد قفل التطبيق أو إعادة تشغيله. زر إظهار كلمة المرور اختياري؛ استخدمه فقط حين لا يستطيع أحد رؤية الشاشة.',
  'Enter your password and choose Unlock. This screen appears after locking or restarting the app. The password visibility control is optional; use it only when nobody can see the screen.',
  { gate: 'unlock' },
  'form',
);
add(
  'wrong-password',
  'access',
  'كلمة مرور غير صحيحة',
  'Incorrect password',
  'تُرفض كلمة المرور غير الصحيحة وتبقى السجلات مقفلة. تحقق من لغة لوحة المفاتيح وحالة الأحرف وأعد المحاولة. إذا نسيتها، استخدم رابط مفتاح الاسترداد.',
  'An incorrect password is refused and records remain locked. Check keyboard language and letter case, then retry. If you forgot it, use the recovery-key link.',
  { gate: 'wrong-password' },
  'form',
);
add(
  'recovery',
  'access',
  'استرداد الوصول',
  'Recovering access',
  'من شاشة الفتح اختر رابط مفتاح الاسترداد. أدخل المفتاح المحفوظ وكلمة مرور جديدة لا تقل عن 12 حرفًا وأكدها ثم اضغط استعادة الوصول. الرجوع يعيدك إلى شاشة الفتح. لا يوجد استرداد عبر البريد الإلكتروني.',
  'From Unlock, choose the recovery-key link. Enter your saved key and a new password of at least 12 characters, confirm it, and choose Recover access. Back returns to Unlock. Email recovery is unavailable.',
  { gate: 'recovery' },
  'form',
);
add(
  'shell',
  'daily',
  'التنقل والبحث والقفل',
  'Navigation, search, and locking',
  'اختر القسم من الشريط الجانبي. البحث أعلى الشاشة يجمع الموكلين والقضايا والتوكيلات. قائمة إضافة تختصر الوصول إلى موكل أو قضية أو جلسة أو مهمة جديدة. زر القفل يخفي السجلات فورًا؛ العودة تتطلب كلمة المرور. العربية وEnglish يبدلان لغة الواجهة.',
  'Choose a section in the sidebar. Header search finds clients, cases, and powers of attorney. Add provides shortcuts to a new client, case, hearing, or task. Lock immediately hides records; returning requires the password. العربية and English switch interface language.',
  { path: '/' },
  'shell',
);
add(
  'quick-add',
  'daily',
  'قائمة الإضافة السريعة',
  'Quick-add menu',
  'افتح إضافة ثم اختر نوع السجل. ينتقل التطبيق إلى النموذج المناسب؛ لا يحفظ سجلًا بمجرد اختيار الاختصار. إضافة المستند تتم من ملف مالكه.',
  'Open Add and choose the record type. The app opens the corresponding form; selecting a shortcut alone does not save a record. Add documents from their owning record.',
  { path: '/', selector: '.create-button' },
);
add(
  'dashboard',
  'daily',
  'شاشة اليوم',
  'Today dashboard',
  'ابدأ يومك بمراجعة جلسات اليوم ثم المهام المستحقة والمتأخرة والجلسات القادمة. افتح السجل المرتبط لمعرفة التفاصيل أو تسجيل قرار الجلسة. إعدادات اللغة والتاريخ تؤثر في العرض؛ التاريخ القانوني لا يتغير بسبب المنطقة الزمنية.',
  'Start by reviewing today’s hearings, due and overdue tasks, and upcoming hearings. Open the linked record for details or to record a decision. Language and date preferences affect presentation; legal dates do not shift with time zones.',
  { path: '/' },
);
add(
  'search',
  'daily',
  'نتائج البحث الشامل',
  'Global search results',
  'اكتب اسمًا أو رقمًا في البحث. تظهر النتائج حسب نوع السجل. اضغط النتيجة لفتح الملف مباشرة. البحث يدعم تطبيع الحروف والأرقام العربية؛ لا يبحث داخل نصوص المستندات.',
  'Type a name or number into search. Results are grouped by record type. Select a result to open its file. Search normalizes Arabic letters and digits; it does not search document contents.',
  { path: '/', search: true },
);
add(
  'search-palette',
  'daily',
  'البحث بلوحة المفاتيح',
  'Keyboard search',
  'اضغط Ctrl+K أو Command+K لفتح البحث. اكتب الاستعلام ثم استخدم السهمين لأعلى ولأسفل وEnter لاختيار نتيجة. Escape يغلق النافذة.',
  'Press Ctrl+K or Command+K to open search. Type your query, use Up/Down arrows and Enter to choose a result. Escape closes the window.',
  { path: '/', palette: true },
);
add(
  'clients-list',
  'clients',
  'قائمة الموكلين',
  'Client list',
  'استخدم البحث بالاسم أو الرقم ثم افتح الملف من الصف. إظهار المؤرشف يضم الموكلين المؤرشفين. اختر إضافة موكل لبدء سجل جديد.',
  'Search by name or number, then open a file from its row. Show archived includes archived clients. Choose Add client to start a new record.',
  { path: '/clients' },
);
add(
  'client-create',
  'clients',
  'إضافة موكل',
  'Adding a client',
  'رقم الموكل الداخلي والاسم مطلوبان. أدخل الهاتف والبريد والعنوان والرقم القومي والملاحظات عند الحاجة. استخدم رقمًا داخليًا فريدًا ثم احفظ الموكل؛ يفتح ملفه بعد الحفظ.',
  'Internal client number and full name are required. Add phone, email, address, national ID, and notes as needed. Use a unique internal number, then save; the client file opens after saving.',
  { path: '/clients/new' },
  'form',
);
add(
  'client-required',
  'clients',
  'الحقول المطلوبة للموكل',
  'Required client fields',
  'عند محاولة حفظ نموذج فارغ، تظهر أخطاء الحقول المطلوبة. صحح الرقم الداخلي والاسم ثم احفظ. لا تضف رقمًا وهميًا لتجاوز الخطأ في سجلاتك الحقيقية.',
  'Saving an empty form shows required-field errors. Correct the internal number and name, then save. Do not invent values just to bypass validation in real records.',
  { path: '/clients/new', submit: true },
  'form',
);
add(
  'client-duplicate',
  'clients',
  'تحذير التشابه',
  'Possible duplicate warning',
  'عندما تتشابه بيانات الموكل مع سجل موجود، راجع الأسماء المعروضة أولًا. عدّل البيانات أو افتح السجل الموجود؛ أكد إنشاء موكل منفصل فقط إذا كان شخصًا مختلفًا. التحذير لا يعني دمج السجلات تلقائيًا.',
  'When client details resemble an existing record, review the displayed candidates first. Correct the details or open the existing file; confirm a separate client only if it is a different person. The warning does not automatically merge records.',
  { duplicate: true },
  'form',
);
const clientTabs = [
  [
    'summary',
    'ملخص الموكل',
    'Client summary',
    'راجع بيانات الاتصال والرقم الداخلي والقضايا المرتبطة. شرطة بدل قيمة تعني أن الحقل لم يُسجل.',
    'Review contact details, internal number, and linked cases. A dash means the field was not recorded.',
  ],
  [
    'cases',
    'قضايا الموكل',
    'Client cases',
    'افتح قضية مرتبطة أو اختر إضافة قضية للموكل لإنشاء قضية يكون هذا الموكل محددًا فيها.',
    'Open a linked case or choose Add case for client to start a case with this client already selected.',
  ],
  [
    'poas',
    'توكيلات الموكل',
    'Client powers of attorney',
    'افتح التوكيل المرتبط لمراجعة بياناته. إدارة التوكيلات تعيدك إلى قائمة التوكيلات.',
    'Open a linked power of attorney to inspect it. Manage powers of attorney returns to the list.',
  ],
  [
    'account',
    'حساب الموكل',
    'Client account',
    'راجع الدفعات المحصلة والمصروفات المرتبطة وصافي النقد. افتح دفتر المالية لمراجعة الحركات. هذا العرض لا يوزع الأتعاب المشتركة بين موكلي القضية.',
    'Review received payments, linked expenses, and net cash. Open the finance ledger for transactions. This view does not allocate shared case fees among clients.',
  ],
  [
    'attachments',
    'مستندات الموكل',
    'Client documents',
    'أضف نسخًا من إثبات الهوية أو المستندات الأخرى من هذا التبويب. كل مستند هنا يخص هذا الموكل وحده.',
    'Add copies of identification or other documents from this tab. Each attachment here belongs to this client alone.',
  ],
];
clientTabs.forEach(([id, ar, en, at, et], tab) =>
  add(`client-${id}`, 'clients', ar, en, at, et, { entity: 'client', tab }),
);
add(
  'client-edit',
  'clients',
  'تعديل الموكل',
  'Editing a client',
  'من الملف اضغط تعديل، غيّر البيانات ثم احفظ التعديلات. إلغاء يغلق النموذج دون حفظ المسودة.',
  'Choose Edit in the file, change details, and save edits. Cancel closes the form without saving the draft.',
  { entity: 'client', button: 'records.edit' },
  'form',
);
add(
  'client-archive',
  'clients',
  'تأكيد أرشفة الموكل',
  'Archiving a client',
  'اختر أرشفة ثم راجع التأكيد. الأرشفة تخفي الموكل من القائمة المعتادة ولا تحذف ملفاته. لإعادته: أظهر المؤرشف، افتح الملف واضغط استعادة.',
  'Choose Archive and review the confirmation. Archiving hides the client from the usual list without deleting its files. To restore: show archived, open the file, and choose Restore.',
  { entity: 'client', button: 'records.archive' },
);
add(
  'client-restored',
  'clients',
  'إعادة الموكل من الأرشيف',
  'Restoring an archived client',
  'افتح الموكل المؤرشف واضغط استعادة ليظهر مجددًا في القوائم النشطة. لا يوجد حذف نهائي للموكل من الواجهة.',
  'Open the archived client and choose Restore to include it in active lists again. Permanent client deletion is unavailable in the interface.',
  { entity: 'client', archived: true },
);
add(
  'poa-list',
  'poa',
  'قائمة التوكيلات',
  'Power-of-attorney list',
  'ابحث برقم التوكيل أو بياناته، وافتحه من الصف. إظهار المؤرشف يضم التوكيلات المؤرشفة. الرقم الرسمي قد يتكرر؛ الرقم الداخلي يجب أن يكون فريدًا.',
  'Search by power-of-attorney number or details and open it from the row. Show archived includes archived records. Official numbers may repeat; internal sequences must be unique.',
  { path: '/powers-of-attorney' },
);
add(
  'poa-create',
  'poa',
  'إضافة توكيل',
  'Adding a power of attorney',
  'أدخل الرقم الداخلي والرقم الرسمي وتاريخ الإصدار ومكتب التوثيق. حدد الموكلين وأضف أسماء المحامين وأرقام القيد عند الحاجة. زر إضافة محام يضيف الاسم إلى المسودة؛ حفظ التوكيل يحفظ السجل كله.',
  'Enter the internal sequence, official number, issue date, and notary office. Select clients and add named lawyers and bar numbers as needed. Add lawyer adds an entry to the draft; Save power of attorney saves the full record.',
  { path: '/powers-of-attorney', button: 'poa.add' },
  'form',
);
add(
  'poa-inline-client',
  'poa',
  'إضافة موكل أثناء التوكيل',
  'Adding a client inside a power of attorney',
  'داخل نموذج التوكيل اختر إضافة موكل. احفظ بيانات الموكل الجديد؛ يُحدد تلقائيًا في مسودة التوكيل. حفظ الموكل لا يغني عن حفظ التوكيل.',
  'Inside the power-of-attorney form, choose Add client. Save the new client; it is automatically selected in the power-of-attorney draft. Saving the client does not also save the power of attorney.',
  { path: '/powers-of-attorney', button: 'poa.add', secondButton: 'cases.form.addClientLink' },
  'form',
);
const poaTabs = [
  [
    'summary',
    'ملخص التوكيل',
    'Power-of-attorney summary',
    'راجع الرقم الرسمي وتاريخ الإصدار ومكتب التوثيق والموكلين.',
    'Review the official number, issue date, notary office, and clients.',
  ],
  [
    'clients',
    'موكلو التوكيل',
    'Power-of-attorney clients',
    'افتح ملفات الموكلين المرتبطين. تعديل التوكيل يتيح تغيير الاختيارات.',
    'Open linked client files. Edit the power of attorney to change selections.',
  ],
  [
    'lawyers',
    'المحامون المذكورون',
    'Named lawyers',
    'تعرض القائمة المحامين المذكورين وأرقام قيدهم وملاحظاتهم. هذه بيانات وصفية وليست حسابات مستخدمين أو صلاحيات.',
    'The list shows named lawyers, bar numbers, and notes. These are descriptive entries, not user accounts or permissions.',
  ],
  [
    'cases',
    'القضايا المرتبطة بالتوكيل',
    'Cases using this power of attorney',
    'تظهر القضايا ذات روابط التوكيل المسجلة. يمكنك فتح القضية من هنا، لكن إنشاء أو تغيير هذه الروابط غير متاح في الواجهة الحالية.',
    'Cases with recorded links to this power of attorney appear here. Open the case from the list; creating or changing these links is unavailable in the current interface.',
  ],
  [
    'attachments',
    'مستندات التوكيل',
    'Power-of-attorney documents',
    'أضف نسخة التوكيل من هذا التبويب، ثم افتحها أو عدل وصفها عند الحاجة.',
    'Add a copy of the power of attorney from this tab, then open it or edit its description as needed.',
  ],
];
poaTabs.forEach(([id, ar, en, at, et], tab) =>
  add(`poa-${id}`, 'poa', ar, en, at, et, { entity: 'poa', tab }),
);
add(
  'poa-edit',
  'poa',
  'تعديل التوكيل',
  'Editing a power of attorney',
  'اضغط تعديل ثم غيّر بيانات التوكيل والموكلين والمحامين واحفظ. السنة تُشتق من تاريخ الإصدار في النموذج.',
  'Choose Edit, change the power-of-attorney details, clients, and lawyers, then save. The form derives the year from the issue date.',
  { entity: 'poa', button: 'records.edit' },
  'form',
);
add(
  'poa-archive',
  'poa',
  'أرشفة التوكيل',
  'Archiving a power of attorney',
  'راجع رسالة التأكيد قبل الأرشفة. لإعادة التوكيل، أظهر المؤرشف في القائمة ثم افتحه واضغط استعادة.',
  'Review the confirmation before archiving. To restore it, show archived records in the list, open it, and choose Restore.',
  { entity: 'poa', button: 'records.archive' },
);
add(
  'poa-restored',
  'poa',
  'استعادة التوكيل المؤرشف',
  'Restoring an archived power of attorney',
  'زر استعادة يعيد التوكيل إلى القائمة النشطة. الأرشفة لا تمحو المستندات المرتبطة.',
  'Restore returns the power of attorney to the active list. Archiving does not erase its attachments.',
  { entity: 'poa', archived: true },
);
add(
  'cases-list',
  'cases',
  'قائمة القضايا',
  'Case list',
  'ابحث بالرقم أو بيانات القضية، أو رشح بالحالة. افتح الصف للاطلاع على الملف. إظهار المؤرشف يضم الملفات المؤرشفة.',
  'Search by number or case details, or filter by status. Open a row to inspect its file. Show archived includes archived files.',
  { path: '/cases' },
);
add(
  'case-create',
  'cases',
  'إضافة قضية',
  'Adding a case',
  'الرقم الداخلي وموكل واحد على الأقل مطلوبان. الرقم الرسمي وسنته منفصلان عن رقم ملفك. سجل المحكمة والدائرة والنوع ودرجة التقاضي والحالة والتواريخ والموضوع. اختر الموكلين ثم احفظ.',
  'An internal number and at least one client are required. The official number and year are separate from your file number. Record court, circuit, type, litigation degree, status, dates, and subject. Select clients, then save.',
  { path: '/cases/new' },
  'form',
);
const caseTabs = [
  [
    'summary',
    'ملخص القضية',
    'Case summary',
    'راجع هوية القضية والجلسة القادمة وآخر قرار والمهام المفتوحة. روابط التفاصيل تنقلك إلى التبويب المختص.',
    'Review case identity, next hearing, latest decision, and open tasks. Detail links open the corresponding tab.',
  ],
  [
    'relationships',
    'الموكلون والخصوم',
    'Clients and opponents',
    'يعرض القسم موكلي القضية وصفاتهم وروابط التوكيلات إن كانت مسجلة. هذه العلاقات للعرض فقط حاليًا؛ لا يتيح نموذج التعديل تغيير الموكلين أو الصفات أو التوكيلات. يمكنك إضافة الخصوم وتعديل بياناتهم.',
    'This section displays case clients, capacities, and any recorded power-of-attorney links. These relationships are currently read-only: the edit form cannot change clients, capacities, or powers of attorney. You can add and edit opponents.',
  ],
  [
    'hearings',
    'جلسات القضية',
    'Case hearings',
    'أضف جلسة أو افتح جلسة موجودة لتعديلها. تسجيل القرار يمكن أن ينشئ جلسة تالية مرتبطة في خطوة واحدة.',
    'Add a hearing or open an existing hearing to edit it. Recording a decision can create a linked next hearing in one step.',
  ],
  [
    'tasks',
    'مهام القضية',
    'Case tasks',
    'أضف مهمة للقضية أو افتحها لتعديل التفاصيل. مربع الإنجاز يكمل المهمة؛ يمكنك إعادة فتحها.',
    'Add a task for the case or open it to edit details. The completion checkbox completes it; you can reopen it.',
  ],
  [
    'attachments',
    'مستندات القضية',
    'Case documents',
    'أضف المذكرات والأحكام والأدلة إلى ملف القضية. المستند نسخة يديرها التطبيق وليس رابطًا إلى الملف الأصلي.',
    'Add pleadings, decisions, and evidence to the case file. An attachment is an application-managed copy, not a link to the source file.',
  ],
  [
    'account',
    'حساب القضية والأتعاب',
    'Case account and fees',
    'أدخل الأتعاب المتفق عليها واحفظها. يعرض الحساب المتفق عليه والمحصّل والمتبقي والمصروفات وصافي النقد. الدفعات مستقلة عن المصروفات، وكل المبالغ بالجنيه المصري.',
    'Enter and save agreed fees. The account shows agreed, received, outstanding, expenses, and net cash. Payments are separate from expenses; all amounts are in Egyptian pounds.',
  ],
];
caseTabs.forEach(([id, ar, en, at, et], tab) =>
  add(`case-${id}`, 'cases', ar, en, at, et, { entity: 'case', tab }),
);
add(
  'case-edit',
  'cases',
  'تعديل القضية وروابط الموكلين',
  'Editing a case and client relationships',
  'عدل بيانات القضية والمحكمة والحالة والتواريخ والموضوع ثم احفظ. روابط الموكلين تظل كما هي ولا يمكن تعديلها من هذا النموذج. تاريخ الإغلاق لا يغير الجلسات أو المهام تلقائيًا.',
  'Edit case details, court, status, dates, and subject, then save. Client relationships remain unchanged and cannot be edited in this form. Closing the case does not automatically change hearing or task dates.',
  { entity: 'case', button: 'records.edit' },
  'form',
);
add(
  'opponent-create',
  'cases',
  'إضافة خصم',
  'Adding an opponent',
  'من الموكلين والخصوم اختر إضافة خصم. الاسم مطلوب؛ الصفة ومحامي الخصم والهاتف والعنوان والملاحظات اختيارية. احفظ لإضافته إلى هذه القضية.',
  'From Clients and opponents, choose Add opponent. Name is required; legal capacity, opponent lawyer, phone, address, and notes are optional. Save to add it to this case.',
  { entity: 'case', tab: 1, button: 'cases.parties.add' },
  'form',
);
add(
  'opponent-edit',
  'cases',
  'تعديل خصم',
  'Editing an opponent',
  'اضغط تعديل بجوار الخصم، غيّر البيانات واحفظ. التعديل يخص خصم هذه القضية.',
  'Choose Edit beside the opponent, update details, and save. This updates the opponent in this case.',
  { entity: 'case', tab: 1, selector: '.detail-card:last-child .row-actions button' },
  'form',
);
add(
  'opponent-remove',
  'cases',
  'إزالة خصم',
  'Removing an opponent',
  'راجع التأكيد قبل إزالة الخصم من القضية. إلغاء يبقي العلاقة كما هي.',
  'Review the confirmation before removing the opponent from the case. Cancel leaves the relationship unchanged.',
  { entity: 'case', tab: 1, selector: '.detail-card:last-child .row-actions button:last-child' },
);
add(
  'case-archived',
  'cases',
  'القضية المؤرشفة',
  'Archived case',
  'الأرشفة في رأس الملف تخفي القضية من القوائم المعتادة. افتح الملف المؤرشف واضغط استعادة لإعادته. الأرشفة منفصلة عن حالة القضية مغلقة ولا تعني حذفها.',
  'Archive in the file header hides the case from ordinary lists. Open the archived file and choose Restore to return it. Archiving is separate from Closed status and does not delete the case.',
  { entity: 'case', archived: true },
);
for (const [view, ar, en] of [
  ['month', 'عرض الشهر', 'Month view'],
  ['week', 'عرض الأسبوع', 'Week view'],
  ['list', 'عرض القائمة', 'List view'],
])
  add(
    `agenda-${view}`,
    'agenda',
    ar,
    en,
    'اختر نوع العرض ثم تنقل بين التواريخ. الجلسات والمهام تظهر معًا حسب اليوم. اختيار يوم يعرض تفاصيله وأزرار إدارة الجلسات. بداية الأسبوع تتبع الإعدادات.',
    'Choose the view, then navigate dates. Hearings and tasks appear together by day. Selecting a day displays its details and hearing actions. The week start follows Settings.',
    { path: '/calendar', agendaView: view },
  );
add(
  'hearing-create',
  'agenda',
  'إضافة جلسة',
  'Adding a hearing',
  'اختر القضية والتاريخ، ثم الوقت والنوع والمكان والدائرة والمستندات المطلوبة والملاحظات عند الحاجة. احفظ لتظهر الجلسة في الأجندة وملف القضية.',
  'Choose the case and date, then add time, type, location, circuit, required documents, and notes as needed. Save to show the hearing in the agenda and case file.',
  { path: '/calendar?create=hearing' },
  'form',
);
add(
  'hearing-edit',
  'agenda',
  'تعديل جلسة',
  'Editing a hearing',
  'افتح تفاصيل الجلسة، صحح البيانات واحفظ. تعديل جلسة لاحقة لا يغير بيانات الجلسة السابقة.',
  'Open hearing details, correct them, and save. Editing a follow-up hearing does not change its previous hearing.',
  { hearing: true },
  'form',
);
add(
  'hearing-decision',
  'agenda',
  'تسجيل القرار والجلسة التالية',
  'Recording a decision and next hearing',
  'أدخل القرار وحدد تاريخ الجلسة التالية إن وجد ثم احفظ القرار. تكتمل الجلسة الحالية وتُنشأ التالية مرتبطة بها. تترك التاريخ فارغًا إذا لم تُحدد جلسة أخرى؛ يمكنك تعديل التالية لاحقًا.',
  'Enter the decision and a next-hearing date if one exists, then record the decision. The current hearing completes and the next one is linked to it. Leave the date empty if no next hearing was set; edit the follow-up later as needed.',
  { entity: 'case', tab: 2, button: 'agenda.recordDecision' },
  'form',
);
add(
  'hearing-delete',
  'agenda',
  'حذف جلسة',
  'Deleting a hearing',
  'من تفاصيل اليوم اختر حذف الجلسة وراجع التأكيد. استخدم إلغاء إذا أردت الاحتفاظ بها. حذف جلسة لا يساوي تسجيل قرارها.',
  'From the day’s details, choose Delete hearing and review the confirmation. Cancel to keep it. Deleting a hearing is different from recording its decision.',
  { hearingDelete: true },
);
for (const [view, ar, en] of [
  ['TODAY', 'مهام اليوم', 'Today’s tasks'],
  ['OVERDUE', 'المهام المتأخرة', 'Overdue tasks'],
  ['UPCOMING', 'المهام القادمة', 'Upcoming tasks'],
  ['COMPLETED', 'المهام المكتملة', 'Completed tasks'],
  ['ALL', 'جميع المهام', 'All tasks'],
])
  add(
    `tasks-${view.toLowerCase()}`,
    'tasks',
    ar,
    en,
    'اختر التبويب المناسب ورشح بالقضية أو الموكل عند الحاجة. افتح عنوان المهمة لتعديلها. مربع الاختيار يغير حالة الإنجاز؛ إزالة الفلاتر يعرض القائمة دون قيود الموكل والقضية.',
    'Choose the relevant tab and filter by case or client as needed. Open a task title to edit it. The checkbox changes completion status; Clear filters removes case/client restrictions.',
    { path: `/tasks?view=${view}` },
  );
add(
  'task-create',
  'tasks',
  'إضافة مهمة',
  'Adding a task',
  'أدخل عنوان المهمة وتاريخ الاستحقاق. يمكنك ربطها بقضية أو موكل وإضافة التفاصيل والملاحظات. لا توجد أولوية أو إسناد إلى موظف أو وقت استحقاق؛ هذا برنامج لمحامٍ فردي.',
  'Enter a title and due date. Optionally link a case or client and add details and notes. There is no priority, employee assignment, or due time; this is a solo-lawyer application.',
  { path: '/tasks?create=task' },
  'form',
);
add(
  'task-edit',
  'tasks',
  'تعديل المهمة وإنجازها',
  'Editing and completing a task',
  'افتح المهمة ثم عدل بياناتها واحفظ. زر إكمال المهمة أو إعادة فتحها يغير الحالة مباشرة. لا يلزم تعديل التاريخ لإكمال المهمة.',
  'Open a task, update its details, and save. Complete task or Reopen changes status directly. Completing a task does not require changing its due date.',
  { task: true },
  'form',
);
add(
  'task-delete',
  'tasks',
  'حذف المهمة',
  'Deleting a task',
  'اختر حذف بجوار المهمة ثم أكد الحذف. إلغاء يحتفظ بالمهمة. استخدم الإنجاز بدل الحذف إذا أردت الاحتفاظ بسجل العمل المكتمل.',
  'Choose Delete beside the task and confirm. Cancel keeps it. Use completion rather than deletion when you want to retain the completed-work record.',
  { path: '/tasks?view=ALL', button: 'tasks.delete' },
);
add(
  'documents-global',
  'documents',
  'جميع المستندات',
  'All documents',
  'هذه قائمة المستندات العامة. راجع الاسم والتصنيف والتاريخ والمالك. لإضافة مستند جديد، افتح ملف الموكل أو القضية أو التوكيل. الإضافة غير متاحة من القائمة العامة.',
  'This is the global document list. Review filename, category, date, and owner. To add a document, open its client, case, or power-of-attorney file. Adding is unavailable from the global list.',
  { path: '/attachments' },
);
add(
  'document-create',
  'documents',
  'إضافة نسخة مستند',
  'Adding a document copy',
  'من تبويب مستندات المالك اضغط إضافة مستند ثم اختيار ملف. اختر الملف في نافذة النظام، ثم التصنيف والوصف والتاريخ واحفظ. يحتفظ التطبيق بنسخة ولا يعدّل المصدر. إلغاء اختيار الملف لا ينشئ مستندًا.',
  'From the owner’s documents tab, choose Add document, then Choose file. Select a file in the system dialog, add category, description, and date, and save. The app keeps a copy without changing the source. Canceling selection creates no attachment.',
  { entity: 'case', tab: 4, button: 'documents.add', pick: true },
  'form',
);
add(
  'document-edit',
  'documents',
  'تعديل وصف المستند',
  'Editing document metadata',
  'اضغط تعديل بجوار المستند لتغيير التصنيف والوصف وتاريخ المستند. لا يستبدل هذا النموذج محتوى الملف. فتح يستخدم التطبيق المناسب في النظام، وإظهار يفتح موقع النسخة المدارة.',
  'Choose Edit beside a document to change category, description, and document date. This form does not replace file contents. Open uses the appropriate system application; Reveal opens the managed copy’s location.',
  { entity: 'case', tab: 4, selector: '.attachment-actions button:nth-child(3)' },
  'form',
);
add(
  'document-remove',
  'documents',
  'إزالة المستند',
  'Removing a document',
  'راجع التأكيد قبل إزالة النسخة المدارة وبياناتها. الملف الأصلي الذي اخترته لا يُحذف. إلغاء يبقي المستند.',
  'Review the confirmation before removing the managed copy and its metadata. The originally selected source file is not deleted. Cancel keeps the attachment.',
  { entity: 'case', tab: 4, selector: '.attachment-actions button:nth-child(4)' },
);
add(
  'document-missing',
  'documents',
  'تعذر فتح مستند',
  'Document could not be opened',
  'إذا فُقدت النسخة المدارة أو تعذر فتحها، يظهر خطأ. تحقق من وجود الملف ومن إعدادات النظام؛ لا تنقل الملفات داخل مجلد بيانات التطبيق يدويًا. احتفظ بنسخ احتياطية تشمل المستندات.',
  'A missing managed file or failed open shows an error. Check file availability and system configuration; do not manually move files inside the app’s data folder. Keep backups that include documents.',
  { missingDocument: true },
);
add(
  'finance-payments',
  'finance',
  'سجل الدفعات',
  'Payment register',
  'اختر القضية والموكل للترشيح. عند تحديد قضية، يقتصر مرشح دافع الدفعة على موكليها. راجع الدفعات والحساب، وافتح الحركة لتعديلها.',
  'Filter by case and client. With a case selected, payer filtering is limited to its clients. Review payments and the account, and open a transaction to edit it.',
  { finance: true },
);
add(
  'finance-expenses',
  'finance',
  'سجل المصروفات',
  'Expense register',
  'انتقل إلى المصروفات وراجع النوع والتاريخ والمبلغ والروابط. المصروف قد يرتبط بقضية أو موكل أو لا يرتبط بأي منهما. المصروفات لا تُحسب دفعات أتعاب.',
  'Switch to Expenses and review type, date, amount, and links. An expense may link to a case, a client, or neither. Expenses do not count as fee payments.',
  { finance: true, tab: 1 },
);
add(
  'payment-create',
  'finance',
  'إضافة دفعة',
  'Adding a payment',
  'اختر القضية ودافع الدفعة من موكليها. أدخل مبلغًا موجبًا وتاريخ الدفع والطريقة والملاحظات ثم احفظ. يسجل المبلغ بالجنيه والقرش دون تقريب عشري غير دقيق.',
  'Choose a case and a payer from its linked clients. Enter a positive amount, payment date, method, and notes, then save. Amounts use Egyptian pounds and piastres with exact minor-unit storage.',
  { finance: true, button: 'finances.add.payment' },
  'form',
);
add(
  'payment-edit',
  'finance',
  'تعديل دفعة',
  'Editing a payment',
  'افتح الدفعة ثم صحح المبلغ أو التاريخ أو الطريقة والملاحظات واحفظ. يتحدث حساب القضية بعد الحفظ. لا يوجد زر حذف دفعة في الواجهة الحالية.',
  'Open a payment, correct amount, date, method, or notes, and save. The case account updates after saving. The current interface has no payment-delete control.',
  { finance: true, selector: 'tbody tr:first-child td:last-child .text-button' },
  'form',
);
add(
  'expense-create',
  'finance',
  'إضافة مصروف',
  'Adding an expense',
  'أدخل مبلغًا موجبًا وتاريخًا ونوع المصروف. الربط بقضية وموكل اختياري. الأنواع: رسوم محكمة، انتقالات، أدوات مكتبية، أتعاب خبير، وأخرى. احفظ الحركة.',
  'Enter a positive amount, date, and expense type. Case and client links are optional. Types are court fees, transport, office supplies, expert fees, and other. Save the transaction.',
  { finance: true, tab: 1, button: 'finances.add.expense' },
  'form',
);
add(
  'expense-edit',
  'finance',
  'تعديل مصروف ومستنداته',
  'Editing an expense and its documents',
  'افتح المصروف لتعديل البيانات واحفظ. لا يوجد زر إضافة مستند للمصروف أو حذف مصروف في الواجهة الحالية. يمكنك حفظ إيصالات القضية كمستندات للقضية.',
  'Open an expense to edit details and save. The current interface has no expense attachment-upload or expense-delete control. You can keep case receipts as case documents.',
  { finance: true, tab: 1, selector: 'tbody tr:first-child td:last-child .text-button' },
  'form',
);
add(
  'backups-page',
  'backups',
  'شاشة النسخ الاحتياطي',
  'Backup page',
  'أنشئ نسخة الآن؛ تُحفظ في مجلد Backups داخل بيانات التطبيق. آخر نسخة يعرض التاريخ والحجم وتنبيهًا إذا كانت قديمة. انسخ الأرشيف إلى وسيط آمن كإجراء يدوي. النسخ تلقائيًا أو تغيير وجهة الحفظ غير متاحين.',
  'Create a backup now; it is saved in Backups inside application data. Latest backup shows date, size, and advice when stale. Manually copy the archive to safe storage. Automatic backups and changing the destination are unavailable.',
  { path: '/backups' },
);
add(
  'backup-created',
  'backups',
  'نجاح إنشاء النسخة',
  'Backup created successfully',
  'رسالة النجاح تعني أن التطبيق أنشأ الأرشيف المشفر وفحصه. تشمل النسخة قاعدة البيانات والمستندات المدارة. تحقق من أحدث تاريخ بعد العملية.',
  'Success means the app created and checked the encrypted archive. It includes the database and managed documents. Check the latest timestamp afterward.',
  { path: '/backups', button: 'backups.createNow', waitSuccess: true },
);
add(
  'backup-validate',
  'backups',
  'فحص النسخة الاحتياطية',
  'Validating a backup',
  'اضغط فحص ثم اختر الأرشيف من نافذة النظام. النجاح يثبت سلامة بنية النسخة والتحقق من محتواها في هذه المساحة؛ لا يثبت إمكانية نقلها إلى جهاز جديد.',
  'Choose Validate and select the archive in the system dialog. Success establishes archive structure and content integrity in this vault; it does not establish portability to a new computer.',
  { path: '/backups', validate: true },
);
add(
  'backup-restore-confirm',
  'backups',
  'تأكيد الاستعادة',
  'Restore confirmation',
  'الاستعادة تستبدل الحالة الحالية بحالة النسخة. احتفظ بنسخة حديثة قبلها. راجع التحذير ثم أكد أو ألغِ. لا توجد معاينة لما سيُستعاد.',
  'Restore replaces current state with the snapshot. Make a current backup first. Review the warning and confirm or cancel. There is no restore preview.',
  { path: '/backups', button: 'backups.restore' },
);
add(
  'backup-corrupt',
  'backups',
  'رفض نسخة تالفة',
  'Corrupt backup refused',
  'النسخة غير الصالحة تُرفض وتظل البيانات الحالية كما هي. اختر نسخة صحيحة وأعد الفحص؛ لا تغيّر محتوى الأرشيف يدويًا.',
  'An invalid archive is refused and current data remains intact. Choose a valid backup and validate again; do not manually alter the archive contents.',
  { path: '/backups', corrupt: true },
);
add(
  'backup-restored',
  'backups',
  'القفل بعد الاستعادة',
  'Lock after restore',
  'بعد استعادة ناجحة يُقفل التطبيق. افتحه بكلمة المرور وتحقق من السجلات والمستندات عند تاريخ النسخة. التغييرات التي حدثت بعدها لا توجد في الحالة المستعادة. النقل إلى مساحة جديدة بكلمة المرور وحدها غير مدعوم حاليًا.',
  'Successful restore locks the app. Unlock and verify records and documents as of the snapshot. Changes made afterward are absent from restored state. Restoring into a new vault with only the original password is currently unsupported.',
  { restored: true },
  'form',
);
for (const [tab, ar, en, at, et] of [
  [
    'profile',
    'بيانات المحامي',
    'Lawyer profile',
    'عدل الاسم ورقم القيد والهاتف وعنوان المكتب ثم احفظ. هذه بيانات مكتبك وليست حسابًا على الإنترنت.',
    'Edit name, bar number, phone, and office address, then save. These are your office details, not an online account.',
  ],
  [
    'general',
    'العرض والتقويم',
    'Display and calendar',
    'اختر العربية أو الإنجليزية، والمظهر الفاتح أو الداكن أو النظام، وصيغة التاريخ وبداية الأسبوع ومهلة التذكير الافتراضية ثم احفظ. لا يوجد حقل تذكير منفصل في نماذج المهام والجلسات الحالية.',
    'Choose Arabic or English, light/dark/system appearance, date format, week start, and default reminder lead time, then save. Current task and hearing forms have no separate reminder field.',
  ],
  [
    'security',
    'الأمان والتنبيهات',
    'Security and notifications',
    'حدد مهلة القفل واحفظ. التشغيل مع النظام اختياري؛ التنبيهات تتطلب إذن النظام وتشغيل التطبيق. تغيير كلمة المرور يتطلب الحالية والجديدة وتأكيدها. العدادات المحلية اختيارية ولا ترسل بيانات القضايا. راجع الجزء السفلي من الصفحة أيضًا.',
    'Set and save the lock timeout. Autostart is optional; notifications require system permission and the app running. Password change requires the current password, a new one, and confirmation. Local counters are optional and do not transmit case data. Also review the lower part of the page.',
  ],
  [
    'backups',
    'النسخ من الإعدادات',
    'Backups in Settings',
    'تحتوي الإعدادات على أدوات إنشاء النسخة وفحصها واستعادتها نفسها الموجودة في قسم النسخ الاحتياطي. لا يلزم إعداد النسخ لإكمال بدء الاستخدام.',
    'Settings contains the same create, validate, and restore tools as the Backup section. Backup setup is not required to finish onboarding.',
  ],
  [
    'privacy',
    'الخصوصية وموقع البيانات',
    'Privacy and data location',
    'راجع معلومات التخزين والمستندات والنسخ والاتصال بالشبكة. قاعدة البيانات مشفرة، لكن ملفات المستندات المدارة غير مشفرة كلٌ على حدة؛ استخدم حساب نظام محميًا وتشفير القرص.',
    'Review storage, document, backup, and network information. The database is encrypted, but managed documents are not individually encrypted; use a protected OS account and disk encryption.',
  ],
  [
    'about',
    'عن التطبيق',
    'About the app',
    'راجع اسم المنتج ورقم الإصدار وحالة التطبيق وروابط المعلومات المتاحة. التطبيق الحالي قبل الإصدار التجريبي؛ لا تعني نجاح اختبارات Linux اعتماد Windows أو macOS.',
    'Review product name, version, application status, and available information links. This application is pre-beta; passing Linux tests does not validate Windows or macOS.',
  ],
])
  add(
    `settings-${tab}`,
    'settings',
    ar,
    en,
    at,
    et,
    { path: `/settings?tab=${tab}` },
    ['profile', 'general', 'security'].includes(tab) ? 'form' : 'page',
  );
add(
  'password-mismatch',
  'settings',
  'تصحيح تأكيد كلمة المرور',
  'Correcting password confirmation',
  'إذا لم تتطابق الجديدة وتأكيدها تظهر رسالة ويبقى التغيير غير محفوظ. أدخلهما متطابقتين؛ يجب ألا تقل الجديدة عن 12 حرفًا.',
  'A mismatch between the new password and confirmation shows a message and does not save the change. Enter matching values; the new password must have at least 12 characters.',
  { passwordMismatch: true },
  'form',
);
add(
  'payment-inspect',
  'finance',
  'تفاصيل دفعة',
  'Payment details',
  'اضغط تاريخ الدفعة لمراجعة التفاصيل دون تعديل. زر تعديل يفتح نموذج التعديل؛ إغلاق يعود إلى السجل.',
  'Choose the payment date to inspect details without editing. Edit opens the editing form; Close returns to the register.',
  { finance: true, selector: 'tbody tr:first-child td:first-child .text-button' },
);
add(
  'expense-inspect',
  'finance',
  'تفاصيل مصروف والإيصالات',
  'Expense details and receipts',
  'اضغط تاريخ المصروف لمراجعة البيانات دون تعديل. تعديل يفتح النموذج وإغلاق يعود إلى السجل. إضافة إيصال للمصروف غير متاحة من هذه النافذة.',
  'Choose the expense date to inspect details without editing. Edit opens the form and Close returns to the register. Attaching receipts to an expense is unavailable in this dialog.',
  { finance: true, tab: 1, selector: 'tbody tr:first-child td:first-child .text-button' },
);
add(
  'date-picker',
  'agenda',
  'اختيار التاريخ',
  'Choosing a date',
  'اكتب التاريخ مثل 03/10/2026 أو 2026-10-03 ثم انتقل إلى حقل آخر، أو افتح زر التقويم واختر اليوم. يقبل الحقل الأرقام العربية ويعرض القيمة بعد تصحيحها بصيغة سنة-شهر-يوم. تظل القيمة تاريخًا بلا منطقة زمنية.',
  'Type a date such as 03/10/2026 or 2026-10-03, then leave the field, or open the calendar button and choose a day. Arabic digits are accepted. After normalization the field shows year-month-day. The value remains a date without a time zone.',
  { path: '/calendar?create=hearing', selector: '.dialog-surface .date-picker-trigger' },
  'calendar',
);
export { screens };

export const fieldHelp = bilingual(
  {
    'الرقم الداخلي': 'معرف فريد داخل مكتبك؛ لا يلزم أن يطابق الرقم الرسمي.',
    'رقم الموكل': 'معرف فريد للموكل داخل مكتبك.',
    الاسم: 'اكتب الاسم الكامل حتى يمكن العثور على السجل.',
    'كلمة المرور': 'استخدم 12 حرفًا على الأقل واحفظها بأمان.',
    'تأكيد كلمة المرور': 'أعد إدخال كلمة المرور نفسها.',
    القضية: 'اختر القضية المرتبطة بهذا السجل.',
    الموكل: 'اختر موكلًا موجودًا؛ دافع الدفعة يجب أن ينتمي للقضية.',
    المبلغ: 'أدخل مبلغًا موجبًا بالجنيه المصري، حتى منزلتين للقرش.',
    التاريخ: 'اكتب يوم/شهر/سنة أو سنة-شهر-يوم ثم انتقل لحقل آخر، أو اختر اليوم من التقويم.',
    الملاحظات: 'معلومات إضافية اختيارية محفوظة مع السجل.',
    حفظ: 'يحفظ البيانات؛ إلغاء يغلق دون حفظ المسودة.',
  },
  {
    Internal: 'Unique office identifier; separate from the official reference.',
    Name: 'Enter the full name so you can locate the record.',
    Password: 'Use at least 12 characters and keep it safe.',
    Confirm: 'Enter the same password again.',
    Case: 'Choose the case related to this record.',
    Client: 'Choose an existing client; payment payers must belong to the case.',
    Amount: 'Enter a positive EGP amount, with up to two piastre digits.',
    Date: 'Type day/month/year or year-month-day, then leave the field, or choose a day from the calendar.',
    Notes: 'Optional additional information saved with the record.',
    Save: 'Saves the data; Cancel closes without saving the draft.',
  },
);
