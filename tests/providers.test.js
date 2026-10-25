import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider } from '../src/runner/providers/openai.js';
import { createAnthropicProvider } from '../src/runner/providers/anthropic.js';

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

const toolDefinitions = [{
  name: 'search_products',
  description: 'Find products.',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
}];

test('OpenAI provider sends tool schemas and normalizes a function call with reported usage', async () => {
  const requests = [];
  const provider = createOpenAIProvider({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return jsonResponse({
        id: 'resp_1',
        output: [{ type: 'function_call', call_id: 'call_1', name: 'search_products', arguments: '{"query":"Sonic"}' }],
        usage: {
          input_tokens: 101,
          output_tokens: 17,
          total_tokens: 118,
          input_tokens_details: { cached_tokens: 20 },
          output_tokens_details: { reasoning_tokens: 7 },
        },
      });
    },
  });

  const result = await provider.complete({ prompt: 'Find headphones.', toolDefinitions, toolResults: [] });

  assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
  assert.deepEqual(requests[0].body.tools, [{
    type: 'function',
    name: 'search_products',
    description: 'Find products.',
    parameters: toolDefinitions[0].inputSchema,
  }]);
  assert.deepEqual(result.toolCalls, [{ id: 'call_1', name: 'search_products', input: { query: 'Sonic' } }]);
  assert.deepEqual(result.usage, {
    inputTokens: 101,
    cachedInputTokens: 20,
    outputTokens: 17,
    reasoningTokens: 7,
    totalTokens: 118,
  });
});

test('OpenAI provider returns tool output to the next stateless Responses request', async () => {
  const requests = [];
  const responseQueue = [
    { id: 'resp_1', output: [{ type: 'function_call', call_id: 'call_1', name: 'search_products', arguments: '{}' }], usage: {} },
    { id: 'resp_2', output_text: 'Sonic Lite ANC costs $129.00.', output: [], usage: {} },
  ];
  const provider = createOpenAIProvider({
    apiKey: 'test-key', model: 'test-model',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return jsonResponse(responseQueue.shift());
    },
  });

  await provider.complete({ prompt: 'Find headphones.', toolDefinitions, toolResults: [] });
  const result = await provider.complete({
    prompt: 'Find headphones.',
    toolDefinitions,
    toolResults: [{ toolCallId: 'call_1', name: 'search_products', result: { products: [] } }],
  });

  assert.equal(result.finalText, 'Sonic Lite ANC costs $129.00.');
  assert.deepEqual(requests[1].input.at(-1), {
    type: 'function_call_output',
    call_id: 'call_1',
    output: '{"products":[]}',
  });
});

test('OpenAI provider sends null output for a tool with no return value', async () => {
  const requests = [];
  const responses = [
    { id: 'resp_1', output: [{ type: 'function_call', call_id: 'call_1', name: 'coordinate_click', arguments: '{}' }], usage: {} },
    { id: 'resp_2', output_text: 'Done.', output: [], usage: {} },
  ];
  const provider = createOpenAIProvider({
    apiKey: 'test-key', model: 'test-model',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return jsonResponse(responses.shift());
    },
  });

  await provider.complete({ prompt: 'Click the page.', toolDefinitions: [{ name: 'coordinate_click', inputSchema: { type: 'object' } }], toolResults: [] });
  await provider.complete({
    prompt: 'Click the page.',
    toolDefinitions: [{ name: 'coordinate_click', inputSchema: { type: 'object' } }],
    toolResults: [{ toolCallId: 'call_1', name: 'coordinate_click', result: undefined }],
  });

  assert.deepEqual(requests[1].input.at(-1), {
    type: 'function_call_output',
    call_id: 'call_1',
    output: 'null',
  });
});

test('OpenAI provider sends visual DOM output back as structured tool output', async () => {
  const requests = [];
  const responses = [
    { id: 'resp_1', output: [{ type: 'function_call', call_id: 'call_1', name: 'dom', arguments: '{}' }], usage: {} },
    { id: 'resp_2', output_text: 'I can inspect the store.', output: [], usage: {} },
  ];
  const provider = createOpenAIProvider({
    apiKey: 'test-key', model: 'test-model',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return jsonResponse(responses.shift());
    },
  });

  await provider.complete({ prompt: 'Inspect the page.', toolDefinitions: [{ name: 'dom', inputSchema: { type: 'object' } }], toolResults: [] });
  await provider.complete({
    prompt: 'Inspect the page.',
    toolDefinitions: [{ name: 'dom', inputSchema: { type: 'object' } }],
    toolResults: [{ toolCallId: 'call_1', name: 'dom', result: { html: '<button id="go">Go</button>' } }],
  });

  assert.deepEqual(requests[1].input.at(-1), {
    type: 'function_call_output',
    call_id: 'call_1',
    output: '{"html":"<button id=\\"go\\">Go</button>"}',
  });
});

test('Anthropic provider sends tool schemas and preserves its reported token fields', async () => {
  const requests = [];
  const provider = createAnthropicProvider({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return jsonResponse({
        id: 'msg_1',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'search_products', input: { query: 'Sonic' } }],
        usage: {
          input_tokens: 90,
          cache_read_input_tokens: 10,
          output_tokens: 14,
          output_tokens_details: { thinking_tokens: 5 },
        },
      });
    },
  });

  const result = await provider.complete({ prompt: 'Find headphones.', toolDefinitions, toolResults: [] });

  assert.equal(requests[0].url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(requests[0].body.tools, [{
    name: 'search_products',
    description: 'Find products.',
    input_schema: toolDefinitions[0].inputSchema,
  }]);
  assert.deepEqual(result.toolCalls, [{ id: 'toolu_1', name: 'search_products', input: { query: 'Sonic' } }]);
  assert.deepEqual(result.usage, {
    inputTokens: 90,
    cachedInputTokens: 10,
    outputTokens: 14,
    reasoningTokens: 5,
    totalTokens: null,
  });
});
