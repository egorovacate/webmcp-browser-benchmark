export async function createPlaywrightMcpRuntime({ client, allowedToolNames } = {}) {
  if (!client || typeof client.start !== 'function') throw new Error('Playwright MCP runtime requires a client');
  if (!Array.isArray(allowedToolNames) || allowedToolNames.length === 0) {
    throw new Error('Playwright MCP runtime requires an explicit tool allowlist');
  }

  await client.start();
  const listed = await client.listTools({ allowedToolNames });
  const allowed = new Set(allowedToolNames);
  const toolDefinitions = listed.tools
    .filter((tool) => allowed.has(tool.name))
    .map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  if (toolDefinitions.length !== allowedToolNames.length) {
    throw new Error('Playwright MCP did not expose every required benchmark tool');
  }

  return {
    toolDefinitions,
    tools: Object.fromEntries(toolDefinitions.map((tool) => [
      tool.name,
      (input) => client.callTool(tool.name, input),
    ])),
    close: () => client.close(),
  };
}
