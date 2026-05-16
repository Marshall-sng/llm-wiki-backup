# RALPLAN: DOCX-first Export Slice B — Adapter Comparison Gate

状态：revised after architect review / pending critic approval  
日期：2026-05-14  
范围：plan only; no implementation in this step

## 1. Goal

Create an executable Slice B experiment plan to compare DOCX adapter candidates using the same Slice A product boundary:

```text
DocxExportContract
→ DocxIntermediateDocument
→ adapter candidate
→ DocxMatchReview
→ DocxExportRecord
→ comparison report
```

Slice B must **not** choose the final adapter. It exists to produce fair evidence for Slice C.

## 2. Evidence Baseline

### Repo facts

- `src/lib/docx-export-contract.ts` defines `DocxExportContract`, `buildDocxExportContract`, forbidden leakage keys, `containsForbiddenDocxExportLeakage`, and the no raw body/evidence leakage policy.
- `src/lib/docx-intermediate.ts` defines `DocxIntermediateDocument` and `buildDocxIntermediateDocument`; supported block roles include `documentTitle`, `heading`, `paragraph`, `list`, and `table`.
- `src/lib/docx-match-review.ts` defines `DocxAdapterResultLike` and `reviewDocxExport`; adapter `validationErrors` become blocking failures and `knownWarnings` become warnings.
- `src/lib/docx-export-record.ts` defines `DocxExportRecord` and maps `pass → success`, `warn → warning`, `fail → failed`.
- `src/test-helpers/docx-export-fixtures.ts` provides the shared Chinese formal-document fixture and FormatSpec-style rules.
- `package.json` currently has no selected DOCX writer dependency such as `docx`, OpenXML, mammoth, officegen, pizzip, or docxtemplater.
- Previous spike: `experiments/docx-first-export-contract/` passed and concluded the contract/intermediate/review boundary is productizable.

### External reference facts

- The `docx` JS/TS package documentation describes a declarative API for creating `.docx` files in Node.js/browser and exposes `Document`, `Paragraph`, `TextRun`, `Table`, `Numbering`, and `Packer`. `Packer` compiles the document structure into OOXML and a `.docx` ZIP archive / Node.js Buffer. Sources: https://docx.js.org/api/modules.html and https://docx.js.org/api/classes/Packer.html
- Microsoft Learn documents Open XML SDK creation of WordprocessingDocument packages. A Word document package must include a main document part that stores main text as WordprocessingML; `Document`, `Body`, `Paragraph`, `Run`, and `Text` correspond to core WordprocessingML elements. Source: https://learn.microsoft.com/en-us/office/open-xml/word/how-to-create-a-word-processing-document-by-providing-a-file-name

## 3. RALPLAN-DR Summary

### Principles

1. **Boundary fairness** — both candidates must consume the same `DocxExportContract` and `DocxIntermediateDocument`.
2. **No premature adapter choice** — Slice B produces comparable evidence only; Slice C decides.
3. **Experiment containment** — dependencies and runtime experiments stay under `experiments/docx-adapter-comparison/**`.
4. **Validation-first** — package/XML/structural probe failures flow into `adapterResult.validationErrors` and then MatchReview.
5. **Evidence boundary** — reports must not leak raw source body text or raw evidence dumps.

### Top Decision Drivers

1. **Product integration cost** — runtime, packaging, dependency, and Tauri integration complexity.
2. **DOCX structural reliability** — whether required blocks, lists, tables, styles/package parts, and XML probes are generated correctly.
3. **Future maintainability** — whether the candidate can support later formal-document requirements without breaking the Slice A boundary.

### Viable Options

#### Option A — TS/JS adapter using experiment-local `docx` npm

Approach: implement an experiment-local TS/JS adapter that maps `DocxIntermediateDocument` blocks to `docx` `Document` / `Paragraph` / `TextRun` / `Table` / numbering objects and writes `.docx` via `Packer`.

Pros:
- Closest to current TypeScript codebase.
- Likely fastest MVP path.
- Easier to unit-test with existing Node/Vitest tooling.
- Avoids sidecar runtime packaging in first product slice.

Cons:
- Low-level OpenXML control may be weaker.
- CJK font, numbering, style, and table behavior must be proven with XML probes.
- Adds npm dependency risk if later productized.
- Openability/OOXML validity still needs validation beyond generated file existence.

#### Option B — OpenXML SDK sidecar candidate

Approach: implement an experiment-local .NET sidecar that maps the same intermediate JSON to OpenXML SDK-generated `.docx` using WordprocessingDocument / MainDocumentPart / WordprocessingML classes.

Pros:
- Strong low-level DOCX/WordprocessingML control.
- Better fit for future validation/style/table complexity.
- Microsoft documentation directly supports package/part and WordprocessingML construction.

Cons:
- Adds sidecar/runtime distribution complexity.
- Harder to integrate into Tauri/package flow.
- Requires cross-platform runtime assessment before productization.
- More operational overhead for MVP.

#### Option C — External template-file route

Status: rejected for v1.

Reason: active product boundary says no external template-file route; it would reintroduce manual-template coupling before adapter evidence exists and is harder to compare fairly against the contract/intermediate boundary.

## 4. Scope

### Allowed write scope for Slice B execution

```text
experiments/docx-adapter-comparison/**
```

Experiment-local manifests are allowed only under:

```text
experiments/docx-adapter-comparison/package.json
experiments/docx-adapter-comparison/**/package.json
experiments/docx-adapter-comparison/**/csproj
```

These must not alter the app dependency graph.

### Forbidden product changes

Slice B must not modify:

```text
package.json
package-lock.json / pnpm-lock.yaml / yarn.lock at repo root
src/components/**
src/stores/**
src-tauri/**
product src/** implementation files
```

Read-only imports from Slice A product boundary are allowed.

## 5. Experiment Design

### Experiment path

```text
experiments/docx-adapter-comparison/
  README.md
  package.json                 # experiment-local only, if needed
  fixtures/
  scripts/
  adapters/
    ts-docx/
    openxml-sidecar/
  reports/
```

### Shared input

Both adapters must use the same generated inputs:

1. `createDocxExportDraft()` from `src/test-helpers/docx-export-fixtures.ts`.
2. `createDocxFormatProfileSnapshot()` from `src/test-helpers/docx-export-fixtures.ts`.
3. `buildDocxExportContract(...)`.
4. `buildDocxIntermediateDocument(...)`.

No adapter may parse the original draft independently as its primary source of structure.

### Shared adapter result boundary

Adapter output must reduce to existing `DocxAdapterResultLike`:

```ts
{
  adapterId: string
  outputPath?: string
  sizeBytes?: number
  validationErrors?: string[]
  knownWarnings?: string[]
}
```

### Broader comparison report schema

The comparison report is separate from `DocxAdapterResultLike` and must be allowlist-serialized:

```ts
{
  adapterResult: DocxAdapterResultLike
  capabilities: string[]
  unsupportedCapabilities: string[]
  validationResult: {
    packageParts: string[]
    structuralAssertions: Array<{
      id: string
      passed: boolean
      count?: number
      hash?: string
      issueCode?: string
    }>
    validationErrorCodes: string[]
    knownWarningCodes: string[]
  }
  reviewSummary: {
    verdict: "pass" | "warn" | "fail"
    blockingIssueCodes: string[]
    warningCodes: string[]
  }
  recordSummary: {
    status: "success" | "warning" | "failed"
    exportContractHash: string
    intermediateHash: string
    adapterId: string
  }
  packagingRisk: "low" | "medium" | "high"
  licenseRisk: "low" | "medium" | "high" | "unknown"
  maintenanceRisk: "low" | "medium" | "high"
  runtimeCost: "low" | "medium" | "high"
  evidenceSummary: Array<{
    assertionId: string
    result: "pass" | "warn" | "fail"
    summary: string
  }>
  rejectedAlternatives: string[]
  tested: string[]
  notTested: string[]
  scopeRisk: "narrow" | "moderate" | "broad"
  confidence: "low" | "medium" | "high"
  recommendation: {
    status: "non-binding"
    nextStepOnly: true
    summary: string
  }
}
```

## 6. Report Evidence Boundary

Slice B must separate **internal validation artifacts** from the **shareable comparison report**.

Allowed internal artifacts under `experiments/docx-adapter-comparison/**`:

- generated `.docx` files;
- extracted XML files or probe scratch files;
- adapter-local logs needed to reproduce validation.

Allowed shareable report evidence:

- assertion IDs;
- booleans;
- counts;
- SHA-256 hashes;
- package part names;
- issue codes;
- verdict/status values;
- short non-content summaries.

Forbidden in JSON/Markdown reports and terminal summaries:

- raw `word/document.xml`;
- raw XML snippets;
- raw source body text;
- raw paragraph dumps;
- raw evidence dumps;
- `DocxMatchReview.sectionReview.found` if it includes source-derived section text;
- diagnostic messages that include source text instead of issue codes.

The comparison report must be allowlist-serialized. Leakage checks must cover forbidden keys **and** forbidden raw value patterns/artifact dumps, not key names only.

## 7. Required Validation Gates

### Gate A — Boundary gate

Pass conditions:
- Contract and intermediate are built using Slice A product library.
- Contract hash and intermediate hash are recorded.
- Adapter receives intermediate document, not raw source/evidence.
- No forbidden leakage keys appear in contract, intermediate, adapter result, record, or comparison report.

### Gate B — DOCX package gate

For each generated `.docx`, required package parts:

```text
[Content_Types].xml
_rels/.rels
word/document.xml
```

When relationships are emitted, check `word/_rels/document.xml.rels`.

Failure behavior:
- Missing core package parts → `adapterResult.validationErrors`.
- Corrupt/unreadable zip/package → `adapterResult.validationErrors`.
- Probe exceptions → `adapterResult.validationErrors`.

These must force `reviewDocxExport(...).verdict === "fail"`.

### Gate C — Structural XML gate

Inspect `word/document.xml`, and when relevant `word/numbering.xml` and `word/styles.xml`.

Required evidence:
- Document title appears as a distinct paragraph/run.
- Chinese level-1 headings from fixture appear.
- Chinese level-2 subsection appears.
- Paragraph and citation/reference text survive.
- Ordered list and unordered list are distinguishable; prefer `w:numFmt` evidence for decimal vs bullet, not only generic `w:numPr`.
- Simple table exists; fixture expectation is 2 columns and 1 data row, allowing header + data rows in XML.
- Style/font evidence may come from `word/document.xml` or `word/styles.xml`.

Failure behavior:
- Missing required block evidence → `adapterResult.validationErrors`.
- Ordered/unordered list probe failure → `adapterResult.validationErrors`.
- Table row/column mismatch → `adapterResult.validationErrors`.

### Gate D — Review/record gate

For the positive fixture:
- `reviewDocxExport(...)` must be `pass` or `warn`, not `fail`.
- `buildDocxExportRecord(...)` must produce `success` or `warning`, not `failed`.
- Any `warn` must be explainable through `knownWarnings`.

### Gate E — Redacted risk/report gate

Each candidate report must include capability list, unsupported capability list, package validation summary, structural assertion summary, `reviewSummary`, `recordSummary`, packaging risk, license risk, maintenance risk, runtime cost, tested/not-tested, confidence, and explicit non-binding recommendation.

The report must not include raw review objects or raw records. It must include only redacted summaries:

```ts
reviewSummary: {
  verdict: "pass" | "warn" | "fail"
  blockingIssueCodes: string[]
  warningCodes: string[]
}
recordSummary: {
  status: "success" | "warning" | "failed"
  exportContractHash: string
  intermediateHash: string
  adapterId: string
}
```

If a probe needs exact content matching internally, the report records only the assertion ID, pass/fail, count/hash, and issue code.

## 8. Fail vs Warn Taxonomy

### Must fail

- Corrupt `.docx`.
- Missing core DOCX package parts.
- Missing `word/document.xml`.
- Missing expected document title.
- Missing required headings/sections.
- Missing ordered or unordered list evidence.
- Table row/column mismatch.
- Structural probe exception.
- Forbidden leakage keys/raw evidence dump detected.
- `reviewDocxExport` blocking issues.

### May warn only if required structural probes pass

- CJK font/size not fully expressible.
- Style name differs but structure is correct.
- Optional spacing/margin evidence incomplete.
- Adapter supports a feature but with degraded formatting.
- Sidecar/runtime/package risk is unresolved but isolated.

## 9. Testable Acceptance Criteria

Slice B execution is complete only when a later executor can prove:

1. Both candidates are run against the same Slice A contract/intermediate fixture, or one candidate has a reproducible environment blocker documented in its report.
2. Both completed candidates return `DocxAdapterResultLike`.
3. Both completed candidates produce a comparison report using the required redacted schema.
4. Any probe failure is reflected in `adapterResult.validationErrors` and `reviewSummary.blockingIssueCodes` when it blocks success.
5. Positive fixture review is `pass` or `warn`, never silently accepted after structural failure.
6. Export record status is `success` or `warning` only when review is not `fail`.
7. Reports contain no forbidden leakage keys, raw XML snippets, raw paragraph dumps, raw source text, or raw evidence dumps.
8. Reports include redacted `reviewSummary` and `recordSummary` instead of raw review/record objects.
9. Reports include non-binding recommendations only.
10. No root product dependency, UI, store, Tauri, or product `src/**` changes are made.
11. Final Slice B result explicitly says whether Slice C is ready to choose an adapter or needs another experiment.

## 10. Verification Steps for Later Execution

Experiment commands to define in `experiments/docx-adapter-comparison/README.md`:

```powershell
npm --prefix experiments/docx-adapter-comparison run compare:ts-docx
npm --prefix experiments/docx-adapter-comparison run compare:openxml
npm --prefix experiments/docx-adapter-comparison run compare
```

Repository-level verification after Slice B execution:

```powershell
npx vitest run src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
npm run typecheck
```

Expected evidence:
- Slice A tests still pass.
- Typecheck still passes.
- Experiment reports exist under `experiments/docx-adapter-comparison/reports/`.
- No product dependency graph changes.
- No UI/store/Tauri changes.
- No final adapter selected.

## 11. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| XML probes create false confidence | Keep recommendation non-binding; require tested/not-tested and manual openability note if available. |
| TS adapter appears easier but hides future DOCX limitations | Require unsupported capability list and CJK/list/table probes. |
| OpenXML sidecar appears stronger but is packaging-heavy | Require runtimeCost and packagingRisk fields. |
| Dependency/license risk is ignored | Require licenseRisk field and dependency-expert follow-up. |
| Fixture unfairly favors one adapter | Both consume same intermediate; no adapter-specific input shaping. |
| Report leaks raw source/evidence/XML | Separate internal artifacts from shareable reports; allowlist assertion IDs/counts/hashes/codes; scan keys and values. |
| Experiment accidentally becomes product integration | Hard write-scope boundary: `experiments/docx-adapter-comparison/**` only. |

## 12. ADR

### Decision

Run Slice B as an experiment-only adapter comparison under `experiments/docx-adapter-comparison/**`, comparing:

1. TS/JS `docx` adapter candidate.
2. OpenXML SDK sidecar candidate.

Do not choose a final adapter in Slice B.

### Drivers

- Need fair evidence before Slice C.
- Need to preserve Slice A boundary.
- Need to prevent UI/store/package/Tauri work before adapter proof.
- Need to compare product integration cost, DOCX reliability, and maintainability.

### Alternatives considered

- **TS/JS `docx` only** — rejected as premature; may optimize for speed without proving OpenXML control tradeoff.
- **OpenXML sidecar only** — rejected as premature; may overfit long-term power while increasing MVP packaging burden.
- **External template-file v1 route** — rejected by product boundary.
- **Direct UI export button** — rejected because adapter/review evidence is not complete.

### Why chosen

A fair experiment lets Slice C make an evidence-backed adapter decision without polluting product code or changing dependencies prematurely. The formal comparison report is intentionally redacted: full DOCX/XML artifacts remain reproducible inside the experiment directory, while the report carries assertion IDs, counts, hashes, issue codes, verdicts, and status summaries.

### Consequences

- Slice B will not ship user-visible export UI.
- Slice B will not select the final adapter.
- Slice B may introduce experiment-local manifests only.
- Slice C must consume the redacted comparison report before choosing adapter integration.
- Slice C may inspect internal experiment artifacts manually if needed, but must not copy raw XML/source dumps into product records.

### Follow-ups

- Slice C: adapter selection and MVP DOCX writing plan.
- Slice D: UI/store/manual export flow only after Slice C.
- Optional later: richer OpenXML validation and manual Word/LibreOffice openability checks.

## 13. Available-Agent Roster

- `planner` — plan refinement and sequencing.
- `architect` — adapter boundary and product integration review.
- `critic` — plan/test adequacy review.
- `executor` — experiment implementation.
- `test-engineer` — validation harness and acceptance checks.
- `verifier` — final evidence review.
- `dependency-expert` — package/license/runtime comparison.
- `researcher` — official docs/reference checks.
- `code-reviewer` — final PR-style review.

## 14. Follow-up Staffing Guidance

### Ralph path

Use `$ralph` when one owner should implement and verify the experiment sequentially.

Recommended staffing:
- `executor`, medium reasoning: implement experiment harness and two adapter lanes.
- `dependency-expert`, high reasoning: evaluate `docx` npm and OpenXML SDK dependency/runtime/license risk.
- `verifier`, high reasoning: confirm report, gates, and no product-scope leakage.

Suggested handoff:

```text
$ralph implement .omx/plans/active/ralplan-docx-export-sliceB-adapter-comparison.md
```

### Team path

Use `$team` if parallelizing candidate lanes is preferred.

Suggested lanes:
1. `executor` — shared harness/report schema.
2. `executor` — TS/JS `docx` candidate.
3. `executor` — OpenXML sidecar candidate.
4. `test-engineer` — package/XML/review gates.
5. `dependency-expert` — license/runtime/maintenance risk.
6. `verifier` — final evidence and boundary review.

Suggested launch hint:

```text
$team implement Slice B adapter comparison from .omx/plans/active/ralplan-docx-export-sliceB-adapter-comparison.md
```

Team verification path:
- Team proves both candidates ran or records exact blocker.
- Team proves Slice A tests/typecheck still pass.
- Team proves no forbidden product files changed.
- Verifier confirms comparison report is non-binding and complete.

## 15. Goal-Mode Follow-up Suggestions

- `$ultragoal` — default if this should become a durable multi-step implementation goal.
- `$autoresearch-goal` — use only if the next phase becomes primarily dependency/reference research.
- `$performance-goal` — not recommended for Slice B unless adapter generation speed/memory becomes the primary objective.

## 16. Stop Condition

Stop Slice B when:
1. Both adapter candidates have comparable reports, or one candidate has a documented reproducible blocker.
2. Validation gates are applied consistently.
3. The comparison report is complete.
4. No final adapter is selected.
5. No product dependency/UI/store/Tauri changes are made.


## 17. Consensus Changelog

- Architect review required stronger separation between internal validation artifacts and shareable comparison evidence.
- Revised report schema from free-form `structuralEvidence` / `evidenceSummary` strings to redacted structural assertions, issue codes, counts, hashes, review summary, and record summary.
- Strengthened leakage gate from key-only scanning to forbidden keys plus raw value/artifact dump detection.
- Clarified that raw XML/DOCX artifacts can exist under the experiment directory but must not be copied into JSON/Markdown reports or terminal summaries.
