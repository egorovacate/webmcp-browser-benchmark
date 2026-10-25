function parseJsonLines(stdout) {
  return stdout.split('\n').flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function parseSessionId(stdout, rows) {
  const jsonId = rows.find((row) => row.type === 'thread.started')?.thread_id;
  if (typeof jsonId === 'string') return jsonId;
  const textId = stdout.match(/session id:\s*([^\s]+)/i)?.[1];
  if (textId) return textId;
  throw new Error('Codex turn did not report a session id');
}

function parseTokenUsage(stdout, rows) {
  const usage = rows.find((row) => row.type === 'turn.completed')?.usage;
  if (usage) return {
    inputTokens: usage.input_tokens ?? 0,
    cachedInputTokens: usage.cached_input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    reasoningOutputTokens: usage.reasoning_output_tokens ?? 0,
  };
  const total = stdout.match(/tokens used\s*\n\s*([\d,]+)/i)?.[1];
  return {
    inputTokens: total ? Number(total.replaceAll(',', '')) : 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  };
}

function normalizeToolCalls(toolCalls) {
  return toolCalls.map((toolCall) => {
    if (!toolCall || typeof toolCall.id !== 'string' || typeof toolCall.name !== 'string' || typeof toolCall.inputJson !== 'string') {
      throw new Error('Codex turn returned an invalid tool call');
    }
    let input;
    try { input = JSON.parse(toolCall.inputJson); } catch { throw new Error('Codex turn returned invalid tool input JSON'); }
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Codex turn returned a non-object tool input');
    return { id: toolCall.id, name: toolCall.name, input };
  });
}

export function parseCodexSubscriptionTurn({ stdout = '', lastMessage = '', fallbackSessionId = null } = {}) {
  if (/\nexec\n/i.test(stdout)) throw new Error('Codex turn used shell access outside the benchmark tool contract');
  let response;
  try { response = JSON.parse(lastMessage); } catch { throw new Error('Codex turn did not return a JSON response'); }
  if (!response || !['tool_calls', 'final'].includes(response.type) || !Array.isArray(response.toolCalls) || typeof response.finalText !== 'string') {
    throw new Error('Codex turn returned an invalid response shape');
  }
  const rows = parseJsonLines(stdout);
  const tokenUsage = parseTokenUsage(stdout, rows);
  return {
    sessionId: fallbackSessionId ?? parseSessionId(stdout, rows),
    rawCliTokens: tokenUsage.inputTokens + tokenUsage.outputTokens,
    tokenUsage,
    response: { ...response, toolCalls: normalizeToolCalls(response.toolCalls) },
  };
}
