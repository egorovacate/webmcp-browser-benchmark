# T1 efficiency-prompt 2026-10-14T10-37 gpt-5.6-terra (all oracles pass)

Wrapper adds: fewest calls, no re-reads, scoped observations. Same text all modes.

| Model | Test | Interface | Total | Input | Output | Reasoning | Calls | Time |
|---|---|---|---:|---:|---:|---:|---:|---:|
| gpt-5.6-terra | T1 | webmcp | 60713 | 60323 | 390 | 141 | 3 | 27.4s |
| gpt-5.6-terra | T1 | playwright-mcp | 74549 | 74184 | 365 | 104 | 3 | 21.7s |
| gpt-5.6-terra | T1 | dom | 71803 | 71409 | 394 | 114 | 6 | 33.0s |
| gpt-5.6-terra | T1 | **sum** | **207065** | **205916** | **1149** | **359** | **12** | **82.0s** |
