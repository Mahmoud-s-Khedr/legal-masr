/* global console, window, process, Buffer, setTimeout, document */
/* BUG-04 path discrimination on the real Tauri backend. Fictional data only. */
import { openGuideDesktop } from '../../../../../../scripts/guide-desktop.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = process.argv[2];
await mkdir(out, { recursive: true });
const savedLabel = JSON.parse(await readFile('src/i18n/en/common.json', 'utf8')).gate
  .recoveryKeySavedButton;
const password = 'Reviewer fictional password 2026!';
const results = [];
const vals = (h) =>
  h.browser.execute(() =>
    [...document.querySelectorAll('form [data-slot="select-value"]')].map((e) =>
      e.textContent.trim(),
    ),
  );
const settle = async (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const record = async (h, label) => {
  const first = await vals(h);
  await settle();
  const later = await vals(h);
  const row = { label, immediate: first, after2500ms: later };
  results.push(row);
  console.log(JSON.stringify(row));
};
async function coldSession(language) {
  const h = await openGuideDesktop(language);
  await h.invoke('app_initialize', {
    input: { fullName: 'Reviewer fictional lawyer', password, language },
  });
  await h.restart();
  await h.wait('[name="password"]');
  await h.fill('[name="password"]', password);
  await h.click('form button[type="submit"]');
  await h.wait('nav');
  return h;
}

// P1: deep link straight onto the Display tab as the first Settings visit.
{
  const h = await coldSession('en');
  try {
    await h.go('/settings?tab=general');
    await record(h, 'P1 cold start -> deep link /settings?tab=general (first visit)');
  } finally {
    await h.close();
  }
}
// P2: sidebar -> Settings (default tab) -> click the Display tab.
{
  const h = await coldSession('en');
  try {
    await h.click('nav a[href="/settings"]');
    await h.wait('.settings');
    await h.tab(1);
    await h.browser.waitUntil(
      async () =>
        (await (await h.browser.$$('[role="tab"]'))[1].getAttribute('aria-selected')) === 'true',
    );
    await record(h, 'P2 cold start -> sidebar Settings -> click Display tab');
    // P2b: leave to Today via the sidebar, then history-back onto the Display tab.
    await h.click('nav a[href="/"]');
    await h.wait('.workspace');
    await h.browser.execute(() => window.history.back());
    await h.wait('.settings');
    await record(h, 'P2b ... then sidebar Today, then history.back() to /settings?tab=general');
  } finally {
    await h.close();
  }
}
// P3: the auditor's exact route: real onboarding UI in this process, then go('/') + go(deep link).
{
  const h = await openGuideDesktop('en');
  try {
    await h.wait('[name="fullName"]');
    await h.click('.language-switcher');
    await h.fill('[name="fullName"]', 'Reviewer fictional lawyer');
    await h.fill('[name="password"]', password);
    await h.fill('[name="confirmPassword"]', password);
    await h.click('form button[type="submit"]');
    await h.wait('.recovery-key');
    await h.click('.gate-confirm [role="checkbox"]');
    await h.button(savedLabel);
    await h.wait('nav');
    await h.go('/');
    await h.go('/settings?tab=general');
    await record(h, 'P3 in-session onboarding -> go(/) -> deep link /settings?tab=general');
    await writeFile(join(out, 'p3.png'), Buffer.from(await h.browser.takeScreenshot(), 'base64'));
  } finally {
    await h.close();
  }
}
// P4: same in-session onboarding, but reach the tab the way a user would.
{
  const h = await openGuideDesktop('en');
  try {
    await h.wait('[name="fullName"]');
    await h.click('.language-switcher');
    await h.fill('[name="fullName"]', 'Reviewer fictional lawyer');
    await h.fill('[name="password"]', password);
    await h.fill('[name="confirmPassword"]', password);
    await h.click('form button[type="submit"]');
    await h.wait('.recovery-key');
    await h.click('.gate-confirm [role="checkbox"]');
    await h.button(savedLabel);
    await h.wait('nav');
    await h.click('nav a[href="/settings"]');
    await h.wait('.settings');
    await h.tab(1);
    await record(h, 'P4 in-session onboarding -> sidebar Settings -> click Display tab');
  } finally {
    await h.close();
  }
}
await writeFile(join(out, 'bug04b.json'), JSON.stringify(results, null, 2));
