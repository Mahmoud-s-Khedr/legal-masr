/* global console, document, process, Buffer, setTimeout */
/* Independent BUG-04 reproduction (native settings select labels). Fictional data only. */
import { openGuideDesktop } from '../../../../../../scripts/guide-desktop.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = process.argv[2];
await mkdir(out, { recursive: true });
const password = 'Reviewer fictional password 2026!';
const results = [];
const say = (v) => {
  results.push(v);
  console.log(JSON.stringify(v));
};

const read = (h) =>
  h.browser.execute(() => ({
    values: [...document.querySelectorAll('form [data-slot="select-value"]')].map((e) =>
      e.textContent.trim(),
    ),
    expanded: [...document.querySelectorAll('form [role="combobox"]')].length,
    html: document.querySelector('form [data-slot="select-value"]')?.outerHTML.slice(0, 200),
  }));

async function sample(h, label) {
  const series = [];
  const t0 = Date.now();
  for (const wait of [0, 500, 1500, 3000, 6000]) {
    const remaining = wait - (Date.now() - t0);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    series.push({ ms: Date.now() - t0, ...(await read(h)) });
  }
  const persisted = await h.invoke('settings_get');
  say({
    label,
    persisted: {
      language: persisted.language,
      theme: persisted.theme,
      dateFormat: persisted.dateFormat,
      weekStartsOn: persisted.weekStartsOn,
    },
    series: series.map((s) => ({ ms: s.ms, values: s.values })),
    firstSelectHtml: series[0].html,
  });
  return series;
}

for (const language of ['en', 'ar']) {
  // Path A: cold start. Initialize via IPC, restart the app (new process), unlock through the
  // real gate, then reach Settings by clicking the sidebar link.
  {
    const h = await openGuideDesktop(language);
    try {
      await h.invoke('app_initialize', {
        input: { fullName: 'Reviewer fictional lawyer', password, language },
      });
      await h.restart();
      await h.wait('[name="password"]');
      await h.fill('[name="password"]', password);
      await h.click('form button[type="submit"]');
      await h.wait('nav');
      await h.click('nav a[href="/settings"]');
      await h.wait('.settings');
      await sample(h, `${language}:cold-start-sidebar-click:general-tab-default`);
      await h.go('/settings?tab=general');
      await sample(h, `${language}:cold-start-pushState:general-tab`);
      await writeFile(
        join(out, `bug04-${language}-cold.png`),
        Buffer.from(await h.browser.takeScreenshot(), 'base64'),
      );
      // Does the dropdown know the right value even though the label is blank?
      const combos = await h.browser.$$('form [role="combobox"]');
      await combos[0].click();
      const opts = await h.browser.execute(() =>
        [...document.querySelectorAll('[role="option"]')].map((o) => ({
          text: o.textContent.trim(),
          selected: o.getAttribute('aria-selected'),
        })),
      );
      say({ label: `${language}:language-dropdown-options`, opts });
      await h.browser.keys('Escape');
      // Does a no-touch save still persist the right language/date format (no data loss)?
      const before = await h.invoke('settings_get');
      await h.click('form button[type="submit"]');
      await new Promise((r) => setTimeout(r, 1500));
      const after = await h.invoke('settings_get');
      say({
        label: `${language}:save-without-touching-selects`,
        unchanged:
          before.language === after.language &&
          before.theme === after.theme &&
          before.dateFormat === after.dateFormat &&
          before.weekStartsOn === after.weekStartsOn,
        before: { l: before.language, t: before.theme, d: before.dateFormat },
        after: { l: after.language, t: after.theme, d: after.dateFormat },
      });
    } finally {
      await h.close();
    }
  }
}
await writeFile(join(out, 'bug04.json'), JSON.stringify(results, null, 2));
