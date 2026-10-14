import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createBenchmarkServer } from '../src/server/server.js';
import { assertDynamicBenchmarkHtml, buildModeMcpConfig, buildScoredPrompt, collectProviderUsage, finalBenchmarkModes, parseScoredCodexEvents, validateCompletedSummary } from '../src/runner/final-benchmark.js';
import { prepareCodex, runNativeCodex } from '../src/runner/native-codex.js';
import { createManifest } from '../src/runner/manifest.js';
import { validateTask } from '../src/runner/oracle.js';
import { writeAttemptResult } from '../src/runner/result-writer.js';
import { summarizeAttempts, renderTokenReport } from '../src/runner/token-report.js';

// Intentionally pinned: this command never chooses or falls back to another model.
const model = 'gpt-5.6-terra';
const requested = process.argv.slice(2);
const modes = finalBenchmarkModes();
const tasks = JSON.parse(await readFile(new URL('../fixtures/tasks.json', import.meta.url), 'utf8'));
let selectedModes = modes;
let taskId = 'T1';
if (requested.length === 1) [taskId] = requested;
else if (requested.length === 2) { selectedModes = [requested[0] === 'dom' ? 'visual' : requested[0]]; taskId = requested[1]; }
else if (requested.length) throw new Error('usage: bun run benchmark [T1 | webmcp|playwright-mcp|dom T1]');
const task = tasks.find((candidate) => candidate.id === taskId);
if (!task || selectedModes.some((mode) => !modes.includes(mode))) throw new Error('Unknown benchmark mode or task');
const reportScope = { expectedCells: selectedModes.map((mode) => ({ mode, taskId })) };
const batchId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
const outputDir = resolve(process.env.BENCHMARK_OUTPUT_DIR ?? 'results/codex-tokens', batchId);
await mkdir(outputDir, { recursive: true });
const context = await prepareCodex();
const rows = [];

for (const mode of selectedModes) {
  console.error(`Running ${model}: ${mode}/${task.id}`);
  const server = await createBenchmarkServer();
  const started = performance.now();
  let events = [];
  let parsed;
  let usage;
  let stderr = '';
  let error = null;
  let verdict = { oraclePassed: false, finalAnswerPassed: false };
  let mcp;
  try {
    assertDynamicBenchmarkHtml(await fetch(server.url).then((response) => response.text()));
    mcp = buildModeMcpConfig(mode, server.url);
    const run = await runNativeCodex({ context, model, mcp, prompt: buildScoredPrompt(mode, server.url, task.prompt) });
    events = run.events;
    stderr = run.stderr;
    usage = collectProviderUsage(events);
    parsed = parseScoredCodexEvents(events, mcp);
    if (run.timedOut || run.exitCode !== 0) throw new Error(run.timedOut ? 'Codex timed out' : `Codex exited ${run.exitCode}`);
    const failure = events.find((event) => event.type === 'turn.failed' || event.type === 'error');
    if (failure) throw new Error(JSON.stringify(failure));
    verdict = validateTask(task.id, { snapshot: server.store.snapshot(), finalAnswer: parsed.finalText });
    if (!verdict.oraclePassed) throw new Error(`Backend-state mismatch: ${parsed.finalText}`);
    if (!verdict.finalAnswerPassed) throw new Error(`Final-answer mismatch (backend state correct): ${parsed.finalText}`);
  } catch (caught) {
    error = caught.message;
  } finally {
    await server.close();
  }
  const summary = {
    status: error ? 'failed' : 'completed', model, mode, taskId: task.id,
    interface: mcp?.interface ?? mcp?.serverName,
    tokenSource: 'codex.turn.completed.usage',
    rawProviderUsage: events.filter((event) => event.type === 'turn.completed').map((event) => event.usage),
    ...usage,
    totalTokens: usage?.totalTokens ?? null,
    threadId: parsed?.threadId ?? null,
    toolCallCount: parsed?.toolCallCount ?? null,
    finalText: parsed?.finalText ?? '',
    elapsedMs: Math.round(performance.now() - started),
    ...verdict, error,
  };
  if (summary.status === 'completed') validateCompletedSummary(summary);
  const resultPaths = await writeAttemptResult({
    outputDir, runId: mode,
    manifest: createManifest({ mode, modelId: model, versions: { codex: context.version }, providerConfig: { provider: 'codex-subscription-native', taskId: task.id, server: mcp?.serverName, interface: summary.interface, enabledTools: mcp?.enabledTools } }),
    summary, events,
  });
  await writeFile(join(resultPaths.attemptDir, 'stderr.log'), stderr);
  rows.push({ ...summary, resultPaths });
  // Persist every attempt before starting another, including failures. No hidden retries or old results.
  const matrix = summarizeAttempts(rows, reportScope);
  await writeFile(join(outputDir, 'matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`);
  await writeFile(join(outputDir, 'matrix.md'), renderTokenReport(matrix));
}
const matrix = summarizeAttempts(rows, reportScope);
console.log(renderTokenReport(matrix));
console.log(`Results: ${join(outputDir, 'matrix.json')}`);
if (matrix.status !== 'completed') process.exitCode = 1;
