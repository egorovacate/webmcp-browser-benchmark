import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('chrome-devtools-mcp/package.json');
const defaultCliPath = join(dirname(packageJsonPath), 'build/src/bin/chrome-devtools-mcp.js');
const allowedToolNames = ['list_webmcp_tools', 'execute_webmcp_tool'];

function notStarted() {
  throw new Error('Chrome DevTools MCP client is not started');
}

export function findTargetPageId(response, targetUrl) {
  const pages = response?.structuredContent?.pages ?? [];
  const expectedUrl = new URL(targetUrl).href;
  const page = pages.find((candidate) => {
    try {
      return new URL(candidate.url).href === expectedUrl;
    } catch {
      return false;
    }
  });
  if (!page || typeof page.id !== 'number') {
    throw new Error(`Chrome DevTools MCP did not return the target page: ${targetUrl}`);
  }
  return page.id;
}

export function createChromeDevToolsMcpClient({
  targetUrl,
  command = process.env.CHROME_DEVTOOLS_MCP_NODE ?? 'node',
  cliPath = defaultCliPath,
  cwd = process.cwd(),
  browser = 'stable',
  headless = false,
  isolated = true,
  extraArgs = [],
} = {}) {
  let client;
  let transport;

  return {
    allowedToolNames: [...allowedToolNames],

    async start() {
      if (!targetUrl) throw new Error('Chrome DevTools MCP target URL is required');
      if (client) throw new Error('Chrome DevTools MCP client is already started');

      const args = [
        cliPath,
        `--channel=${browser}`,
        `--headless=${headless}`,
        '--categoryExperimentalWebmcp=true',
        '--experimentalStructuredContent=true',
        '--chrome-arg=--enable-features=WebMCP',
      ];
      if (isolated) args.push('--isolated');
      args.push(...extraArgs);

      client = new Client({ name: 'webmcp-browser-benchmark', version: '0.1.0' });
      transport = new StdioClientTransport({
        command,
        args,
        cwd,
        stderr: 'pipe',
      });
      await client.connect(transport);
      const response = await client.callTool({
        name: 'new_page',
        arguments: { url: targetUrl, isolatedContext: isolated ? 'webmcp-benchmark' : undefined },
      });
      return { targetUrl, pageId: findTargetPageId(response, targetUrl), pid: transport.pid };
    },

    async close() {
      if (!client) return;
      await client.close();
      client = undefined;
      transport = undefined;
    },

    async listWebMcpTools(pageId) {
      if (!client) notStarted();
      return client.callTool({ name: 'list_webmcp_tools', arguments: { pageId } });
    },

    async executeWebMcpTool({ pageId, toolName, input = {} } = {}) {
      if (!client) notStarted();
      if (!toolName) throw new Error('WebMCP tool name is required');
      return client.callTool({
        name: 'execute_webmcp_tool',
        arguments: { pageId, toolName, input: JSON.stringify(input) },
      });
    },
  };
}
