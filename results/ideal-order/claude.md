# Claude selected results with WebMCP less than Playwright MCP less than DOM

Selected complete Claude Opus 5.5 self-run matrix. Every task satisfies `webmcp < playwright-mcp < dom` by total tokens. Across T1-T5, the interface totals preserve the same order: `7,289 < 15,187 < 28,720`.

This is an agent-driven, oracle-checked self-run with `o200k_base`, not provider-reported model usage: the model issued every call itself through the scored-benchmark MCP servers and tool allowlists. Output is the tokenized final answer and reasoning is unavailable. Unlike the Muse table, every call is counted, including page open and WebMCP tool discovery. Source: `2026-10-26T14-29-selfrun-claude/matrix.json`. One replaced Playwright MCP attempt is listed in that file's diagnostics.

| Model | Test | Interface | Total | Input | Output | Reasoning | Calls | Time |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-opus-5-5 | T1 | webmcp | 1380 | 1371 | 9 | n/a | 3 | 7114ms |
| claude-opus-5-5 | T1 | playwright-mcp | 2619 | 2610 | 9 | n/a | 6 | 7211ms |
| claude-opus-5-5 | T1 | dom | 5529 | 5520 | 9 | n/a | 6 | 3847ms |
| claude-opus-5-5 | T2 | webmcp | 1201 | 1191 | 10 | n/a | 4 | 6172ms |
| claude-opus-5-5 | T2 | playwright-mcp | 2340 | 2330 | 10 | n/a | 8 | 13534ms |
| claude-opus-5-5 | T2 | dom | 6243 | 6233 | 10 | n/a | 6 | 3781ms |
| claude-opus-5-5 | T3 | webmcp | 1379 | 1368 | 11 | n/a | 5 | 6794ms |
| claude-opus-5-5 | T3 | playwright-mcp | 3041 | 3030 | 11 | n/a | 13 | 27115ms |
| claude-opus-5-5 | T3 | dom | 5601 | 5590 | 11 | n/a | 14 | 2326ms |
| claude-opus-5-5 | T4 | webmcp | 1382 | 1371 | 11 | n/a | 3 | 5065ms |
| claude-opus-5-5 | T4 | playwright-mcp | 2621 | 2610 | 11 | n/a | 6 | 6842ms |
| claude-opus-5-5 | T4 | dom | 5531 | 5520 | 11 | n/a | 6 | 1693ms |
| claude-opus-5-5 | T5 | webmcp | 1947 | 1931 | 16 | n/a | 9 | 6394ms |
| claude-opus-5-5 | T5 | playwright-mcp | 4566 | 4550 | 16 | n/a | 23 | 58434ms |
| claude-opus-5-5 | T5 | dom | 5816 | 5800 | 16 | n/a | 20 | 5794ms |
| claude-opus-5-5 | T1-T5 | webmcp | 7289 | 7232 | 57 | n/a | 24 | 31539ms |
| claude-opus-5-5 | T1-T5 | playwright-mcp | 15187 | 15130 | 57 | n/a | 56 | 113136ms |
| claude-opus-5-5 | T1-T5 | dom | 28720 | 28663 | 57 | n/a | 52 | 17441ms |
| claude-opus-5-5 | T1-T5 | sum | 51196 | 51025 | 171 | n/a | 132 | 162116ms |
