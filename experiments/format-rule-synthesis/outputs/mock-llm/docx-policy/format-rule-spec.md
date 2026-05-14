# FormatRuleSpec Synthesis: docx-policy

- Type: docx
- Mode: mock-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Rules constrain drafting and audit only; they do not promise file export.
- Rules do not promise high-fidelity visual restoration or pixel-perfect replication.
- Source facts and user draft content override formatting rules.
- Do not copy source body text or raw evidence into the generated draft.

## Rules
### docx-page-size / page / page
- Rule: Use formal A4-like page organization when page evidence supports it.
- Detail: Represent page size as an approximate drafting constraint, not an export promise.
- Evidence: raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005
- Attributes:
  - pageSize: A4-like portrait (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - margin: detect-or-confirm; do not fabricate exact margins (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - pageOrientation: portrait unless evidence contradicts (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-title-main / title / hierarchy
- Rule: Main title is standalone and visually separated from body.
- Detail: Title expresses the current draft topic; it must not reuse source file title text.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - alignment: center or prominent standalone line (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - font: Arial (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - fontSizePt: larger than body; infer from title/style evidence pt (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-heading-l1 / heading / hierarchy
- Rule: Level-1 headings represent chapters or major sections.
- Detail: Use one consistent pattern such as Chapter/Section or Chinese numeral headings.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - numbering: chapter/major-section pattern (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - font: heading font from evidence or formal default (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - paragraphSpacing: more spacing before than body (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-heading-l2 / heading / hierarchy
- Rule: Level-2 headings group related provisions.
- Detail: Use one consistent second-level marker and keep heading text short.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - numbering: section/subsection pattern (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - alignment: left or formal heading alignment (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - fontSizePt: between title and body (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-heading-l3 / heading / hierarchy
- Rule: Level-3 headings identify concrete items.
- Detail: Do not promote long provision sentences into headings.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - numbering: item marker such as 1. or (1) (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - indent: same-level consistent indent (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-numbering-seq / numbering / numbering
- Rule: Provision numbering is continuous and same-level markers are homogeneous.
- Detail: Preserve chapter/article/paragraph/item ordering inferred from evidence.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - numbering: continuous within each level (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - indent: nested levels increase indent consistently (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-body-font / typography / typography
- Rule: Body typography follows detected dominant body style.
- Detail: Use detected font and size as drafting constraints and show uncertainty if evidence is weak.
- Evidence: raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005
- Attributes:
  - font: Arial (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - fontSizePt: 10.5 pt (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - lineSpacing: stable formal-document line spacing (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-body-paragraph / paragraph / spacing
- Rule: Body paragraphs use formal paragraph rhythm.
- Detail: Use first-line indent, consistent line spacing, and controlled before/after spacing.
- Evidence: raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005
- Attributes:
  - indent: first-line indent around two Chinese characters when appropriate (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - alignment: left or justified (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - paragraphSpacing: consistent same-level spacing (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - lineSpacing: consistent body line spacing (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-list-item / paragraph / hierarchy
- Rule: List-like body items remain body text unless they are real headings.
- Detail: Long sentences, amounts, thresholds and responsibilities remain body provisions.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - promotionPolicy: do not promote long provisions to headings (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - indent: list indent consistent by level (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-table-structure / table / table
- Rule: Tables carry matrices, lists, thresholds or comparisons.
- Detail: Table facts must come from user draft or references, never from the format image.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - tableHeader: short field labels (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - bodyFontSizePt: may be smaller than body if evidence supports pt (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - alignment: cell text readable and consistent (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-table-caption / table / hierarchy
- Rule: Table caption is separated from body provisions.
- Detail: Caption precedes table or is clearly attached; header cells do not contain article numbering.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - paragraphSpacing: caption/table spacing distinct from body (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - numbering: table numbering optional and evidence-bound (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)

### docx-header-footer / page / page
- Rule: Header/footer evidence is diagnostic only unless explicitly present.
- Detail: Do not invent headers, footers, watermarks, seals, or page numbers.
- Evidence: raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005
- Attributes:
  - headerFooter: confirm before use (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - margin: do not infer exact header/footer distance (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-spacing-heading / heading / spacing
- Rule: Heading spacing separates hierarchy without adding content.
- Detail: Before/after spacing may differ by level but should be consistent within each level.
- Evidence: raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005
- Attributes:
  - paragraphSpacing: level-specific consistent spacing (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - lineSpacing: heading line spacing stable (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-font-fallback / typography / typography
- Rule: Western/default fonts are compatibility evidence, not Chinese body preference.
- Detail: Prefer body-style evidence over global font counts when they conflict.
- Evidence: raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005
- Attributes:
  - fontFallback: do not overfit Arial/en-US counts (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - font: Arial (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-diagnostics / boundary / boundary
- Rule: Uncertain layout facts are surfaced as diagnostics.
- Detail: Weak margin or numbering evidence must lower confidence rather than create exact rules.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - confidencePolicy: lower confidence on weak evidence (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)

### docx-boundary / boundary / boundary
- Rule: Never claim DOCX export or visual replication.
- Detail: This is a drafting constraint layer only.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - exportPromise: forbidden (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - visualReplication: forbidden (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)

### docx-appendix / heading / hierarchy
- Rule: Appendix or attachment sections remain separate from body hierarchy.
- Detail: Only create appendix structure when the current draft requires it.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - numbering: appendix labels evidence-bound (raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005)
  - paragraphSpacing: separate from body (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)

### docx-signoff / paragraph / spacing
- Rule: Sign-off/date blocks are not inferred from style alone.
- Detail: Do not create issuer/date/seal areas unless draft facts require them.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005
- Attributes:
  - alignment: confirm before right/center alignment (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
  - paragraphSpacing: sign-off spacing evidence-bound (raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005)
