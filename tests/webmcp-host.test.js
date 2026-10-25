import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createBenchmarkServer } from '../src/server/server.js';
import { createChromeDevToolsMcpClient } from '../src/runner/chrome-devtools-mcp-client.js';

const catalogUrl = new URL('../fixtures/catalog.json', import.meta.url);
let app;
let client;

before(async () => {
  const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
  app = await createBenchmarkServer({ catalog, port: 4173, host: '127.0.0.1' });
  client = createChromeDevToolsMcpClient({
    targetUrl: app.url,
    browser: 'stable',
    headless: true,
    cwd: new URL('..', import.meta.url).pathname,
  });
});

after(async () => {
  await client?.close();
  await app?.close();
});

test('Chrome DevTools MCP discovers the five tools registered by document model context', async () => {
  const session = await client.start();
  assert.equal(typeof session.pageId, 'number');

  const result = await client.listWebMcpTools(session.pageId);
  const text = result.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  for (const toolName of ['search_products', 'get_product', 'set_cart_item', 'get_cart', 'place_test_order']) {
    assert.match(text, new RegExp(toolName));
  }
});
