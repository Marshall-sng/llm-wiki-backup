# LLM FormatRuleSpec Synthesis — 实验 / 产品化 PRD / 测试合并归档

归档说明：FormatRuleSpec synthesis 已产品化到 semantic overlay / FormatSpec renderer；实验与产品化规格合并保存。


---

## 原文件：`prd-format-rule-synthesis-experiment.md`


# PRD: LLM FormatRuleSpec Synthesis Experiment

Date: 2026-05-14

## Objective

Validate a pivot from collecting more deterministic "dead rules" to letting an LLM synthesize a GB/T 9704-2012-like, detailed, executable formatting rule system from already-collected evidence/material.

## Control Groups

1. Current product FormatSpec (`experiments/format-spec/outputs/*/format-spec.json`).
2. Historical weak control: old profile-prompt style is represented by leakage checks and by requiring no raw source/body text in synthesized output.
3. Negative control: intentionally uncited/overpromising output must fail evaluator.

## Experiment Group

`LLM FormatRuleSpec Synthesis`: evidence pack -> LLM output -> structured rule spec.

## Required Rule Shape

Each rule must include:

- target: document part, table region, slide part, PDF layout zone, etc.
- normType: hierarchy, typography, spacing, alignment, numbering, page, table, density, boundary, etc.
- rule and detail.
- attributes: explicit executable constraints such as font, fontSizePt, alignment, indent, lineSpacing, paragraphSpacing, pageSize, margins, header/body/table zones, slide density, etc.
- evidenceRefs and confidence.

## Acceptance Criteria

- Four cases pass: DOCX/XLSX/PPTX/PDF.
- Synthesized spec must be more granular than current FormatSpec by evaluator metrics.
- Every non-boundary rule cites known evidence.
- No raw evidence/body text leakage.
- No export, replica, high-fidelity or visual restoration promise.
- Negative control fails.

## Boundary

This experiment does not implement export or visual replication. It only validates a richer rule-constraint layer for draft generation and audit.


---

## 原文件：`test-spec-format-rule-synthesis-experiment.md`


# Test Spec: LLM FormatRuleSpec Synthesis Experiment

Date: 2026-05-14

## Commands

```powershell
node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode mock-llm
node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode mock-uncited
node experiments/format-rule-synthesis/scripts/evaluate-format-rule-synthesis.mjs
```

Optional real provider smoke:

```powershell
$env:FORMAT_RULE_LLM_PROVIDER='codex-cli'
node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode real-llm --allow-external-llm
```

## Pass Gates

- mock-llm: 4/4 pass.
- mock-uncited: 4/4 fail for missing/unknown evidence or boundary issues.
- independent evaluator summary: happy path 4/4 and negative 4/4.
- Artifact provenance includes input/case/script/output hashes.

## Metrics

- ruleCount
- attributeCount
- targetCoverage
- evidenceCoverage
- granularityScore
- baselineDelta

## Failure Handling

If happy path fails, redesign schema/evaluator before productization. If only real-LLM fails due provider instability, keep productization design provider-agnostic and mark real-provider risk.


## Real-LLM Redesign Note（2026-05-14）

Initial real Codex CLI smoke showed the model naturally emits compact rules with rich attributes rather than many separate rules. The evaluator was revised to avoid rule-count inflation: minimum rule count is now tied to required target coverage, while granularity is enforced through required attribute coverage, evidence coverage and granularity score.


---

## 原文件：`prd-format-rule-synthesis-productization.md`


# PRD: Productize LLM FormatRuleSpec Synthesis

Date: 2026-05-14

## Objective

Productize the experiment result by letting the existing LLM semantic overlay return structured `formatRuleSynthesis` rules. Deterministic StyleFacts remain the fact source; LLM only synthesizes rules from evidence.

## Architecture

```text
StyleFacts / StructureFacts / diagnostics
  -> EvidenceOnlyOverlayInput
  -> LLM semantic overlay with formatRuleSynthesis
  -> evaluator validates schema + evidence refs + boundaries
  -> accepted overlay stored separately
  -> FormatSpec renderer prefers accepted synthesized rules
  -> draft-processing consumes FormatSpec as before
```

## Decisions

- Reuse existing semantic overlay request/button/state. Do not add another provider flow.
- Add optional `formatRuleSynthesis` to overlay schema.
- Each synthesized rule carries target, normType, rule, detail, confidence, evidenceRefs and optional attributes.
- FormatSpec renderer maps accepted synthesized rules into `FormatSpecRule` with source `inferred` unless source is explicitly detected/standard-default.
- If model output is rejected/failed/stale/missing, current deterministic FormatSpec remains fallback.

## Boundaries

- LLM does not create or overwrite StyleFacts.
- Unknown evidence refs reject the overlay.
- Attribute evidence may inherit the parent rule evidence if omitted, but the parent rule itself must cite evidence.
- No snippets/fulltext default.
- No export, exact visual recreation, high-fidelity or pixel-perfect promise.

## UI

- Existing FormatSpec audit view continues to work.
- Rule attributes may be shown under each rule where available.
- Full promptBlock remains secondary folded audit text.


---

## 原文件：`test-spec-format-rule-synthesis-productization.md`


# Test Spec: Productize LLM FormatRuleSpec Synthesis

Date: 2026-05-14

## Targeted tests

```powershell
npx vitest run src/lib/format-profile-semantic-overlay.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose
```

## Full checks

```powershell
npm run typecheck
npm run test:mocks
npm run build
```

## Required Assertions

- Overlay evaluator accepts evidence-cited `formatRuleSynthesis`.
- Overlay evaluator rejects unknown evidence refs inside rules or attributes.
- FormatSpec uses accepted synthesized rules when present.
- FormatSpec falls back to deterministic rules when overlay is absent/rejected.
- PromptBlock includes rule attributes but no raw evidence/body text.
- Legacy snapshots still do not crash audit view.
