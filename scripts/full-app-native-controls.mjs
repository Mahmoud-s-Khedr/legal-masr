/* global document */
import { openGuideDesktop } from './guide-desktop.mjs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const output =
  process.env.NATIVE_CONTROLS_OUTPUT ??
  'docs/reviews/evidence/2026-10-09/full-test/native-controls';
await mkdir(output, { recursive: true });
const results = [];
const catalog = JSON.parse(await readFile('src/i18n/en/common.json', 'utf8'));
const t = (key) => key.split('.').reduce((o, k) => o[k], catalog);
const h = await openGuideDesktop('en');
const dialog = ':is([role="dialog"],[role="alertdialog"])';
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
    await button('cases.parties.save', dialog);
    await closed();
    assert((await h.invoke('case_get', { id: c.id })).opponents.length === 1);
    await button('records.edit', '.row-actions');
    await h.fill(`${dialog} input[required]`, 'Edited fictional opponent');
    await button('cases.parties.save', dialog);
    await closed();
    assert(
      (await h.invoke('case_get', { id: c.id })).opponents[0].fullName ===
        'Edited fictional opponent',
    );
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
  await check('calendar-month-week-list-period-buttons', async () => {
    await go('/calendar');
    for (const view of ['week', 'list', 'month']) await button(`agenda.views.${view}`);
    await h.click(`button[aria-label="${t('agenda.nextPeriod')}"]`);
    await h.click(`button[aria-label="${t('agenda.previousPeriod')}"]`);
    await button('agenda.goToday');
  });
} finally {
  await h.close();
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
}
if (results.some((r) => r.result === 'failed')) process.exitCode = 1;
