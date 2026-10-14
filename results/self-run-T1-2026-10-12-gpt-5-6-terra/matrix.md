# Self-run T1 2026-10-12 (reference model gpt-5.6-terra, no model calls)

Scripted flows, oracle-checked, o200k_base. Input = schemas + observations. Total = input + answer (no model output/reasoning). Flow ms = local machine time.

| Interface | Calls | Input (schemas+obs) | Answer | Total | Flow ms | Oracle |
|---|---:|---:|---:|---:|---:|:---:|
| webmcp | 1 | 691 (427+264) | 9 | 700 | 14 | pass |
| playwright-cli | 7 | 5090 (302+4788) | 9 | 5099 | 10685 | pass |
| playwright-mcp | 7 | 5306 (1465+3841) | 9 | 5315 | 4607 | pass |
| visual | 6 | 9031 (361+8670) | 9 | 9040 | 3998 | pass |
| **Sum** | **21** | **20118** | **36** | **20154** | **19304** | — |
