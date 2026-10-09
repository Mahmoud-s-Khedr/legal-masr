// Reuse the isolated native harness without changing application or existing journeys.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const source = await readFile(new URL('./desktop-e2e.mjs', import.meta.url), 'utf8');
if (
  !source.includes("await scenario('initialize-client-case-attachment-backup-restore'") ||
  !source.includes('const outputDirectory =')
)
  throw new Error('Native runner layout changed; update the audit adapter before running.');
const originalPrefix = source.slice(
  0,
  source.indexOf("await scenario('initialize-client-case-attachment-backup-restore'"),
);
const prefix = originalPrefix
  .replace(
    'const element = await browser.$(`//button',
    "const dialogScope=await browser.$('[role=\"dialog\"],[role=\"alertdialog\"]'); const useDialog=await dialogScope.isExisting(); const element = await (useDialog ? dialogScope : browser).$(`${useDialog ? '.' : ''}//button",
  )
  .replace(
    'normalize-space(.)=${JSON.stringify(text)}',
    'normalize-space(.)=${JSON.stringify(text)} or @aria-label=${JSON.stringify(text)}',
  )
  .replace(
    'async function scenario(name, exercise) {',
    `let qaAction = 'start';
async function scenario(name, exercise) {
if(process.env.QA_SCENARIOS && !process.env.QA_SCENARIOS.split(',').includes(name)) return;`,
  )
  .replace(
    'const click = async (text) => {',
    `const click = async (text) => { qaAction = 'click:' + text;`,
  )
  .replace(
    'const input = async (name, value) => {',
    `const input = async (name, value) => { qaAction = 'input:' + name;`,
  )
  .replace('...(pageState ? { pageState } : {}),', `...(pageState ? { pageState } : {}), qaAction,`)
  .replace(
    'const diagnosticMessage =',
    `if (browser && await browser.$('nav').isExisting().catch(()=>false) && !(await browser.$('input[type="password"]').isExisting().catch(()=>true))) { const dir=process.env.LEGALMASTER_E2E_OUTPUT_DIRECTORY ?? 'test-results/desktop'; await mkdir(dir,{recursive:true}); await browser.saveScreenshot(join(dir,name+'.png')).catch(()=>{}); }
 const diagnosticMessage =`,
  );
const suffix = source.slice(source.indexOf('const outputDirectory ='));
const additions = String.raw`
const catalog = JSON.parse(await readFile('src/i18n/ar/common.json', 'utf8'));
const t = (key) => key.split('.').reduce((value, part) => value[part], catalog);
async function field(h, label, value) {
 qaAction = 'field:' + label;
 const id = await h.browser.execute((text) => [...(document.querySelector('[role="dialog"]') ?? document.querySelector('main')).querySelectorAll('label')].find(e => e.textContent.trim() === text)?.htmlFor, label);
 assert.ok(id, 'Form label is associated with an input');
 const control = await h.browser.$('[id='+JSON.stringify(id)+']');
 await control.setValue(value);
 return control;
}
async function choose(h, label, query) {
 const control = await field(h, label, query);
 await control.click();
 const option = await h.browser.$('[role="option"]');
 await option.waitForDisplayed({timeout:15000});
 await option.click();
}
async function absentDialog(h) {await h.browser.$('[role="dialog"],[role="alertdialog"]').waitForExist({reverse:true,timeout:15000});}
async function seedCase(h, tag) {
 await h.initialize(); await h.client(tag);
 await h.nav('/cases'); await h.click(t('dashboard.addCase'));
 await h.input('internalNumber', tag+'-CASE');
 const picker = await h.browser.$('[data-slot="combobox-chip-input"]');
 await picker.click(); await picker.setValue(tag); await h.browser.$('[role="option"]').waitForDisplayed(); await h.browser.$('[role="option"]').click();
 await h.click(t('cases.form.submit')); // key replaced below if catalog differs
 await h.browser.$('h2*='+tag+'-CASE').waitForDisplayed({timeout:15000});
}
await scenario('extended-client-edit-archive-restore-validation-and-search', async h => {
 await h.initialize(); await h.nav('/clients'); await h.click('إضافة موكل');
 await h.click('حفظ الموكل');
 await h.browser.$('[role="alert"]').waitForDisplayed();
 assert.equal(await h.browser.$('input[name="fullName"]').getAttribute('aria-invalid'),'true');
 await h.input('internalNumber','QA-CLIENT'); await h.input('fullName','موكل خيالي QA'); await h.input('email','fictional@example.invalid');
 await h.click('حفظ الموكل'); await h.browser.$('h2*=موكل خيالي QA').waitForDisplayed({timeout:15000});
 for(const key of ['summary','cases','poas','account','attachments']) await h.click(t('clients.detail.tabs.'+key));
 await h.click(t('records.edit')); await h.input('fullName','موكل خيالي QA EDITED'); await h.click(t('records.saveEdits')); await absentDialog(h);
 await h.browser.$('h2*=QA EDITED').waitForDisplayed();
 await h.click(t('records.archive')); await h.click(t('common.cancel')); await absentDialog(h);
 await h.click(t('records.archive')); await h.click(t('clients.detail.archiveTitle')); await absentDialog(h);
 await h.click(t('records.restore')); await h.browser.$('//button[normalize-space(.)="'+t('records.archive')+'"]').waitForDisplayed();
 await h.nav('/clients'); const search=await h.browser.$('main input'); await search.setValue('QA-CLIENT'); await h.browser.$('a*=QA EDITED').waitForDisplayed();
 await search.setValue('NO-MATCH-FICTIONAL'); await h.browser.$('tbody a').waitForExist({reverse:true,timeout:15000});
});
await scenario('extended-poa-create-lawyer-edit-all-tabs-archive-restore', async h => {
 await h.initialize(); await h.client('QA-POA-CLIENT'); await h.nav('/powers-of-attorney'); await h.click(t('poa.add'));
 await h.click(t('poa.save')); await h.browser.$('[role="alert"]').waitForDisplayed();
 await h.input('internalSequence','QA-POA'); await h.input('officialNumber','447');
 const picker=await h.browser.$('[data-slot="combobox-chip-input"]'); await picker.click(); await picker.setValue('QA-POA-CLIENT'); await h.browser.$('[role="option"]').waitForDisplayed(); await h.browser.$('[role="option"]').click();
 await h.click(t('poa.addLawyer')); await h.input('lawyers.0.fullName','محام خيالي'); await h.input('lawyers.0.barNumber','QA-BAR'); await h.click(t('poa.save'));
 await h.browser.$('h2*=QA-POA').waitForDisplayed({timeout:15000});
 for(const key of ['summary','clients','lawyers','cases','documents']) await h.click(t('poa.tabs.'+key));
 await h.click(t('records.edit')); await h.input('officialNumber','448'); await h.click(t('poa.save')); await absentDialog(h);
 await h.click(t('records.archive')); await h.click(t('poa.archiveTitle')); await absentDialog(h);
 await h.click(t('records.restore')); await h.browser.$('//button[normalize-space(.)="'+t('records.archive')+'"]').waitForDisplayed();
});
await scenario('extended-task-invalid-create-edit-complete-reopen-delete', async h => {
 await h.initialize(); await h.nav('/tasks'); await h.click(t('tasks.add')); await h.click(t('tasks.save')); await h.browser.$('[role="dialog"] [role="alert"]').waitForDisplayed();
 await field(h,t('tasks.task'),'QA-FICTIONAL-TASK'); await h.click(t('tasks.save')); await absentDialog(h);
 await h.browser.$('.task-title*=QA-FICTIONAL-TASK').waitForDisplayed();
 await h.browser.$('.task-records [role="checkbox"]').click(); await h.click(t('tasks.views.COMPLETED')); await h.browser.$('.task-title*=QA-FICTIONAL-TASK').waitForDisplayed();
 await h.browser.$('.task-records [role="checkbox"]').click(); await h.click(t('tasks.views.ALL'));
 await h.click('QA-FICTIONAL-TASK'); await field(h,t('tasks.task'),'QA-FICTIONAL-EDITED'); await h.click(t('tasks.save')); await absentDialog(h);
 await h.browser.$('.task-title*=QA-FICTIONAL-EDITED').waitForDisplayed();
 await h.browser.$('.task-records button[aria-label]').click(); await h.click(t('common.cancel')); await absentDialog(h);
 await h.browser.$('.task-records button[aria-label]').click(); await h.click(t('tasks.deleteTitle')); await absentDialog(h);
 await h.browser.$('.task-title').waitForExist({reverse:true,timeout:15000});
});
await scenario('extended-case-hearing-and-finance-workflows', async h => {
 await seedCase(h,'QA-DOMAIN');
 for(const key of ['summary','relationships','hearings','tasks','attachments','account']) await h.click(t('cases.detail.tabs.'+key));
 await h.click(t('cases.detail.tabs.hearings')); await h.click(t('agenda.add'));
 await field(h,t('agenda.fields.date'),'09/10/2026'); await field(h,t('agenda.fields.location'),'محكمة خيالية QA'); await h.click(t('agenda.save')); await absentDialog(h);
 await h.browser.$('time').waitForDisplayed();
 await h.nav('/calendar'); for(const key of ['month','week','list']) await h.click(t('agenda.views.'+key));
 await h.click(t('agenda.previousPeriod'));  await h.click(t('agenda.nextPeriod')); await h.click(t('agenda.goToday'));
 await h.nav('/finances'); await h.click(t('finances.add.payment')); await h.click(t('finances.savePayment')); await h.browser.$('[role="dialog"] [role="alert"]').waitForDisplayed();
 await choose(h,t('finances.case'),'QA-DOMAIN-CASE'); await choose(h,t('finances.payer'),'QA-DOMAIN'); await field(h,t('finances.amount'),'1,500.50'); await h.click(t('finances.savePayment')); await absentDialog(h); await h.browser.$('tbody tr').waitForDisplayed();
 await h.click(t('records.edit')); await field(h,t('finances.amount'),'2000.75'); await h.click(t('finances.savePayment')); await absentDialog(h); await h.browser.waitUntil(async()=> (await h.browser.$('.money-positive bdi').getText()).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)&15)).replace(/[^0-9]/g,'') === '200075',{timeout:15000});
 await h.click(t('finances.expenses')); await h.click(t('finances.add.expense')); await field(h,t('finances.amount'),'250.25'); await h.click(t('finances.saveExpense')); await absentDialog(h); await h.browser.$('tbody tr').waitForDisplayed();
 await h.click(t('records.edit')); await field(h,t('finances.amount'),'300.10'); await h.click(t('finances.saveExpense')); await absentDialog(h); await h.browser.waitUntil(async()=> (await h.browser.$('.money-negative bdi').getText()).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)&15)).replace(/[^0-9]/g,'') === '30010',{timeout:15000});
});

await scenario('extended-settings-profile-theme-language-password', async h => {
 await h.initialize(); await h.nav('/settings'); await h.input('fullName','محام خيالي QA PROFILE'); await h.input('barNumber','QA-BAR-26'); await h.click(t('settings.profile.save')); await h.waitText(t('settings.profile.saved'));
 for(const key of ['general','security','backups','privacy','about','profile']) await h.click(t('settings.tabs.'+key));
 await h.close(); await h.launch(); await h.unlock(); await h.nav('/settings'); assert.equal(await h.browser.$('input[name="fullName"]').getValue(),'محام خيالي QA PROFILE');
 await h.click(t('settings.tabs.general')); await h.browser.$('[data-slot="select-trigger"]').waitForDisplayed({timeout:15000}); const triggers=await h.browser.$$('[data-slot="select-trigger"]'); await triggers[1].click(); await h.browser.$('[role="option"][data-value="dark"]').isExisting().then(async exists => {if(exists) await h.browser.$('[role="option"][data-value="dark"]').click(); else await h.browser.$('//*[contains(@role,"option") and contains(.,"'+t('settings.themes.dark')+'")]').click();});
 await h.click(t('settings.save')); await h.waitText(t('settings.saved')); assert.equal(await h.browser.$('html').getAttribute('data-theme'),'dark');
 await h.click(t('settings.tabs.security')); await h.input('current','fictional wrong password'); await h.input('next','fictional replacement password 2026'); await h.input('confirm','fictional replacement password 2026'); await h.click(t('settings.security.passwordTitle')); await h.browser.$('[role="alert"]').waitForDisplayed();
 await h.input('current',password); await h.click(t('settings.security.passwordTitle')); await h.waitText(t('settings.security.passwordChanged'));
 await h.click(t('nav.lock')); await h.input('password',password); await h.click(t('gate.submit.unlock')); await h.browser.$('[role="alert"]').waitForDisplayed(); assert.equal(await h.browser.$('nav').isExisting(),false);
 await h.input('password','fictional replacement password 2026'); await h.click(t('gate.submit.unlock')); await h.browser.$('nav').waitForDisplayed({timeout:15000});
});
await scenario('extended-attachment-cancel-metadata-remove-and-backup-validation', async h => {
 await h.initialize(); await h.client('QA-DOCUMENT'); await h.click(t('clients.detail.tabs.attachments')); await h.click(t('documents.add')); await h.selection('cancel'); await h.click(t('documents.pick')); assert.equal(await h.browser.$('.attachment-rows').isExisting(),false); await h.click(t('common.cancel')); await absentDialog(h);
 await h.selection('attachment'); await h.click(t('documents.add')); await h.click(t('documents.pick')); await h.waitText('fictional.pdf'); await field(h,t('documents.description'),'QA FICTIONAL DESCRIPTION'); await h.click(t('documents.save')); await absentDialog(h); await h.waitText('fictional.pdf');
 await h.browser.$('.attachment-rows button[aria-label*="'+t('records.edit')+'"]').click(); await field(h,t('documents.description'),'QA EDITED DESCRIPTION'); await h.click(t('records.saveEdits')); await absentDialog(h); await h.waitText('QA EDITED DESCRIPTION');
 await h.nav('/attachments'); await h.waitText('fictional.pdf'); await h.browser.$('.attachment-rows button[aria-label*="إزالة"]').click(); await h.click(t('common.cancel')); await absentDialog(h); await h.waitText('fictional.pdf');
 await h.browser.$('.attachment-rows button[aria-label*="إزالة"]').click(); await h.click(t('documents.removeTitle')); await absentDialog(h); await h.browser.$('.attachment-rows').waitForExist({reverse:true,timeout:15000});
 await h.nav('/backups'); await h.click(t('backups.createNow')); await h.waitText(t('backups.createSuccess')); await h.selection('backup'); await h.click(t('backups.validate')); await h.waitText(t('backups.validateSuccess'));
 await h.selection('corrupt'); await h.click(t('backups.validate')); await h.browser.$('[role="alert"]').waitForDisplayed(); assert.equal(await h.browser.$('[role="alert"]').getText(),'ملف النسخة الاحتياطية تالف أو غير صالح. لم تتغير بياناتك الحالية.');
 await h.nav('/clients'); await h.browser.$('a*=QA-DOCUMENT').waitForDisplayed();
});


await scenario('extended-case-edit-opponents-relations-fee-and-archive', async h => {
 await seedCase(h,'QA-COMPLETE'); await h.click(t('records.edit')); await h.input('officialNumber','321'); await field(h,t('cases.fields.summary'),'QA FICTIONAL SUBJECT'); await h.click(t('records.saveEdits')); await absentDialog(h); await h.waitText('QA FICTIONAL SUBJECT');
 await h.click(t('cases.detail.tabs.relationships')); await h.click(t('cases.parties.add')); await field(h,t('cases.parties.name'),'QA FICTIONAL OPPONENT'); await field(h,t('cases.parties.phone'),'01000000000'); await h.click(t('cases.parties.save')); await absentDialog(h); await h.waitText('QA FICTIONAL OPPONENT');
 const edit=await h.browser.$('.compact-records .row-actions button'); await edit.click(); await field(h,t('cases.parties.name'),'QA EDITED OPPONENT'); await h.click(t('cases.parties.save')); await absentDialog(h); await h.waitText('QA EDITED OPPONENT');
 await h.browser.$('.compact-records .row-actions button:last-child').click(); await h.click(t('cases.parties.removeTitle')); await absentDialog(h); await h.waitText(t('cases.parties.empty'));
 await h.browser.$('//section[contains(@class,"detail-card")][.//h3[contains(.,"'+t('cases.clientsPanel.title')+'")]]//button').click(); await h.click(t('records.saveEdits')); await absentDialog(h);
 await h.click(t('cases.detail.tabs.account')); await field(h,t('cases.detail.feeLabel'),'0'); await h.click(t('cases.detail.feeSave')); await h.browser.$('[role="alert"]').waitForDisplayed(); await field(h,t('cases.detail.feeLabel'),'1500.50'); await h.click(t('cases.detail.feeSave')); await h.waitText(t('cases.detail.feeSaved'));
 await h.click(t('records.archive')); await h.browser.$('//button[normalize-space(.)="'+t('records.restore')+'"]').waitForDisplayed(); await h.click(t('records.restore')); await h.browser.$('//button[normalize-space(.)="'+t('records.archive')+'"]').waitForDisplayed();
});
await scenario('extended-hearing-decision-next-hearing-edit-and-delete', async h => {
 await seedCase(h,'QA-DECISION'); await h.click(t('cases.detail.tabs.hearings')); await h.click(t('agenda.add')); await field(h,t('agenda.fields.date'),'10/10/2026'); await field(h,t('agenda.fields.location'),'QA FICTIONAL COURT'); await h.click(t('agenda.save')); await absentDialog(h);
 await h.click(t('agenda.recordDecision')); await field(h,t('agenda.fields.decisionText'),'QA FICTIONAL ADJOURNMENT'); await field(h,t('agenda.fields.nextHearing'),'12/10/2026'); await h.click(t('agenda.recordDecision')); await absentDialog(h); await h.waitText('QA FICTIONAL ADJOURNMENT');
 await h.click(t('agenda.editHearing')); await field(h,t('agenda.fields.location'),'QA NEXT HEARING EDITED'); await h.click(t('agenda.save')); await absentDialog(h); await h.waitText('QA NEXT HEARING EDITED');
 await h.browser.execute(()=>{globalThis.history.pushState({},'', '/calendar?date=2026-10-12');globalThis.dispatchEvent(new globalThis.PopStateEvent('popstate'));}); await h.waitText('QA NEXT HEARING EDITED'); await h.click(t('agenda.deleteHearing')); await h.click(t('common.cancel')); await absentDialog(h); await h.click(t('agenda.deleteHearing')); await h.click(t('agenda.confirmDelete')); await absentDialog(h); await h.browser.$('.agenda-item').waitForExist({reverse:true,timeout:15000});
});
await scenario('extended-recovery-key-reset-and-persisted-language', async h => {
 await h.input('fullName','محام خيالي QA RECOVERY'); await h.input('password',password); await h.input('confirmPassword',password); await h.click(t('gate.submit.setup')); await h.browser.$('.recovery-key').waitForDisplayed({timeout:15000}); const key=await h.browser.$('.recovery-key').getText(); await h.browser.$('.gate-confirm [role="checkbox"]').click(); await h.click(t('gate.recoveryKeySavedButton')); await h.browser.$('nav').waitForDisplayed();
 await h.click(t('nav.lock')); await h.click(t('gate.haveRecoveryKey')); await h.input('recoveryKey','0'.repeat(64)); await h.input('password','fictional recovered password 2026'); await h.input('confirmPassword','fictional recovered password 2026'); await h.click(t('gate.submit.recovery')); await h.browser.$('[role="alert"]').waitForDisplayed(); assert.equal(await h.browser.$('nav').isExisting(),false);
 await h.input('recoveryKey',key); await h.click(t('gate.submit.recovery')); await h.browser.$('nav').waitForDisplayed({timeout:15000}); await h.click('English'); await h.browser.waitUntil(async()=>await h.browser.$('html').getAttribute('lang')==='en',{timeout:15000});
 await h.close(); await h.launch(); await h.input('password','fictional recovered password 2026'); await h.click(t('gate.submit.unlock')); await h.browser.$('nav').waitForDisplayed({timeout:15000}); await h.browser.waitUntil(async()=>await h.browser.$('html').getAttribute('lang')==='en',{timeout:15000}); assert.equal(await h.browser.$('html').getAttribute('dir'),'ltr'); await h.click('العربية'); await h.browser.waitUntil(async()=>await h.browser.$('html').getAttribute('dir')==='rtl',{timeout:15000});
});


await scenario('regression-task-edit-preserves-custom-reminder', async h => {
 await h.initialize();
 const created=await h.browser.execute(async()=>await globalThis.__TAURI_INTERNALS__.invoke('task_create',{input:{title:'QA CUSTOM REMINDER',dueDate:'2026-10-10',reminderMinutes:120}}));
 assert.equal(created.reminderMinutes,120); await h.nav('/tasks'); await h.click(t('tasks.views.ALL')); await h.click('QA CUSTOM REMINDER'); await field(h,t('tasks.task'),'QA CUSTOM REMINDER EDITED'); await h.click(t('tasks.save')); await absentDialog(h);
 const rows=await h.browser.execute(async()=>await globalThis.__TAURI_INTERNALS__.invoke('task_list',{input:{view:'ALL',referenceDate:'2026-10-10'}})); const after=rows.find(r=>r.id===created.id);
 const dir=process.env.LEGALMASTER_E2E_OUTPUT_DIRECTORY ?? 'test-results/desktop'; await mkdir(dir,{recursive:true}); await writeFile(join(dir,'task-reminder-observation.json'),JSON.stringify({fixture:'fictional task seeded via existing typed IPC',before:created.reminderMinutes,after:after.reminderMinutes,editedTitlePersisted:after.title==='QA CUSTOM REMINDER EDITED'},null,2)); qaAction='assert:custom-task-reminder-preserved'; assert.equal(after.reminderMinutes,120,'Editing a title must preserve its existing reminder override');
});
await scenario('regression-hearing-edit-preserves-custom-reminder', async h => {
 await seedCase(h,'QA-REMINDER');
 const created=await h.browser.execute(async()=>{const [record]=await globalThis.__TAURI_INTERNALS__.invoke('case_list',{input:{}});return await globalThis.__TAURI_INTERNALS__.invoke('hearing_create',{input:{caseId:record.id,hearingDate:'2026-10-10',hearingTime:'09:30',location:'QA CUSTOM REMINDER COURT',reminderMinutes:120}});});
 assert.equal(created.reminderMinutes,120); await h.close(); await h.launch(); await h.unlock(); await h.nav('/cases'); await h.browser.$('a*=QA-REMINDER-CASE').waitForDisplayed({timeout:15000}); await h.browser.$('a*=QA-REMINDER-CASE').click(); await h.browser.$('h2*=QA-REMINDER-CASE').waitForDisplayed({timeout:15000}); await h.click(t('cases.detail.tabs.hearings')); await h.click(t('agenda.editHearing')); await field(h,t('agenda.fields.location'),'QA CUSTOM REMINDER COURT EDITED'); await h.click(t('agenda.save')); await absentDialog(h);
 const after=await h.browser.execute(async id=>await globalThis.__TAURI_INTERNALS__.invoke('hearing_get',{id}),created.id);
 const dir=process.env.LEGALMASTER_E2E_OUTPUT_DIRECTORY ?? 'test-results/desktop'; await mkdir(dir,{recursive:true}); await writeFile(join(dir,'hearing-reminder-observation.json'),JSON.stringify({fixture:'fictional hearing seeded via existing typed IPC',before:created.reminderMinutes,after:after.reminderMinutes,editedLocationPersisted:after.location==='QA CUSTOM REMINDER COURT EDITED'},null,2)); qaAction='assert:custom-hearing-reminder-preserved'; assert.equal(after.reminderMinutes,120,'Editing a location must preserve its existing reminder override');
});

`;
const generated = new URL('./.full-app-native-generated.mjs', import.meta.url);
try {
  await writeFile(
    generated,
    prefix + additions.replace("t('cases.form.submit')", "'حفظ القضية'") + suffix,
  );
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [generated.pathname], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  await unlink(generated).catch(() => {});
}
