import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chromium } from '@playwright/test';

const targetUrl = process.argv[2];
if (!targetUrl) throw new Error('Visual MCP proxy requires a target URL');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(targetUrl);

const tools = [
  { name: 'dom', description: 'Return the current page DOM as HTML.', inputSchema: { type: 'object' } },
  { name: 'click', description: 'Click a page element using a CSS selector.', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'type', description: 'Fill a page input using a CSS selector.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] } },
  { name: 'press', description: 'Press a key on a page element using a CSS selector.', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, key: { type: 'string' } }, required: ['selector', 'key'] } },
  { name: 'scroll', description: 'Scroll the page by pixel deltas.', inputSchema: { type: 'object', properties: { deltaX: { type: 'number' }, deltaY: { type: 'number' } }, required: ['deltaY'] } },
];
const allowed = new Set(tools.map((tool) => tool.name));

const server = new Server(
  { name: 'visual-dom-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input = {} } = request.params;
  if (!allowed.has(name)) throw new Error(`tool is not allowed in visual mode: ${name}`);
  let value;
  if (name === 'dom') value = { html: await page.content() };
  if (name === 'click') await page.locator(input.selector).click();
  if (name === 'type') await page.locator(input.selector).fill(input.text);
  if (name === 'press') await page.locator(input.selector).press(input.key);
  if (name === 'scroll') await page.mouse.wheel(input.deltaX ?? 0, input.deltaY);
  return { content: [{ type: 'text', text: JSON.stringify(value ?? { ok: true }) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
const close = async () => {
  await page.close();
  await browser.close();
  process.exit(0);
};
process.once('SIGTERM', close);
process.once('SIGINT', close);
process.stdin.once('end', close);
