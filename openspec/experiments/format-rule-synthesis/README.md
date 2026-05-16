# FormatRuleSpec Synthesis Experiment

This harness validates the pivot from deterministic rule collection to LLM-style rule synthesis.

## Controls

- Current product FormatSpec outputs under `experiments/format-spec/outputs`.
- Negative mock output with unknown evidence refs and forbidden promises.

## Main modes

```powershell
node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode mock-llm
node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode mock-uncited
node experiments/format-rule-synthesis/scripts/evaluate-format-rule-synthesis.mjs
```

Optional real LLM smoke via Codex CLI:

```powershell
node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode real-llm --allow-external-llm
```

The evaluator checks target coverage, explicit attribute count, required GB/T-like attribute names, evidence binding, source-text leakage, forbidden export/fidelity promises, and improvement over current FormatSpec.
