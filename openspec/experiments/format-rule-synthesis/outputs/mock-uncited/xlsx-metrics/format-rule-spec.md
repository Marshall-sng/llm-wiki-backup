# FormatRuleSpec Synthesis: xlsx-metrics

- Type: xlsx
- Mode: mock-uncited
- Evaluation: fail
- Granularity: 100

## Boundaries
- Guarantee high-fidelity export and exact visual recreation.

## Rules
### xlsx-workbook-1 / workbook / hierarchy
- Rule: workbook uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes sheetName, printLayout explicit and avoids source-text copying.
- Evidence: missing.evidence.0001
- Attributes:
  - sheetName: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - printLayout: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-sheet-2 / sheet / hierarchy
- Rule: sheet uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes sheetName, freezePane explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001

### xlsx-table-region-3 / table-region / hierarchy
- Rule: table-region uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes tableRegion, headerRow, dataRegion explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - tableRegion: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - headerRow: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - dataRegion: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-header-4 / header / table
- Rule: header uses evidence-bound table constraints.
- Detail: The synthesized rule makes headerRow, columnWidth, alignment explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - headerRow: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - columnWidth: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - alignment: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-data-region-5 / data-region / table
- Rule: data-region uses evidence-bound table constraints.
- Detail: The synthesized rule makes dataRegion, numberFormat, unit explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - dataRegion: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - numberFormat: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - unit: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-style-6 / style / typography
- Rule: style uses evidence-bound typography constraints.
- Detail: The synthesized rule makes fill, border, font explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - fill: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - border: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - font: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### xlsx-formula-7 / formula / numbering
- Rule: formula uses evidence-bound numbering constraints.
- Detail: The synthesized rule makes formulaPolicy, numberFormat explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - formulaPolicy: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - numberFormat: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-number-format-8 / number-format / typography
- Rule: number-format uses evidence-bound typography constraints.
- Detail: The synthesized rule makes numberFormat, unit explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - numberFormat: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - unit: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### xlsx-style-9 / style / page
- Rule: style uses evidence-bound page constraints.
- Detail: The synthesized rule makes printLayout, pageBreak explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - printLayout: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - pageBreak: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### xlsx-boundary-10 / boundary / boundary
- Rule: boundary uses evidence-bound boundary constraints.
- Detail: The synthesized rule makes exportPromise, visualReplication explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001, profile.style.0001, profile.style.0002, profile.style.0003
- Attributes:
  - exportPromise: forbidden (raw.xlsx.sheet.0001, profile.structure.0001, profile.style.0001, profile.style.0002, profile.style.0003)
  - visualReplication: forbidden (raw.xlsx.sheet.0001, profile.structure.0001, profile.style.0001, profile.style.0002, profile.style.0003)

### xlsx-style-11 / style / spacing
- Rule: style uses evidence-bound spacing constraints.
- Detail: The synthesized rule makes columnWidth, alignment explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - columnWidth: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - alignment: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### xlsx-table-region-12 / table-region / table
- Rule: table-region uses evidence-bound table constraints.
- Detail: The synthesized rule makes totalRow, formulaPolicy explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - totalRow: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - formulaPolicy: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-table-region-13 / table-region / hierarchy
- Rule: table-region uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes notesRegion, unit explicit and avoids source-text copying.
- Evidence: raw.xlsx.sheet.0001, profile.structure.0001
- Attributes:
  - notesRegion: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)
  - unit: evidence-bound (raw.xlsx.sheet.0001, profile.structure.0001)

### xlsx-data-region-14 / data-region / spacing
- Rule: data-region uses evidence-bound spacing constraints.
- Detail: The synthesized rule makes density, tableRegion explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - density: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - tableRegion: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
