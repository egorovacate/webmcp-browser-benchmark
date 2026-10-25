import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createDomRuntime } from '../src/runner/runtimes/dom.js';

const runtime = await createDomRuntime({ targetUrl: process.argv[2] });
const tools = runtime.toolDefinitions;
const server = new Server({ name: 'rendered-dom-browser', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  try {
    if (!tools.some((tool) => tool.name === params.name)) throw new Error(`Unknown DOM tool: ${params.name}`);
    const result = await runtime.tools[params.name](params.arguments ?? {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await runtime.close();
  await server.close();
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
process.stdin.once('end', close);
await server.connect(new StdioServerTransport());
