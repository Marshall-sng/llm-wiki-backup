# RALPLAN Slice E3c — DOCX paragraph direct formatting fidelity

Status: revised-after-critic-iterate  
Context snapshot: `.omx/context/docx-e3c-paragraph-direct-formatting-20260516T061713Z.md`

## 1. Target result

Implement a narrow DOCX-first fidelity slice that makes generated DOCX body paragraphs consume paragraph-level direct formatting evidence from the source profile, with first acceptance focused on line spacing:

```text
Generated body paragraph spacing should move from mostly 600 twips to the source-dominant 570 twips when the selected DOCX format profile contains paragraph direct formatting evidence.
```

The slice must preserve E3b wins: page size/margins/header/footer, title style, body font direction, and conservative numbering behavior.

## 2. RALPLAN-DR summary

### Principles
1. Measure paragraph direct formatting as evidence, not as raw source text.
2. Apply only role-safe, high-confidence paragraph facts in the writer.
3. Preserve existing E3b improvements and avoid broad visual rewrites.
4. Keep diagnostics explicit: expected vs observed must be visible through bucketInputs.
5. Stay DOCX-first and do not restore template replay/manual-template routes.

### Decision drivers
1. The strongest observed mismatch is body paragraph line spacing: generated 600 vs baseline 570.
2. Baseline spacing is paragraph-level direct formatting, so style-definition-only extraction has reached diminishing returns.
3. Changes must be small enough to attribute and rollback if title/numbering/page setup regresses.

### Viable options

#### Option A — Dominant document-level paragraph direct spacing -> body style
- Extract dominant direct paragraph spacing from `word/document.xml`, excluding title-like/heading-like paragraphs when possible.
- Emit a `paragraph.body.lineSpacingTwips` executable attribute.
- Writer applies it through Normal/body paragraph style.
- Pros: smallest implementation, directly targets 600 -> 570, easy to test.
- Cons: may overgeneralize if a source file has several body-like paragraph styles.

#### Option B — Role-bucketed paragraph direct formatting -> role attributes
- Extract paragraph direct formatting grouped into buckets: title-like, heading1-like, heading2-like, body-like, list-like.
- Emit role-specific attributes for `title.main`, `heading.level1`, `heading.level2`, `paragraph.body`.
- Pros: better long-term fidelity and avoids overapplying body facts to headings.
- Cons: higher classification risk; more tests required; could destabilize existing title/heading mapping.

#### Option C — Per-block direct formatting replay in generated DOCX
- Store paragraph formatting patterns and apply them directly to generated blocks.
- Pros: potentially most faithful for similar document structures.
- Cons: drifts toward template replay, harder to audit, more likely to mismatch different content, too large for E3c.

### Chosen approach
Option A with a narrow safety extension from Option B: extract a **guarded body-dominant paragraph direct formatting fact** using conservative exclusions for document title and headings. Do not implement full role-bucket replay in E3c.

#### E3c guardrails added after Architect review

1. **Line rule executable contract**: carry paragraph direct `lineRule` counts as evidence and emit a writer-facing `lineSpacingRule` / `lineRuleNormalized` attribute only when the dominant direct rule normalizes to exact-line semantics. Source `exact` and adapter `exactly` are treated as equivalent exact-line values. `paragraph.body.lineSpacingTwips` must be emitted from paragraph-direct evidence only when the dominant lineRule is `exact`/`exactly`; if the dominant rule is `auto`, mixed, missing, or unknown, E3c must fall back to E3b behavior and must not cause the adapter to write `EXACTLY` merely because a twip number exists.
2. **Dominance threshold:** a body direct spacing candidate is eligible only when all are true:
   - candidate count >= 5 paragraphs;
   - candidate ratio >= 0.60 among body-candidate paragraphs with direct spacing;
   - candidate line twips is in sane formal-document range 360..900;
   - title-like/heading-like exclusions are not the source of the majority count;
   - ambiguous or missing data falls back to E3b behavior without blocking import/export.
3. **Diagnostics requirement**: exported diagnostics must compare expected body direct spacing against observed exported paragraph/body spacing distribution, not only `Normal` style spacing. `bucketInputs` must include the evidence source (`paragraph-direct` vs `style-definition`) in the reason.
4. **Probe verification hard gate**: E3c is not complete unless a Rust unit/integration test or equivalent probe-level fixture proves `format_probe.rs` emits paragraph-direct body spacing counts: dominant line 570, dominant rule exact, count/ratio threshold pass, and title/heading-like exclusions. `cargo check` alone is insufficient.\n5. **Regression requirement**: tests must include the real failure mode: style definition says 600, paragraph-direct body candidates say 570/exact, and the generated DOCX emits body spacing 570 through paragraph-direct evidence while title/page/numbering E3b checks still pass.\n6. **Non-line-spacing fact boundary**: `firstLineTwips`, `firstLineChars`, and direct font/size paragraph summaries may be extracted as diagnostics, but E3c must not make them executable writer attributes unless a separate plan/test justifies it. The only executable paragraph-direct change in E3c is body line spacing.

Invalidated alternatives:
- Option B full role-bucket implementation is deferred because E3c should solve one measured gap and preserve attribution.
- Option C is rejected for this stage because it resembles template replay and is not stable across different generated content.

## 3. Scope

### In scope
1. Extend DOCX deterministic probe to summarize paragraph direct formatting from `word/document.xml`:
   - direct `w:spacing` line / lineRule counts, preserving source values such as `exact`;\n- normalized lineRule classification: `exact` and `exactly` => `exact`; `auto` => `auto`; mixed/unknown => no executable spacing;
   - direct `w:ind` firstLine / firstLineChars counts;
   - optional direct paragraph font/size summary if already easy from runs, but not required for acceptance;
   - exclude or separately count title-like and heading-like paragraphs where detectable by large size, center alignment, title fonts, or section numbering.
2. Extend StyleFacts with a sanitized paragraph direct formatting summary.
3. Convert dominant body paragraph direct line spacing into FormatSpec executable attribute for `paragraph.body`.
4. Resolve and write body paragraph line spacing from `lineSpacingTwips`, preserving existing title `579`, page setup, and font behavior.
5. Extend fidelity diagnostics to report paragraph direct formatting expected/observed bucketInputs.
6. Add tests proving generated DOCX body paragraph spacing uses 570 when source paragraph direct formatting says 570.

### Out of scope
- Full role-bucket style inference for all title/heading/subtitle types.
- Template replay or copying source paragraph XML.
- Automatic Word/WPS visual parity scoring.
- UI redesign or user-facing diagnostics copy changes unless needed to keep tests compiling.
- XLSX/PPTX/PDF work.

## 4. Implementation design

### Step 1 — Probe paragraph direct formatting
File: `src-tauri/src/commands/format_probe.rs`

Add a DOCX paragraph direct formatting summary under StyleFacts-compatible probe output, for example:

```json
style.paragraphDirectFormatting = {
  "bodyCandidates": {
    "spacingLineTwips": [{"value":"570","count":85}],
    "lineRule": [{"value":"exact","count":85}],
    "firstLineTwips": [{"value":"640","count":...}],
    "firstLineChars": [{"value":"200","count":...}]
  },
  "allParagraphs": {...},
  "excludedCounts": {"titleLike":..., "headingLike":...}
}
```

Rules:
- Store counts and scalar values only; no raw paragraph text.
- Prefer direct paragraph `w:pPr/w:spacing` over inherited styles for this fact.
- Do not fail import if the fact cannot be derived; emit diagnostics or empty arrays.

### Step 2 — StyleFacts schema/helper support
Files: `src/lib/style-facts.ts`, `src/test-helpers/docx-stylefacts-profile-fixtures.ts`, related tests.

Represent paragraph direct formatting as deterministic evidence with sanitized evidence IDs. Keep `canGuideExport` wording conservative: covered deterministic fields may guide DOCX writer attributes, but no visual parity claim.

### Step 3 — FormatSpec executable bridge
File: `src/lib/docx-stylefacts-format-attributes.ts`

Selection logic:
- If `paragraphDirectFormatting.bodyCandidates.spacingLineTwips` passes the concrete dominance threshold, prefer it for `paragraph.body.lineSpacingTwips` over default `lineSpacingPt:30` and over weaker style-definition body spacing.\n- Emit `lineSpacingRule` / equivalent attribute only for exact-line equivalents.\n- Emit `paragraph.body.lineSpacingTwips` from paragraph-direct evidence only when the dominant normalized lineRule is exact; do not emit an executable twip spacing from paragraph-direct evidence when rule is auto/mixed/unknown.\n- If threshold or lineRule gate fails, preserve current E3b style-definition/default behavior and emit a non-blocking diagnostic reason.
- If the dominant value is absent, preserve current E3b behavior.
- Avoid applying body direct spacing to `title.main`; title remains driven by title candidate (`579` already matches baseline).

### Step 4 — Writer/resolver behavior
Files: `src/lib/docx-format-style.ts`, `src/lib/docx-ts-adapter.ts`

Likely minimal change:
- `resolveDocxStylePolicy` already consumes `lineSpacingTwips`.
- Ensure the body `lineSpacingTwips` selected from direct formatting reaches `Normal` style and paragraph rendering.
- Do not change numbering intent behavior.

### Step 5 — Diagnostics
File: `src/lib/docx-fidelity-diagnostics.ts`

Extend bucketInputs/reasons to show:
- expected paragraph body line spacing from direct formatting evidence;
- observed exported Normal/body style or paragraph direct spacing;
- matched/mismatched reason.

Do not store raw XML or full paragraph text.

## 5. Test plan

### Unit / targeted tests
1. Rust/probe-level tests if existing harness supports it, or TypeScript fixture-level tests if Rust command is hard to unit-test directly.
2. `docx-stylefacts-format-attributes.test.ts`
   - fixture with paragraph direct spacing 570/exact and style definition spacing 600 must emit `paragraph.body.lineSpacingTwips=570`, `lineSpacingRule=exact`, and record that the selected source is paragraph-direct.\n   - fixture with 570/auto, mixed lineRule, or below dominance threshold must keep E3b fallback behavior and emit a clear reason.
   - title spacing 579 remains `title.main`, not body.
3. `docx-format-style.test.ts`
   - resolver turns `lineSpacingTwips=570` into `paragraph.body.lineSpacingTwips=570`.
4. `docx-ts-adapter.test.ts`
   - generated `styles.xml` / `document.xml` has body paragraph `w:line="570"` and title `w:line="579"`.
   - page margins/header/footer remain the E3b matched values.
   - visible numbering preservation still passes.
5. `docx-fidelity-diagnostics.test.ts`
   - bucketInputs report expected `paragraph.body=570`, observed dominant exported paragraph/body spacing `570`, matched true, source kind paragraph-direct, and exact/exactly lineRule equivalence.

### Regression gates
- `npx vitest run src/lib/docx-stylefacts-format-attributes.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-fidelity-diagnostics.test.ts src/lib/style-facts.test.ts`
- `npm run typecheck`
- `npm run test:mocks`
- `cargo check` in `src-tauri`
- `npm run build`

### Manual acceptance
After implementation, regenerate DOCX using `基准素材_复制` profile and compare OpenXML:
- page setup remains matched;
- title remains close (`579`, 方正小标宋简体, 22pt);
- majority body paragraphs move from 600 to 570;
- no `missing-paragraph-content`;
- no `&emsp;&emsp;`, `**`, or `[[ ]]` leakage;
- no inappropriate auto-numbering introduced.

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Body spacing applied to titles/headings | Conservative body candidate exclusions; tests assert title remains 579. |
| Paragraph direct facts polluted by generated content snippets | Store only counts/values/evidence IDs; leakage tests. |
| Source files with multiple body spacing patterns | Use count >= 5, ratio >= 0.60, sane range 360..900, and diagnostics; fall back to E3b behavior when ambiguous. |
| Overfitting to one baseline | Keep fact generic: paragraph direct formatting counts, not document name-specific logic. |
| Regress numbering | Keep `autoNumberingIntent` untouched; run existing numbering tests. |

## 7. Acceptance criteria

E3c is complete only when:
1. Generated DOCX can consume paragraph direct body line spacing from the selected profile.
2. A fixture with body direct spacing 570 and style-definition spacing 600 produces exported body spacing 570 through paragraph-direct evidence.
3. Title spacing and page setup E3b assertions still pass.
4. Full mock test suite and build pass.
5. Architect review approves implementation after tests.
6. Tracking docs are updated with outcome and remaining manual comparison gap.

## 8. Available agent-types roster and execution guidance

- `ralph`: recommended execution path for this single-owner sequential slice.
- `team`: not recommended unless implementation reveals independent Rust-probe and TS-writer lanes that can be safely split.
- `architect`: final review / design soundness.
- `critic`: plan quality and scope-control review.
- `executor`: implementation if delegated.
- `test-engineer`: optional for fixture and regression tests.

Suggested Ralph lane:
1. Implement probe fixture/schema support.
2. Implement FormatSpec bridge selection.
3. Verify writer output and diagnostics.
4. Run full gates.
5. Architect review.

Suggested reasoning levels:
- Implementation: medium/high.
- Verification/architect review: high.

## 9. ADR

Decision: implement paragraph direct formatting extraction and body-dominant line spacing application as Slice E3c.

Drivers: measured 600-vs-570 line spacing gap; direct paragraph formatting evidence exists in `document.xml`; style-definition-only extraction has diminishing returns.

Alternatives considered: full role-bucket formatting, per-block template replay, writer-only hardcoded 570.

Why chosen: narrowest change that addresses the observed mismatch while preserving E3b improvements and avoiding template replay.

Consequences: improves body spacing fidelity; later slices may still need heading/subtitle role-bucket refinement.

Follow-ups: manual desktop comparison, then decide whether E3d should address heading role formatting or visual diagnostics UI.

## 10. Goal-mode follow-up suggestions

- `$ralph` recommended for implementation because scope is bounded and verification-heavy.
- `$team` only if splitting Rust probe and TS writer becomes necessary.
- `$ultragoal` is not necessary unless the user wants durable multi-session goal tracking.

## 11. Review log

### Architect round 1 — ITERATE
Required changes:
- Decide/carry lineRule explicitly.
- Define concrete body dominance/fallback thresholds.
- Compare paragraph-direct exported distribution in diagnostics, not only Normal style.
- Add real-failure-mode tests where style definition remains 600 but paragraph-direct evidence is 570.

Planner revision applied:
- Added exact/exactly equivalence policy.
- Added dominance threshold: count >= 5, ratio >= 0.60, sane twip range 360..900, conservative title/heading exclusions, fallback diagnostics.
- Required paragraph-direct bucketInputs and source-kind reasons.
- Required tests for paragraph-direct priority over style-definition spacing and fallback below threshold.

### Critic round 1 — ITERATE
Required changes:
- Make probe extraction verification mandatory; `cargo check` is not enough.
- Tighten lineRule executable contract so lineSpacingTwips is emitted from paragraph-direct evidence only for exact-line semantics.
- Require bucketInputs to include source kind, observed dominant distribution, count/ratio, raw/normalized rule, and matched status.
- Keep non-line-spacing paragraph facts diagnostic-only in E3c.

Planner revision applied:
- Added mandatory probe-level extraction test gate.
- Added lineRule executable contract: exact/exactly only; auto/mixed/unknown fallback.
- Tightened diagnostics acceptance fields.
- Restricted executable E3c change to body line spacing only.
