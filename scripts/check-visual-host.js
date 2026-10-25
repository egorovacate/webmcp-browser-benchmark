import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createBenchmarkServer } from '../src/server/server.js';

const path = '/Users/shmakovdima/.codex/plugins/cache/openai-bundled/unified-computer-use/26.908.40834/.mcp.json';
const config = JSON.parse(await readFile(path, 'utf8')).mcpServers.cua_repl;
const app = await createBenchmarkServer();
const client = new Client({ name: 't1-browser-preflight', version: '1' });
try {
  await client.connect(new StdioClientTransport({
    command: config.command, args: config.args, stderr: 'pipe',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...config.env, CUA_REPL_ENABLED_SURFACES: 'browser' },
  }));
  const listed = await client.listTools();
  console.log('Native tools:', listed.tools.map(t => t.name).join(', '));
  const result = await client.callTool({ name: 'js', arguments: {
    code: `let tab = await cua.createBrowserTab("chrome", ${JSON.stringify(app.url)}, {sessionName: "🔎 T1 preflight"});`,
    title: 'Check native browser DOM access',
  } });
  for (const part of result.content ?? []) if (part.type === 'text') console.log(part.text);
  if (result.isError) throw new Error('Native visual host preflight failed');
} finally { await client.close(); await app.close(); }
