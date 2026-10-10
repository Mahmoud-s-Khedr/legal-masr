import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { applicationTarget, CdpBrowser } from './desktop-e2e-cdp.mjs';

test('selects only the Tauri application page from Windows debugging targets', () => {
  const target = applicationTarget([
    { type: 'page', url: 'about:blank' },
    { type: 'iframe', url: 'http://tauri.localhost/' },
    { type: 'page', url: 'http://tauri.localhost/' },
  ]);
  assert.equal(target?.type, 'page');
});

test('does not select an unrelated debugging target', () => {
  assert.equal(
    applicationTarget([{ type: 'page', url: 'https://example.test/private?password=fictional' }]),
    undefined,
  );
});

// Run Runtime.evaluate against a DOM so selectors and scoping are exercised,
// while retaining the actual protocol messages emitted by the driver.
function harness(markup) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only' });
  const commands = [];
  const listeners = new Map();
  const { document, HTMLElement } = dom.window;
  HTMLElement.prototype.getClientRects = function () {
    return this.hidden ? [] : [this.getBoundingClientRect()];
  };
  HTMLElement.prototype.getBoundingClientRect = () => ({ x: 10, y: 20, width: 80, height: 30 });
  HTMLElement.prototype.scrollIntoView = function () {};
  document.elementFromPoint = () => document.querySelector('[data-hit]');
  const socket = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    send(message) {
      const { id, method, params } = JSON.parse(message);
      commands.push({ method, params });
      let result = {};
      if (method === 'Runtime.evaluate') {
        try {
          result = { result: { value: dom.window.eval(params.expression) } };
        } catch {
          result = { exceptionDetails: {} };
        }
      }
      queueMicrotask(() => listeners.get('message')({ data: JSON.stringify({ id, result }) }));
    },
    close: () => listeners.get('close')(),
  };
  return { browser: new CdpBrowser(socket), dom, commands };
}

test('click dispatches a complete pointer sequence after scrolling and checking the hit target', async () => {
  const h = harness('<button data-hit>اختيار</button>');
  await h.browser.$('//button[normalize-space(.)="اختيار"]').click();
  assert.deepEqual(
    h.commands
      .filter(({ method }) => method === 'Input.dispatchMouseEvent')
      .map(({ params }) => params),
    [
      { type: 'mouseMoved', x: 50, y: 35 },
      { type: 'mousePressed', x: 50, y: 35, button: 'left', buttons: 1, clickCount: 1 },
      { type: 'mouseReleased', x: 50, y: 35, button: 'left', buttons: 0, clickCount: 1 },
    ],
  );
});

test('click refuses an obscured target without sending pointer input', async () => {
  const h = harness('<button>Hidden behind overlay</button><div data-hit>Overlay</div>');
  await assert.rejects(h.browser.$('button').click(), /CDP_ELEMENT_OBSCURED/);
  assert.equal(
    h.commands.some(({ method }) => method.startsWith('Input.')),
    false,
  );
});

test('clickable wait rejects disabled controls and waitUntil observes them becoming enabled', async () => {
  const h = harness('<button disabled data-hit>Choose file</button>');
  await assert.rejects(
    h.browser.$('button').waitForClickable({ timeout: 1 }),
    /CDP_ELEMENT_TIMEOUT/,
  );
  assert.equal(await h.browser.$('button').isEnabled(), false);
  h.dom.window.document.querySelector('button').disabled = false;
  await h.browser.waitUntil(() => h.browser.$('button').isEnabled());
  await h.browser.$('button').waitForClickable();
  await assert.rejects(
    h.browser.waitUntil(() => false, { timeout: 1 }),
    /CDP_CONDITION_TIMEOUT/,
  );
});

test('collection and nested element methods keep recovery fields and validation alerts scoped', async () => {
  const h = harness(
    '<input type="password"><div role="alert">Unrelated</div><div role="dialog"><input required aria-invalid="true" aria-describedby="issue"><div role="alert" id="issue">Required</div></div><input type="password">',
  );
  const fields = await h.browser.$$('input[type="password"]');
  assert.equal(fields.length, 2);
  await fields[0].setValue('first fictional value');
  await fields[1].setValue('second fictional value');
  assert.deepEqual(
    [...h.dom.window.document.querySelectorAll('input[type="password"]')].map((node) => node.value),
    ['first fictional value', 'second fictional value'],
  );
  const dialog = h.browser.$('[role="dialog"]');
  const alert = dialog.$('[role="alert"]');
  assert.equal(await alert.getText(), 'Required');
  assert.equal(await dialog.$('//div[@role="alert"]').getText(), 'Required');
  assert.equal(
    await dialog.$('input[required]').getAttribute('aria-describedby'),
    await alert.getAttribute('id'),
  );
  assert.equal(await dialog.$('input[required]').getAttribute('aria-invalid'), 'true');
  assert.equal(await dialog.$('input[required]').getAttribute('missing'), null);
  assert.equal((await dialog.$$('input')).length, 1);
  assert.equal(await dialog.$('button').isExisting(), false);
});
