/* global document, Image */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import MarkdownIt from 'markdown-it';
import { format, resolveConfig } from 'prettier';
import assert from 'node:assert/strict';
import { chapters, screens, fieldHelp } from './guide-content.mjs';
import { validateGuideManifest } from './user-guide-validation.mjs';

const root = 'docs/user-guide';
const formatting = await resolveConfig('package.json');
const manifest = JSON.parse(await readFile(join(root, 'capture-manifest.json'), 'utf8'));
for (const result of manifest.results) {
  result.scenario = result.scenario
    .replace('-archive-restore-through-ui', '-archive-via-ipc-restore-through-ui')
    .replace('task-create-edit-delete-through-ui', 'task-create-edit-through-ui-delete-via-ipc');
}
// Floating menus stay fixed while the underlying page scrolls; publish one view.
const floating = new Set(['quick-add', 'search', 'search-palette', 'date-picker']);
manifest.screenshots = manifest.screenshots.filter(
  (shot) => !floating.has(shot.id) || shot.part === 1,
);
for (const shot of manifest.screenshots) {
  if (floating.has(shot.id)) {
    const left = Math.max(0, Math.floor(Math.min(...shot.callouts.map((b) => b.x)) - 24));
    const top = Math.max(0, Math.floor(Math.min(...shot.callouts.map((b) => b.y)) - 24));
    const right = Math.min(
      shot.viewport.width,
      Math.ceil(Math.max(...shot.callouts.map((b) => b.x + b.width)) + 24),
    );
    const bottom = Math.min(
      shot.viewport.height,
      Math.ceil(Math.max(...shot.callouts.map((b) => b.y + b.height)) + 24),
    );
    shot.crop = { x: left, y: top, width: right - left, height: bottom - top };
  }
}
validateGuideManifest(manifest, screens);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const descriptions = {
  'source-file': [
    'اختيار الملف: حدد المستند؛ يحفظ التطبيق نسخة مدارة ويبقى الأصل في مكانه.',
    'File selection: choose a document; the app keeps a managed copy and leaves the original in place.',
  ],
  navigation: ['الأقسام: اختر القسم المطلوب لفتح صفحته.', 'Sections: select one to open its page.'],
  search: [
    'البحث: اكتب اسمًا أو رقمًا واختر النتيجة.',
    'Search: type a name or number and choose a result.',
  ],
  actions: [
    'الإضافة واللغة والقفل: اختصارات مساحة العمل.',
    'Add, language, and lock: workspace shortcuts.',
  ],
  filters: [
    'الترشيح: حدد شروط العرض؛ الفلاتر لا تغير السجلات.',
    'Filters: choose what to display; filters do not change records.',
  ],
  views: [
    'التبويبات والعرض: انتقل إلى القسم الذي تريد مراجعته.',
    'Tabs and views: switch to the section you want to review.',
  ],
  records: [
    'السجلات والإجراءات: افتح السجل أو استخدم الإجراء بجواره.',
    'Records and actions: open a record or use its adjacent action.',
  ],
  header: [
    'هوية الصفحة وإجراءاتها: راجع العنوان قبل الإضافة أو التعديل.',
    'Page identity and actions: check the heading before adding or editing.',
  ],
  schedule: [
    'المواعيد: راجع اليوم والروابط والتفاصيل المطلوبة.',
    'Schedule: review dates, links, and preparation details.',
  ],
  totals: [
    'الحساب: راجع الأرقام؛ المبالغ بالجنيه المصري.',
    'Account: review the totals; amounts are in EGP.',
  ],
  details: [
    'التفاصيل: اقرأ بيانات هذا القسم واتبع الخطوات أعلاه.',
    'Details: review this section and follow the instructions above.',
  ],
  confirmation: [
    'التأكيد: اقرأ ما سيحدث قبل الموافقة.',
    'Confirmation: read what will happen before proceeding.',
  ],
  'save-cancel': [
    'أزرار الإجراء: احفظ أو أكد عند اكتمال البيانات؛ إلغاء يحتفظ بالحالة السابقة.',
    'Action buttons: save or confirm when ready; Cancel keeps the previous state.',
  ],
  'recovery-key': [
    'مفتاح الاسترداد: القيمة محجوبة في الدليل؛ احفظ مفتاحك الحقيقي خارج الجهاز.',
    'Recovery key: hidden in the guide; save your real key separately from the computer.',
  ],
  'saved-key': [
    'تأكيد الحفظ: تابع فقط بعد حفظ مفتاحك بأمان.',
    'Saved-key confirmation: continue only after safely storing your key.',
  ],
  error: [
    'رسالة الخطأ: صحح السبب الموضح ثم أعد المحاولة.',
    'Error: correct the stated cause, then retry.',
  ],
};
const help = (lang, label) => {
  if (descriptions[label]) return descriptions[label][lang === 'ar' ? 0 : 1];
  for (const [term, explanation] of Object.entries(fieldHelp[lang]))
    if (label.toLowerCase().includes(term.toLowerCase())) return `${label}: ${explanation}`;
  return lang === 'ar'
    ? `${label}: راجع القيمة أو أدخل البيانات المناسبة لهذا الحقل ثم احفظ النموذج.`
    : `${label}: review the value or enter the relevant information, then save the form.`;
};
const css = `
@font-face{font-family:Cairo;src:url(assets/cairo-arabic.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF;font-display:block}
@font-face{font-family:Cairo;src:url(assets/cairo-latin.woff2) format('woff2');font-display:block}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;overflow-wrap:anywhere;background:#faf9f6;color:#182b29;font:17px/1.9 Cairo,Arial,sans-serif}header,main,nav,footer{max-width:1080px;margin:auto;padding:24px 36px}header{padding-top:64px;border-bottom:4px solid #0c635b}header p{color:#52615f}h1{font-size:38px;line-height:1.4}h2{color:#0c635b;border-bottom:1px solid #cbd7d4;padding-bottom:12px;margin-top:64px}h3{margin-top:48px}a{color:#075c53;text-underline-offset:3px}nav{background:#f0f4f1;border-radius:6px;margin-top:24px}nav ol{columns:2;column-gap:48px}nav li{break-inside:avoid}img{display:block;width:100%;height:auto;border:1px solid #d0d9d6;background:white}p:has(img){margin:24px 0 12px}li{margin:5px 0}blockquote{border-inline-start:4px solid #b74335;margin:24px 0;padding:12px 20px;background:#fff5ed}code{direction:ltr;unicode-bidi:isolate}footer{border-top:1px solid #cbd7d4;color:#52615f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd7d4;padding:8px;text-align:start}.provenance{color:#52615f;font-size:14px}@media(max-width:700px){header,main,nav,footer{padding:20px}nav ol{columns:1}h1{font-size:30px}}
@page{size:A4;margin:16mm 12mm 19mm} @media print{.formats{display:none}html{scroll-behavior:auto}body{background:white;font-size:10pt;line-height:1.65}header,main,nav,footer{padding:0;max-width:none}header{padding-bottom:12mm}nav{margin-top:8mm;background:white}h1{font-size:26pt}h2{break-before:page;margin-top:0;font-size:20pt}h3{break-before:page;margin-top:0;font-size:16pt}h1,h2,h3{break-after:avoid}p:has(img){break-inside:avoid;margin:5mm 0 3mm}img{max-height:155mm;object-fit:contain;border:0}a{color:inherit}blockquote{break-inside:avoid}li{break-inside:avoid}footer{margin-top:8mm}}
`;
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
let headingNumber = 0;
markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  if (tokens[index].tag === 'h2' || tokens[index].tag === 'h3')
    tokens[index].attrSet('id', `section-${++headingNumber}`);
  return self.renderToken(tokens, index, options);
};
// Every image opens its full-size local PNG for readable detail on small screens.
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const src = token.attrGet('src');
  token.attrSet('loading', 'lazy');
  token.attrSet('alt', token.content);
  return `<a href="${markdown.utils.escapeHtml(src)}" aria-label="${env.lang === 'ar' ? 'فتح الصورة بالحجم الكامل' : 'Open full-size screenshot'}">${self.renderToken(tokens, index, options)}</a>`;
};
try {
  for (const lang of ['ar', 'en']) {
    const folder = join(root, lang);
    await mkdir(join(folder, 'assets'), { recursive: true });
    for (const font of ['cairo-arabic.woff2', 'cairo-latin.woff2'])
      await copyFile(join('public/fonts', font), join(folder, 'assets', font));
    for (const shot of manifest.screenshots.filter((s) => s.locale === lang)) {
      const bytes = await readFile(join(folder, 'assets/originals', shot.filename));
      shot.originalSha256 = digest(bytes);
      const uri = `data:image/png;base64,${bytes.toString('base64')}`;
      await page.setViewportSize(shot.viewport);
      await page.setContent('<canvas></canvas>');
      const png = await page.evaluate(
        async ({ uri, callouts, crop }) => {
          const img = new Image();
          img.src = uri;
          await img.decode();
          const canvas = document.querySelector('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          callouts.forEach((box, index) => {
            const x = Math.max(3, box.x - 3),
              y = Math.max(3, box.y - 3),
              w = Math.min(canvas.width - x - 3, box.width + 6),
              h = Math.min(canvas.height - y - 3, box.height + 6);
            ctx.strokeStyle = '#d71920';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (box.shape === 'circle')
              ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            else ctx.rect(x, y, w, h);
            ctx.stroke();
            const cx = Math.min(canvas.width - 17, Math.max(17, x + 12)),
              cy = Math.max(17, y - 3);
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#d71920';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.fillText(String(index + 1), cx, cy + 1);
          });
          if (crop) {
            const clipped = document.createElement('canvas');
            clipped.width = crop.width;
            clipped.height = crop.height;
            clipped
              .getContext('2d')
              .drawImage(
                canvas,
                crop.x,
                crop.y,
                crop.width,
                crop.height,
                0,
                0,
                crop.width,
                crop.height,
              );
            return clipped.toDataURL('image/png').split(',')[1];
          }
          return canvas.toDataURL('image/png').split(',')[1];
        },
        { uri, callouts: shot.callouts, crop: shot.crop },
      );
      const annotated = Buffer.from(png, 'base64');
      await writeFile(join(folder, 'assets', shot.filename), annotated);
      shot.annotatedSha256 = digest(annotated);
    }
    const title = lang === 'ar' ? 'دليل مستخدم ليجال مصر' : 'Legal Masr user guide';
    const intro =
      lang === 'ar'
        ? 'برنامج مكتبي للمحامي المصري الفردي: الموكلون والقضايا والتوكيلات والجلسات والمهام والمستندات والمالية على جهازك. لا يحتاج الاستخدام اليومي إلى الإنترنت أو حساب. هذا الدليل يشرح الإصدار 0.1.0 قبل التجريبي. جميع الأسماء والملفات في الصور خيالية.'
        : 'A desktop organizer for Egyptian solo lawyers: clients, cases, powers of attorney, hearings, tasks, documents, and finances on your computer. Daily use needs no internet or account. This guide documents pre-beta version 0.1.0. All pictured records and files are fictional.';
    const how =
      lang === 'ar'
        ? 'الأرقام داخل العلامات الحمراء تقابل الشرح أسفل كل صورة. الصفحات الطويلة مقسمة إلى صور متتابعة. افتح الصور بالحجم الكامل من صفحة HTML أو ملف الصور. خطوات الدليل تصف الواجهة الحالية؛ لا تعد وعدًا بميزات مستقبلية.'
        : 'Numbers inside red marks correspond to explanations below each screenshot. Long pages are split into successive screenshots. Open full-size images from HTML or the image folder. Instructions describe the current interface and do not promise future features.';
    const lines = [
      `# ${title}`,
      '',
      intro,
      '',
      how,
      '',
      lang === 'ar'
        ? '**مسار يومي مقترح:** أضف الموكل ← سجل التوكيل عند الحاجة ← أنشئ القضية وحدد موكليها ← سجل الجلسة والمهام ← أرفق المستندات ← سجل الأتعاب والدفعات ← أنشئ نسخة احتياطية.'
        : '**Suggested daily flow:** add a client → record a power of attorney if needed → create a case and link clients → add hearings and tasks → attach documents → record fees and payments → create a backup.',
      '',
    ];
    for (const [chapter, ar, en] of chapters) {
      lines.push(`## ${lang === 'ar' ? ar : en}`, '');
      for (const screen of screens.filter((s) => s.chapter === chapter)) {
        const shots = manifest.screenshots.filter((s) => s.locale === lang && s.id === screen.id);
        assert(shots.length, `Missing ${lang}/${screen.id}`);
        lines.push(`### ${screen.title[lang]}`, '', screen.text[lang], '');
        for (const shot of shots) {
          lines.push(
            `![${screen.title[lang]}${shots.length > 1 ? ` (${shot.part}/${shots.length})` : ''}](assets/${shot.filename})`,
            '',
          );
          shot.callouts.forEach((c, i) => lines.push(`${i + 1}. ${help(lang, c.label)}`));
          lines.push('');
        }
      }
    }
    lines.push(
      `## ${lang === 'ar' ? 'استكشاف المشكلات والحدود الحالية' : 'Troubleshooting and current limitations'}`,
      '',
    );
    const rows =
      lang === 'ar'
        ? [
            ['المشكلة', 'ما يمكنك فعله'],
            ['رقم داخلي مستخدم', 'اختر رقمًا آخر؛ الرقم الداخلي يجب أن يكون فريدًا.'],
            ['لا يظهر الموكل أو القضية', 'أزل الفلاتر وجرب إظهار المؤرشف ثم ابحث بالرقم الداخلي.'],
            [
              'دافع الدفعة غير متاح',
              'يجب اختيار الموكل عند إنشاء القضية؛ تغيير روابط الموكلين بعد الإنشاء غير متاح في الواجهة الحالية.',
            ],
            ['تاريخ غير مقبول', 'اختره من التقويم أو اكتب تاريخًا حقيقيًا بصيغة يوم/شهر/سنة.'],
            [
              'ملف مستند مفقود',
              'تحقق من النسخة المدارة أو استعد نسخة سليمة في مساحة البيانات الأصلية.',
            ],
            [
              'تنبيه لا يظهر',
              'تحقق من إذن النظام ومن تشغيل التطبيق؛ تحقق المنصات الفعلي ما زال معلقًا.',
            ],
            ['نسخة احتياطية تالفة', 'لا تُستبدل البيانات الحالية؛ جرب أرشيفًا صحيحًا.'],
            ['نسيان كلمة المرور', 'استخدم مفتاح الاسترداد؛ لا يوجد استرداد عبر البريد أو الدعم.'],
          ]
        : [
            ['Problem', 'What to do'],
            [
              'Internal number already used',
              'Choose another number; internal identifiers must be unique.',
            ],
            [
              'Client or case missing',
              'Clear filters, include archived records, and search by internal number.',
            ],
            [
              'Payment payer unavailable',
              'Select the client when creating the case; changing client links afterward is unavailable in the current interface.',
            ],
            ['Date rejected', 'Choose it from the calendar or enter a real day/month/year date.'],
            [
              'Document file missing',
              'Check the managed copy or restore an intact snapshot in the original vault.',
            ],
            [
              'Notification missing',
              'Check OS permission and that the app is running; physical platform validation remains pending.',
            ],
            ['Corrupt backup', 'Current data is preserved; try a valid archive.'],
            [
              'Forgotten password',
              'Use the recovery key; email/support password recovery is unavailable.',
            ],
          ];
    lines.push(
      `| ${rows[0].join(' | ')} |`,
      '| --- | --- |',
      ...rows.slice(1).map((r) => `| ${r.join(' | ')} |`),
      '',
    );
    lines.push(
      lang === 'ar'
        ? '**حدود مهمة:** لا يدعم الإصدار الحالي نقل نسخة إلى مساحة جديدة بكلمة المرور وحدها، أو النسخ التلقائي أو الاحتفاظ المجدول، أو معاينة الاستعادة، أو تصدير كامل للبيانات أو للقضية، أو حذفًا نهائيًا للموكلين والقضايا. التطبيق لمكتب فردي وليس نظام محاسبة أو تعاون متعدد المستخدمين.'
        : '**Important limits:** the current version cannot restore into an independently initialized vault with only the original password, schedule backups/retention, preview restores, export a complete installation/case, or permanently delete clients/cases. It is a solo-lawyer organizer, not an accounting or multi-user collaboration system.',
      '',
    );
    lines.push(
      `## ${lang === 'ar' ? 'حول هذا الدليل' : 'About this guide'}`,
      '',
      lang === 'ar'
        ? 'الصور مأخوذة من تطبيق Tauri الحقيقي على Linux، باستخدام مساحة بيانات مؤقتة خيالية وعمليات حفظ فعلية. اختيار الملفات في الاختبارات يستخدم بديلًا محددًا مسبقًا؛ نوافذ النظام والتثبيت والتنبيهات على Windows وmacOS لم تُعتمد بهذه الصور. مفتاح الاسترداد محجوب عمدًا.'
        : 'Screenshots come from the real Tauri application on Linux using a temporary fictional vault and actual persistence. Test file selection uses an allowlisted substitute; these screenshots do not validate OS dialogs, installation, or notifications on Windows/macOS. The recovery key is intentionally hidden.',
      '',
      `Source revision: ${manifest.sourceRevision}. Working-tree changes included. Capture date: ${manifest.generatedAt.slice(0, 10)}.`,
      '',
    );
    let md;
    if (process.argv.includes('--refresh-content')) md = lines.join('\n');
    else {
      try {
        md = await readFile(join(folder, 'guide.md'), 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        md = lines.join('\n');
      }
    }
    md = await format(md, { ...formatting, parser: 'markdown' });
    await writeFile(join(folder, 'guide.md'), md);
    headingNumber = 0;
    const rendered = markdown.render(md, { lang }).replace(/^<h1>[^<]*<\/h1>\n/, '');
    const headingMatches = [...rendered.matchAll(/<h([23]) id="([^"]+)">([^<]+)<\/h\1>/g)];
    const toc = headingMatches
      .filter((m) => m[1] === '2')
      .map((m) => `<li><a href="#${m[2]}">${m[3]}</a></li>`)
      .join('');
    const html = `<!doctype html>\n<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body><header><h1>${title}</h1><p>${lang === 'ar' ? 'دليل مصور • الإصدار 0.1.0 • يعمل دون إنترنت' : 'Illustrated guide • Version 0.1.0 • Available offline'}</p><p class="formats"><a href="guide.pdf">PDF</a> · <a href="guide.md">Markdown</a> · <a href="../${lang === 'ar' ? 'en' : 'ar'}/index.html">${lang === 'ar' ? 'English' : 'العربية'}</a></p></header><nav aria-label="${lang === 'ar' ? 'المحتويات' : 'Contents'}"><strong>${lang === 'ar' ? 'المحتويات' : 'Contents'}</strong><ol>${toc}</ol></nav><main>${rendered}</main><footer>Legal Masr · 0.1.0</footer></body></html>`;
    await writeFile(
      join(folder, 'index.html'),
      await format(html, { ...formatting, parser: 'html' }),
    );
    await page.goto(pathToFileURL(resolve(folder, 'index.html')).href);
    await page.evaluate(async () => {
      document.querySelectorAll('img').forEach((img) => (img.loading = 'eager'));
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    assert.equal(
      await page.locator('img').count(),
      manifest.screenshots.filter((s) => s.locale === lang).length,
    );
    assert.equal(await page.locator('html').getAttribute('dir'), lang === 'ar' ? 'rtl' : 'ltr');
    // PDF is standalone: retain internal contents links, not development file URLs.
    await page.evaluate(() => {
      for (const link of document.querySelectorAll('a[href]'))
        if (!link.getAttribute('href').startsWith('#')) link.removeAttribute('href');
    });
    await page.pdf({
      path: join(folder, 'guide.pdf'),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font:9px Arial;text-align:center;color:#53605d"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    console.log(`${lang}: Markdown, offline HTML, and PDF generated`);
  }
  await writeFile(join(root, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const trace = [
    '# Guide coverage and native test evidence',
    '',
    'Every row below identifies a documented screen state. Passing render checks establish that the native screen was reached; they do not establish every action on that screen. Functional scenarios are listed separately with their actual UI/IPC scope in their names and the validation report.',
    '',
    '| Screen ID | Screen | Arabic screenshots | English screenshots | Native render checks |',
    '| --- | --- | --- | --- | --- |',
    ...screens.map((screen) => {
      const links = (locale) =>
        manifest.screenshots
          .filter((shot) => shot.id === screen.id && shot.locale === locale)
          .map((shot) => `[${shot.part}](${locale}/assets/${shot.filename})`)
          .join(' · ');
      const passed = ['ar', 'en'].every((locale) =>
        manifest.results.some(
          (r) =>
            r.locale === locale && r.scenario === `screen-${screen.id}` && r.result === 'passed',
        ),
      );
      return `| ${screen.id} | ${screen.title.en} | ${links('ar')} | ${links('en')} | ${passed ? 'Passed in both languages' : 'Native capture; access checks below'} |`;
    }),
    '',
    '## Functional scenarios',
    '',
    '| Scenario | Arabic | English | Layer |',
    '| --- | --- | --- | --- |',
    ...[
      ...new Set(
        manifest.results.filter((r) => r.layer !== 'native-screen-render').map((r) => r.scenario),
      ),
    ].map((scenario) => {
      const outcome = (locale) =>
        manifest.results.find((r) => r.locale === locale && r.scenario === scenario)?.result ??
        'Not run';
      return `| ${scenario} | ${outcome('ar')} | ${outcome('en')} | Native UI / real IPC |`;
    }),
    '',
    'See [validation report](validation-report.md) for regression results and outstanding platform/product limits.',
    '',
  ];
  await writeFile(
    join(root, 'traceability.md'),
    await format(trace.join('\n'), { ...formatting, parser: 'markdown' }),
  );
} finally {
  await browser.close();
}
