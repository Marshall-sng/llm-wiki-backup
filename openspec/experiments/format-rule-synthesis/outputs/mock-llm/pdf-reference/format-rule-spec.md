# FormatRuleSpec Synthesis: pdf-reference

- Type: pdf
- Mode: mock-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Rules constrain drafting and audit only; they do not promise file export.
- Rules do not promise high-fidelity visual restoration or pixel-perfect replication.
- Source facts and user draft content override formatting rules.
- Do not copy source body text or raw evidence into the generated draft.

## Rules
### pdf-page-1 / page / page
- Rule: page uses evidence-bound page constraints.
- Detail: The synthesized rule makes pageBox, marginSignal explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0004
- Attributes:
  - pageBox: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0004)
  - marginSignal: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0004)

### pdf-text-layer-2 / text-layer / hierarchy
- Rule: text-layer uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes textLayer, readingOrder explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely
- Attributes:
  - textLayer: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
  - readingOrder: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)

### pdf-reference-use-3 / reference-use / hierarchy
- Rule: reference-use uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes layoutZone, readingOrder explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely
- Attributes:
  - layoutZone: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
  - readingOrder: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)

### pdf-font-ref-4 / font-ref / typography
- Rule: font-ref uses evidence-bound typography constraints.
- Detail: The synthesized rule makes fontRef, font explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0004
- Attributes:
  - fontRef: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0004)
  - font: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0004)

### pdf-reference-use-5 / reference-use / table
- Rule: reference-use uses evidence-bound table constraints.
- Detail: The synthesized rule makes tableSignature, listSignature explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely
- Attributes:
  - tableSignature: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
  - listSignature: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)

### pdf-image-density-6 / image-density / density
- Rule: image-density uses evidence-bound density constraints.
- Detail: The synthesized rule makes imageDensity, layoutZone explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely
- Attributes:
  - imageDensity: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
  - layoutZone: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)

### pdf-scan-risk-7 / scan-risk / boundary
- Rule: scan-risk uses evidence-bound boundary constraints.
- Detail: The synthesized rule makes scanRisk, confidencePolicy explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely
- Attributes:
  - scanRisk: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
  - confidencePolicy: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)

### pdf-boundary-8 / boundary / boundary
- Rule: boundary uses evidence-bound boundary constraints.
- Detail: The synthesized rule makes exportPromise, visualReplication explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001
- Attributes:
  - exportPromise: forbidden (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001)
  - visualReplication: forbidden (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001)

### pdf-page-9 / page / spacing
- Rule: page uses evidence-bound spacing constraints.
- Detail: The synthesized rule makes marginSignal, pageBox explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0004
- Attributes:
  - marginSignal: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0004)
  - pageBox: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0004)

### pdf-reference-use-10 / reference-use / numbering
- Rule: reference-use uses evidence-bound numbering constraints.
- Detail: The synthesized rule makes listSignature, readingOrder explicit and avoids source-text copying.
- Evidence: raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely
- Attributes:
  - listSignature: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
  - readingOrder: evidence-bound (raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely)
