import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDynamicBenchmarkHtml,
  buildModeMcpConfig,
  buildScoredPrompt,
  collectProviderUsage,
  createAttemptRunId,
  normalizeProviderUsage,
  parseScoredCodexEvents,
  parseFinalBenchmarkSelection,
  validateCompletedSummary,
} from '../src/runner/final-benchmark.js';

test('final benchmark rejects the static GitHub Pages build', () => {
  assert.equal(assertDynamicBenchmarkHtml('<html data-static-demo="false">'), true);
  assert.throws(() => assertDynamicBenchmarkHtml('<html data-static-demo="true">'), /static demo/);
});

test('final benchmark restores the 14 October native browser contracts', () => {
  const webmcp = buildModeMcpConfig('webmcp', 'http://127.0.0.1:4173');
  assert.equal(webmcp.serverName, 'native_webmcp');
  assert.match(webmcp.cwd, /webmcp-browser-benchmark$/);
  assert.match(webmcp.commandArgs[0], /chrome-devtools-mcp/);
  assert.deepEqual(webmcp.enabledTools.sort(), ['execute_webmcp_tool', 'list_webmcp_tools', 'new_page']);
  const playwright = buildModeMcpConfig('playwright-mcp', 'http://127.0.0.1:4173');
  assert.doesNotMatch(JSON.stringify(playwright), /run-direct-webmcp|run-subscription-structured|native-webmcp-proxy|visual-mcp-proxy/);
  assert.deepEqual(playwright.enabledTools.sort(), [
    'browser_click', 'browser_fill_form', 'browser_find', 'browser_navigate', 'browser_press_key', 'browser_select_option', 'browser_snapshot', 'browser_type',
  ]);
  assert.match(playwright.commandArgs[0], /playwright-mcp-proxy\.js$/);
  assert.equal(playwright.commandArgs[1], 'http://127.0.0.1:4173');
  const config = buildModeMcpConfig('visual', 'http://127.0.0.1:4173');
  assert.equal(config.serverName, 'browser_dom');
  assert.match(config.cwd, /webmcp-browser-benchmark$/);
  assert.match(config.commandArgs[0], /dom-mcp\.js$/);
  assert.equal(config.commandArgs[1], 'http://127.0.0.1:4173');
  assert.equal(config.enabledTools.includes('open_page'), true);
  assert.ok(config.enabledTools.includes('dom'));
  assert.ok(config.enabledTools.includes('click'));
});

test('all selection expands to every task in one matrix', () => {
  assert.deepEqual(parseFinalBenchmarkSelection(['all'], ['T1', 'T2', 'T3', 'T4', 'T5'], ['webmcp', 'playwright-mcp', 'visual']), {
    taskIds: ['T1', 'T2', 'T3', 'T4', 'T5'],
    selectedModes: ['webmcp', 'playwright-mcp', 'visual'],
  });
});

test('full matrix gives each task and mode a distinct raw artifact directory', () => {
  assert.equal(createAttemptRunId('T1', 'webmcp'), 'T1-webmcp');
  assert.equal(createAttemptRunId('T5', 'webmcp'), 'T5-webmcp');
  assert.notEqual(createAttemptRunId('T1', 'webmcp'), createAttemptRunId('T1', 'visual'));
});

test('every scored thread receives the documented shared efficiency wrapper', () => {
  const prompt = 'Find the cheapest product.';
  const url = 'http://127.0.0.1:4173';
  const expected = [
    `The isolated benchmark page is at ${url}.`,
    'Open only this URL in a new tab. When a browser name is required, use chrome. Do not inspect existing tabs.',
    'Use only the supplied browser tools. Do not use shell, files, source code, backend APIs, screenshots, or external network resources.',
    'Complete the task in as few tool calls as possible. Do not re-read the page when you already have what the next action needs.',
    prompt,
    'Return only the concise answer requested by the task after completing the browser work.',
  ].join('\n');
  assert.equal(buildScoredPrompt('webmcp', url, prompt), expected);
  assert.equal(buildScoredPrompt('playwright-mcp', url, prompt), expected);
  assert.equal(buildScoredPrompt('visual', url, prompt), expected);
});

test('shared wrapper does not force narrow observations', () => {
  const prompt = buildScoredPrompt('playwright-mcp', 'http://127.0.0.1:4173', 'Read the catalog.');
  assert.doesNotMatch(prompt, /Prefer narrow, scoped observations over full-page reads\./);
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

test('empty Codex resource discovery does not count as a browser capability', () => {
  const parsed = parseScoredCodexEvents([
    {
      type: 'item.started',
      item: {
        type: 'mcp_tool_call', server: 'codex', tool: 'list_mcp_resources', status: 'in_progress', result: null,
      },
    },
    {
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call', server: 'codex', tool: 'list_mcp_resources', status: 'completed',
        result: { content: [{ type: 'text', text: '{"resources":[]}' }] },
      },
    },
    {
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call', server: 'codex', tool: 'list_mcp_resource_templates', status: 'completed',
        result: { content: [{ type: 'text', text: '{"resourceTemplates":[]}' }] },
      },
    },
    {
      type: 'item.completed',
      item: { type: 'mcp_tool_call', server: 'native_webmcp_page_tools', tool: 'search_products', status: 'completed' },
    },
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20 } },
  ], { serverName: 'native_webmcp_page_tools', enabledTools: ['search_products'] });
  assert.equal(parsed.toolCallCount, 1);
});


test('DOM cannot pass with a guessed answer and only failed browser calls', () => {
  assert.throws(() => parseScoredCodexEvents([
    { type: 'item.completed', item: { type: 'mcp_tool_call', server: 'browser_dom', tool: 'open_page', status: 'failed', result: null } },
    { type: 'item.completed', item: { type: 'agent_message', text: 'Sonic Lite ANC - $129.00' } },
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 20 } },
  ], { serverName: 'browser_dom', enabledTools: ['open_page', 'dom'] }), /did not read.*DOM/);
});
