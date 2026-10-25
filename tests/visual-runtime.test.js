import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisualRuntime } from '../src/runner/runtimes/visual.js';

test('visual runtime rejects a non-standard benchmark viewport', async () => {
  await assert.rejects(
    createVisualRuntime({
      targetUrl: 'http://127.0.0.1:4173/',
      viewport: { width: 1440, height: 3000 },
      browserLauncher: { async launch() { throw new Error('browser must not launch'); } },
    }),
    /1440x900/i,
  );
});

test('visual runtime exposes DOM and selector interactions', async () => {
  const calls = [];
  const page = {
    async goto(url) { calls.push(['goto', url]); },
    async content() { calls.push(['content']); return '<button id="go">Go</button>'; },
    locator(selector) {
      return {
        async click() { calls.push(['click', selector]); },
        async fill(text) { calls.push(['fill', selector, text]); },
        async press(key) { calls.push(['press', selector, key]); },
      };
    },
    mouse: {
      async wheel(x, y) { calls.push(['wheel', x, y]); },
    },
    async close() { calls.push(['page-close']); },
  };
  const browser = {
    async newPage() { calls.push(['new-page']); return page; },
    async close() { calls.push(['browser-close']); },
  };
  const runtime = await createVisualRuntime({
    targetUrl: 'http://127.0.0.1:4173/',
    browserLauncher: { async launch() { calls.push(['launch']); return browser; } },
  });

  const dom = await runtime.tools.dom({});
  await runtime.tools.click({ selector: '#go' });
  await runtime.tools.type({ selector: '#name', text: 'Alex' });
  await runtime.tools.press({ selector: '#name', key: 'Enter' });
  await runtime.tools.scroll({ deltaY: 500 });
  await runtime.close();

  assert.equal(dom.html, '<button id="go">Go</button>');
  assert.deepEqual(runtime.toolDefinitions.map((tool) => tool.name), ['dom', 'click', 'type', 'press', 'scroll']);
  assert.deepEqual(calls, [
    ['launch'], ['new-page'], ['goto', 'http://127.0.0.1:4173/'], ['content'],
    ['click', '#go'], ['fill', '#name', 'Alex'], ['press', '#name', 'Enter'], ['wheel', 0, 500],
    ['page-close'], ['browser-close'],
  ]);
});
