# FormatProfile Semantic Refinement Phase B — PRD / 测试 / RALPLAN / DataScope 合并归档

归档说明：LLM semantic overlay 与 evidence-only data scope 已进入产品化记录；相关设计、测试、ralplan 和 datascope 对比合并保存。


---

## 原文件：`prd-format-profile-llm-integration-phaseB.md`


# PRD: FormatProfile LLM Integration Phase B

**Status:** initial consensus plan / design only  
**Date:** 2026-05-14  
**Companion test spec:** `.omx/plans/test-spec-format-profile-llm-integration-phaseB.md`  
**Source context:** `.omx/context/format-profile-llm-integration-phaseB-20260513T171121Z.md`  
**Predecessors:** Phase A PRD/test spec, migration Decision 014, semantic-refinement harness reports.  
**Planning boundary:** this artifact only; do not implement code from this plan until it is explicitly handed off.

## 1. Product objective

Phase B adds a product LLM semantic overlay after deterministic `StyleFacts` Phase A. The overlay improves human-readable interpretation and generation constraints for imported DOCX / XLSX / PPTX / PDF format profiles while preserving the Phase A facts-only boundary.

Target product chain:

```text
probe_format_profile
  -> deterministic StyleFactsEnvelope
  -> FormatProfileRecord + profileSnapshot
  -> optional evidence-only LLM semantic overlay
  -> evaluator accepted/rejected state
  -> renderer-owned final generationInstruction
  -> UI human summary + audit/provenance
  -> draft-processing prompt
```

The LLM may interpret existing `StyleFacts`, structure evidence, diagnostics, and evidence catalog entries. It must not create, overwrite, delete, or directly persist style facts. The renderer, not the LLM, owns the final instruction.

## 2. Evidence-grounded current state

- Phase A completed the deterministic product path: `probe -> StyleFactsEnvelope -> FormatProfileRecord -> profileSnapshot -> draft-processing prompt -> UI/evidence diagnostics`.
- Current product fields already expose the boundary: `FormatProfileRecord.styleFacts`, `semanticStatus: "not-configured"`, and `dataScope: "evidence-only"` in `src/lib/format-profile.ts`.
- `StyleFactsEnvelope` declares `evidenceAuthority: "parser-generated"`, `llmMayInterpret: true`, and `llmMayCreateFacts: false` in `src/lib/style-facts.ts`.
- Draft prompt integration already includes bounded `styleFactsSummary`, `styleFactsSha256`, schema version, `dataScope`, and `semanticStatus` metadata in `src/lib/draft-processing.ts`.
- Existing UI displays deterministic style facts, diagnostics, and raw generation instruction in `src/components/format-profiles/format-profiles-view.tsx`.
- Existing provider infrastructure supports configured providers through `src/lib/llm-client.ts`, `src/lib/llm-providers.ts`, settings in `src/components/settings/sections/llm-provider-section.tsx`, and provider usability checks such as `src/lib/has-usable-llm.ts`.
- Experiment harness evidence under `experiments/format-profile-semantic-refinement/` proved the target contract: closed overlay schema, renderer-owned final instruction, evaluator, fallback parity, evidence-only default, and data-scope comparison.
- Decision 014 requires Phase B to use StyleFacts as the fact source, generate only evidence-bound semantic overlay, keep `evidence-only` default, avoid manual input templates, and avoid export or visual reproduction promises.

## 3. RALPLAN-DR summary

### Principles

1. **Deterministic facts are authoritative.** Parser-generated `StyleFacts` and probe evidence remain the only source of style facts.
2. **Renderer owns final instructions.** LLM output is an overlay candidate; deterministic renderer composes the final `generationInstruction`.
3. **Fail closed without data expansion.** Invalid JSON, schema failure, evaluator rejection, provider error, timeout, or missing authorization must preserve deterministic Phase A behavior.
4. **Evidence-only by default.** Product default data scope remains `evidence-only`; snippets/fulltext are not default and require explicit advanced/rescue authorization if ever exposed.
5. **Non-programmer UI first.** Users see clear plain-language status, benefits, limits, and recovery actions without needing to understand hashes, evidence refs, or schemas.

### Top decision drivers

1. **Safety/auditability:** preserve fact provenance and prevent LLM hallucinated or overwritten style facts.
2. **Product usefulness:** replace mechanical style summaries/diagnostics with concise human-readable interpretation and actionable generation constraints.
3. **Operational fit:** integrate with existing provider/settings/store/UI surfaces without duplicating harness-only code or creating a parallel profile pipeline.

### Viable options considered

#### Option A — Evidence-only product overlay with evaluator-gated renderer (**chosen**)

- **Pros:** Matches harness evidence; respects Decision 014; keeps privacy/cost low; cleanly fuses frontend/backend; replaces weak current summaries without expanding data scope.
- **Cons:** Some documents may remain less semantically rich than richer-scope runs; implementation must add evaluator/fallback/audit plumbing before visible gains are fully realized.
- **Rationale:** This is the only option that satisfies all Phase B constraints while delivering product value.

#### Option B — LLM directly rewrites `FormatProfileRecord` / `generationInstruction`

- **Pros:** Faster to prototype; could appear more fluent immediately.
- **Cons:** Violates renderer ownership; risks fact mutation; weak auditability; cannot reliably distinguish evidence from inference.
- **Decision:** Rejected for product. It contradicts the Phase A facts-only boundary and Decision 014.

#### Option C — Default richer data scope (`snippets` or `fulltext`) for stronger summaries

- **Pros:** May give the model more context for hard cases.
- **Cons:** DataScope comparison did not prove enough default benefit; increases privacy, leak, token, redaction, and audit burden.
- **Decision:** Rejected as default. It can only be a later explicit authorized advanced/rescue mode with separate gates.

#### Option D — UI-only semantic explanation over unchanged backend contract

- **Pros:** Lower implementation surface.
- **Cons:** Duplicates logic in frontend, weak fallback/audit, harder to reuse for draft-processing, and does not replace weak backend summaries/instructions.
- **Decision:** Rejected as incomplete; Phase B must fuse backend renderer/evaluator with UI states.

## 4. ADR

### Decision

Implement Phase B as an **optional evidence-only LLM semantic overlay pipeline** attached to `FormatProfileRecord`, guarded by closed schema validation, evaluator acceptance, deterministic fallback, audit/provenance metadata, provider/settings gating, and plain-language UI states. Accepted overlay fields may influence human summaries and generation constraints only through a deterministic renderer.

### Drivers

- Preserve deterministic StyleFacts authority.
- Improve profile readability and generation constraints for non-programmer users.
- Avoid privacy expansion and product promises not supported by Phase A.
- Replace weaker current summary/diagnostic paths instead of adding a duplicate presentation layer.

### Alternatives considered

- Direct LLM profile/instruction rewrite: rejected because it mutates authoritative facts and bypasses renderer/evaluator boundaries.
- Default snippets/fulltext: rejected because current evidence does not justify default privacy and cost expansion.
- UI-only overlay: rejected because product behavior must be available to draft-processing and audit surfaces, not only display.

### Why chosen

The chosen option is the minimal product-safe closure of the successful harness contract. It yields visible quality improvements while keeping every LLM contribution bounded, evaluable, reversible, and attributable.

### Consequences

- Product data model needs a separate semantic overlay state, not merged `styleFacts` fields.
- Stores and UI need asynchronous states for not configured, eligible, running, accepted, rejected, failed, and deterministic fallback.
- Prompt, schema, evaluator, renderer, and audit artifacts become product contracts and need tests.
- Richer scopes remain postponed until a separate authorization and privacy design exists.

### Follow-ups

- Later authorized rescue scope design for snippets/fulltext, if needed.
- Future Match Report / Audit UI can consume the same provenance fields.
- Export/visual reproduction remains a separate later product line.

## 5. Scope

### In scope

1. Product semantic overlay types and lifecycle state on the format profile path.
2. Evidence-only overlay prompt built from deterministic profile snapshot, `StyleFactsEnvelope`, evidence catalog, diagnostics, and bounded structure/style summaries.
3. Closed `LLMOverlayOutput` schema equivalent in spirit to the harness schema, with strict allowed fields and evidence references.
4. Product evaluator for schema validity, evidence-ref existence, boundary keyword guard, no fact mutation, data-scope guard, and quality thresholds.
5. Deterministic renderer that owns final human summary and `generationInstruction` composition.
6. Fallback behavior that preserves Phase A deterministic summaries/instructions on any overlay failure.
7. Audit/provenance metadata: profile id, source file type, profile version, styleFacts schema version, `styleFactsSha256`, data scope, overlay schema version, provider/model/settings, request time, evaluator result, accepted/rejected reason, fallback reason, evidence refs.
8. Provider/settings integration through existing LLM config and usability checks; no harness-only provider direct calls.
9. UI/store states for non-programmer users, including visible configured/unconfigured/refining/accepted/fallback explanations and collapsible evidence/provenance details.
10. Frontend/backend fusion and direct replacement of weaker current style summaries/diagnostics/instruction text where an accepted overlay exists.
11. i18n copy for user-visible states, guardrails, and failure messages.

### Out of scope

- Manual input template revival.
- Export, formal document generation, visual reproduction, or high-fidelity rendering promises.
- LLM creation, overwrite, deletion, or persistence of style facts.
- Default snippets/fulltext data scopes.
- Direct product dependency on experiment harness scripts or `codex-cli` experiment provider.
- Match Report, full audit UI, long-document project system, or official export pipeline.

## 6. Product behavior requirements

### 6.1 Overlay contract

Overlay is stored separately from `styleFacts` and must be clearly marked as LLM-generated interpretation.

Initial product schema must be closed and equivalent to this exact contract unless a later PRD revision changes it:

```ts
type SemanticConfidence = "high" | "medium" | "low"
type OverlaySchemaVersion = "format-profile-llm-overlay.v1"
type OverlayClaimKind = "document-kind" | "structure" | "style" | "generation-guidance" | "warning"

interface OverlayClaim {
  id: string                 // stable local id, max 64 chars
  kind: OverlayClaimKind
  text: string               // user-facing claim, 1..240 chars
  confidence: SemanticConfidence
  evidenceRefs: string[]     // 1..8 refs, all must exist in precomputed evidence catalog
}

interface LLMOverlayOutput {
  schemaVersion: OverlaySchemaVersion
  language: "zh" | "en" | "mixed"
  documentKind: OverlayClaim | null
  structureInterpretation: OverlayClaim[]  // max 6
  styleInterpretation: OverlayClaim[]      // max 8
  generationGuidance: OverlayClaim[]       // max 8
  warnings: OverlayClaim[]                 // max 6
  uncertainty: string[]                    // max 5, each 1..160 chars
}
```

Closed-schema rules:

- Unknown top-level or nested fields reject the overlay; do not strip and continue.
- Every claim that affects user-visible guidance must cite one or more existing evidence refs or deterministic profile summary refs.
- Deterministic profile summary refs must be generated before the LLM call, stable, evaluator-checkable, and treated as evidence catalog entries; ad-hoc model-invented citations are invalid.
- Forbidden fields anywhere in the overlay include `styleFacts`, `styleFactsPatch`, `generationInstruction`, `finalInstruction`, `prompt`, `rawText`, `textSample`, `snippets`, `fulltext`, `sourceContext`, `export`, and any field that directly names mutated fact paths as authoritative values.
- Overlay must never include raw generated final instruction as an authoritative string. It may suggest bounded guidance fragments that the renderer can accept or ignore.

Evaluator report contract:

```ts
type OverlayEvaluatorStatus = "accepted" | "rejected"
type OverlayViolationCode =
  | "invalid-json"
  | "schema-invalid"
  | "unknown-field"
  | "missing-evidence-ref"
  | "unknown-evidence-ref"
  | "fact-creation-attempt"
  | "renderer-bypass-attempt"
  | "data-scope-violation"
  | "boundary-keyword"
  | "quality-threshold"

interface OverlayEvaluatorReport {
  status: OverlayEvaluatorStatus
  schemaVersion: "format-profile-llm-overlay-evaluator.v1"
  evidenceRefCoverage: number  // 0..1 accepted overlays must be 1
  acceptedClaimCount: number
  rejectedClaimCount: number
  violations: Array<{ code: OverlayViolationCode; message: string; claimId?: string }>
  warnings: string[]
  fallbackReason?: string
}
```

### 6.2 Renderer owns final instruction

- Renderer input: deterministic `FormatProfileRecord`, `StyleFactsEnvelope`, existing Phase A summaries, accepted overlay, evaluator report, and data-scope metadata.
- Renderer output: final human summary, diagnostics/warnings, and bounded `generationInstruction`.
- Renderer must preserve Phase A deterministic fallback byte/semantic parity when no accepted overlay exists.
- Renderer must prefer accepted overlay for human-readable interpretation but always retain deterministic facts and boundary warnings.

### 6.3 Evaluator and fallback

- Evaluator rejects invalid JSON, schema mismatch, missing/unknown evidence refs, boundary violations, attempts to create/overwrite facts, snippets/fulltext use without authorization, disallowed export/visual reproduction promises, and instruction ownership violations.
- Any rejected overlay is not used in final instruction or displayed as accepted guidance.
- Fallback state must be explicit in store/UI/audit and must preserve existing deterministic profile behavior.

### 6.4 Data scope and privacy

- Default `dataScope` remains `evidence-only`.
- Evidence-only payload may include deterministic facts, evidence labels/ids, diagnostics, counts, bounded summaries, and non-sensitive metadata already used by Phase A.
- Evidence-only payload must not include persisted `textSample`, raw extracted document body, snippets, fulltext, or source context text unless a later explicit advanced/rescue authorization path is designed and enabled.
- Snippets/fulltext are not part of initial Phase B default product flow.
- If implementation chooses to include placeholders for richer scopes, they must be disabled by default, require explicit advanced/rescue authorization, run redaction/leak scan, cite `sourceContext` evidence refs, and write audit records.

### 6.5 Provider/settings integration

- Overlay request can run only when a usable LLM provider is configured through existing app settings.
- Product code must use existing provider abstraction (`streamChat`/provider config or equivalent), not experiment scripts.
- Settings must expose enough status for the Format Profile UI to say whether intelligent refinement is unavailable, ready, running, or failed.
- Provider/model/request settings used for overlay must be recorded in provenance without storing secrets.

### 6.6 UI/store states

Required visible states and lifecycle:

- `not-configured` is derived when no usable provider exists; no overlay request can start and deterministic profile is shown with explanation.
- `eligible` is derived when a usable provider exists and no current accepted/running overlay exists for the current `profileId + profileVersion + styleFactsSha256`; user can run/refresh intelligent interpretation.
- `running` is stored while prompt build/provider call/evaluation is active; cancellation moves to `failed` with fallback reason `cancelled` and writes an audit record.
- `accepted` is stored only after closed-schema validation and evaluator acceptance; renderer output becomes primary user-facing interpretation.
- `rejected` is stored when provider output is received but evaluator rejects it; deterministic fallback is shown and evaluator report is retained.
- `failed` is stored for provider/network/timeout/empty response/cancel failures; deterministic fallback is shown with simple reason.
- `stale` is derived when stored overlay provenance does not match current `profileId`, `profileVersion`, or `styleFactsSha256`; stale overlays are never used by renderer.

Initial state after import:

- If no provider is usable: deterministic profile + derived `not-configured`.
- If provider is usable: deterministic profile + derived `eligible`; overlay does not auto-run unless later product execution explicitly chooses an auto-trigger behind the same gates.

Audit-writing transitions: `running` start, `accepted`, `rejected`, `failed/cancelled`, and stale detection on attempted use all produce provenance/audit entries without secrets.

Non-programmer UI constraints:

- Default view says what was learned and what remains uncertain in plain language.
- Hashes, schema versions, model IDs, and evidence refs are secondary/collapsible.
- The UI must not ask users to edit JSON, prompts, schemas, or evidence ids.
- Copy must avoid “perfect match”, “high fidelity export”, “visual reproduction”, or equivalent promises.

### 6.7 Frontend/backend fusion and replacement strategy

- Accepted overlay should replace weak current human-facing style summaries/diagnostics where it is stronger, not appear as a duplicate panel competing with deterministic summaries.
- Deterministic facts remain visible in evidence/details and remain the fallback source.
- Draft-processing prompt should consume the renderer output, not raw overlay output.
- Existing summary helpers should be refactored toward a single rendering path: deterministic-only render when no accepted overlay, overlay-enhanced render when accepted.

## 7. Implementation handoff outline

This is not an implementation instruction for this planning turn; it is the intended execution sequence for a later `$ralph`, `$team`, or `$ultragoal` handoff.

1. Define product overlay types, statuses, and persistence migration with backward compatibility.
2. Port/adapt closed schema and evaluator concepts from the harness into product-safe TypeScript modules.
3. Add overlay prompt builder and provider adapter using existing LLM provider infrastructure.
4. Add deterministic renderer and wire it to `FormatProfileRecord`, snapshots, and draft-processing.
5. Update store actions for run/refresh/cancel/fallback/stale states.
6. Update Format Profiles UI and settings affordances with i18n copy.
7. Replace weaker summary/diagnostic/instruction presentation paths with renderer output.
8. Add tests from the companion test spec and run typecheck/build.

## 8. Acceptance criteria

1. Accepted overlay for each DOCX/XLSX/PPTX/PDF fixture preserves `styleFacts` and `styleFactsSha256` exactly.
2. Accepted overlay for each fixture produces renderer output with: one primary plain-language summary, at least two accepted guidance claims when fixture evidence supports them, no claim over 240 chars, total rendered overlay summary under 1,200 chars, and evidence-ref coverage of 1.0.
3. No product default path sends snippets/fulltext/raw body/`textSample`; all default overlay requests are `evidence-only`.
4. LLM output cannot directly become final `generationInstruction`; renderer composition is required and tested.
5. Invalid/rejected/failed overlay returns deterministic Phase A behavior with prompt/render parity and records a fallback/audit reason.
6. Unknown fields, unknown evidence refs, missing evidence refs, boundary keywords, fact-creation attempts, renderer-bypass attempts, or data-scope violations are rejected.
7. UI presents clear non-programmer states and does not require schema/prompt/hash knowledge to proceed.
8. Accepted overlay replaces weaker current style summaries/diagnostics/instruction text through a single renderer output; tests assert no duplicate competing summary panel/path.
9. Provider/settings integration uses existing product LLM configuration and stores provenance without secrets.
10. Existing Phase A tests continue to pass.
11. Build/typecheck pass after implementation.

## 9. Pre-mortem

1. **A model returns fluent but unsafe output that includes invented style facts.** The closed schema, forbidden-field list, evidence-ref coverage requirement, evaluator rejection, and deterministic fallback must prevent it from reaching renderer output.
2. **A future implementation accidentally sends `textSample` or snippets in the default payload.** Prompt/payload unit tests, privacy guards, and boundary keyword/static tests must fail before merge.
3. **Users see duplicate or contradictory summaries after overlay acceptance.** The single renderer path and UI tests must prove accepted overlay replaces weaker primary summaries while deterministic evidence remains collapsible.

## 10. Risks and mitigations

- **Risk:** LLM hallucinates facts or overstates fidelity.  
  **Mitigation:** closed schema, evidence refs, boundary keyword guard, evaluator rejection, renderer ownership.

- **Risk:** Product accidentally expands data scope.  
  **Mitigation:** default constants/tests for `evidence-only`; explicit authorization gate for any future richer scope.

- **Risk:** Duplicate UI paths confuse users.  
  **Mitigation:** single renderer output drives visible summary and prompt; deterministic details are secondary.

- **Risk:** Provider failure degrades profile import UX.  
  **Mitigation:** optional async overlay; deterministic profile remains complete and usable.

- **Risk:** Harness logic is copied too literally.  
  **Mitigation:** reuse contracts and fixtures, not experiment provider scripts; product modules get independent tests.

## 11. Available agent/staffing guidance for follow-up

- `explore`: map exact code touchpoints before editing.
- `architect`: review overlay/persistence boundaries and renderer ownership.
- `executor`: implement product modules and UI/store wiring.
- `test-engineer`: implement the companion test spec and regression guards.
- `security-auditor`: review privacy/data-scope and provider provenance handling.
- `code-reviewer` or `verifier`: final correctness, safety, and coverage review.

Recommended lanes:

- `$ralph`: best for a single-owner implementation loop with strict verification.
- `$team`: best if splitting disjoint work into model/schema/evaluator, renderer/store, and UI/tests lanes.
- `$ultragoal`: default durable goal-mode follow-up if the work should be tracked as multi-step product delivery.

## 12. Architect REVISE Resolution: Phase B Product Contracts（2026-05-14）

Architect review found the direction sound but required concrete contracts before implementation. This section is normative for Phase B and overrides earlier ambiguous wording such as generic `profileVersion` references.

### 12.1 Overlay state and persistence model

Phase B must not extend `styleFacts` with LLM fields. Product state is stored separately as an optional semantic overlay container on `FormatProfileRecord`:

```ts
type SemanticOverlayStoredStatus = "running" | "accepted" | "rejected" | "failed"
type SemanticOverlayDerivedStatus = "not-configured" | "eligible" | "stale"
type SemanticOverlayDataScope = "evidence-only" // Phase B default and only enabled scope

type SemanticOverlayFallbackReason =
  | "not-configured"
  | "cancelled"
  | "timeout"
  | "provider-error"
  | "empty-response"
  | "invalid-json"
  | "schema-invalid"
  | "evaluator-rejected"
  | "stale-overlay"

interface SemanticOverlayKey {
  profileId: string
  profileUpdatedAt: number
  profileSnapshotHash: string
  styleFactsSha256: string
}

interface SemanticOverlayProvenance {
  key: SemanticOverlayKey
  dataScope: SemanticOverlayDataScope
  overlaySchemaVersion: "format-profile-llm-overlay.v1"
  evaluatorSchemaVersion: "format-profile-llm-overlay-evaluator.v1"
  providerId: string
  modelId?: string
  requestSettings: {
    temperature?: number
    maxTokens?: number
    timeoutMs: number
  }
  startedAt: number
  completedAt?: number
  // No API keys, base URLs with embedded credentials, request bodies, or raw document text.
}

interface SemanticOverlayAuditEntry {
  id: string
  at: number
  event: "started" | "accepted" | "rejected" | "failed" | "cancelled" | "stale-detected"
  status: SemanticOverlayStoredStatus | SemanticOverlayDerivedStatus
  reason?: SemanticOverlayFallbackReason | string
  key: SemanticOverlayKey
  providerId?: string
  modelId?: string
  evaluatorStatus?: "accepted" | "rejected"
  evidenceRefs?: string[]
}

interface FormatProfileSemanticOverlayState {
  status: SemanticOverlayStoredStatus
  key: SemanticOverlayKey
  dataScope: SemanticOverlayDataScope
  output?: LLMOverlayOutput          // present only for accepted overlays
  evaluatorReport?: OverlayEvaluatorReport
  provenance: SemanticOverlayProvenance
  fallbackReason?: SemanticOverlayFallbackReason
  auditTrail: SemanticOverlayAuditEntry[] // bounded to the latest N entries, e.g. 20
}
```

Backwards compatibility:

- Existing profiles without `semanticOverlay` load as deterministic Phase A profiles.
- Current `refinement: { semanticStatus: "not-configured"; dataScope: "evidence-only" }` is treated as legacy display metadata and may be replaced by derived overlay status once Phase B is implemented.
- Migration must never synthesize accepted overlay output for old profiles.
- Persistence remains inside the existing profile persistence envelope unless implementation discovers a strong reason for a separate audit store; if separated, the PRD must be updated before coding.

### 12.2 Stale key/version strategy

Phase B will **not** introduce a new `profileVersion` field in the first implementation. Any earlier reference to `profileVersion` means this explicit key instead:

```text
semanticOverlay.key = profileId + updatedAt + profileSnapshotHash + styleFactsSha256
```

Rules:

- `profileSnapshotHash` is computed by `buildFormatProfileSnapshot`.
- `styleFactsSha256` comes from `FormatProfileRecord.styleFacts.metadata.styleFactsSha256`.
- An accepted overlay is usable only when every key component matches the current profile.
- If any component differs, status is derived as `stale`; stale output is never supplied to the renderer or draft-processing.
- Attempted stale use writes a `stale-detected` audit entry and falls back to deterministic Phase A render.

### 12.3 EvidenceOnlyOverlayInput allowlist

Provider payloads must **never** receive a full `FormatProfileRecord`, full probe result, raw extracted text, or direct `formatSpecific` blobs. Phase B must introduce a dedicated allowlisted DTO builder, conceptually:

```ts
interface EvidenceOnlyOverlayInput {
  schemaVersion: "format-profile-overlay-input.v1"
  dataScope: "evidence-only"
  profile: {
    id: string
    title: string
    sourceName: string
    fileType: FormatProfileFileType
    documentKind: string
    confidence: FormatProfileConfidence
    updatedAt: number
  }
  snapshot: {
    profileSnapshotHash: string
    styleFactsSchemaVersion?: string
    styleFactsSha256?: string
    semanticStatus: "eligible" | "running" | "not-configured" | "stale"
  }
  summaries: {
    structure: string[]       // bounded, user-visible summaries only
    styleFacts: string[]      // from deterministic bounded summary helpers
    diagnostics: Array<{ id: string; severity: string; message: string }>
  }
  evidenceCatalog: Array<{
    id: string
    kind: string
    pointer: string
    confidence: StyleFactConfidence
    description?: string
    valueDigest: string       // digest/label, not raw large values
  }>
  constraints: string[]
}
```

Allowlist rules:

- The builder may copy only the fields above plus bounded scalar counts/labels required to understand evidence.
- It must explicitly omit `textSample`, raw document body, `paragraphSamples`, slide `textSample`, snippets, fulltext, source context text, raw `styleFacts` JSON, full `structureProfile.formatSpecific`, and full `styleProfile.formatSpecific`.
- If a section title or worksheet/sheet/slide label is included, it must come from already visible bounded profile summaries and must not include paragraph bodies or cell contents.
- The prompt builder receives only `EvidenceOnlyOverlayInput`; TypeScript signatures should make passing `FormatProfileRecord` directly impossible or at least test-detectable.

### 12.4 Provider wrapper and audit semantics

Phase B must add a product wrapper around existing LLM infrastructure instead of calling harness scripts or directly exposing streaming callbacks to overlay code:

```ts
type OverlayProviderResult =
  | { status: "completed"; text: string; providerId: string; modelId?: string; elapsedMs: number }
  | { status: "cancelled"; reason: "cancelled"; providerId?: string; modelId?: string; elapsedMs: number }
  | { status: "failed"; reason: "timeout" | "provider-error" | "empty-response"; message?: string; providerId?: string; modelId?: string; elapsedMs: number }
```

Required behavior:

- Accumulate streamed provider output and parse/evaluate only after successful completion.
- Distinguish cancellation, timeout, provider/network error, and empty response.
- Apply an overlay-specific timeout and `AbortSignal`/cancel path.
- Record non-secret provider/model/settings in provenance; never persist API keys or raw provider request/response beyond the evaluated accepted overlay and evaluator report.
- On `completed`, run schema parser and evaluator before changing status to `accepted`.
- On evaluator rejection, store `rejected` with evaluator report and deterministic fallback.
- On provider failure/cancel/timeout/empty response, store `failed` with fallback reason and deterministic fallback.
- Every start/terminal transition writes an audit entry.

### 12.5 Implementation consequence

Before Phase B coding starts, the executor must treat these contracts as the minimum write scope:

1. overlay state/types and persistence/backcompat;
2. stale key helper based on `updatedAt + profileSnapshotHash + styleFactsSha256`;
3. `EvidenceOnlyOverlayInput` builder and prompt builder allowlist tests;
4. provider wrapper with terminal result taxonomy;
5. audit entry helpers and no-secret persistence tests.

### 12.6 Non-blocking Architect risk resolutions

- Persisted `running` recovery: if the app loads a profile with a persisted `semanticOverlay.status === "running"`, implementation must expire it to `failed` with fallback reason `provider-error` or a more specific `interrupted` reason if introduced, write/retain a non-secret audit entry, and use deterministic fallback. No overlay may remain indefinitely running after restart.
- Stale key redundancy: `profileSnapshotHash` may already include `updatedAt` and `styleFactsSha256`; Phase B intentionally keeps the explicit composite key for readability and defensive stale checks. Implementation may deduplicate helper internals but must preserve the observable stale semantics.

## Phase B Design Approval（2026-05-14）

**Ralplan status**: APPROVED for implementation handoff.

**Review evidence**:
- Architect first review: REVISE. Blocking gaps were overlay state/persistence, stale key/profileVersion ambiguity, evidence-only DTO allowlist, and provider wrapper/audit semantics.
- Revision added `## 12. Architect REVISE Resolution: Phase B Product Contracts（2026-05-14）`.
- Architect re-review: APPROVE. Non-blocking risks were recorded and resolved in `### 12.6`.
- Critic review: APPROVE. Critic confirmed principle/option consistency, privacy/data-scope safety, renderer/evaluator/fallback/audit completeness, no manual template revival, and no LLM fact creation/overwrite.

**Implementation gate**: implementation may proceed, but must honor Section 12 product contracts and the companion test addendum. The stale key override is explicit: do not introduce generic `profileVersion` in Phase B; use `profileId + updatedAt + profileSnapshotHash + styleFactsSha256`.

## Phase B Implementation Closure（2026-05-14）

**Status**: implemented and verified.

**Implemented scope**:
- Added product semantic overlay module with closed schema, evaluator, evidence-only DTO builder, provider wrapper, stale-key helpers, audit helpers, restart recovery, and renderer summary helpers.
- Added `FormatProfileRecord.semanticOverlay` as a separate LLM interpretation state; StyleFacts remain authoritative and unchanged.
- Added renderer-owned integration: accepted overlays enrich `generationInstruction`, `profileSnapshot`, draft-processing prompt, and UI summary; rejected/failed/stale/missing overlays keep deterministic Phase A fallback.
- Added Format Profile store action `runSemanticOverlay` using existing product LLM config and provider abstraction, not experiment scripts.
- Added Format Profiles UI controls/states for semantic interpretation with non-programmer copy and evidence-only boundary.
- Added i18n strings for semantic overlay states.

**Implementation anchors**:
- `src/lib/format-profile-semantic-overlay.ts`
- `src/lib/format-profile-semantic-overlay.test.ts`
- `src/lib/format-profile.ts`
- `src/lib/draft-processing.ts`
- `src/stores/chat-store.ts`
- `src/stores/format-profile-store.ts`
- `src/stores/format-profile-store.test.ts`
- `src/components/format-profiles/format-profiles-view.tsx`
- `src/i18n/zh.json`
- `src/i18n/en.json`

**Boundary preserved**:
- LLM overlay cannot create/overwrite StyleFacts.
- Default payload is `evidence-only`.
- Provider payload is built from `EvidenceOnlyOverlayInput`, not full `FormatProfileRecord`.
- `textSample`, paragraph samples, slide text samples, snippets/fulltext, source context, raw styleFacts JSON, and full formatSpecific blobs are excluded by tests.
- Renderer owns final instruction; raw overlay JSON is not the final instruction.
- Rejected/failed/stale/interrupted overlays fall back to deterministic Phase A behavior.
- Manual input template remains abandoned; no export/visual reproduction promise was added.

**Verification evidence**:
- Targeted tests: `npx vitest run src/lib/format-profile-semantic-overlay.test.ts src/stores/format-profile-store.test.ts src/lib/format-profile.test.ts src/lib/draft-processing.test.ts src/i18n/i18n-parity.test.ts --exclude='**/*.real-llm.test.ts'` PASS, 5 files / 30 tests.
- `npm run typecheck` PASS.
- `npm run test:mocks` PASS, 85 files / 1143 tests.
- `npm run build` PASS.
- Static boundary scan was reviewed: matches are limited to forbidden-field guards/tests, existing textSample fields that are explicitly blocked from provider payloads, and non-promise boundary copy.

**Known warnings**:
- Vite still emits pre-existing dynamic-import/chunk-size warnings; not blocking.
- Real provider behavior is wired through existing LLM config but not exercised by a real-LLM test in this phase.

**Decision**: Phase B implementation can close for mock-verified product integration. A desktop/manual smoke test with a configured provider is the next practical validation step.


---

## 原文件：`test-spec-format-profile-llm-integration-phaseB.md`


# Test Spec: FormatProfile LLM Integration Phase B

**Status:** initial consensus plan / design only  
**Date:** 2026-05-14  
**Companion PRD:** `.omx/plans/prd-format-profile-llm-integration-phaseB.md`  
**Planning boundary:** no code implementation in this turn.

## 1. Test objective

Verify that Phase B adds an evidence-only LLM semantic overlay for `FormatProfile` / `StyleFacts` that improves human-readable interpretation and generation constraints without letting the LLM create/overwrite facts, expand default data scope, bypass the renderer, or degrade deterministic Phase A fallback behavior.

## 2. Test principles

1. **Boundary-first:** tests must prove the LLM is an interpreter only, never a fact source.
2. **Fallback parity:** every model/provider/evaluator failure must preserve deterministic Phase A behavior.
3. **Renderer contract:** final summaries and instructions come from deterministic renderer output, not raw overlay text.
4. **Evidence-only default:** privacy/data-scope tests are required, not optional.
5. **User clarity:** UI/store tests must prove non-programmer states are understandable and actionable.

## 3. Required fixtures and mocks

Use product fixtures adapted from Phase A and the semantic-refinement harness:

- DOCX policy/procedure profile with rich `StyleFacts` and structure evidence.
- XLSX metrics workbook profile with workbook/style/formula facts.
- PPTX briefing profile with baseline theme/layout diagnostics.
- PDF reference profile with low/medium-confidence diagnostic facts.
- Mock overlay provider outputs:
  - valid accepted overlay for each file type;
  - invalid JSON;
  - schema-invalid JSON;
  - unknown evidence refs;
  - fact creation / fact overwrite attempt;
  - boundary keyword promise attempt;
  - default snippets/fulltext attempt;
  - provider error/timeout.

Fixtures must include `styleFactsSha256` before and after overlay evaluation so tests can assert fact immutability.

## 4. Unit tests

### 4.1 Overlay schema and parser

Acceptance:

- Valid overlays parse only with exact `LLMOverlayOutput` fields: `schemaVersion`, `language`, `documentKind`, `structureInterpretation`, `styleInterpretation`, `generationGuidance`, `warnings`, and `uncertainty`.
- `schemaVersion` must be `format-profile-llm-overlay.v1`; confidence values must be `high | medium | low`; claim kinds must be `document-kind | structure | style | generation-guidance | warning`.
- Claim arrays respect max counts from the PRD; claim text max is 240 chars; uncertainty text max is 160 chars.
- Unknown top-level or nested fields are rejected; the closed-schema policy is reject-not-strip so unsafe model output cannot be silently trusted.
- Raw final instruction fields are rejected if they attempt to bypass renderer ownership.
- Overlay cannot contain forbidden fields: `styleFacts`, `styleFactsPatch`, `generationInstruction`, `finalInstruction`, `prompt`, `rawText`, `textSample`, `snippets`, `fulltext`, `sourceContext`, `export`, mutated fact paths, font/page/color facts as new authoritative values, or instructions to overwrite facts.

Suggested file targets:

- `src/lib/format-profile-semantic-overlay.test.ts`
- `src/lib/format-profile-semantic-schema.test.ts`

### 4.2 Prompt builder

Acceptance:

- Default prompt payload is `evidence-only`.
- Prompt includes deterministic `styleFactsSha256`, schema version, evidence catalog refs, bounded summaries, and boundary instructions.
- Prompt excludes snippets/fulltext by default.
- Prompt excludes persisted `textSample`, raw extracted document body, source context text, and any unapproved document snippets by default.
- Any deterministic profile summary refs included in the prompt are precomputed, stable, evaluator-checkable refs, not citations invented by the model.
- Prompt contains explicit instruction that the model may interpret evidence but may not create/overwrite facts.
- Prompt size is bounded and stable for long profiles.

### 4.3 Evaluator

Acceptance:

- Accepts valid overlays for DOCX/XLSX/PPTX/PDF fixture cases.
- Rejects invalid JSON, schema-invalid output, unknown evidence refs, missing evidence refs on claim-bearing fields, boundary keyword promises, fact creation/overwrite attempts, renderer bypass attempts, and unauthorized snippets/fulltext use.
- Emits the exact `OverlayEvaluatorReport` contract from the PRD: `status`, evaluator schema version, `evidenceRefCoverage`, accepted/rejected claim counts, `violations`, `warnings`, and optional `fallbackReason`.
- Accepted overlays require `evidenceRefCoverage === 1`, at least one accepted claim, zero violations, and no forbidden fields.

### 4.4 Renderer

Acceptance:

- Deterministic-only render matches Phase A behavior when overlay is absent/rejected/failed.
- Accepted overlay renderer output includes one primary plain-language summary, at least two accepted guidance claims when fixture evidence supports them, no claim over 240 chars, total overlay-enhanced summary under 1,200 chars, and deterministic fact warnings retained.
- Renderer output is the only source consumed by draft-processing as final profile guidance.
- Renderer output cites/retains provenance metadata and does not include raw overlay JSON.

### 4.5 Audit/provenance helpers

Acceptance:

- Records profile id/version, file type, styleFacts schema version, `styleFactsSha256`, data scope, overlay schema version, provider/model/settings, evaluator result, accepted/rejected/fallback reason, timestamps, and evidence refs.
- Does not persist API keys or secrets.
- Marks overlay `stale` if profile id/version or `styleFactsSha256` changes.

## 5. Integration tests

### 5.1 Profile build and overlay lifecycle

Acceptance:

- Building/importing a profile still creates deterministic `styleFacts`; with no usable provider the visible state is derived `not-configured`.
- With a usable provider, a new profile starts as derived `eligible`; overlay does not auto-run unless a later implementation explicitly adds an auto-trigger behind the same gates.
- Running overlay with a valid mocked provider stores `running`, then `accepted`, and stores overlay separately from `styleFacts`.
- Provider output rejected by evaluator stores `rejected`; provider/network/timeout/empty/cancel stores `failed` with fallback reason.
- Re-running after profile id/version/styleFacts hash change derives `stale`; stale overlay is never used by renderer.
- Transitions `running` start, `accepted`, `rejected`, `failed/cancelled`, and attempted stale use write audit/provenance entries without secrets.
- Rejected/failed/stale overlay leaves deterministic `generationInstruction` and summaries available.

Suggested file targets:

- `src/lib/format-profile.test.ts`
- `src/stores/format-profile-store.test.ts`
- `src/stores/chat-store.test.ts`

### 5.2 Draft-processing prompt integration

Acceptance:

- Draft-processing uses renderer output, not raw overlay output.
- Accepted overlay changes the prompt only in approved summary/guidance sections.
- Rejected/failed/missing overlay produces deterministic Phase A prompt parity.
- Prompt includes semantic status, data scope, and provenance summary.

### 5.3 Provider/settings integration

Acceptance:

- Overlay request is disabled when no usable provider is configured.
- Existing provider config path is used; no experiment harness script/provider is invoked.
- Provider/model/request settings are recorded without secrets.
- Provider error, timeout, stream interruption, or empty response produces fallback state and audit reason.

## 6. UI/store tests

Acceptance:

- Format Profiles UI displays non-programmer states for not configured, eligible, running, accepted, rejected, failed, and stale.
- Accepted overlay appears as the primary human-readable interpretation; deterministic facts/evidence remain available in collapsible details.
- Rejected/failed overlay clearly says deterministic profile is still being used.
- UI does not expose JSON editing, prompt editing, schema editing, or require evidence id knowledge for normal use.
- UI copy avoids export, visual reproduction, perfect match, or high-fidelity promises.
- Existing i18n parity tests cover new English/Chinese keys.

Suggested targets:

- `src/components/format-profiles/format-profiles-view.test.tsx` if component test harness exists, or store-level state tests plus i18n parity tests if UI component tests are not established.
- `src/i18n/i18n-parity.test.ts`.

## 7. Privacy and data-scope guard tests

Acceptance:

- Default overlay request data scope is exactly `evidence-only`.
- Tests fail if default prompt/payload includes snippets, fulltext, raw document body, or source context fields outside the evidence-only contract.
- Any snippets/fulltext code path, if stubbed, is disabled by default and requires explicit advanced/rescue authorization, redaction/leak-scan status, source-context evidence refs, and audit record.
- Unauthorized richer scope attempts are rejected by evaluator and never sent to provider in default flow.

## 8. Boundary keyword guard tests

Acceptance:

Search/static tests or evaluator fixtures must reject or flag user-visible/product strings that promise:

- LLM-created or LLM-overwritten facts;
- default snippets/fulltext;
- manual input template revival;
- export generation or visual reproduction;
- perfect/high-fidelity file recreation;
- raw overlay as final instruction.

The guard should cover source modules, i18n strings, prompt templates, and plan-sensitive constants introduced in Phase B.

## 9. Regression tests for Phase A preservation

Acceptance:

- Existing StyleFacts tests continue to pass unchanged.
- `styleFactsSha256` is unchanged by overlay acceptance/rejection/failure.
- Existing persisted profiles without overlay fields load successfully.
- Profiles with rejected/failed/stale overlay still render deterministic summaries and instructions.
- PPTX/PDF remain baseline diagnostics and do not gain export/high-fidelity promises through overlay.

## 10. E2E and observability tests

Acceptance:

- E2E happy path: import fixture profile -> deterministic StyleFacts visible -> run mocked overlay -> accepted evaluator report -> renderer output visible -> draft-processing prompt uses renderer output.
- E2E rejection path: import fixture profile -> run mocked unsafe overlay -> evaluator rejects -> UI shows deterministic fallback -> draft-processing prompt remains deterministic parity.
- E2E provider failure path: import fixture profile -> provider timeout/error -> failed state -> deterministic fallback -> audit record includes non-secret provider/model identifier and fallback reason.
- Observability/provenance assertions confirm no API keys/secrets are persisted, each run has timestamp/status/provider/model/dataScope/styleFactsSha256/evaluator result, and stale overlay attempted use is recorded.

## 11. Build/typecheck/static verification

Required commands for implementation handoff completion:

```powershell
npx tsc --noEmit --pretty false
npm run typecheck
npm run test:mocks
npm run build
```

Also run targeted tests for changed files, expected to include some or all of:

```powershell
npm run test -- src/lib/format-profile.test.ts
npm run test -- src/lib/style-facts.test.ts
npm run test -- src/stores/format-profile-store.test.ts
npm run test -- src/stores/chat-store.test.ts
npm run test -- src/i18n/i18n-parity.test.ts
```

If the repo uses a different test selector syntax, use the closest existing Vitest/npm pattern and record the exact commands in the implementation report.

## 12. Acceptance matrix

| Requirement | Required proof |
| --- | --- |
| LLM interprets only | schema/evaluator tests reject fact fields and overwrite attempts |
| `evidence-only` default | prompt/payload tests and static guard |
| Renderer owns final instruction | renderer tests + draft-processing integration tests |
| Closed schema | valid/invalid overlay parser tests |
| Evaluator/fallback | failure-mode integration tests with deterministic parity |
| Audit/provenance | unit tests assert metadata and no secrets |
| Provider/settings integration | mocked configured/unconfigured/provider-failure tests |
| UI states | store/UI tests for all states and i18n copy |
| Frontend/backend fusion | accepted overlay drives single renderer output, no duplicate competing summary path |
| Out-of-scope boundaries | keyword/static/evaluator guards |
| Build health | typecheck, test:mocks, build pass |

## 13. Stop conditions

Implementation is not complete until:

1. All targeted unit/integration/UI/store tests pass.
2. Phase A regression tests still pass.
3. Build/typecheck pass.
4. Boundary/data-scope guards pass.
5. Final implementation report lists accepted validation evidence and any not-tested gaps.

Do not claim Phase B complete if any overlay failure mode lacks deterministic fallback coverage or if any default path can send snippets/fulltext.

## 14. Architect REVISE Test Addendum（2026-05-14）

The Architect review requires the following tests before Phase B can be implemented or accepted. These tests are normative and refine earlier acceptance criteria.

### 14.1 Overlay state/persistence tests

Acceptance:

- Existing persisted profiles without `semanticOverlay` load as deterministic Phase A profiles.
- Legacy `refinement: { semanticStatus: "not-configured"; dataScope: "evidence-only" }` remains readable and does not synthesize an accepted overlay.
- Stored overlay statuses are limited to `running | accepted | rejected | failed`.
- Derived statuses `not-configured | eligible | stale` are computed from provider availability and overlay key match, not blindly trusted from persisted output.
- Audit trail entries are bounded and contain no secrets.

### 14.2 Stale key tests

Acceptance:

- Overlay key uses `profileId + updatedAt + profileSnapshotHash + styleFactsSha256`; no new `profileVersion` is required in Phase B.
- Changing `updatedAt`, `profileSnapshotHash`, or `styleFactsSha256` derives `stale`.
- Stale overlay is never used by renderer or draft-processing.
- Attempted stale use writes a `stale-detected` audit entry and falls back to deterministic Phase A output.

### 14.3 EvidenceOnlyOverlayInput allowlist tests

Acceptance:

- Prompt/provider code accepts only `EvidenceOnlyOverlayInput`, not a full `FormatProfileRecord`.
- Builder output contains only allowed profile metadata, snapshot metadata, bounded summaries, diagnostics, evidence catalog entries, and constraints.
- Builder output excludes `textSample`, raw extracted text, `paragraphSamples`, slide `textSample`, snippets, fulltext, source context, raw `styleFacts` JSON, full `structureProfile.formatSpecific`, and full `styleProfile.formatSpecific`.
- Tests include profiles that intentionally contain sensitive-looking `textSample`, paragraph samples, and slide text samples; none appear in provider payload or prompt.
- Evidence catalog entries use stable `valueDigest`/labels, not raw large values.

### 14.4 Provider wrapper and audit tests

Acceptance:

- Streaming provider output is accumulated and evaluated only after completion.
- Wrapper distinguishes `completed`, `cancelled`, `timeout`, `provider-error`, and `empty-response`.
- Cancellation produces `failed`/fallback reason `cancelled` and writes a non-secret audit entry.
- Timeout produces `failed`/fallback reason `timeout` and writes a non-secret audit entry.
- Empty provider text produces `failed`/fallback reason `empty-response`.
- Provider error produces `failed`/fallback reason `provider-error`.
- Completed unsafe output still becomes `rejected`, not `failed`, because evaluator rejection is distinct from transport failure.
- Provenance persists provider/model/request settings without API keys, authorization headers, raw request body, or raw full response.

### 14.5 Plan wording guard

Acceptance:

- Implementation docs/tests do not rely on an undefined `profileVersion`; they use the explicit stale key unless a future PRD introduces a real version field.
- No implementation path is allowed to pass `FormatProfileRecord` directly to the provider wrapper.

### 14.6 Restart recovery test

Acceptance:

- A persisted `semanticOverlay.status === "running"` loaded on app start is expired to deterministic fallback and cannot block the UI indefinitely.
- Recovery writes or preserves a non-secret audit entry indicating interrupted/expired running work.
- Renderer and draft-processing do not use any partial output from an expired running state.

## Phase B Test Plan Approval（2026-05-14）

**Status**: APPROVED for implementation validation.

**Additional mandatory gates from review**:
- State/persistence/backcompat tests for profiles without `semanticOverlay`.
- Stale-key tests using `profileId + updatedAt + profileSnapshotHash + styleFactsSha256`.
- EvidenceOnlyOverlayInput allowlist tests proving no `textSample`, raw body, paragraph samples, slide text samples, snippets/fulltext, source context, raw `styleFacts`, or full `formatSpecific` reaches provider payload/prompt.
- Provider wrapper tests for completed/cancelled/timeout/provider-error/empty-response and no-secret audit/provenance.
- Restart recovery test for persisted `running` overlays.

**Implementation cannot be accepted** until targeted tests plus `typecheck`, `test:mocks`, `build`, and boundary guards pass.

## Phase B Test Closure（2026-05-14）

**Result**: PASS for product mock/test/build gates.

**Executed**:
- Targeted tests: `npx vitest run src/lib/format-profile-semantic-overlay.test.ts src/stores/format-profile-store.test.ts src/lib/format-profile.test.ts src/lib/draft-processing.test.ts src/i18n/i18n-parity.test.ts --exclude='**/*.real-llm.test.ts'` — PASS, 5 files / 30 tests.
- `npm run typecheck` — PASS.
- `npm run test:mocks` — PASS, 85 files / 1143 tests.
- `npm run build` — PASS.

**Coverage delivered**:
- EvidenceOnlyOverlayInput allowlist blocks raw text/sample-bearing fields from provider payloads.
- Closed schema accepts valid evidence-cited overlay and rejects unknown evidence refs and fact-creation attempts.
- Accepted overlay remains separate from StyleFacts and enriches snapshot/renderer output.
- Stale key uses `profileId + updatedAt + profileSnapshotHash + styleFactsSha256`.
- Persisted running overlays expire to deterministic fallback on hydration.
- Existing Phase A profile/draft/i18n regressions remain green.

**Not tested**:
- Real provider call in desktop with user-configured credentials/model. Product wrapper is wired to existing provider abstraction and covered by mock-level paths; real-LLM smoke remains manual/follow-up.


---

## 原文件：`format-profile-semantic-refinement-harness-ralplan.md`


﻿# RALPLAN 草案：FormatProfile Semantic Refinement Harness

日期：2026-05-13  
范围：只规划实验 harness，不实现产品代码。  
目标：验证“确定性 FormatProfile 后接 LLM 语义精炼”是否能把机械画像变成可读、可控、可用于写作的画像与 `generationInstruction`，同时保留 raw evidence，并在 LLM 不可用/失败/被 evaluator 拒绝时无损降级。

## Evidence Snapshot

- 四格式 deterministic FormatProfile 产品化已通过：DOCX/XLSX/PPTX/PDF 均进入统一导入、probe、profile、snapshot、generationInstruction、diagnostics 管线。
- 现有实验在 `experiments/format-profile/`，包含 cases、schemas、phase scripts、offline generationInstruction/draft simulation；未做真实 LLM refine/generation。
- 要求记录指出下一阶段应为：`raw probe -> deterministic profile -> semantic refinement / LLM enrichment -> concise final profile -> final generationInstruction`。
- 手动输入模板已放弃；不得以“用户手写模板字段”作为兼容或回退路线。
- Architect/Critic 共识：LLM 只能生成 evidence-locked overlay，不能替换 raw probe 或 deterministic profile。

## RALPLAN-DR

### Principles

1. **Raw evidence immutable**：raw probe/full evidence 单独保存为不可变 artifact；LLM 不得覆盖、重命名或删除事实。
2. **Overlay, not rewrite**：refinement 输出 `semanticOverlay` 和 refined instruction；deterministic profile 始终保留。
3. **Fallback first**：LLM 未配置、调用失败、JSON/schema 失败、evaluator 拒绝时，输出必须等价于 deterministic profile + deterministic `generationInstruction` + warning diagnostic。
4. **Confidence 分层**：区分 `probeConfidence`、`structureConfidence`、`styleConfidence`、`semanticConfidence`、`evaluatorVerdict`。
5. **Small product experiment**：先在实验目录验证质量、边界、失败语义；通过产品化门禁前不改 `src/lib/format-profile.ts` 主线。
6. **Renderer owns final instruction**：LLM 只能产出 `semanticOverlay`；最终 `generationInstruction` 必须由 deterministic renderer 基于 deterministic profile + accepted overlay 合成。
7. **Inference is evidence-derived, not evidence-free**：`inference: true` 仅表示从证据归纳/推导；所有 claim 仍必须引用有效 evidence IDs。
8. **Final status separate from attempt status**：LLM 尝试失败、evaluator 拒绝、最终 fallback 必须分字段记录，避免 rejected output 被产品层误消费。

### Decision Drivers

1. **产品价值**：画像要从“机械证据列表”升级为“可读、短、可执行的写作/适配约束”。
2. **证据安全**：避免 LLM 幻觉污染已通过的四格式 deterministic 管线。
3. **可产品化**：需要可复跑 harness、schema、prompt version、hash、evaluator、报告，才能决定是否迁入主线。

### Options & Tradeoffs

| 方案 | 描述 | 优点 | 风险/代价 | 决策 |
| --- | --- | --- | --- | --- |
| A. Evidence-locked LLM overlay | deterministic profile 后调用 LLM，但 LLM **只输出** schema-validated `semanticOverlay`；harness renderer 再生成 `renderedGenerationInstruction`，所有 claims 引用 evidence IDs | 最稳；可降级；便于 evaluator；符合 raw evidence 保留；产品消费路径可控 | schema/evaluator/renderer 成本较高 | **选择** |
| B. LLM 直接重写 FormatProfile | 把 deterministic profile 交给 LLM 生成最终 profile | 见效快；prompt 简单 | 易幻觉；confidence 混乱；破坏 fallback 与追溯 | 拒绝 |
| C. 仅 deterministic cleanup | 不接真实 LLM，只做标题截断、章条拆分、字体过滤等清洗 | 低风险；可改善显著噪声；可直接成为 baseline | 不能回答“LLM 是否能稳定提供更高语义质量且不污染证据”这个阶段问题；不能验证模型失败/拒绝/降级链路 | 可作为 Phase 1 baseline，不作为最终方案 |

## ADR

- **Decision**：建设 `experiments/format-profile-semantic-refinement/` 小型 harness，采用 Option A：deterministic profile + immutable raw evidence + optional evidence-locked semantic overlay + final instruction。
- **Drivers**：提升画像语义质量；保留已验收 deterministic 能力；让 LLM 失败可诊断且可降级。
- **Alternatives considered**：直接 LLM rewrite；仅 deterministic cleanup。
- **Why chosen**：overlay 模型同时满足产品体验、证据安全、可验证迁入。
- **Consequences**：需要新增实验 schema、prompt、runner/evaluator/report；产品代码迁入需等待门禁。
- **Follow-ups**：若 harness 通过，再规划 `src/lib/format-profile-refinement.ts`、UI diagnostic、profile snapshot hash migration。

## Phase Plan

### Phase 0 — Harness Baseline

- 建立实验目录、schema、fixtures/cases、输出规范。
- 默认从 `runtime/format-profile/outputs/phase2/{caseId}/profile.json`、`generation-instruction.md`、`diagnostics.json` 抽取 deterministic profile、deterministic instruction、diagnostics 和 rawProbeFacts；`phase0/phase1` 仅作为回退或对照。`experiments/format-profile/` 只作为脚本/spec/case 源，不作为主要输出事实源。
- 固定 sample set：至少 DOCX 制度类、XLSX 指标类、PPTX 汇报类、PDF 低保真参考各 1 个。

### Phase 1 — Deterministic Cleanup Baseline

- 不调用 LLM，只做可解释清洗 baseline：标题长度限制、章/节/条拆分、正文段落过滤、字体/语言噪声过滤、页面尺寸可读化。
- 产出 baseline report，作为 LLM refinement 的最低对照线。

### Phase 2 — Real LLM Refinement Harness

- 第一轮只做 vertical slice：1 个 DOCX golden case + 1 个低置信/失败 case，先锁死 schema/evaluator/fallback parity。
- 第二轮再扩展到 DOCX / XLSX / PPTX / PDF smoke cases。
- 使用 injected LLM call；支持 disabled/failure/mock-live 三种模式。
- LLM 只接收 evidence IDs、deterministic profile 摘要、raw snippets、diagnostics、任务目标。
- 输出 strict JSON `semanticOverlay`；不得输出 markdown 自由文本，不得直接输出最终 `generationInstruction`。

### Phase 3 — Evaluator Gate

- 对 LLM 输出执行 schema、evidence refs、hallucination、length budget、fallback parity、instruction usability 检查。
- evaluator 失败时生成 rejected report，并走 deterministic fallback。
- 所有 accepted/refused/fallback 输出都必须记录 attemptStatus、evaluatorVerdict、finalStatus 和 hash provenance。

### Phase 4 — Productization Decision Report

- 汇总每个 case：deterministic baseline vs refined overlay vs fallback。
- 给出是否迁入主线的结论：Go / No-Go / Partial-Go。
- 只在 Go 或 Partial-Go 后另起产品化计划；本 harness 不直接修改主线。

## Directory Structure Suggestion

```text
experiments/format-profile-semantic-refinement/
  README.md
  cases/
    docx-policy.case.json
    xlsx-metrics.case.json
    pptx-briefing.case.json
    pdf-reference.case.json
  fixtures/
    raw-evidence/              # immutable copied/synthesized evidence artifacts
  spec/
    refinement-input.schema.json
    llm-overlay-output.schema.json      # LLM 直接输出，只允许 overlay
    harness-refinement-output.schema.json # harness 最终输出，含 rendered instruction/fallback
    evaluator-report.schema.json
  prompts/
    refine-format-profile.v0.md
  scripts/
    run-refinement.mjs
    lib/
      load-input.mjs
      deterministic-cleanup.mjs
      llm-refiner.mjs
      evaluator.mjs
      fallback.mjs
  outputs/                     # gitignored except sample report if desired
    {caseId}/
      input.json
      deterministic-profile.json
      raw-evidence.json
      semantic-overlay.json
      final-generation-instruction.md
      evaluator-report.json
      fallback-output.json
  reports/
    productization-decision.md
```

Product migration target, only after gates pass:

```text
src/lib/format-profile-refinement.ts
src/lib/format-profile-refinement.test.ts
src/lib/draft-processing.ts      # consume refined instruction only after fallback contract exists
```

## Input Schema Draft

```ts
type RefinementInput = {
  schemaVersion: 'format-profile-refinement-input.v0'
  caseId: string
  formatType: 'docx' | 'xlsx' | 'pptx' | 'pdf'
  taskMode: 'generate_from_profile' | 'adapt_draft_to_profile'
  rawEvidence: {
    evidenceId: string
    sha256: string
    artifactPath: string
    items: EvidenceItem[] // same shape as Evidence Catalog Specification; includes pointer, sha256, redacted/capped text semantics
  }
  deterministicProfile: FormatProfile
  deterministicInstruction: string
  sourceHashes: {
    rawEvidenceSha256: string
    deterministicProfileSha256: string
    deterministicInstructionSha256: string
  }
  constraints: {
    maxInstructionChars: number
    maxOverlayClaims: number
    allowInference: boolean
  }
}
```

## Output Schema Draft

### Schema Split

必须区分三类 schema，避免 executor 把 LLM 输出当成产品可消费输出：

1. `LLMOverlayOutput`：LLM 唯一允许输出的 JSON，只包含 `semanticOverlay`、claim、evidenceRefs、confidence/rationale；不得包含 `renderedGenerationInstruction`。
2. `HarnessRefinementOutput`：harness 最终输出，由 runner/evaluator/renderer 合成，包含 attemptStatus、evaluatorVerdict、finalStatus、fallbackReason、renderedGenerationInstruction、hash provenance。
3. `EvaluatorReport`：evaluator 的独立判定产物，记录 pass/fail reason、rule results、metrics、rejected claims。

所有 schema 必须 closed：`additionalProperties: false`，并包含字段长度上限、数组数量上限、evidenceRef pattern 和 diagnostic code 枚举。

```ts
type LLMOverlayOutput = {
  schemaVersion: 'format-profile-llm-overlay-output.v0'
  caseId: string
  confidence: {
    semanticConfidence: Confidence
  }
  semanticOverlay: {
    documentKind?: Claim<string>
    structureSummary?: Claim<string[]>
    styleSummary?: Claim<string[]>
    writingConstraints?: Claim<string[]>
    formatBoundaries?: Claim<string[]>
  }
  diagnostics?: Array<{ severity: 'info' | 'warning'; code: string; message: string }>
  // forbidden by closed schema: renderedGenerationInstruction, finalGenerationInstruction, rawEvidence, deterministicProfile
}

type HarnessRefinementOutput = {
  schemaVersion: 'format-profile-harness-refinement-output.v0'
  caseId: string
  attemptStatus: 'not_attempted' | 'llm_completed' | 'llm_error' | 'invalid_json' | 'schema_invalid'
  evaluatorVerdict: 'pass' | 'fail' | 'not_run'
  finalStatus: 'refined' | 'fallback'
  fallbackReason?: 'llm_disabled' | 'llm_error' | 'invalid_json' | 'schema_invalid' | 'evaluator_rejected' // required when finalStatus='fallback'
  provenance: {
    refinerVersion: string
    promptVersion: string
    model?: string
    inputSha256: string
    rawEvidenceSha256: string
    deterministicProfileSha256: string
    deterministicInstructionSha256: string
    overlaySha256?: string
    renderedInstructionSha256: string
  }
  confidence: {
    probeConfidence: Confidence
    structureConfidence: Confidence
    styleConfidence: Confidence
    semanticConfidence: Confidence
  }
  acceptedOverlay?: LLMOverlayOutput['semanticOverlay'] // forbidden when finalStatus='fallback'
  renderedGenerationInstruction: string
  evaluatorReportPath: string
  diagnostics: Array<{ severity: 'info' | 'warning' | 'error'; code: string; message: string }>
}

type Claim<T> = {
  value: T
  evidenceRefs: string[] // required for every claim, including inference claims
  inference: boolean // true means evidence-derived inference, not evidence-free guess
  rationale: string
}
```

### Status Semantics

- `--mode disabled` sets `attemptStatus='not_attempted'`, `evaluatorVerdict='not_run'`, `finalStatus='fallback'`, `fallbackReason='llm_disabled'`.
- LLM error / invalid JSON / schema invalid set `evaluatorVerdict='not_run'`, `finalStatus='fallback'`, with matching `fallbackReason`.
- Evaluator rejection after a schema-valid overlay sets `attemptStatus='llm_completed'`, `evaluatorVerdict='fail'`, `finalStatus='fallback'`, `fallbackReason='evaluator_rejected'`.
- Accepted overlay sets `attemptStatus='llm_completed'`, `evaluatorVerdict='pass'`, `finalStatus='refined'`, no `fallbackReason`.
- `acceptedOverlay` is present only when `finalStatus='refined'`; it is forbidden when fallback.
- Fallback output must include deterministic hashes exactly matching input hashes.


## LLM Prompt Structure

1. **System**：你是 evidence-locked FormatProfile refiner；只能基于给定 evidence；不能发明事实；必须输出 JSON。
2. **Developer rules**：
   - raw evidence 是事实源；deterministic profile 是初稿；你的输出是 overlay。
   - 压缩、排序、归纳，不得覆盖或删除原始事实。
   - 每个 claim 必须有 `evidenceRefs`；无法确认则标 `inference: true` 并降低 confidence。
   - 不得恢复手动模板概念；不得承诺 DOCX/XLSX/PPTX/PDF 高保真导出。
3. **Task block**：按格式执行重点：DOCX 章/节/条与样式；XLSX 指标/口径；PPTX 大纲/逐页讲述；PDF 低保真边界。
4. **Input blocks**：`rawEvidence.items`、deterministic profile summary、diagnostics、existing deterministic instruction、length budget。
5. **Output contract**：LLM 只输出 `LLMOverlayOutput` JSON；无 markdown；无额外字段；不得输出任何 instruction 字段。`maxInstructionChars` 只约束 renderer 后续生成的 `renderedGenerationInstruction`。

## Evaluator Rules

Fail immediately if:

- JSON parse 或 schema validation 失败。
- 任一 claim 缺少有效 `evidenceRefs`，包括 `inference: true` 的 claim。
- 任一 evidenceRef 不存在于 `rawEvidence.items[].id` 或 deterministic profile evidence catalog。
- LLM 输出直接覆盖 deterministic profile、raw evidence，或绕过 renderer 写入最终 instruction。
- 输出新增 raw evidence 中不存在的章节、字体、页数、sheet、slide、PDF 能力事实。
- `renderedGenerationInstruction` 超出 length budget 或比 deterministic instruction 更冗长且无压缩收益。
- 出现手动模板/用户手写模板字段/高保真导出承诺。
- confidence 被抬高但无 evidence/rationale。
- LLM 失败或被拒绝时 fallback output 的 deterministic profile hash、deterministic instruction hash 与输入不完全一致。

Pass only if:

- schema valid；所有 claims 可追溯。
- DOCX 制度类结构优先章/节/条，过滤长正文标题。
- XLSX 输出聚焦指标、口径、观察、结论，不伪造表格文件生成能力。
- PPTX 输出聚焦汇报结构与逐页讲述，不承诺生成 PPTX。
- PDF 明确文本层/扫描/低保真边界。
- refined instruction 更短、更清晰、可执行；保留 deterministic fallback。

## Pass / Fail Standard for Harness

**通过：**

- 第一轮机制验收：至少 1 个 DOCX golden case + 1 个低置信/失败 case 跑通 schema/evaluator/fallback parity。
- 第二轮 smoke 验收：4 个格式 sample 全部完成 input/output/report。
- 产品化 Go/Partial-Go：四格式都需覆盖，且应复用既有 35 样本清单中的代表样本；4 个 smoke sample 只能支持 harness pass，不能单独支持产品化 Go。
- LLM disabled、LLM thrown error、invalid JSON 三类失败路径均产生 deterministic fallback + warning diagnostic。
- 至少 DOCX 样例相对 deterministic cleanup baseline 明显降低机械标题噪声，并生成可消费 instruction。
- evaluator report 可解释每个 reject/pass 决策。
- 不修改主线产品代码。

**失败：**

- raw evidence 被 overlay 覆盖或无法追溯。
- evaluator 无法稳定发现 hallucination/overlong/unsupported export/manual-template 概念。
- fallback 不等价于 deterministic 输出。
- LLM 输出质量无法稳定超过 deterministic cleanup baseline。

## Productization Gates

迁入 `src/` 前必须满足：

1. Harness report 判定 Go/Partial-Go，并记录失败 case。
2. schema version、prompt version、refiner version、model metadata、content hashes 均进入 provenance。
3. UI/diagnostics 文案明确：未配置 LLM 时显示“当前为原始探测画像，未进行智能精炼”。
4. 产品层保留 deterministic generationInstruction 作为默认 fallback。
5. 单测计划覆盖：schema validation、fallback parity、evidence refs、confidence split、snapshot content hash。
6. 不恢复手动输入模板入口。
7. schema 必须 closed：`additionalProperties: false`、字段长度上限、claim 数量上限、evidenceRef pattern、diagnostic code 枚举。
8. LLM 调用必须有 timeout、token budget、raw snippet redaction、no external send by default、model metadata、promptVersion、refinerVersion、input/output hash。
9. `semanticConfidence` 不得提升 `probeConfidence` / `structureConfidence` / `styleConfidence`；产品 UI 必须分别展示 deterministic confidence 与 semantic refinement status。

## Non-goals

- 不实现真实产品代码。
- 不承诺 DOCX/PDF/PPTX/XLSX 高保真导出或复刻。
- 不做通用研究平台、prompt playground、人工模板编辑器。
- 不让 LLM 直接修改 raw evidence 或 deterministic profile。
- 不让 LLM 直接生成产品最终消费的 `generationInstruction`；产品可消费 instruction 必须由 renderer 合成。
- 不用 LLM 生成最终文档正文作为本 harness 的验收核心；本阶段只验证 profile/instruction refinement。

## Handoff Guidance

- 推荐下一步：`$ralph` 单 owner 执行该 harness，先建 schema/evaluator/fallback，再接 LLM。
- 若并行：`$team` 分三 lane：schema+runner、prompt+LLM adapter、evaluator+reports；共享写入边界必须限定在 `experiments/format-profile-semantic-refinement/`。
- Goal-mode：若要作为产品化目标跟踪，建议 `$ultragoal`；若要扩大为多模型/多样本研究，改用 `$autoresearch-goal`。


## Architect Review Resolution（2026-05-13）

Architect verdict: WATCH → revised.

已采纳修订：

- 收紧为 renderer owns final instruction：LLM 只输出 overlay。
- 分离 attemptStatus / evaluatorVerdict / finalStatus。
- 所有 claim 均必须引用 evidenceRefs，inference 也不能无证据猜测。
- 第一轮机制验收改为 DOCX vertical slice + failure path；四格式 smoke 不再等同产品化 Go。
- 产品化 Go 必须复用既有 35 样本清单中的代表样本。
- 增加 closed schema、timeout、token budget、redaction、metadata、hash、confidence 不抬高等门禁。


## Evidence Catalog Specification

现有实验 profile 中 evidence 还不是稳定 ID 模型，因此 harness 必须先生成 `raw-evidence.json`，作为 LLM 和 evaluator 的唯一 evidence catalog。

### Evidence Item Shape

```ts
type EvidenceItem = {
  id: string
  kind: 'raw.docx.paragraph' | 'raw.docx.style' | 'raw.xlsx.sheet' | 'raw.pptx.slide' | 'raw.pdf.fact' | 'profile.structure' | 'profile.style' | 'diagnostic'
  sourcePath?: string
  pointer: string        // JSON pointer or logical path, e.g. /rawProbeFacts/structure/headingCandidates/3
  text?: string          // redacted and length-limited
  value?: unknown        // primitive or small structured value
  sha256: string
}
```

### ID Rules

- IDs must be deterministic after sorting and normalization.
- Examples:
  - `raw.docx.paragraph.0001`
  - `profile.structure.heading.0003`
  - `profile.style.fontUsage.0002`
  - `raw.xlsx.sheet.0001`
  - `raw.pptx.slide.0004`
  - `raw.pdf.fact.pageCount`
- ID generation must not depend on timestamps, process order, random IDs, or absolute temp paths.
- Duplicate evidence items are de-duplicated by normalized `{kind,pointer,text/value}` hash.
- Text snippets must be redacted and capped before LLM use; full raw artifact remains local and hash-addressed.

### Reference Rules

- Every LLM claim must reference one or more valid `EvidenceItem.id` values.
- `inference: true` means evidence-derived inference, not evidence-free guessing.
- Any claim with missing, unknown, duplicate-only, or unrelated evidenceRefs fails evaluator.


## Measurable Quality Metrics

主观验收必须转化为 evaluator 可测指标。

### DOCX Structure Noise Metrics

For each DOCX golden case, compute before/after:

- `headingCandidateCount`：refined 结构项数量不得超过 deterministic heading candidates 的 60%，除非 deterministic 已少于 10。
- `overlongHeadingRatio`：超过 60 字的结构项比例应低于 10%。
- `numericOnlyHeadingCount`：纯数字、百分比、金额等误判标题应为 0。
- `chapterArticleSplitScore`：包含 `第X章` / `第X条` 的样本中，章、条应拆成独立层级或独立结构项。
- `goldenSnapshotMatch`：DOCX golden case 必须匹配 expected overlay snapshot 的关键字段：documentKind、top-level structure labels、formatBoundaries。

### Instruction Usability Metrics

- `renderedGenerationInstruction.length <= maxInstructionChars`。
- refined instruction 长度应小于 deterministic cleanup baseline instruction 的 70%，或 `qualityScore >= 0.75` 且 evaluator report 解释为何不能进一步压缩。
- 必须包含段落：结构摘要、样式摘要、写作约束、诊断边界。
- 禁止包含：手动模板、用户手填字段、高保真导出承诺、未证据支持的事实。
- 至少 80% 的 writingConstraints 必须引用 accepted overlay claims 或 deterministic profile evidence。

### Baseline Comparison

LLM overlay 只有在量化 scorecard 明显优于 deterministic cleanup baseline 时才允许 Go：

- `qualityScore = 0.35 * structureNoiseScore + 0.25 * instructionCompressionScore + 0.20 * evidenceCoverageScore + 0.20 * boundarySafetyScore`。
- `structureNoiseScore` 按格式分流：
  - DOCX：使用 overlongHeadingRatio、numericOnlyHeadingCount、chapterArticleSplitScore。
  - XLSX：使用 sheet/metric boundary score，要求不把 sheet/公式/样式误写成长文事实，不承诺生成电子表格。
  - PPTX：使用 slide narrative coverage score，要求覆盖 slide 主题/讲述边界，不承诺生成 PPTX。
  - PDF：使用 reference-boundary score，要求明确 text-layer / scan / low-fidelity 边界，不把 PDF 当作高保真模板。
  - 如果某格式没有结构噪声概念，则 `structureNoiseScore = boundarySafetyScore`，并在 evaluator report 中说明。
- Go 门槛：四格式代表样本平均 `qualityScore >= 0.80`，且无 critical evaluator failure。
- Partial-Go 门槛：DOCX golden `qualityScore >= 0.80` 且其他格式 fallback 安全；只允许迁 DOCX 或 deterministic cleanup。
- 若仅与 raw deterministic 持平，则 Partial-Go 只能迁 deterministic cleanup，不迁 LLM overlay。


## Pre-mortem

1. **Evaluator false pass**：hallucinated claim 带着无关 evidenceRef 通过。缓解：evidence kind 与 claim kind 必须匹配；report 记录 rule-level reasons。
2. **Evidence ID drift**：不同机器/运行次序生成不同 IDs，导致 claim 无法复现。缓解：排序、去随机、去绝对临时路径，使用 pointer/hash。
3. **Fallback hash parity 破坏**：时间戳、随机 profile id、路径差异导致 fallback 无法等价。缓解：fallback 输出只引用输入 hash，不重建 profile；测试 byte/hash parity。
4. **LLM 越权输出 instruction**：模型直接生成最终 instruction 绕过 renderer。缓解：LLM schema 禁止 instruction 字段；additionalProperties=false；schema invalid 走 fallback。
5. **隐私外发**：raw snippets 默认送外部模型。缓解：默认 mode=disabled/mock；real-llm mode 必须显式开关；snippet redaction 和长度上限。
6. **LLM flakiness**：同输入多次输出不同，报告不可复跑。缓解：保存 prompt/model/version/input/output hash；real LLM 结果只用于报告，不作为无 hash 的隐式状态。
7. **Rejected overlay 被误消费**：下游读取 rejected output。缓解：finalStatus 只有 refined/fallback；产品只消费 HarnessRefinementOutput.renderedGenerationInstruction，且 evaluatorVerdict=pass 才可 refined。


## Harness Test Matrix and Commands

### Unit Tests

- schema closed validation：额外字段、超长字段、过多 claims 应失败。
- evidence ref validator：缺失、未知、不相关 refs 应失败。
- renderer：只从 deterministic profile + accepted overlay 生成 instruction。
- fallback parity：disabled/error/invalid/schema fail/evaluator reject 时 hash 与 deterministic 输入一致。
- status transitions：attemptStatus / evaluatorVerdict / finalStatus 组合合法。
- provenance：promptVersion、refinerVersion、model、input/output hash 必填或按 mode 合法为空。

### Integration Tests

- `--mode disabled`：不调用 LLM，输出 fallback + warning。
- `--mode mock-pass`：mock overlay 通过 evaluator，renderer 输出 refined instruction。
- `--mode mock-hallucination`：mock 不存在 evidence claim，被 evaluator 拒绝并 fallback。
- `--mode mock-overreach-instruction`：mock 输出 `renderedGenerationInstruction` / `finalGenerationInstruction` 等越权字段，必须 schema invalid 并 fallback。
- `--mode mock-invalid-json`：JSON parse fail，fallback。
- `--mode mock-schema-invalid`：schema fail，fallback。
- `--mode mock-error`：LLM adapter throw，fallback。

### Smoke / Report Tests

- Stage 1 smoke：DOCX golden + one low-confidence/failure case。
- Stage 2 smoke：DOCX / XLSX / PPTX / PDF 各 1 个。
- Productization report：复用既有 35 样本清单中的代表样本，作为 Go/Partial-Go 证据；不能用 4 个 smoke sample 单独支持产品化 Go。

### Command Shape

```powershell
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode disabled
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-hallucination --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-invalid-json --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-overreach-instruction --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-schema-invalid --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-error --case docx-policy
# real LLM mode must be explicit and disabled by default
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --case docx-policy --allow-external-llm
```

No E2E UI test is required for the harness phase because no product UI is modified. Observability is the generated evaluator/report JSON plus productization-decision markdown.


## Critic ITERATE Resolution（2026-05-13）

已按 Critic 必须修改项修订：

- Option A 已改为 LLM 只输出 overlay，renderer 生成 rendered instruction。
- 明确三类 schema：LLMOverlayOutput、HarnessRefinementOutput、EvaluatorReport。
- 新增 Evidence Catalog Specification：稳定 evidence IDs、hash、排序、去重、截断、redaction。
- 新增可测质量指标：heading 噪声、超长标题、数字误判、章条拆分、instruction 长度/段落/禁词。
- 新增 Pre-mortem：false pass、ID drift、hash parity、越权 instruction、隐私外发、flakiness、rejected误消费。
- 新增 Harness Test Matrix and Commands：unit/integration/smoke/report 和 CLI mode。


## Architect WATCH Resolution（2026-05-13 second review）

已按二次 Architect WATCH 必须项修订：

- `RefinementOutput` 更名/拆分为 `LLMOverlayOutput` 与 `HarnessRefinementOutput`，schemaVersion 分别为 LLM overlay 与 harness final output。
- Prompt output contract 明确 LLM 不输出 instruction；`maxInstructionChars` 只约束 renderer。
- Input schema 的 `rawEvidence.items` 统一引用 `EvidenceItem[]`。
- Integration matrix 增加 `mock-overreach-instruction`。
- Baseline Go 阈值改为量化 `qualityScore` 与 Go / Partial-Go 门槛。


## Critic ITERATE Resolution（2026-05-13 second review）

已按 Critic 复评 3 个必须项修订：

- 输入来源精确为 `runtime/format-profile/outputs/phase2/{caseId}/profile.json`、`generation-instruction.md`、`diagnostics.json`；phase0/phase1 只作回退/对照。
- `evaluatorVerdict` 增加 `not_run`，并明确 disabled/error/invalid/schema/rejected/refined 的状态组合；fallbackReason 在 fallback 时必填，acceptedOverlay 在 fallback 时禁止出现。
- `qualityScore` 增加四格式分流：DOCX heading noise，XLSX sheet/metric boundary，PPTX slide narrative coverage，PDF reference-boundary；无结构噪声概念时用 boundarySafetyScore 替代并记录说明。

## Implementation Record（2026-05-13）

已按本计划完成实验态 harness 落地，保持产品 `src/` 链路未接入 LLM：

- 新增 `experiments/format-profile-semantic-refinement/`：四格式 case、closed JSON schema、prompt、README、CLI、evidence catalog、renderer、evaluator、fallback 与 mock refiner。
- 输入源固定读取 `runtime/format-profile/outputs/phase2/{sourceCaseId}/profile.json`、`generation-instruction.md`、`diagnostics.json`。
- LLM 模拟输出只允许 `LLMOverlayOutput`；最终 instruction 只由 harness renderer 生成。
- fallback 输出禁止 `acceptedOverlay`，并要求 `renderedInstructionSha256 == deterministicInstructionSha256`。

验证命令与结果：

```powershell
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode disabled
# 4/4 fallback: llm_disabled, evaluatorVerdict=not_run

node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass
# 4/4 refined: docx-policy/pdf-reference/pptx-briefing/xlsx-metrics evaluatorVerdict=pass

$modes=@('mock-hallucination','mock-overreach-instruction','mock-invalid-json','mock-schema-invalid','mock-error'); foreach ($m in $modes) { node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode $m --case docx-policy }
# hallucination -> evaluator_rejected fallback
# overreach instruction -> schema_invalid fallback
# invalid json -> invalid_json fallback
# schema invalid -> schema_invalid fallback
# mock error -> llm_error fallback
```

补充断言：13 项输出断言通过，包括 fallback hash parity、fallback 无 acceptedOverlay、mock-pass refined 有 acceptedOverlay。

生成报告：

- `experiments/format-profile-semantic-refinement/reports/validation-summary.json`
- `experiments/format-profile-semantic-refinement/reports/productization-decision.md`

下一步门槛：若要产品接入，必须另起集成阶段，在 feature flag 下添加 LLM adapter；本 harness 不直接修改产品链路。

## Real LLM Execution Record（2026-05-13）

本阶段已在实验 harness 中接入真实 LLM 通道；产品链路仍未接入。

实现变更：

- `real-llm` 支持 OpenAI-compatible HTTP provider：`FORMAT_PROFILE_LLM_*` / `MINIMAX_*` / `OPENAI_*` / `OLLAMA_*`。
- `real-llm` 支持本机 `codex-cli` provider：`FORMAT_PROFILE_LLM_PROVIDER=codex-cli`，默认模型 `gpt-5.3-codex-spark`。
- prompt 强化：`caseId` 必须使用 harness caseId；`evidenceRefs` 只能引用 `allowedEvidenceRefIds` 中的 id，不能引用 `deterministicProfileSummary`/`sourceCaseId`。
- CLI 输出新增 `llm-provider.json` 与 `llm-provider-output.raw.txt`，不记录密钥。

真实测试结果：

```powershell
$env:FORMAT_PROFILE_LLM_PROVIDER='codex-cli'
$env:FORMAT_PROFILE_CODEX_MODEL='gpt-5.3-codex-spark'
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --case xlsx-metrics --allow-external-llm
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --case pptx-briefing --allow-external-llm
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --case docx-policy --allow-external-llm
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --case pdf-reference --allow-external-llm
```

结果：

- DOCX `docx-policy`: refined, evaluator pass, quality 0.984。
- XLSX `xlsx-metrics`: refined, evaluator pass, quality 0.956。
- PPTX `pptx-briefing`: refined, evaluator pass, quality 0.956。
- PDF `pdf-reference`: refined, evaluator pass, quality 0.956。

断言：`real_llm_refined=4/4 failed=[]`。

HTTP provider 尝试：

- `MINIMAX_API_KEY` 存在，但 MiniMax HTTP 通道返回 429：5 小时 usage limit reached；harness 按 `llm_error` 安全 fallback。
- `DEEPSEEK_API_KEY` 返回 401 invalid key；未作为有效测试通道。
- `STEPFUN_API_KEY` `/v1/models` 可访问，但 chat completions 返回 402 quota exceeded；未作为有效测试通道。
- 本机 Ollama/llama.cpp 常见端口当前不可用。

当前结论：

```text
真实 LLM harness 测试：通过（codex-cli provider，4/4 refined）
HTTP hosted provider 测试：受额度/认证限制，未通过
产品 LLM 接入：仍未开始
```


---

## 原文件：`format-profile-datascope-comparison.md`


﻿# PRD/Test Plan: FormatProfile DataScope Comparison Experiment

## Outcome
Extend only `experiments/format-profile-semantic-refinement` so the harness can compare three prompt input scopes for semantic refinement:

- `evidence-only` — default/current safety baseline.
- `evidence-plus-snippets` — explicit snippet authorization required.
- `evidence-plus-fulltext` — explicit fulltext authorization required.

No product code changes. No absolute local paths, secrets, API keys, raw uncapped source content, or source filesystem details may appear in prompts, persisted artifacts, summaries, or reports.

## Evidence Snapshot
- Existing harness supports `disabled`, mock rejection modes, and `real-llm` gated by `--allow-external-llm`.
- Current input builder writes `input.json`, `raw-evidence.json`, and `deterministic-profile.json`; this means the experiment must add artifact-level redaction, not just prompt redaction.
- Current output path is `outputs/<mode>/<caseId>`; a dataScope matrix would clobber results unless scope is added to the output layout.
- Current evaluator validates `evidenceRefs` only against `rawEvidence`; source context must become evidence-addressable if it can influence claims.
- Prior result: `real-llm` via `codex-cli:gpt-5.3-codex-spark`, 4/4 refined and evaluator pass in evidence-only mode.

## RALPLAN-DR Summary

### Principles
1. Experiment boundary: modify only experiment harness/docs/spec/reporting under `experiments/format-profile-semantic-refinement` and `.omx` plans.
2. Safety by default: omitted `--data-scope` is byte/behavior-compatible with current `evidence-only` as far as practical.
3. Explicit escalation: snippets and fulltext have separate authorization gates; fulltext is never implied by snippet authorization.
4. Evidence-addressable context: any source content sent to LLM must be represented as capped, hashed chunk IDs that evaluator can validate.
5. Artifact containment: every persisted output is redacted or leak-scanned, including raw provider outputs.
6. Comparable measurement: all scopes run the same cases, evaluator, fallback semantics, and summary schema.

### Top Drivers
1. Determine whether snippets/fulltext materially improve semantic quality versus current evidence-only baseline.
2. Preserve current fallback/hash guard behavior when richer context is unauthorized, unavailable, too large, redacted, or rejected.
3. Prevent privacy regressions before any product integration is considered.

### Viable Options
- Option A: Add `--data-scope evidence-only|evidence-plus-snippets|evidence-plus-fulltext` to existing runner as a thin dispatcher over isolated scope builders.
  - Pros: direct comparison in current harness; one CLI; easy to report.
  - Cons: higher regression/leakage risk unless default path and artifacts are guarded.
- Option B: Keep runner evidence-only and add a separate comparison wrapper script that prepares richer payloads.
  - Pros: stronger isolation for current baseline.
  - Cons: still needs prompt/evaluator/schema changes; two orchestration paths.
- Decision: Option A only if implemented as an isolated dispatcher: `evidence-only` code path remains default and compatibility-checked; snippets/fulltext use separate builders, redaction policy, output path, and authorization gates. If compatibility check fails, fall back to Option B.

## ADR
- Decision: Introduce experiment-only `dataScope` control with isolated scope builders, strict authorization gates, sourceContext chunks, artifact redaction, and matrix reporting.
- Drivers: quality delta measurement, privacy/no-leak guarantees, fallback preservation.
- Alternatives considered: wrapper-only comparison; product feature flag; no richer context. Product flag is rejected as premature; no richer context cannot answer the experiment question; wrapper-only remains fallback if default path compatibility is at risk.
- Consequences: more report/artifact complexity; requires leak scanner and sourceContext schema before real-LLM runs.
- Follow-ups: product adapter planning only after evidence shows material quality gain without safety regressions.

## CLI/Auth Contract

### CLI

```powershell
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --data-scope evidence-only --allow-external-llm
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --data-scope evidence-plus-snippets --allow-external-llm --allow-snippets
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --data-scope evidence-plus-fulltext --allow-external-llm --allow-fulltext
```

### Rules
- `--data-scope` default: `evidence-only`.
- `evidence-plus-snippets` requires `--allow-snippets`.
- `evidence-plus-fulltext` requires `--allow-fulltext`; `--allow-snippets` does not authorize fulltext.
- Unauthorized rich scope **fails closed before prompt construction or LLM call**.
- Optional downgrade, if implemented, must be explicit: `--downgrade-unauthorized`; it must record `requestedScope`, `effectiveScope=evidence-only`, and `fallbackReason=source_context_unauthorized`.

## Data Contract

### Existing rawEvidence
Retain current `rawEvidence` IDs and hashes. Add quality metadata only if needed, but do not break existing mock/real-LLM evidence-only tests.

### New sourceContext
Only present for authorized richer scopes. It is not a free-form blob; it is an array of evidence-addressable chunks:

```json
{
  "id": "source.snippet.0001",
  "kind": "source.snippet",
  "linkedEvidenceRefs": ["raw.docx.paragraph.0001"],
  "text": "bounded sanitized excerpt",
  "charLength": 180,
  "tokenEstimate": 80,
  "redactionStatus": "clean|redacted|blocked",
  "qualityFlags": ["heading-candidate-neighborhood"],
  "sha256": "..."
}
```

Fulltext mode uses chunks, not one raw field:

```text
source.fulltext.chunk.0001
source.fulltext.chunk.0002
...
```

### Caps
- Snippet chunks: small bounded excerpts near structure/field/slide/page evidence; per chunk and total caps required.
- Fulltext chunks: bounded total token/char cap; if exceeded, use deterministic truncation/sampling and record `truncated=true`.
- Absolute paths and secret-like patterns are removed before hashing/persistence where possible; blocked content records redaction stats.

## Artifact/Leakage Contract

All generated files under experiment outputs are subject to redaction/leak scanning, including:

- `input.json`
- `raw-evidence.json`
- `deterministic-profile.json`
- `source-context.json`
- `llm-output.raw.txt`
- `llm-provider-output.raw.txt`
- `semantic-overlay.json`
- `harness-output.json`
- `evaluator-report.json`
- summaries/reports

For snippets/fulltext scopes, raw provider output must either be redacted before persistence or replaced with hash + bounded diagnostic excerpt. Acceptance requires a repo-local leak scanner over every generated artifact.

## Output Layout

Avoid clobbering by including scope:

```text
outputs/<mode>/<requestedScope>/<effectiveScope>/<caseId>/...
```

Each output and summary must record:

```json
{
  "requestedScope": "evidence-plus-snippets",
  "effectiveScope": "evidence-plus-snippets",
  "sourceContextAuthorized": true,
  "sourceContextChunkCount": 12,
  "sourceContextSha256": "...",
  "redactionStats": { "redacted": 0, "blocked": 0 }
}
```

## Evaluator Extensions

- Evidence refs are valid if they exist in `rawEvidence` or `sourceContext`.
- Claims influenced by sourceContext must cite sourceContext chunk IDs.
- Report coverage separately:
  - `rawEvidenceCoverageScore`
  - `sourceContextCoverageScore`
  - `lowConfidenceEvidenceUsage`
  - `redactionPenalty`
- Reject high-confidence claims that rely only on low-quality or heavily redacted sourceContext.
- Keep existing forbidden output checks and max instruction budget.

## PRD Scope

### In Scope
1. CLI/config: `--data-scope`, `--allow-snippets`, `--allow-fulltext`, optional explicit downgrade flag.
2. Scope builders:
   - evidence-only builder: current behavior.
   - snippets builder: evidence-linked surrounding excerpts / field headers / slide text blocks / PDF page snippets.
   - fulltext builder: sanitized, chunked, capped text extraction from already available phase outputs or safe local sample readers.
3. Prompt assembly: include `sourceContext` only after auth and redaction.
4. Evaluator/schema/report changes for sourceContext IDs, coverage, scope metadata, and redaction stats.
5. Comparative report across 3 scopes × 4 cases.
6. README/test documentation with safe commands and authorization gates.

### Out of Scope
- Product integration, UI, feature flags, user preferences, persistent product settings, runtime provider adapters, or new dependencies unless already available.

## Test Spec

### Unit/Mock Coverage
- CLI defaults to `evidence-only`; unknown scope rejected.
- Unauthorized snippets/fulltext fail closed before LLM call.
- `--allow-snippets` does not authorize fulltext.
- Optional downgrade path, if implemented, records requested/effective scope and does not send sourceContext.
- Output path includes requested/effective scope and no clobbering occurs.
- SourceContext chunks have stable IDs, hashes, caps, redaction stats, and linked evidence refs.
- Leak scanner detects and fails on absolute Windows paths, API-key-like strings, and uncapped raw text.
- Existing mock rejection modes still preserve deterministic fallback hashes.
- Default evidence-only compatibility test compares key outputs against current baseline or explicitly records any intentional path/report-only delta.

### Harness Runs
- Baseline disabled evidence-only.
- Mock pass for all 4 cases × 3 scopes, with authorized rich scopes.
- Negative gates:
  - snippets requested without `--allow-snippets`
  - fulltext requested without `--allow-fulltext`
  - fulltext requested with only `--allow-snippets`
  - sanitizer hit
  - oversized context
  - invalid `dataScope`
- Real LLM matrix via `codex-cli` for all 4 cases × 3 scopes, only after mock/leak checks pass.

### Acceptance Criteria
- Omitted `--data-scope` behaves as current `evidence-only` baseline.
- evidence-only real-LLM remains 4/4 refined or regression is explicitly blocked and investigated.
- Rich scopes cannot construct prompts or call LLM without matching explicit authorization.
- Every sourceContext chunk is capped, hashed, redacted/scanned, and evidence-addressable.
- No generated artifact contains absolute paths, secrets, or raw uncapped fulltext.
- Comparative report shows per-case and aggregate quality delta versus evidence-only, fallback counts/reasons, prompt/context size, provider/model, and coverage breakdown.
- Fallback outputs preserve deterministic instruction/hash behavior when context is unauthorized, invalid, rejected, or unavailable.

## Concrete Deliverables
1. Experiment-only dataScope CLI and isolated scope builders.
2. `sourceContext` schema/spec and generated `source-context.json` artifacts.
3. Redaction/leak scanner for all generated artifacts.
4. Evaluator/report extensions for sourceContext coverage and scope metadata.
5. Matrix report: `reports/datascope-comparison.md` and JSON summary.
6. README/test documentation.

## Risks and Mitigations
- Rich context may encourage unsupported facts → require evidence/source chunk refs and reject overconfidence.
- Fulltext leakage → explicit auth, caps, redaction, hash-only raw provider persistence where needed.
- Output clobbering → scope-aware output paths.
- Real LLM nondeterminism → compare aggregate trends, keep raw quality deltas as advisory, and require safety gates as hard criteria.

## Handoff Guidance
- Preferred execution: single `executor` for experiment implementation, then `security-auditor` or `verifier` for leakage/safety review.
- If parallelized: executor A owns CLI/input/sourceContext; executor B owns evaluator/report/tests. Coordinate shared files (`run-refinement.mjs`, `llm-refiner.mjs`, `evaluator.mjs`) carefully.
- Suggested reasoning: executor medium, verifier/security high.
- Follow-up mode: `$autoresearch-goal` if repeating empirical comparison; `$ultragoal` if tracking implementation tasks.

## Stop Rule
Stop after the experiment produces a concise comparison table for all three scopes across four formats, with authorization gates, leak scan, evaluator checks, and fallback hash parity verified, and no product code touched.

## Architect REVISE Resolution（2026-05-13）

Addressed required revisions:

- Replaced ambiguous `--allow-source-context` with separate `--allow-snippets` and `--allow-fulltext` gates.
- Defined unauthorized rich scope as fail-closed before prompt/LLM by default; downgrade must be explicit.
- Added scope-aware output path: `outputs/<mode>/<requestedScope>/<effectiveScope>/<caseId>`.
- Added all-artifact redaction/leak-scan contract, including raw provider outputs.
- Defined `sourceContext` as capped, hashed, evidence-addressable chunks.
- Extended evaluator/report requirements for scope metadata, source context coverage, redaction stats, and coverage separation.
- Added default evidence-only compatibility regression test.

## Critic ITERATE Resolution（2026-05-13）

Addressed required changes from Critic:

### Numeric caps v0

These are experiment defaults and must be CLI-overridable only by explicit future change, not hidden env vars:

| Scope | Max chunks | Per chunk chars | Total chars | Token estimate cap | Sampling rule |
| --- | ---: | ---: | ---: | ---: | --- |
| `evidence-only` | 0 source chunks | 0 | 0 | 0 | no sourceContext |
| `evidence-plus-snippets` | 24 | 500 | 8,000 | 2,500 | deterministic evidence-neighborhood sampling |
| `evidence-plus-fulltext` | 80 | 1,000 | 40,000 | 12,000 | deterministic ordered chunking with head + structure anchors + tail |

Token estimate: `ceil(chars / 4)` for English/mixed text, `ceil(chars / 2)` for mostly CJK; use the larger estimate if unsure.

Deterministic truncation/sampling:

- DOCX snippets: for top structure evidence, include heading candidate plus ±1 paragraph when available; prefer chapter/article regex hits, short headings, style/outline evidence, then diagnostics.
- XLSX snippets: include sheet name, used range, header row/first non-empty rows, field names, formula/metric-looking cells; never include all rows by default.
- PPTX snippets: include slide title/text blocks for sampled slides: first 3, structure-varied slides, image-heavy slide markers, last 2.
- PDF snippets: include page-level extracted text windows where available, plus page count/text-layer/scan facts; if scan likely or text layer weak, snippets should be sparse and diagnostic-heavy.
- Fulltext: preserve document order where possible; if over cap, include head 30%, structure-anchor chunks 50%, tail 20%, with stable ordering and `truncated=true`.

### Leak scanner classes v0

Leak scanner must fail generated artifacts on these classes unless the occurrence is inside a clearly redacted marker such as `[REDACTED_PATH]` or `[REDACTED_SECRET]`:

1. Absolute Windows paths: `[A-Za-z]:\\`, `\\\\server\\share`, `file:///`.
2. Absolute POSIX paths likely from local machine: `/Users/`, `/home/`, `/mnt/`, `/tmp/`, `/var/folders/`.
3. Repo/sample relative filesystem details: `runtime/format-profile/samples/`, `runtime\\format-profile\\samples`, `.llm-wiki/`, `.omx/`, `profilePath`, `instructionPath`, `diagnosticsPath`, `runtimeDir`, `source.path`.
4. Secret-like strings: `sk-[A-Za-z0-9_-]{16,}`, `Bearer [A-Za-z0-9._-]{16,}`, `api[_-]?key`, `token`, `secret` when paired with long values.
5. Raw uncapped content markers: source chunks exceeding caps, provider raw output exceeding configured excerpt cap, or full document text persisted outside `source-context.json` chunks.

Artifact policy refinement:

- Internal execution may read original paths from runtime files, but persisted experiment artifacts must use redacted paths or omit path fields.
- `deterministic-profile.json` may be skipped or redacted in dataScope experiment outputs because it currently contains `source.path`.
- For raw provider output in snippets/fulltext, persist `llm-provider-output.sha256` and a redacted excerpt capped at 1,000 chars; do not persist unredacted provider output.

### Default compatibility definition

Compatibility has two layers:

1. Invocation compatibility: omitting `--data-scope` must behave as `--data-scope evidence-only` for prompt payload, evaluator semantics, fallback, and final harness output fields, except for explicit new scope metadata fields.
2. Artifact layout compatibility: once dataScope experiment is active, output path intentionally moves to `outputs/<mode>/<requestedScope>/<effectiveScope>/<caseId>`. The old `outputs/<mode>/<caseId>` path is not required for new runs, but an evidence-only regression test must compare semantic output content after excluding:
   - `reports` paths,
   - timestamps,
   - output directory paths,
   - new `requestedScope` / `effectiveScope` / sourceContext count metadata,
   - provider raw diagnostic file names.

Required evidence-only regression assertion:

- `finalStatus`, `attemptStatus`, `evaluatorVerdict`, `fallbackReason`, deterministic hashes, acceptedOverlay schema validity, renderedGenerationInstruction hash, and evaluator verdict/quality must match current baseline for equivalent mode/case or explain a deliberate plan update.

### Concrete final verification gate

Recommended command sequence for implementation phase:

```powershell
# 1. Syntax
Get-ChildItem experiments\format-profile-semantic-refinement\scripts -Recurse -Filter *.mjs | ForEach-Object { node --check $_.FullName }

# 2. Default/evidence-only regression
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode disabled
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-only
node experiments/format-profile-semantic-refinement/scripts/verify-datascope-regression.mjs --baseline outputs/mock-pass --candidate outputs/mock-pass/evidence-only/evidence-only

# 3. Authorization negative gates
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-snippets --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-fulltext --case docx-policy
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-fulltext --allow-snippets --case docx-policy
# all three must fail closed before prompt/LLM or record explicit unauthorized result without sourceContext

# 4. Authorized mock matrix
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-snippets --allow-snippets
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode mock-pass --data-scope evidence-plus-fulltext --allow-fulltext

# 5. Leak scan over all generated artifacts
node experiments/format-profile-semantic-refinement/scripts/scan-artifacts.mjs --root experiments/format-profile-semantic-refinement/outputs

# 6. Real LLM matrix only after 1-5 pass
$env:FORMAT_PROFILE_LLM_PROVIDER='codex-cli'
$env:FORMAT_PROFILE_CODEX_MODEL='gpt-5.3-codex-spark'
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --data-scope evidence-only --allow-external-llm
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --data-scope evidence-plus-snippets --allow-external-llm --allow-snippets
node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs --mode real-llm --data-scope evidence-plus-fulltext --allow-external-llm --allow-fulltext

# 7. Comparison report and final scan
node experiments/format-profile-semantic-refinement/scripts/report-datascope-comparison.mjs
node experiments/format-profile-semantic-refinement/scripts/scan-artifacts.mjs --root experiments/format-profile-semantic-refinement/reports
```

Final gate passes only if:

- default evidence-only compatibility assertions pass,
- unauthorized rich scopes do not construct sourceContext or call LLM,
- authorized rich scopes respect caps and sourceContext IDs,
- leak scanner passes over outputs and reports,
- fallback hash parity still passes for failure modes,
- real-LLM matrix produces comparison rows for 3 scopes × 4 cases, regardless of whether richer scopes improve quality.

## DataScope Experiment Execution Record（2026-05-13）

已按 approved plan 完成实现与验证，仍仅限 `experiments/format-profile-semantic-refinement`。

实现内容：

- 新增 `--data-scope evidence-only|evidence-plus-snippets|evidence-plus-fulltext`。
- 新增 `--allow-snippets`、`--allow-fulltext` 授权 gate；未授权 rich scope fail closed，不构造 prompt，不调用 LLM。
- 输出路径改为 `outputs/<mode>/<requestedScope>/<effectiveScope>/<caseId>`。
- 新增 `sourceContext` chunks：`source.snippet.*` / `source.fulltext.chunk.*`，带 hash、caps、linkedEvidenceRefs、redactionStats。
- 新增 artifact sanitizer / leak scanner：`scripts/scan-artifacts.mjs`。
- 新增 evidence-only regression：`scripts/verify-datascope-regression.mjs`。
- 新增对照报告：`scripts/report-datascope-comparison.mjs`，输出 `reports/datascope-comparison.md/json`。

验证结果：

```text
node --check all .mjs: pass
evidence-only regression vs pre-datascope mock-pass baseline: pass
unauthorized snippets/fulltext gates: pass
mock-pass 3 scopes × 4 cases: pass
failure modes evidence-only: pass
leak scan outputs: pass
leak scan reports: pass
real-LLM matrix via codex-cli:gpt-5.3-codex-spark: 12/12 refined/pass
```

对照结论：

- 当前四个 golden cases 上，snippets/fulltext 没有带来可量化 qualityScore 提升。
- DOCX/XLSX rich scopes 提高了 sourceContextCoverage，但总体质量分保持不变。
- 说明授权、chunk、redaction、evaluator 扩展是可行的；但产品默认仍应保持 evidence-only，snippets/fulltext 不应直接默认产品化。
