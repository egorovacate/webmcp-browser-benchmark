import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanEnvironment, codexMcpArgs } from '../src/runner/native-codex.js';

test('the scored process never inherits API-key or provider override variables', () => {
  assert.deepEqual(cleanEnvironment({ PATH: '/bin', HOME: '/home/test', OPENAI_API_KEY: 'fixture', OPENAI_BASE_URL: 'http://wrong-provider', CODEX_HOME: '/old-context', ANTHROPIC_API_KEY: 'fixture', BENCHMARK_API_KEY: 'fixture' }), { PATH: '/bin', HOME: '/home/test' });
});

test('native MCP is required and Codex waits for its complete tool catalog', () => {
  const args = codexMcpArgs({
    serverName: 'cua_repl',
    command: '/native/node',
    commandArgs: ['/native/cua-repl.mjs'],
    enabledTools: ['js'],
    cwd: '/benchmark',
    env: { CUA_REPL_ENABLED_SURFACES: 'browser' },
  });
  assert.ok(args.includes('mcp_optional_startup_grace_ms=0'));
  assert.ok(args.includes('mcp_servers.cua_repl.command="/native/node"'));
  assert.ok(args.includes('mcp_servers.cua_repl.cwd="/benchmark"'));
  assert.ok(args.includes('mcp_servers.cua_repl.required=true'));
  assert.ok(args.includes('mcp_servers.cua_repl.env.CUA_REPL_ENABLED_SURFACES="browser"'));
});
