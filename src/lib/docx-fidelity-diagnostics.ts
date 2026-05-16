import JSZip from "jszip"

import { containsForbiddenDocxExportLeakage } from "@/lib/docx-export-contract"
import type { DocxIntermediateDocument } from "@/lib/docx-intermediate"
import type { DocxFormatDimension } from "@/lib/docx-format-style"
import type { DraftProcessingFormatProfileSnapshot, FormatSpecRule } from "@/lib/format-profile-types"
import { sha256Stable, type StyleFactsEnvelope } from "@/lib/style-facts"

export const DOCX_FIDELITY_DIAGNOSTICS_VERSION = "docx-fidelity-diagnostics.v0" as const

export type DocxFidelityBucket = "restored" | "partial" | "missing" | "unverified"

export interface DocxFidelitySourceInventoryItem {
  ruleId: string
  target: string
  normType?: string
  confidence: string
  evidenceRefs: string[]
  attributeCount: number
  attributeNames: string[]
  attributeValues: Record<string, string>
  availability: "rule-only" | "rule-with-attributes" | "explicit-source-style-facts"
  dimension: string
}

export interface DocxFidelityExportedFacts {
  packagePartCount: number
  hasDocumentXml: boolean
  hasStylesXml: boolean
  hasNumberingXml: boolean
  documentHash?: string
  stylesHash?: string
  numberingHash?: string
  blockCounts: {
    titleStyleRefs: number
    headingStyleRefs: number
    paragraphCount: number
    listParagraphs: number
    tableCount: number
    tableRowCount: number
    tableCellCount: number
    indentationCount: number
  }
  styleFacts: {
    fonts: string[]
    fontSizesHalfPoints: string[]
    alignments: string[]
    marginTwips: string[]
    spacingCount: number
    hasDecimalNumbering: boolean
    hasBulletNumbering: boolean
  }
  paragraphFacts: Array<{
    index: number
    text: string
    pStyle?: string
    hasNumPr: boolean
    numId?: string
    ilvl?: string
    spacing?: { line?: string; lineRule?: string }
  }>
  styleSpacingFacts: Array<{
    styleId: string
    spacing?: { line?: string; lineRule?: string }
  }>
  pgMarFacts?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
    header?: string
    footer?: string
  }
  bucketInputs: Array<{
    dimension: string
    expected?: string
    observed?: string
    matched: boolean
    reason: string
  }>
}

export interface DocxFidelityCoverageItem {
  id: string
  dimension: string
  bucket: DocxFidelityBucket
  sourceRuleIds: string[]
  expectedAttributeNames: string[]
  exportedEvidenceRefs: string[]
  reason: string
}

export interface DocxFidelityGap {
  id: string
  dimension: string
  bucket: Exclude<DocxFidelityBucket, "restored">
  sourceRuleIds: string[]
  reason: string
}

export interface DocxFidelityDiagnosticsReport {
  schemaVersion: typeof DOCX_FIDELITY_DIAGNOSTICS_VERSION
  reportHash: string
  formatSpecHash?: string
  sourceInventory: DocxFidelitySourceInventoryItem[]
  exportedFacts: DocxFidelityExportedFacts
  coverage: DocxFidelityCoverageItem[]
  gaps: DocxFidelityGap[]
  summary: Record<DocxFidelityBucket, number>
  e2PriorityGaps: DocxFidelityGap[]
  limitations: {
    notWordWpsParityValidated: true
    noManualTemplateRoute: true
    notFullFidelityClaim: true
  }
}

export interface BuildDocxFidelityDiagnosticsInput {
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
  intermediate: DocxIntermediateDocument
  bytes: Uint8Array | ArrayBuffer | Blob
  sourceStyleFacts?: StyleFactsEnvelope
}

async function toArrayBuffer(input: Uint8Array | ArrayBuffer | Blob): Promise<ArrayBuffer> {
  if (input instanceof Blob) return input.arrayBuffer()
  if (input instanceof Uint8Array) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
  return input
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

function matchAllValues(value: string, pattern: RegExp): string[] {
  return [...value.matchAll(pattern)].flatMap((match) => match.slice(1).filter(Boolean))
}

function countRegex(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1]
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function spacingFact(xml: string): { line?: string; lineRule?: string } | undefined {
  const spacing = xml.match(/<w:spacing\b[^>]*>/)?.[0]
  if (!spacing) return undefined
  const line = firstMatch(spacing, /w:line="([^"]+)"/)
  const lineRule = firstMatch(spacing, /w:lineRule="([^"]+)"/)
  return line || lineRule ? { ...(line ? { line } : {}), ...(lineRule ? { lineRule } : {}) } : undefined
}

function extractParagraphFacts(documentXml: string): DocxFidelityExportedFacts["paragraphFacts"] {
  return [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match, index) => {
    const xml = match[0]
    const text = decodeXmlText([...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((item) => item[1]).join("")).slice(0, 160)
    const numPr = xml.match(/<w:numPr>[\s\S]*?<\/w:numPr>/)?.[0] ?? ""
    return {
      index,
      text,
      ...(firstMatch(xml, /<w:pStyle[^>]+w:val="([^"]+)"/) ? { pStyle: firstMatch(xml, /<w:pStyle[^>]+w:val="([^"]+)"/) } : {}),
      hasNumPr: Boolean(numPr),
      ...(firstMatch(numPr, /<w:numId[^>]+w:val="([^"]+)"/) ? { numId: firstMatch(numPr, /<w:numId[^>]+w:val="([^"]+)"/) } : {}),
      ...(firstMatch(numPr, /<w:ilvl[^>]+w:val="([^"]+)"/) ? { ilvl: firstMatch(numPr, /<w:ilvl[^>]+w:val="([^"]+)"/) } : {}),
      ...(spacingFact(xml) ? { spacing: spacingFact(xml) } : {}),
    }
  }).filter((item) => item.text || item.pStyle || item.hasNumPr)
}

function extractStyleSpacingFacts(stylesXml: string): DocxFidelityExportedFacts["styleSpacingFacts"] {
  return [...stylesXml.matchAll(/<w:style\b[\s\S]*?<\/w:style>/g)].map((match) => {
    const xml = match[0]
    const styleId = firstMatch(xml, /w:styleId="([^"]+)"/) ?? ""
    return { styleId, ...(spacingFact(xml) ? { spacing: spacingFact(xml) } : {}) }
  }).filter((item) => item.styleId && item.spacing)
}

function extractPgMarFacts(documentXml: string): DocxFidelityExportedFacts["pgMarFacts"] {
  const pgMar = documentXml.match(/<w:pgMar\b[^>]*>/)?.[0]
  if (!pgMar) return undefined
  const out = {
    top: firstMatch(pgMar, /w:top="([^"]+)"/),
    right: firstMatch(pgMar, /w:right="([^"]+)"/),
    bottom: firstMatch(pgMar, /w:bottom="([^"]+)"/),
    left: firstMatch(pgMar, /w:left="([^"]+)"/),
    header: firstMatch(pgMar, /w:header="([^"]+)"/),
    footer: firstMatch(pgMar, /w:footer="([^"]+)"/),
  }
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined)) as DocxFidelityExportedFacts["pgMarFacts"]
}

const STYLE_ID_BY_DIMENSION: Record<string, string> = {
  "title.main": "Title",
  "heading.level1": "Heading1",
  "heading.level2": "Heading2",
  "heading.level3": "Heading2",
  "paragraph.body": "Normal",
}

const PAGE_MARGIN_ATTRS = [
  ["marginTopTwips", "top"],
  ["marginRightTwips", "right"],
  ["marginBottomTwips", "bottom"],
  ["marginLeftTwips", "left"],
  ["headerDistanceTwips", "header"],
  ["footerDistanceTwips", "footer"],
] as const

function expectedAttr(sourceItems: DocxFidelitySourceInventoryItem[], name: string): string | undefined {
  for (const item of sourceItems) {
    const value = item.attributeValues[name]
    if (value !== undefined && value !== "") return String(value)
  }
  return undefined
}

function styleSpacingLine(facts: DocxFidelityExportedFacts, styleId: string | undefined): string | undefined {
  if (!styleId) return undefined
  return facts.styleSpacingFacts.find((item) => item.styleId === styleId)?.spacing?.line
}

function buildBucketInputs(
  sourceByDimension: Map<string, DocxFidelitySourceInventoryItem[]>,
  facts: DocxFidelityExportedFacts,
  intermediate: DocxIntermediateDocument,
): DocxFidelityExportedFacts["bucketInputs"] {
  const inputs: DocxFidelityExportedFacts["bucketInputs"] = []
  for (const [dimension, styleId] of Object.entries(STYLE_ID_BY_DIMENSION)) {
    const sourceItems = sourceByDimension.get(dimension) ?? []
    const expected = expectedAttr(sourceItems, "lineSpacingTwips")
    if (!expected) continue
    const observed = styleSpacingLine(facts, styleId)
    inputs.push({
      dimension,
      expected,
      ...(observed ? { observed } : {}),
      matched: observed === expected,
      reason: observed === expected ? `${dimension}-line-spacing-matched` : `${dimension}-line-spacing-mismatch`,
    })
  }

  const pageItems = [
    ...(sourceByDimension.get("page.margin") ?? []),
    ...(sourceByDimension.get("page") ?? []),
  ]
  for (const [attrName, pgMarName] of PAGE_MARGIN_ATTRS) {
    const expected = expectedAttr(pageItems, attrName)
    if (!expected) continue
    const observed = facts.pgMarFacts?.[pgMarName]
    inputs.push({
      dimension: "page.margin",
      expected,
      ...(observed ? { observed } : {}),
      matched: observed === expected,
      reason: observed === expected ? `page-margin-${pgMarName}-matched` : `page-margin-${pgMarName}-mismatch`,
    })
  }

  const expectedNumberedParagraphs = intermediate.blocks
    .filter((block): block is Extract<DocxIntermediateDocument["blocks"][number], { type: "list" }> => block.type === "list")
    .filter((block) => block.autoNumberingIntent === "auto-list" || block.autoNumberingIntent === "recovered-bare-list")
    .reduce((sum, block) => sum + block.items.length, 0)
  const observedNumberedParagraphs = facts.paragraphFacts.filter((paragraph) => paragraph.hasNumPr).length
  if (expectedNumberedParagraphs > 0 || observedNumberedParagraphs > 0) {
    inputs.push({
      dimension: "list.numbering",
      expected: String(expectedNumberedParagraphs),
      observed: String(observedNumberedParagraphs),
      matched: expectedNumberedParagraphs === observedNumberedParagraphs,
      reason: expectedNumberedParagraphs === observedNumberedParagraphs ? "auto-numbering-count-matched" : "auto-numbering-count-mismatch",
    })
  }

  return inputs
}

function tokenText(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase().replace(/[_\s]/g, "-")
}

function inferDimension(rule: Pick<FormatSpecRule, "id" | "target" | "normType" | "dimension" | "attributes">): string {
  if (rule.dimension) return rule.dimension
  const attrNames = (rule.attributes ?? []).map((attr) => attr.name.toLowerCase()).join(" ")
  const tokens = `${tokenText(rule.id, rule.target, rule.normType)} ${attrNames}`
  if (tokens.includes("document-title") || tokens.includes("main-title")) return "document-title"
  if (tokens.includes("subsection") || tokens.includes("section-title") || tokens.includes("heading")) return "heading"
  if (tokens.includes("unordered-list") || tokens.includes("bullet")) return "unordered-list"
  if (tokens.includes("ordered-list") || tokens.includes("numbered") || tokens.includes("numbering")) return "ordered-list"
  if (tokens.includes("list")) return "list"
  if (tokens.includes("table")) return "table"
  if (tokens.includes("margin") || tokens.includes("page")) return "page"
  if (tokens.includes("spacing") || tokens.includes("indent") || tokens.includes("line-height")) return "spacing"
  if (tokens.includes("font") || tokens.includes("size") || tokens.includes("typography")) return "typography"
  if (tokens.includes("paragraph") || tokens.includes("body")) return "paragraph"
  return "unclassified"
}

function buildSourceInventory(
  rules: FormatSpecRule[],
  sourceStyleFacts?: StyleFactsEnvelope,
): DocxFidelitySourceInventoryItem[] {
  const hasExplicitStyleFacts = Boolean(sourceStyleFacts)
  return rules.map((rule) => {
    const attributeNames = uniqueSorted((rule.attributes ?? []).map((attr) => attr.name))
    const attributeValues = Object.fromEntries((rule.attributes ?? []).map((attr) => [attr.name, attr.value]))
    return {
      ruleId: rule.id,
      target: rule.target,
      ...(rule.normType ? { normType: rule.normType } : {}),
      confidence: rule.confidence,
      evidenceRefs: [...(rule.evidenceRefs ?? [])],
      attributeCount: rule.attributes?.length ?? 0,
      attributeNames,
      attributeValues,
      availability: hasExplicitStyleFacts
        ? "explicit-source-style-facts"
        : attributeNames.length > 0 ? "rule-with-attributes" : "rule-only",
      dimension: inferDimension(rule),
    }
  })
}

async function extractExportedFacts(bytesInput: Uint8Array | ArrayBuffer | Blob): Promise<DocxFidelityExportedFacts> {
  const bytes = await toArrayBuffer(bytesInput)
  const zip = await JSZip.loadAsync(bytes)
  const packageParts = Object.keys(zip.files).filter((part) => !zip.files[part].dir).sort()
  const documentXml = await zip.file("word/document.xml")?.async("string") ?? ""
  const stylesXml = await zip.file("word/styles.xml")?.async("string") ?? ""
  const numberingXml = await zip.file("word/numbering.xml")?.async("string") ?? ""
  const allXml = `${documentXml}\n${stylesXml}\n${numberingXml}`
  const pgMarFacts = extractPgMarFacts(documentXml)

  const fonts = uniqueSorted([
    ...matchAllValues(allXml, /w:ascii="([^"]+)"/g),
    ...matchAllValues(allXml, /w:eastAsia="([^"]+)"/g),
    ...matchAllValues(allXml, /w:hAnsi="([^"]+)"/g),
    ...matchAllValues(allXml, /w:cs="([^"]+)"/g),
  ])

  return {
    packagePartCount: packageParts.length,
    hasDocumentXml: Boolean(documentXml),
    hasStylesXml: Boolean(stylesXml),
    hasNumberingXml: Boolean(numberingXml),
    ...(documentXml ? { documentHash: sha256Stable(documentXml) } : {}),
    ...(stylesXml ? { stylesHash: sha256Stable(stylesXml) } : {}),
    ...(numberingXml ? { numberingHash: sha256Stable(numberingXml) } : {}),
    blockCounts: {
      titleStyleRefs: countRegex(documentXml, /<w:pStyle[^>]+w:val="Title"/g),
      headingStyleRefs: countRegex(documentXml, /<w:pStyle[^>]+w:val="Heading[12]"/g),
      paragraphCount: countRegex(documentXml, /<w:p[ >]/g),
      listParagraphs: countRegex(documentXml, /<w:numPr>/g),
      tableCount: countRegex(documentXml, /<w:tbl>/g),
      tableRowCount: countRegex(documentXml, /<w:tr>/g),
      tableCellCount: countRegex(documentXml, /<w:tc>/g),
      indentationCount: countRegex(documentXml + stylesXml, /<w:ind\b/g),
    },
    styleFacts: {
      fonts,
      fontSizesHalfPoints: uniqueSorted(matchAllValues(allXml, /<w:sz[^>]+w:val="([^"]+)"/g)),
      alignments: uniqueSorted(matchAllValues(documentXml, /<w:jc[^>]+w:val="([^"]+)"/g)),
      marginTwips: uniqueSorted(matchAllValues(documentXml, /<w:pgMar[^>]+(?:w:top|w:right|w:bottom|w:left)="([^"]+)"/g)),
      spacingCount: countRegex(documentXml + stylesXml, /<w:spacing\b/g),
      hasDecimalNumbering: /w:val="decimal"/.test(numberingXml),
      hasBulletNumbering: /w:val="bullet"/.test(numberingXml),
    },
    paragraphFacts: extractParagraphFacts(documentXml),
    styleSpacingFacts: extractStyleSpacingFacts(stylesXml),
    ...(pgMarFacts ? { pgMarFacts } : {}),
    bucketInputs: [],
  }
}

function coverageForDimension(
  dimension: string,
  sourceItems: DocxFidelitySourceInventoryItem[],
  facts: DocxFidelityExportedFacts,
  intermediate: DocxIntermediateDocument,
): DocxFidelityCoverageItem {
  const ruleIds = sourceItems.map((item) => item.ruleId)
  const expectedAttributeNames = uniqueSorted(sourceItems.flatMap((item) => item.attributeNames))
  const evidenceRefs: string[] = []
  let bucket: DocxFidelityBucket = "unverified"
  let reason = "source-or-exported-evidence-is-insufficient"
  const hasSourceExpectation = sourceItems.length > 0

  const hasSourceAttribute = expectedAttributeNames.length > 0
  const hasIntermediate = (type: string, predicate: (block: DocxIntermediateDocument["blocks"][number]) => boolean = () => true) => (
    intermediate.blocks.some((block) => block.type === type && predicate(block))
  )
  const hasIntermediateDimension = (expectedDimension: string) => (
    intermediate.blocks.some((block) => block.formatDimensions?.includes(expectedDimension as DocxFormatDimension))
  )
  const matchedInputs = facts.bucketInputs.filter((input) => input.dimension === dimension)
  const hasMatchedInput = matchedInputs.some((input) => input.matched)
  const hasMismatchedInput = matchedInputs.some((input) => !input.matched)

  if (dimension === "title.main") {
    const expected = hasIntermediate("documentTitle") || hasIntermediateDimension("title.main")
    const observed = facts.blockCounts.titleStyleRefs > 0
    const hasStyleEvidence = facts.styleFacts.fonts.length > 0 || facts.styleFacts.fontSizesHalfPoints.length > 0 || facts.styleFacts.alignments.includes("center")
    if (!hasSourceExpectation) {
      bucket = observed ? "unverified" : "unverified"
      reason = observed ? "exported-title-main-observed-without-source-expectation" : "title-main-source-expectation-missing"
      if (observed) evidenceRefs.push("export.document.title-style")
    } else if (expected && observed && hasMatchedInput) {
      bucket = "restored"; reason = "title-main-attribute-evidence-matched"; evidenceRefs.push("export.document.title-style", "export.styles.spacing")
    } else if (expected && observed && hasMismatchedInput) {
      bucket = "partial"; reason = "title-main-attribute-evidence-mismatch"; evidenceRefs.push("export.document.title-style", "export.styles.spacing")
    } else if (expected && observed && hasStyleEvidence) {
      bucket = "restored"; reason = "title-main-style-evidence-present"; evidenceRefs.push("export.document.title-style", "export.styles.typography")
    } else if (expected && observed) {
      bucket = "partial"; reason = "title-main-structure-present-but-style-evidence-incomplete"; evidenceRefs.push("export.document.title-style")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "title-main-expected-but-style-reference-missing"
    }
  } else if (dimension === "heading.level1" || dimension === "heading.level2" || dimension === "heading.level3") {
    const level = Number(dimension.slice("heading.level".length))
    const expected = hasIntermediate("heading", (block) => block.type === "heading" && block.level === level) || hasIntermediateDimension(dimension)
    const observed = facts.blockCounts.headingStyleRefs > 0
    const hasStyleEvidence = facts.styleFacts.fonts.length > 0 || facts.styleFacts.fontSizesHalfPoints.length > 0 || facts.styleFacts.spacingCount > 0
    if (!hasSourceExpectation) {
      bucket = observed ? "unverified" : "unverified"
      reason = observed ? `${dimension}-observed-without-source-expectation` : `${dimension}-source-expectation-missing`
      if (observed) evidenceRefs.push("export.document.heading-style")
    } else if (expected && observed && hasMatchedInput) {
      bucket = "restored"; reason = `${dimension}-attribute-evidence-matched`; evidenceRefs.push("export.document.heading-style", "export.styles.spacing")
    } else if (expected && observed && hasMismatchedInput) {
      bucket = "partial"; reason = `${dimension}-attribute-evidence-mismatch`; evidenceRefs.push("export.document.heading-style", "export.styles.spacing")
    } else if (expected && observed && hasStyleEvidence) {
      bucket = "restored"; reason = `${dimension}-style-evidence-present`; evidenceRefs.push("export.document.heading-style", "export.styles.typography")
    } else if (expected && observed) {
      bucket = "partial"; reason = `${dimension}-structure-present-but-style-evidence-incomplete`; evidenceRefs.push("export.document.heading-style")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = `${dimension}-expected-but-style-reference-missing`
    }
  } else if (dimension === "paragraph.body") {
    const expected = hasIntermediate("paragraph") || hasIntermediateDimension("paragraph.body")
    const hasStyleEvidence = facts.blockCounts.paragraphCount > 0 && (
      facts.styleFacts.fonts.length > 0 ||
      facts.styleFacts.fontSizesHalfPoints.length > 0 ||
      facts.styleFacts.spacingCount > 0 ||
      facts.blockCounts.indentationCount > 0
    )
    if (!hasSourceExpectation) {
      bucket = facts.blockCounts.paragraphCount > 0 ? "unverified" : "unverified"
      reason = facts.blockCounts.paragraphCount > 0 ? "exported-paragraph-body-observed-without-source-expectation" : "paragraph-body-source-expectation-missing"
      if (facts.blockCounts.paragraphCount > 0) evidenceRefs.push("export.document.paragraph-count")
    } else if (expected && hasMatchedInput) {
      bucket = "restored"; reason = "paragraph-body-attribute-evidence-matched"; evidenceRefs.push("export.document.paragraph-count", "export.styles.spacing")
    } else if (expected && hasMismatchedInput) {
      bucket = "partial"; reason = "paragraph-body-attribute-evidence-mismatch"; evidenceRefs.push("export.document.paragraph-count", "export.styles.spacing")
    } else if (expected && hasStyleEvidence) {
      bucket = "restored"; reason = "paragraph-body-style-evidence-present"; evidenceRefs.push("export.document.paragraph-count", "export.styles.spacing")
    } else if (expected && facts.blockCounts.paragraphCount > 0) {
      bucket = "partial"; reason = "paragraph-body-structure-present-but-style-evidence-incomplete"; evidenceRefs.push("export.document.paragraph-count")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "paragraph-body-expected-but-exported-evidence-missing"
    }
  } else if (dimension === "list.numbering") {
    const expected = hasIntermediate("list", (block) => block.type === "list" && block.ordered === true) || hasIntermediateDimension("list.numbering")
    if (!hasSourceExpectation) {
      bucket = facts.blockCounts.listParagraphs > 0 ? "unverified" : "unverified"
      reason = facts.blockCounts.listParagraphs > 0 ? "exported-list-numbering-observed-without-source-expectation" : "list-numbering-source-expectation-missing"
      if (facts.blockCounts.listParagraphs > 0) evidenceRefs.push("export.document.list-paragraphs")
    } else if (hasMismatchedInput) {
      bucket = "partial"; reason = "list-numbering-count-mismatch"; evidenceRefs.push("export.document.list-paragraphs")
    } else if (expected && facts.blockCounts.listParagraphs > 0 && facts.styleFacts.hasDecimalNumbering) {
      bucket = "restored"; reason = "list-numbering-decimal-present"; evidenceRefs.push("export.numbering.decimal")
    } else if (expected && facts.blockCounts.listParagraphs > 0) {
      bucket = "partial"; reason = "list-numbering-paragraphs-present-without-decimal-numbering"; evidenceRefs.push("export.document.list-paragraphs")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "list-numbering-expected-but-numbering-missing"
    }
  } else if (dimension === "table.readability") {
    const expected = hasIntermediate("table") || hasIntermediateDimension("table.readability")
    if (!hasSourceExpectation) {
      bucket = facts.blockCounts.tableCount > 0 ? "unverified" : "unverified"
      reason = facts.blockCounts.tableCount > 0 ? "exported-table-readability-observed-without-source-expectation" : "table-readability-source-expectation-missing"
      if (facts.blockCounts.tableCount > 0) evidenceRefs.push("export.document.table-shape")
    } else if (expected && facts.blockCounts.tableCount > 0 && facts.blockCounts.tableCellCount > 0) {
      bucket = "restored"; reason = "table-readability-structure-present"; evidenceRefs.push("export.document.table-shape")
    } else if (expected && facts.blockCounts.tableCount > 0) {
      bucket = "partial"; reason = "table-readability-present-but-shape-incomplete"; evidenceRefs.push("export.document.table-shape")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "table-readability-expected-but-not-exported"
    }
  } else if (dimension === "document-title") {
    const expected = hasIntermediate("documentTitle")
    const observed = facts.blockCounts.titleStyleRefs > 0
    if (!hasSourceExpectation) {
      bucket = observed ? "unverified" : "unverified"
      reason = observed ? "exported-document-title-observed-without-source-expectation" : "document-title-source-expectation-missing"
      if (observed) evidenceRefs.push("export.document.title-style")
    } else if (expected && observed) {
      bucket = "restored"; reason = "document-title-style-reference-present"; evidenceRefs.push("export.document.title-style")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "document-title-expected-but-style-reference-missing"
    }
  } else if (dimension === "heading") {
    const expected = hasIntermediate("heading")
    const observed = facts.blockCounts.headingStyleRefs > 0
    if (!hasSourceExpectation) {
      bucket = observed ? "unverified" : "unverified"
      reason = observed ? "exported-heading-observed-without-source-expectation" : "heading-source-expectation-missing"
      if (observed) evidenceRefs.push("export.document.heading-style")
    } else if (expected && observed) {
      bucket = "restored"; reason = "heading-style-references-present"; evidenceRefs.push("export.document.heading-style")
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "heading-expected-but-style-reference-missing"
    }
  } else if (dimension === "paragraph") {
    if (!hasSourceExpectation) {
      bucket = "unverified"
      reason = facts.blockCounts.paragraphCount > 0 ? "exported-paragraphs-observed-without-source-expectation" : "paragraph-source-expectation-missing"
      if (facts.blockCounts.paragraphCount > 0) evidenceRefs.push("export.document.paragraph-count")
    } else if (facts.blockCounts.paragraphCount > 0 && hasIntermediate("paragraph")) {
      bucket = "restored"; reason = "paragraph-structure-present"; evidenceRefs.push("export.document.paragraph-count")
    } else {
      bucket = "unverified"; reason = "paragraph-source-or-exported-evidence-insufficient"
    }
  } else if (dimension === "ordered-list") {
    const expected = hasIntermediate("list", (block) => block.type === "list" && block.ordered === true)
    if (!hasSourceExpectation) {
      bucket = facts.blockCounts.listParagraphs > 0 ? "unverified" : "unverified"
      reason = facts.blockCounts.listParagraphs > 0 ? "exported-ordered-list-observed-without-source-expectation" : "ordered-list-source-expectation-missing"
      if (facts.blockCounts.listParagraphs > 0) evidenceRefs.push("export.document.list-paragraphs")
    } else if (expected && facts.blockCounts.listParagraphs > 0 && facts.styleFacts.hasDecimalNumbering) {
      bucket = "restored"; reason = "ordered-numbering-present"; evidenceRefs.push("export.numbering.decimal")
    } else if (expected && facts.blockCounts.listParagraphs > 0) {
      bucket = "partial"; reason = "list-paragraphs-present-without-decimal-numbering"
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "ordered-list-expected-but-numbering-missing"
    }
  } else if (dimension === "unordered-list") {
    const expected = hasIntermediate("list", (block) => block.type === "list" && block.ordered === false)
    if (!hasSourceExpectation) {
      bucket = facts.blockCounts.listParagraphs > 0 ? "unverified" : "unverified"
      reason = facts.blockCounts.listParagraphs > 0 ? "exported-unordered-list-observed-without-source-expectation" : "unordered-list-source-expectation-missing"
      if (facts.blockCounts.listParagraphs > 0) evidenceRefs.push("export.document.list-paragraphs")
    } else if (expected && facts.blockCounts.listParagraphs > 0 && facts.styleFacts.hasBulletNumbering) {
      bucket = "restored"; reason = "bullet-numbering-present"; evidenceRefs.push("export.numbering.bullet")
    } else if (expected && facts.blockCounts.listParagraphs > 0) {
      bucket = "partial"; reason = "list-paragraphs-present-without-bullet-numbering"
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "unordered-list-expected-but-numbering-missing"
    }
  } else if (dimension === "list") {
    if (!hasSourceExpectation) {
      bucket = "unverified"
      reason = facts.blockCounts.listParagraphs > 0 ? "exported-list-observed-without-source-expectation" : "list-source-expectation-missing"
      if (facts.blockCounts.listParagraphs > 0) evidenceRefs.push("export.document.list-paragraphs")
    } else if (facts.blockCounts.listParagraphs > 0) {
      bucket = facts.styleFacts.hasDecimalNumbering || facts.styleFacts.hasBulletNumbering ? "restored" : "partial"
      reason = bucket === "restored" ? "list-numbering-present" : "list-paragraphs-present-without-numbering-style"
      evidenceRefs.push("export.document.list-paragraphs")
    }
  } else if (dimension === "table") {
    const expected = hasIntermediate("table")
    if (!hasSourceExpectation) {
      bucket = facts.blockCounts.tableCount > 0 ? "unverified" : "unverified"
      reason = facts.blockCounts.tableCount > 0 ? "exported-table-observed-without-source-expectation" : "table-source-expectation-missing"
      if (facts.blockCounts.tableCount > 0) evidenceRefs.push("export.document.table-shape")
    } else if (expected && facts.blockCounts.tableCount > 0 && facts.blockCounts.tableCellCount > 0) {
      bucket = "restored"; reason = "table-structure-present"; evidenceRefs.push("export.document.table-shape")
    } else if (expected && facts.blockCounts.tableCount > 0) {
      bucket = "partial"; reason = "table-present-but-shape-incomplete"
    } else if (expected || hasSourceExpectation) {
      bucket = "missing"; reason = "table-expected-but-not-exported"
    }
  } else if (dimension === "typography") {
    const hasExportedTypography = facts.styleFacts.fonts.length > 0 || facts.styleFacts.fontSizesHalfPoints.length > 0
    if (hasSourceAttribute && hasExportedTypography) {
      bucket = "partial"; reason = "typography-evidence-present-but-attribute-level-match-not-yet-implemented"; evidenceRefs.push("export.styles.typography")
    } else if (hasSourceAttribute) {
      bucket = "missing"; reason = "typography-attributes-expected-but-exported-evidence-missing"
    } else if (hasExportedTypography) {
      bucket = "unverified"; reason = "exported-typography-observed-without-source-attribute-expectation"; evidenceRefs.push("export.styles.typography")
    }
  } else if (dimension === "page" || dimension === "page.margin" || dimension === "page.size") {
    const hasMargins = facts.styleFacts.marginTwips.length > 0
    if (hasSourceAttribute && hasMatchedInput && !hasMismatchedInput) {
      bucket = "restored"; reason = "page-attribute-evidence-matched"; evidenceRefs.push("export.section.margins")
    } else if (hasSourceAttribute && (hasMargins || hasMismatchedInput)) {
      bucket = "partial"; reason = hasMismatchedInput ? "page-attribute-evidence-mismatch" : "page-margin-evidence-present-but-attribute-level-match-incomplete"; evidenceRefs.push("export.section.margins")
    } else if (hasSourceAttribute) {
      bucket = "missing"; reason = "page-attributes-expected-but-exported-evidence-missing"
    } else if (hasMargins) {
      bucket = "unverified"; reason = "exported-page-margins-observed-without-source-attribute-expectation"; evidenceRefs.push("export.section.margins")
    }
  } else if (dimension === "spacing") {
    if (hasSourceAttribute && facts.styleFacts.spacingCount > 0) {
      bucket = "partial"; reason = "spacing-evidence-present-but-attribute-level-match-not-yet-implemented"; evidenceRefs.push("export.styles.spacing")
    } else if (hasSourceAttribute) {
      bucket = "missing"; reason = "spacing-attributes-expected-but-exported-evidence-missing"
    }
  }

  return {
    id: `coverage-${dimension}`,
    dimension,
    bucket,
    sourceRuleIds: ruleIds,
    expectedAttributeNames,
    exportedEvidenceRefs: evidenceRefs,
    reason,
  }
}

function summarize(coverage: DocxFidelityCoverageItem[]): Record<DocxFidelityBucket, number> {
  return coverage.reduce<Record<DocxFidelityBucket, number>>((acc, item) => {
    acc[item.bucket] += 1
    return acc
  }, { restored: 0, partial: 0, missing: 0, unverified: 0 })
}

export async function buildDocxFidelityDiagnostics(input: BuildDocxFidelityDiagnosticsInput): Promise<DocxFidelityDiagnosticsReport> {
  const rules = input.formatProfileSnapshot?.formatSpec.rules ?? []
  const sourceInventory = buildSourceInventory(rules, input.sourceStyleFacts)
  const exportedFacts = await extractExportedFacts(input.bytes)
  const sourceByDimension = new Map<string, DocxFidelitySourceInventoryItem[]>()
  for (const item of sourceInventory) {
    sourceByDimension.set(item.dimension, [...(sourceByDimension.get(item.dimension) ?? []), item])
  }
  exportedFacts.bucketInputs = buildBucketInputs(sourceByDimension, exportedFacts, input.intermediate)

  const dimensions = uniqueSorted([
    ...sourceByDimension.keys(),
    "document-title",
    "heading",
    "paragraph",
    ...(input.intermediate.blocks.some((block) => block.type === "list" && block.ordered) ? ["ordered-list"] : []),
    ...(input.intermediate.blocks.some((block) => block.type === "list" && !block.ordered) ? ["unordered-list"] : []),
    ...(input.intermediate.blocks.some((block) => block.type === "table") ? ["table"] : []),
    "typography",
    "page",
  ])
  const coverage = dimensions.map((dimension) => coverageForDimension(
    dimension,
    sourceByDimension.get(dimension) ?? [],
    exportedFacts,
    input.intermediate,
  ))
  const gaps = coverage
    .filter((item): item is DocxFidelityCoverageItem & { bucket: Exclude<DocxFidelityBucket, "restored"> } => item.bucket !== "restored")
    .map((item) => ({
      id: `gap-${item.dimension}`,
      dimension: item.dimension,
      bucket: item.bucket,
      sourceRuleIds: item.sourceRuleIds,
      reason: item.reason,
    }))
  const reportBase = {
    schemaVersion: DOCX_FIDELITY_DIAGNOSTICS_VERSION,
    ...(input.formatProfileSnapshot?.formatSpecHash ? { formatSpecHash: input.formatProfileSnapshot.formatSpecHash } : {}),
    sourceInventory,
    exportedFacts,
    coverage,
    gaps,
    summary: summarize(coverage),
    e2PriorityGaps: gaps.filter((gap) => gap.bucket === "missing" || gap.bucket === "partial").slice(0, 8),
    limitations: {
      notWordWpsParityValidated: true,
      noManualTemplateRoute: true,
      notFullFidelityClaim: true,
    } as const,
  }
  if (containsForbiddenDocxExportLeakage(reportBase)) {
    throw new Error("DocxFidelityDiagnosticsReport contains forbidden source leakage fields")
  }
  return {
    ...reportBase,
    reportHash: sha256Stable(reportBase),
  }
}
