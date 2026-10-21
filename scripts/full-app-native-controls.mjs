/* global document, window */
import { openGuideDesktop } from './guide-desktop.mjs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const output = process.env.NATIVE_CONTROLS_OUTPUT ?? 'test-results/full-app/native-controls';
await mkdir(output, { recursive: true });
const results = [];
const catalog = JSON.parse(await readFile('src/i18n/en/common.json', 'utf8'));
const t = (key) => key.split('.').reduce((o, k) => o[k], catalog);
const h = await openGuideDesktop('en');
const dialog = ':is([role="dialog"],[role="alertdialog"])';
async function fillLabel(key, value) {
  const id = await h.browser.execute(
    (label) =>
      [...document.querySelector('[role="dialog"]').querySelectorAll('label')].find(
        (x) => x.textContent.trim() === label,
      )?.htmlFor,
    t(key),
  );
  assert(id, 'A visible field must have an associated label');
  await h.fill(`[id=${JSON.stringify(id)}]`, value);
}
const originalTab = h.tab;
h.tab = async (index) => {
  await originalTab(index);
  await h.browser.waitUntil(
    async () =>
      (await (await h.browser.$$('[role="tab"]'))[index].getAttribute('aria-selected')) === 'true',
    { timeout: 15000 },
  );
};
const button = (key, scope) => h.button(t(key), scope);
const go = async (path) => {
  await h.go('/');
  await h.go(path);
};
const closed = () =>
  h.browser.waitUntil(async () => !(await h.browser.$(dialog).isExisting()), { timeout: 15000 });
async function check(name, action) {
  if (
    process.env.NATIVE_CONTROLS_FILTER &&
    !new RegExp(process.env.NATIVE_CONTROLS_FILTER).test(name)
  )
    return;
  try {
    await action();
    results.push({ scenario: name, result: 'passed', layer: 'native-desktop-real-ipc' });
  } catch (error) {
    results.push({
      scenario: name,
      result: 'failed',
      errorCode: error.code || 'AUDIT_CONTROL_FAILED',
    });
  }
  await writeFile(
    join(output, `${name}.png`),
    Buffer.from(await h.browser.takeScreenshot(), 'base64'),
  );
  console.log(JSON.stringify(results.at(-1)));
}
try {
  await h.wait('[name="fullName"]');
  await h.click('.language-switcher');
  await h.fill('[name="fullName"]', 'Fictional control audit lawyer');
  await h.fill('[name="password"]', 'Fictional control password 2026');
  await h.fill('[name="confirmPassword"]', 'Fictional control password 2026');
  await button('gate.submit.setup');
  await h.wait('.recovery-key');
  await h.click('.gate-confirm [role="checkbox"]');
  await button('gate.recoveryKeySavedButton');
  await h.wait('nav');
  const a = await h.invoke('client_create', {
    input: { internalNumber: 'CONTROL-A', fullName: 'Fictional control client A' },
  });
  const b = await h.invoke('client_create', {
    input: { internalNumber: 'CONTROL-B', fullName: 'Fictional control client B' },
  });
  const c = await h.invoke('case_create', {
    input: {
      internalNumber: 'CONTROL-CASE',
      status: 'ACTIVE',
      clients: [{ clientId: a.id }, { clientId: b.id }],
    },
  });
  const poa = await h.invoke('power_of_attorney_create', {
    input: { internalSequence: 'CONTROL-POA', clientIds: [a.id], lawyers: [] },
  });
  const today = await h.browser.execute(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await check('all-sidebar-navigation-links', async () => {
    for (const path of [
      '/',
      '/calendar',
      '/tasks',
      '/clients',
      '/cases',
      '/powers-of-attorney',
      '/attachments',
      '/finances',
      '/backups',
      '/settings',
    ]) {
      await h.click(`nav a[href="${path}"]`);
      assert(new URL(await h.browser.getUrl()).pathname === path);
    }
  });
  await check('client-search-archive-filter-clear', async () => {
    await go('/clients');
    await h.fill('input[type="search"]', 'CONTROL-A');
    await h.browser.waitUntil(async () => (await h.browser.$$('tbody tr')).length === 1, {
      timeout: 15000,
    });
    await h.fill('input[type="search"]', 'NO-SUCH-FICTIONAL-CLIENT');
    await h.browser.waitUntil(async () => !(await h.browser.$('tbody tr').isExisting()), {
      timeout: 15000,
    });
    await h.click('input[type="search"]');
    await h.browser.keys(['Control', 'a']);
    await h.browser.keys('Backspace');
    await h.click('[role="checkbox"]');
    await h.browser.waitUntil(async () => (await h.browser.$$('tbody tr')).length === 2, {
      timeout: 15000,
    });
  });
  await check('case-archive-and-restore-buttons', async () => {
    await go(`/cases/${c.id}`);
    await button('records.archive', '.record-header');
    await button('common.cancel', dialog);
    await closed();
    assert(!(await h.invoke('case_get', { id: c.id })).archivedAt);
    await button('records.archive', '.record-header');
    await button('cases.detail.archiveTitle', dialog);
    await closed();
    await h.browser.waitUntil(async () => !!(await h.invoke('case_get', { id: c.id })).archivedAt, {
      timeout: 15000,
    });
    await button('records.restore', '.record-header');
    await h.browser.waitUntil(async () => !(await h.invoke('case_get', { id: c.id })).archivedAt, {
      timeout: 15000,
    });
  });
  await check('opponent-empty-form-visible-feedback', async () => {
    await go(`/cases/${c.id}`);
    await h.tab(1);
    await button('cases.parties.add');
    await button('cases.parties.save', dialog);
    const metrics = await h.browser.execute(() => {
      const e = document.querySelector('[role="dialog"]');
      return {
        alerts: e.querySelectorAll('[role="alert"]').length,
        invalid: e.querySelectorAll('[aria-invalid="true"]').length,
      };
    });
    await writeFile(join(output, 'opponent-validation.json'), JSON.stringify(metrics, null, 2));
    assert(metrics.alerts > 0 || metrics.invalid > 0);
  });
  await check('opponent-create-edit-cancel-remove', async () => {
    await go(`/cases/${c.id}`);
    await h.tab(1);
    await button('cases.parties.add');
    await h.fill(`${dialog} input[required]`, 'Fictional opponent');
    for (const [key, value] of Object.entries({
      'cases.parties.role': 'Fictional defendant',
      'cases.parties.lawyer': 'Fictional opponent lawyer',
      'cases.parties.phone': '0200000000',
      'cases.parties.address': 'Fictional address, Cairo',
      'common.notes': 'Fictional opponent notes',
    }))
      await fillLabel(key, value);
    await button('cases.parties.save', dialog);
    await closed();
    assert((await h.invoke('case_get', { id: c.id })).opponents.length === 1);
    await button('records.edit', '.row-actions');
    await h.fill(`${dialog} input[required]`, 'Edited fictional opponent');
    await button('cases.parties.save', dialog);
    await closed();
    const opponent = (await h.invoke('case_get', { id: c.id })).opponents[0];
    for (const [key, value] of Object.entries({
      fullName: 'Edited fictional opponent',
      legalCapacity: 'Fictional defendant',
      lawyerName: 'Fictional opponent lawyer',
      phone: '0200000000',
      address: 'Fictional address, Cairo',
      notes: 'Fictional opponent notes',
    }))
      assert.equal(opponent[key], value);
    await button('documents.remove', '.row-actions');
    await button('common.cancel', dialog);
    await closed();
    assert((await h.invoke('case_get', { id: c.id })).opponents.length === 1);
    await button('documents.remove', '.row-actions');
    await button('cases.parties.removeTitle', dialog);
    await closed();
    assert((await h.invoke('case_get', { id: c.id })).opponents.length === 0);
  });
  await check('task-delete-cancel-confirm-through-ui', async () => {
    const task = await h.invoke('task_create', {
      input: { title: 'Fictional deletable task', dueDate: today },
    });
    await go('/tasks?view=ALL');
    await h.click('button[aria-label="Delete Fictional deletable task"]');
    await button('common.cancel', dialog);
    await closed();
    assert(
      (await h.invoke('task_list', { input: { view: 'ALL', referenceDate: today } })).some(
        (x) => x.id === task.id,
      ),
    );
    await h.click('button[aria-label="Delete Fictional deletable task"]');
    await button('tasks.deleteTitle', dialog);
    await closed();
    assert(
      !(await h.invoke('task_list', { input: { view: 'ALL', referenceDate: today } })).some(
        (x) => x.id === task.id,
      ),
    );
  });
  await check('hearing-create-edit-date-and-delete-through-ui', async () => {
    await go('/calendar?create=hearing');
    await h.click(`${dialog} [role="combobox"]`);
    await h.click('[role="option"]');
    await h.fill(`${dialog} input[inputmode="numeric"]`, today);
    await button('agenda.save', dialog);
    await closed();
    const item = (await h.invoke('hearing_list', { input: { caseId: c.id } }))[0];
    assert(item);
    await go(`/calendar?hearing=${item.id}`);
    await h.wait(dialog);
    await button('common.cancel', dialog);
    await closed();
    await button('agenda.deleteHearing');
    await button('common.cancel', dialog);
    await closed();
    assert((await h.invoke('hearing_list', { input: { caseId: c.id } })).length === 1);
    await button('agenda.deleteHearing');
    await button('agenda.confirmDelete', dialog);
    await closed();
    assert((await h.invoke('hearing_list', { input: { caseId: c.id } })).length === 0);
  });
  await check('client-and-poa-archive-confirmations', async () => {
    for (const [path, cmd, id, label] of [
      [`/clients/${a.id}`, 'client', a.id, 'clients.detail.archiveTitle'],
      [`/powers-of-attorney/${poa.id}`, 'power_of_attorney', poa.id, 'poa.archiveTitle'],
    ]) {
      await go(path);
      await button('records.archive', '.record-header');
      await button('common.cancel', dialog);
      await closed();
      assert(!(await h.invoke(`${cmd}_get`, { id })).archivedAt);
      await button('records.archive', '.record-header');
      await button(label, dialog);
      await closed();
      await h.browser.waitUntil(async () => !!(await h.invoke(`${cmd}_get`, { id })).archivedAt, {
        timeout: 15000,
      });
      await button('records.restore', '.record-header');
      await h.browser.waitUntil(async () => !(await h.invoke(`${cmd}_get`, { id })).archivedAt, {
        timeout: 15000,
      });
    }
  });
  await check('case-relationships-save-and-paid-client-removal-refused', async () => {
    await go(`/cases/${c.id}`);
    await h.tab(1);
    await button('records.edit', '.detail-card');
    await h.fill(`${dialog} textarea`, 'Fictional relationship note');
    await button('records.saveEdits', dialog);
    await closed();
    assert(
      (await h.invoke('case_get', { id: c.id })).clients[0].notes === 'Fictional relationship note',
    );
    await h.invoke('payment_save', {
      input: {
        caseId: c.id,
        payerClientId: a.id,
        amountMinor: 101,
        paymentDate: today,
        paymentMethod: 'CASH',
      },
    });
    await button('records.edit', '.detail-card');
    await h.click(
      `${dialog} [data-slot="combobox-chip"][aria-label="Fictional control client A"] [data-slot="combobox-chip-remove"]`,
    );
    await button('records.saveEdits', dialog);
    await h.wait(`${dialog} [role="alert"]`);
    assert((await h.invoke('case_get', { id: c.id })).clients.length === 2);
    await button('common.cancel', dialog);
    await button('forms.keepEditing', '[role="alertdialog"]');
    await h.browser.$('[role="alertdialog"]').waitForExist({ reverse: true, timeout: 15000 });
    await button('common.cancel', dialog);
    await button('forms.discard', '[role="alertdialog"]');
    await closed();
  });
  await check('attachment-ui-edit-missing-open-cancel-confirm-remove', async () => {
    await h.selection('attachment');
    const attachment = await h.invoke('attachment_add', {
      input: {
        clientId: a.id,
        sourceToken: (await h.invoke('attachment_select_source')).sourceToken,
        category: 'OTHER',
      },
    });
    await go(`/clients/${a.id}`);
    await h.tab(4);
    await h.wait('.attachment-actions');
    await button('records.edit', '.attachment-actions');
    await h.fill(
      `${dialog} input:not([inputmode]):not([type="hidden"]):not([aria-hidden="true"])`,
      'Fictional edited description',
    );
    await button('records.saveEdits', dialog);
    await closed();
    assert(
      (await h.invoke('attachment_list', { input: { clientId: a.id } }))[0].description ===
        'Fictional edited description',
    );
    const original = join(h.root, 'vault/attachments', attachment.storedFilename);
    const missing = join(h.root, 'fixtures/missing-managed');
    await rename(original, missing);
    try {
      await button('documents.open', '.attachment-actions');
      await h.wait('[role="alert"]');
    } finally {
      await rename(missing, original);
    }
    await button('documents.remove', '.attachment-actions');
    await button('common.cancel', dialog);
    await closed();
    assert((await h.invoke('attachment_list', { input: { clientId: a.id } })).length === 1);
    await button('documents.remove', '.attachment-actions');
    await button('documents.removeTitle', dialog);
    await closed();
    assert((await h.invoke('attachment_list', { input: { clientId: a.id } })).length === 0);
  });
  await check('finance-inspect-edit-delete-cancel-confirm-and-exact-totals', async () => {
    const caseBefore = await h.invoke('finance_case_summary', { id: c.id });
    const clientBefore = await h.invoke('finance_client_summary', { id: b.id });
    for (const type of ['payment', 'expense']) {
      const command = type === 'payment' ? 'payment_save' : 'expense_save';
      const notes = `QA-FINANCE-${type}`;
      const input =
        type === 'payment'
          ? {
              caseId: c.id,
              payerClientId: b.id,
              amountMinor: 200025,
              paymentDate: today,
              paymentMethod: 'CHEQUE',
              notes,
            }
          : {
              clientId: b.id,
              amountMinor: 25010,
              expenseDate: today,
              expenseType: 'TRANSPORT',
              notes,
            };
      const item = await h.invoke(command, { input });
      await go('/finances');
      if (type === 'expense') await h.tab(1);
      const row = await h.browser.$(`tr*=${notes}`);
      await row.waitForDisplayed({ timeout: 15000 });
      await row.$('td button').click();
      await h.wait(dialog);
      await button('cases.detail.editEntryButton', dialog);
      await h.fill(`${dialog} input[inputmode="decimal"]`, '333.37');
      await h.fill(`${dialog} textarea`, `${notes}-EDITED`);
      await button(type === 'payment' ? 'finances.savePayment' : 'finances.saveExpense', dialog);
      await closed();
      const list = () =>
        h.invoke(type === 'payment' ? 'payment_list' : 'expense_list', { input: {} });
      await h.browser.waitUntil(
        async () => (await list()).find((x) => x.id === item.id)?.amountMinor === 33337,
        { timeout: 15000 },
      );
      const changed = (await list()).find((x) => x.id === item.id);
      assert.equal(changed.notes, `${notes}-EDITED`);
      assert.equal(changed[type === 'payment' ? 'paymentDate' : 'expenseDate'], today);
      const editedRow = await h.browser.$(`tr*=${notes}-EDITED`);
      await editedRow.waitForDisplayed({ timeout: 15000 });
      await editedRow.$('td button').click();
      await h.wait(dialog);
      await button('finances.delete', dialog);
      await button('common.cancel', '[role="alertdialog"]');
      await h.browser.$('[role="alertdialog"]').waitForExist({ reverse: true, timeout: 15000 });
      assert((await list()).some((x) => x.id === item.id));
      await button('finances.delete', dialog);
      await button(`finances.deleteTitle.${type}`, '[role="alertdialog"]');
      await closed();
      await h.browser.waitUntil(async () => !(await list()).some((x) => x.id === item.id), {
        timeout: 15000,
      });
    }
    const account = await h.invoke('finance_case_summary', { id: c.id });
    assert.deepEqual(account, caseBefore);
    assert.deepEqual(await h.invoke('finance_client_summary', { id: b.id }), clientBefore);
  });
  await check('hearing-and-task-every-text-field-persists', async () => {
    await go('/calendar?create=hearing');
    await h.wait(dialog);
    await h.click(`${dialog} [role="combobox"]`);
    await h.click('[role="option"]');
    const hearingFields = {
      'agenda.fields.date': today,
      'agenda.fields.time': '9:30',
      'agenda.fields.type': 'QA-HEARING-TYPE',
      'agenda.fields.location': 'QA-FICTIONAL-COURT',
      'agenda.fields.circuit': 'QA-FICTIONAL-CIRCUIT',
      'agenda.fields.requiredDocuments': 'Fictional contract\nFictional pleading',
      'common.notes': 'QA-HEARING-NOTES',
    };
    for (const [key, value] of Object.entries(hearingFields)) {
      await fillLabel(key, value);
      if (['agenda.fields.type', 'agenda.fields.location', 'agenda.fields.circuit'].includes(key))
        await h.browser.keys('Tab');
    }
    await button('agenda.save', dialog);
    await closed();
    const hearing = (await h.invoke('hearing_list', { input: { caseId: c.id } })).find(
      (x) => x.notes === 'QA-HEARING-NOTES',
    );
    assert(hearing);
    for (const [key, value] of Object.entries({
      hearingDate: today,
      hearingTime: '09:30',
      hearingType: 'QA-HEARING-TYPE',
      location: 'QA-FICTIONAL-COURT',
      circuitName: 'QA-FICTIONAL-CIRCUIT',
      requiredDocuments: hearingFields['agenda.fields.requiredDocuments'],
      notes: hearingFields['common.notes'],
    }))
      assert.equal(hearing[key], value);
    await h.invoke('hearing_delete', { id: hearing.id });
    await go('/tasks?create=task');
    await h.wait(dialog);
    await fillLabel('tasks.task', 'QA-FULL-TASK');
    await fillLabel('tasks.dueDate', today);
    await fillLabel('tasks.fieldDetails', 'Fictional detail one\nFictional detail two');
    await fillLabel('common.notes', 'QA-TASK-NOTES');
    await button('tasks.save', dialog);
    await closed();
    const task = (
      await h.invoke('task_list', { input: { view: 'ALL', referenceDate: today } })
    ).find((x) => x.title === 'QA-FULL-TASK');
    assert(task);
    assert.equal(task.dueDate, today);
    assert.equal(task.details, 'Fictional detail one\nFictional detail two');
    assert.equal(task.notes, 'QA-TASK-NOTES');
    assert.equal(task.caseId, null);
    assert.equal(task.clientId, null);
    await h.invoke('task_delete', { id: task.id });
  });
  await check('settings-persisted-select-values-visible', async () => {
    await go('/settings?tab=general');
    const settings = await h.invoke('settings_get');
    const values = await h.browser.execute(() =>
      [...document.querySelectorAll('form [data-slot="select-value"]')].map((el) =>
        el.textContent.trim(),
      ),
    );
    await writeFile(
      join(output, 'settings-select-values.json'),
      JSON.stringify(
        { language: settings.language, dateFormat: settings.dateFormat, displayedValues: values },
        null,
        2,
      ),
    );
    await h.browser.waitUntil(
      async () =>
        await h.browser.execute(() => {
          const es = [...document.querySelectorAll('form [data-slot="select-value"]')];
          return !!(es[0]?.textContent.trim() && es[2]?.textContent.trim());
        }),
      { timeout: 5000 },
    );
  });
  await check('settings-theme-save-and-revert-through-ui', async () => {
    await go('/settings?tab=general');
    await (await h.browser.$$('form [role="combobox"]'))[1].click();
    await h.click('//*[@role="option"][normalize-space(.)="Dark"]');
    await h.click('form button[type="submit"]');
    await h.browser.waitUntil(async () => (await h.invoke('settings_get')).theme === 'dark', {
      timeout: 15000,
    });
    await writeFile(
      join(output, 'settings-dark-theme.png'),
      Buffer.from(await h.browser.takeScreenshot(), 'base64'),
    );
    await (await h.browser.$$('form [role="combobox"]'))[1].click();
    await h.click('//*[@role="option"][normalize-space(.)="Light"]');
    await h.click('form button[type="submit"]');
    await h.browser.waitUntil(async () => (await h.invoke('settings_get')).theme === 'light', {
      timeout: 15000,
    });
  });
  await check('settings-profile-every-field-and-date-week-lock-preferences', async () => {
    await go('/settings?tab=profile');
    const profile = {
      fullName: 'Fictional fully populated lawyer',
      barNumber: 'QA-BAR-1234',
      phone: '01000000001',
      officeAddress: 'عنوان مكتب خيالي\nالقاهرة',
    };
    for (const [name, value] of Object.entries(profile)) await h.fill(`[name="${name}"]`, value);
    await button('settings.profile.save');
    await h.browser.waitUntil(
      async () => (await h.invoke('profile_get')).fullName === profile.fullName,
      { timeout: 15000 },
    );
    const saved = await h.invoke('profile_get');
    for (const [name, value] of Object.entries(profile)) assert.equal(saved[name], value);
    await go('/settings?tab=general');
    for (const [index, key] of [
      [2, 'settings.display.yearFirst'],
      [3, 'settings.display.monday'],
    ]) {
      await (await h.browser.$$('form [data-slot="select-trigger"]'))[index].click();
      await h.click(`//*[@role="option"][normalize-space(.)=${JSON.stringify(t(key))}]`);
    }
    await h.click('form button[type="submit"]');
    await h.browser.waitUntil(
      async () => (await h.invoke('settings_get')).dateFormat === 'yyyy-MM-dd',
      { timeout: 15000 },
    );
    assert.equal((await h.invoke('settings_get')).weekStartsOn, 1);
    await go('/settings?tab=security');
    await (await h.browser.$$('[data-slot="select-trigger"]'))[0].click();
    await h.click(
      `//*[@role="option"][normalize-space(.)=${JSON.stringify(`30 ${t('settings.minutes')}`)}]`,
    );
    await button('settings.security.lockSave');
    await h.browser.waitUntil(
      async () => (await h.invoke('settings_get')).lockTimeoutMinutes === 30,
      { timeout: 15000 },
    );
    await h.restart();
    await h.wait('[name="password"]');
    await h.fill('[name="password"]', 'Fictional control password 2026');
    const ar = JSON.parse(await readFile('src/i18n/ar/common.json', 'utf8'));
    await h.button(ar.gate.submit.unlock);
    await h.wait('nav');
    assert.equal((await h.invoke('settings_get')).lockTimeoutMinutes, 30);
    assert.equal((await h.invoke('profile_get')).officeAddress, profile.officeAddress);
  });
  await check('calendar-month-week-list-period-buttons', async () => {
    await go('/calendar');
    for (const view of ['week', 'list', 'month']) await button(`agenda.views.${view}`);
    await h.click(`button[aria-label="${t('agenda.nextPeriod')}"]`);
    await h.click(`button[aria-label="${t('agenda.previousPeriod')}"]`);
    await button('agenda.goToday');
  });
  await check('case-reference-and-chronology-commands-preserve-data-on-refusal', async () => {
    const input = {
      internalNumber: 'CONTROL-VALIDATION',
      officialNumber: '447',
      officialYear: 2026,
      judicialYear: 89,
      status: 'ACTIVE',
      filedOn: '2026-10-14',
      closedOn: '2026-10-15',
      clients: [{ clientId: a.id }],
    };
    const valid = await h.invoke('case_create', { input });
    const updated = await h.invoke('case_update', {
      input: { ...input, id: valid.id, closedOn: input.filedOn },
    });
    assert.equal(updated.closedOn, input.filedOn);
    const snapshot = async () =>
      Promise.all([
        h.invoke('case_get', { id: valid.id }),
        h.invoke('case_list', { input: { includeArchived: true } }),
        h.invoke('search_global', { query: 'CONTROL' }),
      ]);
    const before = await snapshot();
    for (const change of [
      { closedOn: '2026-10-13' },
      { officialNumber: undefined, judicialYear: undefined },
      { officialNumber: '  ', officialYear: undefined },
      { officialNumber: '', officialYear: 2026, judicialYear: 89 },
    ]) {
      for (const command of ['case_create', 'case_update']) {
        await assert.rejects(
          h.invoke(command, {
            input: {
              ...input,
              ...change,
              ...(command === 'case_update'
                ? { id: valid.id }
                : { internalNumber: 'CONTROL-REFUSED' }),
            },
          }),
          (error) => error.code === 'VALIDATION_FAILED',
        );
        assert.deepEqual(await snapshot(), before);
      }
    }
    await go(`/cases/${valid.id}`);
    await h.wait('.entity-detail');
  });
  await check('case-account-failed-read-retry-restores-real-data', async () => {
    await h.invoke('fee_agreement_save', { input: { caseId: c.id, amountMinor: 123400 } });
    // Renderer-only fault injection in a disposable fictional native workspace.
    // Retry restores the original bridge and reads the actual SQLCipher database.
    await h.browser.execute(() => {
      window.__controlOriginalFetch = window.fetch;
      window.fetch = (url, options) =>
        String(url).endsWith('/finance_case_summary')
          ? Promise.resolve(
              new Response(JSON.stringify({ code: 'IO_FAILED' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Tauri-Response': 'error' },
              }),
            )
          : window.__controlOriginalFetch(url, options);
    });
    try {
      await go(`/cases/${c.id}`);
      await h.tab(5);
      await h.wait('[role="alert"]');
      assert.equal(await h.browser.$('.finance-summary').isExisting(), false);
      assert.equal(await h.browser.$('[name="amount"]').isEnabled(), false);
      await writeFile(
        join(output, 'case-account-failed-read.png'),
        Buffer.from(await h.browser.takeScreenshot(), 'base64'),
      );
      await h.click('.language-switcher');
      await h.browser.waitUntil(async () =>
        (await h.browser.$('[role="alert"]').getText()).includes('تعذر'),
      );
      await writeFile(
        join(output, 'case-account-failed-read-ar.png'),
        Buffer.from(await h.browser.takeScreenshot(), 'base64'),
      );
      await h.click('.language-switcher');
    } finally {
      await h.browser.execute(() => {
        window.fetch = window.__controlOriginalFetch;
        delete window.__controlOriginalFetch;
      });
    }
    await button('app.retry');
    await h.wait('.finance-summary');
    await h.browser.waitUntil(
      async () => (await h.browser.$('[name="amount"]').getValue()) === '1234',
    );
    assert.equal(await h.browser.$('[role="alert"]').isExisting(), false);
  });
} finally {
  await h.close();
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
}
if (results.some((r) => r.result === 'failed')) process.exitCode = 1;
