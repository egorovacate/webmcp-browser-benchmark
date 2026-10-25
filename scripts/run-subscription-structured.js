import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBenchmarkServer } from '../src/server/server.js';
import { createChromeDevToolsMcpClient } from '../src/runner/chrome-devtools-mcp-client.js';
import { createManifest } from '../src/runner/manifest.js';
import { validateTask } from '../src/runner/oracle.js';
import { createPlaywrightMcpClient } from '../src/runner/playwright-mcp-client.js';
import { createPlaywrightMcpMode } from '../src/runner/modes/playwright-mcp.js';
import { writeAttemptResult } from '../src/runner/result-writer.js';
import { parseCodexSubscriptionTurn } from '../src/runner/codex-subscription.js';
import { createPlaywrightMcpRuntime } from '../src/runner/runtimes/playwright-mcp.js';
import { createVisualRuntime } from '../src/runner/runtimes/visual.js';
import { createWebMcpRuntime } from '../src/runner/runtimes/webmcp.js';

const MODEL = 'gpt-5.6-terra';
const [mode, taskId] = process.argv.slice(2);
const outputDir = process.env.BENCHMARK_OUTPUT_DIR ?? 'results/subscription-structured';
const tasks = JSON.parse(await readFile(new URL('../fixtures/tasks.json', import.meta.url), 'utf8'));
const task = tasks.find((candidate) => candidate.id === taskId);
if (!['webmcp', 'playwright-mcp', 'visual'].includes(mode) || !task) throw new Error('usage: bun scripts/run-subscription-structured.js mode T1|T2|T3|T4|T5');

const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['tool_calls', 'final'] },
    toolCalls: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, name: { type: 'string' }, inputJson: { type: 'string' } }, required: ['id', 'name', 'inputJson'] } },
    finalText: { type: 'string' },
  },
  required: ['type', 'toolCalls', 'finalText'],
};

function instruction(prompt, definitions, results) {
  const modeRule = mode === 'webmcp'
    ? 'Use only the supplied WebMCP page tools. When a product feature is named, use the tool tags filter (for example tags:["noise-cancelling"]) instead of putting the whole feature phrase into query. Never use DOM, screenshots, selectors, shell, or another capability.'
    : mode === 'playwright-mcp'
      ? 'Use only the supplied Playwright MCP tools. Never use screenshots, DOM evaluation, WebMCP, shell, or another capability.'
      : 'Use only the supplied DOM/CSS tools. Visual mode is DOM plus click/type/press/scroll only. Never use screenshots, coordinates, accessibility snapshots, WebMCP, shell, or another capability.';
  const prior = results.length === 0 ? '' : `\nCompleted tool results (authoritative): ${JSON.stringify(results)}`;
  return [
    'You are a browser benchmark agent.',
    modeRule,
    'Do not inspect files, environment variables, credentials, source code, or external network.',
    'For every tool call, put the JSON arguments in inputJson. Never repeat a completed call unless required by the task.',
    results.length === 0 ? `Task: ${prompt}` : 'Continue the task using the completed tool results.',
    `Available tools: ${JSON.stringify(definitions)}`,
    prior,
    results.length === 0 ? 'Use at least one relevant tool before final.' : 'Return final as soon as the results answer the task; otherwise call only a new necessary tool.',
    'Respond only with the required JSON object.',
  ].join('\n');
}

function parseRows(stdout) {
  return stdout.split('\n').flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

async function codexTurn(tempDir, promptText, turn) {
  const schemaPath = join(tempDir, 'schema.json');
  const outputPath = join(tempDir, `turn-${turn}.json`);
  await writeFile(schemaPath, JSON.stringify(schema), 'utf8');
  const args = [
    'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--json', '--dangerously-bypass-approvals-and-sandbox',
    '-m', MODEL, '-C', '/private/tmp', '--output-schema', schemaPath, '-o', outputPath, promptText,
  ];
  const inherited = process.env;
  const env = Object.fromEntries([
    ['PATH', inherited.PATH], ['HOME', inherited.HOME], ['USER', inherited.USER], ['LOGNAME', inherited.LOGNAME],
    ['TMPDIR', inherited.TMPDIR], ['LANG', inherited.LANG], ['LC_ALL', inherited.LC_ALL], ['CODEX_HOME', inherited.CODEX_HOME],
  ].filter(([, value]) => value !== undefined));
  const child = Bun.spawn(['codex', ...args], { cwd: process.cwd(), env, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (exitCode !== 0) throw new Error(`structured Codex turn failed (${exitCode}): ${stderr || stdout}`);
  return { parsed: parseCodexSubscriptionTurn({ stdout, lastMessage: await readFile(outputPath, 'utf8'), fallbackSessionId: `turn-${turn}` }), rows: parseRows(stdout) };
}

async function createRuntime(targetUrl) {
  if (mode === 'webmcp') return createWebMcpRuntime({ client: createChromeDevToolsMcpClient({ targetUrl, headless: true, isolated: true }) });
  if (mode === 'playwright-mcp') {
    const contract = createPlaywrightMcpMode();
    return createPlaywrightMcpRuntime({ client: createPlaywrightMcpClient({ targetUrl }), allowedToolNames: contract.allowedToolNames });
  }
  return createVisualRuntime({ targetUrl });
}

const tempDir = await mkdtemp(join(tmpdir(), 'codex-structured-'));
const server = await createBenchmarkServer();
const began = performance.now();
let runtime;
try {
  server.store.reset();
  runtime = await createRuntime(server.url);
  const definitions = runtime.toolDefinitions;
  const results = [];
  const events = [];
  const usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
  let finalText = '';
  for (let turn = 0; turn < 8; turn += 1) {
    const response = await codexTurn(tempDir, instruction(task.prompt, definitions, results), turn);
    for (const key of Object.keys(usage)) usage[key] += response.parsed.tokenUsage[key] ?? 0;
    events.push(...response.rows.map((event) => ({ turn: turn + 1, ...event })));
    const answer = response.parsed.response;
    if (answer.type === 'final') {
      finalText = answer.finalText;
      break;
    }
    if (answer.toolCalls.length === 0) throw new Error('structured Codex turn returned no tool calls');
    for (const call of answer.toolCalls) {
      if (!runtime.tools[call.name]) throw new Error(`structured Codex selected unavailable tool: ${call.name}`);
      const result = await runtime.tools[call.name](call.input);
      results.push({ toolCallId: call.id, name: call.name, result: result?.imageDataUrl ? { screenshot: 'forbidden' } : result });
    }
  }
  if (!finalText) throw new Error('structured Codex run did not return a final answer');
  const elapsedMs = Math.round(performance.now() - began);
  const verdict = validateTask(task.id, { snapshot: server.store.snapshot(), finalAnswer: finalText });
  const totalTokens = usage.inputTokens + usage.outputTokens;
  const summary = {
    status: verdict.oraclePassed && verdict.finalAnswerPassed ? 'completed' : 'failed',
    mode, taskId: task.id, model: MODEL, finalText, elapsedMs,
    tokenUsage: usage, totalTokens, nativeCodex: true, structuredRunner: true, ...verdict,
  };
  const resultPaths = await writeAttemptResult({
    outputDir, runId: randomUUID(),
    manifest: createManifest({ mode, modelId: MODEL, providerConfig: { provider: 'codex-subscription-structured', model: MODEL } }),
    summary, events,
  });
  console.log(JSON.stringify({ ...summary, resultPaths }, null, 2));
} finally {
  await runtime?.close();
  await server.close();
  await rm(tempDir, { recursive: true, force: true });
}
