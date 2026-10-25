import { mkdtemp, readdir, readFile, symlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export async function loadNativeCuaConfig() {
  const root = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'plugins/cache/openai-bundled/unified-computer-use');
  const versions = await readdir(root).catch(() => []);
  const paths = process.env.BENCHMARK_CUA_CONFIG
    ? [process.env.BENCHMARK_CUA_CONFIG]
    : versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((version) => join(root, version, '.mcp.json'));
  for (const path of paths) {
    const config = JSON.parse(await readFile(path, 'utf8')).mcpServers?.cua_repl;
    if (config) return config;
  }
  throw new Error('Native Codex CUA plugin unavailable. Set BENCHMARK_CUA_CONFIG to its .mcp.json. DOM mode cannot fall back to Playwright.');
}

export function codexMcpArgs(config) {
  const prefix = `mcp_servers.${config.serverName}`;
  const values = {
    enabled: true,
    command: config.command,
    args: config.commandArgs,
    cwd: config.cwd,
    enabled_tools: config.enabledTools,
    required: true,
    startup_timeout_sec: 120,
    tool_timeout_sec: 120,
  };
  const args = [
    '-c', 'mcp_optional_startup_grace_ms=0',
    ...Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .flatMap(([key, value]) => ['-c', `${prefix}.${key}=${JSON.stringify(value)}`]),
  ];
  for (const [key, value] of Object.entries(config.env ?? {})) args.push('-c', `${prefix}.env.${key}=${JSON.stringify(value)}`);
  return args;
}

export function cleanEnvironment(source = process.env) {
  return Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL']
    .filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

export async function prepareCodex() {
  const env = cleanEnvironment();
  const sourceHome = process.env.CODEX_HOME ?? join(homedir(), '.codex');
  const auth = JSON.parse(await readFile(join(sourceHome, 'auth.json'), 'utf8'));
  if (auth.auth_mode !== 'chatgpt') throw new Error('Benchmark requires Codex ChatGPT login; API-key authentication is not allowed.');
  const home = await mkdtemp(join(tmpdir(), 'browser-benchmark-codex-'));
  // Isolate rules, skills, MCPs and history without copying credentials into the repository.
  await symlink(join(sourceHome, 'auth.json'), join(home, 'auth.json'));
  env.CODEX_HOME = home;
  const version = Bun.spawn(['codex', '--version'], { env, stdout: 'pipe', stderr: 'pipe' });
  const text = (await new Response(version.stdout).text()).trim();
  if (await version.exited !== 0) throw new Error('Cannot start Codex CLI');
  return { env, home, version: text };
}

export async function runNativeCodex({ context, model, mcp, prompt, timeoutMs = 300000 }) {
  const disabled = ['shell_tool', 'unified_exec', 'apps', 'plugins', 'memories', 'multi_agent', 'view_image', 'image_generation', 'browser_use', 'computer_use', 'code_mode'];
  const args = ['exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--json',
    '--dangerously-bypass-approvals-and-sandbox', '-m', model, '-C', context.home,
    '-c', 'forced_login_method="chatgpt"', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"',
    ...disabled.flatMap((feature) => ['--disable', feature]), ...codexMcpArgs(mcp), prompt];
  const child = Bun.spawn(['codex', ...args], { cwd: context.home, env: context.env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    const events = stdout.split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
    return { events, stderr, exitCode, timedOut };
  } finally {
    clearTimeout(timer);
  }
}
