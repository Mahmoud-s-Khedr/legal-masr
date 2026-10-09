import { remote } from 'webdriverio';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { WINDOWS_WEBVIEW_DEBUG_PORT } from './desktop-e2e-build.mjs';
import { CdpBrowser } from './desktop-e2e-cdp.mjs';
import {
  failedDesktopOutcome,
  stopDriver,
  waitForDriver,
  waitForWebView,
} from './desktop-e2e-driver.mjs';
const password = 'fictional desktop password 2026';
const strings = JSON.parse(await readFile(resolve('src/i18n/ar/common.json'), 'utf8'));
const restorePassword = 'fictional new recovery password 2026';
const bytes = Buffer.from('%PDF-1.4\nFictional attachment for desktop validation only.\n');
const binary = resolve(
  process.env.LEGALMASTER_E2E_BINARY ||
    `src-tauri/target/desktop-e2e/debug/legalmaster-solo${process.platform === 'win32' ? '.exe' : ''}`,
);
await access(binary);
const unmarkedEnvironment = { ...process.env };
delete unmarkedEnvironment.LEGALMASTER_E2E_ROOT;
delete unmarkedEnvironment.LEGALMASTER_E2E_NONCE;
const refused = spawnSync(binary, [], {
  env: unmarkedEnvironment,
  stdio: 'ignore',
  timeout: 15000,
});
assert.equal(refused.status, 2, 'Desktop harness must refuse unmarked launches');
// Verify that the test binary's API-configured port is free before each launch.
// This prevents attaching to another application or a surviving earlier process.
async function reserveDebuggingPort({ timeoutMs = 15_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const server = createServer();
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(WINDOWS_WEBVIEW_DEBUG_PORT, '127.0.0.1', resolve);
      });
      const { port } = server.address();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      return port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
const results = [];
const outputDirectory = process.env.LEGALMASTER_E2E_OUTPUT_DIRECTORY ?? 'test-results/desktop';
const binarySha256 = createHash('sha256')
  .update(await readFile(binary))
  .digest('hex');
await mkdir(outputDirectory, { recursive: true });
async function retainOutcomes() {
  await writeFile(
    join(outputDirectory, 'results.json'),
    JSON.stringify({ platform: process.platform, binarySha256, results }, null, 2),
  );
}
await retainOutcomes();
async function scenario(name, exercise) {
  if (process.env.LEGALMASTER_E2E_SCENARIO && process.env.LEGALMASTER_E2E_SCENARIO !== name) return;
  const root = await mkdtemp(join(tmpdir(), 'legalmaster-desktop-e2e-'));
  const nonce = randomUUID();
  await writeFile(join(root, 'runner-marker'), nonce);
  await mkdir(join(root, 'fixtures'));
  await writeFile(join(root, 'fixtures/fictional.pdf'), bytes);
  await writeFile(join(root, 'fixtures/corrupt.lmsbackup'), 'fictional corrupt archive');
  const selection = (value) => writeFile(join(root, 'dialog-selection'), value);
  await selection('attachment');
  // Current EdgeDriver versions attach a separate blank target to WebView2.
  // Windows uses the API-configured debug target directly; Linux uses Tauri's
  // WebDriver application-launch path.
  const windows = process.platform === 'win32';
  const driver = windows
    ? undefined
    : spawn('tauri-driver', [], {
        env: { ...process.env, LEGALMASTER_E2E_ROOT: root, LEGALMASTER_E2E_NONCE: nonce },
        stdio: 'ignore',
      });
  let driverError = false;
  driver?.on('error', () => {
    driverError = true;
  });
  let browser;
  let application;
  let stage = 'driver-start';
  let checkpoint;
  let webviewLaunch = 0;
  const launch = async () => {
    const capabilities = { 'tauri:options': { application: binary } };
    if (process.platform === 'win32') {
      stage = 'webview-start';
      const port = await reserveDebuggingPort();
      application = spawn(binary, [], {
        env: {
          ...process.env,
          LEGALMASTER_E2E_ROOT: root,
          LEGALMASTER_E2E_NONCE: nonce,
          // A new browser profile avoids a still-closing WebView2 child locking
          // its previous profile during the restart-persistence journey. The
          // application vault stays under the same marked test root.
          WEBVIEW2_USER_DATA_FOLDER: join(root, `webview-${++webviewLaunch}`),
        },
        stdio: 'ignore',
      });
      // Retain no process output; readiness reports only fixed startup categories.
      application.on('error', () => undefined);
      await waitForWebView(application, port);
      browser = await CdpBrowser.connect(port);
    } else {
      stage = 'webdriver-session';
      browser = await remote({
        hostname: '127.0.0.1',
        port: 4444,
        logLevel: 'silent',
        connectionRetryCount: 0,
        capabilities,
      });
    }
    await browser.setTimeout({ implicit: 0 });
    stage = 'scenario';
    return browser;
  };
  const close = async () => {
    try {
      if (browser) await browser.deleteSession();
    } finally {
      browser = undefined;
      if (application) {
        await stopDriver(application);
        application = undefined;
      }
    }
  };
  const click = async (text) => {
    const element = await browser.$(`//button[normalize-space(.)=${JSON.stringify(text)}]`);
    await element.waitForDisplayed({ timeout: 15000 });
    if (process.platform !== 'win32') {
      // WebDriver's wheel/animation-frame scrolling can stall in headless WebKit.
      // Scroll synchronously so native clicks cannot race the app's smooth scrolling.
      await browser.execute(
        (target) =>
          target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }),
        element,
      );
    }
    await element.waitForClickable({ timeout: 15000 });
    await element.click();
  };
  const nav = async (href) => {
    const link = await browser.$(`nav a[href="${href}"]`);
    await link.waitForDisplayed({ timeout: 15000 });
    if (process.platform !== 'win32') {
      await browser.execute(
        (target) =>
          target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }),
        link,
      );
    }
    await link.waitForClickable({ timeout: 15000 });
    await link.click();
  };
  const input = async (name, value) => {
    const element = await browser.$(`input[name="${name}"]`);
    await element.waitForDisplayed({ timeout: 15000 });
    await element.setValue(value);
  };
  const waitText = async (text) => {
    await browser
      .$(`//*[normalize-space(text())=${JSON.stringify(text)}]`)
      .waitForDisplayed({ timeout: 15000 });
  };
  let recoveryKey;
  const initialize = async () => {
    checkpoint = 'initialize-name';
    await input('fullName', 'محامٍ خيالي');
    checkpoint = 'initialize-password';
    await input('password', password);
    await input('confirmPassword', password);
    checkpoint = 'initialize-submit';
    await click('بدء الاستخدام');
    recoveryKey = await browser.$('.recovery-key').getText();
    checkpoint = 'initialize-confirm';
    await browser.$('.gate-confirm [role="checkbox"]').click();
    checkpoint = 'initialize-continue';
    await click('متابعة إلى مساحة العمل');
    await browser.$('nav').waitForDisplayed({ timeout: 15000 });
  };
  const unlock = async (value = password) => {
    await input('password', value);
    await click('فتح');
    await browser.$('nav').waitForDisplayed({ timeout: 15000 });
  };
  const client = async (number) => {
    await nav('/clients');
    await click('إضافة موكل');
    await input('internalNumber', number);
    await input('fullName', `موكل خيالي ${number}`);
    await click('حفظ الموكل');
    // Saving opens the new client file.
    await browser.$(`h2*=${`موكل خيالي ${number}`}`).waitForDisplayed({ timeout: 15000 });
  };
  try {
    if (driver) await waitForDriver(driver);
    await launch();
    stage = 'scenario';
    await exercise({
      root,
      selection,
      launch,
      close,
      click,
      nav,
      input,
      waitText,
      initialize,
      unlock,
      client,
      checkpoint(value) {
        checkpoint = value;
      },
      get recoveryKey() {
        return recoveryKey;
      },
      get browser() {
        return browser;
      },
    });
    await close();
    results.push({ scenario: name, result: 'passed' });
  } catch (error) {
    const diagnosticMessage =
      stage === 'scenario' && browser
        ? await browser
            .$('[role="alert"]')
            .getText()
            .catch(() => '')
        : '';
    const pageState =
      stage === 'scenario' && browser
        ? await browser
            .execute(() => ({
              applicationOrigin: globalThis.location.hostname === 'tauri.localhost',
              documentReady: globalThis.document.readyState === 'complete',
              rootHasContent: Boolean(globalThis.document.querySelector('#root')?.children.length),
              initializeInputPresent: Boolean(
                globalThis.document.querySelector('input[name="fullName"]'),
              ),
              gatePresent: Boolean(globalThis.document.querySelector('.gate')),
              confirmationPresent: Boolean(globalThis.document.querySelector('.gate-confirm')),
              workspacePresent: Boolean(globalThis.document.querySelector('nav')),
              caseListRoute: globalThis.location.pathname === '/cases',
              caseListLinkPresent: Boolean(
                globalThis.document.querySelector('table tbody a[href^="/cases/"]'),
              ),
              loadErrorPresent: Boolean(globalThis.document.querySelector('[role="alert"]')),
            }))
            .catch(() => undefined)
        : undefined;
    results.push({
      ...failedDesktopOutcome({
        scenario: name,
        stage,
        checkpoint,
        error,
        diagnosticMessage,
      }),
      ...(pageState ? { pageState } : {}),
    });
    // WebDriver exceptions may include secret input, paths, or DOM. Never print them.
  } finally {
    await retainOutcomes();
    await close().catch(() => undefined);
    if (driver?.exitCode === null && !driverError) {
      await stopDriver(driver);
    }
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
await scenario('initialize-client-case-attachment-backup-restore', async (h) => {
  h.checkpoint('initialize');
  await h.initialize();
  h.checkpoint('create-client');
  await h.client('E2E-ORIGINAL');
  h.checkpoint('create-case');
  await h.nav('/cases');
  await h.click('إضافة قضية');
  await h.input('internalNumber', 'E2E-CASE');
  const picker = await h.browser.$('[data-slot="combobox-chip-input"]');
  await picker.waitForDisplayed();
  await picker.click();
  await picker.setValue('E2E-ORIGINAL');
  await h.browser.$('[role="option"]').waitForDisplayed();
  await h.browser.$('[role="option"]').click();
  await h.click('حفظ القضية');
  // Saving opens the new case file.
  await h.browser.$('h2*=E2E-CASE').waitForDisplayed({ timeout: 15000 });
  h.checkpoint('add-attachment');
  await h.click('المستندات');
  await h.click('إضافة مستند');
  await h.click('اختيار ملف');
  await h.waitText('fictional.pdf');
  await h.click('حفظ المستند');
  await h.browser.$('.attachment-rows').waitForDisplayed({ timeout: 15000 });
  h.checkpoint('create-backup');
  await h.nav('/backups');
  await h.click('إنشاء نسخة احتياطية الآن');
  await h.waitText('تم إنشاء النسخة الاحتياطية بنجاح.');
  h.checkpoint('edit-after-backup');
  await h.client('E2E-AFTER');
  h.checkpoint('restore-backup');
  await h.selection('backup');
  await h.nav('/backups');
  await h.click('استعادة من نسخة احتياطية');
  await h.click(strings.restoreFrom.chooseFile);
  await h.click('تأكيد الاستعادة');
  await h.browser.$('.gate').waitForDisplayed({ timeout: 15000 });
  h.checkpoint('unlock-restored-vault');
  await h.unlock();
  h.checkpoint('verify-restored-records');
  await h.nav('/clients');
  await h.browser.$('a*=E2E-ORIGINAL').waitForDisplayed();
  assert.equal(await h.browser.$('a*=E2E-AFTER').isExisting(), false);
  await h.nav('/cases');
  await h.browser.$('a*=E2E-CASE').click();
  h.checkpoint('verify-restored-attachment');
  await h.click('المستندات');
  await h.waitText('fictional.pdf');
  h.checkpoint('verify-attachment-bytes');
  await h.close();
  const managed = await readdir(join(h.root, 'vault/attachments'));
  assert.equal(managed.length, 1);
  assert.deepEqual(await readFile(join(h.root, 'vault/attachments', managed[0])), bytes);
  assert.deepEqual(await readFile(join(h.root, 'fixtures/fictional.pdf')), bytes);
});
await scenario('wrong-password-refusal', async (h) => {
  await h.initialize();
  await h.click('قفل التطبيق');
  await h.input('password', 'fictional incorrect password');
  await h.click('فتح');
  await h.browser.$('[role="alert"]').waitForDisplayed();
  assert.equal(await h.browser.$('nav').isExisting(), false);
  await h.unlock();
});
for (const choice of ['cancel', 'corrupt'])
  await scenario(`${choice}-restore-preserves-active-data`, async (h) => {
    await h.initialize();
    await h.client('E2E-PRESERVED');
    await h.selection(choice);
    await h.nav('/backups');
    await h.click(strings.backups.restore);
    await h.click(strings.restoreFrom.chooseFile);
    if (choice === 'corrupt') {
      const alert = await h.browser.$('[role="alert"]');
      await alert.waitForDisplayed({ timeout: 15000 });
      assert.equal(await alert.getText(), strings.errors.BACKUP_CORRUPTED);
    } else {
      await h.browser.waitUntil(
        async () =>
          await h.browser
            .$(`//button[normalize-space(.)="${strings.restoreFrom.chooseFile}"]`)
            .isEnabled(),
        { timeout: 15000 },
      );
      assert.equal(await h.browser.$('[role="alert"]').isExisting(), false);
    }
    await h.click(strings.common.cancel);
    await h.nav('/clients');
    await h.browser.$('a*=E2E-PRESERVED').waitForDisplayed();
  });
if (process.platform === 'linux')
  await scenario('native-picker-responsive-cancellation-and-lock', async (h) => {
    await h.initialize();
    await h.selection('native');
    await h.nav('/backups');
    await h.click(strings.backups.restore);
    await h.click(strings.restoreFrom.chooseFile);
    h.checkpoint('picker-heartbeat');
    const beat = await h.browser.execute(async () => {
      const start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return performance.now() - start;
    });
    assert.ok(beat >= 90 && beat < 2000);
    h.checkpoint('lock-with-picker-open');
    await h.browser.execute(() =>
      globalThis.document.querySelector('button[aria-label="قفل التطبيق"]').click(),
    );
    assert.equal(spawnSync('xdotool', ['key', 'Escape']).status, 0);
    await h.browser.$('input[name="password"]').waitForDisplayed({ timeout: 15000 });
    await h.unlock();
    assert.equal(await h.browser.$('.restore-from-backup').isExisting(), false);
    assert.equal(await h.browser.$('[role="alert"]').isExisting(), false);
  });
// A workspace with one client, one case and one managed attachment, backed up from the UI.
async function seedAndBackUp(h, label) {
  h.checkpoint('seed-client');
  await h.initialize();
  await h.client(`E2E-${label}`);
  h.checkpoint('seed-case');
  await h.nav('/cases');
  await h.click('إضافة قضية');
  await h.input('internalNumber', `E2E-${label}-CASE`);
  const picker = await h.browser.$('[data-slot="combobox-chip-input"]');
  await picker.waitForDisplayed();
  await picker.click();
  await picker.setValue(`E2E-${label}`);
  await h.browser.$('[role="option"]').waitForDisplayed();
  await h.browser.$('[role="option"]').click();
  await h.click('حفظ القضية');
  await h.browser.$(`h2*=E2E-${label}-CASE`).waitForDisplayed({ timeout: 15000 });
  h.checkpoint('seed-attachment');
  await h.click('المستندات');
  await h.click('إضافة مستند');
  await h.click('اختيار ملف');
  await h.waitText('fictional.pdf');
  await h.click('حفظ المستند');
  await h.browser.$('.attachment-rows').waitForDisplayed({ timeout: 15000 });
  h.checkpoint('seed-backup');
  await h.nav('/backups');
  await h.click('إنشاء نسخة احتياطية الآن');
  await h.waitText('تم إنشاء النسخة الاحتياطية بنجاح.');
  // Carry a verified copy out through the same save dialog used by the lawyer.
  h.checkpoint('save-copy');
  await h.selection('save');
  await h.click(strings.backups.saveCopy);
  await h.waitText(strings.backups.saveCopySuccess.replace('{{name}}', 'copy.lmsbackup'));
  h.checkpoint('copy-saved');
  await h.close();
  await h.selection('portable');
}
async function expectRestoredWorkspace(h, label, value = password) {
  h.checkpoint('unlock-restored');
  await h.unlock(value);
  h.checkpoint('restored-clients');
  await h.nav('/clients');
  await h.browser.$(`a*=E2E-${label}`).waitForDisplayed();
  h.checkpoint('restored-case');
  await h.nav('/cases');
  h.checkpoint('restored-case-route');
  const restoredCase = await h.browser.$('table tbody a[href^="/cases/"]');
  await restoredCase.waitForDisplayed({ timeout: 15000 });
  h.checkpoint('restored-case-identity');
  assert.equal(
    process.platform === 'win32'
      ? (await restoredCase.getText()) === `E2E-${label}-CASE`
      : await h.browser.execute(
          (target, expected) => target.textContent === expected,
          restoredCase,
          `E2E-${label}-CASE`,
        ),
    true,
  );
  h.checkpoint('restored-case-open');
  // Exercise keyboard activation too; WebKit's native scrolling click can stall on
  // a long mixed-direction link, even after the exact restored identity is verified.
  if (process.platform === 'win32') await restoredCase.click();
  else {
    await h.browser.execute((target) => target.focus(), restoredCase);
    await h.browser.keys('Enter');
  }
  h.checkpoint('restored-documents');
  await h.click('المستندات');
  await h.waitText('fictional.pdf');
  h.checkpoint('verify-attachment-bytes');
  await h.close();
  const managed = await readdir(join(h.root, 'vault/attachments'));
  assert.equal(managed.length, 1);
  assert.deepEqual(await readFile(join(h.root, 'vault/attachments', managed[0])), bytes);
}
async function restoreWithPassword(h) {
  h.checkpoint('open-restore');
  await h.click('استعادة من نسخة احتياطية');
  await h.click('اختيار ملف النسخة');
  const secret = await h.browser.$('input[type="password"]');
  await secret.waitForDisplayed({ timeout: 15000 });
  h.checkpoint('wrong-password');
  await secret.setValue('fictional incorrect password');
  await h.click(strings.restoreFrom.prepare);
  const alert = await h.browser.$('[role="alert"]');
  await alert.waitForDisplayed({ timeout: 30000 });
  assert.equal(await alert.getText(), 'كلمة المرور غير صحيحة. تحقق منها وحاول مرة أخرى.');
  // A refused attempt changes nothing, and the same file is used for the next one.
  assert.equal(await h.browser.$('nav').isExisting(), false);
  h.checkpoint('original-password');
  await secret.setValue(password);
  await h.click(strings.restoreFrom.prepare);
  await h.click(strings.backups.restoreConfirm);
  await h.browser.$('input[name="password"]').waitForDisplayed({ timeout: 60000 });
}
await scenario(
  'fresh-installation-restores-a-portable-backup-with-the-original-password',
  async (h) => {
    await seedAndBackUp(h, 'PORTABLE');
    // A new machine: nothing of the old installation remains.
    await rm(join(h.root, 'vault'), { recursive: true, force: true });
    await h.launch();
    await restoreWithPassword(h);
    await expectRestoredWorkspace(h, 'PORTABLE');
  },
);
await scenario('recovery-key-restore-stages-a-new-password', async (h) => {
  await seedAndBackUp(h, 'RECOVERY');
  const key = h.recoveryKey;
  await rm(join(h.root, 'vault'), { recursive: true, force: true });
  await h.launch();
  await h.click(strings.gate.restoreFromBackup);
  await h.click(strings.restoreFrom.chooseFile);
  h.checkpoint('recovery-inputs');
  await h.browser.$('input[name="restore-method"]').waitForDisplayed({ timeout: 15000 });
  const choices = await h.browser.$$('input[name="restore-method"]');
  await choices[1].click();
  await h.browser.$('input[autocomplete="new-password"]').waitForDisplayed({ timeout: 15000 });
  const fields = await h.browser.$$('input[type="password"]');
  await fields[0].setValue(key);
  await fields[1].setValue(restorePassword);
  await fields[2].setValue(restorePassword);
  await h.click(strings.restoreFrom.prepare);
  h.checkpoint('recovery-preview');
  await h.click(strings.backups.restoreConfirm);
  await expectRestoredWorkspace(h, 'RECOVERY', restorePassword);
});
await scenario('incomplete-installation-restores-a-portable-backup', async (h) => {
  await seedAndBackUp(h, 'RECOVERED');
  // The database is lost; the security file and attachments remain.
  await rm(join(h.root, 'vault/legalmaster.sqlite'), { force: true });
  await h.launch();
  const notice = await h.browser.$('[role="alert"]');
  await notice.waitForDisplayed({ timeout: 15000 });
  assert.match(await notice.getText(), /ملفات مساحة العمل غير مكتملة/);
  await restoreWithPassword(h);
  await expectRestoredWorkspace(h, 'RECOVERED');
  // What was left behind is kept for the lawyer, not deleted.
  assert.ok((await readdir(join(h.root, 'vault/EmergencySnapshots'))).length >= 1);
});
await scenario('opponent-form-announces-missing-name', async (h) => {
  await h.initialize();
  await h.client('E2E-OPPONENT-CLIENT');
  await h.nav('/cases');
  await h.click('إضافة قضية');
  await h.input('internalNumber', 'E2E-OPPONENT-CASE');
  const picker = await h.browser.$('[data-slot="combobox-chip-input"]');
  await picker.waitForDisplayed();
  await picker.click();
  await picker.setValue('E2E-OPPONENT-CLIENT');
  await h.browser.$('[role="option"]').waitForDisplayed();
  await h.browser.$('[role="option"]').click();
  await h.click('حفظ القضية');
  await h.browser.$('h2*=E2E-OPPONENT-CASE').waitForDisplayed({ timeout: 15000 });
  h.checkpoint('open-opponent-form');
  await h.click('الأطراف');
  await h.click('إضافة خصم');
  const dialog = await h.browser.$('[role="dialog"]');
  await dialog.waitForDisplayed({ timeout: 15000 });
  for (const value of ['', '   ']) {
    h.checkpoint('submit-invalid-opponent');
    if (value) await dialog.$('input[required]').setValue(value);
    await h.click('حفظ الخصم');
    const alert = await dialog.$('[role="alert"]');
    await alert.waitForDisplayed({ timeout: 15000 });
    assert.equal(await alert.getText(), 'هذا الحقل مطلوب.');
    const name = await dialog.$('input[required]');
    assert.equal(await name.getAttribute('aria-invalid'), 'true');
    assert.equal(await name.getAttribute('aria-describedby'), await alert.getAttribute('id'));
  }
  assert.equal(await dialog.isExisting(), true, 'the dialog keeps the draft open');
});
await scenario('settings-display-tab-deep-link-shows-saved-labels', async (h) => {
  await h.initialize();
  h.checkpoint('open-display-tab-by-deep-link');
  // First Settings visit arrives directly on the tab, as history navigation and links do.
  await h.browser.execute(() => {
    globalThis.history.pushState({}, '', '/settings?tab=general');
    globalThis.dispatchEvent(new globalThis.PopStateEvent('popstate'));
  });
  await h.browser.$('[data-slot="select-trigger"]').waitForDisplayed({ timeout: 15000 });
  h.checkpoint('read-selected-labels');
  const labels = await h.browser.execute(() =>
    [...globalThis.document.querySelectorAll('[data-slot="select-trigger"]')].map((trigger) =>
      trigger.querySelector('[data-slot="select-value"]')?.textContent.trim(),
    ),
  );
  assert.deepEqual(labels.slice(0, 4), [
    'العربية',
    'حسب إعداد الجهاز',
    'يوم/شهر/سنة (03/10/2026)',
    'السبت',
  ]);
});
await scenario('restart-persistence', async (h) => {
  await h.initialize();
  await h.client('E2E-PERSISTENT');
  await h.close();
  await h.launch();
  await h.unlock();
  await h.nav('/clients');
  await h.browser.$('a*=E2E-PERSISTENT').waitForDisplayed();
});
await retainOutcomes();
for (const result of results) console.log(JSON.stringify(result));
if (results.some((result) => result.result !== 'passed')) process.exitCode = 1;
