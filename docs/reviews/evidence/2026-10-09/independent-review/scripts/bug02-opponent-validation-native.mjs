/* global console, document, process, Buffer, setTimeout */
import { openGuideDesktop } from '../../../../../../scripts/guide-desktop.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const out = process.argv[2];
await mkdir(out, { recursive: true });
const language = process.argv[3] ?? 'en';
const repo = process.cwd();
const cat = JSON.parse(await readFile(`${repo}/src/i18n/${language}/common.json`, 'utf8'));
const t = (k) => k.split('.').reduce((o, x) => o[x], cat);
const password = 'Reviewer fictional password 2026!';
const dialog = ':is([role="dialog"],[role="alertdialog"])';
const res = [];
const log = (v) => {
  res.push(v);
  console.log(JSON.stringify(v));
};
const h = await openGuideDesktop(language);
const measure = () =>
  h.browser.execute(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return { dialogOpen: false };
    const name = d.querySelector('input[required]');
    return {
      dialogOpen: true,
      alerts: [...d.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim()),
      ariaInvalidTrue: d.querySelectorAll('[aria-invalid="true"]').length,
      nameAriaInvalidAttr: name?.getAttribute('aria-invalid'),
      nameDescribedBy: name?.getAttribute('aria-describedby'),
      nameValue: name?.value,
      focusIsName: document.activeElement === name,
      activeTag: document.activeElement?.tagName,
      dataInvalidGroups: d.querySelectorAll('[data-invalid="true"]').length,
    };
  });
try {
  await h.invoke('app_initialize', {
    input: { fullName: 'Reviewer fictional lawyer', password, language },
  });
  const client = await h.invoke('client_create', {
    input: { internalNumber: 'REV-CLIENT', fullName: 'Reviewer client' },
  });
  const c = await h.invoke('case_create', {
    input: { internalNumber: 'REV-CASE', status: 'ACTIVE', clients: [{ clientId: client.id }] },
  });
  await h.restart();
  await h.wait('[name="password"]');
  await h.fill('[name="password"]', password);
  await h.click('form button[type="submit"]');
  await h.wait('nav');
  // Positive control A: Tasks empty create shows feedback in the same app.
  await h.go('/tasks?create=task');
  await h.wait(dialog);
  await h.button(t('tasks.save') ?? t('common.save'), dialog).catch(async () => {
    await h.click(`${dialog} button[type="submit"]`);
  });
  await new Promise((r) => setTimeout(r, 600));
  log({ control: 'task-empty-submit', ...(await measure()) });
  await h.browser.keys('Escape');
  await new Promise((r) => setTimeout(r, 400));
  // Subject: opponent empty submit.
  await h.go(`/cases/${c.id}`);
  const tabs = await h.browser.$$('[role="tab"]');
  const names = [];
  for (const x of tabs) names.push((await x.getText()).trim());
  log({ caseTabs: names });
  await h.tab(1);
  await h.button(t('cases.parties.add'));
  await h.wait(dialog);
  await h.button(t('cases.parties.save'), dialog);
  await new Promise((r) => setTimeout(r, 800));
  log({ step: 'opponent-empty-submit', ...(await measure()) });
  await writeFile(
    join(out, `opponent-empty-${language}.png`),
    Buffer.from(await h.browser.takeScreenshot(), 'base64'),
  );
  // whitespace-only name
  await h.fill(`${dialog} input[required]`, '   ');
  await h.button(t('cases.parties.save'), dialog);
  await new Promise((r) => setTimeout(r, 800));
  log({
    step: 'opponent-whitespace-submit',
    ...(await measure()),
    opponentsPersisted: (await h.invoke('case_get', { id: c.id })).opponents.length,
  });
  // typing then clearing after a failed submit: does validation ever surface?
  await h.fill(`${dialog} input[required]`, 'x');
  await h.fill(`${dialog} input[required]`, '');
  await new Promise((r) => setTimeout(r, 500));
  log({ step: 'after-type-and-clear-post-submit', ...(await measure()) });
  // valid name creates exactly one
  await h.fill(`${dialog} input[required]`, 'Reviewer fictional opponent');
  await h.button(t('cases.parties.save'), dialog);
  await h.browser.waitUntil(async () => !(await h.browser.$(dialog).isExisting()), {
    timeout: 10000,
  });
  log({
    step: 'valid-submit',
    opponents: (await h.invoke('case_get', { id: c.id })).opponents.length,
  });
} finally {
  await h.close();
  await writeFile(join(out, `bug02-${language}.json`), JSON.stringify(res, null, 2));
}
