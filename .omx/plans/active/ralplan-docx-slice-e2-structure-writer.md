# RALPLAN: Slice E2 — DOCX structure role normalization + first writer style mapping

Status: consensus-approved
Date: 2026-05-15
Context snapshot: `.omx/context/docx-slice-e2-structure-writer-20260515T103145Z.md`
Depends on:
- Slice E1 DOCX fidelity diagnostics
- Slice E2-prep DOCX FormatSpec baseline dimensions/attributes

## 1. Target outcome

Make DOCX export start consuming the stable DOCX FormatSpec dimensions/attributes from E2-prep through two bounded improvements:

1. **Structure role normalization**: convert draft/chat-derived plain text into stable DOCX intermediate roles without relying on visual full-width spaces or markdown cosmetics.
2. **First writer style mapping**: apply the highest-value formal DOCX styles for document title, level-1/2 headings, body paragraphs, and ordered lists.

This slice should improve actual exported DOCX fidelity, but still must not claim Word/WPS parity. Fidelity diagnostics must prove coverage moved in the right direction.

## 2. Problem evidence

User-observed chat output after E2-prep:

- Chat content has no markdown markers and no chat preamble, which is good.
- However, headings are still visually indented with full-width spaces, e.g. `  一、发展定位`.
- Lists appear as bare lines without explicit numbering, e.g. tasks or talent items listed line-by-line.
- The model is simulating layout in text instead of expressing structure roles.

Current code evidence:

- `src/lib/docx-intermediate.ts` already maps markdown H1, Chinese `一、`, `（一）`, ordered list, bullet list, and markdown table into intermediate blocks.
- It does not distinguish FormatSpec dimensions on blocks; ruleRefs are target/id heuristic based.
- It does not recover bare formal-list lines after intro paragraphs.
- `src/lib/docx-ts-adapter.ts` hardcodes simple fonts/margins and does not read FormatSpec attributes.
- `src/lib/docx-fidelity-diagnostics.ts` can now read canonical dimensions, but writer does not yet consume those dimensions.

## 3. RALPLAN-DR summary

### Principles

1. **DOCX-first high fidelity**: improve real exported DOCX behavior, not only prompts.
2. **Structure before style**: writer can only apply reliable styles if intermediate blocks carry reliable roles.
3. **Consume FormatSpec, do not hardcode a new template route**: style values should resolve from FormatSpec dimensions/attributes with safe defaults, not from a user-selected template file.
4. **Measured improvement only**: fidelity diagnostics and tests must show what improved; no Word/WPS parity claim.
5. **Small slice**: title, heading, body, ordered list first; page-margin conflict and UI diagnostics stay follow-up unless unambiguous.

### Decision drivers

1. **Role fidelity**: avoid full-width-space visual formatting and preserve headings/lists as structural blocks.
2. **Writer evidence**: actual DOCX XML should include font, size, spacing, heading/list style evidence that diagnostics can observe.
3. **Regression safety**: existing DOCX export/save behavior must remain stable; no UI/store/Tauri changes unless strictly necessary.

### Viable options

#### Option A — Writer-only style mapping

- Change `docx-ts-adapter.ts` to write better fonts/sizes/spacing using existing block types.
- Pros: quickest visible DOCX style improvement.
- Cons: does not fix bare-list and heading-role ambiguity; writer still guesses from weak intermediate roles.
- Verdict: insufficient as the main plan.

#### Option B — Intermediate-first role normalization + first writer mapping (recommended)

- Add/extend deterministic DOCX intermediate normalization:
  - strip visual indentation for role detection;
  - classify formal headings by pattern;
  - detect constrained bare-list runs after intro paragraphs;
  - attach canonical FormatSpec dimensions/ruleRefs to blocks.
- Add a writer style resolver from FormatSpec dimensions/attributes.
- Apply first style mapping to document title, level-1/2 headings, body paragraphs, and ordered lists.
- Pros: fixes root structure problem and enables measurable writer fidelity.
- Cons: more work than writer-only; bare-list recovery needs conservative rules.
- Verdict: recommended.

#### Option C — Prompt-only output contract

- Tighten `draft-processing` prompt so the LLM outputs better headings/lists.
- Pros: cheap and may improve chat content.
- Cons: not reliable; does not guarantee saved draft/export behavior; model can still emit visual spaces or bare lists.
- Verdict: useful as supporting change only, not primary.

#### Option D — Store-time draft markdown rewrite

- Rewrite assistant messages into markdown/structured draft content when user clicks set-as-draft.
- Pros: saved draft becomes cleaner for all later uses.
- Cons: higher product risk; can surprise users by mutating visible content; touches store/UI behavior.
- Verdict: defer. Not in this slice.

## 4. Recommended design: Option B with narrow prompt support

### 4.1 New/updated structural contract

Extend DOCX intermediate blocks with optional structured metadata:

```ts
interface DocxIntermediateBaseBlock {
  type: DocxIntermediateBlockType
  ruleRefs: string[]
  sourceLineRange: DocxSourceLineRange
  formatDimensions?: string[]
  diagnostics?: string[]
}
```

Rules:

- `documentTitle` should map to `title.main`.
- heading level 1 should map to `heading.level1`.
- heading level 2 should map to `heading.level2`.
- heading level 3 can be recognized if present, but writer mapping may remain minimal unless tests prove safe.
- body paragraph should map to `paragraph.body`.
- ordered list should map to `list.numbering`.
- table should map to `table.readability`.

### 4.2 Structure role normalization

Implement as a deterministic library boundary, preferably in `docx-intermediate.ts` or a new helper `docx-structure-normalizer.ts` consumed by `buildDocxIntermediateDocument()`.

Required behavior:

1. Strip leading full-width/ideographic spaces for role detection and exported text.
   - Example: `  一、发展定位` becomes heading level 1 text `一、发展定位`.
   - Example: `  公司已取得...` becomes body paragraph text `公司已取得...`; indentation is writer style, not literal text.

2. Preserve existing markdown heading/list/table parsing.

3. Add level-3 heading detection:
   - `1.三级标题` or `1. 三级标题` can be heading level 3 when it appears between headings/paragraphs as a title-like line.
   - Consecutive `1. ... 2. ...` remains ordered list.

4. Conservative bare-list recovery:
   - Only after an intro paragraph ending with `：` / `:`.
   - Only for two or more consecutive non-empty short lines before the next heading.
   - Do not classify lines ending with `。` as list items unless they are short key-value items like `省级政务云：...` in a list run.
   - Treat long narrative lines, colon-followed explanatory paragraphs, and sentence-like lines as paragraph blocks unless a tested list-run pattern is present.
   - Add diagnostic `bare-list-recovered` so this remains auditable.
   - Prefer ordered list when FormatSpec has `list.numbering`; otherwise keep paragraphs.

5. Do not rewrite stored draft content in this slice. Normalize only for DOCX intermediate/export.

### 4.3 Rule/dimension resolver

Add a small resolver, either in `docx-intermediate.ts` or new `docx-format-rule-resolver.ts`:

- Given `formatProfileSnapshot.formatSpec.rules`, group by `dimension` and rule id.
- Resolve relevant attributes by dimension.
- Preserve fallback for old snapshots without dimensions.

Required dimensions for this slice:

- `title.main`
- `heading.level1`
- `heading.level2`
- `paragraph.body`
- `list.numbering`
- optionally `table.readability` only for ruleRefs/diagnostics, not table styling.

### 4.4 First writer style mapping

Update `docx-ts-adapter.ts` to consume resolved style policy from intermediate blocks / format snapshot-derived metadata.

Minimum style targets:

1. Document title
   - font family from `title.main.fontFamily`, fallback 方正小标宋简体 or existing safe font if package cannot embed exact font.
   - size from `fontSizePt` => half-points.
   - center alignment.
   - line spacing if docx package API supports it.

2. Heading level 1
   - font from `heading.level1.fontFamily`, fallback 黑体.
   - size 16pt.
   - no literal full-width indentation in text.
   - spacing/indent via paragraph properties, not literal spaces.

3. Heading level 2
   - font from `heading.level2.fontFamily`, fallback 楷体.
   - size 16pt.

4. Body paragraph
   - font from `paragraph.body.fontFamily`, fallback 仿宋.
   - size 16pt.
   - first-line indent via paragraph property.
   - line spacing via paragraph property where supported.

5. Ordered list
   - preserve numbering using `list.numbering`.
   - avoid turning recovered lists into bare paragraphs.

Page margin handling in this slice:

- Do not silently resolve the `detected-layout` vs `instructional-format-text` margin conflict.
- If a current source-specific non-conflicting `page.margin` rule exists, mapping may use it.
- Otherwise leave existing page margin behavior and keep diagnostics/plan note for a later margin-specific slice.

### 4.5 Prompt support, narrow only

Update `buildDraftProcessingSystemPrompt()` only if needed to discourage visual-space simulation:

- Tell the model not to use full-width spaces to simulate indentation.
- Tell it to preserve list structure rather than outputting bare consecutive lines.
- Do not force visible markdown syntax in chat if the product display path does not require it.

This is supporting only; deterministic normalizer/writer remains the core of E2.

## 5. Test plan

### Unit tests

1. `docx-intermediate.test.ts`
   - strips full-width spaces from headings and paragraphs for DOCX export;
   - classifies `  一、发展定位` as heading level 1;
   - classifies `  （二）...` as heading level 2;
   - keeps consecutive `1. ... 2. ...` as ordered list;
   - recovers bare-list runs only after colon intro and emits diagnostic;
   - does not recover arbitrary paragraphs as lists;
   - does not recover long narrative lines, sentence-like lines ending with `。`, or colon-followed explanatory paragraphs as list items;
   - keeps consecutive `1. ... 2. ...` as ordered list rather than misclassifying them as heading level 3.

2. New or extended style resolver tests
   - resolves `title.main`, `heading.level1`, `heading.level2`, `paragraph.body`, `list.numbering` attributes;
   - old snapshots without dimension still fall back safely;
   - missing attributes use safe defaults and record diagnostics where needed.

3. `docx-ts-adapter.test.ts` or existing `docx-writer.test.ts`
   - unzip the generated DOCX and inspect `word/document.xml`, `word/styles.xml`, and `word/numbering.xml` where applicable;
   - generated DOCX XML contains expected font names/sizes for title/body/heading where supported;
   - generated DOCX XML contains paragraph indentation/spacing evidence where supported by the adapter;
   - body paragraphs no longer contain literal full-width indentation;
   - list numbering remains present.

4. `docx-fidelity-diagnostics.test.ts`
   - canonical dimensions such as `title.main`, `heading.level1`, `heading.level2`, `paragraph.body`, and `list.numbering` are evaluated directly rather than only through legacy bucket names;
   - style mapping changes move relevant dimensions from `missing/unverified` toward `partial/restored` where observable;
   - no source expectation still remains `unverified`.

### Regression tests

- `src/lib/docx-intermediate.test.ts`
- `src/lib/docx-writer.test.ts`
- `src/lib/docx-export-save.test.ts`
- `src/lib/docx-fidelity-diagnostics.test.ts`
- `src/lib/format-spec.test.ts`
- `src/lib/draft-processing.test.ts`
- `npm run typecheck`
- `npm run build`

### Manual desktop test after implementation

Use a draft similar to the observed company-introduction output:

- chat content contains title, indented headings, bare list runs;
- set as draft;
- export DOCX;
- open in Word/WPS;
- verify title/heading/body/list are structurally styled, not literal-space formatted.

## 6. Acceptance criteria

Slice E2 passes when:

1. Full-width/ideographic indentation is not preserved as literal DOCX text for headings/body paragraphs.
2. Chinese heading patterns are normalized into `heading` blocks with correct levels and dimensions.
3. Conservative bare-list recovery works only in tested safe contexts.
4. DOCX writer applies at least title, heading1, heading2, body, and ordered-list style mappings from FormatSpec attributes or safe defaults.
5. Fidelity diagnostics show observable improvement for at least typography/page-independent dimensions such as title/body/heading/list.
6. Existing export save/review behavior is preserved.
7. No manual template route, no XLSX/PPTX expansion, no auto-overwrite, no Word/WPS parity claim.

## 7. Non-goals

- No UI diagnostics productization; that is E3.
- No XLSX/PPTX work.
- No manual template file input.
- No store-time mutation of assistant messages into markdown.
- No full Word/WPS parity assertion.
- No broad page-margin conflict resolution unless a non-conflicting source-specific margin rule exists.

## 8. Execution staffing guidance

Recommended execution lane: `$ralph` single-owner implementation.

Why: changes are coupled across `docx-intermediate`, `docx-ts-adapter`, and diagnostics tests; parallel team work risks merge conflicts.

Possible agents if execution uses team:

- executor: implement structure normalizer and writer resolver.
- test-automator: add regression tests.
- architect/verifier: final review.

## 9. ADR

Decision: Implement Slice E2 as intermediate-first structure normalization plus first DOCX writer style mapping, with narrow prompt support only.

Drivers:

- Current observed failure is structural role ambiguity plus writer not consuming FormatSpec attributes.
- Writer-only changes cannot recover bare lists or headings reliably.
- Prompt-only changes are not reliable enough for DOCX high fidelity.

Alternatives rejected:

- Writer-only: too shallow.
- Prompt-only: too brittle.
- Store-time markdown rewrite: too much product-surface risk for this slice.

Consequences:

- DOCX export should visibly improve for title/headings/body/list.
- Fidelity diagnostics become more meaningful because writer starts consuming dimensions.
- Page margins and UI diagnostics remain follow-ups.

Follow-ups:

1. E2b/E2-margin: resolve page margin source priority once source-specific facts are richer or user-edit chooses a value.
2. E3: UI/export record presentation of restored/partial/missing/unverified fidelity coverage.
3. Later: deeper table styling and Word/WPS manual visual comparison workflow.


## 10. Consensus review log

### Architect review round 1 — APPROVE

Architect approved the overall direction: intermediate role normalization before writer style mapping is the right dependency order for DOCX-first high fidelity. The key tradeoff is that stronger normalization can approach content-structure rewriting, so E2 keeps normalization export-only and does not mutate stored drafts.

Required refinements incorporated before Critic review:

1. Diagnostics must evaluate canonical FormatSpec dimensions (`title.main`, `heading.level1`, `heading.level2`, `paragraph.body`, `list.numbering`) instead of relying only on legacy buckets.
2. Writer tests must inspect DOCX XML (`word/document.xml`, `word/styles.xml`, `word/numbering.xml`) for observable formatting evidence.
3. Bare-list recovery must include explicit negative tests for long narrative lines, sentence-like lines, colon-followed explanatory paragraphs, and numbered-list vs heading ambiguity.
4. Boundaries remain hard constraints: no XLSX/PPTX, no manual template route, no UI/store/Tauri, no auto-overwrite, and no Word/WPS full-replica claim.


### Critic review round 1 — APPROVE

Critic approved the plan with no blocking issues. The plan is internally consistent with DOCX-first high fidelity, structure-before-style sequencing, FormatSpec consumption rather than manual-template revival, and measured XML/diagnostics verification.

Execution handoff constraints for `$ralph`:

1. Keep the slice boundary: intermediate normalization + diagnostics first, then resolver/writer mapping.
2. Keep bare-list recovery conservative and prove it with negative tests.
3. Verify DOCX writer changes by unzipping DOCX and inspecting XML evidence.
4. Do not introduce template-file input, do not mutate stored drafts, do not touch UI/store/Tauri, do not expand to XLSX/PPTX, and do not claim Word/WPS full parity.
