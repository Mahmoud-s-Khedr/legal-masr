# Copy guide — ليجال مصر / Legal Masr

Every word a lawyer reads in the app follows this guide: labels, buttons, messages, empty states, notifications and the README. Arabic is the source language. English is a faithful, natural translation, not a word-for-word one.

## Name

- Arabic: **ليجال مصر**. English: **Legal Masr**. Never "LegalMaster Solo" in user-facing text.
- Tagline: **مكتبك القانوني على جهازك** / **Your law office, on your computer**.
- Internal identifiers stay unchanged so existing data keeps working: bundle id `com.legalmaster.solo`, data folder `LegalMasterSolo`, database file, backup encryption domain, binary and crate names.

## Voice

- Write as a capable colleague. Be calm, brief and precise. Address the lawyer directly with «أنت» forms: «أضف»، «اكتب»، «اختر».
- Use clear Modern Standard Arabic that Egyptian lawyers use in practice. No colloquial spelling and no stiff officialese.
- Say what the lawyer gets or must do, not how the software works. Avoid «التطبيق ينفذ…», database, migration, token, timezone.
- Promise only what the product does and the tests prove. Disclose consequences plainly, especially for deletion, restore and passwords.

## Terminology

| Concept              | Arabic                    | English           | Notes                                                 |
| -------------------- | ------------------------- | ----------------- | ----------------------------------------------------- |
| Client               | الموكل / الموكلون         | Client            | Never «العميل».                                       |
| Case (the record)    | القضية                    | Case              | Navigation, lists, titles.                            |
| Court case reference | رقم الدعوى … لسنة …       | Court case number | Written «رقم 447 لسنة 2026».                          |
| Office file number   | رقم الملف الداخلي         | Internal file no. | The lawyer's own number; never just «رقم القضية».     |
| Hearing              | الجلسة                    | Hearing           | Never «موعد قانوني».                                  |
| Hearing outcome      | قرار الجلسة               | Hearing decision  | «تسجيل القرار».                                       |
| Next hearing         | الجلسة القادمة            | Next hearing      | After a postponement: «تأجيل إلى جلسة».               |
| Power of attorney    | التوكيل                   | Power of attorney | «مكتب التوثيق» for the notary office.                 |
| Opponent             | الخصم                     | Opponent          | Capacity: «الصفة».                                    |
| Fee                  | الأتعاب                   | Fee               | «الأتعاب المتفق عليها»، «المحصل»، «المتبقي».          |
| Payment / expense    | دفعة / مصروف              | Payment / expense |                                                       |
| Documents            | المستندات                 | Documents         | Use everywhere; not «المرفقات» or «الملفات المُدارة». |
| Task                 | مهمة / متابعة             | Task              |                                                       |
| Archive              | أرشفة / مؤرشف             | Archive           | Hides without deleting.                               |
| Lock / unlock        | قفل التطبيق / فتح التطبيق | Lock / unlock     | Never «الخزنة» (vault).                               |
| Recovery key         | مفتاح الاسترداد           | Recovery key      |                                                       |
| Backup               | نسخة احتياطية             | Backup            |                                                       |

## Patterns

- **Page titles** are nouns: «الموكلون»، «قضية جديدة».
- **Create buttons** read «إضافة …» («إضافة موكل»، «إضافة قضية»).
- **Save buttons** name the result: «حفظ الموكل»، «حفظ القضية»، «حفظ التعديلات».
- **Destructive confirmations** name the action and object: «حذف الجلسة»، «إزالة المستند». The dialog says what changes and what stays.
- **Errors** start with «تعذر …», then add one clause saying what to do. When entered data is kept, say «بياناتك ما زالت محفوظة في النموذج».
- **Empty states** state the fact, then the next action: «لا توجد مهام اليوم. أضف مهمة أو اعرض القادمة.»
- **Success** messages are short and past tense: «تم حفظ التعديلات.»
- **Field hints** give an example: «مثال: محكمة شمال القاهرة الابتدائية».

## Punctuation and numbers

- Arabic comma «،», semicolon «؛», question mark «؟», and the ellipsis character «…».
- Full sentences end with a period. Labels, buttons and titles do not.
- Western digits in the interface. Dates are Gregorian: «السبت، 3 أكتوبر 2026». Times use a 12-hour clock with «ص/م». Amounts read «1,500.00 ج.م.».
- Isolate mixed-direction values (identifiers, phones, emails, filenames) with `<bdi>`.
