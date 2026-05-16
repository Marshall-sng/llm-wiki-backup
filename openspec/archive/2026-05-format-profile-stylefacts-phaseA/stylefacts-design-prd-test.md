# FormatProfile StyleFacts Phase A — 设计 / PRD / 测试合并归档

归档说明：StyleFacts 产品化 Phase A 已完成并进入后续 FormatSpec / semantic overlay 链路；保留原设计输入、PRD 与测试规格全文，减少 plans 根目录噪音。


---

## 原文件：`active/format-profile-stylefacts-productization-design-intake.md`


# FormatProfile StyleFacts 产品化设计输入（2026-05-14）

状态：discussion-ready / no implementation yet

## 1. 为什么需要本文件

上一个实验已经证明 StyleFacts 可行，但完整阅读 `.omx/plans` 后，产品化不能只理解为“把字体字号显示出来”。它必须放回 llm_wiki 的正式材料闭环：FormatProfile、FormatBinding、Draft、generationInstruction、diagnostics、后续 Match Report / Export / Audit。

## 2. 必须继承的既有决策

- 手动输入模板当前版本完全放弃；不得作为兼容入口恢复。
- 四格式 FormatProfile 确定性探测产品化已通过；不再重复证明四格式能否导入。
- LLM 语义精炼通过实验验证，但产品链路仍未接入。
- DataScope 实验结论：默认 evidence-only；snippets/fulltext 只允许显式授权后作为高级/补救候选。
- StyleFacts 实验结论：确定性 parser 是样式事实源；LLM 只能解释、诊断、引用 evidence，不得生成/覆盖事实。
- 原始迁移需求仍要求：Draft/版本/diff guard、模板/格式匹配报告、正式导出、审计/来源、长文工程，但这些应分阶段，不可一次性伪完成。

## 3. 上一版口头产品化设计遗漏项

1. 漏掉 `FormatBinding`：StyleFacts 必须进入绑定/快照，而不仅是 UI 卡片。
2. 漏掉两条路径：先选画像生成底稿、已有底稿再适配画像。
3. 漏掉 Draft/version 前置约束：正式输出必须确认底稿版本。
4. 漏掉 Match Report 预留：StyleFacts 将来要参与格式匹配检查。
5. 漏掉 Audit / Provenance 预留：evidence、hash、overlay、dataScope、model 元数据需要可追踪。
6. 漏掉 DataScope 产品默认：不得默认发送 snippets/fulltext。
7. 漏掉 LLM renderer 合同：最终 instruction 由 renderer 合成，不由 LLM 直接生成。
8. 漏掉非程序员原则：UI 默认应是人类摘要，不要求用户理解 evidence hash。
9. 漏掉状态克制原则：不要新增噪音任务流，只显示当前阶段和失败原因。
10. 漏掉导出/复刻边界：不得因 StyleFacts 通过就承诺 DOCX/PDF/PPTX/XLSX 导出。

## 4. 建议的最小产品化闭环

```text
probe_format_profile
  → buildStyleFactsFromProbe()
  → FormatProfileRecord.styleFacts
  → styleSummaryForHumans
  → FormatBinding/ProfileSnapshot includes styleFactsSha256
  → generationInstruction uses bounded style summary
  → UI shows summary + diagnostics + collapsible evidence
```

第一版只做 deterministic StyleFacts 产品化，不接真实 LLM overlay。

## 5. 建议数据契约

### 5.1 StyleFact leaf

```ts
type StyleFact<T = unknown> = {
  value: T
  unit?: "pt" | "twip" | "cm" | "halfPoint" | "emu" | "rgb"
  confidence: "high" | "medium" | "low" | "unknown"
  evidenceRefs: string[]
  derived?: boolean
  notes?: string[]
}
```

### 5.2 FormatProfileRecord 扩展

```ts
interface FormatProfileRecord {
  styleFacts?: StyleFactsEnvelope
  refinement?: {
    semanticStatus: "not-configured" | "accepted" | "rejected" | "fallback"
    dataScope: "evidence-only" | "evidence-plus-snippets" | "evidence-plus-fulltext"
    overlayHash?: string
    evaluatorVerdict?: "pass" | "fail"
  }
}
```

第一版可只落 `styleFacts`，`refinement` 作为显式后置预留。

### 5.3 FormatBinding / Snapshot 扩展

```ts
interface FormatBindingSnapshot {
  profileId: string
  profileSnapshotHash: string
  styleFactsSha256?: string
  styleFactsSchemaVersion?: string
  dataScope?: "evidence-only"
  semanticStatus?: "not-configured"
}
```

## 6. UI 原则

- 默认展示：字体、字号、页面、样式定义、结构/表格/主题/扫描诊断的人类摘要。
- 证据详情：折叠展示，允许复制/查看，但不是主操作。
- 长列表：必须有 `max-height + overflow-y-auto + break-words + min-w-0`。
- 边界提示：明确“用于底稿约束，不代表导出复刻”。
- 未接 LLM 时显示：“当前为确定性样式事实，未进行智能精炼”。

## 7. generationInstruction 原则

- 只注入 bounded summary，不注入完整 evidence JSON。
- DOCX 优先：中文主字体/常见字号/页面尺寸/样式定义/段落样式。
- XLSX：转译为表格结构、指标口径、合并/公式/样式复杂度。
- PPTX：转译为汇报结构、主题/版式诊断。
- PDF：低/中置信参考，并明确不承诺还原。

## 8. 暂不做但必须预留

- LLM semantic overlay 产品接入。
- snippets/fulltext 授权 UI。
- Template / Format Match Report。
- Formal Export Pipeline。
- Output Audit / Provenance 完整面板。
- Long Document Project。

## 9. PRD 前置问题

进入实现前需要在下一轮讨论中确认：

1. 本阶段是否只做 deterministic StyleFacts 产品化？
2. `FormatBindingSnapshot` 是否本阶段扩展，还是只扩展 `DraftProcessingFormatProfileSnapshot`？
3. UI 是否先在现有 FormatProfilesView 内增量展示，还是拆新组件？
4. 是否允许迁移实验中的 verifier 思路到单元测试，而非运行实验脚本？
5. `runtime/` 实验输出是否仅作为测试 fixture 参考，不进入产品包？


---

## 原文件：`prd-format-profile-stylefacts-productization-phaseA.md`


# PRD: FormatProfile StyleFacts Productization Phase A

**Status:** ready for execution planning  
**Date:** 2026-05-14  
**Companion test spec:** `.omx/plans/test-spec-format-profile-stylefacts-productization-phaseA.md`  
**Source context:** `.omx/plans/active/format-profile-stylefacts-productization-design-intake.md`, `.omx/context/format-profile-stylefacts-productization-20260513T163410Z.md`  
**Planning boundary:** this artifact only; no product source edited.

## 1. Product outcome

Phase A productizes experiment-proven deterministic `StyleFacts` inside the existing `FormatProfile` pipeline. After a user imports a finished DOCX / XLSX / PPTX / PDF format profile, the product must:

1. Build a deterministic, evidence-cited `StyleFactsEnvelope` from the existing `probe_format_profile` result.
2. Store the envelope on `FormatProfileRecord` and persist it with the profile.
3. Derive the existing loose `styleProfile` and human-facing style summaries from `StyleFacts`, instead of maintaining a second probe-to-summary logic path.
4. Capture `styleFactsSha256`, schema version, data scope, and semantic status in the draft-processing profile snapshot / binding surface.
5. Show human-readable style facts and diagnostics in the Format Profiles UI with collapsible evidence details.
6. Inject only a bounded human summary into `generationInstruction` and draft-processing prompts.
7. Explicitly avoid LLM product integration, snippets/fulltext data scopes, export fidelity promises, or full Match Report/Audit implementation in Phase A.

## 2. Evidence-grounded current state

- Product profile model is `FormatProfileRecord` in `src/lib/format-profile.ts:21-54`; it currently has `structureProfile.evidenceSummary`, loose `styleProfile` objects, `writingProfile.generationInstruction`, diagnostics, and text sample, but no first-class `styleFacts`.
- Current style extraction is loose summary logic in `buildStyleProfile` (`src/lib/format-profile.ts:349-414`) that reads `probe.style` directly and fills `styleProfile.evidenceSummary`.
- `buildGenerationInstruction` currently injects `profile.styleProfile.evidenceSummary` (`src/lib/format-profile.ts:464-488`).
- Profile creation calls `buildStyleProfile`, then `constraintsFor`, then `buildGenerationInstruction` (`src/lib/format-profile.ts:490-525`).
- Product snapshots exist in two places: `buildFormatProfileSnapshot` (`src/lib/format-profile.ts:528-538`) and `buildDraftFormatProfileSnapshot` (`src/lib/draft-processing.ts:31-42`). Both currently omit StyleFacts metadata.
- Draft-processing prompt inclusion is explicit and scoped to selected profile processing (`src/lib/draft-processing.ts:15-29`, `src/lib/draft-processing.ts:75-95`).
- UI currently displays `selectedProfile.styleProfile.evidenceSummary` and structure evidence (`src/components/format-profiles/format-profiles-view.tsx:220-239`), diagnostics (`242-260`), and the raw generation instruction (`262-266`).
- Persistence uses envelope version `1` and passes profile objects through without migration (`src/lib/format-profile-persist.ts:5-45`).
- The product probe type already exposes `structure?: Record<string, unknown>` and `style?: Record<string, unknown>` (`src/commands/fs.ts:50-60`), matching the experiment's parser inputs.
- Experiment StyleFacts proved the target shape: fact leaves have `value`, `confidence`, `evidenceRefs`, optional `unit`, `derived`, and `notes` (`experiments/format-profile-style-extraction/scripts/lib/style-parser.mjs:32-44`); DOCX/XLSX are primary rich cases (`55-130`), PPTX/PDF are baseline diagnostic cases (`134-180`); envelope metadata includes deterministic `styleFactsSha256` (`223-254`).

## 3. Scope

### In scope

- TypeScript product data model for deterministic StyleFacts.
- Deterministic StyleFacts builder for current `FormatProfileProbe` data.
- Stable JSON + SHA-256 helper in product code, implemented without adding a dependency.
- `FormatProfileRecord.styleFacts` plus compatibility-preserving derived `styleProfile`.
- `DraftProcessingFormatProfileSnapshot` / profile snapshot metadata extension.
- UI copy and display for human summary, diagnostics, and evidence details.
- Bounded `generationInstruction` and draft-processing prompt integration.
- Persistence/backcompat handling for existing profiles without `styleFacts`.
- Unit/component-level tests and typecheck/build verification.

### Out of scope / non-goals

- No LLM overlay/refinement product integration.
- No snippets/fulltext authorization UI or default transmission of source text beyond existing extracted text behavior.
- No restoration of manual template input.
- No DOCX/PDF/PPTX/XLSX export implementation and no high-fidelity visual reproduction promise.
- No full Match Report, Formal Export, Output Audit, or Long Document Project implementation.
- No backend rewrite unless the existing product probe lacks a required deterministic field; Phase A should first consume `probe.structure` and `probe.style` as available.
- No experiment runtime output shipping in the product bundle; experiment artifacts may be used only as test/reference fixtures.

## 4. RALPLAN-DR

### Principles

1. **Deterministic fact authority:** parser-produced StyleFacts are the only style fact source.
2. **No duplicate style logic:** legacy `styleProfile`/`evidenceSummary` must be derived from StyleFacts or retained only as optional backcompat fields.
3. **Bounded product exposure:** UI and prompts show summaries by default; raw evidence is available but not the primary user action.
4. **Explicit binding boundary:** profile snapshots carry enough StyleFacts metadata to make future Draft/version/Audit/Match work traceable.
5. **Phase discipline:** no LLM, rich data scopes, export fidelity, or audit workflow is smuggled into Phase A.

### Decision drivers

1. Fit into existing `FormatProfile` import → profile → active binding → draft-processing flow with minimal disruption.
2. Preserve deterministic reproducibility and backcompat for persisted profiles.
3. Improve user and prompt quality by replacing weak summaries with evidence-cited StyleFacts-derived summaries.

### Options considered

| Option | Approach | Pros | Cons | Verdict |
| --- | --- | --- | --- | --- |
| A. Product TypeScript StyleFacts module | Add product `StyleFacts` types/builder using current `FormatProfileProbe`; derive legacy `styleProfile` from it. | Minimal backend churn; keeps UI/prompt pipeline close to existing `format-profile.ts`; easy unit tests. | Needs a product stable hash helper; TS parser must stay aligned with experiment. | **Chosen.** |
| B. Backend/Tauri builds StyleFacts | Move parser + hash into `probe_format_profile`; frontend only stores/display envelope. | Strong backend determinism; real SHA-256 easy in Rust. | Larger frontend/backend API change; harder UI iteration. | Defer unless TS builder cannot get required fields. |
| C. Keep old styleProfile and add StyleFacts beside it | Add `styleFacts` but leave `buildStyleProfile` as-is. | Fastest patch. | Violates no-duplicate-logic requirement; future drift between summary and facts. | Rejected. |

## 5. Data model requirements

### 5.1 Product StyleFacts types

Add product-owned types, preferably in a new focused module such as `src/lib/style-facts.ts`.

```ts
export type StyleFactConfidence = "high" | "medium" | "low" | "unknown"
export type StyleFactUnit = "pt" | "twip" | "cm" | "halfPoint" | "emu" | "rgb"

export interface StyleFact<T = unknown> {
  value: T
  unit?: StyleFactUnit
  confidence: StyleFactConfidence
  evidenceRefs: string[]
  derived?: boolean
  notes?: string[]
}

export interface StyleFactEvidence {
  id: string
  kind: string
  pointer: string
  confidence: StyleFactConfidence
  sha256: string
}

export interface StyleFactsEnvelope {
  schemaVersion: "format-profile-style-facts.v0"
  source: {
    fileType: FormatProfileFileType
    sourceName: string
    sourcePath?: string
  }
  parser: {
    deterministic: true
    authority: "deterministic-parser"
    evidenceAuthority: "parser-generated"
  }
  capabilities: {
    canGuideGeneration: true
    canGuideAdaptation: true
    canGuideExport: false
    highFidelityScope: string
    llmMayInterpret: true
    llmMayCreateFacts: false
  }
  styleFacts: Record<string, unknown>
  evidence: StyleFactEvidence[]
  diagnostics: FormatProfileDiagnostic[]
  metadata: {
    styleFactsSha256: string
    builtAt: number
  }
}
```

Acceptance details:

- Every non-summary fact leaf must include non-empty `evidenceRefs` that resolve to `evidence[].id`.
- Derived facts must still cite deterministic evidence and mark `derived: true`.
- Schema version must remain `format-profile-style-facts.v0` for Phase A.
- `capabilities.canGuideExport` must be `false`; generation/adaptation guidance is allowed, export fidelity is not.
- `metadata.styleFactsSha256` must be a SHA-256 over a stable JSON representation of deterministic envelope fields excluding non-deterministic metadata such as `builtAt`.

### 5.2 `FormatProfileRecord` extension

Extend `FormatProfileRecord` (`src/lib/format-profile.ts:21-54`):

```ts
interface FormatProfileRecord {
  styleFacts?: StyleFactsEnvelope
  refinement?: {
    semanticStatus: "not-configured"
    dataScope: "evidence-only"
  }
}
```

Phase A persistence rule:

- New profiles must include `styleFacts`.
- New profiles may include `refinement: { semanticStatus: "not-configured", dataScope: "evidence-only" }` only if this improves future traceability without UI noise.
- Phase A runtime types must not expose `accepted` / `rejected` / `fallback` semantic states or `evidence-plus-snippets` / `evidence-plus-fulltext`; those belong to Phase B+ design notes only.
- Existing profiles without `styleFacts` must still load; migration can either leave them as legacy profiles or lazily derive a minimal low-confidence envelope only when probe/source data is available.
- Do not invent facts from old summaries.

### 5.3 Legacy `styleProfile` compatibility

`styleProfile` remains only as a compatibility/presentation bridge for current stores/tests/UI. Phase A must change its construction:

- Replace direct `probe.style` summary logic in `buildStyleProfile` (`src/lib/format-profile.ts:349-414`) with `deriveStyleProfileFromStyleFacts(styleFacts, fileType)`.
- `styleProfile.evidenceSummary` must be exactly the bounded human summary returned by `styleSummaryForHumans(styleFacts, fileType)` or a documented subset of it.
- `styleProfile.typography`, `layout`, `colors`, and `formatSpecific` may remain, but values must be derived from canonical StyleFacts paths rather than reparsing `probe.style`.
- If `styleFacts` is absent on a legacy profile, existing display can degrade to the persisted legacy `styleProfile`; do not produce new StyleFacts hashes from loose summary strings.

### 5.4 `FormatBinding` / `ProfileSnapshot`

No separate durable `FormatBinding` entity exists yet in product source. Phase A therefore extends the existing draft-processing snapshot boundary and names it as the current binding snapshot.

Extend `DraftProcessingFormatProfileSnapshot` (`src/stores/chat-store.ts:21-35`) and both snapshot builders (`src/lib/format-profile.ts:528-538`, `src/lib/draft-processing.ts:31-42`):

```ts
interface DraftProcessingFormatProfileSnapshot {
  id: string
  title: string
  fileType: "docx" | "xlsx" | "pptx" | "pdf" | "unknown"
  confidence: "high" | "medium" | "low"
  profileSnapshotHash: string
  generationInstruction: string
  diagnostics: FormatProfileDiagnostic[]
  capturedAt: number

  styleFactsSha256?: string
  styleFactsSchemaVersion?: "format-profile-style-facts.v0"
  styleFactsSummary?: string[]
  dataScope?: "evidence-only"
  semanticStatus?: "not-configured"
}
```

Snapshot acceptance details:

- `profileSnapshotHash` should include `updatedAt` and `styleFactsSha256` when present.
- Snapshot must not embed raw `styleFacts.evidence` or full fact JSON in draft prompts.
- Snapshot captures `styleFactsSummary` so later draft-processing records can show what summary was used, even if the profile changes.
- `dataScope` defaults to `evidence-only`; `semanticStatus` defaults to `not-configured`.
- `buildFormatProfileSnapshot` and `buildDraftFormatProfileSnapshot` must not diverge; prefer one shared helper or delegate one to the other.

## 6. Parser / builder requirements

### 5.5 Hashing and sync contract

Phase A must preserve the existing synchronous `buildFormatProfileFromExtractedText` API. Therefore:

- Use a product-owned pure TypeScript synchronous SHA-256 helper over stable JSON.
- Do not switch `buildFormatProfileFromExtractedText` or UI import flow to async solely for hashing.
- Do not add a hashing dependency in Phase A.
- `metadata.styleFactsSha256` is computed from deterministic envelope fields after sorting object keys and excluding `metadata.builtAt`.
- Tests must prove same semantic input yields the same hash and changed fact values change the hash.

### 6.1 Builder entry points

Add functions equivalent to:

```ts
buildStyleFactsFromProbe(input: {
  fileType: FormatProfileFileType
  sourceName: string
  sourcePath?: string
  probe?: FormatProfileProbe | null
  now?: number
}): StyleFactsEnvelope

styleSummaryForHumans(styleFacts?: StyleFactsEnvelope, fileType?: FormatProfileFileType): string[]
deriveStyleProfileFromStyleFacts(styleFacts: StyleFactsEnvelope, fileType: FormatProfileFileType): FormatProfileRecord["styleProfile"]
```

Then update `buildFormatProfileFromExtractedText` (`src/lib/format-profile.ts:490-525`) order:

1. Infer file type and sections as today.
2. Build deterministic `styleFacts` from `input.probe`.
3. Derive `styleProfile` from `styleFacts`.
4. Build constraints and `generationInstruction` from StyleFacts summary.
5. Store `styleFacts` on the returned profile.

### 6.2 Format-specific minimum fact coverage

| Format | Phase A coverage | Confidence/product boundary |
| --- | --- | --- |
| DOCX | page size/margins, fonts, font usage, half-point and pt sizes, style count/IDs/definitions, paragraph style usage, paragraph/run/table counts, numbering definitions. Phase A explicitly excludes paragraph sample text from persisted `styleFacts`; paragraph samples may remain in existing legacy structure fields but are not StyleFacts evidence and are not promptable. | High when probe style/structure exists. |
| XLSX | workbook sheet count/names, sheet stats/dimensions, style counts, font/fill/border counts, shared string count, merged/formula counts | High for workbook/style counts; generation translates to table/metric guidance, not spreadsheet creation. |
| PPTX | slide/layout/master counts, slide stats sample, theme name/count, color/font scheme counts | Medium/baseline; summary must call it presentation-structure/theme diagnostics, not renderer-grade layout. |
| PDF | page count, font refs, scan/image/text-operator risk where available | Medium/low diagnostic; must say PDF is low-fidelity finished-file reference. |

## 7. UI requirements

Update `src/components/format-profiles/format-profiles-view.tsx` and i18n keys in `src/i18n/zh.json` / `src/i18n/en.json`.

Required UX:

1. Default visible card: human summary from `styleSummaryForHumans` with labels for font, font size, page/layout, style definitions, workbook/deck/page structure, and confidence.
2. Boundary notice: “Deterministic style facts for draft constraints; not export or visual reproduction.” Chinese equivalent required.
3. No-LLM notice: “Current phase uses deterministic style facts only; no intelligent refinement has been applied.” Chinese equivalent required.
4. Diagnostics section merges existing profile diagnostics with `styleFacts.diagnostics` or displays StyleFacts diagnostics separately.
5. Collapsible evidence details: evidence id, kind, pointer, confidence, and sha256. Raw fact values may be summarized or shown in a scrollable `<pre>` only behind the details element.
6. Long lists must use `max-height`, `overflow-y-auto`, `break-words`, and `min-w-0`, consistent with current list handling at `format-profiles-view.tsx:204-239`.
7. Do not require non-programmer users to understand evidence hashes for normal operation.

## 8. `generationInstruction` and prompt requirements

Update `buildGenerationInstruction` (`src/lib/format-profile.ts:464-488`) and draft prompt formatting (`src/lib/draft-processing.ts:15-29`, `75-95`):

- Use bounded `styleFactsSummary`, not full evidence JSON.
- Include at most 8 style summary bullets in generation instruction and at most 6 in draft-processing profile snapshot formatting.
- Include schema/hash metadata as trace text only if concise: `StyleFacts: format-profile-style-facts.v0 / <first 12 chars of hash>`.
- Include Phase A boundary wording: deterministic style facts guide draft structure/style; they do not promise export fidelity or exact visual reproduction.
- Never include raw snippets/fulltext from evidence in the prompt. Bounded paragraph samples already present in deterministic facts must not be dumped into prompt summaries.
- Do not call or configure an LLM refiner in Phase A.

## 9. Persistence and backcompat requirements

- Keep `FormatProfileEnvelope.version` at `1` unless a loader migration becomes necessary for correctness; additive optional `styleFacts` fields are compatible with current JSON persistence.
- Add loader normalization in `src/stores/format-profile-store.ts` and/or `src/lib/format-profile-persist.ts` so missing `styleFacts`, missing `styleProfile.evidenceSummary`, or missing new snapshot fields do not crash.
- Existing profiles loaded from `.llm-wiki/format-profiles.json` must remain selectable and usable.
- New saves must preserve `styleFacts`, `styleFactsSha256`, and `styleFactsSchemaVersion`.
- Do not synthesize `styleFactsSha256` from legacy `styleProfile.evidenceSummary`; if facts are absent, snapshot metadata remains absent/legacy.

## 10. Implementation plan for executor handoff

1. **Add product StyleFacts model/helpers**
   - Create `src/lib/style-facts.ts` and `src/lib/style-facts.test.ts`.
   - Port the experiment's stable fact-leaf rules and format-specific mapping from `experiments/format-profile-style-extraction/scripts/lib/style-parser.mjs` into product TypeScript.
   - Add stable JSON + SHA-256 helper without new dependencies.
2. **Integrate into FormatProfile builder**
   - Update `src/lib/format-profile.ts` data model with `styleFacts` and optional `refinement`.
   - Change profile build flow so `styleProfile` and `evidenceSummary` are derived from StyleFacts.
   - Update generation instruction construction to consume bounded StyleFacts summaries.
3. **Unify snapshot/binding metadata**
   - Extend `DraftProcessingFormatProfileSnapshot` in `src/stores/chat-store.ts`.
   - Update both snapshot builder surfaces and remove divergence by sharing one builder.
   - Update `src/lib/draft-processing.ts` prompt formatting to include summary/hash metadata only.
4. **Update UI and i18n**
   - Replace the existing style summary card with StyleFacts-derived summary.
   - Add boundary/no-LLM copy and evidence details.
   - Add/adjust English and Chinese i18n keys.
5. **Persistence/backcompat guardrails**
   - Normalize legacy profiles defensively.
   - Add tests proving old envelopes load and new envelopes preserve StyleFacts.
6. **Verification pass**
   - Add/adjust tests in `format-profile`, `style-facts`, `draft-processing`, `format-profile-persist`, and UI/i18n parity as needed.
   - Run targeted tests, typecheck, and build.

## 11. Acceptance criteria

- New imported profiles include `profile.styleFacts.schemaVersion === "format-profile-style-facts.v0"` and `profile.styleFacts.metadata.styleFactsSha256`.
- Every StyleFact leaf has non-empty evidence refs resolving to the envelope evidence catalog.
- `styleProfile.evidenceSummary` for new profiles is derived from StyleFacts; tests fail if the old direct `probe.style` summary path is reintroduced.
- `buildGenerationInstruction` includes bounded StyleFacts summary text and does not include raw evidence JSON.
- `DraftProcessingFormatProfileSnapshot` includes `styleFactsSha256`, schema version, `dataScope: "evidence-only"`, and `semanticStatus: "not-configured"` for new StyleFacts-backed profiles.
- Draft-processing prompts include selected profile StyleFacts summary/boundary text only when a profile snapshot is supplied.
- UI displays human summary, deterministic/no-LLM boundary, diagnostics, and collapsible evidence; long evidence lists remain scrollable and do not overflow.
- Existing persisted profiles without `styleFacts` load and remain usable.
- No Phase A code invokes LLM refinement, adds rich data scope authorization, or promises export/visual reproduction.

## 12. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| StyleFacts and legacy `styleProfile` drift | Make StyleFacts canonical and derive `styleProfile` from it for all new profiles. |
| Hash instability across object key order or timestamps | Stable JSON helper excludes non-deterministic metadata and sorts keys before SHA-256. |
| Hash implementation disrupts synchronous builder flow | Use a product-owned pure TypeScript synchronous SHA-256 helper; keep `buildFormatProfileFromExtractedText` synchronous; no new dependency in Phase A. |
| UI overwhelms non-programmers with evidence | Human summary first; evidence behind collapsible details. |
| PPTX/PDF baseline facts are overrepresented as high fidelity | Confidence and diagnostics label them baseline/low-fidelity. |
| Backcompat migration invents facts | Never derive StyleFacts from old summary strings; treat missing facts as legacy. |
| FormatBinding scope grows into full audit/export design | Phase A only extends existing draft-processing snapshot and reserves metadata. |

## 13. ADR

**Decision:** Productize deterministic StyleFacts with a product TypeScript `style-facts` module, store `StyleFactsEnvelope` on `FormatProfileRecord`, derive legacy summaries from StyleFacts, and extend draft-processing snapshots with StyleFacts metadata.

**Drivers:** deterministic fact authority; compatibility with current FormatProfile flow; removal of duplicate loose style summary logic; future binding/audit traceability.

**Alternatives considered:** backend-built StyleFacts via Tauri probe; adding StyleFacts beside old styleProfile logic; LLM-generated style facts.

**Why chosen:** the TypeScript module is the smallest productized path that improves existing UI/prompt behavior while preserving the current import pipeline and avoiding Phase A backend churn.

**Consequences:** product code gains a stable StyleFacts schema and hash helper; old profile summaries become compatibility views; future LLM overlay must attach only as interpretation/refinement and cannot overwrite facts.

**Follow-ups:** Phase B may plan LLM overlay product integration; future phases may introduce explicit `FormatBinding`, Match Report, Output Audit, and export checks using `styleFactsSha256` as a trace anchor.

## 14. Execution handoff guidance

Recommended lane: `$ralph` or single executor because most changes are coupled through `src/lib/format-profile.ts` and tests. Use `$team` only if splitting clearly into non-overlapping lanes:

- Lane 1: `src/lib/style-facts.ts` + tests.
- Lane 2: `src/lib/format-profile.ts`, `src/lib/draft-processing.ts`, `src/stores/chat-store.ts` integration.
- Lane 3: `src/components/format-profiles/format-profiles-view.tsx` + i18n.
- Lane 4: persistence/backcompat tests + verification.

Suggested verification commands are defined in the companion test spec.

## 15. Architect REVISE Resolution（2026-05-14）

Architect verdict: REVISE. Required corrections were applied before Critic review:

1. **Phase A refinement/dataScope narrowed**: runtime product type now only allows `semanticStatus: "not-configured"` and `dataScope: "evidence-only"`. Broader semantic states and rich scopes are Phase B+ follow-ups, not Phase A runtime fields.
2. **Paragraph sample boundary clarified**: Phase A excludes paragraph sample text from persisted `styleFacts`. Existing legacy `textSample` / `structureProfile.formatSpecific.paragraphSamples` may remain for current product behavior, but paragraph samples are not StyleFacts evidence and must not be injected into prompts.
3. **Hashing contract locked**: Phase A keeps `buildFormatProfileFromExtractedText` synchronous and uses a product-owned pure TypeScript synchronous SHA-256 helper over stable JSON, with no new dependency.
4. **Snapshot tests strengthened**: the test spec now explicitly covers both `buildFormatProfileSnapshot` and `buildDraftFormatProfileSnapshot`, or requires both to delegate to one shared helper.

## Phase A Execution Closure（2026-05-14）

**Status**: implemented and verified.

**Implemented scope**:
- Added deterministic `StyleFactsEnvelope` and evidence-cited facts for DOCX / XLSX / PPTX / PDF.
- Replaced the loose style-summary path with `styleFacts -> styleProfile -> profileSnapshot -> generationInstruction` derivation.
- Persisted StyleFacts metadata through FormatProfile storage and draft-processing snapshots.
- Added UI presentation for human-readable StyleFacts summaries, evidence details, and explicit non-LLM / non-export boundary.
- Kept Phase A runtime refinement fields narrow: `semanticStatus: "not-configured"`, `dataScope: "evidence-only"`.

**Not implemented by design**:
- No product LLM call.
- No snippets/fulltext scope.
- No LLM-created or LLM-overwritten style facts.
- No export, visual reproduction, or pixel-perfect/high-fidelity promise.
- No restoration of manual input templates.

**Changed implementation anchors**:
- `src/lib/style-facts.ts`
- `src/lib/format-profile.ts`
- `src/lib/draft-processing.ts`
- `src/stores/chat-store.ts`
- `src/components/format-profiles/format-profiles-view.tsx`
- `src/i18n/zh.json`
- `src/i18n/en.json`

**Verification evidence**:
- `npx tsc --noEmit --pretty false` PASS.
- `npm run typecheck` PASS.
- `npm run test:mocks` PASS: 84 files / 1137 tests.
- Targeted StyleFacts/Profile/Draft/i18n tests PASS: 5 files / 31 tests.
- `npm run build` PASS.
- Boundary guard `rg "semantic-refinement|allow-external-llm|evidence-plus-snippets|evidence-plus-fulltext|pixel-perfect|high-fidelity export|exact.*recreat|LLM refined" src` produced no matches.

**Decision**: Phase A can close. Next phase may design LLM semantic overlay only after a new ralplan PRD/test-spec review.


---

## 原文件：`test-spec-format-profile-stylefacts-productization-phaseA.md`


# Test Spec: FormatProfile StyleFacts Productization Phase A

**Status:** ready for execution  
**Date:** 2026-05-14  
**PRD:** `.omx/plans/prd-format-profile-stylefacts-productization-phaseA.md`  
**Planning boundary:** this artifact only; no product source edited.

## 1. Test objective

Prove that Phase A integrates deterministic StyleFacts into the product `FormatProfile` pipeline without LLM product integration, while preserving existing persisted profiles and replacing loose style summary logic with StyleFacts-derived summaries.

## 2. Test matrix

| Area | Claim under test | Primary files |
| --- | --- | --- |
| StyleFacts model/builder | Deterministic fact envelope, evidence refs, schema/hash, format-specific facts | `src/lib/style-facts.ts`, `src/lib/style-facts.test.ts` |
| FormatProfile integration | New profiles store `styleFacts`; `styleProfile` and generation instruction derive from StyleFacts | `src/lib/format-profile.ts`, `src/lib/format-profile.test.ts` |
| Snapshot/binding | Draft-processing profile snapshots carry StyleFacts hash/schema/dataScope/semanticStatus and bounded summary | `src/stores/chat-store.ts`, `src/lib/draft-processing.ts`, `src/lib/draft-processing.test.ts` |
| UI | Human summary, no-LLM boundary, diagnostics, collapsible evidence, overflow-safe long lists | `src/components/format-profiles/format-profiles-view.tsx`, i18n files |
| Persistence/backcompat | Existing envelopes without StyleFacts load; new envelopes preserve StyleFacts | `src/lib/format-profile-persist.ts`, `src/stores/format-profile-store.ts`, related tests |
| Guardrails | No LLM overlay, no rich data scope default, no export fidelity claims | static assertions / text assertions / tests |

## 3. Unit tests: `src/lib/style-facts.test.ts`

Create this test file with fixture probes that mirror product `FormatProfileProbe`, not experiment runtime outputs.

### 3.1 Fact leaf and evidence integrity

For each constructed envelope:

- Assert `schemaVersion === "format-profile-style-facts.v0"`.
- Recursively traverse `styleFacts`; every fact leaf must contain `value`, `confidence`, non-empty `evidenceRefs`, and each ref present in `evidence[].id`.
- Assert derived facts still cite deterministic evidence.
- Assert evidence records include `id`, `kind`, `pointer`, `confidence`, and `sha256`.

### 3.2 Deterministic hashing

- Build the same DOCX fixture twice with identical inputs and fixed `now`; assert `metadata.styleFactsSha256` is identical.
- Reorder object keys in the input probe where possible; assert the hash remains identical if semantic values are unchanged.
- Change a fact value, such as DOCX page width or XLSX `fontCount`; assert the hash changes.
- Assert `metadata.builtAt` or other non-deterministic metadata is excluded from the hash.
- Assert hashing is synchronous from the product builder perspective; `buildFormatProfileFromExtractedText` remains a synchronous function.

### 3.3 DOCX primary facts

Fixture probe must include `style.page`, `style.fonts`, `style.fontUsage`, `style.fontSizeUsageHalfPoints`, `style.styles`, `structure.paragraphStyleUsage`, counts, numbering, and paragraph samples.

Expected assertions:

- `styleFacts.layout.pageSizeTwips.value` reflects source twips.
- `styleFacts.layout.pageSizeCm.derived === true` and uses `unit: "cm"`.
- `styleFacts.typography.fonts.value` includes the fixture fonts.
- `styleFacts.typography.fontSizeUsagePt.derived === true` and uses `unit: "pt"`.
- `styleFacts.styles.styleCount.value` equals fixture style count.
- `styleFacts.structure.numberingDefinitions.value` equals fixture numbering count.
- Summary includes font, font size, page, and style definition bullets.
- Paragraph sample text from the probe is not persisted inside `styleFacts` and does not appear in StyleFacts summaries or prompts.

### 3.4 XLSX primary facts

Fixture probe must include sheets, sheetStats, style counts, sharedStringCount, merged/formula counts.

Expected assertions:

- Workbook sheet count and sheet names are captured.
- Dimensions are derived from sheet stats.
- Style count/font/fill/border/shared-string values are captured.
- Merged/formula counts are derived and evidence-cited.
- Summary translates workbook/style facts into table/metric guidance and does not claim spreadsheet generation.

### 3.5 PPTX/PDF baseline facts

Expected assertions:

- PPTX envelope has medium confidence diagnostics/boundary text and captures slide/theme counts.
- PDF envelope has diagnostic/low-fidelity wording and captures page count/font refs.
- `capabilities.canGuideExport === false` for both.
- Summaries do not imply renderer-grade layout or export reproduction.

### 3.6 Missing/unsupported evidence

- Null/empty probe returns an envelope with low-confidence diagnostics and no crashing.
- Unsupported/unknown file type yields low-confidence diagnostic boundary and no fake facts.
- Facts are not constructed from legacy `styleProfile.evidenceSummary` strings.
- DOCX paragraph sample strings are excluded from StyleFacts evidence/value paths in Phase A.

## 4. Unit tests: `src/lib/format-profile.test.ts`

Extend existing tests identified by current format coverage.

### 4.1 New profiles contain StyleFacts

For DOCX/XLSX/PPTX/PDF profile builds through `buildFormatProfileFromExtractedText`:

- Assert `profile.styleFacts` exists.
- Assert schema/hash/capability fields exist.
- Assert `profile.styleProfile.evidenceSummary` equals or is a subset of `styleSummaryForHumans(profile.styleFacts, profile.fileType)`.
- Assert `profile.styleProfile.typography/layout/formatSpecific` are derived from known StyleFacts paths.

### 4.2 Legacy loose summary replacement guard

Add a test fixture where `probe.style` contains an extra field that the StyleFacts mapper intentionally ignores.

- Assert ignored probe-only field does not appear in `styleProfile.evidenceSummary`.
- Assert accepted StyleFacts paths do appear.
- This protects against accidentally reintroducing direct `probe.style` summary logic in `buildStyleProfile`.

### 4.3 Generation instruction boundedness

- Assert `buildGenerationInstruction(profile)` includes StyleFacts/schema/hash marker and deterministic boundary text.
- Assert it includes at most the configured number of style bullets.
- Assert it does not include raw `styleFacts.evidence` JSON, full evidence SHA lists, or paragraph sample arrays.
- Assert DOCX/XLSX/PPTX/PDF still include existing format-specific guidance:
  - DOCX formal report guidance.
  - XLSX table/metric translation, not spreadsheet fabrication.
  - PPTX presentation outline/page-topic translation.
  - PDF low-fidelity reference warning.

### 4.4 Diagnostics and confidence

- Assert StyleFacts diagnostics are represented in profile diagnostics or accessible through `profile.styleFacts.diagnostics`.
- Assert PPTX/PDF baseline coverage produces warning/info diagnostics and does not report high-fidelity export capability.

## 5. Snapshot and draft-processing tests: `src/lib/draft-processing.test.ts`

### 5.1 Snapshot metadata

Using a `FormatProfileRecord` with StyleFacts:

- `buildDraftFormatProfileSnapshot(profile)` includes `styleFactsSha256`, `styleFactsSchemaVersion`, `styleFactsSummary`, `dataScope: "evidence-only"`, and `semanticStatus: "not-configured"`.
- `buildFormatProfileSnapshot(profile)` includes the same StyleFacts metadata or delegates to the same shared helper; tests must cover this surface explicitly.
- `profileSnapshotHash` changes when `styleFactsSha256` changes.
- Snapshot diagnostics are deep-copied as today.
- Phase A snapshots must not expose rich scopes or semantic statuses beyond `dataScope: "evidence-only"` and `semanticStatus: "not-configured"`.

### 5.2 Prompt boundedness

For `buildDraftProcessingPrompt` and `buildDraftProcessingSystemPrompt`:

- With no snapshot, no StyleFacts text appears.
- With a snapshot, prompt includes profile title, short StyleFacts metadata, bounded summary, and deterministic/no-export boundary.
- Prompt does not include full `styleFacts`, raw evidence JSON, evidence hash lists, snippets/fulltext, or paragraph sample arrays.
- Prompt keeps current behavior that profile scope applies only to profile-processing conversations.

### 5.3 Derivation metadata remains stable

- Existing derivation assertions for `formatProfileId` and `formatProfileTitle` still pass.
- If product decides to add optional StyleFacts derivation metadata later, Phase A test should assert it is optional and does not break old draft records.

## 6. Persistence/backcompat tests

### 6.1 `src/lib/format-profile-persist.test.ts`

- Existing versioned envelope without `styleFacts` loads unchanged.
- Legacy array format still loads as `{ version: 1, profiles, activeProfileId: null }`.
- New profile with `styleFacts` round-trips through `saveFormatProfiles` without losing `metadata.styleFactsSha256`, `schemaVersion`, evidence, diagnostics, or active profile id.
- Malformed `styleFacts` does not crash load; either profile is preserved as legacy with diagnostics or invalid facts are dropped with a safe warning according to implementation choice.

### 6.2 `src/stores/format-profile-store.ts` tests if added/extended

- `normalizeProfile` fills missing optional arrays/diagnostics and leaves absent `styleFacts` absent.
- Adding a new StyleFacts-backed profile preserves `styleFacts` and active selection behavior.
- Hydrating mixed legacy/new profiles sorts and selects as before.

## 7. UI tests / verification

If existing test harness does not include React component rendering tests, use targeted static/unit checks plus manual smoke notes. Preferred tests:

- Render `FormatProfilesView` with a StyleFacts-backed selected profile.
- Assert human summary labels are visible.
- Assert deterministic/no-LLM and no-export boundary copy is visible.
- Assert evidence details are present but collapsed by default.
- Assert long evidence/fact lists use overflow-safe classes (`max-h-*`, `overflow-y-auto` or `overflow-auto`, `break-words`, `min-w-0`).
- Assert legacy profile without `styleFacts` shows legacy summary or safe empty state, not a crash.

I18n checks:

- Add keys to both `src/i18n/zh.json` and `src/i18n/en.json`.
- Run existing i18n parity test if present.
- Static grep must not find hardcoded new user-facing English/Chinese strings in `FormatProfilesView` unless the component already permits that pattern.

## 8. Static guardrail tests

Run or add tests/static assertions for these forbidden Phase A behaviors:

- No production import/call to `format-profile-semantic-refinement` experiment scripts.
- No LLM provider call from `src/lib/format-profile.ts`, `src/lib/style-facts.ts`, `src/lib/draft-processing.ts`, or `src/components/format-profiles/format-profiles-view.tsx`.
- No default `dataScope` other than `evidence-only` in snapshot/profile refinement metadata.
- No UI or instruction text containing claims equivalent to “export reproduction”, “pixel-perfect”, “exact DOCX/PDF/PPTX/XLSX recreation”, or “LLM refined” for Phase A deterministic profiles.
- No new dependency added solely for hashing unless explicitly approved later.

Suggested PowerShell guard examples:

```powershell
rg -n "semantic-refinement|allow-external-llm|evidence-plus-snippets|evidence-plus-fulltext|pixel-perfect|high-fidelity export|exact.*recreat|LLM refined" src
rg -n "from ['\"]crypto['\"]|createHash|subtle\.digest" src
```

Interpretation: the second command is informational; a local approved no-dependency hash helper is acceptable if implemented in product source without Node-only runtime assumptions.

## 9. Verification commands

Run after implementation:

```powershell
npm run test:mocks -- src/lib/style-facts.test.ts src/lib/format-profile.test.ts src/lib/draft-processing.test.ts src/lib/format-profile-persist.test.ts
npm run typecheck
npm run build
```

If the test runner does not accept explicit file args through the npm script, use direct Vitest:

```powershell
npx vitest run src/lib/style-facts.test.ts src/lib/format-profile.test.ts src/lib/draft-processing.test.ts src/lib/format-profile-persist.test.ts --exclude='**/*.real-llm.test.ts'
npm run typecheck
npm run build
```

Optional regression reference, not a product gate:

```powershell
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
```

Do not require experiment runtime outputs to be bundled or regenerated for normal product tests.

## 10. Acceptance checklist

- [ ] StyleFacts builder tests pass for DOCX/XLSX primary and PPTX/PDF baseline fixtures.
- [ ] Recursive evidence integrity test passes for every fact leaf.
- [ ] Stable hash tests prove deterministic same-input hash and changed-fact hash changes.
- [ ] `FormatProfileRecord.styleFacts` exists on new profiles.
- [ ] `styleProfile.evidenceSummary` is derived from StyleFacts, not direct loose probe summary logic.
- [ ] Generation instruction contains bounded StyleFacts summary and no raw evidence JSON.
- [ ] Draft snapshot includes StyleFacts hash/schema/summary/dataScope/semanticStatus.
- [ ] Draft prompts include StyleFacts only when selected profile snapshot is present.
- [ ] UI displays summary/boundaries/diagnostics/evidence without overflow.
- [ ] Existing persisted profiles without StyleFacts load and remain usable.
- [ ] Static guardrails show no Phase A LLM integration or rich data scope default.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.

## 11. Stop condition

Phase A is complete when the product can import a finished file, produce a `FormatProfileRecord` with deterministic StyleFacts, derive UI/prompt summaries from those facts, carry StyleFacts metadata in draft-processing snapshots, preserve legacy profiles, and pass the verification commands above without adding LLM product integration.

## 12. Architect REVISE Test Spec Resolution（2026-05-14）

Additional mandatory tests from Architect review:

1. Phase A runtime metadata allows only `semanticStatus: "not-configured"` and `dataScope: "evidence-only"`.
2. Paragraph sample text is excluded from persisted `styleFacts`, summaries, and prompts.
3. Hashing remains synchronous from product builder perspective; no async WebCrypto-driven API change is allowed in Phase A.
4. Both snapshot builder surfaces are tested, or both are proven to call a shared helper that is tested.

## Phase A Test Closure（2026-05-14）

**Result**: PASS.

**Executed tests/checks**:
- `npx tsc --noEmit --pretty false` — PASS.
- `npm run typecheck` — PASS.
- `npm run test:mocks` — PASS, 84 files / 1137 tests.
- `npx vitest run src/lib/style-facts.test.ts src/lib/format-profile.test.ts src/lib/draft-processing.test.ts src/lib/format-profile-persist.test.ts src/i18n/i18n-parity.test.ts --exclude='**/*.real-llm.test.ts'` — PASS, 5 files / 31 tests.
- `npm run build` — PASS.
- Boundary keyword guard against accidental Phase B surface in `src/` — PASS with no matches.

**Coverage added/confirmed**:
- Synchronous SHA-256 standard vector.
- EvidenceRefs integrity across recursive StyleFacts.
- DOCX page/font/font-size/style facts and paragraph-sample exclusion.
- XLSX workbook/style/formula/merge facts.
- PPTX/PDF baseline diagnostics and non-export boundary.
- Stable styleFacts hash independent of `builtAt` and sensitive to fact changes.
- `buildFormatProfileSnapshot` and draft snapshot parity for StyleFacts metadata.
- Persistence round-trip keeps StyleFacts hash/evidence.
- Prompt path includes bounded StyleFacts metadata but not raw evidence JSON or paragraph samples.

**Known warnings**:
- Production build still emits pre-existing Vite chunk/dynamic-import warnings; not introduced by Phase A and not blocking.

**Gate**: Phase A implementation is accepted for the deterministic facts-only scope. LLM integration remains unimplemented and requires separate Phase B design.
