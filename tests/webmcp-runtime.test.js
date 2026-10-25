import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebMcpRuntime } from '../src/runner/runtimes/webmcp.js';

test('WebMCP runtime presents page-discovered tools and executes them through Chrome DevTools MCP', async () => {
  const calls = [];
  const client = {
    async start() { return { pageId: 17 }; },
    async listWebMcpTools(pageId) {
      calls.push(['list', pageId]);
      return {
        structuredContent: {
          webmcpTools: [{ name: 'get_cart', description: 'Get cart.', inputSchema: { type: 'object' } }],
        },
      };
    },
    async executeWebMcpTool(input) {
      calls.push(['execute', input]);
      return { content: [{ type: 'text', text: '{"status":"completed","output":{"lines":[]}}' }] };
    },
    async close() { calls.push(['close']); },
  };

  const runtime = await createWebMcpRuntime({ client });
  const result = await runtime.tools.get_cart({});
  await runtime.close();

  assert.deepEqual(runtime.toolDefinitions, [{ name: 'get_cart', description: 'Get cart.', inputSchema: { type: 'object' } }]);
  assert.deepEqual(result, { status: 'completed', output: { lines: [] } });
  assert.deepEqual(calls, [
    ['list', 17],
    ['execute', { pageId: 17, toolName: 'get_cart', input: {} }],
    ['close'],
  ]);
});
