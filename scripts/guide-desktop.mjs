/* global window, document, requestAnimationFrame, PopStateEvent */
import { remote } from 'webdriverio';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { waitForDriver } from './desktop-e2e-driver.mjs';

export async function openGuideDesktop(language) {
  const root = await mkdtemp(join(tmpdir(), 'legalmaster-desktop-e2e-'));
  const nonce = randomUUID();
  await writeFile(join(root, 'runner-marker'), nonce);
  await mkdir(join(root, 'fixtures'));
  // A real, minimal PDF rather than a misleading filename-only fixture.
  const pdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  );
  await writeFile(join(root, 'fixtures/fictional.pdf'), pdf);
  await writeFile(join(root, 'fixtures/corrupt.lmsbackup'), 'Invalid fictional archive');
  await writeFile(join(root, 'dialog-selection'), 'attachment');
  const binary = resolve(
    process.env.LEGALMASTER_E2E_BINARY || 'src-tauri/target/desktop-e2e/debug/legalmaster-solo',
  );
  const driver = spawn('tauri-driver', [], {
    env: {
      ...process.env,
      LEGALMASTER_E2E_ROOT: root,
      LEGALMASTER_E2E_NONCE: nonce,
      GDK_BACKEND: 'x11',
      WEBKIT_DISABLE_DMABUF_RENDERER: '1',
    },
    stdio: 'ignore',
  });
  // Errors are intentionally handled without serializing WebDriver input/DOM.
  driver.on('error', () => {});
  let browser;
  const launch = async () => {
    browser = await remote({
      hostname: '127.0.0.1',
      port: 4444,
      logLevel: 'silent',
      connectionRetryCount: 0,
      capabilities: { 'tauri:options': { application: binary } },
    });
    await browser.setTimeout({ implicit: 0, script: 30000 });
    await browser.setWindowSize(1440, 900);
  };
  const close = async () => {
    if (browser) await browser.deleteSession().catch(() => {});
    browser = undefined;
    driver.kill();
    await rm(root, { recursive: true, force: true });
  };
  try {
    await waitForDriver(driver);
    await launch();
  } catch {
    await close();
    throw new Error('GUIDE_DESKTOP_START_FAILED');
  }
  const api = {
    root,
    language,
    pdf,
    binarySha256: createHash('sha256')
      .update(await readFile(binary))
      .digest('hex'),
    get browser() {
      return browser;
    },
    close,
    restart: async () => {
      await browser.deleteSession();
      browser = undefined;
      await launch();
    },
    selection: (choice) => writeFile(join(root, 'dialog-selection'), choice),
    wait: async (selector) => {
      await browser.$(selector).waitForDisplayed({ timeout: 20000 });
    },
    click: async (selector) => {
      const target = await browser.$(selector);
      await target.waitForDisplayed({ timeout: 20000 });
      await browser.execute(
        (el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }),
        target,
      );
      await target.waitForClickable({ timeout: 15000 });
      await target.click();
    },
    fill: async (selector, value) => {
      await api.wait(selector);
      if (value === '') await browser.$(selector).clearValue();
      else await browser.$(selector).setValue(value);
    },
    invoke: async (command, args = {}) => {
      const result = await browser.executeAsync(
        (cmd, input, done) => {
          window.__TAURI_INTERNALS__.invoke(cmd, input).then(
            (value) => done({ ok: true, value }),
            (error) => done({ ok: false, code: error?.code || 'OPERATION_FAILED' }),
          );
        },
        command,
        args,
      );
      if (!result.ok) {
        const error = new Error(result.code);
        error.code = result.code;
        throw error;
      }
      return result.value;
    },
    go: async (path) => {
      if (await browser.$('.command-palette,.create-menu').isExisting())
        await browser.keys('Escape');
      await browser.execute((next) => {
        window.history.pushState({}, '', next);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);
      await browser.executeAsync((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            document.scrollingElement.scrollTop = 0;
            done();
          }),
        ),
      );
      await api.wait('.workspace');
      await browser.waitUntil(
        async () => !(await browser.$('.workspace .page-status[role="status"]').isExisting()),
        { timeout: 20000 },
      );
    },
    tab: async (index) => {
      const tabs = await browser.$$('[role="tab"]');
      assert(tabs[index]);
      await browser.execute(
        (el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }),
        tabs[index],
      );
      await tabs[index].waitForClickable({ timeout: 15000 });
      await tabs[index].click();
    },
    button: async (text, scope = '') => {
      const buttons = await browser.$$(`${scope} button`);
      for (const button of buttons)
        if ((await button.getText()).trim() === text) {
          await browser.execute(
            (el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }),
            button,
          );
          await button.click();
          return;
        }
      throw new Error('GUIDE_BUTTON_MISSING');
    },
  };
  return api;
}
