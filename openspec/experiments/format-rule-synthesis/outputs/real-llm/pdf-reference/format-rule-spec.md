# FormatRuleSpec Synthesis: pdf-reference

- Type: pdf
- Mode: real-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Use this as a format-reference profile, not as a promise to recreate the PDF exactly.
- Do not infer source body content, proprietary wording, image content, or exact coordinates from the evidence pack.
- Do not claim high-fidelity export, visual restoration, or exact editable template reconstruction.
- Where evidence is missing, use conservative GB/T 9704-2012-like defaults only as fallback defaults and mark them as low confidence.
- Preserve structural intent and formatting constraints over pixel-level visual matching.

## Rules
### page-unit-001 / page / page
- Rule: Treat the document as a page-based reference with a fixed 15-page observed extent.
- Detail: Formatting engines should preserve page-aware pagination checkpoints and avoid expanding the adapted draft far beyond the observed reference length unless source content requires it.
- Evidence: raw.pdf.fact.pageCount, profile.style.0001, diagnostic.0001
- Attributes:
  - pageBox: unknown-from-evidence; prefer GB/T-like A4 portrait fallback only when target output requires a page box policy (profile.style.0001)
  - layoutZone: page-scoped layout zones; exact margins not recoverable policy (raw.pdf.fact.pageCount, profile.style.0001)
  - marginSignal: insufficient coordinate evidence; do not infer exact margins diagnostic (profile.style.0001, diagnostic.0003)

### page-density-002 / page / density
- Rule: Use moderate-to-high page complexity assumptions when placing adapted content.
- Detail: The combination of 15 pages and 108 images indicates a finished, visually dense reference; adapted output should prefer compact, disciplined spacing and clear section breaks over loose prose-only layouts.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.imageCount, diagnostic.0001
- Attributes:
  - imageDensity: 108 images / 15 pages = about 7.2 image resources per page imagesPerPage (raw.pdf.fact.imageCount, raw.pdf.fact.pageCount)
  - layoutZone: separate text, figure, and table zones where content requires mixed media policy (raw.pdf.fact.imageCount, profile.style.0001)

### text-layer-001 / text-layer / hierarchy
- Rule: Treat text extraction as present but sparse; infer hierarchy cautiously.
- Detail: Because text operators are limited relative to page count and image count, headings, captions, and lists should be reconstructed from draft semantics rather than copied from PDF operator order alone.
- Evidence: raw.pdf.fact.textOperatorCount, profile.style.0004, diagnostic.0002
- Attributes:
  - textLayer: present-or-hinted diagnostic (profile.style.0004, diagnostic.0002)
  - readingOrder: semantic-source-first; PDF text-operator order is advisory only policy (raw.pdf.fact.textOperatorCount, diagnostic.0002)

### text-layer-002 / text-layer / spacing
- Rule: Use GB/T-like paragraph discipline when editable text must be generated.
- Detail: For adapted prose, use consistent paragraph indentation, controlled line spacing, and heading separation; do not derive exact line breaks from the reference PDF.
- Evidence: diagnostic.0002, diagnostic.0003
- Attributes:
  - readingOrder: body text follows logical document order supplied by the draft policy (diagnostic.0003)
  - layoutZone: main text zone should remain distinct from image-heavy regions policy (raw.pdf.fact.imageCount, diagnostic.0002)

### image-density-001 / image-density / density
- Rule: Use image count as a complexity signal, not as an instruction to fabricate images.
- Detail: When adapting a draft, keep placeholders or figure slots only where the draft has corresponding visual content; do not invent or reposition missing source images from the PDF reference.
- Evidence: raw.pdf.fact.imageCount, diagnostic.0001, diagnostic.0003
- Attributes:
  - imageDensity: high classification (raw.pdf.fact.imageCount, raw.pdf.fact.pageCount)
  - layoutZone: figure/table/media regions should be explicitly bounded from prose regions policy (raw.pdf.fact.imageCount, profile.style.0001)

### font-ref-001 / font-ref / typography
- Rule: Treat PDF font resource names as diagnostic font references only.
- Detail: Use Chinese office-document compatible fonts for generated editable text; embedded subset names and PDF resource names must not be treated as guaranteed installed fonts.
- Evidence: profile.style.0002, diagnostic.0001
- Attributes:
  - fontRef: MicrosoftYaHei-Bold, SegoeUI-Bold, MicrosoftYaHei, SimSun, SegoeUI resource hints pdfResourceHint (profile.style.0002)
  - fontSizePt: not recoverable from evidence pt (profile.style.0002)

### font-ref-002 / font-ref / typography
- Rule: Use role-based typography rather than exact PDF font matching.
- Detail: For GB/T-like output, map headings to bold Chinese-compatible sans or serif styles and body text to readable Chinese body fonts; maintain internal consistency instead of matching resource names exactly.
- Evidence: profile.style.0002, diagnostic.0002
- Attributes:
  - fontRef: role-based mapping: heading-bold, body-regular, fallback-Chinese-compatible policy (profile.style.0002)

### scan-risk-001 / scan-risk / boundary
- Rule: Low scan risk permits cautious formatting inference, but not pixel reconstruction.
- Detail: The reference is not flagged as likely scanned, so text and font clues may inform layout rules at medium confidence while exact visual recovery remains out of scope.
- Evidence: raw.pdf.fact.scanLikely, profile.style.0004, diagnostic.0002
- Attributes:
  - scanRisk: low classification (raw.pdf.fact.scanLikely, profile.style.0004)
  - textLayer: usable as advisory evidence policy (diagnostic.0002)

### reference-use-001 / reference-use / boundary
- Rule: Use the PDF as a finished-reference constraint set, not as an editable source template.
- Detail: Adaptation should record conflicts between the draft and the reference profile, then prefer draft semantics where structure differs from the reference.
- Evidence: diagnostic.0003, profile.style.0004
- Attributes:
  - readingOrder: draft semantics override PDF visual order during adaptation policy (diagnostic.0003)
  - layoutZone: reference zones are advisory and may be remapped to fit draft structure policy (diagnostic.0003, profile.style.0001)

### table-signature-001 / text-layer / table
- Rule: Do not infer table grids unless the draft supplies tabular content.
- Detail: The evidence pack reports no table inventory; generated tables should follow GB/T-like clean borders, aligned headers, and compact spacing only when required by the draft.
- Evidence: profile.style.0001, diagnostic.0003
- Attributes:
  - tableSignature: not detected; create only from draft semantics policy (profile.style.0001)

### list-signature-001 / text-layer / numbering
- Rule: Use explicit hierarchical numbering only when the draft structure requires it.
- Detail: Because no reliable section list was extracted, numbering should be generated from the target draft outline using GB/T-like hierarchy conventions rather than copied from the PDF reference.
- Evidence: raw.pdf.fact.textOperatorCount, diagnostic.0003
- Attributes:
  - listSignature: not reliably detected; derive from draft outline policy (raw.pdf.fact.textOperatorCount, diagnostic.0003)
  - readingOrder: outline-driven numbering order policy (diagnostic.0003)

### boundary-001 / boundary / boundary
- Rule: Missing measurements are hard boundaries.
- Detail: Do not invent exact margins, colors, coordinates, image positions, or font sizes where the evidence pack contains only page count, text operator count, image count, scan-risk, and font-resource clues.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, profile.style.0002, diagnostic.0003
- Attributes:
  - marginSignal: unavailable diagnostic (profile.style.0001)
  - fontSizePt: unavailable diagnostic (profile.style.0002)
  - pageBox: unavailable diagnostic (profile.style.0001)
