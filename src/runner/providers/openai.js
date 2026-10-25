const endpoint = 'https://api.openai.com/v1/responses';

function asFunctionTools(toolDefinitions) {
  return toolDefinitions.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));
}

function parseFunctionCalls(output = []) {
  return output
    .filter((item) => item.type === 'function_call')
    .map((item) => ({
      id: item.call_id,
      name: item.name,
      input: JSON.parse(item.arguments || '{}'),
    }));
}

function extractFinalText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return response.output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('') || undefined;
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: usage.input_tokens ?? null,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
  };
}

async function readError(response) {
  const body = await response.text();
  return body || response.statusText;
}

export function createOpenAIProvider({ apiKey, model, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error('OpenAI API key is required');
  if (!model) throw new Error('OpenAI model is required');
  if (typeof fetchImpl !== 'function') throw new Error('OpenAI provider requires fetch');

  let history = [];
  let lastOutput = [];

  return {
    provider: 'openai',
    model,
    async complete({ prompt, toolDefinitions, toolResults = [] } = {}) {
      if (history.length === 0) history.push({ role: 'user', content: prompt });
      if (toolResults.length > 0) {
        history.push(...lastOutput, ...toolResults.map((toolResult) => ({
          type: 'function_call_output',
          call_id: toolResult.toolCallId,
          output: JSON.stringify(toolResult.result ?? null),
        })));
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: history,
          tools: asFunctionTools(toolDefinitions),
          tool_choice: 'auto',
          parallel_tool_calls: false,
          store: false,
        }),
      });
      if (!response.ok) throw new Error(`OpenAI Responses API failed: ${response.status} ${await readError(response)}`);

      const body = await response.json();
      lastOutput = body.output ?? [];
      return {
        toolCalls: parseFunctionCalls(lastOutput),
        finalText: extractFinalText(body),
        usage: normalizeUsage(body.usage),
        providerRequestId: body.id ?? null,
        returnedModelId: body.model ?? null,
      };
    },
  };
}
