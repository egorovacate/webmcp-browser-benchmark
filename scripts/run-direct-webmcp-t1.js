import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createChromeDevToolsMcpClient } from '../src/runner/chrome-devtools-mcp-client.js';
import { createManifest } from '../src/runner/manifest.js';
import { validateTask } from '../src/runner/oracle.js';
import { writeAttemptResult } from '../src/runner/result-writer.js';

const outputDir = process.env.BENCHMARK_OUTPUT_DIR ?? 'results/webmcp-direct-t1-final';
const input = {
  category: 'headphones',
  inStockOnly: true,
  maxPriceCents: 19999,
  query: 'noise-cancelling',
  sort: 'price_asc',
};

const targetUrl = process.env.BENCHMARK_URL ?? 'https://shmakovdima.github.io/webmcp-browser-benchmark';
const client = createChromeDevToolsMcpClient({
  targetUrl,
  headless: true,
  isolated: true,
  extraArgs: [
    '--categoryInput=false',
    '--categoryEmulation=false',
    '--categoryPerformance=false',
    '--categoryNetwork=false',
    '--categoryDebugging=false',
    '--categoryMemory=false',
    '--categoryExtensions=false',
    '--categoryPwa=false',
  ],
});

try {
  const began = performance.now();
  const { pageId } = await client.start();
  const listed = await client.listWebMcpTools(pageId);
  const tools = listed?.structuredContent?.webmcpTools ?? [];
  const searchTool = tools.find((tool) => tool.name === 'search_products');
  if (!searchTool) throw new Error('search_products was not registered on the page');
  const result = await client.executeWebMcpTool({
    pageId,
    toolName: searchTool.name,
    input,
  });
  const text = result?.content?.find((part) => part.type === 'text')?.text ?? '';
  const payload = JSON.parse(text);
  const products = payload?.output?.products ?? [];
  const cheapest = products[0];
  const finalAnswer = cheapest ? `${cheapest.name} - $${(cheapest.priceCents / 100).toFixed(2)}` : '';
  const verdict = {
    oraclePassed: products.length > 0 && cheapest.id === 'hp-sonic-lite' && cheapest.priceCents === 12900,
    finalAnswerPassed: /sonic lite anc/i.test(finalAnswer) && /\$129\.00/.test(finalAnswer),
    failureCategory: null,
  };
  verdict.failureCategory = verdict.oraclePassed && verdict.finalAnswerPassed ? null : 'direct-result-mismatch';
  const summary = {
    status: verdict.oraclePassed && verdict.finalAnswerPassed ? 'completed' : 'failed',
    mode: 'webmcp',
    executionMode: 'direct-page-tool',
    taskId: 'T1',
    model: null,
    finalText: finalAnswer,
    elapsedMs: Math.round(performance.now() - began),
    pageId,
    registeredTools: tools.map((tool) => tool.name),
    toolCallCount: 1,
    toolName: searchTool.name,
    toolInput: input,
    toolOutput: payload,
    tokenUsage: null,
    totalTokens: null,
    nativeCodex: false,
    ...verdict,
  };
  const resultPaths = await writeAttemptResult({
    outputDir,
    runId: randomUUID(),
    manifest: createManifest({
      mode: 'webmcp',
      modelId: null,
      providerConfig: { provider: 'direct-page-webmcp' },
    }),
    summary,
    events: [{
      type: 'webmcp.call',
      toolName: searchTool.name,
      input,
      output: payload,
    }],
  });
  console.log(JSON.stringify({ ...summary, resultPaths }, null, 2));
} finally {
  await client.close();
}
