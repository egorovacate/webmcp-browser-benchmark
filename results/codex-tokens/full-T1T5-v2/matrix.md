# Codex subscription benchmark T1-T5 v2 (2026-10-12, gpt-5.6-terra)

Status: completed (15/15 cells). Raw provider usage, total = input + output, cached input included in input. PW cells: 7-tool contract.

| Mode | Task | Input | Cached (incl.) | Output | Reasoning | Total | Calls | Time |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| WebMCP | T1 | 71878 | 61952 | 368 | 82 | 72246 | 3 | 23.7 s |
| DOM | T1 | 74551 | 61184 | 323 | 74 | 74874 | 6 | 20.9 s |
| Playwright MCP | T1 | 156163 | 132352 | 605 | 158 | 156768 | 8 | 61.4 s |
| WebMCP | T2 | 86370 | 61952 | 402 | 64 | 86772 | 5 | 17.4 s |
| DOM | T2 | 232725 | 209408 | 839 | 181 | 233564 | 12 | 73.6 s |
| Playwright MCP | T2 | 220235 | 186112 | 958 | 292 | 221193 | 11 | 47.9 s |
| WebMCP | T3 | 104175 | 85248 | 463 | 80 | 104638 | 5 | 27.8 s |
| DOM | T3 | 241804 | 219648 | 930 | 230 | 242734 | 17 | 164.9 s |
| Playwright MCP | T3 | 260141 | 229888 | 783 | 138 | 260924 | 11 | 56.4 s |
| WebMCP | T4 | 72469 | 55040 | 408 | 126 | 72877 | 3 | 25.3 s |
| DOM | T4 | 87685 | 71168 | 389 | 89 | 88074 | 6 | 34.9 s |
| Playwright MCP | T4 | 177768 | 159744 | 851 | 297 | 178619 | 13 | 179.5 s |
| WebMCP | T5 | 147620 | 114176 | 740 | 83 | 148360 | 9 | 40.4 s |
| Playwright MCP | T5 | 728540 | 678400 | 1588 | 266 | 730128 | 28 | 159.3 s |
| DOM | T5 | 421261 | 383744 | 1200 | 260 | 422461 | 26 | 116.9 s |

| Mode | Tasks | Input total | Output total | Reasoning total | Token total | Calls | Time total |
|---|---:|---:|---:|---:|---:|---:|---:|
| WebMCP | 5 | 482512 | 2381 | 435 | 484893 | 25 | 134.5 s |
| DOM | 5 | 1058026 | 3681 | 834 | 1061707 | 67 | 411.2 s |
| Playwright MCP | 5 | 1542847 | 4785 | 1151 | 1547632 | 71 | 504.6 s |

## Diagnostics (not measurements)

- Playwright MCP/T5: 498020 tokens, Task oracle failed: 2 items, $263.00 (batch 2026-10-12T10-45-15.595Z-0bd1dfc2)
- DOM/T5: 389714 tokens, Task oracle failed: 2 items, $263.00 (batch 2026-10-12T10-45-15.595Z-0bd1dfc2)
- Playwright MCP/T5: 473574 tokens, Task oracle failed: 2 items, $263.00 (batch 2026-10-12T10-53-23.099Z-1ec18fb4)
- DOM/T5: 350515 tokens, Task oracle failed: 2 lines, $263.00 (batch 2026-10-12T11-03-34.142Z-c10cd773)
- Playwright MCP/T5: 615223 tokens, Final-answer mismatch (backend state correct): 2 lines, $263.00 (batch 2026-10-12T13-23-45.838Z-bb2df90c)
