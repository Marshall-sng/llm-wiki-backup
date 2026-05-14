# FormatRuleSpec Synthesis: pptx-briefing

- Type: pptx
- Mode: real-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Use the PPTX only as briefing-structure and style evidence, not as source text to reproduce.
- Do not copy template placeholder wording, sample names, or body text into generated rules or output.
- Do not claim exact visual recreation, high-fidelity restoration, export completion, or finished PPTX production.
- When evidence lacks exact measurements, use conservative GB/T-like defaults and mark confidence accordingly.

## Rules
### deck-structure-31 / deck / hierarchy
- Rule: Organize the briefing as a sequenced slide deck with one cover, multiple content layouts, and optional divider or summary slides.
- Detail: Treat the source as a 31-slide briefing template with many reusable layouts. Generated content should preserve slide-order logic rather than trying to recreate each slide visually.
- Evidence: diagnostic.0001, profile.style.0001
- Attributes:
  - slideCount: 31 slides (diagnostic.0001)
  - master: single-master deck architecture count=1 (diagnostic.0001, profile.style.0001)
  - layout: multi-layout briefing system layoutCount=62 (diagnostic.0001, profile.style.0001)

### deck-slide-size / deck / page
- Rule: Use a widescreen presentation canvas unless downstream constraints require otherwise.
- Detail: Set slide size to 16:9 widescreen as the default executable PPTX briefing page model; if exact dimensions are required, use 13.333 x 7.5 inches. This is a standard-default because the probe did not expose exact slide dimensions.
- Evidence: profile.style.0004, diagnostic.0001
- Attributes:
  - slideSize: 16:9 widescreen; 13.333in x 7.5in default ratio/in (profile.style.0004)

### theme-office-cue / theme / typography
- Rule: Base visual styling on the detected Office-theme family, with restrained document-like typography.
- Detail: Use the detected theme only as a style cue. Prefer Chinese official-document typography defaults: title in a strong Song-style display face, primary headings in bold Hei-style, body in FangSong/Song fallback. Do not infer exact font names from the probe.
- Evidence: profile.style.0002, profile.style.0004
- Attributes:
  - theme: Office-theme-derived, not exact-copy theme (profile.style.0004)
  - titleFont: FZ XiaoBiaoSong or SimSun fallback font-family (profile.style.0002)
  - bodyFont: FangSong_GB2312, SimFang, or SimSun fallback font-family (profile.style.0002)

### theme-color-count / theme / hierarchy
- Rule: Keep a compact theme system with no more than three coordinated color schemes.
- Detail: Because the probe found three color schemes, generated rules should support a primary, secondary, and accent palette while avoiding uncontrolled color expansion.
- Evidence: profile.style.0003, profile.style.0004
- Attributes:
  - theme: 3 coordinated color schemes maximum schemes (profile.style.0003)

### layout-master-discipline / layout / alignment
- Rule: Use one master-level grid and assign each slide to a reusable layout archetype.
- Detail: Define reusable archetypes for cover, section divider, title-and-body, multi-card content, picture-plus-text, statistic, and summary slides. Keep margins and title positions consistent across archetypes.
- Evidence: diagnostic.0001, profile.structure.0002, profile.structure.0008, profile.structure.0011, profile.structure.0019
- Attributes:
  - master: 1 shared master grid master (diagnostic.0001)
  - layout: cover|divider|content|multi-card|image-text|statistic|summary layout-archetype (profile.structure.0002, profile.structure.0008, profile.structure.0011, profile.structure.0019)
  - placeholder: title, subtitle, body, image, metric, keyword placeholder-role (profile.structure.0001, profile.structure.0003, profile.structure.0013, profile.structure.0020)

### layout-margins-grid / layout / spacing
- Rule: Apply a formal grid with clear margins and non-overlapping content zones.
- Detail: Use approximately 6-8 percent slide-width side margins, 8-10 percent top title zone, and a consistent content region below the title. Align repeated cards, icons, and pictures to the same grid columns.
- Evidence: profile.style.0001, profile.structure.0006, profile.structure.0011
- Attributes:
  - spacing: side margins 6-8%, title zone 8-10%, inter-card gap 2-3% percent-of-slide (profile.style.0001)
  - layout: grid-aligned content zones grid (profile.structure.0006, profile.structure.0011)

### cover-slide-fields / cover-slide / hierarchy
- Rule: The cover slide must contain a main briefing title and one subordinate metadata line when available.
- Detail: Use a large centered or upper-middle title, with presenter, organization, date, or occasion as smaller metadata. Source placeholder or sample identity text must not be reused.
- Evidence: raw.pptx.slide.0001, profile.structure.0001
- Attributes:
  - titleFont: display Song-style, bold or semi-bold font-family (profile.style.0002)
  - fontSizePt: 34-44 pt (raw.pptx.slide.0001)
  - placeholder: mainTitle, metadataLine role (profile.structure.0001)
  - spacing: metadata separated from title by 18-30 pt pt (raw.pptx.slide.0001)

### content-slide-title / content-slide / typography
- Rule: Every standard content slide should use a concise title above the body region.
- Detail: Use one short title per slide. For GB/T-like hierarchy, title text should be visually dominant but not oversized relative to the body; recommended range is 24-32 pt.
- Evidence: profile.structure.0002, profile.structure.0004, profile.structure.0009, profile.structure.0014
- Attributes:
  - titleFont: Hei-style or Song-style heading font-family (profile.style.0002)
  - fontSizePt: 24-32 pt (profile.structure.0002)
  - placeholder: slideTitle role (profile.structure.0002, profile.structure.0004, profile.structure.0009)

### content-slide-body / content-slide / density
- Rule: Keep each content slide focused on one subject with either three to five text points or one primary visual explanation.
- Detail: The evidence shows repeated title/body groups and picture-plus-text slides. Generated slides should avoid crowding by limiting body groups and reserving space for charts, pictures, or metrics when used.
- Evidence: profile.structure.0002, profile.structure.0008, profile.structure.0016, profile.structure.0019
- Attributes:
  - bodyFont: FangSong/Song fallback font-family (profile.style.0002)
  - fontSizePt: 16-22 pt (profile.structure.0002, profile.structure.0008)
  - density: 3-5 body points or 1 primary visual per slide items (profile.structure.0002, profile.structure.0019)
  - placeholder: bodyText, visual, caption role (profile.structure.0008, profile.structure.0016)

### bullet-hierarchy / bullet / numbering
- Rule: Use shallow bullet hierarchy: primary bullets for key points and optional secondary bullets only for clarification.
- Detail: Avoid deep nesting. Primary bullets should align under the body text box; secondary bullets should indent consistently and use smaller type.
- Evidence: profile.structure.0009, profile.structure.0014, profile.structure.0018
- Attributes:
  - bulletLevel: level 1 primary; level 2 optional; no level 3 by default level (profile.structure.0009, profile.structure.0014)
  - spacing: primary line spacing 1.15-1.3; paragraph gap 4-8 pt ratio/pt (profile.structure.0018)
  - fontSizePt: 16-20 primary; 14-18 secondary pt (profile.structure.0009)

### section-divider / content-slide / hierarchy
- Rule: Use sparse divider slides to separate major sections.
- Detail: Slides with a single text element indicate a sparse transition pattern. Divider slides should contain only the section title or short label, centered or strongly aligned to the master grid.
- Evidence: raw.pptx.slide.0007, raw.pptx.slide.0015, profile.structure.0007, profile.structure.0015
- Attributes:
  - layout: section-divider layout-archetype (profile.structure.0007, profile.structure.0015)
  - density: 1 text element preferred text-box-count (raw.pptx.slide.0007, raw.pptx.slide.0015)
  - placeholder: sectionTitle role (profile.structure.0007)

### picture-text-layout / layout / alignment
- Rule: For slides with pictures, pair visuals with adjacent explanatory text and maintain equal visual weight.
- Detail: The sample includes picture-bearing slides with multiple text areas. Use image placeholders as evidence-backed layout roles, but do not infer exact images or positions.
- Evidence: profile.structure.0002, profile.structure.0008, profile.structure.0016, profile.structure.0019
- Attributes:
  - placeholder: image, imageCaption, adjacentBody role (profile.structure.0002, profile.structure.0019)
  - layout: image-text split or three-card visual row layout-archetype (profile.structure.0008, profile.structure.0019)
  - spacing: image-text gutter 18-30 pt pt (profile.structure.0016)

### visual-density-control / visual-density / density
- Rule: Classify slide density by text, shape, and picture counts, then simplify overcrowded slides before rendering.
- Detail: Low density is 1-4 text boxes and fewer than 8 shapes; medium density is 5-10 text boxes or 8-20 shapes; high density is more than 10 text boxes or more than 20 shapes. High-density slides should be split or converted to diagrammatic groupings.
- Evidence: profile.structure.0006, profile.structure.0011, profile.structure.0014, profile.structure.0020
- Attributes:
  - density: low: <=4 text and <8 shapes; medium: 5-10 text or 8-20 shapes; high: >10 text or >20 shapes count-threshold (profile.structure.0006, profile.structure.0011, profile.structure.0020)

### keyword-card-layout / content-slide / hierarchy
- Rule: When using keyword or concept cards, keep labels short and visually parallel.
- Detail: Slides with repeated keyword-like labels indicate a card or concept grouping pattern. Each card should contain one label plus optional concise support text.
- Evidence: raw.pptx.slide.0013, raw.pptx.slide.0020, profile.structure.0013, profile.structure.0020
- Attributes:
  - layout: keyword-card grid layout-archetype (profile.structure.0013, profile.structure.0020)
  - placeholder: keywordLabel, supportText role (profile.structure.0013)
  - density: 4-6 cards per slide preferred cards (raw.pptx.slide.0013, raw.pptx.slide.0020)

### statistic-treatment / content-slide / typography
- Rule: Render isolated metrics as large numeric callouts with a nearby explanatory label.
- Detail: The source includes at least one metric-like text item, so numerical facts should be styled as emphasis elements rather than buried in paragraphs.
- Evidence: raw.pptx.slide.0003, profile.structure.0003
- Attributes:
  - fontSizePt: 36-54 for metric callout; 14-18 for label pt (profile.structure.0003)
  - placeholder: metricValue, metricLabel role (raw.pptx.slide.0003)
  - density: 1-3 metrics per slide metrics (profile.structure.0003)

### table-policy / content-slide / table
- Rule: Do not default to tables unless the user content requires comparison or structured data.
- Detail: The probe found no tables in the sampled structure, so tables should be introduced only for genuine tabular content and kept simple.
- Evidence: profile.style.0001, diagnostic.0001
- Attributes:
  - layout: table optional, not default policy (profile.style.0001)
  - density: maximum 5 columns and 6 rows for readability cells (diagnostic.0001)

### boundary-pptx-reference-only / boundary / boundary
- Rule: Treat PPTX evidence as reference material only.
- Detail: This rule system may guide structure, hierarchy, density, and typography defaults, but must not assert finished PPTX generation or exact source-template reproduction.
- Evidence: diagnostic.0002
- Attributes:
  - boundary: reference-only; no exact recreation claim constraint (diagnostic.0002)
