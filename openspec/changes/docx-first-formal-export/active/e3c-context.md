# DOCX E3c Paragraph Direct Formatting Context

## Task statement
Design Slice E3c through ralplan. The next DOCX-first fidelity step should address the observed mismatch between generated `C:\Users\Dante\Desktop\云南省大数据有限公司.docx` and baseline `D:\llm_wiki\基准素材_复制.docx`.

## Desired outcome
Produce a consensus-approved implementation plan for E3c, focused on paragraph direct formatting extraction/application, especially making body paragraphs follow the baseline 570 twip line spacing instead of the current 600 twip default.

## Known evidence
Manual/OpenXML comparison after E3b:
- Page size matches: generated and baseline both `11906 x 16838` twips.
- Page margins/header/footer match: top 2211, right 1531, bottom 1888, left 1531, header 851, footer 1519.
- Main title is close: generated title uses 方正小标宋简体, 22pt, centered, 579 twips.
- Body font direction is close: generated and baseline use 仿宋_GB2312 heavily.
- Main gap: generated paragraphs mostly use `w:line="600" w:lineRule="exactly"`; baseline paragraphs mostly use `w:line="570" w:lineRule="exact"`.
- Baseline's 570 twip spacing appears primarily in paragraph direct formatting (`word/document.xml`), not only style definitions (`word/styles.xml`).
- Generated doc has 47 paragraphs at 600 and 1 at 579; baseline has about 85 paragraphs at 570.
- Numbering still requires care: avoid converting visible formal prose numbering unless explicit source list rule exists.

## Constraints
- DOCX-first only; no XLSX/PPTX expansion.
- Do not restore manual template route.
- Do not auto-overwrite user files.
- Do not claim pixel-perfect Word/WPS parity or 100% high fidelity.
- Preserve E3b wins: page setup, title, header/footer, font direction, conservative numbering.
- Next slice should be narrow: solve paragraph direct formatting/line spacing first, not all visual mismatches.

## Unknowns/open questions
- Exact best representation for paragraph direct formatting in StyleFacts: dominant paragraph direct formatting vs role-classified paragraph buckets.
- Whether writer should apply dominant body line spacing via Normal style, per paragraph direct formatting, or both.
- How to avoid applying body spacing to title/subtitle/title-like paragraphs.
- How to expose diagnostics proving paragraph direct formatting coverage without leaking raw document text.

## Likely codebase touchpoints
- `src-tauri/src/commands/format_probe.rs` for DOCX paragraph direct formatting extraction.
- `src/lib/style-facts.ts` if StyleFacts schema needs paragraph direct formatting facts.
- `src/lib/docx-stylefacts-format-attributes.ts` to convert direct formatting facts into FormatSpec executable attributes.
- `src/lib/docx-format-style.ts` to resolve attributes into style policy.
- `src/lib/docx-ts-adapter.ts` if per-block or Normal style line spacing application changes.
- `src/lib/docx-fidelity-diagnostics.ts` for paragraph direct formatting diagnostics/bucketInputs.
- Tests under `src/lib/*docx*.test.ts`, `src/lib/style-facts.test.ts`, and test helper fixtures.
