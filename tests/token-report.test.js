import test from 'node:test';
import assert from 'node:assert/strict';
import { isAcceptedBenchmarkMatrix, summarizeAttempts, renderTokenReport } from '../src/runner/token-report.js';

const measured = (mode, totalTokens = 120) => ({
  mode, taskId: 'T1', model: 'gpt-5.6-terra', status: 'completed',
  oraclePassed: true, finalAnswerPassed: true, toolCallCount: 1,
  tokenSource: 'codex.turn.completed.usage',
  totalTokens, inputTokens: totalTokens - 20, cachedInputTokens: 20, outputTokens: 20,
  rawProviderUsage: [{ input_tokens: totalTokens - 20, cached_input_tokens: 20, output_tokens: 20 }],
});

test('failed DOM connection spend never appears in benchmark comparison rows', () => {
  const matrix = summarizeAttempts([
    measured('webmcp'), measured('playwright-mcp'),
    { ...measured('visual', 55124), status: 'failed', finalAnswerPassed: false, error: 'Chrome unavailable' },
  ]);
  assert.equal(matrix.status, 'incomplete');
  assert.equal(matrix.comparisonReady, false);
  assert.deepEqual(matrix.comparisonRows, []);
  assert.equal(matrix.diagnosticRows[0].totalTokens, 55124);
  assert.equal(matrix.grandTotalTokens, 55364);
  const report = renderTokenReport(matrix);
  assert.doesNotMatch(report, /\| DOM \|/);
  assert.match(report, /55124/);
  assert.match(report, /Diagnostic spend/);
});

test('partial successful results cannot declare the three-mode benchmark complete', () => {
  const matrix = summarizeAttempts([measured('webmcp')]);
  assert.equal(matrix.comparisonReady, false);
  assert.equal(matrix.status, 'incomplete');
  assert.deepEqual(matrix.comparisonRows, []);
});

test('a complete comparable matrix requires actual matching usage and both oracles', () => {
  const rows = [measured('webmcp', 100), measured('playwright-mcp', 120), measured('visual', 140)];
  const matrix = summarizeAttempts(rows);
  assert.equal(matrix.comparisonReady, true);
  assert.equal(matrix.comparisonRows.length, 3);
  assert.match(renderTokenReport(matrix), /\| DOM \| T1/);
  for (const invalid of [
    { finalAnswerPassed: false }, { oraclePassed: false }, { totalTokens: 1 },
    { rawProviderUsage: [] }, { toolCallCount: 0 }, { model: 'another-model' },
  ]) {
    assert.equal(summarizeAttempts([...rows.slice(0, 2), { ...rows[2], ...invalid }]).comparisonReady, false);
  }
});

test('a completed triad with a non-strict interface order is not comparison-ready', () => {
  const matrix = summarizeAttempts([
    measured('webmcp', 100),
    measured('playwright-mcp', 300),
    measured('visual', 200),
  ]);
  assert.equal(matrix.comparisonReady, false);
  assert.equal(matrix.status, 'invalid');
  assert.deepEqual(matrix.comparisonRows, []);
  assert.equal(isAcceptedBenchmarkMatrix(matrix), false);
});

test('only a completed strict matrix is accepted for persistence', () => {
  const matrix = summarizeAttempts([
    measured('webmcp', 100),
    measured('playwright-mcp', 120),
    measured('visual', 140),
  ]);
  assert.equal(isAcceptedBenchmarkMatrix(matrix), true);
});

test('an explicit single-mode run is complete only for its requested scope', () => {
  const matrix = summarizeAttempts([measured('visual')], { expectedCells: [{ mode: 'visual', taskId: 'T1' }] });
  assert.equal(matrix.status, 'completed');
  assert.equal(matrix.comparisonReady, false);
  assert.deepEqual(matrix.comparisonRows, []);
  assert.match(renderTokenReport(matrix), /total 120 tokens/);
});

test('missing usage is not zero and makes spend total unknown', () => {
  const matrix = summarizeAttempts([
    { mode: 'visual', status: 'failed', totalTokens: null }, measured('webmcp', 150),
  ]);
  assert.equal(matrix.grandTotalTokens, null);
  assert.equal(matrix.reportedTotalTokens, 150);
  assert.match(renderTokenReport(matrix), /unknown/);
});
