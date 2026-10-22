// Linux launch gates: real WebKit, IPC and encrypted disposable vaults. Pickers
// use the same fixed choices as the existing desktop/office harness.
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { csvRows, verifyExportEntry, verifySupportEntries } from './launch-artifacts.mjs';
import { failedDesktopOutcome } from './desktop-e2e-driver.mjs';
import { openGuideDesktop } from './guide-desktop.mjs';

const output = process.env.LAUNCH_E2E_OUTPUT ?? 'test-results/launch-e2e/launch';
await mkdir(output, { recursive: true });
const results = [];
const password = 'Fictional launch password 2026';
const dialog = ':is([role="dialog"],[role="alertdialog"])';
for (const language of ['ar', 'en']) {
  const catalog = JSON.parse(await readFile(`src/i18n/${language}/common.json`, 'utf8'));
  const t = (key) => key.split('.').reduce((value, part) => value[part], catalog);
  const h = await openGuideDesktop(language);
  let step = 'setup';
  const button = (key, scope) => h.button(t(key), scope);
  const closed = () =>
    h.browser.waitUntil(async () => !(await h.browser.$(dialog).isExisting()), { timeout: 15000 });
  const check = async (scenario, action) => {
    step = scenario;
    try {
      await action();
      results.push({ locale: language, scenario, result: 'passed' });
    } catch (error) {
      // Never retain DOM, raw exceptions, inputs, paths or security screenshots.
      results.push({
        ...failedDesktopOutcome({ scenario, stage: 'scenario', error }),
        locale: language,
        checkpoint: step,
      });
      process.exitCode = 1;
      throw new Error('LAUNCH_SCENARIO_FAILED');
    } finally {
      await writeFile(
        join(output, 'results.json'),
        JSON.stringify({ binarySha256: h.binarySha256, results }, null, 2),
      );
      console.log(JSON.stringify(results.at(-1)));
    }
  };
  try {
    await check('vault-setup-lock-unlock-and-locked-command-refusal', async () => {
      await h.wait('[name="fullName"]');
      if (language === 'en') await h.click('.language-switcher');
      await h.fill('[name="fullName"]', 'محام خيالي LAUNCH-PRIVATE-PROFILE');
      await h.fill('[name="password"]', password);
      await h.fill('[name="confirmPassword"]', password);
      await button('gate.submit.setup');
      await h.wait('.recovery-key');
      await h.click('.gate-confirm [role="checkbox"]');
      await button('gate.recoveryKeySavedButton');
      await h.wait('nav');
      await h.click(`button[aria-label=${JSON.stringify(t('app.lockButton'))}]`);
      await h.wait('[name="password"]');
      await assert.rejects(h.invoke('client_list', { input: {} }), { code: 'APP_LOCKED' });
      await h.fill('[name="password"]', password);
      await button('gate.submit.unlock');
      await h.wait('nav');
    });
    let client, caseItem, otherCase;
    await check('client-case-hearing-task-payment-document-chain', async () => {
      step = 'chain-client';
      client = await h.invoke('client_create', {
        input: {
          internalNumber: 'LAUNCH-CLIENT',
          fullName: 'موكل خيالي LAUNCH-PRIVATE-CLIENT',
          email: 'launch-secret@example.invalid',
          primaryPhone: '01000000999',
        },
      });
      step = 'chain-case';
      caseItem = await h.invoke('case_create', {
        input: {
          internalNumber: 'LAUNCH-CASE',
          status: 'ACTIVE',
          clients: [{ clientId: client.id }],
        },
      });
      step = 'chain-other-case';
      otherCase = await h.invoke('case_create', {
        input: {
          internalNumber: 'EXCLUDED-CASE',
          status: 'ACTIVE',
          clients: [{ clientId: client.id }],
        },
      });
      step = 'chain-hearing';
      const hearing = await h.invoke('hearing_create', {
        input: { caseId: caseItem.id, hearingDate: '2026-10-23', hearingTime: '09:30' },
      });
      step = 'chain-task';
      await h.invoke('task_create', {
        input: { caseId: caseItem.id, title: 'LAUNCH-PRIVATE-TASK', dueDate: '2026-10-23' },
      });
      await h.invoke('task_create', {
        input: { caseId: otherCase.id, title: 'EXCLUDED-TASK', dueDate: '2026-10-24' },
      });
      step = 'chain-archived-client';
      const archivedClient = await h.invoke('client_create', {
        input: { internalNumber: 'ARCHIVED-EXPORT', fullName: 'Fictional archived export client' },
      });
      await h.invoke('client_archive', { id: archivedClient.id });
      step = 'chain-payment';
      await h.invoke('payment_save', {
        input: {
          caseId: caseItem.id,
          payerClientId: client.id,
          amountMinor: 12345,
          paymentDate: '2026-10-22',
          paymentMethod: 'CASH',
        },
      });
      await h.selection('attachment');
      step = 'chain-document-source';
      const source = await h.invoke('attachment_select_source');
      step = 'chain-document-copy';
      await h.invoke('attachment_add', {
        input: { caseId: caseItem.id, sourceToken: source.sourceToken, category: 'OTHER' },
      });
      step = 'chain-hearing-check';
      assert.equal((await h.invoke('hearing_get', { id: hearing.id })).hearingDate, '2026-10-23');
      assert.equal(
        (await h.invoke('payment_list', { input: { caseId: caseItem.id } }))[0].amountMinor,
        12345,
      );
      step = 'chain-case-page';
      await h.go(`/cases/${caseItem.id}`);
      await h.wait('h2*=LAUNCH-CASE');
      step = 'chain-task-page';
      await h.go('/tasks?view=ALL');
      step = 'chain-task-visible';
      await h.wait('.task-title');
      step = 'chain-task-titles';
      const taskTitles = [];
      for (const item of await h.browser.$$('.task-title')) taskTitles.push(await item.getText());
      assert(taskTitles.includes('LAUNCH-PRIVATE-TASK'));
      await h.go(`/cases/${caseItem.id}`);
    });
    await check('full-and-case-export-cancel-scope-hashes-and-collision', async () => {
      await h.go('/backups');
      await button('exports.allAction');
      await button('common.cancel', dialog);
      await closed();
      await h.selection('cancel');
      await button('exports.allAction');
      await button('exports.confirm', dialog);
      await closed();
      step = 'export-full-publication';
      await h.selection('export');
      await button('exports.allAction');
      await button('exports.confirm', dialog);
      await closed();
      const folders = (await readdir(join(h.root, 'exported'))).filter((x) =>
        x.startsWith('LegalMasr-export-'),
      );
      assert.equal(folders.length, 1);
      const verify = async (folder, scope) => {
        const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'));
        assert.equal(manifest.scope, scope);
        assert.equal(manifest.formatVersion, 1);
        assert.equal(manifest.schemaVersion, 6);
        assert.equal(
          Object.keys(manifest.files).filter((name) => name.endsWith('.csv')).length,
          13,
        );
        assert.equal(manifest.encrypted, false);
        for (const [name, file] of Object.entries(manifest.files)) {
          const bytes = await readFile(join(folder, name));
          verifyExportEntry(name, bytes, file);
          assert(!bytes.includes(Buffer.from(password)));
          assert(!bytes.includes(Buffer.from('LAUNCH-PRIVATE-PROFILE')));
        }
        assert.equal(
          manifest.files['documents/' + (await readdir(join(folder, 'documents')))[0]].sha256,
          createHash('sha256').update(h.pdf).digest('hex'),
        );
        return manifest;
      };
      const full = await verify(join(h.root, 'exported', folders[0]), 'installation');
      assert.equal(full.files['cases.csv'].rowCount, 2);
      assert.equal(full.files['clients.csv'].rowCount, 2);
      const clientsCsv = csvRows(
        await readFile(join(h.root, 'exported', folders[0], 'clients.csv')),
      );
      const archivedRow = clientsCsv.find(
        (row) => row[clientsCsv[0].indexOf('internal_number')] === 'ARCHIVED-EXPORT',
      );
      assert.equal(archivedRow[clientsCsv[0].indexOf('archived')], '1');
      assert(
        (await readFile(join(h.root, 'exported', folders[0], 'clients.csv'), 'utf8')).includes(
          'ARCHIVED-EXPORT',
        ),
      );
      step = 'export-collision-refusal';
      await assert.rejects(
        h.invoke('export_create', { stamp: folders[0].slice('LegalMasr-export-'.length) }),
      );
      await h.go(`/cases/${caseItem.id}`);
      step = 'export-case-publication';
      await button('exports.caseAction');
      await button('exports.confirm', dialog);
      await closed();
      const caseFolder = (await readdir(join(h.root, 'exported'))).find((x) =>
        x.endsWith('-case-LAUNCH-CASE'),
      );
      const selected = await verify(join(h.root, 'exported', caseFolder), 'case');
      assert.equal(selected.caseId, caseItem.id);
      assert.equal(selected.files['cases.csv'].rowCount, 1);
      assert.equal(selected.files['clients.csv'].rowCount, 1);
      assert.equal(selected.files['tasks.csv'].rowCount, 1);
      for (const name of ['cases.csv', 'tasks.csv'])
        assert(
          !(await readFile(join(h.root, 'exported', caseFolder, name), 'utf8')).includes(
            'EXCLUDED-',
          ),
        );
      assert(
        (await readFile(join(h.root, 'exported', caseFolder, 'payments.csv'), 'utf8')).includes(
          '12345,"2026-10-22"',
        ),
      );
      assert(!(await readdir(join(h.root, 'exported'))).some((x) => x.endsWith('.partial')));
    });
    await check('support-bundle-dialog-cancel-redaction-existing-file-refusal', async () => {
      await writeFile(
        join(h.root, 'vault/logs/legalmaster.log.2026-10-20'),
        `2026-10-20T12:34:56Z ERROR legalmaster_lib::logging: command failed error_code="OPERATION_FAILED"
LAUNCH-PRIVATE ${password} ${h.root} launch-secret@example.invalid 01000000999
2026-10-20T12:34:56Z ERROR legalmaster_lib::logging: command failed error_code="OPERATION_FAILED" detail="LAUNCH-PRIVATE"
`,
      );
      await h.go('/settings?tab=about');
      await button('settings.supportBundle.create');
      assert.equal((await h.browser.$$(`${dialog} li`)).length, 6);
      await button('common.cancel', dialog);
      await closed();
      await button('settings.supportBundle.create');
      await h.selection('cancel');
      await button('settings.supportBundle.chooseDestination', dialog);
      await h.browser.waitUntil(async () => await h.browser.$(`${dialog} button`).isEnabled(), {
        timeout: 15000,
      });
      assert.equal(await h.browser.$(`${dialog} [role="alert"]`).isExisting(), false);
      await h.selection('support');
      await button('settings.supportBundle.chooseDestination', dialog);
      await closed();
      const archive = join(h.root, 'exported/support.zip');
      step = 'support-zip-inspection';
      const inspection = JSON.parse(
        execFileSync(
          'python3',
          [
            '-c',
            `import zipfile,json,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 print(json.dumps({n:z.read(n).decode('utf-8') for n in z.namelist()}))`,
            archive,
          ],
          { encoding: 'utf8' },
        ),
      );
      verifySupportEntries(inspection, [
        password,
        'LAUNCH-PRIVATE',
        'launch-secret@example.invalid',
        '01000000999',
        h.root,
      ]);
      const contents = Object.values(inspection).join('\n');
      assert(contents.includes('OPERATION_FAILED'));
      await button('settings.supportBundle.create');
      await button('settings.supportBundle.chooseDestination', dialog);
      await h.wait(`${dialog} [role="alert"]`);
      await button('common.cancel', dialog);
      await closed();
    });
    await check('permanent-case-client-delete-confirmation-cancel-and-managed-files', async () => {
      await assert.rejects(
        h.invoke('deletion_preview', { target: { kind: 'case', id: caseItem.id }, language }),
        { code: 'DELETION_NOT_ARCHIVED' },
      );
      step = 'delete-archive-case';
      await h.invoke('case_archive', { id: caseItem.id });
      await h.go(`/cases/${caseItem.id}`);
      step = 'delete-case-review';
      await button('deletion.title.case');
      await h.wait(`${dialog} input[data-slot="input"]:not([type="password"])`);
      step = 'delete-wrong-confirmation';
      await h.fill(`${dialog} input[data-slot="input"]:not([type="password"])`, 'WRONG');
      const confirm = await h.browser.$(
        `//button[normalize-space(.)=${JSON.stringify(t('deletion.confirmDelete'))}]`,
      );
      assert.equal(await confirm.isEnabled(), false);
      await button('forms.cancel', dialog);
      await closed();
      assert.equal((await h.invoke('case_get', { id: caseItem.id })).id, caseItem.id);
      step = 'delete-case-review';
      await button('deletion.title.case');
      await h.wait(`${dialog} input[data-slot="input"]:not([type="password"])`);
      // Confirmation word comes from the native localized preview; never assume translation.
      const preview = await h.invoke('deletion_preview', {
        target: { kind: 'case', id: caseItem.id },
        language,
      });
      await button('forms.cancel', dialog);
      await closed();
      step = 'delete-case-review';
      await button('deletion.title.case');
      await h.wait(`${dialog} input[data-slot="input"]:not([type="password"])`);
      await h.fill(
        `${dialog} input[data-slot="input"]:not([type="password"])`,
        preview.confirmationWord,
      );
      step = 'delete-managed-unlink-failure';
      await chmod(join(h.root, 'vault/attachments'), 0o500);
      await button('deletion.confirmDelete', dialog);
      await h.wait(`${dialog} [role="alert"]`);
      assert.equal((await readdir(join(h.root, 'vault/attachments'))).length, 1);
      await assert.rejects(h.invoke('case_get', { id: caseItem.id }), { code: 'CASE_NOT_FOUND' });
      await chmod(join(h.root, 'vault/attachments'), 0o700);
      step = 'delete-managed-unlink-retry';
      await button('deletion.retryFiles', dialog);
      await closed();
      await assert.rejects(h.invoke('case_get', { id: caseItem.id }), { code: 'CASE_NOT_FOUND' });
      assert.equal((await h.invoke('client_get', { id: client.id })).id, client.id);
      assert.equal((await readdir(join(h.root, 'vault/attachments'))).length, 0);
      assert.deepEqual(await readFile(join(h.root, 'fixtures/fictional.pdf')), h.pdf);
      await h.invoke('case_archive', { id: otherCase.id });
      step = 'delete-client';
      await h.invoke('client_archive', { id: client.id });
      await h.go(`/clients/${client.id}`);
      await button('deletion.title.client');
      await h.wait(`${dialog} input[data-slot="input"]:not([type="password"])`);
      await h.fill(
        `${dialog} input[data-slot="input"]:not([type="password"])`,
        preview.confirmationWord,
      );
      await button('deletion.confirmDelete', dialog);
      await closed();
      await assert.rejects(h.invoke('client_get', { id: client.id }), { code: 'CLIENT_NOT_FOUND' });
      assert.equal((await h.invoke('case_list', { input: { includeArchived: true } })).length, 0);
    });
    await check('whole-vault-reset-refusals-backup-and-restore', async () => {
      await h.invoke('client_create', {
        input: { internalNumber: 'RESET-SURVIVOR', fullName: 'Fictional reset backup sentinel' },
      });
      await h.go('/settings?tab=privacy');
      await button('deletion.title.all');
      await h.wait(`${dialog} input[type="password"]`);
      const preview = await h.invoke('deletion_preview', { target: { kind: 'all' }, language });
      await button('forms.cancel', dialog);
      await closed();
      await button('deletion.title.all');
      await h.wait(`${dialog} input[type="password"]`);
      await h.fill(
        `${dialog} input[data-slot="input"]:not([type="password"])`,
        preview.confirmationWord,
      );
      await h.fill(`${dialog} input[type="password"]`, 'incorrect fictional password');
      await h.selection('save');
      await button('deletion.confirmDelete', dialog);
      await h.wait(`${dialog} [role="alert"]`);
      assert.equal((await h.invoke('settings_get')).language, language);
      await h.fill(`${dialog} input[type="password"]`, password);
      await h.selection('cancel');
      await button('deletion.confirmDelete', dialog);
      await h.browser.waitUntil(
        async () => await h.browser.$(`${dialog} input[type="password"]`).isEnabled(),
        { timeout: 15000 },
      );
      assert.equal((await h.invoke('settings_get')).language, language);
      await h.fill(`${dialog} input[type="password"]`, password);
      await h.selection('save');
      await button('deletion.confirmDelete', dialog);
      await h.wait('[name="fullName"]');
      assert.equal(await h.browser.$('nav').isExisting(), false);
      assert((await readFile(join(h.root, 'exported/copy.lmsbackup'))).length > 0);
      assert.equal((await h.invoke('app_get_status')).initialized, false);
      step = 'reset-restore-external-copy';
      await h.selection('portable');
      await button('gate.restoreFromBackup');
      await button('restoreFrom.chooseFile');
      await h.fill('.restore-from-backup input[type="password"]', password);
      await button('restoreFrom.prepare', '.restore-from-backup');
      await h.wait('.restore-from-backup section');
      await button('backups.restoreConfirm', '.restore-from-backup');
      await h.wait('[name="password"]');
      await h.fill('[name="password"]', password);
      await button('gate.submit.unlock');
      await h.wait('nav');
      assert.equal(
        (await h.invoke('client_list', { input: {} }))[0].internalNumber,
        'RESET-SURVIVOR',
      );
    });
  } catch {
    process.exitCode = 1;
  } finally {
    await chmod(join(h.root, 'vault/attachments'), 0o700).catch(() => {});
    await h.close();
  }
}
