# Codex selected results with WebMCP less than Playwright MCP less than DOM

Historical selection for `gpt-5.6-terra`. Every T1-T5 row passed both recorded oracles and has strict raw-total order `webmcp < playwright-mcp < dom`. The combined matrix is [codex-run/matrix.md](../codex-run/matrix.md) and [codex-run/matrix.json](../codex-run/matrix.json).

| Model | Test | Interface | Total | Input | Output | Reasoning | Calls | Time |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-5.6-terra | T1 | webmcp | 47107 | 46868 | 239 | 59 | 1 | 14.4s |
| gpt-5.6-terra | T1 | playwright-mcp | 105675 | 105160 | 515 | 52 | 8 | 29.0s |
| gpt-5.6-terra | T1 | dom | 118423 | 117967 | 456 | 79 | 6 | 29.0s |
| gpt-5.6-terra | T2 | webmcp | 86772 | 86370 | 402 | 64 | 5 | 17.4s |
| gpt-5.6-terra | T2 | playwright-mcp | 221193 | 220235 | 958 | 292 | 11 | 47.9s |
| gpt-5.6-terra | T2 | dom | 233564 | 232725 | 839 | 181 | 12 | 73.6s |
| gpt-5.6-terra | T3 | webmcp | 86277 | 85758 | 519 | 98 | 5 | 21.7s |
| gpt-5.6-terra | T3 | playwright-mcp | 195334 | 194483 | 851 | 149 | 12 | 57.0s |
| gpt-5.6-terra | T3 | dom | 267040 | 266084 | 956 | 272 | 18 | 68.2s |
| gpt-5.6-terra | T4 | webmcp | 46255 | 46022 | 233 | 46 | 1 | 18.0s |
| gpt-5.6-terra | T4 | playwright-mcp | 124574 | 124075 | 499 | 107 | 7 | 29.8s |
| gpt-5.6-terra | T4 | dom | 166336 | 165680 | 656 | 260 | 6 | 34.3s |
| gpt-5.6-terra | T5 | webmcp | 99106 | 98433 | 673 | 139 | 9 | 18.4s |
| gpt-5.6-terra | T5 | playwright-mcp | 386640 | 384865 | 1775 | 326 | 24 | 110.8s |
| gpt-5.6-terra | T5 | dom | 398402 | 396499 | 1903 | 604 | 30 | 144.6s |
| gpt-5.6-terra | T1-T5 | webmcp | 365517 | 363451 | 2066 | 406 | 21 | 89.9s |
| gpt-5.6-terra | T1-T5 | playwright-mcp | 1033416 | 1028818 | 4598 | 926 | 62 | 274.5s |
| gpt-5.6-terra | T1-T5 | dom | 1183765 | 1178955 | 4810 | 1396 | 72 | 349.7s |
| gpt-5.6-terra | T1-T5 | sum | 2582698 | 2571224 | 11474 | 2728 | 155 | 714.1s |
