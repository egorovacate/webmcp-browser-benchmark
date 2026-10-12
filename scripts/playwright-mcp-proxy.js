import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createPlaywrightMcpClient } from '../src/runner/playwright-mcp-client.js';

const targetUrl = process.argv[2];
if (!targetUrl) throw new Error('Playwright MCP proxy requires a target URL');
const extraArgs = process.argv.slice(3);

const allowedNames = ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type', 'browser_select_option', 'browser_fill_form', 'browser_find', 'browser_press_key'];
const client = createPlaywrightMcpClient({ targetUrl, headless: true, isolated: true, noWebMcp: true, extraArgs });
await client.start();
const listed = await client.listTools({ allowedToolNames: allowedNames });
const tools = listed.tools ?? [];
const allowed = new Set(tools.map((tool) => tool.name));

const server = new Server(
  { name: 'playwright-browser-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input = {} } = request.params;
  if (!allowed.has(name)) throw new Error(`tool is not allowed in playwright mode: ${name}`);
  return client.callTool(name, input);
});

const transport = new StdioServerTransport();
await server.connect(transport);
const close = async () => {
  await client.close();
  process.exit(0);
};
process.once('SIGTERM', close);
process.once('SIGINT', close);
process.stdin.once('end', close);
