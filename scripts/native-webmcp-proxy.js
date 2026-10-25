import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createChromeDevToolsMcpClient } from '../src/runner/chrome-devtools-mcp-client.js';

const targetUrl = process.argv[2];
if (!targetUrl) throw new Error('native WebMCP proxy requires a target URL');

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

const session = await client.start();
const listed = await client.listWebMcpTools(session.pageId);
const tools = listed?.structuredContent?.webmcpTools ?? [];
const expectedToolNames = ['search_products', 'get_product', 'set_cart_item', 'get_cart', 'place_test_order'];
if (!Array.isArray(tools) || tools.length !== expectedToolNames.length ||
  !expectedToolNames.every((name) => tools.some((tool) => tool.name === name))) {
  await client.close();
  throw new Error('native WebMCP proxy did not find the exact benchmark page tool set');
}
const allowed = new Set(tools.map((tool) => tool.name));

const server = new Server(
  { name: 'native-webmcp-page-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input = {} } = request.params;
  if (!allowed.has(name)) throw new Error(`unknown WebMCP page tool: ${name}`);
  const result = await client.executeWebMcpTool({ pageId: session.pageId, toolName: name, input });
  return result;
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
