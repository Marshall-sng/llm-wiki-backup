# FormatProfile Style Extraction Phase 3 — PRD / 测试合并归档

归档说明：样式提取实验阶段已沉淀为 StyleFacts 事实层；PRD 与测试规格合并保存。


---

## 原文件：`prd-format-profile-style-extraction-phase3.md`


﻿# PRD: FormatProfile Style Extraction Phase 3

**Status:** proposed / ready for execution approval  
**Date:** 2026-05-13  
**Scope:** experiment-first only; no product integration  
**Companion test spec:** `.omx/plans/test-spec-format-profile-style-extraction-phase3.md`

## 1. Outcome

Build a new Phase 3 experiment that proves `FormatProfile` can extract high-fidelity, machine-readable style facts from finished files while preserving a strict fact boundary:

- The deterministic parser is the only source of style facts.
- Optional LLM interpretation may summarize or diagnose deterministic facts only.
- LLM output must cite deterministic style evidence IDs and must fail closed if it invents, overwrites, or cites unknown facts.
- The experiment prioritizes DOCX and XLSX style fidelity, with PPTX and PDF retained as lower-fidelity baselines.

This is not a product integration, UI change, template-library change, export feature, or high-fidelity renderer.

## 2. Evidence from current repository

- Existing FormatProfile experiment is under `experiments/format-profile/`; its README defines fixture/case/spec/script/output conventions and explicitly excludes frontend/export/high-fidelity restoration in the baseline experiment.
- Current deterministic probe is `experiments/format-profile/scripts/lib/document-probe.mjs`:
  - DOCX already parses `word/document.xml`, `word/styles.xml`, `word/numbering.xml`, paragraph style IDs, runs, fonts, half-point sizes, style definitions, page size, and margins.
  - XLSX currently parses workbook/sheets/styles/sharedStrings and reports sheet stats plus counts for fonts/fills/borders/cell styles/shared strings.
  - PPTX currently parses slide/theme/layout/master counts and per-slide text/shape/picture/table counts.
  - PDF currently reports byte-level page/text/font/image/encryption/scan hints.
- Current runner `experiments/format-profile/scripts/lib/profile-runner.mjs` builds `styleProfile` from deterministic probe facts and stores `rawProbeFacts` in the profile.
- Existing semantic refinement harness under `experiments/format-profile-semantic-refinement/` already demonstrates closed-schema LLM overlay validation, evidence IDs, fail-closed fallback, and no-LLM deterministic output.
- Existing context snapshot `.omx/context/format-profile-style-extraction-experiment-20260513T155418Z.md` states the same Phase 3 constraints: deterministic parser source of facts, optional evidence-cited LLM interpretation, no product integration.

## 3. Non-goals

1. No changes under `src/`, stores, UI, persistence, or app flows.
2. No DOCX/XLSX/PPTX/PDF export or pixel-perfect reproduction promise.
3. No dependency addition unless executor documents why Node built-ins are insufficient.
4. No LLM-authored style facts.
5. No mutation of existing Phase 0-2 outputs or schemas unless the new experiment copies/extends them in its own directory.

## 4. Proposed experiment directory

Create a standalone experiment:

```text
experiments/format-profile-style-extraction/
├─ README.md
├─ cases/
│  ├─ docx-style-rich.case.json
│  ├─ xlsx-style-rich.case.json
│  ├─ pptx-baseline.case.json
│  └─ pdf-baseline.case.json
├─ fixtures/
│  ├─ docx/
│  ├─ xlsx/
│  ├─ pptx/
│  └─ pdf/
├─ scripts/
│  ├─ run-style-extraction.mjs
│  └─ lib/
│     ├─ evidence-catalog.mjs
│     ├─ style-facts-schema.mjs or JSON schema loader
│     ├─ style-parser.mjs
│     ├─ style-interpreter.mjs optional
│     └─ report.mjs
├─ spec/
│  ├─ style-facts.schema.json
│  ├─ style-evidence.schema.json
│  ├─ style-interpretation-overlay.schema.json optional
│  └─ style-extraction-report.schema.json
└─ reports/
   └─ phase3-style-extraction-decision.md generated or committed after run
```

Runtime outputs should go to:

```text
runtime/format-profile-style-extraction/outputs/<mode>/<caseId>/
runtime/format-profile-style-extraction/reports/
```

## 5. Required contracts

### 5.1 Style fact envelope

Each run emits `style-facts.json` with:

```json
{
  "schemaVersion": "format-profile-style-facts.v0",
  "caseId": "docx-style-rich",
  "source": { "path": "...", "fileType": "docx", "sha256": "..." },
  "parser": { "name": "phase3-style-parser", "version": "0", "deterministic": true },
  "capabilities": { "styleFactConfidence": "high|medium|low|unknown", "formatTier": "priority|baseline" },
  "styleFacts": {
    "layout": {},
    "typography": {},
    "color": {},
    "spacing": {},
    "borders": {},
    "tables": {},
    "numbering": {},
    "formatSpecific": {}
  },
  "evidence": [],
  "diagnostics": []
}
```

Rules:

- Every non-summary fact must include `evidenceRefs` pointing to `evidence[].id`.
- Evidence IDs are stable and deterministic: e.g. `style.docx.paragraph.0001`, `style.docx.style.0001`, `style.xlsx.cellXf.0001`, `style.xlsx.fill.0001`, `style.pptx.theme.0001`, `style.pdf.font.0001`.
- Evidence records include `kind`, `sourcePath`, `pointer`, `value`, `sha256`, and optional `text`/`description`.
- `rawXml` may be omitted or truncated; hashes and pointers must remain.
- Parser facts must be reproducible: same input file and parser version produce same fact JSON apart from explicit generated timestamp fields, which should be avoided in golden artifacts.

### 5.2 Format priorities

#### DOCX priority fields

Minimum Phase 3 DOCX parser facts:

- Page layout: size, orientation, margins, section breaks when detectable.
- Paragraph styles: style ID/name/type/basedOn/next/outline level, linked style, defaults.
- Run typography: fonts by script bucket if present, half-point sizes, bold/italic/underline, color/highlight, caps/small-caps if present.
- Paragraph spacing/indent/alignment: before/after, line spacing, first-line/hanging indents, justification.
- Numbering/list facts: numbering definitions, abstract numbering, level formats/text/indent linkage.
- Table style facts: table count, grid hints, table style IDs, cell borders/shading where cheaply parseable.
- Evidence-backed aggregates: top fonts, top sizes, style usage counts, paragraph style usage, numbering usage.

#### XLSX priority fields

Minimum Phase 3 XLSX parser facts:

- Workbook/sheet metadata: sheet names, dimensions, hidden state when detectable.
- Cell style table: `cellXfs`, `cellStyles`, `dxfs` counts and representative records.
- Fonts: family/name, size, bold/italic/underline, color/theme/tint where present.
- Fills/borders: pattern/fill colors, border styles/colors.
- Number formats: built-in/custom numFmt IDs, dates/currency/percent hints.
- Alignment/protection: horizontal/vertical alignment, wrap text, rotation, locked/hidden where present.
- Merged cells, formulas, table-like ranges, conditional-formatting counts if detectable from XML.
- Evidence-backed aggregates: style ID usage counts by scanned cells, header-row style heuristics clearly marked as deterministic heuristic, not LLM fact.

#### PPTX baseline fields

- Theme name, color scheme count/details where easy, font scheme names where easy.
- Slide size, slide count, layout/master links, placeholder/shape/table/picture counts.
- Text run font/size/color facts from sampled slides if easy.
- Baseline confidence may be medium/low; no high-fidelity promise.

#### PDF baseline fields

- Page count, text/font/image/encryption/scan facts retained.
- FontRefs and basic media/crop box hints only if cheaply parseable.
- PDF remains diagnostic/reference-only; no editable style model promise.

### 5.3 Optional LLM interpretation overlay

If included, the LLM overlay must be separate from `style-facts.json`:

```text
style-facts.json                 deterministic source of truth
style-interpretation-overlay.json optional, advisory only
evaluator-report.json            pass/fail/fallback evidence
final-style-summary.md            rendered by harness, not LLM
```

Overlay schema constraints:

- Closed schema.
- Claims may only use fields such as `styleSummary`, `qualityDiagnostics`, `generatorHints`, `formatBoundaries`.
- Every claim must include `evidenceRefs` with existing style evidence IDs.
- Overlay must not contain `styleFacts`, `styleProfile`, `layout`, `typography`, `colors`, `spacing`, `borders`, `tables`, or any field that could overwrite facts.
- Evaluator rejects unknown evidence IDs, fact-shaped keys, unsupported export promises, high-fidelity reproduction claims, or values not traceable to evidence.

## 6. RALPLAN-DR summary

### Principles

1. **Deterministic facts first:** parser output is the sole style-fact authority.
2. **Evidence addressability:** every fact and advisory claim cites stable style evidence IDs.
3. **Fail closed on ambiguity:** unsupported formats, missing XML, invalid overlays, or low-confidence extraction must report diagnostics rather than fabricate facts.
4. **Experiment isolation:** all work stays under `experiments/format-profile-style-extraction/`, `runtime/format-profile-style-extraction/`, and `.omx/` planning artifacts.
5. **Format-priority honesty:** DOCX/XLSX get deep style parsing; PPTX/PDF remain baseline diagnostics unless explicitly promoted later.

### Top decision drivers

1. Need high-fidelity style parsing without letting LLM hallucinate style facts.
2. Need fast experiment execution using current Node/ZIP/XML patterns and existing sample inventory.
3. Need outputs that can later inform productization without coupling to product code now.

### Viable options

#### Option A — Standalone Phase 3 style extraction experiment (recommended)

**Approach:** Create `experiments/format-profile-style-extraction/` with its own schema, parser runner, evidence catalog, optional overlay evaluator, fixtures, and reports.

**Pros:** Strong isolation; does not destabilize Phase 0-2; can use stricter schemas; clean acceptance tests; easiest to delete or productize later.  
**Cons:** Some parser/ZIP utility duplication unless executor carefully factors or copies minimal helpers; integration with existing `FormatProfile` is deferred.

#### Option B — Extend existing `experiments/format-profile` as `run-phase3.mjs`

**Approach:** Add Phase 3 style facts to the current experiment and emit enhanced `styleProfile` directly.

**Pros:** Reuses case inventory, runner conventions, and existing profile outputs; easier comparison to Phase 2.  
**Cons:** Risks widening/changing current `FormatProfile` v0 semantics; harder to enforce "no product integration" and fact-boundary isolation; less safe for exploratory schema churn.

#### Option C — LLM-first style diagnosis over existing profiles (rejected for this request)

**Approach:** Feed current profiles/raw evidence to LLM and ask it to infer richer style descriptions.

**Pros:** Fastest to prototype narrative summaries.  
**Cons:** Violates the user's core requirement: deterministic parser must be source of style facts. Cannot satisfy high-fidelity machine-readable facts.

### ADR

**Decision:** Use Option A: a standalone Phase 3 style extraction experiment with deterministic style facts and optional evidence-cited advisory overlay.

**Drivers:** Preserve fact authority; keep experiment isolated; prioritize DOCX/XLSX fidelity; reuse semantic-harness guardrail lessons without product coupling.

**Alternatives considered:** Option B was viable but deferred because schema churn belongs in a separate experiment. Option C is invalid for this request because LLM cannot create style facts.

**Why chosen:** Option A gives executors freedom to define a stricter style-facts schema and high-fidelity evidence model while leaving existing profiles, product code, and previous experiments stable.

**Consequences:** Some duplicated parsing helpers may exist temporarily. Later productization will need an explicit migration plan from `style-facts.v0` into `FormatProfile` or a product style-profile model.

**Follow-ups:** After the experiment report, decide whether to merge parser facts back into `experiments/format-profile`, product `src/lib/format-profile.ts`, or keep them as a separate style-profile backend.

## 7. Implementation work plan

1. **Scaffold isolated experiment**
   - Add `experiments/format-profile-style-extraction/README.md`, cases, specs, scripts, and `.gitignore` if outputs live inside the experiment.
   - Document that runtime artifacts go under `runtime/format-profile-style-extraction/`.

2. **Define schemas before parser changes**
   - Add JSON schemas for `style-facts`, `style-evidence`, optional `style-interpretation-overlay`, and report output.
   - Encode the no-LLM-facts rule structurally: overlay cannot contain fact-shaped fields.

3. **Build deterministic evidence catalog**
   - Implement stable ID generation, source pointers, SHA-256 hashing, and deduplication.
   - Support DOCX/XLSX priority evidence kinds first; add PPTX/PDF baseline evidence kinds.

4. **Implement DOCX parser expansion**
   - Reuse existing ZIP/XML parsing approach from `document-probe.mjs`.
   - Extract style definitions, paragraph/run properties, numbering levels, page/section layout, table style hints, usage aggregates.

5. **Implement XLSX parser expansion**
   - Parse `xl/styles.xml`, workbook/sheets, representative cells, merged cells, conditional formatting counts, table-like dimensions.
   - Map style IDs to fonts/fills/borders/numFmts/alignment/protection and aggregate usage counts.

6. **Implement PPTX/PDF baselines**
   - Keep facts deliberately bounded and low-risk.
   - Mark baseline confidence and diagnostics honestly.

7. **Optional overlay/evaluator path**
   - Reuse semantic-refinement patterns: disabled/mock-pass/mock-hallucination/mock-overwrite/mock-unknown-evidence modes.
   - Ensure fallback leaves deterministic `style-facts.json` unchanged.

8. **Fixtures and golden cases**
   - Prefer synthetic fixtures with known style ground truth for DOCX/XLSX.
   - Include at least one existing real Phase 2 sample per priority format for smoke coverage.
   - Baseline PPTX/PDF can use existing sample inventory or minimal committed fixtures.

9. **Report and decision artifact**
   - Generate machine-readable summary and Markdown report with coverage by format, confidence, diagnostics, unsupported facts, and productization recommendation.

## 8. Acceptance criteria

1. `experiments/format-profile-style-extraction/` exists and does not require changes under `src/`.
2. `style-facts.schema.json` validates all produced `style-facts.json` outputs.
3. DOCX priority fixture emits evidence-cited facts for page layout, paragraph styles, run typography, spacing/indent/alignment, numbering, table hints, and aggregates.
4. XLSX priority fixture emits evidence-cited facts for fonts, fills, borders, number formats, alignment/protection, merged cells, formulas/table-like ranges, style usage aggregates.
5. PPTX and PDF baseline cases emit bounded facts plus diagnostics that clearly avoid high-fidelity promises.
6. Every non-summary style fact has at least one valid `evidenceRef`; unknown evidence IDs fail verification.
7. Optional LLM overlay, if implemented, cannot alter `style-facts.json`; accepted overlay claims cite valid style evidence IDs.
8. Mock hallucination / overwrite / unknown-evidence overlay modes fail closed and preserve deterministic output hashes.
9. Re-running the same case produces stable deterministic hashes for `style-facts.json` after excluding any explicitly documented volatile report timestamp.
10. Final report states DOCX/XLSX coverage, PPTX/PDF baseline limitations, and productization recommendation.

## 9. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Regex XML parsing misses namespace/attribute variants | Keep parser facts conservative; emit diagnostics for unsupported constructs; prefer targeted synthetic fixtures that exercise known XML shapes. |
| High-fidelity scope explodes into renderer/export work | Keep acceptance tied to machine-readable facts and evidence, not visual reproduction. |
| LLM overlay smuggles style facts | Closed schema rejects fact-shaped keys; evaluator scans keys/values for forbidden overwrite paths. |
| Real samples contain sensitive/local data | Commit only synthetic or sanitized fixtures; runtime local samples remain under ignored `runtime/`. |
| Existing FormatProfile schema becomes unstable | Use standalone `style-facts.v0` schema; defer integration decision to post-report ADR. |

## 10. Verification commands

Primary verification after implementation:

```powershell
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-pass
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-hallucination --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-overwrite-facts --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-unknown-evidence --case docx-style-rich
npm run typecheck
npm run test:mocks
```

If the executor adds schema validation as a separate command, include it in README and CI-style verification, for example:

```powershell
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
```

## 11. Direct execution handoff guidance

Recommended lane: `$ralph` for single-owner implementation, because the work has tight schema/parser/evaluator coupling. Use `$team` only if splitting into clearly disjoint lanes.

### Available agent-types roster

- `executor`: implementation/refactoring.
- `test-automator` or `test-engineer`: fixtures, golden checks, validation modes.
- `reviewer` or `code-reviewer`: correctness/security/regression review.
- `verifier`: completion evidence and acceptance audit.
- `architect`: schema and boundary review if scope expands.
- `explore`: fast repo lookup only.
- `writer`: README/report polish.

### Ralph handoff

```text
$ralph implement .omx/plans/prd-format-profile-style-extraction-phase3.md and .omx/plans/test-spec-format-profile-style-extraction-phase3.md. Keep work experiment-only; do not edit src/. Verify deterministic parser facts are source of truth and LLM overlays are advisory/evidence-cited only.
```

Suggested reasoning: executor medium/high, verifier high, reviewer high.

### Team handoff

Use only if parallelism is desired:

```text
$team implement FormatProfile Style Extraction Phase 3 from .omx/plans/prd-format-profile-style-extraction-phase3.md and .omx/plans/test-spec-format-profile-style-extraction-phase3.md with lanes: schema/evidence, DOCX parser, XLSX parser, overlay evaluator, verification/reporting.
```

Team staffing:

1. Executor A: schemas + evidence catalog.
2. Executor B: DOCX parser only.
3. Executor C: XLSX parser only.
4. Test automator: golden fixtures + verification script.
5. Reviewer/verifier: boundary and acceptance checks.

Team verification path: team must produce command output for deterministic, mock-pass, and negative overlay modes; verifier must audit that no `src/` files changed and that `style-facts.json` hashes remain stable.

### Goal-mode follow-up suggestions

- `$ultragoal`: default if the user wants durable sequential tracking from plan to verified experiment.
- `$autoresearch-goal`: appropriate if the next step becomes external research on OpenXML/PDF style semantics or parser fidelity benchmarks.
- `$performance-goal`: only if Phase 3 later targets parser throughput/memory on large files.

## 12. Consensus review notes

- Architect review fallback: native subagent spawn was unavailable due to thread limit, so the final plan self-applies the requested antithesis/tradeoff review. Strongest antithesis: extending existing `run-phase3.mjs` would reduce duplication and ease comparison. Resolution: keep standalone until schema stabilizes, then productize or merge deliberately.
- Critic checks applied: alternatives are real, acceptance criteria are testable, LLM guardrails are explicit, and verification commands include negative/fail-closed modes.

## 13. Architect WATCH Resolution（2026-05-13）

Architect verdict: WATCH. Direction approved, with mandatory contract tightening before execution.

### 13.1 Formal Fact leaf shape

Every non-summary deterministic style fact must use this canonical shape:

```json
{
  "value": "any JSON scalar/object/array value",
  "unit": "optional unit such as pt, twip, cm, halfPoint, emu, rgb",
  "confidence": "high|medium|low|unknown",
  "evidenceRefs": ["style.docx.paragraph.0001"],
  "derived": false,
  "notes": ["optional bounded notes"]
}
```

Rules:

- `evidenceRefs` is required and non-empty for all non-summary facts.
- `derived: true` is allowed only for deterministic transformations, e.g. `halfPoint -> pt`, `twips -> cm`, EMU position conversion, style usage aggregates.
- Derived facts must cite the source evidence that was transformed.
- Summary containers may be plain objects/arrays only if their descendants are Fact leaves or if they are explicitly listed in `summaryPaths`.
- Allowed `summaryPaths` must be narrow, e.g. `capabilities`, `parser`, `diagnostics`, and top-level grouping objects under `styleFacts`.

### 13.2 Citation coverage verifier

`verify-style-extraction.mjs` is mandatory. It must traverse `styleFacts` recursively and fail if any non-summary leaf:

- is not in the canonical Fact shape,
- has missing/empty `evidenceRefs`,
- cites an unknown evidence ID,
- claims high confidence from low-confidence/baseline evidence without a diagnostic.

This strengthens the test spec from "refs resolve when present" to "required facts must be cited."

### 13.3 Fidelity boundary

The phrase "high-fidelity" is scoped to:

```text
fixture-backed deterministic OpenXML/PDF style fact extraction for fields covered by the Phase 3 schema and golden fixtures.
```

It does **not** mean renderer-grade fidelity, visual reproduction, export reconstruction, or unsupported parser inference.

Parser dependency policy:

- First implementation should use Node built-ins and existing ZIP/XML parsing patterns where feasible.
- If built-ins are insufficient for a required fixture-backed field, adding a small XML parser dependency is allowed only after documenting: field blocked, dependency chosen, license, and why regex/string parsing is unsafe.
- No dependency may be added solely for LLM interpretation.

### 13.4 Mandatory verification command

`verify-style-extraction.mjs` is required, not optional. The final verification command set is:

```powershell
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-pass
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-hallucination --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-overwrite-facts --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-unknown-evidence --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
```

`npm run typecheck` / `npm run test:mocks` remain recommended regression guards if time permits or if any shared/package files change.

### 13.5 Future integration mapping

The final report must map accepted `styleFacts` fields to possible future `FormatProfile` integration targets, without actually modifying product code.


## Execution Record（2026-05-13）

Critic verdict: APPROVE. The experiment was implemented directly after approval, per user instruction.

Implemented:

- `experiments/format-profile-style-extraction/` standalone experiment harness.
- Canonical `style-facts.json` envelope with deterministic parser authority.
- Recursive evidence verifier enforcing Fact leaf shape and non-empty `evidenceRefs`.
- DOCX/XLSX primary golden assertions and PPTX/PDF baseline diagnostics.
- Advisory overlay modes: `mock-pass`, `mock-hallucination`, `mock-overwrite-facts`, `mock-unknown-evidence`.
- Runtime reports under `runtime/format-profile-style-extraction/reports/`.

Verification:

```powershell
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-pass
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-hallucination --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-overwrite-facts --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-unknown-evidence --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
npm run typecheck
npm run test:mocks
```

Evidence:

- `verify-style-extraction.mjs`: PASS, 11 outputs checked, 4 deterministic cases checked.
- `npm run typecheck`: PASS.
- `npm run test:mocks`: PASS, 83 test files / 1127 tests.

Stop condition for this experiment phase is met. Next phase should be productization design for mapping accepted `styleFacts` into the product `FormatProfile` contract, not further LLM fact generation.


---

## 原文件：`test-spec-format-profile-style-extraction-phase3.md`


﻿# Test Spec: FormatProfile Style Extraction Phase 3

**Status:** proposed / ready for execution approval  
**Date:** 2026-05-13  
**PRD:** `.omx/plans/prd-format-profile-style-extraction-phase3.md`

## 1. Test objective

Prove that Phase 3 extracts high-fidelity style facts deterministically, validates evidence integrity, and prevents optional LLM output from creating or overwriting style facts.

## 2. Test matrix

| Area | Required cases | Pass condition |
| --- | --- | --- |
| DOCX priority | synthetic style-rich DOCX + at least one real Phase 2 DOCX smoke | Page, paragraph style, typography, spacing/indent/alignment, numbering, table hints, and aggregates exist with valid evidence refs. |
| XLSX priority | synthetic style-rich XLSX + at least one real Phase 2 XLSX smoke | Fonts, fills, borders, numFmts, alignment/protection, merged cells, formulas/ranges, style usage aggregates exist with valid evidence refs. |
| PPTX baseline | one PPTX sample | Theme/layout/slide/shape/table/text-run baseline facts exist or diagnostics explain unsupported fields. |
| PDF baseline | one PDF sample | Page/text/font/image/encryption/scan facts exist or diagnostics explain low confidence. |
| Evidence integrity | all formats | Every fact evidence ref resolves to an evidence record with stable ID, pointer, value/hash. |
| Determinism | at least DOCX + XLSX | Re-run emits same deterministic fact hash, ignoring documented volatile report fields only. |
| Overlay pass | mock-pass | Advisory claims accepted only with valid evidence refs; style facts hash unchanged. |
| Overlay rejection | mock-hallucination, mock-overwrite-facts, mock-unknown-evidence | Overlay fails closed; deterministic facts hash unchanged; diagnostics explain rejection. |

## 3. Fixture requirements

### 3.1 Synthetic DOCX fixture

Must contain known, inspectable styles:

- Page size/margins and at least one section/layout signal if feasible.
- At least three paragraph styles, including one heading-like style and one body style.
- Runs with different fonts, sizes, bold/italic/underline, color/highlight if feasible.
- Paragraph spacing, line spacing, indent, and alignment examples.
- Numbered or bulleted list with level details.
- Table with style/borders/shading if feasible.

Expected golden checks should assert concrete parsed values, not just non-empty arrays.

### 3.2 Synthetic XLSX fixture

Must contain known, inspectable styles:

- Multiple fonts, sizes, bold/italic/underline.
- Multiple fills and borders.
- Built-in and custom number formats.
- Horizontal/vertical alignment, wrap text, rotation if feasible.
- Merged cells.
- Formula cells.
- At least two distinct style IDs used by scanned cells.

Expected golden checks should assert specific counts and representative records.

### 3.3 PPTX/PDF baseline fixtures

Can be minimal but must verify the baseline boundary:

- PPTX: slide count plus theme/layout/master or diagnostics.
- PDF: page/text/font/image/scan indicators plus diagnostics.

## 4. Schema validation tests

For every produced `style-facts.json`:

1. Validate against `spec/style-facts.schema.json`.
2. Validate evidence records against `spec/style-evidence.schema.json`.
3. Assert `parser.deterministic === true`.
4. Assert `schemaVersion === "format-profile-style-facts.v0"`.
5. Assert every fact path that carries `evidenceRefs` resolves to existing `evidence[].id`.
6. Assert no optional overlay fields are present in `style-facts.json`.

For optional overlays:

1. Validate against `spec/style-interpretation-overlay.schema.json`.
2. Assert closed schema rejects unknown top-level fields.
3. Assert forbidden fact-shaped fields are rejected.
4. Assert all claim `evidenceRefs` resolve to style evidence IDs.

## 5. Negative tests

Implement mock modes or fixture mutations for:

1. `mock-hallucination`: overlay claims a style not present in evidence.
2. `mock-overwrite-facts`: overlay includes `styleFacts`, `styleProfile`, `typography`, `layout`, `colors`, `spacing`, `borders`, or similar fact-shaped keys.
3. `mock-unknown-evidence`: overlay references a nonexistent evidence ID.
4. `missing-source`: case source path missing.
5. `unsupported-format`: unsupported or mismatched expected format.
6. `malformed-office-zip`: invalid ZIP or missing required XML part.
7. `pdf-scan-low-confidence`: PDF with image-heavy/no-text hints reports baseline low confidence, not high-fidelity facts.

Pass condition for all negative overlay tests: `style-facts.json` is still emitted when the deterministic parser succeeds, overlay is rejected/fallback, and fact hash is unchanged.

## 6. Determinism checks

The verifier should compute SHA-256 over canonicalized deterministic outputs:

- Exclude volatile timestamps from reports.
- Prefer no timestamp in `style-facts.json`.
- Sort object keys or write JSON through a stable writer if needed.
- Re-run at least DOCX and XLSX cases twice and compare hashes.

Acceptance threshold: exact match for canonical `style-facts.json` hash across repeated runs.

## 7. Commands

Expected commands after implementation:

```powershell
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-pass
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-hallucination --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-overwrite-facts --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-unknown-evidence --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
npm run typecheck
npm run test:mocks
```

If no TypeScript/source files are touched, `npm run typecheck` and `npm run test:mocks` still serve as regression guards for accidental product impact.

## 8. Acceptance checklist

- [ ] New experiment is isolated under `experiments/format-profile-style-extraction/` and runtime outputs under `runtime/format-profile-style-extraction/`.
- [ ] No `src/` product files changed.
- [ ] DOCX priority golden assertions pass.
- [ ] XLSX priority golden assertions pass.
- [ ] PPTX/PDF baseline assertions pass or low-confidence diagnostics are explicit.
- [ ] Schema validation passes for all deterministic outputs.
- [ ] Evidence integrity validation passes for all fact refs.
- [ ] Overlay mock-pass accepts only advisory evidence-cited claims.
- [ ] Overlay negative modes fail closed and preserve deterministic fact hashes.
- [ ] Determinism hash check passes for DOCX and XLSX.
- [ ] Final report summarizes coverage, limits, and productization recommendation.

## 9. Review focus for verifier

1. Search for any LLM path writing into `style-facts.json`; this must not exist.
2. Search overlay schema for forbidden fact-shaped fields; they must be absent/rejected.
3. Confirm evidence IDs are generated by deterministic parser/evidence catalog, not by LLM.
4. Confirm README repeats the experiment-only boundary and no export/high-fidelity reproduction promise.
5. Confirm failure diagnostics are useful enough for future productization decisions.

## 10. Architect WATCH Test Spec Resolution（2026-05-13）

Additional mandatory tests:

1. `verify-style-extraction.mjs` must recursively enforce the canonical Fact leaf shape for all non-summary facts.
2. Missing `evidenceRefs` is a hard failure, not a warning.
3. Unknown evidence IDs are a hard failure.
4. Derived facts must cite original deterministic evidence.
5. Golden tests must assert at least one unit conversion where applicable:
   - DOCX half-points to pt,
   - DOCX twips to cm or pt,
   - PPTX EMU to approximate dimensions if implemented.
6. The final report must state that "high-fidelity" means fixture-backed parser fidelity, not visual/export fidelity.


## Execution Record（2026-05-13）

Critic verdict: APPROVE. The experiment was implemented directly after approval, per user instruction.

Implemented:

- `experiments/format-profile-style-extraction/` standalone experiment harness.
- Canonical `style-facts.json` envelope with deterministic parser authority.
- Recursive evidence verifier enforcing Fact leaf shape and non-empty `evidenceRefs`.
- DOCX/XLSX primary golden assertions and PPTX/PDF baseline diagnostics.
- Advisory overlay modes: `mock-pass`, `mock-hallucination`, `mock-overwrite-facts`, `mock-unknown-evidence`.
- Runtime reports under `runtime/format-profile-style-extraction/reports/`.

Verification:

```powershell
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-pass
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-hallucination --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-overwrite-facts --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-unknown-evidence --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
npm run typecheck
npm run test:mocks
```

Evidence:

- `verify-style-extraction.mjs`: PASS, 11 outputs checked, 4 deterministic cases checked.
- `npm run typecheck`: PASS.
- `npm run test:mocks`: PASS, 83 test files / 1127 tests.

Stop condition for this experiment phase is met. Next phase should be productization design for mapping accepted `styleFacts` into the product `FormatProfile` contract, not further LLM fact generation.
