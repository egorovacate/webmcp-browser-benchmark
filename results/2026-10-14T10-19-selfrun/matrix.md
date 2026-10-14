# Self-run T1 2026-10-14T10-19 (no model calls)

Scripted flows, oracle-checked, o200k_base. Total = input + answer.

| Interface | Calls | Input (schemas+obs) | Answer | Total | Flow ms | Oracle |
|---|---:|---:|---:|---:|---:|:---:|
| webmcp | 1 | 691 (427+264) | 9 | 700 | 17 | pass |
| playwright-cli | 7 | 5090 (302+4788) | 9 | 5099 | 10383 | pass |
| playwright-mcp | 7 | 5306 (1465+3841) | 9 | 5315 | 4569 | pass |
| visual | 6 | 9031 (361+8670) | 9 | 9040 | 4340 | pass |
| **Sum** | **21** | **20118** | **36** | **20154** | **25309** | — |
