export function createSubscriptionLoop({ requestTurn, tools, toolDefinitions, singleUseToolNames = [], maxTurns = 30, now = () => performance.now() } = {}) {
  if (typeof requestTurn !== 'function') throw new Error('subscription loop requires requestTurn');
  return {
    async run({ prompt } = {}) {
      const events = [];
      let sessionId = null;
      let toolResults = [];
      const completedToolCalls = new Map();
      const completedToolNames = new Set();
      const singleUseNames = new Set(singleUseToolNames);
      let rawCliTokens = 0;
      const tokenUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
      const startedAt = now();
      for (let turn = 1; turn <= maxTurns; turn += 1) {
        const requestStartedAt = now();
        const availableToolDefinitions = toolDefinitions.filter((tool) => !singleUseNames.has(tool.name) || !completedToolNames.has(tool.name));
        const result = await requestTurn({ sessionId, prompt, toolDefinitions: availableToolDefinitions, toolResults, turn });
        if (!result?.sessionId) throw new Error('subscription turn did not return a session id');
        sessionId = result.sessionId;
        rawCliTokens += result.rawCliTokens ?? 0;
        for (const key of Object.keys(tokenUsage)) tokenUsage[key] += result.tokenUsage?.[key] ?? 0;
        events.push({ eventType: 'model_request', turn, elapsedMs: now() - requestStartedAt, rawCliTokens: result.rawCliTokens ?? null, tokenUsage: result.tokenUsage ?? null });
        if (result.response?.type === 'final') return { finalText: result.response.finalText, elapsedMs: now() - startedAt, rawCliTokens, tokenUsage, events };
        if (result.response?.type !== 'tool_calls' || result.response.toolCalls.length === 0) throw new Error('subscription turn returned neither final answer nor tool calls');
        toolResults = [];
        for (const call of result.response.toolCalls) {
          const execute = tools[call.name];
          if (typeof execute !== 'function') throw new Error(`subscription selected unavailable tool: ${call.name}`);
          const cacheKey = `${call.name}:${JSON.stringify(call.input)}`;
          const priorSingleUse = singleUseNames.has(call.name) && completedToolNames.has(call.name);
          if (completedToolCalls.has(cacheKey)) {
            const value = completedToolCalls.get(cacheKey);
            events.push({ eventType: 'tool_call_cached', turn, toolCallId: call.id, toolName: call.name, elapsedMs: 0 });
            toolResults.push({ toolCallId: call.id, name: call.name, result: value });
            continue;
          }
          if (priorSingleUse) {
            const priorResult = [...completedToolCalls.entries()]
              .find(([key]) => key.startsWith(`${call.name}:`))?.[1];
            events.push({ eventType: 'tool_call_cached', turn, toolCallId: call.id, toolName: call.name, elapsedMs: 0 });
            toolResults.push({ toolCallId: call.id, name: call.name, result: priorResult });
            continue;
          }
          const toolStartedAt = now();
          const value = await execute(call.input);
          completedToolCalls.set(cacheKey, value);
          completedToolNames.add(call.name);
          events.push({ eventType: 'tool_call', turn, toolCallId: call.id, toolName: call.name, elapsedMs: now() - toolStartedAt });
          toolResults.push({ toolCallId: call.id, name: call.name, result: value });
        }
      }
      throw new Error(`subscription loop exceeded the ${maxTurns} turn limit`);
    },
  };
}
