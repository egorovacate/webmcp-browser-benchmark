# Benchmark v2 methodology (pre-registered)

Date: 2026-10-12. Status: plan, no v2 measurements yet.

## 1. Pre-registered hypothesis

- H1: on task completion cost, `webmcp < playwright-mcp < visual` (total provider tokens, input + output).
- H0: no ordering between interfaces.

H1 must be confirmed by data, never assumed. The v1 series (15/15 cells, n=1) is superseded for ordering claims: it proved `webmcp < all` but left `playwright-mcp` vs `visual` inside the noise floor.

## 2. Why v1 cannot prove an ordering

- Noise floor ≈ ±45k tokens: the identical DOM-T1 flow measured 119 929 and 74 874 in different batches (Codex prompt-cache nondeterminism + strategy variance).
- Read-only tasks (T1/T4 class) are answerable in 1-2 reads from the default view; they measure noise, not interfaces.
- Cost law: total ≈ turns × Codex context (~10-20k per turn). Turns are chosen by the model and vary run to run (PW-T1: 2-12 turns across valid runs).

## 3. Task set

- Discriminative (multi-step, non-shortcuttable): T2, T3, T5 class. The answer must be unreachable without interaction; backend state must change.
- Read-only tasks (T1/T4 class) are measured but reported separately as non-discriminative; no ordering claim may rest on them.
- Frozen fixtures: `fixtures/tasks.json`, `fixtures/catalog.json` checksums recorded per run. No fixture, prompt, UI, or contract change after the first v2 run starts.

## 4. Design

- Model: pinned at first run, subscription only, no API keys.
- Repeats: n=3 minimum per cell (15 discriminative cells: 3 tasks x 3 modes + read-only reported separately).
- Order: randomized per round, all arms back-to-back on the same frozen build, same day.
- Isolation and contracts: unchanged from FINAL_BENCHMARK_SPEC.md (ephemeral threads, allowlisted tools, fail-closed validator, CLI version in manifest).
- Replacements: fresh store/browser/thread, failed attempts stay in diagnostics, never relabeled.

## 5. Metrics

- Primary: mean total tokens (input + output, provider-reported) per completed attempt.
- First-class secondary: tool calls (turns), uncached input, output, reasoning, task time, success rate over repeats.
- Cached input is a subset of input and is never added twice.

## 6. Decision rule

- An ordering between two interfaces on a task is claimed only if the 95% confidence intervals (t-distribution, n>=3) do not overlap.
- Overlapping intervals are reported as "indistinguishable", never as a win.
- Success rate is reported alongside cost; a cheaper interface with a lower success rate does not win.

## 7. Cost estimate

- Observed per-cell means: webmcp ~100k, visual ~200k, playwright-mcp ~280k tokens.
- 15 discriminative cells x 3 reps x ~200k avg ≈ 9M tokens, plus diagnostics budget for failed attempts.

## 8. Publication gate

- All repeats collected, no cherry-picking (all attempts retained, diagnostics published).
- 95% CIs computed from raw per-attempt totals, no baseline subtraction, no estimates.
- Any contract/fixture/build change restarts the affected cells from zero.
