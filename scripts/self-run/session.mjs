// Self-run session host. The agent (a model in its own chat) drives one task through one
// interface step by step: every call goes through the same MCP server and the same
// enabled tool list as the scored benchmark (buildModeMcpConfig). Nothing here solves the task.
//
//   bun scripts/self-run/session.mjs <mode> <taskId> <outDir>   # start (background)
//   bun scripts/self-run/call.mjs <tool> '<json-args>'          # one tool call
//   bun scripts/self-run/call.mjs --finish '<final answer>'     # oracle + tokens, then exit
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createBenchmarkServer } from '../../src/server/server.js';
import { buildModeMcpConfig } from '../../src/runner/final-benchmark.js';
import { validateTask } from '../../src/runner/oracle.js';

const [mode, taskId, outDirArg] = process.argv.slice(2);
const controlPort = Number(process.env.SELF_RUN_PORT ?? 5899);
const tiktokenDir = process.env.SELF_RUN_TIKTOKEN_DIR;
if (!mode || !taskId || !outDirArg || !tiktokenDir) throw new Error('usage: SELF_RUN_TIKTOKEN_DIR=... session.mjs <mode> <task> <outDir>');

const { Tiktoken } = await import(join(tiktokenDir, 'node_modules/js-tiktoken/dist/lite.js'));
const ranks = (await import(join(tiktokenDir, 'node_modules/js-tiktoken/dist/ranks/o200k_base.js'))).default;
const enc = new Tiktoken(ranks);
const count = (text) => enc.encode(text).length;

const tasks = JSON.parse(await readFile(new URL('../../fixtures/tasks.json', import.meta.url), 'utf8'));
const task = tasks.find((t) => t.id === taskId);
if (!task) throw new Error(`unknown task ${taskId}`);

const store = await createBenchmarkServer();
const mcp = buildModeMcpConfig(mode, store.url);
const client = new Client({ name: 'self-run', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: mcp.command, args: mcp.commandArgs, cwd: mcp.cwd, stderr: 'ignore' }));
const tools = (await client.listTools()).tools.filter((tool) => mcp.enabledTools.includes(tool.name));
const schemaText = JSON.stringify(tools);
const events = [];
const startedAt = new Date().toISOString();
const wallStart = performance.now();

// What a model reads from a tool result: its text content parts.
const resultText = (result) => (result.content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n');

const prompt = [
  `The isolated benchmark page is at ${store.url}.`,
  'Use only the supplied browser tools.',
  task.prompt,
].join('\n');

const http = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const msg = body ? JSON.parse(body) : {};
  try {
    if (req.url === '/info') {
      res.end(JSON.stringify({ mode, taskId, url: store.url, prompt, tools }, null, 1));
      return;
    }
    if (req.url === '/call') {
      if (!mcp.enabledTools.includes(msg.tool)) throw new Error(`tool outside ${mode} contract: ${msg.tool}`);
      const t0 = performance.now();
      const result = await client.callTool({ name: msg.tool, arguments: msg.args ?? {} }, undefined, { timeout: 120000 });
      const ms = performance.now() - t0;
      const text = resultText(result);
      events.push({ tool: msg.tool, args: msg.args ?? {}, ms: Math.round(ms), isError: !!result.isError, observation: text, tokens: count(text), argTokens: count(JSON.stringify(msg.args ?? {})) });
      res.end(text);
      return;
    }
    if (req.url === '/finish') {
      const answer = String(msg.answer ?? '');
      const verdict = validateTask(taskId, { snapshot: store.store.snapshot(), finalAnswer: answer });
      const schemaTokens = count(schemaText);
      const observationTokens = events.reduce((s, e) => s + e.tokens, 0);
      const input = schemaTokens + observationTokens;
      const output = count(answer);
      const summary = {
        model: process.env.SELF_RUN_MODEL ?? 'claude-opus-5-5', test: taskId, interface: mode === 'visual' ? 'dom' : mode,
        mcpInterface: mcp.interface ?? mcp.serverName,
        total: input + output, input, output, reasoning: 'n/a', calls: events.length,
        timeMs: events.reduce((s, e) => s + e.ms, 0),
        schemaTokens, observationTokens, callArgumentTokens: events.reduce((s, e) => s + e.argTokens, 0),
        wallClockMs: Math.round(performance.now() - wallStart), startedAt,
        finalAnswer: answer, ...verdict,
      };
      const dir = resolve(outDirArg, `${taskId}-${summary.interface}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
      await writeFile(join(dir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
      await writeFile(join(dir, 'tools.json'), `${JSON.stringify(tools, null, 2)}\n`);
      res.end(JSON.stringify(summary, null, 2));
      setTimeout(shutdown, 50);
      return;
    }
    res.statusCode = 404; res.end('not found');
  } catch (error) {
    res.statusCode = 500; res.end(`ERROR: ${error.message}`);
  }
});

async function shutdown() {
  http.close();
  await client.close().catch(() => {});
  await store.close().catch(() => {});
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
http.listen(controlPort, '127.0.0.1', () => console.log(`ready ${mode}/${taskId} store=${store.url} tools=${tools.map((t) => t.name).join(',')}`));
