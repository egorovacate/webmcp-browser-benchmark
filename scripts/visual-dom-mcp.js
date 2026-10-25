import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createVisualRuntime } from '../src/runner/runtimes/visual.js';

const targetUrl = process.argv[2];
if (!targetUrl) throw new Error('usage: node scripts/visual-dom-mcp.js http://127.0.0.1:PORT');

const runtime = await createVisualRuntime({ targetUrl });
const server = new McpServer({ name: 'benchmark-visual-dom', version: '1.0.0' });
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

server.registerTool('dom', { description: 'Return current DOM HTML.', inputSchema: {} }, async () => text(await runtime.tools.dom()));
server.registerTool('click', {
  description: 'Click an element by CSS selector.',
  inputSchema: { selector: z.string() },
}, async ({ selector }) => { await runtime.tools.click({ selector }); return text({ ok: true }); });
server.registerTool('type', {
  description: 'Fill an input by CSS selector.',
  inputSchema: { selector: z.string(), text: z.string() },
}, async ({ selector, text: value }) => { await runtime.tools.type({ selector, text: value }); return text({ ok: true }); });
server.registerTool('press', {
  description: 'Press a key on an element selected by CSS.',
  inputSchema: { selector: z.string(), key: z.string() },
}, async ({ selector, key }) => { await runtime.tools.press({ selector, key }); return text({ ok: true }); });
server.registerTool('scroll', {
  description: 'Scroll the DOM viewport.',
  inputSchema: { deltaY: z.number(), deltaX: z.number().optional() },
}, async ({ deltaY, deltaX = 0 }) => { await runtime.tools.scroll({ deltaY, deltaX }); return text({ ok: true }); });

const close = async () => { await runtime.close(); await server.close(); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
await server.connect(new StdioServerTransport());
