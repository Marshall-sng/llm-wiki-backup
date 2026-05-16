# Slice E3a — Executable StyleFacts-to-FormatSpec attributes for title / heading1 / body

## Scope

Implement a narrow DOCX-first path that converts deterministic DOCX `StyleFacts` into executable `FormatSpecRule.attributes` for three writer-consumed dimensions:

- `title.main`
- `heading.level1`
- `paragraph.body`

This slice must make profile-specific style differences observable in generated DOCX XML through the existing `FormatSpec -> resolveDocxStylePolicy -> docx-ts-adapter` path.

Out of scope:

- Manual template route.
- XLSX/PPTX/PDF behavior.
- Word/WPS visual parity claims.
- Auto-overwrite of user files.
- Full high-fidelity visual replication.
- Broad extraction for every heading level, page margin, numbering, tables, headers/footers, seals, watermarks, or screenshots.

## Evidence from repository inspection

- `src/lib/format-spec.ts` currently builds DOCX rules, merges accepted semantic overlay rules, then calls `ensureDocxFormatSpecBaseline(...)`.
- `src/lib/docx-formatspec-baseline.ts` supplies baseline rules and attributes when a dimension is missing sufficient executable attributes.
- `src/lib/docx-format-style.ts` resolves only structured attributes such as `fontFamily`, `fontSizePt`, `bold`, `alignment`, `firstLineIndentChars`, and `lineSpacingPt` for canonical dimensions.
- `src/lib/docx-ts-adapter.ts` consumes `intermediate.stylePolicy` to write DOCX style XML.
- `src/lib/style-facts.ts` already stores deterministic DOCX facts for fonts, font size usage, style definitions, and paragraph style usage.
- `src/lib/docx-ts-adapter.test.ts` already verifies that changed `FormatSpec` attributes produce different `word/styles.xml`.

## RALPLAN-DR summary

### Principles

1. **Executable before descriptive**: only structured attributes can affect writer output; prose remains explanatory.
2. **Deterministic evidence first**: derive E3a attributes from parser-produced `StyleFacts`, not LLM prose guesses.
3. **Narrow override surface**: only specialize `title.main`, `heading.level1`, and `paragraph.body`; let the existing baseline fill the rest.
4. **Honest fidelity boundary**: prove DOCX XML divergence, not Word/WPS visual parity.
5. **No source-content leakage**: attributes may carry style values and evidence refs, not source body text.

### Top 3 drivers

1. Two visibly different profiles can currently export nearly identical DOCX because profile differences are not converted into writer-consumed attributes.
2. Existing writer path already supports executable attributes, so the smallest useful fix is upstream synthesis into `FormatSpec`.
3. Tests need to prove profile-specific output divergence without manual desktop applications.

### Options considered

#### Option A — Deterministic StyleFacts extractor in `format-spec.ts` before baseline fill

Add a small DOCX-only helper that reads `profile.styleFacts.styleFacts` and emits/merges canonical rules with executable attributes for `title.main`, `heading.level1`, and `paragraph.body`; then let `ensureDocxFormatSpecBaseline` fill missing dimensions.

Pros:
- Smallest end-to-end change.
- Uses existing `FormatSpec`/baseline/style-policy contracts.
- Keeps baseline fallback intact.
- Easy to unit test at `buildFormatSpec` and adapter XML levels.

Cons:
- Heuristics for mapping source style definitions to semantic dimensions are imperfect.
- Adds more logic to `format-spec.ts` unless factored into a helper.

#### Option B — Extend LLM semantic overlay to synthesize attributes

Prompt/validate the overlay stage to produce `fontFamily`, `fontSizePt`, spacing, and alignment attributes for the same dimensions.

Pros:
- Could interpret richer prose/style summaries.
- Potentially better for ambiguous style names if the LLM reads context.

Cons:
- Non-deterministic.
- Accepted overlays currently often lack attributes, which is the root issue.
- Harder to regression-test and risks overclaiming inferred facts.

#### Option C — Modify DOCX writer to consume `StyleFacts` directly

Pass profile `StyleFacts` through intermediate state and let `docx-format-style`/adapter select styles directly.

Pros:
- Avoids expanding `FormatSpec` synthesis.
- Can be tightly coupled to writer output needs.

Cons:
- Bypasses `FormatSpec` as the product-visible constraint contract.
- Creates two sources of style truth.
- Harder to audit and explain in UI.

### Chosen option

Choose **Option A**.

Add a deterministic DOCX StyleFacts-to-FormatSpec synthesis layer that runs before baseline fill. It should emit only high-confidence, evidence-referenced, canonical executable attributes for the three E3a dimensions. Existing baseline rules remain the fallback and compatibility guard.

## Implementation plan

1. **Add a narrow synthesis helper**
   - Preferred file: new `src/lib/docx-stylefacts-to-formatspec.ts`.
   - Export a function like `buildDocxExecutableStyleRules(profile: FormatProfileRecord): FormatSpecRule[]`.
   - Return `[]` unless `profile.fileType === "docx"` and `profile.styleFacts` has usable DOCX facts.
   - Do not parse prompt text, accepted overlay prose, or source body text.

2. **Define the E3a attribute contract**
   - For each emitted rule, set a canonical `dimension`:
     - `title.main`
     - `heading.level1`
     - `paragraph.body`
   - Emit only attributes already consumed by `docx-format-style.ts`:
     - `fontFamily`
     - `fontSizePt`
     - `bold`
     - `alignment`
     - `firstLineIndentChars`
     - `lineSpacingPt`
   - Include `confidence` and `evidenceRefs` on attributes where available.
   - Use stable IDs, for example:
     - `docx-stylefacts-title-main`
     - `docx-stylefacts-heading-level1`
     - `docx-stylefacts-paragraph-body`

3. **Implement conservative mapping heuristics**
   - Prefer explicit DOCX style definitions from `styleFacts.styleFacts.styles.definitions.value`.
   - Candidate matching:
     - title: style ID/name containing `Title`, `标题`, `主标题`, or a largest-font centered style if explicit title is absent.
     - heading1: style ID/name containing `Heading1`, `Heading 1`, `标题 1`, `一级`, or outline level 0/1 when present.
     - body: style ID/name containing `Normal`, `正文`, `Body`, or the highest-count paragraph style usage fallback.
   - If no dimension-specific style definition is usable:
     - body may fall back to dominant font and dominant font-size usage.
     - title/heading1 should not invent from global usage alone unless the rule remains partial and below baseline coverage threshold.
   - Preserve localized font names as source values; rely on existing `normalizeFontFamily` only at writer-resolution time.
   - Convert half-points to points only through existing `fontSizeUsagePt` facts or deterministic conversion.

4. **Merge synthesized rules before baseline fill**
   - In `src/lib/format-spec.ts`, include E3a synthesized rules in the input to `ensureDocxFormatSpecBaseline(...)`.
   - Ordering should allow source-derived executable rules to satisfy coverage before baseline fallback for the same dimension.
   - Do not drop accepted overlay rules; source-derived rules should coexist with overlay rules.
   - If both overlay and StyleFacts provide executable attributes for the same dimension, prefer deterministic StyleFacts for the E3a dimensions unless a user-edited `editableFormatSpec` override is active.

5. **Expose audit-visible provenance**
   - Ensure generated `FormatSpec.promptBlock` shows the new attributes and evidence refs but not raw `styleFacts` dumps.
   - Add a concise summary line only if needed, e.g. "DOCX StyleFacts supplied executable attributes for 3 dimensions."
   - Keep existing boundaries about no visual parity and no source copying.

6. **Add focused regression tests**
   - `src/lib/docx-stylefacts-to-formatspec.test.ts`:
     - fixture with distinct title/heading/body style definitions yields three canonical rules and writer-consumed attributes.
     - missing/ambiguous definitions degrade safely to baseline-compatible partial or empty rules.
     - evidence refs are retained; raw source text is absent.
   - `src/lib/format-spec.test.ts`:
     - `buildFormatSpec()` includes StyleFacts-derived attributes before baseline for `title.main`, `heading.level1`, `paragraph.body`.
     - baseline still fills non-E3a dimensions and audit remains `pass`.
   - `src/lib/docx-format-style.test.ts`:
     - resolver uses the StyleFacts-derived canonical rules for the three dimensions.
   - `src/lib/docx-ts-adapter.test.ts` or a new targeted integration test:
     - two profile snapshots with different E3a attributes produce different `word/styles.xml` values for Title, Heading1, and Normal/body.

7. **Verification**
   - Run targeted tests:
     - `npm run test -- src/lib/docx-stylefacts-to-formatspec.test.ts src/lib/format-spec.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts`
   - Run broader validation if targeted tests pass:
     - `npm run test`
     - `npm run build`
   - Inspect failure output for content leakage, baseline audit regressions, and changed DOCX warnings.

## Acceptance criteria

- For a DOCX profile with usable style definitions, `buildFormatSpec()` emits executable attributes for `title.main`, `heading.level1`, and `paragraph.body`.
- The emitted attributes are consumed by `resolveDocxStylePolicy()` without parsing prose.
- Two DOCX profile snapshots with different E3a font/size/bold/alignment attributes produce observably different `word/styles.xml`.
- Existing baseline audit remains `pass`; dimensions outside E3a continue to be baseline-filled.
- No raw `StyleFacts` dump or source body text appears in `FormatSpec.promptBlock`.
- Product warnings remain honest: no manual Word/WPS parity claim and no high-fidelity visual replication claim.
- No manual template route or auto-overwrite behavior is introduced.

## Risks and mitigations

- **Risk: style-definition schema variance.**
  - Mitigation: use defensive record access and test missing/malformed definitions.
- **Risk: incorrect title/heading/body mapping.**
  - Mitigation: conservative matching, prefer explicit style names/IDs, fall back to baseline rather than over-infer.
- **Risk: baseline rules still win accidentally.**
  - Mitigation: test rule ordering and `ensureDocxFormatSpecBaseline` coverage behavior for the three dimensions.
- **Risk: font normalization erases source distinction.**
  - Mitigation: preserve source font names in FormatSpec attributes; only normalize known names at writer style resolution.
- **Risk: tests assert unstable full XML.**
  - Mitigation: assert targeted XML snippets/half-point values/font names and inequality, not full document snapshots.

## File touchpoints

Likely implementation:

- `src/lib/docx-stylefacts-to-formatspec.ts` — new deterministic E3a synthesis helper.
- `src/lib/format-spec.ts` — merge helper output before DOCX baseline fill.
- `src/lib/format-profile-types.ts` — no change expected unless test typing reveals a needed narrow helper type.

Likely tests:

- `src/lib/docx-stylefacts-to-formatspec.test.ts` — new unit tests.
- `src/lib/format-spec.test.ts` — integration coverage for baseline merge.
- `src/lib/docx-format-style.test.ts` — resolver coverage.
- `src/lib/docx-ts-adapter.test.ts` — exported XML divergence coverage.
- `src/test-helpers/docx-export-fixtures.ts` — optional helper fixtures only.

Avoid touching:

- Manual export/save overwrite flow unless a regression test needs to assert no behavior changed.
- Non-DOCX format profile behavior.
- UI copy except for a future slice.

## Stop condition

Stop Slice E3a when tests prove that DOCX `StyleFacts` can generate executable `FormatSpec` attributes for title, heading1, and body, and those attributes create observable DOCX XML style differences while baseline fallback, content-leakage boundaries, and no-parity/no-template constraints remain intact.

## Executor handoff

Recommended lane: single `executor` with optional `verifier` after implementation.

Reasoning level:

- Executor: medium.
- Verifier/reviewer: high if XML/style mapping tests fail or the extractor heuristics expand beyond E3a.

Suggested follow-up mode if this grows beyond E3a:

- `$ultragoal` for durable multi-slice DOCX fidelity work.
- `$performance-goal` is not needed unless export speed or package size becomes the bottleneck.
