import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCodexSubscriptionTurn } from '../src/runner/codex-subscription.js';

test('parses a structured final answer and token usage from a Codex JSONL turn', () => {
  const turn = parseCodexSubscriptionTurn({
    stdout: [
      '{"type":"thread.started","thread_id":"session-1"}',
      '{"type":"turn.completed","usage":{"input_tokens":19000,"cached_input_tokens":12000,"output_tokens":784,"reasoning_output_tokens":100}}',
    ].join('\n'),
    lastMessage: '{"type":"final","toolCalls":[],"finalText":"Sonic Lite ANC costs $129.00."}',
  });

  assert.deepEqual(turn, {
    sessionId: 'session-1',
    rawCliTokens: 19784,
    tokenUsage: { inputTokens: 19000, cachedInputTokens: 12000, outputTokens: 784, reasoningOutputTokens: 100 },
    response: { type: 'final', toolCalls: [], finalText: 'Sonic Lite ANC costs $129.00.' },
  });
});
