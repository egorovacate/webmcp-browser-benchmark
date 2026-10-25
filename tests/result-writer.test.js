import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeAttemptResult } from '../src/runner/result-writer.js';

test('result writer persists redacted manifest, summary, and JSONL events for one attempt', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'webmcp-results-'));
  const paths = await writeAttemptResult({
    outputDir,
    runId: 'run-t1-webmcp',
    manifest: { mode: 'webmcp', providerConfig: { apiKey: 'must-not-appear', model: 'test' } },
    summary: { taskId: 'T1', oraclePassed: true, totalTokens: 12 },
    events: [{ eventType: 'model_request', inputTokens: 8 }],
  });

  const manifest = await readFile(paths.manifestPath, 'utf8');
  const summary = JSON.parse(await readFile(paths.summaryPath, 'utf8'));
  const events = await readFile(paths.eventsPath, 'utf8');

  assert.equal(manifest.includes('must-not-appear'), false);
  assert.equal(summary.oraclePassed, true);
  assert.equal(events, '{"eventType":"model_request","inputTokens":8}\n');
});
