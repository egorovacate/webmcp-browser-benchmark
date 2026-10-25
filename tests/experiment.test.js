import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeExperimentAttempt } from '../src/runner/experiment.js';

test('experiment attempt runs one task, writes results, and closes runtime and server', async () => {
  const closed = [];
  const outputDir = await mkdtemp(join(tmpdir(), 'webmcp-experiment-'));
  const result = await executeExperimentAttempt({
    mode: 'webmcp',
    taskId: 'T1',
    stage: 'smoke',
    provider: {
      provider: 'test',
      model: 'test-model',
      async complete() {
        return { finalText: 'Sonic Lite ANC costs $129.00.', usage: {} };
      },
    },
    outputDir,
    runId: 'test-run',
    createServer: async () => ({
      url: 'http://127.0.0.1:4173/',
      store: { reset() {}, snapshot: () => ({ cart: { lines: [] }, orders: [] }) },
      close: async () => closed.push('server'),
    }),
    createRuntime: async () => ({
      toolDefinitions: [],
      tools: {},
      close: async () => closed.push('runtime'),
    }),
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.oraclePassed, true);
  assert.equal(result.resultPaths.summaryPath.endsWith('/test-run/summary.json'), true);
  assert.deepEqual(closed, ['runtime', 'server']);
});
