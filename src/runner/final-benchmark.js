import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const chromePackage = require.resolve('chrome-devtools-mcp/package.json');
const playwrightPackage = require.resolve('@playwright/mcp/package.json');
const chromeCli = join(dirname(chromePackage), 'build/src/bin/chrome-devtools-mcp.js');
const playwrightCli = join(dirname(playwrightPackage), 'cli.js');

const modeTools = {
  webmcp: ['new_page', 'list_webmcp_tools', 'execute_webmcp_tool'],
  'playwright-mcp': ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type', 'browser_select_option', 'browser_fill_form', 'browser_find', 'browser_press_key'],
  visual: ['open_page', 'dom', 'click', 'type', 'select', 'press', 'scroll'],
};

export function assertDynamicBenchmarkHtml(html) {
  if (!/data-static-demo=["']false["']/.test(String(html))) {
    throw new Error('final benchmark cannot run against the static demo build');
  }
  return true;
}

export function buildModeMcpConfig(mode, targetUrl) {
  if (!modeTools[mode]) throw new Error(`unknown final benchmark mode: ${mode}`);
  if (mode === 'visual') {
    return {
      serverName: 'browser_dom', command: 'node',
      commandArgs: [fileURLToPath(new URL('../../scripts/dom-mcp.js', import.meta.url)), targetUrl],
      enabledTools: [...modeTools.visual],
      interface: 'rendered-dom-v1',
    };
  }
  const host = new URL(targetUrl).hostname;
  if (mode === 'webmcp') {
    return {
      serverName: 'native_webmcp',
      command: 'node',
      commandArgs: [
        chromeCli,
        '--headless=true',
        '--isolated=true',
        '--categoryInput=false',
        '--categoryNavigation=true',
        '--categoryEmulation=false',
        '--categoryPerformance=false',
        '--categoryNetwork=false',
        '--categoryDebugging=false',
        '--categoryMemory=false',
        '--categoryExtensions=false',
        '--categoryPwa=false',
        '--categoryExperimentalWebmcp=true',
        '--experimentalStructuredContent=true',
        '--chromeArg=--enable-features=WebMCP',
        '--usageStatistics=false',
      ],
      enabledTools: [...modeTools[mode]],
    };
  }
  const args = [
    fileURLToPath(new URL('../../scripts/playwright-mcp-proxy.js', import.meta.url)),
    targetUrl,
    '--viewport-size', '1440x900',
    '--image-responses', 'omit',
    '--codegen', 'none',
    '--console-level', 'error',
  ];
  return {
    serverName: 'native_playwright',
    command: 'node',
    commandArgs: args,
    enabledTools: [...modeTools[mode]],
  };
}

export function buildScoredPrompt(_mode, targetUrl, taskPrompt) {
  return [
    `The isolated benchmark page is at ${targetUrl}.`,
    'Open only this URL in a new tab. When a browser name is required, use chrome. Do not inspect existing tabs.',
    'Use only the supplied browser tools. Do not use shell, files, source code, backend APIs, screenshots, or external network resources.',
    'Complete the task in as few tool calls as possible. Do not re-read the page when you already have what the next action needs. Prefer narrow, scoped observations over full-page reads.',
    taskPrompt,
    'Return only the concise answer requested by the task after completing the browser work.',
  ].join('\n');
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`invalid provider usage field: ${name}`);
  return value;
}

export function normalizeProviderUsage(usage = {}) {
  const inputTokens = nonNegativeInteger(usage.input_tokens, 'input_tokens');
  const cachedInputTokens = nonNegativeInteger(usage.cached_input_tokens, 'cached_input_tokens');
  const outputTokens = nonNegativeInteger(usage.output_tokens, 'output_tokens');
  const reasoningTokens = usage.reasoning_output_tokens == null ? null : nonNegativeInteger(usage.reasoning_output_tokens, 'reasoning_output_tokens');
  if (cachedInputTokens > inputTokens) throw new Error('cached input exceeds input tokens');
  if (reasoningTokens > outputTokens) throw new Error('reasoning exceeds output tokens');
  return {
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens: inputTokens - cachedInputTokens,
    outputTokens,
    reasoningTokens,
    visibleOutputTokens: reasoningTokens == null ? null : outputTokens - reasoningTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function messageText(item = {}) {
  if (typeof item.text === 'string') return item.text;
  if (!Array.isArray(item.content)) return '';
  return item.content
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

export function collectProviderUsage(events = []) {
  const turns = events.filter((event) => event.type === 'turn.completed');
  if (!turns.length) throw new Error('scored Codex thread did not report provider usage');
  const usages = turns.map((event) => normalizeProviderUsage(event.usage));
  return Object.fromEntries(Object.keys(usages[0]).map((key) => [key,
    usages.some((value) => value[key] == null) ? null : usages.reduce((sum, value) => sum + value[key], 0),
  ]));
}

export function parseScoredCodexEvents(events = [], expectedMcp) {
  const forbidden = new Set(['command_execution', 'file_change', 'web_search_call', 'computer_action']);
  for (const event of events) {
    if (forbidden.has(event?.item?.type)) throw new Error(`forbidden capability used: ${event.item.type}`);
    if (expectedMcp && event.item?.type === 'mcp_tool_call' &&
      (event.item.server !== expectedMcp.serverName || !expectedMcp.enabledTools.includes(event.item.tool))) {
      throw new Error(`tool outside selected mode: ${event.item.server}/${event.item.tool}`);
    }
  }
  const completedItems = events.filter((event) => event.type === 'item.completed');
  if (expectedMcp?.serverName === 'browser_dom') {
    const observed = completedItems.some(({ item }) => {
      if (item?.server !== 'browser_dom' || !['open_page', 'dom'].includes(item.tool) ||
        item.status !== 'completed' || item.error || item.result?.isError || item.result?.is_error) return false;
      return item.result?.content?.some((part) => {
        try {
          const value = JSON.parse(part.text);
          return typeof value.dom === 'string' && value.dom.length > 0 && typeof value.url === 'string';
        } catch { return false; }
      });
    });
    if (!observed) throw new Error('scored thread did not read the rendered DOM');
  }
  const toolCallCount = completedItems.filter((event) => event.item?.type === 'mcp_tool_call').length;
  const finalText = completedItems
    .filter((event) => event.item?.type === 'agent_message')
    .map((event) => messageText(event.item))
    .filter(Boolean)
    .at(-1) ?? '';
  const usage = collectProviderUsage(events);
  return {
    threadId: events.find((event) => event.type === 'thread.started')?.thread_id ?? null,
    finalText,
    toolCallCount,
    // CLI does not report request count. Parallel tools do not imply separate requests.
    modelRequestCount: null,
    usage,
  };
}

export function validateCompletedSummary(summary = {}) {
  if (summary.status !== 'completed') throw new Error('attempt is not completed');
  if (!summary.oraclePassed || !summary.finalAnswerPassed) throw new Error('both oracles must pass');
  if (!Number.isInteger(summary.toolCallCount) || summary.toolCallCount < 1) throw new Error('completed attempt needs a browser tool call');
  if (!Number.isInteger(summary.totalTokens) || summary.totalTokens < 1) throw new Error('completed attempt needs positive token usage');
  if (summary.uncachedInputTokens !== summary.inputTokens - summary.cachedInputTokens) throw new Error('input token subsets are inconsistent');
  if (summary.reasoningTokens == null ? summary.visibleOutputTokens != null : summary.visibleOutputTokens !== summary.outputTokens - summary.reasoningTokens) throw new Error('output token subsets are inconsistent');
  if (summary.totalTokens !== summary.inputTokens + summary.outputTokens) throw new Error('total token count is inconsistent');
  return true;
}

export function finalBenchmarkModes() {
  return Object.keys(modeTools);
}
