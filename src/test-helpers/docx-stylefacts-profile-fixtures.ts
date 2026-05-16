import type { FormatProfileRecord } from "@/lib/format-profile-types"
import type { StyleFact, StyleFactsEnvelope } from "@/lib/style-facts"

export const DOCX_STYLEFACTS_POISON = "POISON_STYLEFACTS_VALUE_SHOULD_NOT_LEAK"

function fact<T>(value: T, evidenceRefs: string[]): StyleFact<T> {
  return { value, confidence: "high", evidenceRefs }
}

export function createDocxStyleFactsEnvelope(options: {
  titleFont: string
  titleSizePt: number
  headingFont?: string
  headingSizePt?: number
  bodyFont: string
  bodySizePt: number
  bodyStyleSizePt?: number
  pageSizeTwips?: { widthTwips: number | string; heightTwips: number | string }
  marginsTwips?: { top: number | string; right: number | string; bottom: number | string; left: number | string; header?: number | string; footer?: number | string }
  titleLineSpacingTwips?: number | string
  headingLineSpacingTwips?: number | string
  bodyLineSpacingTwips?: number | string
  poison?: string
  poisonEvidenceRef?: string
}): StyleFactsEnvelope {
  const styleDefRef = "style.docx.styleDef.0001"
  const fontRef = "style.docx.fontUsage.0001"
  const sizeRef = "style.docx.fontSize.0001"
  const paraRef = "style.docx.paragraphStyleUsage.0001"
  const layoutRef = "style.docx.layout.0001"
  const headingFont = options.headingFont ?? "黑体"
  const headingSizePt = options.headingSizePt ?? 16
  return {
    schemaVersion: "format-profile-style-facts.v0",
    source: { fileType: "docx", sourceName: "fixture.docx" },
    parser: {
      deterministic: true,
      authority: "deterministic-parser",
      evidenceAuthority: "parser-generated",
    },
    capabilities: {
      canGuideGeneration: true,
      canGuideAdaptation: true,
      canGuideExport: false,
      highFidelityScope: "fixture-backed deterministic parser fidelity for covered style fields; DOCX may use covered fields as limited writer attributes; not template replay, visual parity, or broad export reproduction",
      llmMayInterpret: true,
      llmMayCreateFacts: false,
    },
    styleFacts: {
      layout: {
        pageSizeTwips: fact(options.pageSizeTwips ?? { widthTwips: 11906, heightTwips: 16838 }, [layoutRef]),
        marginsTwips: fact(options.marginsTwips ?? { top: 1440, right: 1440, bottom: 1440, left: 1440 }, [layoutRef]),
      },
      typography: {
        fontUsage: fact([
          { value: options.bodyFont, count: 80 },
          { value: options.titleFont, count: 2 },
        ], [fontRef, ...(options.poisonEvidenceRef ? [options.poisonEvidenceRef] : [])]),
        fontSizeUsagePt: fact([
          { value: options.bodySizePt, count: 80 },
          { value: options.titleSizePt, count: 2 },
        ], [sizeRef]),
      },
      styles: {
        definitions: fact([
          {
            styleId: "Heading1",
            name: "heading 1",
            type: "paragraph",
            outlineLevel: "0",
            fonts: [options.titleFont],
            fontSizesHalfPoints: [String(options.titleSizePt * 2)],
            spacing: options.titleLineSpacingTwips ? { lineTwips: options.titleLineSpacingTwips } : undefined,
            hasBold: true,
          },
          {
            styleId: "Level1",
            name: "level 1",
            type: "paragraph",
            outlineLevel: "0",
            fonts: [headingFont],
            fontSizesHalfPoints: [String(headingSizePt * 2)],
            spacing: options.headingLineSpacingTwips ? { lineTwips: options.headingLineSpacingTwips } : undefined,
            hasBold: true,
          },
          {
            styleId: "BodyText",
            name: "Body Text",
            type: "paragraph",
            fonts: [options.bodyFont],
            fontSizesHalfPoints: [String((options.bodyStyleSizePt ?? options.bodySizePt) * 2)],
            spacing: options.bodyLineSpacingTwips ? { lineTwips: options.bodyLineSpacingTwips } : undefined,
          },
        ], [styleDefRef, ...(options.poisonEvidenceRef ? [options.poisonEvidenceRef] : [])]),
        paragraphStyleUsage: fact([{ value: "BodyText", count: 40 }], [paraRef]),
      },
    },
    evidence: [
      { id: styleDefRef, kind: "openxml-docx-style-definitions", pointer: "probe.style.styles", confidence: "high", sha256: "style-def", value: { poison: options.poison ?? DOCX_STYLEFACTS_POISON } },
      { id: fontRef, kind: "openxml-docx-fonts", pointer: "probe.style.fonts/fontUsage", confidence: "high", sha256: "font-usage", value: { poison: options.poison ?? DOCX_STYLEFACTS_POISON } },
      { id: sizeRef, kind: "openxml-docx-font-sizes", pointer: "probe.style.fontSizeUsageHalfPoints", confidence: "high", sha256: "font-size", value: { poison: options.poison ?? DOCX_STYLEFACTS_POISON } },
      { id: paraRef, kind: "openxml-docx-paragraph-style-usage", pointer: "probe.structure.paragraphStyleUsage", confidence: "high", sha256: "para-style", value: { poison: options.poison ?? DOCX_STYLEFACTS_POISON } },
      { id: layoutRef, kind: "openxml-docx-page", pointer: "probe.style.page", confidence: "high", sha256: "layout", value: { poison: options.poison ?? DOCX_STYLEFACTS_POISON } },
    ],
    diagnostics: [],
    metadata: { styleFactsSha256: "stylefacts-fixture", builtAt: 1 },
  }
}

export function createDocxStyleFactsProfile(options: Parameters<typeof createDocxStyleFactsEnvelope>[0]): FormatProfileRecord {
  const styleFacts = createDocxStyleFactsEnvelope(options)
  return {
    id: `profile-${options.titleFont}-${options.bodyFont}`,
    title: "DOCX StyleFacts fixture",
    sourceName: "fixture.docx",
    fileType: "docx",
    sourceKind: "finished-file",
    documentKind: "formal-document",
    confidence: "high",
    importedAt: 1,
    updatedAt: 1,
    structureProfile: {
      sectionPattern: "numbered-sections",
      sections: [],
      evidenceSummary: [],
    },
    styleProfile: {
      toneHints: [],
      layoutHints: [],
      confidence: "high",
      typography: {},
      layout: {},
      formatSpecific: {},
      evidenceSummary: [],
    },
    styleFacts,
    writingProfile: {
      generationInstruction: "",
      constraints: [],
    },
    diagnostics: [],
    textSample: options.poison ?? DOCX_STYLEFACTS_POISON,
  }
}
