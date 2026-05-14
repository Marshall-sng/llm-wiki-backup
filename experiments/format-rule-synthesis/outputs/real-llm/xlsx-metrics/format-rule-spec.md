# FormatRuleSpec Synthesis: xlsx-metrics

- Type: xlsx
- Mode: real-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Use the XLSX only as evidence for table structure, metric organization, and formatting tendencies.
- Do not infer missing business meaning, hidden sheets, formulas, units, or print settings from absent evidence.
- Do not promise Excel export, exact visual recreation, high-fidelity restoration, or source-document reconstruction.
- Rules may provide fallback behavior when evidence is absent, but such fallbacks must remain conservative and diagnostic-friendly.

## Rules
### wb-structure / workbook / hierarchy
- Rule: Treat the workbook as a single top-level tabular document container.
- Detail: Build formatting logic around one detected worksheet and one compact used range. Do not split the content into multiple independent documents unless later evidence shows additional sheets or regions.
- Evidence: profile.structure.0001, diagnostic.0001
- Attributes:
  - sheetName: Sheet1 worksheet-name (raw.xlsx.sheet.0001)

### wb-scope / workbook / boundary
- Rule: The workbook is a reference source for structure and metrics, not a requested finished spreadsheet artifact.
- Detail: Any downstream representation should preserve table logic and cite uncertainty where required rather than claiming a generated workbook deliverable.
- Evidence: diagnostic.0002

### sheet-name / sheet / hierarchy
- Rule: Use the worksheet name only as a locator, not as a semantic title.
- Detail: If a display title is needed, derive it from user instructions or verified cell content outside this evidence pack. The sheet label alone must not create a business topic.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - sheetName: Sheet1 worksheet-name (raw.xlsx.sheet.0001)

### sheet-used-range / sheet / page
- Rule: Constrain formatting operations to the detected used range unless new evidence expands it.
- Detail: The active table canvas is columns A through C and rows 1 through 29. Empty surrounding cells should remain outside the formatting target.
- Evidence: profile.style.0001, profile.structure.0001
- Attributes:
  - tableRegion: A1:C29 cell-range (profile.style.0001)
  - printLayout: fit-used-range-one-table-per-page-if-printing-is-requested layout-policy (profile.style.0001)

### region-partition / table-region / hierarchy
- Rule: Partition the used range into title/header candidates, data body, and possible summary or note rows by row role.
- Detail: Because only range-level evidence is available, row 1 should be treated as a header/title candidate; rows below it form the initial data-region candidate until cell-level content proves a different split.
- Evidence: profile.style.0001, profile.structure.0001
- Attributes:
  - tableRegion: A1:C29 cell-range (profile.style.0001)
  - headerRow: 1 or first content row after title detection row-index-policy (profile.style.0001)
  - dataRegion: A2:C29 unless title/header analysis changes boundary cell-range-policy (profile.style.0001)

### header-fields / header / typography
- Rule: Render header cells as short field labels with stronger emphasis than data cells.
- Detail: Use one consistent header style across the detected three-column region. If a separate title row is later confirmed, keep title styling distinct from field-header styling.
- Evidence: profile.style.0002, profile.style.0004
- Attributes:
  - headerRow: candidate row 1 row-index (profile.style.0001)
  - fontSizePt: data-size plus 0 to 1 pt, capped by available style evidence pt-policy (profile.style.0002)

### header-align / header / alignment
- Rule: Align header labels centrally within their cells unless column content requires a measured exception.
- Detail: For a compact indicator table, header alignment should support column scanning. Text wrapping is allowed for long field labels rather than widening the table beyond the detected three-column layout.
- Evidence: profile.style.0001, profile.style.0002
- Attributes:
  - columnWidth: auto-fit within A:C; prefer wrap over adding columns policy (profile.style.0001)

### data-preserve-grid / data-region / hierarchy
- Rule: Preserve row-column relationships as the primary meaning carrier.
- Detail: Do not flatten metric rows into prose-only paragraphs. Each observation must remain traceable to its row and column position within the table region.
- Evidence: profile.structure.0001, profile.style.0001
- Attributes:
  - dataRegion: body rows inside A1:C29 after header/title detection cell-range-policy (profile.style.0001)

### data-density / data-region / density
- Rule: Use compact table density suitable for 29 rows and 3 columns.
- Detail: Row height, wrapping, and padding should prioritize complete visibility and scanability. Avoid oversized decorative spacing that would obscure the compact metric-table character.
- Evidence: profile.style.0001, diagnostic.0001
- Attributes:
  - tableRegion: 29 rows by 3 columns table-size (profile.style.0001)
  - columnWidth: auto-fit each of A:C to content with consistent minimum width policy (profile.style.0001)

### style-limited-set / style / typography
- Rule: Use a small, controlled style set rather than many ad hoc variants.
- Detail: The detected workbook has limited font, fill, border, and cell-style counts. Maintain that restraint: title, header, body, and optional note/summary styles are sufficient unless content evidence requires more.
- Evidence: profile.style.0002, profile.style.0003, profile.style.0004, diagnostic.0001
- Attributes:
  - fill: reuse no more than the detected small fill family unless explicitly specified style-policy (profile.style.0003)
  - border: reuse a limited border family; avoid decorative border proliferation style-policy (profile.style.0003)

### style-merged-cells / style / hierarchy
- Rule: Treat merged cells as layout signals that may mark titles, group labels, or notes.
- Detail: Merged areas should not be duplicated into every covered cell. Read and render the merged value once at the merged region's logical anchor.
- Evidence: profile.structure.0001
- Attributes:
  - tableRegion: A1:C29 includes merged-cell evidence cell-range (profile.structure.0001)

### formula-absence / formula / numbering
- Rule: Do not infer calculated fields or formulas where no formula evidence is detected.
- Detail: If totals, ratios, or derived indicators are needed later, mark them as newly derived and keep them separate from imported cell facts.
- Evidence: profile.structure.0001, profile.style.0004
- Attributes:
  - numberFormat: preserve detected literal values; no formula-derived recalculation policy (profile.structure.0001)

### num-format-detect / number-format / numbering
- Rule: Preserve detected numeric display semantics and avoid inventing units.
- Detail: When a cell is numeric, retain its apparent precision and sign style. Percent, currency, date, or unit labels may be applied only when present in verified cell formatting or user instructions.
- Evidence: profile.style.0004, profile.structure.0001
- Attributes:
  - numberFormat: preserve-source-display-or-general-when-undetected format-policy (profile.style.0004)
  - unit: not detected; require explicit evidence before applying unit-policy (profile.style.0004)

### table-border-grid / table-region / table
- Rule: Use borders to clarify the compact grid without turning the table into a decorative layout.
- Detail: Apply consistent inner gridlines to the data body and slightly stronger separation for header or summary rows when identified. Border variety should remain within the small detected style family.
- Evidence: profile.style.0003, profile.style.0001
- Attributes:
  - border: consistent inner grid; stronger header separator if role detected style-policy (profile.style.0003)

### table-fill-hierarchy / table-region / table
- Rule: Use fill color only for structural emphasis such as header, title, or summary rows.
- Detail: Because only a small fill set is detected, avoid alternating or multi-color semantic encodings unless cell-level evidence later confirms them.
- Evidence: profile.style.0003, diagnostic.0001
- Attributes:
  - fill: limited structural fills; no invented heatmap coloring style-policy (profile.style.0003)

### page-print-conservative / sheet / page
- Rule: If print layout is requested, fit the used table region as one compact report area.
- Detail: Set print area to the detected used range, preserve portrait or landscape choice as unknown until explicit evidence appears, and prefer scaling that keeps all three columns visible.
- Evidence: profile.style.0001, profile.structure.0001
- Attributes:
  - printLayout: print-area=A1:C29; orientation=undetected; fit-width=1-page-if-needed print-policy (profile.style.0001)
  - tableRegion: A1:C29 cell-range (profile.style.0001)

### boundary-unknowns / boundary / boundary
- Rule: Unobserved formatting details must remain unspecified or marked as inferred defaults.
- Detail: Do not assert exact font names, exact column widths, exact colors, formulas, units, print orientation, or hidden semantic groupings from this evidence pack alone.
- Evidence: profile.style.0002, profile.style.0003, profile.style.0004, diagnostic.0002
- Attributes:
  - unit: unknown unless present in verified cells or user instructions policy (profile.style.0004)
  - printLayout: unknown except used-range fit policy when requested policy (profile.style.0001)
