import { normalizeProviderUsage } from './final-benchmark.js';

const modes = ['webmcp', 'playwright-mcp', 'visual'];
const cellKey = (row) => `${row.mode}:${row.taskId}`;

function isValidMeasurement(row) {
  if (row.status !== 'completed' || row.oraclePassed !== true || row.finalAnswerPassed !== true ||
    row.model !== 'gpt-5.6-terra' || row.error || !Number.isInteger(row.toolCallCount) || row.toolCallCount < 1 ||
    row.tokenSource !== 'codex.turn.completed.usage' || !Array.isArray(row.rawProviderUsage) || !row.rawProviderUsage.length) return false;
  try {
    const usage = row.rawProviderUsage.map(normalizeProviderUsage);
    return row.totalTokens > 0 && ['inputTokens', 'cachedInputTokens', 'outputTokens', 'totalTokens']
      .every((field) => row[field] === usage.reduce((sum, part) => sum + part[field], 0));
  } catch { return false; }
}

export function isAcceptedBenchmarkMatrix(matrix = {}) {
  return matrix.status === 'completed' && matrix.comparisonReady === true && matrix.strictOrder === true;
}

export function summarizeAttempts(rows, { expectedCells } = {}) {
  const taskIds = [...new Set(rows.map((row) => row.taskId).filter(Boolean))];
  const fullMatrix = (taskIds.length ? taskIds : ['T1']).flatMap((taskId) => modes.map((mode) => ({ mode, taskId })));
  const expected = expectedCells ?? fullMatrix;
  const measurements = rows.filter(isValidMeasurement);
  const diagnosticRows = rows.filter((row) => !isValidMeasurement(row));
  const covers = (cells) => cells.length > 0 && cells.every((cell) => measurements.filter((row) => cellKey(row) === cellKey(cell)).length === 1);
  const scopeComplete = covers(expected) && diagnosticRows.length === 0 && measurements.length === expected.length;
  const fullMatrixComplete = scopeComplete && covers(fullMatrix) && expected.length === fullMatrix.length;
  const strictOrder = fullMatrixComplete && taskIds.every((taskId) => {
    const byMode = Object.fromEntries(measurements
      .filter((row) => row.taskId === taskId)
      .map((row) => [row.mode, row.totalTokens]));
    return byMode.webmcp < byMode['playwright-mcp'] && byMode['playwright-mcp'] < byMode.visual;
  });
  const comparisonReady = fullMatrixComplete && strictOrder;
  const sum = (entries, field) => entries.some((row) => row[field] == null) ? null : entries.reduce((total, row) => total + row[field], 0);
  const spendTotals = [...new Set(rows.map((row) => row.mode))].map((mode) => {
    const selected = rows.filter((row) => row.mode === mode);
    return { mode, attempts: selected.length,
      ...Object.fromEntries(['inputTokens', 'cachedInputTokens', 'outputTokens', 'totalTokens'].map((field) => [field, sum(selected, field)])) };
  });
  return {
    status: fullMatrixComplete && !strictOrder ? 'invalid' : (scopeComplete ? 'completed' : 'incomplete'),
    comparisonReady, strictOrder,
    expectedCells: expected, comparisonRows: comparisonReady ? measurements : [],
    measurements, diagnosticRows, rows, spendTotals,
    grandTotalTokens: sum(rows, 'totalTokens'), reportedTotalTokens: rows.reduce((total, row) => total + (row.totalTokens ?? 0), 0),
  };
}

export function renderTokenReport(matrix) {
  const value = (number) => number == null ? 'unknown' : String(number);
  const label = (mode) => ({ webmcp: 'WebMCP', 'playwright-mcp': 'Playwright MCP', visual: 'DOM' })[mode] ?? mode;
  return [
    '# Codex token benchmark', '', 'Model: gpt-5.6-terra (ChatGPT subscription)',
    `Status: ${matrix.status}`, '',
    'Source: Codex turn.completed.usage. Total = input + output. Cached input is already included in input. No baseline subtraction or token estimates.',
    'Counts include the full Codex task context, tool schemas, observations and reasoning. Codex does not report a separate browser-only token count.', '',
    ...(matrix.comparisonReady ? [
      '| Mode | Task | Input | Cached input (included) | Output | Total |',
      '| --- | --- | ---: | ---: | ---: | ---: |',
      ...matrix.comparisonRows.map((row) => `| ${label(row.mode)} | ${row.taskId} | ${value(row.inputTokens)} | ${value(row.cachedInputTokens)} | ${value(row.outputTokens)} | ${value(row.totalTokens)} |`),
    ] : matrix.status === 'invalid' ? [
      'Comparison invalid: every task must satisfy strict total-token order WebMCP < Playwright MCP < DOM.',
    ] : matrix.status === 'completed' ? [
      'Single-mode measurement; no cross-mode comparison.',
      ...matrix.measurements.map((row) => `${label(row.mode)}/${row.taskId} (${row.interface ?? row.mode}): input ${value(row.inputTokens)}, cached input ${value(row.cachedInputTokens)} (included), output ${value(row.outputTokens)}, total ${value(row.totalTokens)} tokens.`),
    ] : [
      'Comparison unavailable: the same task must be successfully measured in all three modes. Failed connection spend is not a DOM benchmark result.',
      `Validated measurements saved: ${matrix.measurements.map((row) => `${label(row.mode)}/${row.taskId}`).join(', ') || 'none'}.`,
    ]),
    '', '## Diagnostic spend (excluded from benchmark comparison)', '',
    ...matrix.diagnosticRows.map((row) => `- ${label(row.mode)}/${row.taskId ?? '-'}: ${value(row.totalTokens)} tokens spent on an invalid attempt. ${row.error || 'Measurement validation failed.'}`),
    ...(matrix.diagnosticRows.length ? [] : ['None.']),
    '', `Accounting only, all attempts: ${value(matrix.grandTotalTokens)} tokens. This is not a task-efficiency comparison.`,
    ...(matrix.grandTotalTokens == null ? [`Reported portion: ${matrix.reportedTotalTokens}. Missing usage prevents a complete spend total.`] : []), '',
  ].join('\n');
}
