import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDynamicBenchmarkHtml,
  buildModeMcpConfig,
  buildScoredPrompt,
  collectProviderUsage,
  normalizeProviderUsage,
  parseScoredCodexEvents,
  validateCompletedSummary,
} from '../src/runner/final-benchmark.js';

test('final benchmark rejects the static GitHub Pages build', () => {
  assert.equal(assertDynamicBenchmarkHtml('<html data-static-demo="false">'), true);
  assert.throws(() => assertDynamicBenchmarkHtml('<html data-static-demo="true">'), /static demo/);
});

test('final benchmark uses native servers with exact-subset capability filtering only', () => {
  const webmcp = buildModeMcpConfig('webmcp', 'http://127.0.0.1:4173');
  assert.doesNotMatch(JSON.stringify(webmcp), /proxy\.js|run-direct-webmcp|run-subscription-structured/);
  assert.equal(webmcp.enabledTools.length > 0, true);
  assert.match(webmcp.commandArgs[0], /chrome-devtools-mcp/);
  const playwright = buildModeMcpConfig('playwright-mcp', 'http://127.0.0.1:4173');
  assert.doesNotMatch(JSON.stringify(playwright), /run-direct-webmcp|run-subscription-structured|native-webmcp-proxy|visual-mcp-proxy/);
  assert.equal(playwright.enabledTools.length > 0, true);
  assert.match(playwright.commandArgs[0], /playwright-mcp-proxy\.js$/);
  assert.equal(playwright.commandArgs[1], 'http://127.0.0.1:4173');
  const config = buildModeMcpConfig('visual', 'http://127.0.0.1:4173');
  assert.equal(config.serverName, 'browser_dom');
  assert.match(config.commandArgs[0], /dom-mcp\.js$/);
  assert.equal(config.commandArgs[1], 'http://127.0.0.1:4173');
  assert.ok(config.enabledTools.includes('dom'));
  assert.ok(config.enabledTools.includes('click'));
});

test('all modes receive the same scored prompt', () => {
  const prompt = 'Find the cheapest product.';
  const url = 'http://127.0.0.1:4173';
  assert.equal(buildScoredPrompt('webmcp', url, prompt), buildScoredPrompt('playwright-mcp', url, prompt));
  assert.equal(buildScoredPrompt('playwright-mcp', url, prompt), buildScoredPrompt('visual', url, prompt));
});

test('provider usage keeps subset fields separate from totals', () => {
  assert.deepEqual(normalizeProviderUsage({
    input_tokens: 19000,
    cached_input_tokens: 12000,
    output_tokens: 800,
    reasoning_output_tokens: 300,
  }), {
    inputTokens: 19000,
    cachedInputTokens: 12000,
    uncachedInputTokens: 7000,
    outputTokens: 800,
    reasoningTokens: 300,
    visibleOutputTokens: 500,
    totalTokens: 19800,
  });
});

test('completed summary rejects zero usage and failed oracles', () => {
  const valid = {
    status: 'completed',
    inputTokens: 100,
    cachedInputTokens: 50,
    uncachedInputTokens: 50,
    outputTokens: 20,
    reasoningTokens: 5,
    visibleOutputTokens: 15,
    totalTokens: 120,
    modelRequestCount: null,
    toolCallCount: 1,
    oraclePassed: true,
    finalAnswerPassed: true,
  };
  assert.equal(validateCompletedSummary(valid), true);
  assert.throws(() => validateCompletedSummary({ ...valid, totalTokens: 0 }), /positive token usage/);
  assert.throws(() => validateCompletedSummary({ ...valid, oraclePassed: false }), /oracles/);
});

test('missing optional reasoning usage stays unknown, never fabricated as zero', () => {
  const usage = normalizeProviderUsage({ input_tokens: 100, cached_input_tokens: 80, output_tokens: 20 });
  assert.equal(usage.totalTokens, 120);
  assert.equal(usage.reasoningTokens, null);
  assert.equal(usage.visibleOutputTokens, null);
  assert.throws(() => normalizeProviderUsage({ output_tokens: 20 }), /input_tokens/);
});

test('all completed turns count even when tools run in parallel', () => {
  const result = parseScoredCodexEvents([
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20 } },
    { type: 'item.completed', item: { type: 'mcp_tool_call' } },
    { type: 'item.completed', item: { type: 'mcp_tool_call' } },
    { type: 'turn.completed', usage: { input_tokens: 150, cached_input_tokens: 100, output_tokens: 30 } },
  ]);
  assert.equal(result.usage.totalTokens, 300);
  assert.equal(result.usage.cachedInputTokens, 180);
  assert.equal(result.modelRequestCount, null);
});

test('scored event parser extracts final text and raw provider usage', () => {
  const events = [
    { type: 'thread.started', thread_id: 'thread-1' },
    { type: 'item.completed', item: { type: 'mcp_tool_call', server: 'native_webmcp', name: 'execute_webmcp_tool' } },
    { type: 'item.completed', item: { type: 'agent_message', text: 'Sonic Lite ANC - $129.00' } },
    { type: 'turn.completed', usage: { input_tokens: 19000, cached_input_tokens: 12000, output_tokens: 800, reasoning_output_tokens: 300 } },
  ];
  assert.deepEqual(parseScoredCodexEvents(events), {
    threadId: 'thread-1',
    finalText: 'Sonic Lite ANC - $129.00',
    toolCallCount: 1,
    modelRequestCount: null,
    usage: {
      inputTokens: 19000,
      cachedInputTokens: 12000,
      uncachedInputTokens: 7000,
      outputTokens: 800,
      reasoningTokens: 300,
      visibleOutputTokens: 500,
      totalTokens: 19800,
    },
  });
});

test('scored event parser rejects shell or file operations', () => {
  assert.throws(() => parseScoredCodexEvents([
    { type: 'item.completed', item: { type: 'command_execution' } },
  ]), /forbidden capability/);
});

test('usage remains available even when a run violates the capability contract', () => {
  const events = [
    { type: 'item.completed', item: { type: 'command_execution' } },
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20 } },
  ];
  assert.throws(() => parseScoredCodexEvents(events), /forbidden/);
  assert.equal(collectProviderUsage(events).totalTokens, 120);
});

test('a tool from another mode cannot validate as the selected browser interface', () => {
  assert.throws(() => parseScoredCodexEvents([
    { type: 'item.completed', item: { type: 'mcp_tool_call', server: 'native_playwright', tool: 'browser_snapshot' } },
  ], { serverName: 'cua_repl', enabledTools: ['js'] }), /outside selected mode/);
});


test('DOM cannot pass with a guessed answer and only failed browser calls', () => {
  assert.throws(() => parseScoredCodexEvents([
    { type: 'item.completed', item: { type: 'mcp_tool_call', server: 'browser_dom', tool: 'open_page', status: 'failed', result: null } },
    { type: 'item.completed', item: { type: 'agent_message', text: 'Sonic Lite ANC - $129.00' } },
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 20 } },
  ], { serverName: 'browser_dom', enabledTools: ['open_page', 'dom'] }), /did not read.*DOM/);
});
