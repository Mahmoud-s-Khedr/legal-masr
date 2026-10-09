/* global console, process, Buffer, setTimeout, document */
import { openGuideDesktop } from '../../../../../../scripts/guide-desktop.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const out = process.argv[2];
await mkdir(out, { recursive: true });
const password = 'Reviewer fictional password 2026!';
const h = await openGuideDesktop('en');
const res = [];
const log = (v) => {
  res.push(v);
  console.log(JSON.stringify(v));
};
try {
  await h.invoke('app_initialize', {
    input: { fullName: 'Reviewer fictional lawyer', password, language: 'en' },
  });
  await h.restart();
  await h.wait('[name="password"]');
  await h.fill('[name="password"]', password);
  await h.click('form button[type="submit"]');
  await h.wait('nav');
  await h.go('/settings?tab=general');
  await new Promise((r) => setTimeout(r, 1500));
  const vals = () =>
    h.browser.execute(() =>
      [...document.querySelectorAll('form [data-slot="select-value"]')].map((e) =>
        e.textContent.trim(),
      ),
    );
  log({ step: 'blank-state', values: await vals() });
  await writeFile(
    join(out, 'blank-state.png'),
    Buffer.from(await h.browser.takeScreenshot(), 'base64'),
  );
  const combos = await h.browser.$$('form [role="combobox"]');
  await combos[0].click();
  log({
    step: 'language-options-while-blank',
    opts: await h.browser.execute(() =>
      [...document.querySelectorAll('[role="option"]')].map((o) => ({
        t: o.textContent.trim(),
        sel: o.getAttribute('aria-selected'),
      })),
    ),
  });
  await h.browser.keys('Escape');
  const before = await h.invoke('settings_get');
  await h.click('form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1500));
  const after = await h.invoke('settings_get');
  log({
    step: 'save-while-blank',
    before: [before.language, before.theme, before.dateFormat],
    after: [after.language, after.theme, after.dateFormat],
    valuesAfterSave: await vals(),
  });
  // Does picking a value from the blank select persist correctly?
  const combos2 = await h.browser.$$('form [role="combobox"]');
  await combos2[1].click();
  await h.click('//*[@role="option"][normalize-space(.)="Dark"]');
  await h.click('form button[type="submit"]');
  await h.browser.waitUntil(async () => (await h.invoke('settings_get')).theme === 'dark', {
    timeout: 10000,
  });
  const fin = await h.invoke('settings_get');
  log({
    step: 'pick-dark-while-others-blank',
    persisted: [fin.language, fin.theme, fin.dateFormat],
    values: await vals(),
  });
  // revisit via sidebar -> still ok?
  await h.click('nav a[href="/settings"]');
  await h.wait('.settings');
  await h.tab(1);
  await new Promise((r) => setTimeout(r, 1500));
  log({ step: 'revisit-by-click', values: await vals() });
} finally {
  await h.close();
  await writeFile(join(out, 'bug04c.json'), JSON.stringify(res, null, 2));
}
