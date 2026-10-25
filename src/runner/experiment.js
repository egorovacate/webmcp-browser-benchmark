import { randomUUID } from 'node:crypto';
import { createBenchmarkServer } from '../server/server.js';
import { createManifest } from './manifest.js';
import { createPlaywrightMcpClient } from './playwright-mcp-client.js';
import { createChromeDevToolsMcpClient } from './chrome-devtools-mcp-client.js';
import { createPlaywrightMcpMode } from './modes/playwright-mcp.js';
import { createWebMcpRuntime } from './runtimes/webmcp.js';
import { createPlaywrightMcpRuntime } from './runtimes/playwright-mcp.js';
import { createVisualRuntime } from './runtimes/visual.js';
import { writeAttemptResult } from './result-writer.js';
import { runBenchmark } from './run.js';

async function createDefaultRuntime({ mode, targetUrl }) {
  if (mode === 'webmcp') {
    return createWebMcpRuntime({ client: createChromeDevToolsMcpClient({ targetUrl }) });
  }
  if (mode === 'playwright-mcp') {
    const modeContract = createPlaywrightMcpMode();
    return createPlaywrightMcpRuntime({
      client: createPlaywrightMcpClient({ targetUrl }),
      allowedToolNames: modeContract.allowedToolNames,
    });
  }
  if (mode === 'visual') return createVisualRuntime({ targetUrl });
  throw new Error(`unknown benchmark mode: ${mode}`);
}

export async function executeExperimentAttempt({
  mode,
  taskId,
  stage = 'smoke',
  provider,
  outputDir = 'results',
  runId = randomUUID(),
  createServer = createBenchmarkServer,
  createRuntime = createDefaultRuntime,
} = {}) {
  if (!provider || typeof provider.complete !== 'function') throw new Error('experiment requires a configured provider');
  let server;
  let runtime;
  try {
    server = await createServer();
    server.store.reset();
    runtime = await createRuntime({ mode, targetUrl: server.url });
    const result = await runBenchmark({
      mode,
      taskId,
      stage,
      modelId: provider.model,
      provider,
      runtime: {
        ...runtime,
        getSnapshot: async () => server.store.snapshot(),
      },
    });
    const manifest = createManifest({
      mode,
      modelId: provider.model,
      providerConfig: { provider: provider.provider, model: provider.model },
    });
    const resultPaths = await writeAttemptResult({
      outputDir,
      runId,
      manifest,
      summary: result,
      events: result.events,
    });
    return { ...result, resultPaths };
  } finally {
    await runtime?.close();
    await server?.close();
  }
}
