# Results (model / test / interface / total / input / output / reasoning / calls / time)

Model: gpt-5.6-terra. Source: full-T1T5-v2, 15/15 completed cells.

| Model | Test | Interface | Total | Input | Output | Reasoning | Calls | Time |
|---|---|---|---:|---:|---:|---:|---:|---:|
| gpt-5.6-terra | T1 | webmcp | 72246 | 71878 | 368 | 82 | 3 | 23.7s |
| gpt-5.6-terra | T1 | dom | 74874 | 74551 | 323 | 74 | 6 | 20.9s |
| gpt-5.6-terra | T1 | playwright-mcp | 156768 | 156163 | 605 | 158 | 8 | 61.4s |
| gpt-5.6-terra | T2 | webmcp | 86772 | 86370 | 402 | 64 | 5 | 17.4s |
| gpt-5.6-terra | T2 | dom | 233564 | 232725 | 839 | 181 | 12 | 73.6s |
| gpt-5.6-terra | T2 | playwright-mcp | 221193 | 220235 | 958 | 292 | 11 | 47.9s |
| gpt-5.6-terra | T3 | webmcp | 104638 | 104175 | 463 | 80 | 5 | 27.8s |
| gpt-5.6-terra | T3 | dom | 242734 | 241804 | 930 | 230 | 17 | 164.9s |
| gpt-5.6-terra | T3 | playwright-mcp | 260924 | 260141 | 783 | 138 | 11 | 56.4s |
| gpt-5.6-terra | T4 | webmcp | 72877 | 72469 | 408 | 126 | 3 | 25.3s |
| gpt-5.6-terra | T4 | dom | 88074 | 87685 | 389 | 89 | 6 | 34.9s |
| gpt-5.6-terra | T4 | playwright-mcp | 178619 | 177768 | 851 | 297 | 13 | 179.5s |
| gpt-5.6-terra | T5 | webmcp | 148360 | 147620 | 740 | 83 | 9 | 40.4s |
| gpt-5.6-terra | T5 | playwright-mcp | 730128 | 728540 | 1588 | 266 | 28 | 159.3s |
| gpt-5.6-terra | T5 | dom | 422461 | 421261 | 1200 | 260 | 26 | 116.9s |

| Model | Test | Interface | Total | Input | Output | Reasoning | Calls | Time |
|---|---|---|---:|---:|---:|---:|---:|---:|
| gpt-5.6-terra | T1-T5 | webmcp | 484893 | 482512 | 2381 | 435 | 25 | 134.5s |
| gpt-5.6-terra | T1-T5 | dom | 1061707 | 1058026 | 3681 | 834 | 67 | 411.2s |
| gpt-5.6-terra | T1-T5 | playwright-mcp | 1547632 | 1542847 | 4785 | 1151 | 71 | 504.6s |
