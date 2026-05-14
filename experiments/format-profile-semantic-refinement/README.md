# FormatProfile Semantic Refinement Harness

实验目标：在不改产品链路的前提下，验证 LLM 只生成语义 overlay、harness 负责证据校验与最终 instruction 渲染。

## Commands

```powershell
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode disabled
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-hallucination --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-overreach-instruction --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-invalid-json --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-schema-invalid --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-error --case docx-policy
```

## Contract

- Raw evidence is immutable and hashed.
- LLM output is closed-schema JSON.
- Unsupported or ungrounded overlay falls back to the deterministic instruction with identical hashes.
- Accepted overlay is rendered by the harness, not by the LLM.


## DataScope comparison

```powershell
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-only
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-snippets --allow-snippets
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-fulltext --allow-fulltext
node experiments/format-profile-semantic-refinement/scripts/scan-artifacts.mjs --root experiments/format-profile-semantic-refinement/outputs
node experiments/format-profile-semantic-refinement/scripts/report-datascope-comparison.mjs
```

Rich scopes are fail-closed unless explicitly authorized. Fulltext requires `--allow-fulltext`; `--allow-snippets` is not enough.
