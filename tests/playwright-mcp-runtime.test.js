import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaywrightMcpRuntime } from '../src/runner/runtimes/playwright-mcp.js';

test('Playwright runtime exposes only the benchmark allowlist to the agent loop', async () => {
  const calls = [];
  const client = {
    async start() { calls.push(['start']); },
    async listTools({ allowedToolNames }) {
      calls.push(['list', allowedToolNames]);
      return { tools: [
        { name: 'browser_snapshot', description: 'Snapshot.', inputSchema: { type: 'object' } },
        { name: 'browser_take_screenshot', description: 'Forbidden.', inputSchema: { type: 'object' } },
      ] };
    },
    async callTool(name, args) { calls.push(['call', name, args]); return { content: [{ type: 'text', text: 'snapshot' }] }; },
    async close() { calls.push(['close']); },
  };
  const runtime = await createPlaywrightMcpRuntime({
    client,
    allowedToolNames: ['browser_snapshot'],
  });
  const result = await runtime.tools.browser_snapshot({});
  await runtime.close();

  assert.deepEqual(runtime.toolDefinitions, [{ name: 'browser_snapshot', description: 'Snapshot.', inputSchema: { type: 'object' } }]);
  assert.deepEqual(result, { content: [{ type: 'text', text: 'snapshot' }] });
  assert.deepEqual(calls, [
    ['start'],
    ['list', ['browser_snapshot']],
    ['call', 'browser_snapshot', {}],
    ['close'],
  ]);
});
