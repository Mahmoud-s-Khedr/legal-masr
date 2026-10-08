const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function selectorExpression(selector) {
  if (selector.startsWith('//')) {
    return `document.evaluate(${JSON.stringify(selector)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
  }
  const textMatch = /^(\w+)\*=([\s\S]+)$/.exec(selector);
  if (textMatch) {
    return `Array.from(document.querySelectorAll(${JSON.stringify(textMatch[1])})).find((node) => node.textContent.includes(${JSON.stringify(textMatch[2])}))`;
  }
  return `document.querySelector(${JSON.stringify(selector)})`;
}

export function applicationTarget(targets) {
  return targets.find((candidate) => {
    try {
      const url = new URL(candidate.url);
      return candidate.type === 'page' && url.hostname === 'tauri.localhost';
    } catch {
      return false;
    }
  });
}

function visibleExpression(selector) {
  const target = selectorExpression(selector);
  return `(() => { const node = ${target}; if (!node) return false; const style = getComputedStyle(node); return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0; })()`;
}

export class CdpBrowser {
  #socket;
  #nextId = 0;
  #pending = new Map();

  static async connect(port, { timeoutMs = 30_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let target;
    while (Date.now() < deadline && !target) {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
        .then((response) => response.json())
        .catch(() => []);
      target = applicationTarget(targets);
      if (!target) await delay(100);
    }
    if (!target?.webSocketDebuggerUrl) throw new Error('CDP_APPLICATION_TARGET_MISSING');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new CdpBrowser(socket);
  }

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error('CDP_COMMAND_FAILED'));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const { reject } of this.#pending.values()) reject(new Error('CDP_CONNECTION_CLOSED'));
      this.#pending.clear();
    });
  }

  async #command(method, params = {}) {
    const id = ++this.#nextId;
    const reply = new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
    this.#socket.send(JSON.stringify({ id, method, params }));
    return reply;
  }

  async #evaluate(expression) {
    const result = await this.#command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error('CDP_EVALUATION_FAILED');
    return result.result.value;
  }

  async #wait(expression, timeout = 15_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.#evaluate(expression)) return;
      await delay(100);
    }
    throw new Error('CDP_ELEMENT_TIMEOUT');
  }

  async setTimeout() {}

  async execute(fn, ...args) {
    return this.#evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`);
  }

  async deleteSession() {
    this.#socket.close();
  }

  $(selector) {
    const target = selectorExpression(selector);
    return {
      waitForDisplayed: async ({ timeout } = {}) =>
        this.#wait(visibleExpression(selector), timeout),
      waitForClickable: async ({ timeout } = {}) =>
        this.#wait(visibleExpression(selector), timeout),
      click: async () => {
        await this.#wait(visibleExpression(selector));
        const clicked = await this.#evaluate(
          `(() => { const node = ${target}; if (!node) return false; node.click(); return true; })()`,
        );
        if (!clicked) throw new Error('CDP_ELEMENT_MISSING');
      },
      setValue: async (value) => {
        await this.#wait(visibleExpression(selector));
        const written = await this.#evaluate(
          `(() => { const node = ${target}; if (!node) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(node, ${JSON.stringify(value)}); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
        );
        if (!written) throw new Error('CDP_ELEMENT_MISSING');
      },
      isExisting: async () => Boolean(await this.#evaluate(`Boolean(${target})`)),
      getText: async () =>
        (await this.#evaluate(
          `(() => { const node = ${target}; return node ? node.textContent : ''; })()`,
        )) ?? '',
    };
  }
}
