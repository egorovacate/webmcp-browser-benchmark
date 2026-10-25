import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createModelClient } from '../src/runner/model-client.js';
import { createVisualMode } from '../src/runner/modes/visual.js';
import { createPlaywrightMcpMode } from '../src/runner/modes/playwright-mcp.js';
import { createWebMcpMode } from '../src/runner/modes/webmcp.js';
import { buildPlaywrightMcpArgs, createPlaywrightMcpClient } from '../src/runner/playwright-mcp-client.js';
import { createChromeDevToolsMcpClient, findTargetPageId } from '../src/runner/chrome-devtools-mcp-client.js';
import { runBenchmark } from '../src/runner/run.js';

test('T1 retains the exact 14 October fixture prompt', async () => {
  const tasks = JSON.parse(await readFile(new URL('../fixtures/tasks.json', import.meta.url), 'utf8'));
  assert.equal(tasks.find(({ id }) => id === 'T1')?.prompt,
    'Find the cheapest in-stock noise-cancelling headphones under $200. Return the product name and price. Do not add anything to the cart.');
});

test('T5 identifies the placed-order line count', async () => {
  const tasks = JSON.parse(await readFile(new URL('../fixtures/tasks.json', import.meta.url), 'utf8'));
  const task = tasks.find(({ id }) => id === 'T5');
  assert.match(task.prompt, /number of line items in the placed test order and total\./i);
});

test('model client refuses measured execution without an explicit model ID', () => {
  assert.throws(() => createModelClient({}), /MODEL_ID/i);
});

test('visual mode allows DOM and selector actions but rejects screenshots', () => {
  const mode = createVisualMode();
  assert.equal(mode.name, 'visual');
  assert.ok(mode.allowedCapabilities.includes('dom'));
  assert.ok(mode.allowedCapabilities.includes('click'));
  assert.equal(mode.validateObservation({ dom: '<button>' }), true);
  assert.throws(() => mode.validateObservation({ screenshot: 'data:image/png;base64,x' }), /forbidden/i);
});

test('Playwright MCP mode allows snapshots and refs but rejects screenshots', () => {
  const mode = createPlaywrightMcpMode();
  assert.ok(mode.allowedCapabilities.includes('accessibility_snapshot'));
  assert.ok(mode.allowedCapabilities.includes('element_ref'));
  assert.throws(() => mode.validateObservation({ screenshot: 'data:image/png;base64,x' }), /forbidden/i);
});

test('Playwright MCP client requires a target URL before starting a session', async () => {
  const client = createPlaywrightMcpClient({
    command: 'node',
    args: ['-e', 'process.stdin.resume()'],
  });

  await assert.rejects(client.start(), /target URL/i);
});

test('Playwright MCP client exposes the official MCP operation surface', () => {
  const client = createPlaywrightMcpClient({
    command: 'node',
    args: ['-e', 'process.stdin.resume()'],
    targetUrl: 'http://127.0.0.1:4173/',
  });

  assert.equal(typeof client.start, 'function');
  assert.equal(typeof client.close, 'function');
  assert.equal(typeof client.listTools, 'function');
  assert.equal(typeof client.callTool, 'function');
});

test('Playwright MCP uses the server default snapshot behavior', () => {
  const args = buildPlaywrightMcpArgs({
    cliPath: '/tmp/playwright-mcp.js',
    targetUrl: 'http://127.0.0.1:4173',
  });
  assert.equal(args.includes('--snapshot-mode'), false);
});

test('Chrome DevTools MCP client exposes only native WebMCP operations', () => {
  const client = createChromeDevToolsMcpClient({
    targetUrl: 'http://127.0.0.1:4173/',
    command: 'node',
    cliPath: 'placeholder-cli.js',
  });

  assert.equal(typeof client.start, 'function');
  assert.equal(typeof client.close, 'function');
  assert.equal(typeof client.listWebMcpTools, 'function');
  assert.equal(typeof client.executeWebMcpTool, 'function');
  assert.equal(client.allowedToolNames.includes('evaluate_script'), false);
  assert.deepEqual(client.allowedToolNames, ['list_webmcp_tools', 'execute_webmcp_tool']);
});

test('Chrome DevTools MCP client selects the page it just opened from structured response data', () => {
  assert.equal(findTargetPageId({
    structuredContent: {
      pages: [
        { id: 1, url: 'chrome://newtab/' },
        { id: 2, url: 'http://127.0.0.1:4173/' },
      ],
    },
  }, 'http://127.0.0.1:4173/'), 2);
  assert.throws(() => findTargetPageId({ structuredContent: { pages: [] } }, 'http://127.0.0.1:4173/'), /target page/i);
});

test('WebMCP mode allows structured tool results but rejects DOM observations', () => {
  const mode = createWebMcpMode();
  assert.ok(mode.allowedCapabilities.includes('webmcp_tool'));
  assert.equal(mode.validateObservation({ toolName: 'get_cart', result: { lines: [] } }), true);
  assert.throws(() => mode.validateObservation({ dom: '<button>' }), /forbidden/i);
});

test('development dry-run validates the pipeline without a model call', async () => {
  const result = await runBenchmark({ mode: 'webmcp', taskId: 'T1', stage: 'development', dryRun: true });

  assert.deepEqual(result, {
    status: 'dry-run',
    mode: 'webmcp',
    taskId: 'T1',
    stage: 'development',
    modelCalls: 0,
    capabilities: ['webmcp_tool'],
  });
});

test('full benchmark requires explicit approval', async () => {
  await assert.rejects(
    runBenchmark({ mode: 'webmcp', taskId: 'T1', stage: 'full', dryRun: true }),
    /approval/i,
  );
});

test('runner marks an attempt completed only after the agent loop and backend oracle pass', async () => {
  const replies = [
    { toolCalls: [{ id: 'call-1', name: 'search_products', input: { query: 'Sonic' } }], usage: {} },
    { finalText: 'Sonic Lite ANC costs $129.00.', usage: {} },
  ];
  const result = await runBenchmark({
    mode: 'webmcp',
    taskId: 'T1',
    stage: 'smoke',
    provider: { complete: async () => replies.shift() },
    runtime: {
      toolDefinitions: [{ name: 'search_products', inputSchema: { type: 'object' } }],
      tools: { search_products: async () => ({ products: [{ id: 'hp-sonic-lite' }] }) },
      getSnapshot: async () => ({ cart: { lines: [] }, orders: [] }),
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.oraclePassed, true);
  assert.equal(result.finalAnswerPassed, true);
  assert.equal(result.finalText, 'Sonic Lite ANC costs $129.00.');
  assert.equal(result.metrics.modelRequests, 2);
});

test('visual mode continues from DOM through browser actions before the final answer', async () => {
  const calls = [];
  const replies = [
    { toolCalls: [{ id: 'dom-1', name: 'dom', input: {} }], usage: {} },
    { toolCalls: [{ id: 'click-1', name: 'click', input: { selector: '#search' } }], usage: {} },
    { toolCalls: [{ id: 'scroll-1', name: 'scroll', input: { deltaY: 500 } }], usage: {} },
    { finalText: 'Sonic Lite ANC costs $129.00.', usage: {} },
  ];
  const result = await runBenchmark({
    mode: 'visual',
    taskId: 'T1',
    stage: 'smoke',
    provider: { complete: async () => replies.shift() },
    runtime: {
      toolDefinitions: [
        { name: 'dom', inputSchema: { type: 'object' } },
        { name: 'click', inputSchema: { type: 'object' } },
        { name: 'scroll', inputSchema: { type: 'object' } },
      ],
      tools: {
        dom: async () => { calls.push('dom'); return { html: '<button id="search">Search</button>' }; },
        click: async ({ selector }) => { calls.push(`click:${selector}`); },
        scroll: async ({ deltaY }) => { calls.push(`scroll:${deltaY}`); },
      },
      getSnapshot: async () => ({ cart: { lines: [] }, orders: [] }),
    },
  });

  assert.deepEqual(calls, ['dom', 'click:#search', 'scroll:500']);
  assert.equal(result.metrics.modelRequests, 4);
  assert.equal(result.oraclePassed, true);
});
