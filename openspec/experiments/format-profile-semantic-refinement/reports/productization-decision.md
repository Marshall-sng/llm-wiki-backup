# FormatProfile Semantic Refinement Harness Report

- Mode: mock-pass
- Cases: 1
- Generated: 2026-05-13T15:25:20.640Z

| Case | Attempt | Verdict | Final | Fallback | Quality |
| --- | --- | --- | --- | --- | --- |
| docx-policy | not_attempted | not_run | fallback | source_context_unauthorized |  |

## Productization decision gate
- Product integration is not enabled by this harness.
- Proceed to product integration only if mock-pass refines all four golden cases and rejection modes fallback without altering deterministic hashes.


## DataScope Experiment Result（2026-05-13）

DataScope 对照实验已完成，仍仅限 experiment harness，未接入产品链路。

### Validation

- Syntax: all `.mjs` passed `node --check`.
- Evidence-only regression: baseline vs new `outputs/mock-pass/evidence-only/evidence-only` passed.
- Unauthorized gates: snippets/fulltext without matching authorization fail closed before prompt/LLM.
- Leak scan: outputs and reports passed `scan-artifacts.mjs`.
- Real LLM matrix via `codex-cli:gpt-5.3-codex-spark`: `12/12` refined/pass across 3 scopes × 4 cases.

### Observed result

Quality score did not materially improve in this harness run:

- DOCX: evidence-only/snippets/fulltext all `0.984`.
- XLSX/PPTX/PDF: evidence-only/snippets/fulltext all `0.956` in real-LLM matrix.
- Source context coverage increased for DOCX/XLSX in rich scopes, but current evaluator score did not show measurable quality lift.

### Interpretation

- Snippets/fulltext authorization, caps, sourceContext IDs, and leakage controls are feasible.
- Current evidence-only is already strong enough for these four golden cases under the current evaluator.
- Product integration should not default to snippets/fulltext yet; richer scopes should remain optional/advanced until cases demonstrate clear quality delta.
