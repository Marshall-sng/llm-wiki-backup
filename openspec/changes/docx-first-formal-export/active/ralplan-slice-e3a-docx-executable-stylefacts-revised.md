# RALPLAN Consensus Re-review: Slice E3a DOCX executable StyleFacts attributes

## Outcome
Revise Slice E3a so deterministic DOCX StyleFacts can produce a narrow, explicitly executable FormatSpec subset that changes DOCX writer output, without changing the standing evidence-only/high-fidelity boundary for StyleFacts as a whole.

## RALPLAN-DR summary

### Principles
1. **Narrow executability, not template parity**: StyleFacts remain non-template, non-visual-parity evidence. Only DOCX `title.main`, `heading.level1`, and `paragraph.body` may emit deterministic writer attributes in this slice.
2. **Sanitized facts-only input boundary**: executable extraction may read only sanitized StyleFacts fact records plus a sanitized evidence reference catalog. It must not receive or read full `styleFacts.evidence` objects because `StyleFactEvidence.value?: unknown` can contain arbitrary payloads.
3. **Observable writer proof**: acceptance requires an end-to-end pipeline test through `buildFormatSpecSnapshot -> buildDocxIntermediateDocument -> renderDocxWithTsAdapter` that proves `word/styles.xml` diverges between two StyleFacts-backed profiles.
4. **Source fidelity before writer normalization**: preserve source font values in `FormatSpecRule.attributes`; font canonicalization is allowed only at resolver/writer boundary, or the resolver must be revised to accept canonical writer fonts without mutating FormatSpec.
5. **Boundary copy must match behavior**: update existing `canGuideExport: false` and FormatSpec “no export promise” language to distinguish this limited executable DOCX writer subset from high-fidelity/template/parity promises.

### Drivers
- The prior E3a draft under-specified how StyleFacts could remain non-export while still creating executable DOCX attributes.
- Current code already has DOCX style resolution (`src/lib/docx-format-style.ts`) and writer consumption (`src/lib/docx-ts-adapter.ts`), but profile differences often remain prose-only and fall back to defaults.
- Existing boundaries in `src/lib/style-facts.ts` and `src/lib/format-spec.ts` can be read as forbidding any export influence, so they must be made precise before implementation claims success.

### Options considered
- **A. Keep StyleFacts as evidence-only prose and rely on overlays** — rejected: repeats current failure mode where two different profiles generate near-identical `styles.xml` unless structured attributes exist.
- **B. Broadly make StyleFacts `canGuideExport: true`** — rejected: overclaims export fidelity and conflicts with established evidence-only boundaries.
- **C. Limited DOCX executable contract for three deterministic fields** — chosen: smallest contract that proves profile-to-writer influence while preserving non-template/non-parity limits.

### Decision
Implement Slice E3a as a limited DOCX-only executable attribute bridge from StyleFacts to FormatSpec for `title.main`, `heading.level1`, and `paragraph.body`, with source-preserving FormatSpec attributes and resolver/writer-boundary font normalization.

## Scope

### In scope
- Add a deterministic helper in/near `src/lib/format-spec.ts` (or a small sibling such as `src/lib/docx-stylefacts-format-attributes.ts`) that converts covered DOCX StyleFacts facts into `FormatSpecRule.attributes` for:
  - `title.main`
  - `heading.level1`
  - `paragraph.body`
- Helper input is limited to a pre-sanitized object, not the profile or raw evidence:
  - sanitized StyleFacts fact records required for the three covered dimensions
  - sanitized evidence reference catalog entries containing only safe scalar/reference fields such as `id`, `confidence`, `category`, `type`, and/or `sourceKind` when needed
  - explicitly excluded from helper input: `StyleFactEvidence.value`, excerpts, samples, raw/source text, probe payloads, nested arbitrary payloads, unrelated profile fields, draft content, and full `FormatProfileRecord`
- The helper may attach `evidenceRefs` as evidence IDs only. It must not inspect `evidence.value` or copy evidence/reference payload text into generated attributes, rules, prompt blocks, or DOCX metadata.
- Preserve source font strings in FormatSpec attributes, e.g. `fontFamily: "仿宋_GB2312"` or `"方正小标宋简体"` if those are the detected facts.
- Normalize fonts only in `src/lib/docx-format-style.ts` or the DOCX writer boundary, and document/test that FormatSpec remains source-preserving.
- Update boundary/copy strings and diagnostics so they say:
  - StyleFacts do **not** promise templates, parity, or broad export reconstruction.
  - DOCX may use covered deterministic fields as executable writer hints for supported dimensions only.
- Add tests proving attribute extraction, non-leakage, font preservation/normalization boundary, and end-to-end DOCX divergence.

### Out of scope
- XLSX/PPTX/PDF export behavior.
- Manual template import or template replay.
- Visual screenshot parity / Word-WPS pixel matching.
- Raw probe access by the new helper.
- Inferring headings/body text from source content.
- Making accepted LLM overlay prose executable unless already represented as structured `FormatSpecRule.attributes`.
- Broad `canGuideExport: true` on StyleFacts.

## File touchpoints

Likely implementation files:
- `src/lib/format-spec.ts` — integrate limited DOCX StyleFacts-to-attributes rules before/with baseline merge; update boundaries and summary lines.
- `src/lib/format-profile-types.ts` — only if clearer types/comments are needed for executable DOCX attributes; avoid schema churn unless required.
- `src/lib/style-facts.ts` — revise capability/copy/diagnostic wording while keeping broad `canGuideExport: false` semantics or adding a narrow descriptive sub-capability if type-safe.
- `src/lib/docx-format-style.ts` — ensure font normalization happens only while resolving writer policy, not when building FormatSpec; revise normalization if canonical writer names are expected.
- `src/test-helpers/docx-export-fixtures.ts` — add or extend two StyleFacts-backed profile fixtures with distinct source font/size facts.

Likely tests:
- `src/lib/format-spec.test.ts`
- `src/lib/docx-format-style.test.ts`
- `src/lib/docx-ts-adapter.test.ts`
- Possibly `src/lib/style-facts.test.ts` for capability/boundary wording.

## Execution plan

1. **Boundary contract update first**
   - Revise StyleFacts capability/copy to keep broad `canGuideExport: false` while documenting the exception: DOCX-only covered deterministic fields may become executable writer attributes.
   - Revise FormatSpec boundaries from blanket “no DOCX export promise” to “no high-fidelity/template/parity promise; limited DOCX writer attributes are supported for covered dimensions.”
   - Add/adjust tests so the boundary text cannot regress into either overclaiming or forbidding the new limited path.

2. **Add constrained StyleFacts executable extraction**
   - Create a pure helper whose signature accepts only sanitized facts plus a sanitized evidence reference catalog, for example `{ facts: SanitizedStyleFact[], evidenceRefs: SafeEvidenceRefCatalog }`.
   - `SafeEvidenceRefCatalog` may include only safe fields required for correlation/citation, such as `id`, `confidence`, `category`, `type`, and/or `sourceKind`; it must explicitly omit `value`, excerpts, samples, raw text, source text, nested arbitrary payloads, and any non-scalar/raw payload fields.
   - Do not pass `profile`, full `styleFacts.evidence`, `probe`, `textSample`, `structureProfile.sections`, draft content, unrelated profile fields, or source body/heading text.
   - The helper may attach `evidenceRefs` as IDs only; it must never dereference or branch on `StyleFactEvidence.value`.
   - Extract only deterministic typography/layout facts needed for `fontFamily`, `fontSizePt`, `bold`, `alignment`, `firstLineIndentChars`, and/or `lineSpacingPt` when evidence-backed.
   - Attach `evidenceRefs` to generated attributes and rules as string IDs only.
   - Prefer conservative omission over inference when a field cannot be tied to the target dimension.

3. **Merge executable attributes into DOCX FormatSpec**
   - Emit or enrich rules with canonical dimensions `title.main`, `heading.level1`, and `paragraph.body`.
   - Ensure deterministic StyleFacts attributes survive `ensureDocxFormatSpecBaseline()` and appear in `buildFormatSpecSnapshot(profile).formatSpec.rules`.
   - Preserve source font values in these attributes; do not canonicalize in `format-spec.ts`.

4. **Resolve writer fonts at boundary**
   - In `docx-format-style.ts`, either accept canonical writer fonts already present or normalize known source font variants to writer-safe names there.
   - Tests must prove: FormatSpec contains original source font strings, while resolved `stylePolicy`/rendered `styles.xml` contains canonical writer-safe values when normalization is needed.

5. **End-to-end divergence proof**
   - Add two StyleFacts-backed DOCX profile fixtures with distinct facts for at least one covered dimension.
   - Test full chain: `buildFormatSpecSnapshot(profile)` -> `buildDocxIntermediateDocument({ draft, formatProfileSnapshot })` -> `renderDocxWithTsAdapter(...)`.
   - Unzip both outputs and assert `word/styles.xml` differs in expected style values. Prefer assertions on style IDs/values (e.g., title/body font or size) over whole-file hash only.

6. **Regression verification and handoff notes**
   - Run targeted tests for format spec, style resolver, and TS adapter.
   - Run the broader DOCX-related test subset if targeted tests pass.
   - Record any remaining unsupported dimensions as explicit follow-up, not hidden behavior.

## Acceptance criteria

- `buildFormatSpecSnapshot()` for a DOCX StyleFacts-backed profile produces structured `FormatSpecRule.attributes` for at least `title.main`, `heading.level1`, and `paragraph.body` when evidence-backed facts exist.
- New helper cannot access raw probes, heading/body/source text, samples, draft content, full `FormatProfileRecord`, full `styleFacts.evidence`, or `StyleFactEvidence.value`; its type signature and tests enforce sanitized facts plus safe evidence-reference input only.
- Generated `evidenceRefs` are IDs only. No evidence `value`, excerpts, samples, raw/source text, nested arbitrary payloads, or unrelated profile fields can appear in `FormatSpec`, `promptBlock`, `rules`, `attributes`, rendered DOCX metadata, or rendered DOCX XML.
- FormatSpec attributes preserve source font values; normalization is confined to `resolveDocxStylePolicy()` / DOCX writer boundary.
- Existing copy/boundaries explicitly distinguish:
  - limited executable DOCX writer attributes for covered fields, from
  - no template replay, no high-fidelity visual parity, no broad export promise.
- End-to-end test proves two StyleFacts-backed profiles produce different `word/styles.xml` through the real snapshot/intermediate/render path.
- No XLSX/PPTX/PDF behavior changes.
- No manual template path or user-file overwrite path is introduced.

## Required tests

1. **FormatSpec extraction test** (`format-spec.test.ts`)
   - Given a DOCX profile with StyleFacts font/size evidence, `buildFormatSpecSnapshot()` includes rules for `title.main`, `heading.level1`, `paragraph.body` with evidence-backed attributes.
   - Assert no raw probe text, heading/body source content, sample fields, evidence values, or unrelated profile fields appear in `FormatSpec`, `promptBlock`, rules, or attributes.

2. **Helper input boundary test** (`format-spec.test.ts` or new helper test)
   - The helper is called with a sanitized facts object plus safe evidence reference catalog only; type-level construction should make it impossible to pass full `StyleFactEvidence[]` or `StyleFactEvidence.value`.
   - Construct a profile containing unique poison strings in:
     - `styleFacts.evidence[].value`
     - raw probe/sample/source-text-like fields
     - nested arbitrary evidence payloads, excerpts, and sample-like fields if present in fixture shapes
     - unrelated profile fields
   - Assert none of those poison strings appear in serialized `FormatSpec`, `promptBlock`, generated `rules`, generated `attributes`, or any `evidenceRefs` beyond allowed ID strings.
   - Assert generated `evidenceRefs` contain only expected evidence IDs and that changing only `evidence.value` does not change helper output.

3. **Font boundary test** (`docx-format-style.test.ts`)
   - FormatSpec retains source font values.
   - `resolveDocxStylePolicy()` maps known source font variants to canonical writer fonts only at resolution time, or accepts already canonical fonts unchanged.

4. **End-to-end DOCX divergence test** (`docx-ts-adapter.test.ts`)
   - Use two StyleFacts-backed profile fixtures.
   - Chain exactly: `buildFormatSpecSnapshot -> buildDocxIntermediateDocument -> renderDocxWithTsAdapter`.
   - Unzip results and assert `word/styles.xml` differs for expected title/heading/body style attributes.
   - Include poison strings from `styleFacts.evidence[].value`, raw probe/sample/source-text-like fields, and unrelated profile fields in at least one fixture; unzip rendered DOCX and assert they do not appear in DOCX metadata or XML parts, including `word/styles.xml`, `docProps/core.xml`, `docProps/app.xml`, and other serialized XML inspected by the test.

5. **Boundary wording/capability test** (`style-facts.test.ts` and/or `format-spec.test.ts`)
   - `canGuideExport` does not become a broad true claim.
   - Boundary text includes the limited DOCX covered-field exception and no high-fidelity/template/parity promise.

Suggested targeted command:
```powershell
npm run test -- src/lib/format-spec.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts src/lib/style-facts.test.ts
```

Suggested broader verification if targeted tests pass:
```powershell
npm run test -- src/lib/docx-*.test.ts src/lib/format-spec.test.ts src/lib/format-profile.test.ts
npm run build
```

## Risks and mitigations

- **Risk: boundary contradiction** — Keeping `canGuideExport: false` while generating writer attributes may look inconsistent.
  - Mitigation: make the boolean mean “no broad export/template/parity guidance,” and add explicit copy or a narrow sub-capability for supported DOCX writer attributes.
- **Risk: accidental source leakage** — StyleFacts evidence can contain values; raw source text must not leak.
  - Mitigation: pass only sanitized facts plus a safe evidence reference catalog; never pass full evidence objects; attach `evidenceRefs` as IDs only; add poison-string tests spanning `evidence[].value`, raw/source/sample fields, unrelated profile fields, FormatSpec serialization, prompt blocks, rules, attributes, and rendered DOCX XML/metadata.
- **Risk: font over-normalization hides profile differences** — normalizing too early can collapse distinct sources.
  - Mitigation: preserve source values in FormatSpec; normalize only in resolver/writer; divergence test must use another differing field if two source fonts map to the same writer font.
- **Risk: target-dimension misclassification** — source facts may not reliably tell title vs heading vs body.
  - Mitigation: conservative mapping from style definitions/usage counts only; omit attributes rather than infer from content.
- **Risk: brittle XML tests** — asserting complete XML may be noisy.
  - Mitigation: assert targeted `word/styles.xml` snippets/values and non-equality, not full snapshots.

## Stop condition
Slice E3a is complete when the targeted tests pass and the end-to-end DOCX divergence test proves that two StyleFacts-backed profiles produce distinct `word/styles.xml` through `buildFormatSpecSnapshot -> buildDocxIntermediateDocument -> renderDocxWithTsAdapter`, while boundary/copy tests still reject template, high-fidelity, visual parity, and broad export promises.

## Consensus Review Result

Status: APPROVED for execution.

Planner iterations:
- Initial plan selected deterministic StyleFacts-to-FormatSpec attributes before DOCX baseline fill.
- Revision 1 added the limited executable DOCX contract, sanitized input boundary, E2E divergence proof, and source-font-preservation / writer-boundary-normalization rule.
- Revision 2 tightened helper input so it cannot receive full `StyleFactEvidence` objects or `evidence.value`; only safe scalar evidence IDs/metadata are allowed.

Architect review:
- First review: ITERATE. Required explicit boundary migration and facts-only heuristics.
- Second review: APPROVE. Noted implementation watchpoint: sanitized catalog must be explicitly constructed/opaque, not a structural subset that can accept full evidence objects.

Critic review:
- First review: ITERATE. Required explicit exclusion of `styleFacts.evidence[].value` and poison-string tests.
- Second review: APPROVE. Plan is actionable with clear stop condition and risk mitigation.

Execution watchpoint:
- The executor must create an explicit safe evidence catalog/factory for the helper. Do not pass `FormatProfileRecord`, full `StyleFactsEnvelope`, full `StyleFactEvidence[]`, or any object that includes `value`, samples, excerpts, raw/source text, draft content, or nested arbitrary payloads.

Approved execution lane:
- Use `$ralph` or a single executor for implementation.
- Stop after E3a tests prove executable attributes and DOCX XML divergence. Do not expand to E3b/E4, UI changes, XLSX/PPTX/PDF, manual templates, or Word/WPS visual parity work in this slice.

