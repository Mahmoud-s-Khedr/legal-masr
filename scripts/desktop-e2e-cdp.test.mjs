import assert from 'node:assert/strict';
import test from 'node:test';
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

// A socket double that answers Runtime.evaluate from a script and records every command sent.
function scriptedBrowser(answers) {
  const sent = [];
  const listeners = [];
  const socket = {
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    send(text) {
      const message = JSON.parse(text);
      sent.push(message);
      let value;
      if (message.method === 'Runtime.evaluate') value = answers(message.params.expression);
      queueMicrotask(() =>
        listeners.forEach((listener) =>
          listener({ data: JSON.stringify({ id: message.id, result: { result: { value } } }) }),
        ),
      );
    },
    close() {},
  };
  return { browser: new CdpBrowser(socket), sent };
}

test('clicks with real mouse input at the centre of a reachable element', async () => {
  const { browser, sent } = scriptedBrowser((expression) =>
    expression.includes('getBoundingClientRect') ? { x: 40, y: 12, reachable: true } : true,
  );
  await browser.$('[role="option"]').click();
  const input = sent.filter((message) => message.method === 'Input.dispatchMouseEvent');
  assert.deepEqual(
    input.map((message) => message.params.type),
    ['mouseMoved', 'mousePressed', 'mouseReleased'],
  );
  assert.ok(input.every((message) => message.params.x === 40 && message.params.y === 12));
  assert.equal(input[1].params.button, 'left');
  assert.equal(input[1].params.clickCount, 1);
  assert.ok(!sent.some((message) => message.params?.expression?.includes('node.click()')));
});

test('falls back to a plain click when something else covers the element', async () => {
  const { browser, sent } = scriptedBrowser((expression) =>
    expression.includes('getBoundingClientRect') ? { x: 40, y: 12, reachable: false } : true,
  );
  await browser.$('button').click();
  assert.ok(!sent.some((message) => message.method === 'Input.dispatchMouseEvent'));
  assert.ok(sent.some((message) => message.params?.expression?.includes('node.click()')));
});

test('reports a missing element instead of clicking nothing', async () => {
  const { browser } = scriptedBrowser((expression) =>
    expression.includes('getBoundingClientRect') ? null : true,
  );
  await assert.rejects(browser.$('button').click(), /CDP_ELEMENT_MISSING/);
});
