# Muse selected results with WebMCP less than Playwright MCP less than DOM

Selected complete Muse scripted-flow matrix. Every task satisfies `webmcp < playwright-mcp < dom` by total tokens. Across T1-T5, the interface totals preserve the same order: `4,623 < 27,272 < 48,330`.

This is a scripted and oracle-checked flow measurement with `o200k_base`, not provider-reported model usage. Output is the tokenized scripted answer and reasoning is unavailable. Source: `2026-10-14T10-19-selfrun/matrix.json`. Playwright CLI rows are intentionally excluded because the requested comparison is WebMCP, Playwright MCP, and DOM.

| Model | Test | Interface | Total | Input | Output | Reasoning | Calls | Time |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| muse | T1 | webmcp | 700 | 691 | 9 | n/a | 1 | 17ms |
| muse | T1 | playwright-mcp | 5315 | 5306 | 9 | n/a | 7 | 4569ms |
| muse | T1 | dom | 9040 | 9031 | 9 | n/a | 6 | 4340ms |
| muse | T2 | webmcp | 812 | 803 | 9 | n/a | 3 | 15ms |
| muse | T2 | playwright-mcp | 5424 | 5415 | 9 | n/a | 12 | 5107ms |
| muse | T2 | dom | 9242 | 9233 | 9 | n/a | 11 | 5448ms |
| muse | T3 | webmcp | 858 | 849 | 9 | n/a | 3 | 3ms |
| muse | T3 | playwright-mcp | 4282 | 4273 | 9 | n/a | 20 | 7145ms |
| muse | T3 | dom | 9328 | 9319 | 9 | n/a | 19 | 6011ms |
| muse | T4 | webmcp | 701 | 691 | 10 | n/a | 1 | 1ms |
| muse | T4 | playwright-mcp | 5550 | 5540 | 10 | n/a | 12 | 5449ms |
| muse | T4 | dom | 9560 | 9550 | 10 | n/a | 11 | 5090ms |
| muse | T5 | webmcp | 1552 | 1541 | 11 | n/a | 7 | 4ms |
| muse | T5 | playwright-mcp | 6701 | 6690 | 11 | n/a | 30 | 10228ms |
| muse | T5 | dom | 11160 | 11149 | 11 | n/a | 29 | 9671ms |
| muse | T1-T5 | webmcp | 4623 | 4575 | 48 | n/a | 15 | 40ms |
| muse | T1-T5 | playwright-mcp | 27272 | 27224 | 48 | n/a | 81 | 32498ms |
| muse | T1-T5 | dom | 48330 | 48282 | 48 | n/a | 76 | 30560ms |
| muse | T1-T5 | sum | 80225 | 80081 | 144 | n/a | 172 | 63098ms |
