import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgentLoop } from '../src/runner/agent-loop.js';

test('agent loop returns a final answer after executing the model selected tool', async () => {
  const calls = [];
  const responses = [
    {
      toolCalls: [{ id: 'call-1', name: 'search_products', input: { query: 'Sonic Lite' } }],
      usage: { inputTokens: 11, outputTokens: 4, totalTokens: 15 },
    },
    {
      finalText: 'Sonic Lite ANC costs $129.00.',
      usage: { inputTokens: 21, outputTokens: 8, totalTokens: 29 },
    },
  ];
  const provider = {
    async complete(request) {
      calls.push(request);
      return responses.shift();
    },
  };
  const loop = createAgentLoop({
    provider,
    tools: {
      search_products: async (input) => ({ products: [{ id: 'hp-sonic-lite', ...input }] }),
    },
    toolDefinitions: [{ name: 'search_products', inputSchema: { type: 'object' } }],
    maxTurns: 3,
  });

  const result = await loop.run({ prompt: 'Find the cheapest eligible headphones.' });

  assert.equal(result.finalText, 'Sonic Lite ANC costs $129.00.');
  assert.equal(result.terminalReason, 'final-answer');
  assert.equal(result.metrics.modelRequests, 2);
  assert.equal(result.metrics.toolCalls, 1);
  assert.equal(result.metrics.totalTokens, 44);
  assert.deepEqual(calls[1].toolResults, [{ toolCallId: 'call-1', name: 'search_products', result: { products: [{ id: 'hp-sonic-lite', query: 'Sonic Lite' }] } }]);
});

test('agent loop fails closed when the model selects an unavailable tool', async () => {
  const loop = createAgentLoop({
    provider: {
      async complete() {
        return { toolCalls: [{ id: 'call-1', name: 'evaluate_script', input: {} }] };
      },
    },
    tools: {},
    toolDefinitions: [],
    maxTurns: 1,
  });

  await assert.rejects(loop.run({ prompt: 'Do the task.' }), /unavailable tool/i);
});
