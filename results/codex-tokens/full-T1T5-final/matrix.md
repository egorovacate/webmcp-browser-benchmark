# Codex subscription benchmark T1-T5 FINAL (2026-10-12, gpt-5.6-terra)

Status: completed (15/15 cells). Raw provider usage, total = input + output, cached input included in input. Playwright MCP cells use the 6-tool contract (incl. browser_select_option).

| Mode | Task | Input | Cached (incl.) | Output | Reasoning | Total | Calls | Time |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| WebMCP | T1 | 72136 | 60928 | 356 | 69 | 72492 | 3 | 26.6 s |
| DOM | T1 | 119347 | 98560 | 582 | 217 | 119929 | 6 | 42.3 s |
| Playwright MCP | T1 | 64235 | 46848 | 314 | 98 | 64549 | 2 | 14.7 s |
| WebMCP | T2 | 86370 | 61952 | 402 | 64 | 86772 | 5 | 17.4 s |
| DOM | T2 | 232725 | 209408 | 839 | 181 | 233564 | 12 | 73.6 s |
| Playwright MCP | T2 | 162427 | 138752 | 715 | 180 | 163142 | 9 | 47.9 s |
| WebMCP | T3 | 104175 | 85248 | 463 | 80 | 104638 | 5 | 27.8 s |
| DOM | T3 | 241804 | 219648 | 930 | 230 | 242734 | 17 | 164.9 s |
| Playwright MCP | T3 | 253766 | 231680 | 842 | 191 | 254608 | 18 | 89.6 s |
| WebMCP | T4 | 72469 | 55040 | 408 | 126 | 72877 | 3 | 25.3 s |
| DOM | T4 | 87685 | 71168 | 389 | 89 | 88074 | 6 | 34.9 s |
| Playwright MCP | T4 | 97160 | 77312 | 560 | 179 | 97720 | 6 | 61.7 s |
| WebMCP | T5 | 147620 | 114176 | 740 | 83 | 148360 | 9 | 40.4 s |
| Playwright MCP | T5 | 787145 | 741888 | 2182 | 458 | 789327 | 31 | 232.8 s |
| DOM | T5 | 421261 | 383744 | 1200 | 260 | 422461 | 26 | 116.9 s |

| Mode | Tasks | Input total | Output total | Reasoning total | Token total | Calls | Time total |
|---|---:|---:|---:|---:|---:|---:|---:|
| WebMCP | 5 | 482770 | 2369 | 422 | 485139 | 25 | 137.4 s |
| DOM | 5 | 1102822 | 3940 | 977 | 1106762 | 67 | 432.5 s |
| Playwright MCP | 5 | 1364733 | 4613 | 1106 | 1369346 | 66 | 446.7 s |

## Diagnostics (not measurements)

- Playwright MCP/T5: 498020 tokens, Task oracle failed: 2 items, $263.00 (batch 2026-10-12T10-45-15.595Z-0bd1dfc2)
- DOM/T5: 389714 tokens, Task oracle failed: 2 items, $263.00 (batch 2026-10-12T10-45-15.595Z-0bd1dfc2)
- Playwright MCP/T5: 473574 tokens, Task oracle failed: 2 items, $263.00 (batch 2026-10-12T10-53-23.099Z-1ec18fb4)
- DOM/T5: 350515 tokens, Task oracle failed: 2 lines, $263.00 (batch 2026-10-12T11-03-34.142Z-c10cd773)
