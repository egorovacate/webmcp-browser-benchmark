function responseText(response) {
  return response?.content
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n') ?? '';
}

function parseToolResult(response) {
  const text = responseText(response).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function createWebMcpRuntime({ client } = {}) {
  if (!client || typeof client.start !== 'function') throw new Error('WebMCP runtime requires a Chrome DevTools MCP client');
  const session = await client.start();
  const listed = await client.listWebMcpTools(session.pageId);
  const toolDefinitions = listed?.structuredContent?.webmcpTools;
  if (!Array.isArray(toolDefinitions) || toolDefinitions.length === 0) {
    throw new Error('Chrome DevTools MCP did not discover WebMCP tools on the page');
  }

  const tools = Object.fromEntries(toolDefinitions.map((tool) => [
    tool.name,
    async (input) => parseToolResult(await client.executeWebMcpTool({
      pageId: session.pageId,
      toolName: tool.name,
      input,
    })),
  ]));

  return {
    toolDefinitions: toolDefinitions.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    tools,
    close: () => client.close(),
  };
}
