# FormatRuleSpec Synthesis: docx-policy

- Type: docx
- Mode: real-llm
- Evaluation: pass
- Granularity: 100

## Boundaries
- Do not treat extracted body text as reusable template content; use only structural and formatting signals.
- Do not promise exact recreation, export fidelity, visual restoration, or source-document identity preservation.
- When detected values conflict with GB/T-like defaults, prefer explicit confidence labels and allow manual review.
- Detected page margins are anomalous and must be treated as weak diagnostic evidence rather than a reliable source value.
- Long decimal-numbered paragraphs that contain full sentences are list/body items, not headings, unless separately marked by hierarchy.

## Rules
### page-a4-portrait / page / page
- Rule: Use A4 portrait page geometry for formal policy documents.
- Detail: Set page size to approximately 210 mm by 297 mm in portrait orientation when DOCX dimensions are close to A4.
- Evidence: profile.style.0001
- Attributes:
  - pageSize: A4 portrait, 210mm x 297mm mm (profile.style.0001)

### page-margins-gbt-like / page / page
- Rule: Use GB/T-like government-document margins when detected margins are unreliable.
- Detail: Apply top 37 mm, bottom 35 mm, left 28 mm, and right 26 mm as a conservative formal-document default; flag the result for review because the probe margins are near-zero twips.
- Evidence: profile.style.0001, diagnostic.0002
- Attributes:
  - margin: top 37, bottom 35, left 28, right 26 mm (profile.style.0001, diagnostic.0002)

### title-standalone-centered / title / hierarchy
- Rule: Place the main title as a standalone centered paragraph before chapter content.
- Detail: The title should be visually distinct from body text, appear before the first chapter heading, and not share a paragraph with article or list content.
- Evidence: profile.style.0002, raw.docx.style.0015
- Attributes:
  - alignment: center keyword (profile.style.0002)
  - font: SimHei or GB/T-like title face font-family (raw.docx.style.0005, raw.docx.style.0015)
  - fontSizePt: 21.5 pt (raw.docx.style.0015)

### title-weight / title / typography
- Rule: Make the main title bold or otherwise heavier than body text.
- Detail: Use a title face or bold weight with larger size; do not infer title wording from the sample document.
- Evidence: profile.style.0002, raw.docx.style.0005, raw.docx.style.0015
- Attributes:
  - font: SimHei font-family (raw.docx.style.0005)
  - fontSizePt: 21.5 pt (raw.docx.style.0015)

### heading-chapter-pattern / heading / hierarchy
- Rule: Use chapter-level headings for major divisions.
- Detail: Recognize short Chinese chapter markers such as 第N章 as first-level headings; keep them separate from article paragraphs.
- Evidence: profile.style.0002, raw.docx.style.0018
- Attributes:
  - numbering: 第N章 pattern (profile.style.0002)
  - alignment: center keyword (profile.style.0002)
  - font: SimHei or bold body-compatible Chinese font font-family (raw.docx.style.0005, raw.docx.style.0018)
  - fontSizePt: 15.5 pt (raw.docx.style.0012)

### heading-article-pattern / heading / hierarchy
- Rule: Use article markers as second-level structural paragraphs, not automatic Word numbering.
- Detail: Recognize 第N条 as article-level labels embedded at the beginning of a paragraph; retain body style unless a distinct heading style is explicitly available.
- Evidence: raw.docx.style.0018, profile.style.0002
- Attributes:
  - numbering: 第N条 pattern (profile.style.0002)
  - font: FangSong for body-compatible article headings font-family (raw.docx.style.0018)
  - fontSizePt: 15.5 pt (raw.docx.style.0012)

### heading-demote-long-candidates / heading / boundary
- Rule: Demote long numeric candidates to list or body paragraphs.
- Detail: A paragraph beginning with a numeric marker is not a heading when it contains full sentence content or clause detail.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0017, raw.docx.paragraph.0024

### numbering-chinese-lists / numbering / numbering
- Rule: Support Chinese parenthesized list numbering below article paragraphs.
- Detail: Use full-width parenthesized Chinese numerals such as （一）, （二）, （三） for ordered subitems; implement as literal paragraph prefixes when no DOCX numbering definitions exist.
- Evidence: profile.style.0002, profile.style.0004
- Attributes:
  - numbering: （一）, （二）, （三） pattern (profile.style.0002, profile.style.0004)
  - indent: first-line 2 Chinese characters em (profile.style.0002)

### numbering-decimal-lists / numbering / numbering
- Rule: Support decimal list prefixes for detailed enumerations.
- Detail: Recognize N. and N、 prefixes as list markers; do not promote them to headings solely because they begin with numbers.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0007, raw.docx.paragraph.0017, raw.docx.paragraph.0025, profile.style.0004
- Attributes:
  - numbering: N. and N、 pattern (raw.docx.paragraph.0001, raw.docx.paragraph.0025, profile.style.0004)
  - indent: hanging indent aligned after marker layout-rule (raw.docx.paragraph.0001, raw.docx.paragraph.0025)

### numbering-no-docx-auto / numbering / numbering
- Rule: Do not require Word automatic numbering for this profile.
- Detail: Because numbering definitions are absent, executable formatting should preserve visible numbering tokens as paragraph text or generated prefixes.
- Evidence: profile.style.0004
- Attributes:
  - numbering: literal-prefix numbering implementation-mode (profile.style.0004)

### typography-body-font / typography / typography
- Rule: Use FangSong-style Chinese body typography for formal policy body text.
- Detail: BodyText style indicates FangSong with a formal-document body size; fallback Latin font may remain Arial or Times New Roman for ASCII segments.
- Evidence: raw.docx.style.0018, raw.docx.style.0001, raw.docx.style.0003
- Attributes:
  - font: FangSong for CJK body; Arial or Times New Roman for Latin fallback font-family (raw.docx.style.0018, raw.docx.style.0001, raw.docx.style.0003)
  - fontSizePt: 15.5 pt (raw.docx.style.0012)

### typography-common-sizes / typography / typography
- Rule: Use a constrained size scale for body, table, and title text.
- Detail: Prefer body around 15.5 pt, table text around 10 pt, common inline text around 10.5 pt or 9 pt when matching detected runs, and title around 21.5 pt.
- Evidence: raw.docx.style.0006, raw.docx.style.0007, raw.docx.style.0012, raw.docx.style.0015, raw.docx.style.0019
- Attributes:
  - fontSizePt: 15.5 body; 10 table; 21.5 title pt (raw.docx.style.0012, raw.docx.style.0015, raw.docx.style.0019)

### paragraph-body-default / paragraph / spacing
- Rule: Format normal body paragraphs as formal policy text with first-line indentation and stable line spacing.
- Detail: Use first-line indent of two Chinese characters, justified alignment, and fixed line spacing suitable for GB/T-like documents; keep paragraphs visually dense but readable.
- Evidence: raw.docx.style.0018, profile.style.0002, diagnostic.0001
- Attributes:
  - indent: first-line 2 Chinese characters em (raw.docx.style.0018, profile.style.0002)
  - alignment: justified keyword (profile.style.0002)
  - lineSpacing: 28 pt (raw.docx.style.0018, profile.style.0002)
  - paragraphSpacing: 0 before, 0 after pt (raw.docx.style.0018)

### paragraph-style-scope / paragraph / hierarchy
- Rule: Use BodyText as the dominant paragraph style for main document content.
- Detail: Most formal body, chapter, article, and list paragraphs should inherit a common body style unless they are inside tables.
- Evidence: raw.docx.style.0018, diagnostic.0001
- Attributes:
  - font: FangSong font-family (raw.docx.style.0018)
  - fontSizePt: 15.5 pt (raw.docx.style.0012)

### paragraph-density / paragraph / density
- Rule: Keep formal body text compact and continuous across clauses.
- Detail: Avoid excessive paragraph spacing; use punctuation and numbering to express structure rather than adding large vertical gaps.
- Evidence: diagnostic.0001, raw.docx.style.0018
- Attributes:
  - paragraphSpacing: minimal; normally 0 pt before and after body paragraphs pt (raw.docx.style.0018, diagnostic.0001)

### table-presence / table / table
- Rule: Support multiple formal tables within the document body.
- Detail: Use table formatting for approval matrices, thresholds, responsibilities, or process comparisons; preserve table paragraphs separately from body paragraphs.
- Evidence: diagnostic.0001, raw.docx.style.0017, raw.docx.style.0019
- Attributes:
  - tableHeader: repeat header row when table spans pages; use centered bold header text when header role is known table-rule (raw.docx.style.0017, raw.docx.style.0019)
  - font: FangSong font-family (raw.docx.style.0019)
  - fontSizePt: 10 pt (raw.docx.style.0019)

### table-text-style / table / typography
- Rule: Use a smaller table text style than body paragraphs.
- Detail: Table cell text should use TableText-like typography, with compact size and controlled wrapping; keep numeric thresholds and approval labels readable.
- Evidence: raw.docx.style.0019, raw.docx.paragraph.0015, raw.docx.paragraph.0016
- Attributes:
  - font: FangSong font-family (raw.docx.style.0019)
  - fontSizePt: 10 pt (raw.docx.style.0019)
  - alignment: center or left according to cell role keyword (raw.docx.style.0019, raw.docx.paragraph.0015, raw.docx.paragraph.0016)
  - paragraphSpacing: 0 before, 0 after inside cells pt (raw.docx.style.0019)

### table-borders / table / table
- Rule: Use visible grid borders for formal tables unless a template specifies otherwise.
- Detail: Apply single-line borders around cells and fit table width within page margins; avoid decorative table styling.
- Evidence: diagnostic.0001, raw.docx.style.0017
- Attributes:
  - tableHeader: plain bordered header row table-rule (raw.docx.style.0017, diagnostic.0001)

### boundary-evidence-limits / boundary / boundary
- Rule: Treat this synthesis as executable guidance with medium confidence, not as a source-faithful reconstruction.
- Detail: The probe reports basic extraction only, no numbering definitions, limited styles, and an adaptation-mode diagnostic; downstream use should expose low-confidence fields for review.
- Evidence: profile.style.0004, diagnostic.0001, diagnostic.0002

### boundary-content-reuse / boundary / boundary
- Rule: Do not reuse source body wording in generated rules or templates.
- Detail: Only structural patterns, style names, size distributions, and document-kind signals are reusable formatting evidence.
- Evidence: diagnostic.0002

### boundary-heading-conflict / boundary / boundary
- Rule: Resolve heading/list ambiguity by length and semantic role.
- Detail: A short chapter or article marker may define hierarchy; a long numeric paragraph containing detailed subject matter should remain body or list content.
- Evidence: raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0025, raw.docx.paragraph.0028
