# FormatRuleSpec Synthesis: pptx-briefing

- Type: pptx
- Mode: mock-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Rules constrain drafting and audit only; they do not promise file export.
- Rules do not promise high-fidelity visual restoration or pixel-perfect replication.
- Source facts and user draft content override formatting rules.
- Do not copy source body text or raw evidence into the generated draft.

## Rules
### pptx-deck-1 / deck / hierarchy
- Rule: deck uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes slideSize, master, layout explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - slideSize: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - master: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - layout: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-theme-2 / theme / typography
- Rule: theme uses evidence-bound typography constraints.
- Detail: The synthesized rule makes theme, titleFont, bodyFont explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - theme: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - titleFont: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - bodyFont: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### pptx-layout-3 / layout / hierarchy
- Rule: layout uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes layout, placeholder explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - layout: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - placeholder: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-cover-slide-4 / cover-slide / hierarchy
- Rule: cover-slide uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes titleFont, density explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - titleFont: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - density: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-content-slide-5 / content-slide / density
- Rule: content-slide uses evidence-bound density constraints.
- Detail: The synthesized rule makes density, spacing explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - density: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - spacing: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-bullet-6 / bullet / hierarchy
- Rule: bullet uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes bulletLevel, bodyFont, spacing explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - bulletLevel: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - bodyFont: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - spacing: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-visual-density-7 / visual-density / spacing
- Rule: visual-density uses evidence-bound spacing constraints.
- Detail: The synthesized rule makes density, placeholder explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - density: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - placeholder: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### pptx-content-slide-8 / content-slide / table
- Rule: content-slide uses evidence-bound table constraints.
- Detail: The synthesized rule makes tableHeader, placeholder explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - tableHeader: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - placeholder: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-boundary-9 / boundary / boundary
- Rule: boundary uses evidence-bound boundary constraints.
- Detail: The synthesized rule makes exportPromise, visualReplication explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - exportPromise: forbidden (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - visualReplication: forbidden (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-layout-10 / layout / hierarchy
- Rule: layout uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes layout, density explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - layout: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - density: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-content-slide-11 / content-slide / typography
- Rule: content-slide uses evidence-bound typography constraints.
- Detail: The synthesized rule makes titleFont, spacing explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - titleFont: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - spacing: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### pptx-content-slide-12 / content-slide / hierarchy
- Rule: content-slide uses evidence-bound hierarchy constraints.
- Detail: The synthesized rule makes notesPolicy, density explicit and avoids source-text copying.
- Evidence: raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005
- Attributes:
  - notesPolicy: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)
  - density: evidence-bound (raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004, raw.pptx.slide.0005)

### pptx-theme-13 / theme / typography
- Rule: theme uses evidence-bound typography constraints.
- Detail: The synthesized rule makes theme, spacing explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - theme: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - spacing: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)

### pptx-bullet-14 / bullet / spacing
- Rule: bullet uses evidence-bound spacing constraints.
- Detail: The synthesized rule makes bulletLevel, spacing explicit and avoids source-text copying.
- Evidence: profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
- Attributes:
  - bulletLevel: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
  - spacing: evidence-bound (profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004)
