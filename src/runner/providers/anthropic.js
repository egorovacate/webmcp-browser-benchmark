const endpoint = 'https://api.anthropic.com/v1/messages';

function asAnthropicTools(toolDefinitions) {
  return toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: usage.input_tokens ?? null,
    cachedInputTokens: usage.cache_read_input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    reasoningTokens: usage.output_tokens_details?.thinking_tokens ?? null,
    totalTokens: null,
  };
}

async function readError(response) {
  const body = await response.text();
  return body || response.statusText;
}

export function createAnthropicProvider({ apiKey, model, fetchImpl = globalThis.fetch, maxTokens = 4096 } = {}) {
  if (!apiKey) throw new Error('Anthropic API key is required');
  if (!model) throw new Error('Anthropic model is required');
  if (typeof fetchImpl !== 'function') throw new Error('Anthropic provider requires fetch');

  const messages = [];
  let lastAssistantContent = [];

  return {
    provider: 'anthropic',
    model,
    async complete({ prompt, toolDefinitions, toolResults = [] } = {}) {
      if (messages.length === 0) messages.push({ role: 'user', content: prompt });
      if (toolResults.length > 0) {
        messages.push({ role: 'assistant', content: lastAssistantContent });
        messages.push({
          role: 'user',
          content: toolResults.map((toolResult) => ({
            type: 'tool_result',
            tool_use_id: toolResult.toolCallId,
            content: JSON.stringify(toolResult.result),
          })),
        });
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages,
          tools: asAnthropicTools(toolDefinitions),
        }),
      });
      if (!response.ok) throw new Error(`Anthropic Messages API failed: ${response.status} ${await readError(response)}`);

      const body = await response.json();
      lastAssistantContent = body.content ?? [];
      return {
        toolCalls: lastAssistantContent
          .filter((block) => block.type === 'tool_use')
          .map((block) => ({ id: block.id, name: block.name, input: block.input })),
        finalText: lastAssistantContent
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('') || undefined,
        usage: normalizeUsage(body.usage),
        providerRequestId: body.id ?? null,
        returnedModelId: body.model ?? null,
      };
    },
  };
}
