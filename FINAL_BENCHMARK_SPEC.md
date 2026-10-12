# Final browser benchmark specification

## Current execution scope (2026-10-10)

The current request supersedes the full-matrix publication gate below: execute only T1 on `gpt-5.6-terra`, once through each of WebMCP, Playwright MCP, and the rendered-DOM interface. Only three successful, validated T1 measurements constitute a complete comparison for this scope. Failed connection attempts are diagnostic spend and must never occupy a comparison row. If any mode is unavailable, suppress the comparison table. Do not run T2-T5 automatically.

The supported command is `bun run benchmark T1`. Reports include all attempts, including failed attempts, and preserve raw usage. Missing optional reasoning usage is unknown, not zero. Model request count is not inferred from tool calls. The current DOM implementation is `rendered-dom-v1`: generic visible-HTML observations and CSS-selector interactions in isolated headless Chrome at 1440x900. Playwright drives the browser internally, without exposing Playwright MCP or AX snapshots. It is not native Codex CUA. This clarification supersedes the historical native-only DOM requirement below.

## 1. Objective

Measure the real token usage and completion time of the same Codex subscription model while it completes the same five browser tasks through three different interfaces:

- `webmcp`
- `playwright-mcp`
- `visual`

The final benchmark contains 15 completed cells: 5 tasks x 3 modes. A partial matrix is not a benchmark result.

## 2. Model and authentication

- Runner: Codex subscription only.
- Model: `gpt-5.6-terra`.
- OpenAI API calls are forbidden.
- API keys are forbidden.
- Every attempt starts as a new ephemeral Codex thread.
- A thread must not inherit the current conversation, a previous benchmark thread, repository instructions, user instructions, skills, memories, MCP configuration, or project context.
- The exact Codex CLI version and requested model ID are stored in the manifest.

## 3. Frozen test matrix

The task prompts and expected results come only from `fixtures/tasks.json`.

| Task | Required result |
| --- | --- |
| T1 | Find Sonic Lite ANC at $129.00 without changing cart or orders. |
| T2 | Put two black Sonic Lite ANC units in the cart, subtotal $258.00, without ordering. |
| T3 | Place one test order for one black Sonic Lite ANC, order `order-0001`, total $134.00. |
| T4 | Report Sonic Lite ANC as the cheaper eligible product and a $20.00 difference, without changing state. |
| T5 | Leave only two black Sonic Lite ANC units, remove the keyboard, place order `order-0001`, one final line, total $263.00. |

Each mode receives the exact task prompt from the fixture. No mode-specific explanation, hint, answer, plan, or hidden prompt may be added.

## 4. Shared environment

Every attempt uses:

- the same store build and catalog fixture;
- viewport `1440x900`;
- a fresh isolated browser context;
- a fresh store reset before the model starts;
- the same task prompt;
- the same maximum task time of 300 seconds;
- the same maximum of 30 model turns;
- no access to repository files, shell, source code, backend APIs, test fixtures, or oracle state.

Store startup, browser startup, reset, and oracle validation happen outside the measured model interval.

## 5. Native mode contracts

### 5.1 WebMCP

The model receives only the five tools registered by the page through `document.modelContext`:

- `search_products`
- `get_product`
- `set_cart_item`
- `get_cart`
- `place_test_order`

Tool discovery and execution must go through the browser's native WebMCP host. The runner must not call the store API, import the page handlers, read the DOM, use accessibility snapshots, use screenshots, or synthesize a tool result.

### 5.2 Playwright MCP

The model receives the native tools from the official `@playwright/mcp` server required for navigation, accessibility snapshots, element-reference clicks, typing, dropdown selection, form filling, snapshot search, and key presses. Non-contract tools of the official server are hidden by a transparent capability filter (`scripts/playwright-mcp-proxy.js`) so they never enter model context; the filter passes tool schemas and results through byte-identical and implements no task logic.

WebMCP, screenshots, direct DOM evaluation, store APIs, repository files, and shell access are forbidden.

### 5.3 Visual

The model operates the ordinary rendered page through the native browser DOM interaction surface used by Codex: current DOM observation plus click, type, key press, and scroll actions.

WebMCP, Playwright MCP, screenshots, accessibility snapshots, coordinates, store APIs, repository files, and shell access are forbidden.

`visual` must never return the complete serialized HTML document. Its observation is the browser's current compact DOM representation of visible and interactive page content.

## 6. No benchmark wrappers

A transport adapter may only connect the native interface to Codex and record events. It must be a transparent pass-through.

The adapter must not:

- rename, add, remove, or rewrite native tool schemas;
- trim, expand, duplicate, summarize, or otherwise rewrite tool results;
- inject prompts or instructions;
- execute task logic itself;
- calculate an answer outside the model;
- reuse a prior tool result;
- fall back to another interface;
- subtract a baseline from usage;
- estimate, tokenize, normalize, scale, or invent token values.

The files `native-webmcp-proxy.js`, `visual-mcp-proxy.js`, and `run-direct-webmcp-t1.js` are not valid execution paths for the final benchmark. `scripts/playwright-mcp-proxy.js` is the valid Playwright MCP transport: an exact-subset capability filter with no schema or result rewriting.

## 7. Token accounting

Token counts come only from the final provider-reported usage object emitted by the scored Codex thread. The raw object is saved unchanged before any derived values are calculated.

Required fields per completed attempt:

- `inputTokens`: provider `input_tokens`;
- `cachedInputTokens`: provider `cached_input_tokens`;
- `uncachedInputTokens`: `inputTokens - cachedInputTokens`;
- `outputTokens`: provider `output_tokens`;
- `reasoningTokens`: provider `reasoning_output_tokens`;
- `visibleOutputTokens`: `outputTokens - reasoningTokens`;
- `totalTokens`: `inputTokens + outputTokens`.

`cachedInputTokens` is a subset of `inputTokens`. `reasoningTokens` is a subset of `outputTokens`. Neither subset is added to `totalTokens` a second time.

This follows the official OpenAI usage definition: cached tokens are included in input tokens, and reasoning tokens are included in output tokens. Reference: https://developers.openai.com/api/docs/guides/agents-api/observability

No baseline run and no baseline subtraction are allowed. The benchmark reports the tokens actually processed by the scored thread, including the native tool schemas and tool results required by that mode.

If any required provider usage field is missing, negative, inconsistent, or not attached to the scored thread, the attempt is invalid and cannot enter the final table.

## 8. Timing

`taskCompletionMs` starts immediately before the first model request and ends when the model emits its final answer.

It includes:

- model inference;
- native tool calls;
- browser actions;
- tool-result round trips.

It excludes:

- store startup;
- browser startup;
- fixture reset;
- post-run oracle validation;
- writing result files.

Timing uses a monotonic clock.

## 9. Valid completed attempt

An attempt is `completed` only when all conditions are true:

1. The requested model is `gpt-5.6-terra` through the Codex subscription.
2. The attempt started in a clean ephemeral thread.
3. Only the allowed native interface was exposed.
4. At least one real browser or WebMCP action occurred.
5. No forbidden capability, fallback, direct API call, or task-specific runner logic occurred.
6. The process exited normally.
7. The backend-state oracle passed.
8. The final-answer oracle passed.
9. Every required raw usage field is present and internally consistent.
10. The complete event trace and manifest were written.

A correct final sentence without a valid browser trace is a failure. A correct browser state with a wrong final sentence is also a failure.

## 10. Failure policy

- Failed, timed-out, interrupted, contaminated, or incomplete attempts never appear as benchmark rows.
- Failed attempts remain in a separate diagnostics directory for audit and are never relabeled as completed.
- There is no retry inside a scored attempt.
- A replacement attempt starts from a new store, browser context, and Codex thread.
- The final matrix is not published until all 15 cells contain a valid completed attempt.
- No value may be copied from an older run, estimated from another mode, or manually edited into the result table.

## 11. Required artifacts

Each completed attempt stores:

- `manifest.json`
- `events.jsonl`
- `summary.json`

`summary.json` must contain:

```json
{
  "status": "completed",
  "mode": "webmcp | playwright-mcp | visual",
  "taskId": "T1 | T2 | T3 | T4 | T5",
  "model": "gpt-5.6-terra",
  "inputTokens": 0,
  "cachedInputTokens": 0,
  "uncachedInputTokens": 0,
  "outputTokens": 0,
  "reasoningTokens": 0,
  "visibleOutputTokens": 0,
  "totalTokens": 0,
  "taskCompletionMs": 0,
  "modelRequestCount": 0,
  "toolCallCount": 0,
  "oraclePassed": true,
  "finalAnswerPassed": true
}
```

The zeroes above describe the schema only. A completed result with zero model requests or zero token usage is invalid.

## 12. Final tables

The detailed table contains exactly 15 completed rows:

| Mode | Task | Input | Cached input | Uncached input | Output | Reasoning | Visible output | Total | Time | Model requests | Tool calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |

The totals table contains exactly three rows:

| Mode | Completed tasks | Input total | Cached input total | Uncached input total | Output total | Reasoning total | Visible output total | Token total | Time total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |

For every mode, `Completed tasks` must equal 5. The grand total is the sum of the three mode totals.

## 13. Publication gate

Before reporting numbers, the result validator must prove:

- 15 of 15 attempts are `completed`;
- every task has one row for each mode;
- every row uses the same model and frozen task prompt;
- every row passes both oracles;
- every row contains provider-reported token usage;
- token subset and total equations are correct;
- no forbidden capability appears in any trace;
- no proxy, direct runner, baseline, or hand-edited result was used.

If any check fails, the only valid status is `benchmark incomplete`. No token comparison is reported as final.

## 14. Source of truth

This file is the acceptance specification for the final benchmark. It supersedes earlier experimental subscription scripts and all existing result tables. Existing results are diagnostic history only and must not be presented as final benchmark data.
