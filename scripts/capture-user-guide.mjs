/* global document, requestAnimationFrame, innerWidth, innerHeight, HTMLInputElement */
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { openGuideDesktop } from './guide-desktop.mjs';
import { screens } from './guide-content.mjs';

const output = 'docs/user-guide';
const preflight = process.argv.includes('--functional-preflight');
const testsOnly = preflight || process.argv.includes('--tests-only');
const catalog = Object.fromEntries(
  await Promise.all(
    ['ar', 'en'].map(async (lang) => [
      lang,
      JSON.parse(await readFile(`src/i18n/${lang}/common.json`, 'utf8')),
    ]),
  ),
);
const get = (lang, key) => key.split('.').reduce((o, k) => o?.[k], catalog[lang]);
const allResults = [];
const manifest = {
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeChangesIncluded: true,
  generatedAt: new Date().toISOString(),
  platform: 'linux',
  source: 'native-tauri-webkit-real-ipc',
  filePicker: 'desktop-e2e allowlisted substitute; physical dialogs unverified',
  theme: 'light',
  timezone: process.env.TZ || 'system',
  screenshots: [],
  results: allResults,
};
if (testsOnly && !preflight) {
  const previous = JSON.parse(await readFile(join(output, 'capture-manifest.json'), 'utf8'));
  allResults.push(...previous.results.filter((r) => r.result !== 'failed'));
  Object.assign(manifest, previous, { results: allResults });
}
let stage = 'start';

async function capture(h, screen) {
  if (testsOnly) return;
  const folder = join(output, h.language, 'assets');
  await mkdir(join(folder, 'originals'), { recursive: true });
  await h.browser.execute(() => {
    if (!document.querySelector('#guide-capture-style')) {
      const style = document.createElement('style');
      style.id = 'guide-capture-style';
      style.textContent =
        '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}';
      document.head.append(style);
    }
    document.scrollingElement.scrollTop = 0;
    document.querySelectorAll('.dialog-surface').forEach((el) => (el.scrollTop = 0));
  });
  await h.browser.executeAsync((done) =>
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await h.browser
    .waitUntil(
      async () => !(await h.browser.$('.workspace [aria-label*="loading" i]').isExisting()),
      { timeout: 10000 },
    )
    .catch(() => {});
  assert(
    await h.browser.execute(() => {
      const key = document.querySelector('.recovery-key');
      return !key || key.textContent.includes('HIDDEN');
    }),
    'Recovery key must be redacted before screenshots',
  );
  const geometry = await h.browser.execute(() => {
    const target =
      document.querySelector('.dialog-surface:last-of-type') || document.scrollingElement;
    return { total: target.scrollHeight, height: target.clientHeight };
  });
  const offsets = [0];
  if (geometry.total > geometry.height + 50) {
    for (
      let y = Math.max(150, geometry.height - 150);
      y < geometry.total - geometry.height;
      y += Math.max(150, geometry.height - 150)
    )
      offsets.push(y);
    offsets.push(geometry.total - geometry.height);
  }
  for (const [part, offset] of offsets.entries()) {
    await h.browser.execute((y) => {
      const target = document.querySelector('.dialog-surface') || document.scrollingElement;
      target.scrollTop = y;
    }, offset);
    await h.browser.executeAsync((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    const data = await h.browser.execute(
      (kind) => {
        const dialog = [...document.querySelectorAll('.dialog-surface')].at(-1);
        const root =
          dialog || document.querySelector('.gate-card') || document.querySelector('.workspace');
        const width = innerWidth,
          height = innerHeight;
        const out = [];
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const clip = dialog?.getBoundingClientRect();
          const top = Math.max(0, clip?.top || 0),
            bottom = Math.min(height, clip?.bottom || height);
          return (
            r.width > 10 &&
            r.height > 10 &&
            r.top >= top &&
            r.bottom <= bottom &&
            r.left >= 0 &&
            r.right <= width
          );
        };
        const add = (el, label, shape = 'rectangle') => {
          if (!el || !visible(el)) return;
          const r = el.getBoundingClientRect();
          out.push({ x: r.x, y: r.y, width: r.width, height: r.height, label, shape });
        };
        const form = root?.querySelector('form');
        if (kind === 'calendar') {
          add(document.querySelector('.date-picker-popover'), 'schedule');
        } else if (kind === 'shell') {
          add(
            document.querySelector('.sidebar nav') || document.querySelector('.sidebar'),
            'navigation',
          );
          add(document.querySelector('.search-wrap'), 'search');
          add(document.querySelector('.topbar-actions'), 'actions');
        } else if (kind === 'quick-add' || kind === 'search' || kind === 'search-palette') {
          add(
            document.querySelector(
              kind === 'quick-add'
                ? '.create-menu'
                : kind === 'search'
                  ? '.global-search-results'
                  : '.command-palette',
            ),
            'records',
          );
        } else if (form) {
          for (const label of root.querySelectorAll('form label')) {
            // Outer client-picker labels can contain nested labels: explain the inner controls once.
            if (label.querySelector('label')) continue;
            const clone = label.cloneNode(true);
            clone
              .querySelectorAll('input,textarea,button,svg,select,[role="combobox"]')
              .forEach((el) => el.remove());
            const text = clone.textContent.replace(/\s+/g, ' ').trim();
            if (text) add(label.closest('.field') || label, text);
          }
          for (const fieldset of form.querySelectorAll('fieldset'))
            if (!fieldset.querySelector('label'))
              add(fieldset, fieldset.querySelector('legend')?.textContent || 'relationships');
          const actions = form.querySelector('.dialog-actions,.form-actions,.gate-actions');
          if (actions) add(actions, 'save-cancel');
          else {
            const submits = form.querySelectorAll('button[type="submit"],button:not([type])');
            if (submits.length) add(submits[submits.length - 1], 'save-cancel');
          }
        } else {
          const candidates = [
            ['.entity-list-toolbar,.finance-filters,.task-filters', 'filters'],
            ['[role="tablist"],.settings-nav,.calendar-toolbar', 'views'],
            [
              'tbody,.attachment-rows,.task-records,.global-search-results,.create-menu,.command-palette',
              'records',
            ],
            ['.record-header,.page-header', 'header'],
            [
              '.agenda-timeline,.today-main,.calendar-grid,.calendar-week-list,.agenda-list,.agenda-day',
              'schedule',
            ],
            ['.finance-summary', 'totals'],
            [
              '.detail-card,.detail-definition-grid,.backup-settings,.settings-content,.gate-card',
              'details',
            ],
            ['.dialog-description', 'confirmation'],
            ['.dialog-actions', 'save-cancel'],
            ['.recovery-key', 'recovery-key'],
            ['.gate-confirm', 'saved-key'],
          ];
          for (const [selector, label] of candidates) {
            for (const el of (root || document).querySelectorAll(selector)) {
              add(el, label);
              if (out.length >= 5) break;
            }
            if (out.length >= 5) break;
          }
          if (dialog && !out.length) add(dialog, 'details');
        }
        for (const el of (root || document).querySelectorAll('[role="alert"],.error'))
          add(el, 'error');
        if (!['shell', 'calendar', 'quick-add', 'search', 'search-palette'].includes(kind)) {
          for (const [selector, label] of [
            ['.finance-summary', 'totals'],
            [
              '.detail-card,.settings-section,.today-stats,.transaction-inspection > div:not(.dialog-actions)',
              'details',
            ],
            ['.attention-panel,.register-section', 'schedule'],
            ['.document-pick', 'source-file'],
          ])
            for (const el of root.querySelectorAll(selector)) add(el, label);
        }
        // Keep only non-overlapping marks; nested containers would obscure field-level explanations.
        const accepted = [];
        for (const item of out) {
          if (
            !accepted.some(
              (a) =>
                item.x < a.x + a.width &&
                item.x + item.width > a.x &&
                item.y < a.y + a.height &&
                item.y + item.height > a.y,
            )
          )
            accepted.push(item);
        }
        const r = (kind === 'shell' ? document.documentElement : root).getBoundingClientRect();
        const crop =
          kind === 'shell'
            ? { x: 0, y: 0, width, height }
            : {
                x: Math.max(0, Math.floor(r.x - 16)),
                y: Math.max(0, Math.floor(r.y - 16)),
                width: Math.min(width, Math.ceil(r.right + 16)) - Math.max(0, Math.floor(r.x - 16)),
                height:
                  Math.min(height, Math.ceil(r.bottom + 16)) - Math.max(0, Math.floor(r.y - 16)),
              };
        return {
          crop,
          viewport: { width, height },
          direction: document.documentElement.dir,
          language: document.documentElement.lang,
          callouts: accepted,
        };
      },
      ['quick-add', 'search', 'search-palette'].includes(screen.id) ? screen.id : screen.kind,
    );
    assert(data.callouts.length > 0, `No visible callout for ${screen.id}`);
    const filename = `${screen.id}${part ? `-${part + 1}` : ''}.png`;
    await writeFile(
      join(folder, 'originals', filename),
      Buffer.from(await h.browser.takeScreenshot(), 'base64'),
    );
    manifest.screenshots.push({
      id: screen.id,
      part: part + 1,
      locale: h.language,
      screenLocale: data.language,
      filename,
      viewport: data.viewport,
      crop: data.crop,
      direction: data.direction,
      source: 'native-tauri-webkit-real-ipc',
      callouts: data.callouts,
    });
  }
  console.log(`${h.language}: captured ${screen.id} (${offsets.length})`);
}

async function run(language) {
  const h = await openGuideDesktop(language);
  const text = (key) => get(language, key);
  const button = (key, scope) => h.button(text(key), scope);
  const saveResult = (scenario, result = 'passed') => {
    allResults.push({
      locale: language,
      scenario,
      result,
      layer: scenario.startsWith('screen-') ? 'native-screen-render' : 'native-desktop-real-ipc',
    });
    if (!scenario.startsWith('screen-')) console.log(`${language}: ${scenario}: ${result}`);
  };
  const check = async (name, action) => {
    stage = name;
    await action();
    saveResult(name);
  };
  const rejected = async (cmd, args, codes) => {
    let failed = false;
    try {
      await h.invoke(cmd, args);
    } catch (error) {
      failed = true;
      assert(codes.includes(error.code));
    }
    assert(failed);
  };
  const password = 'Fictional Guide Password 2026';
  let recoveryKey;
  try {
    if (manifest.binarySha256)
      assert.equal(
        manifest.binarySha256,
        h.binarySha256,
        'Functional rerun must use the captured binary',
      );
    manifest.binarySha256 = h.binarySha256;
    stage = 'setup';
    await h.wait('input[name="fullName"]');
    if (language === 'en') await h.click('.language-switcher');
    // Use the actual first-run language control; no translation is injected into screenshots.
    await capture(
      h,
      screens.find((s) => s.id === 'setup'),
    );
    await h.click('.gate-card form button:not([type])');
    await h.wait('.field-error');
    await capture(
      h,
      screens.find((s) => s.id === 'setup-validation'),
    );
    await h.fill(
      'input[name="fullName"]',
      language === 'ar' ? 'محامٍ تجريبي — بيانات خيالية' : 'Demo lawyer — fictional data',
    );
    await h.fill('input[name="password"]', password);
    await h.fill('input[name="confirmPassword"]', password);
    await h.click('.gate-card form button:not([type])');
    await h.wait('.recovery-key');
    recoveryKey = await h.browser.$('.recovery-key').getText();
    await h.browser.execute(
      () =>
        (document.querySelector('.recovery-key').textContent =
          '[RECOVERY KEY HIDDEN / مفتاح الاسترداد محجوب]'),
    );
    await capture(
      h,
      screens.find((s) => s.id === 'recovery-key'),
    );
    await h.click('.gate-confirm [role="checkbox"]');
    await h.click('.recovery-key-step > button');
    await h.wait('nav');
    await h.browser.waitUntil(
      async () => (await h.browser.$('html').getAttribute('lang')) === language,
      { timeout: 15000 },
    );
    saveResult('initialize-through-ui-and-save-recovery-key');
    stage = 'unlock';
    await button('nav.lock');
    await h.wait('input[name="password"]');
    await capture(
      h,
      screens.find((s) => s.id === 'unlock'),
    );
    stage = 'wrong-password';
    await h.fill('input[name="password"]', 'Incorrect fictional password');
    await button('gate.submit.unlock');
    await h.wait('[role="alert"]');
    await h.fill('input[name="password"]', '');
    await capture(
      h,
      screens.find((s) => s.id === 'wrong-password'),
    );
    assert.equal(await h.browser.$('.workspace').isExisting(), false);
    saveResult('wrong-password-preserves-locked-gate');
    stage = 'recovery';
    await button('gate.haveRecoveryKey');
    await h.wait('input[name="recoveryKey"]');
    assert.equal(await h.browser.$('[role="alert"]').isExisting(), false);
    saveResult('recovery-gate-hides-stale-unlock-error');
    await capture(
      h,
      screens.find((s) => s.id === 'recovery'),
    );
    await button('gate.backToUnlock');
    await h.fill('input[name="password"]', password);
    await button('gate.submit.unlock');
    await h.wait('.workspace');
    const today = await h.browser.execute(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const shift = (days) => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    manifest.fixtureDate = today;
    const name = language === 'ar' ? 'عادل المثال — موكل خيالي' : 'Adel Example — fictional client';
    stage = 'client-ui-create';
    await h.go('/clients/new');
    await h.fill('[name="internalNumber"]', 'CL-DEMO-001');
    await h.fill('[name="fullName"]', name);
    await button('clients.save');
    await h.wait('.record-header');
    const client = (await h.invoke('client_list', { input: {} })).find(
      (c) => c.internalNumber === 'CL-DEMO-001',
    );
    assert(client);
    saveResult('client-create-through-ui');
    const second = await h.invoke('client_create', {
      input: {
        internalNumber: 'CL-DEMO-002',
        fullName:
          language === 'ar' ? 'منى المثال — موكلة خيالية' : 'Mona Example — fictional client',
        confirmDuplicate: true,
      },
    });
    const outsider = await h.invoke('client_create', {
      input: {
        internalNumber: 'CL-DEMO-003',
        fullName: language === 'ar' ? 'موكل خارج القضية — خيالي' : 'Unrelated fictional client',
        confirmDuplicate: true,
      },
    });
    const caseName = 'CASE-DEMO-001';
    await h.go('/cases/new');
    await h.fill('[name="internalNumber"]', caseName);
    await h.click('form [role="checkbox"]');
    await button('cases.save');
    await h.wait('.record-header');
    let caseItem = (await h.invoke('case_list', { input: {} })).find(
      (c) => c.internalNumber === caseName,
    );
    assert(caseItem);
    saveResult('case-create-through-ui');
    const poa = await h.invoke('power_of_attorney_create', {
      input: {
        internalSequence: 'POA-DEMO-001',
        officialNumber: '123',
        issueDate: shift(-30),
        issueYear: Number(today.slice(0, 4)),
        notaryOffice: language === 'ar' ? 'مكتب توثيق تجريبي' : 'Fictional notary office',
        clientIds: [client.id, second.id],
        lawyers: [
          {
            fullName: language === 'ar' ? 'محامٍ تجريبي' : 'Fictional lawyer',
            barNumber: 'DEMO-2026',
          },
        ],
      },
    });
    const caseInput = {
      internalNumber: caseName,
      officialNumber: '447',
      officialYear: Number(today.slice(0, 4)),
      courtName: language === 'ar' ? 'محكمة تجريبية' : 'Fictional court',
      circuitName: language === 'ar' ? 'الدائرة الثالثة' : 'Third circuit',
      caseType: language === 'ar' ? 'مدني' : 'Civil',
      litigationDegree: 'FIRST_INSTANCE',
      status: 'ACTIVE',
      filedOn: shift(-20),
      subject: language === 'ar' ? 'مطالبة خيالية لغرض الدليل' : 'Fictional claim for this guide',
      notes: language === 'ar' ? 'جميع البيانات خيالية.' : 'All data is fictional.',
      clients: [
        {
          clientId: client.id,
          legalCapacity: language === 'ar' ? 'مدعٍ' : 'Claimant',
          powerOfAttorneyId: poa.id,
        },
        {
          clientId: second.id,
          legalCapacity: language === 'ar' ? 'مدعٍ' : 'Claimant',
          powerOfAttorneyId: poa.id,
        },
      ],
    };
    await h.invoke('case_update', { input: { id: caseItem.id, ...caseInput } });
    await h.invoke('client_update', {
      input: {
        id: client.id,
        internalNumber: client.internalNumber,
        fullName: name,
        primaryPhone: '01000000000',
        email: 'guide@example.invalid',
        address: language === 'ar' ? 'عنوان تجريبي، القاهرة' : 'Fictional address, Cairo',
        notes: language === 'ar' ? 'سجل خيالي للتوضيح فقط.' : 'Fictional illustration record only.',
      },
    });
    await h.invoke('case_add_opponent', {
      input: {
        caseId: caseItem.id,
        fullName: language === 'ar' ? 'شركة المثال — خيالية' : 'Example company — fictional',
        legalCapacity: language === 'ar' ? 'مدعى عليه' : 'Defendant',
        lawyerName: language === 'ar' ? 'محامٍ خيالي' : 'Fictional opponent lawyer',
      },
    });
    const hearing = await h.invoke('hearing_create', {
      input: {
        caseId: caseItem.id,
        hearingDate: today,
        hearingTime: '10:30',
        hearingType: language === 'ar' ? 'جلسة نظر' : 'Hearing',
        location: caseInput.courtName,
        circuitName: caseInput.circuitName,
        requiredDocuments: language === 'ar' ? 'مذكرة تجريبية' : 'Fictional pleading',
        reminderMinutes: 60,
      },
    });
    const task = await h.invoke('task_create', {
      input: {
        caseId: caseItem.id,
        clientId: client.id,
        title: language === 'ar' ? 'مراجعة مذكرة تجريبية' : 'Review fictional pleading',
        dueDate: today,
        details:
          language === 'ar'
            ? 'إعداد مستند تجريبي للجلسة.'
            : 'Prepare a fictional hearing document.',
      },
    });
    await h.invoke('task_create', {
      input: {
        title: language === 'ar' ? 'مهمة متأخرة — خيالية' : 'Overdue fictional task',
        dueDate: shift(-1),
      },
    });
    await h.invoke('task_create', {
      input: {
        title: language === 'ar' ? 'مهمة قادمة — خيالية' : 'Upcoming fictional task',
        dueDate: shift(3),
      },
    });
    const doneTask = await h.invoke('task_create', {
      input: {
        title: language === 'ar' ? 'مهمة مكتملة — خيالية' : 'Completed fictional task',
        dueDate: shift(-2),
      },
    });
    await h.invoke('task_complete', { id: doneTask.id });
    await h.invoke('hearing_create', {
      input: {
        caseId: caseItem.id,
        hearingDate: shift(5),
        hearingType: language === 'ar' ? 'جلسة قادمة' : 'Upcoming hearing',
      },
    });
    await h.invoke('fee_agreement_save', { input: { caseId: caseItem.id, amountMinor: 300000 } });
    const payment = await h.invoke('payment_save', {
      input: {
        caseId: caseItem.id,
        payerClientId: client.id,
        amountMinor: 150025,
        paymentDate: today,
        paymentMethod: 'CASH',
        notes: language === 'ar' ? 'دفعة تجريبية' : 'Fictional payment',
      },
    });
    const expense = await h.invoke('expense_save', {
      input: {
        caseId: caseItem.id,
        clientId: client.id,
        amountMinor: 25000,
        expenseDate: today,
        expenseType: 'COURT_FEE',
        notes: language === 'ar' ? 'رسم تجريبي' : 'Fictional fee',
      },
    });
    await h.invoke('attachment_add', {
      input: {
        caseId: caseItem.id,
        sourceToken: (await h.invoke('attachment_select_source')).sourceToken,
        category: 'CASE_FILE',
        description: language === 'ar' ? 'مستند تجريبي' : 'Fictional document',
        documentDate: today,
      },
    });
    for (const owner of [
      { clientId: client.id },
      { powerOfAttorneyId: poa.id },
      { expenseId: expense.id },
    ])
      await h.invoke('attachment_add', {
        input: {
          ...owner,
          sourceToken: (await h.invoke('attachment_select_source')).sourceToken,
          category: 'OTHER',
          description: language === 'ar' ? 'نسخة تجريبية' : 'Fictional copy',
        },
      });
    // Remount pages through the dashboard so deep-link create intents and default tabs reset.
    const go = async (path) => {
      await h.go(path === '/' ? '/clients' : '/');
      await h.browser.executeAsync((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      await h.go(path);
      await h.browser.executeAsync((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    };
    const paths = {
      client: `/clients/${client.id}`,
      poa: `/powers-of-attorney/${poa.id}`,
      case: `/cases/${caseItem.id}`,
    };
    for (const screen of testsOnly ? [] : screens.filter((s) => !s.action.gate)) {
      stage = screen.id;
      const a = screen.action;
      if (a.entity) await go(paths[a.entity]);
      else if (a.finance) await go(`/finances?case=${caseItem.id}`);
      else if (a.hearing) await go(`/calendar?hearing=${hearing.id}`);
      else if (a.task) await go(`/tasks?task=${task.id}`);
      else if (a.duplicate) {
        await go('/clients/new');
        await h.fill('[name="internalNumber"]', 'CL-DEMO-DUP');
        await h.fill('[name="fullName"]', name);
        await button('clients.save');
        await h.wait('.warning');
      } else if (a.missingDocument) {
        await go(paths.case);
        await h.tab(4);
        await h.wait('.attachment-actions');
        const managed = (await h.invoke('attachment_list', { input: { caseId: caseItem.id } }))[0];
        await rename(
          join(h.root, 'vault/attachments', managed.storedFilename),
          join(h.root, 'fixtures/missing-document'),
        );
        await h.click('.attachment-actions button');
        await h.wait('[role="alert"]');
        await rename(
          join(h.root, 'fixtures/missing-document'),
          join(h.root, 'vault/attachments', managed.storedFilename),
        );
        saveResult('missing-managed-document-open-refused');
      } else if (a.hearingDelete) {
        await go(`/calendar?date=${today}`);
        await button('agenda.deleteHearing');
      } else if (a.restored) {
        await h.selection('backup');
        await go('/backups');
        await button('backups.restore');
        await button('backups.restoreConfirm', '.dialog-surface');
        await h.wait('.gate');
        saveResult('restore-through-ui-locks-and-clears-workspace');
      } else if (a.passwordMismatch) {
        await go('/settings?tab=security');
        await h.browser.execute(() => {
          const inputs = document.querySelectorAll('input[type="password"]');
          for (const [i, el] of [...inputs].entries()) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(
              el,
              i === 0
                ? 'Fictional Guide Password 2026'
                : i === 1
                  ? 'New Fictional Password 2026'
                  : 'Different Fictional Password',
            );
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        await button('settings.security.passwordTitle', 'form');
        await h.wait('.error');
        await h.browser.execute(() =>
          document.querySelectorAll('input[type="password"]').forEach((el) => (el.value = '')),
        );
        saveResult('password-confirmation-mismatch-refused');
      } else await go(a.path || '/');
      if (a.entity) await h.wait('.record-header');
      console.log(`${language}: ready ${screen.id}`);
      if (a.tab !== undefined) await h.tab(a.tab);
      if (a.agendaView) await button(`agenda.views.${a.agendaView}`);
      if (a.archived) {
        await h.invoke(a.entity === 'poa' ? 'power_of_attorney_archive' : `${a.entity}_archive`, {
          id: a.entity === 'client' ? client.id : a.entity === 'poa' ? poa.id : caseItem.id,
        });
        await go(paths[a.entity]);
        await h.wait('.record-header');
      }
      if (a.button) await button(a.button, a.entity ? '.workspace' : '');
      if (a.secondButton) await button(a.secondButton, '.dialog-surface');
      if (a.selector) await h.click(a.selector);
      if (a.submit) await h.click('form button:not([type])');
      if (a.pick) {
        await button('documents.pick', '.dialog-surface');
        await h.wait('.document-pick bdi');
      }
      if (a.search) {
        await h.fill('.global-search input', language === 'ar' ? 'عادل' : 'Adel');
        await h.wait('.global-search-results [role="option"]');
      }
      if (a.palette) {
        await h.browser.keys(['Control', 'k']);
        await h.wait('.command-palette');
        await h.fill('.command-palette input', language === 'ar' ? 'عادل' : 'Adel');
        await h.wait('.command-palette [role="option"]');
      }
      if (a.waitSuccess) await h.wait('.success');
      if (a.validate) {
        await h.selection('backup');
        await button('backups.validate');
        await h.wait('.success');
        saveResult('backup-validate-through-ui');
      }
      if (a.corrupt) {
        await h.selection('corrupt');
        await button('backups.restore');
        await button('backups.restoreConfirm', '.dialog-surface');
        await h.wait('.error');
        assert((await h.invoke('client_get', { id: client.id })).id === client.id);
        saveResult('corrupt-restore-preserves-records');
        await h.selection('backup');
      }
      if (
        a.hearing ||
        a.task ||
        (a.button &&
          [
            'records.edit',
            'poa.add',
            'documents.add',
            'backups.restore',
            'agenda.recordDecision',
            'cases.parties.add',
            'finances.add.payment',
            'finances.add.expense',
          ].includes(a.button))
      )
        await h.wait('.dialog-surface');
      await capture(h, screen);
      saveResult(`screen-${screen.id}`);
      if (a.archived) {
        await button('records.restore', '.record-header');
        await h.browser.waitUntil(
          async () =>
            !(
              await h.invoke(a.entity === 'poa' ? 'power_of_attorney_get' : `${a.entity}_get`, {
                id: a.entity === 'client' ? client.id : a.entity === 'poa' ? poa.id : caseItem.id,
              })
            ).archivedAt,
          { timeout: 15000 },
        );
        saveResult(`${a.entity}-archive-via-ipc-restore-through-ui`);
      }
      if (a.restored) {
        await h.fill('[name="password"]', password);
        await button('gate.submit.unlock');
        await h.wait('.workspace');
      }
    }
    await check('global-search-keyboard-deep-link', async () => {
      await go('/');
      await h.fill('.global-search input', language === 'ar' ? 'عادل' : 'Adel');
      await h.wait('.global-search-results [role="option"]');
      await h.browser.keys('ArrowDown');
      assert(
        await h.browser.execute(() => {
          const el = document.querySelector('.global-search input');
          return Boolean(document.getElementById(el.getAttribute('aria-activedescendant')));
        }),
      );
      await h.browser.keys('Enter');
      await h.wait('.record-header');
      assert((await h.browser.getUrl()).includes(client.id));
    });
    await check('client-edit-save-persists-through-ui', async () => {
      await go(paths.client);
      await button('records.edit', '.record-header');
      await h.fill(
        '.dialog-surface input[name="address"]',
        language === 'ar' ? 'عنوان تجريبي معدل' : 'Updated fictional address',
      );
      await button('records.saveEdits', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert(
        (await h.invoke('client_get', { id: client.id })).address.includes(
          language === 'ar' ? 'معدل' : 'Updated',
        ),
      );
    });
    await check('task-complete-reopen-through-ui', async () => {
      await go(`/tasks?task=${task.id}`);
      await h.wait('.dialog-surface');
      await button('tasks.complete', '.dialog-surface');
      await h.browser.waitUntil(
        async () =>
          (await h.invoke('task_list', { input: { referenceDate: today, view: 'ALL' } })).find(
            (t) => t.id === task.id,
          )?.completed,
        { timeout: 15000 },
      );
      await button('tasks.reopen', '.dialog-surface');
      await h.browser.waitUntil(
        async () =>
          !(await h.invoke('task_list', { input: { referenceDate: today, view: 'ALL' } })).find(
            (t) => t.id === task.id,
          )?.completed,
        { timeout: 15000 },
      );
    });
    await check('long-case-label-fits-hearing-dialog', async () => {
      await go(`/calendar?date=${today}`);
      await h.wait('.agenda-item');
      await button('agenda.editHearing');
      await h.wait('.dialog-surface');
      const fits = await h.browser.execute(() => {
        const dialog = document.querySelector('.dialog-surface');
        const form = dialog.querySelector('form');
        return (
          form.scrollWidth <= form.clientWidth + 1 && dialog.scrollWidth <= dialog.clientWidth + 1
        );
      });
      assert(fits);
      await button('common.cancel', '.dialog-surface');
    });
    await check('hearing-decision-follow-up-through-ui', async () => {
      await go(`/calendar?date=${today}`);
      await h.wait('.agenda-item');
      await button('agenda.recordDecision');
      await h.fill(
        '.dialog-surface textarea',
        language === 'ar' ? 'تأجيل تجريبي' : 'Fictional postponement',
      );
      await h.fill('.dialog-surface .date-picker input', shift(7));
      await h.browser.keys('Tab');
      await button('agenda.recordDecision', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      const list = await h.invoke('hearing_list', { input: { caseId: caseItem.id } });
      assert(list.some((x) => x.previousHearingId === hearing.id && x.hearingDate === shift(7)));
      assert(list.find((x) => x.id === hearing.id).status === 'COMPLETED');
    });
    await check('financial-exact-minor-unit-summary', async () => {
      const summary = await h.invoke('finance_case_summary', { id: caseItem.id });
      assert.equal(summary.receivedMinor, 150025);
      assert.equal(summary.outstandingMinor, 149975);
      assert.equal(summary.expensesMinor, 25000);
      assert.equal(summary.netCashMinor, 125025);
    });
    await check('poa-linked-cases-unique-for-shared-clients', async () => {
      const record = await h.invoke('power_of_attorney_get', { id: poa.id });
      assert.equal(record.clients.length, 2);
      assert.deepEqual(record.caseIds, [caseItem.id]);
    });

    await check('power-of-attorney-create-edit-through-ui', async () => {
      await go('/powers-of-attorney');
      await button('poa.add');
      await h.fill('.dialog-surface [name="internalSequence"]', 'POA-UI-TEST');
      await h.click('.dialog-surface [role="checkbox"]');
      await button('poa.save', '.dialog-surface');
      await h.wait('.record-header');
      const item = (await h.invoke('power_of_attorney_list', { input: {} })).find(
        (p) => p.internalSequence === 'POA-UI-TEST',
      );
      assert(item);
      await button('records.edit', '.record-header');
      await h.fill('.dialog-surface [name="officialNumber"]', '999');
      await button('poa.save', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert.equal(
        (await h.invoke('power_of_attorney_get', { id: item.id })).officialNumber,
        '999',
      );
    });
    await check('case-edit-and-opponent-create-through-ui', async () => {
      await go(paths.case);
      await button('records.edit', '.record-header');
      await h.fill('.dialog-surface [name="subject"]', 'Updated fictional claim');
      await button('records.saveEdits', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert.equal(
        (await h.invoke('case_get', { id: caseItem.id })).subject,
        'Updated fictional claim',
      );
      await h.tab(1);
      await button('cases.parties.add');
      await h.fill('.dialog-surface input[required]', 'Additional fictional opponent');
      await button('cases.parties.save', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      const opponent = (await h.invoke('case_get', { id: caseItem.id })).opponents.find(
        (x) => x.fullName === 'Additional fictional opponent',
      );
      assert(opponent);
      await h.invoke('case_remove_opponent', { id: opponent.id });
      assert(
        !(await h.invoke('case_get', { id: caseItem.id })).opponents.some(
          (x) => x.id === opponent.id,
        ),
      );
    });

    await check('calendar-popup-clickable-inside-dialog', async () => {
      await go('/calendar?create=hearing');
      await h.wait('.dialog-surface');
      await h.click('.dialog-surface .date-picker-trigger');
      await h.wait('.date-picker-popover');
      const days = await h.browser.$$('.date-picker-popover .rdp-day_button:not([disabled])');
      assert(days.length);
      await days[0].click();
      await h.browser.waitUntil(
        async () => !(await h.browser.$('.date-picker-popover').isDisplayed()),
        { timeout: 15000 },
      );
      assert.match(
        await h.browser.$('.dialog-surface .date-picker input').getValue(),
        /^\d{4}-\d{2}-\d{2}$/,
      );
    });
    await check('payment-save-and-payer-options-through-ui', async () => {
      await go(`/finances?case=${caseItem.id}`);
      await button('finances.add.payment');
      const selects = await h.browser.$$('.dialog-surface [role="combobox"]');
      await selects[1].click();
      await h.browser.waitUntil(
        async () => {
          for (const option of await h.browser.$$('[role="option"]'))
            if (await option.isDisplayed()) return true;
          return false;
        },
        { timeout: 15000 },
      );
      const options = [];
      for (const option of await h.browser.$$('[role="option"]'))
        if (await option.isDisplayed()) options.push(option);
      const names = await Promise.all(options.map((x) => x.getText()));
      assert(!names.some((x) => x.includes(language === 'ar' ? 'خارج القضية' : 'Unrelated')));
      await options[0].click();
      await h.fill('.dialog-surface input[inputmode="decimal"]', '100.01');
      await button('finances.savePayment', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert(
        (await h.invoke('payment_list', { input: { caseId: caseItem.id } })).some(
          (x) => x.amountMinor === 10001,
        ),
      );
    });
    await check('expense-without-links-save-through-ui', async () => {
      await go('/finances');
      await h.tab(1);
      await button('finances.add.expense');
      await h.fill('.dialog-surface input[inputmode="decimal"]', '12.50');
      await button('finances.saveExpense', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert(
        (await h.invoke('expense_list', { input: {} })).some(
          (x) => x.amountMinor === 1250 && !x.clientId && !x.caseId,
        ),
      );
    });
    await check('task-create-edit-through-ui-delete-via-ipc', async () => {
      await go('/tasks?create=task');
      await h.wait('.dialog-surface');
      await h.fill('.dialog-surface input[required]', 'Additional fictional task');
      await button('tasks.save', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      const added = (
        await h.invoke('task_list', { input: { referenceDate: today, view: 'ALL' } })
      ).find((x) => x.title === 'Additional fictional task');
      assert(added);
      await go(`/tasks?task=${added.id}`);
      await h.wait('.dialog-surface');
      await h.fill('.dialog-surface input[required]', 'Updated fictional task');
      await button('tasks.save', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert(
        (await h.invoke('task_list', { input: { referenceDate: today, view: 'ALL' } })).some(
          (x) => x.id === added.id && x.title === 'Updated fictional task',
        ),
      );
      await h.invoke('task_delete', { id: added.id });
      assert(
        !(await h.invoke('task_list', { input: { referenceDate: today, view: 'ALL' } })).some(
          (x) => x.id === added.id,
        ),
      );
    });
    await check('attachment-add-through-ui', async () => {
      await h.selection('attachment');
      await go(paths.client);
      await h.tab(4);
      await button('documents.add');
      await button('documents.pick', '.dialog-surface');
      await h.wait('.document-pick bdi');
      await button('documents.save', '.dialog-surface');
      await h.browser.waitUntil(async () => !(await h.browser.$('.dialog-surface').isExisting()), {
        timeout: 15000,
      });
      assert.equal(
        (await h.invoke('attachment_list', { input: { clientId: client.id } })).length,
        2,
      );
    });
    await check('invalid-money-and-payer-refused', async () => {
      await rejected('payment_save', { input: { ...payment, amountMinor: 0 } }, [
        'VALIDATION_FAILED',
      ]);
      await rejected('payment_save', { input: { ...payment, payerClientId: outsider.id } }, [
        'VALIDATION_FAILED',
      ]);
      await rejected('expense_save', { input: { ...expense, amountMinor: -1 } }, [
        'VALIDATION_FAILED',
      ]);
    });
    await check('duplicate-identifiers-and-invalid-case-refused', async () => {
      await rejected(
        'client_create',
        {
          input: {
            internalNumber: client.internalNumber,
            fullName: 'Other fictional client',
            confirmDuplicate: true,
          },
        },
        ['OPERATION_FAILED'],
      );
      await rejected(
        'case_create',
        { input: { ...caseInput, internalNumber: 'INVALID-DEMO', clients: [] } },
        ['VALIDATION_FAILED'],
      );
    });
    await check('attachment-single-owner-and-cancel-refused', async () => {
      await rejected(
        'attachment_add',
        {
          input: {
            caseId: caseItem.id,
            clientId: client.id,
            sourceToken: (await h.invoke('attachment_select_source')).sourceToken,
            category: 'OTHER',
          },
        },
        ['VALIDATION_FAILED'],
      );
      await h.selection('cancel');
      await rejected('attachment_select_source', {}, ['OPERATION_CANCELLED']);
      await rejected('backup_restore', {}, ['OPERATION_CANCELLED']);
      await h.selection('backup');
      assert.equal(
        (await h.invoke('attachment_list', { input: { caseId: caseItem.id } })).length,
        1,
      );
    });
    await check('attachment-metadata-edit-remove-preserves-source', async () => {
      const added = await h.invoke('attachment_add', {
        input: {
          clientId: outsider.id,
          sourceToken: (
            await (await h.selection('attachment'), h.invoke('attachment_select_source'))
          ).sourceToken,
          category: 'OTHER',
        },
      });
      await h.invoke('attachment_update', {
        input: { id: added.id, category: 'RECEIPT', description: 'Updated fictional receipt' },
      });
      assert.equal(
        (await h.invoke('attachment_list', { input: { clientId: outsider.id } }))[0].category,
        'RECEIPT',
      );
      await h.invoke('attachment_remove', { id: added.id });
      assert.equal(
        (await h.invoke('attachment_list', { input: { clientId: outsider.id } })).length,
        0,
      );
      assert.deepEqual(await readFile(join(h.root, 'fixtures/fictional.pdf')), h.pdf);
    });
    await check('repeated-same-vault-restore-three-times', async () => {
      for (let i = 0; i < 3; i++) {
        await h.invoke('backup_create');
        const extra = await h.invoke('client_create', {
          input: {
            internalNumber: `AFTER-${i}`,
            fullName: `Fictional after snapshot ${i}`,
            confirmDuplicate: true,
          },
        });
        await h.selection('backup');
        await h.invoke('backup_restore');
        assert.equal((await h.invoke('app_get_status')).unlocked, false);
        await h.invoke('app_unlock', { password });
        await rejected('client_get', { id: extra.id }, ['CLIENT_NOT_FOUND']);
        const restored = (await h.invoke('attachment_list', { input: { caseId: caseItem.id } }))[0];
        assert.deepEqual(
          await readFile(join(h.root, 'vault/attachments', restored.storedFilename)),
          h.pdf,
        );
        assert.deepEqual(await readFile(join(h.root, 'fixtures/fictional.pdf')), h.pdf);
      }
    });
    await check('password-change-and-recovery-real-vault', async () => {
      await rejected(
        'app_change_password',
        {
          currentPassword: 'Incorrect fictional password',
          newPassword: 'Another Fictional Password 2026',
        },
        ['INVALID_PASSWORD'],
      );
      await h.invoke('app_change_password', {
        currentPassword: password,
        newPassword: 'Another Fictional Password 2026',
      });
      await h.invoke('app_lock');
      await rejected('app_unlock', { password }, ['INVALID_PASSWORD']);
      await h.invoke('app_unlock', { password: 'Another Fictional Password 2026' });
      await h.invoke('app_lock');
      await rejected(
        'app_recover_access',
        { recoveryKey: 'INVALID-FICTIONAL-KEY', newPassword: password },
        ['RECOVERY_KEY_INVALID'],
      );
      await h.invoke('app_recover_access', { recoveryKey, newPassword: password });
      await h.invoke('app_unlock', { password });
      assert((await h.invoke('client_get', { id: client.id })).id === client.id);
    });
    await check('restart-locked-and-data-persisted', async () => {
      await h.restart();
      await h.wait('.gate');
      assert(!(await h.invoke('app_get_status')).unlocked);
      await h.fill('[name="password"]', password);
      await h.button(get('ar', 'gate.submit.unlock'));
      await h.wait('.workspace');
      assert((await h.invoke('client_get', { id: client.id })).id === client.id);
    });
    await check('narrow-viewport-rtl-ltr-and-navigation', async () => {
      await h.browser.setWindowSize(1366, 768);
      await go('/');
      const metrics = await h.browser.execute(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        dir: document.documentElement.dir,
      }));
      assert(metrics.scroll <= metrics.width + 1);
      assert.equal(metrics.dir, language === 'ar' ? 'rtl' : 'ltr');
      await h.click('nav a[href="/clients"]');
      await h.wait('tbody a');
    });
  } catch (error) {
    if (!['setup', 'unlock', 'wrong-password', 'recovery'].includes(stage))
      await writeFile(
        `/tmp/legal-masr-guide-debug-${language}.png`,
        Buffer.from(await h.browser.takeScreenshot(), 'base64'),
      );
    console.log(
      `Failure class: ${error.name}; assertion: ${error.code || 'none'}; ownError: ${error.message?.startsWith('GUIDE_') ? error.message : /callout/.test(error.message) ? 'CALLOUT_MISSING' : /clickable/.test(error.message) ? 'NOT_CLICKABLE' : /displayed/.test(error.message) ? 'NOT_DISPLAYED' : 'suppressed'}`,
    );
    allResults.push({
      locale: language,
      scenario: stage,
      result: 'failed',
      layer: 'native-desktop-real-ipc',
      errorCode: 'GUIDE_SCENARIO_FAILED',
    });
    console.log(`${language}: failed at ${stage}`);
    process.exitCode = 1;
  } finally {
    await h.close();
    await writeFile(
      preflight ? 'test-results/user-guide-preflight.json' : join(output, 'capture-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
}
for (const language of (process.env.GUIDE_LANGUAGES || 'ar,en').split(',')) await run(language);
console.log(
  `Saved ${manifest.screenshots.length} native captures; ${allResults.filter((r) => r.result === 'failed').length} failures`,
);
