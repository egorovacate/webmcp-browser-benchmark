# Self-run T1-T5 (tokenized observations, o200k_base)

Input = exact MCP schemas + exact observation payloads. flowMs = local machine time, no model inference. Output/reasoning = null: only a model call produces them.

| Task | Interface | Calls | Input (schemas+obs) | Output | Reasoning | Answer tok | Flow ms | Oracle |
|---|---|---:|---:|:---:|:---:|---:|---:|:---:|
| T1 | webmcp | 3 | 1152 (443+709) | n/a | n/a | 9 | 46 | pass |
| T1 | visual | 6 | 9051 (361+8690) | n/a | n/a | 9 | 2731 | pass |
| T1 | playwright-mcp | 7 | 3417 (797+2620) | n/a | n/a | 9 | 2112 | pass |
| T2 | webmcp | 5 | 1264 (443+821) | n/a | n/a | 9 | 8 | pass |
| T2 | visual | 11 | 9273 (361+8912) | n/a | n/a | 9 | 2751 | pass |
| T2 | playwright-mcp | 12 | 5125 (797+4328) | n/a | n/a | 9 | 2630 | pass |
| T3 | webmcp | 5 | 1310 (443+867) | n/a | n/a | 9 | 5 | pass |
| T3 | visual | 19 | 9397 (361+9036) | n/a | n/a | 9 | 4023 | pass |
| T3 | playwright-mcp | 20 | 5174 (797+4377) | n/a | n/a | 9 | 3914 | pass |
| T4 | webmcp | 3 | 1152 (443+709) | n/a | n/a | 10 | 1 | pass |
| T4 | visual | 11 | 9585 (361+9224) | n/a | n/a | 10 | 3515 | pass |
| T4 | playwright-mcp | 12 | 6027 (797+5230) | n/a | n/a | 10 | 2503 | pass |
| T5 | webmcp | 9 | 2002 (443+1559) | n/a | n/a | 11 | 8 | pass |
| T5 | visual | 29 | 11262 (361+10901) | n/a | n/a | 11 | 7651 | pass |
| T5 | playwright-mcp | 30 | 7010 (797+6213) | n/a | n/a | 11 | 7652 | pass |

| Total | webmcp | 25 | 6880 | n/a | n/a | — | 68 | 5/5 |
| Total | visual | 76 | 48568 | n/a | n/a | — | 20671 | 5/5 |
| Total | playwright-mcp | 81 | 26753 | n/a | n/a | — | 18811 | 5/5 |
