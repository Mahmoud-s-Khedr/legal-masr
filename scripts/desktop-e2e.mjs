import { remote } from 'webdriverio';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { WINDOWS_WEBVIEW_DEBUG_PORT } from './desktop-e2e-build.mjs';
import {
  failedDesktopOutcome,
  selectDesktopWindow,
  stopDriver,
  waitForDriver,
  waitForWebView,
} from './desktop-e2e-driver.mjs';
const password = 'fictional desktop password 2026';
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
async function reserveDebuggingPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(WINDOWS_WEBVIEW_DEBUG_PORT, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}
const results = [];
async function scenario(name, exercise) {
  const root = await mkdtemp(join(tmpdir(), 'legalmaster-desktop-e2e-'));
  const nonce = randomUUID();
  await writeFile(join(root, 'runner-marker'), nonce);
  await mkdir(join(root, 'fixtures'));
  await writeFile(join(root, 'fixtures/fictional.pdf'), bytes);
  await writeFile(join(root, 'fixtures/corrupt.lmsbackup'), 'fictional corrupt archive');
  const selection = (value) => writeFile(join(root, 'dialog-selection'), value);
  await selection('attachment');
  const driver = spawn('tauri-driver', [], {
    env: { ...process.env, LEGALMASTER_E2E_ROOT: root, LEGALMASTER_E2E_NONCE: nonce },
    stdio: 'ignore',
  });
  let driverError = false;
  driver.on('error', () => {
    driverError = true;
  });
  let browser;
  let application;
  let stage = 'driver-start';
  let checkpoint;
  const launch = async () => {
    let capabilities = { 'tauri:options': { application: binary } };
    if (process.platform === 'win32') {
      stage = 'webview-start';
      const port = await reserveDebuggingPort();
      application = spawn(binary, [], {
        env: {
          ...process.env,
          LEGALMASTER_E2E_ROOT: root,
          LEGALMASTER_E2E_NONCE: nonce,
          WEBVIEW2_USER_DATA_FOLDER: join(root, 'webview'),
        },
        stdio: 'ignore',
      });
      // Retain no process output; readiness reports only fixed startup categories.
      application.on('error', () => undefined);
      await waitForWebView(application, port);
      capabilities = {
        browserName: 'webview2',
        'ms:edgeChromium': true,
        'ms:edgeOptions': { debuggerAddress: `127.0.0.1:${port}` },
      };
    }
    stage = 'webdriver-session';
    browser = await remote({
      hostname: '127.0.0.1',
      port: 4444,
      logLevel: 'silent',
      connectionRetryCount: 0,
      capabilities,
    });
    await browser.setTimeout({ implicit: 0 });
    if (process.platform === 'win32') await selectDesktopWindow(browser);
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
    // WebDriver's wheel/animation-frame scrolling can stall in headless WebKit.
    // Scroll synchronously so native clicks cannot race the app's smooth scrolling.
    await browser.execute(
      (target) =>
        target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }),
      element,
    );
    await element.waitForClickable({ timeout: 15000 });
    await element.click();
  };
  const nav = async (href) => {
    const link = await browser.$(`nav a[href="${href}"]`);
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
  const initialize = async () => {
    checkpoint = 'initialize-name';
    await input('fullName', 'محامٍ خيالي');
    checkpoint = 'initialize-password';
    await input('password', password);
    await input('confirmPassword', password);
    checkpoint = 'initialize-submit';
    await click('بدء الاستخدام');
    checkpoint = 'initialize-confirm';
    await browser.$('.gate-confirm [role="checkbox"]').click();
    checkpoint = 'initialize-continue';
    await click('متابعة إلى مساحة العمل');
    await browser.$('nav').waitForDisplayed({ timeout: 15000 });
  };
  const unlock = async () => {
    await input('password', password);
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
    await waitForDriver(driver);
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
            .$('.error')
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
    await close().catch(() => undefined);
    if (driver.exitCode === null && !driverError) {
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
  await h.browser.$('[role="checkbox"]').waitForDisplayed();
  await h.browser.$('[role="checkbox"]').click();
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
    await h.click('استعادة من نسخة احتياطية');
    await h.click('تأكيد الاستعادة');
    await h.browser.$('.error').waitForDisplayed({ timeout: 15000 });
    await h.nav('/clients');
    await h.browser.$('a*=E2E-PRESERVED').waitForDisplayed();
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
await mkdir('test-results/desktop', { recursive: true });
await writeFile(
  'test-results/desktop/results.json',
  JSON.stringify(
    {
      platform: process.platform,
      binarySha256: createHash('sha256')
        .update(await readFile(binary))
        .digest('hex'),
      results,
    },
    null,
    2,
  ),
);
for (const result of results) console.log(JSON.stringify(result));
if (results.some((result) => result.result !== 'passed')) process.exitCode = 1;
