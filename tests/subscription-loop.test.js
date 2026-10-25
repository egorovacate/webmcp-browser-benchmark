import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubscriptionLoop } from '../src/runner/subscription-loop.js';

test('subscription loop reuses a completed identical tool call instead of executing it twice', async () => {
  let executions = 0;
  const replies = [
    { sessionId: 's1', rawCliTokens: 1, tokenUsage: {}, response: { type: 'tool_calls', toolCalls: [{ id: 'a', name: 'search', input: { q: 'x' } }] } },
    { sessionId: 's1', rawCliTokens: 1, tokenUsage: {}, response: { type: 'tool_calls', toolCalls: [{ id: 'b', name: 'search', input: { q: 'x' } }] } },
    { sessionId: 's1', rawCliTokens: 1, tokenUsage: {}, response: { type: 'final', finalText: 'done' } },
  ];
  const loop = createSubscriptionLoop({
    requestTurn: async () => replies.shift(),
    tools: { search: async () => ({ value: ++executions }) },
    toolDefinitions: [{ name: 'search' }],
  });
  const result = await loop.run({ prompt: 'task' });
  assert.equal(executions, 1);
  assert.equal(result.finalText, 'done');
  assert.equal(result.events.filter((event) => event.eventType === 'tool_call_cached').length, 1);
});
