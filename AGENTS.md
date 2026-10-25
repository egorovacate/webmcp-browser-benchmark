# Browser benchmark requirements

- User correction, 2026-10-10: failed browser connection attempts are NOT benchmark measurements. Never put their token counts in the WebMCP / Playwright / DOM comparison table.
- A DOM result is valid only after the agent actually reads the page through the measured rendered-DOM tools and completes the requested task. "Chrome unavailable", an empty browser list, or failed tool calls are diagnostics, regardless of whether Codex reports usage.
- Keep diagnostic spend in a separate accounting section. Missing or invalid measurements are unavailable, never zero and never a successful mode's token count.
- Do not present a three-mode comparison until the same task passes in all three modes, with verified browser work, both oracles, and raw Codex usage. Partial successes are not a completed benchmark.
- Raw Codex usage includes the full task context. Never label it as browser-only token consumption. Do not subtract a guessed baseline, estimate token counts, or change values to make one mode cheaper or more expensive.
- Keep input, cached input, and output distinct; cached input is already included in input. Explain the metric before drawing efficiency conclusions.
- Current authorized execution scope: T1 only, gpt-5.6-terra only, through Codex ChatGPT subscription. No API-key calls. Do not change scope without a new user instruction.
- Preserve raw events and invalid attempts for auditing. Never silently retry or reuse historical measurements as fresh results.

- DOM interface clarification, 2026-10-10: the user needs an operational ordinary DOM workflow, not a mandatory desktop-plugin dependency. `rendered-dom-v1` reads visible HTML and uses CSS selectors in isolated Chrome. Playwright is its low-level driver; it does not expose Playwright MCP, AX snapshots or WebMCP. Do not label this interface as native Codex CUA. Record the interface in each result.
