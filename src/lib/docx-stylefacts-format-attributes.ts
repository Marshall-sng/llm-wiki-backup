import type { FormatProfileConfidence, FormatSpecRule, FormatSpecRuleAttribute } from "@/lib/format-profile-types"
import type { StyleFactsEnvelope } from "@/lib/style-facts"

type UnknownRecord = Record<string, unknown>

interface SafeFact<T = unknown> {
  value: T
  confidence?: FormatProfileConfidence
  evidenceRefs: string[]
}

export interface DocxExecutableStyleFactsInput {
  fileType: "docx"
  confidence: FormatProfileConfidence
  facts: {
    layout: {
      pageSizeTwips?: SafeFact<Record<string, unknown>>
      marginsTwips?: SafeFact<Record<string, unknown>>
    }
    typography: {
      fontUsage?: SafeFact<unknown[]>
      fontSizeUsagePt?: SafeFact<unknown[]>
    }
    styles: {
      definitions?: SafeFact<unknown[]>
      paragraphStyleUsage?: SafeFact<unknown[]>
    }
  }
  safeEvidenceCatalog: Record<string, { id: string; kind?: string; pointer?: string; confidence?: FormatProfileConfidence }>
}

interface StyleCandidate {
  styleId: string
  name: string
  type: string
  fonts: string[]
  fontSizePt?: number
  bold?: boolean
  lineSpacingTwips?: number
  outlineLevel?: number
  evidenceRefs: string[]
}

interface UsageCandidate {
  value: string
  count: number
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function safeFact<T = unknown>(value: unknown, allowedEvidenceIds: ReadonlySet<string>): SafeFact<T> | undefined {
  const record = asRecord(value)
  if (!Object.prototype.hasOwnProperty.call(record, "value")) return undefined
  return {
    value: record.value as T,
    confidence: record.confidence === "high" || record.confidence === "medium" || record.confidence === "low" ? record.confidence : undefined,
    evidenceRefs: asArray(record.evidenceRefs)
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter((item): item is string => Boolean(item) && allowedEvidenceIds.has(item)),
  }
}

function factAt(root: unknown, path: string, allowedEvidenceIds: ReadonlySet<string>): SafeFact | undefined {
  let current: unknown = root
  for (const part of path.split(".")) {
    current = asRecord(current)[part]
  }
  return safeFact(current, allowedEvidenceIds)
}

export function buildDocxExecutableStyleFactsInput(
  styleFacts: StyleFactsEnvelope | undefined,
  confidence: FormatProfileConfidence,
): DocxExecutableStyleFactsInput | undefined {
  if (!styleFacts || styleFacts.source?.fileType !== "docx") return undefined
  const facts = styleFacts.styleFacts
  const safeEvidenceCatalog: DocxExecutableStyleFactsInput["safeEvidenceCatalog"] = {}
  for (const item of styleFacts.evidence ?? []) {
    if (!item.id) continue
    safeEvidenceCatalog[item.id] = {
      id: item.id,
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.pointer ? { pointer: item.pointer } : {}),
      ...(item.confidence === "high" || item.confidence === "medium" || item.confidence === "low" ? { confidence: item.confidence } : {}),
    }
  }
  const allowedEvidenceIds = new Set(Object.keys(safeEvidenceCatalog))
  return {
    fileType: "docx",
    confidence,
    facts: {
      layout: {
        pageSizeTwips: factAt(facts, "layout.pageSizeTwips", allowedEvidenceIds) as SafeFact<Record<string, unknown>> | undefined,
        marginsTwips: factAt(facts, "layout.marginsTwips", allowedEvidenceIds) as SafeFact<Record<string, unknown>> | undefined,
      },
      typography: {
        fontUsage: factAt(facts, "typography.fontUsage", allowedEvidenceIds) as SafeFact<unknown[]> | undefined,
        fontSizeUsagePt: factAt(facts, "typography.fontSizeUsagePt", allowedEvidenceIds) as SafeFact<unknown[]> | undefined,
      },
      styles: {
        definitions: factAt(facts, "styles.definitions", allowedEvidenceIds) as SafeFact<unknown[]> | undefined,
        paragraphStyleUsage: factAt(facts, "styles.paragraphStyleUsage", allowedEvidenceIds) as SafeFact<unknown[]> | undefined,
      },
    },
    safeEvidenceCatalog,
  }
}

function stringsFrom(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : []
  return asArray(value).map(asString).filter((item): item is string => Boolean(item))
}

function isLocaleOrFontSlot(value: string): boolean {
  return /^(zh-cn|en-us|ascii|eastasia|hansi|cs)$/i.test(value.trim())
}

function isCommonLatinFallback(value: string): boolean {
  return /^(times new roman|calibri|cambria|arial|aptos|courier new)$/i.test(value.trim())
}

function isChineseLikeFont(value: string): boolean {
  const font = value.trim()
  return /[\u3400-\u9fff]/u.test(font) || /(fangsong|simsun|simhei|kaiti|song|hei|fz|founder)/i.test(font)
}

function isDisplayTitleFont(value: string): boolean {
  return /小标宋|方正小标宋|xiaobiaosong|title/i.test(value)
}

function isPreferredBodyFont(value: string): boolean {
  return /仿宋|fangsong/i.test(value)
}

function firstFont(fonts: string[]): string | undefined {
  return fonts.find((font) => !isLocaleOrFontSlot(font) && isChineseLikeFont(font)) ??
    fonts.find((font) => !isLocaleOrFontSlot(font) && !isCommonLatinFallback(font)) ??
    fonts.find((font) => !isLocaleOrFontSlot(font))
}

function halfPointToPt(value: unknown): number | undefined {
  const number = asNumber(value)
  return number && number > 0 ? number / 2 : undefined
}

function lineSpacingTwipsFrom(value: unknown): number | undefined {
  const record = asRecord(value)
  const spacing = asRecord(record.spacing)
  const candidates = [
    record.lineTwips,
    record.lineSpacingTwips,
    record.line,
    spacing.lineTwips,
    spacing.lineSpacingTwips,
    spacing.line,
  ]
  for (const candidate of candidates) {
    const parsed = asNumber(candidate)
    if (parsed !== undefined && parsed > 0) return Math.round(parsed)
  }
  return undefined
}

function parseStyleCandidates(definitions: SafeFact<unknown[]> | undefined): StyleCandidate[] {
  const evidenceRefs = definitions?.evidenceRefs ?? []
  return asArray(definitions?.value).map((item) => {
    const record = asRecord(item)
    const styleId = asString(record.styleId) ?? asString(record.id) ?? ""
    const name = asString(record.name) ?? styleId
    const fontSizeHalfPoints = asArray(record.fontSizesHalfPoints)
    const fontSizePt = halfPointToPt(fontSizeHalfPoints[0]) ?? asNumber(record.fontSizePt)
    return {
      styleId,
      name,
      type: asString(record.type) ?? "paragraph",
      fonts: stringsFrom(record.fonts),
      fontSizePt,
      bold: typeof record.hasBold === "boolean" ? record.hasBold : undefined,
      lineSpacingTwips: lineSpacingTwipsFrom(record),
      outlineLevel: asNumber(record.outlineLevel),
      evidenceRefs,
    }
  }).filter((item) => item.styleId || item.name)
}

function parseUsage(value: unknown[] | undefined): UsageCandidate[] {
  return asArray(value).map((item) => {
    const record = asRecord(item)
    const candidate = asString(record.value) ?? asString(record.name) ?? asString(record.styleId)
    const count = asNumber(record.count) ?? 0
    return candidate ? { value: candidate, count } : undefined
  }).filter((item): item is UsageCandidate => Boolean(item)).sort((a, b) => b.count - a.count)
}

function dominantFont(input: DocxExecutableStyleFactsInput): { value?: string; evidenceRefs: string[] } {
  const fact = input.facts.typography.fontUsage
  return { value: parseUsage(fact?.value)[0]?.value, evidenceRefs: fact?.evidenceRefs ?? [] }
}

function dominantBodyFont(input: DocxExecutableStyleFactsInput): { value?: string; evidenceRefs: string[] } {
  const fact = input.facts.typography.fontUsage
  const usage = parseUsage(fact?.value)
  const preferred = usage.find((item) => isPreferredBodyFont(item.value))
  const chinese = usage.find((item) => isChineseLikeFont(item.value) && !isDisplayTitleFont(item.value))
  const nonLatin = usage.find((item) => !isLocaleOrFontSlot(item.value) && !isCommonLatinFallback(item.value))
  return { value: preferred?.value ?? chinese?.value ?? nonLatin?.value ?? usage[0]?.value, evidenceRefs: fact?.evidenceRefs ?? [] }
}

function dominantFontSize(input: DocxExecutableStyleFactsInput): { value?: number; evidenceRefs: string[] } {
  const fact = input.facts.typography.fontSizeUsagePt
  const usage = asArray(fact?.value).map((item) => {
    const record = asRecord(item)
    const value = asNumber(record.value)
    const count = asNumber(record.count) ?? 0
    return value ? { value, count } : undefined
  }).filter((item): item is { value: number; count: number } => Boolean(item)).sort((a, b) => b.count - a.count)
  return { value: usage[0]?.value, evidenceRefs: fact?.evidenceRefs ?? [] }
}

function normalizedToken(...values: string[]): string {
  return values.join(" ").toLowerCase().replace(/[_\s]+/g, "-")
}

function scoreTitleCandidate(candidate: StyleCandidate): number {
  const token = normalizedToken(candidate.styleId, candidate.name)
  let score = 0
  if (token.includes("title")) score += 8
  if (token.includes("heading-1") || token.includes("heading1")) score -= 3
  if (token.includes("标题")) score += 8
  if (token.includes("小标宋")) score += 4
  if (firstFont(candidate.fonts) && isDisplayTitleFont(firstFont(candidate.fonts) ?? "")) score += 6
  if (candidate.outlineLevel === 0) score += 2
  score += candidate.fontSizePt ?? 0
  return score
}

function scoreHeading1Candidate(candidate: StyleCandidate): number {
  const token = normalizedToken(candidate.styleId, candidate.name)
  let score = 0
  if (token.includes("heading-1") || token.includes("heading1")) score += 20
  if (candidate.outlineLevel === 0) score += 5
  if (token.includes("一") || token.includes("level-1")) score += 2
  const font = firstFont(candidate.fonts)
  if (font && isDisplayTitleFont(font)) score -= 12
  if (candidate.fontSizePt && candidate.fontSizePt > 18) score -= 6
  score += (candidate.fontSizePt ?? 0) / 10
  return score
}

function selectTitleCandidate(candidates: StyleCandidate[], exclude?: StyleCandidate): StyleCandidate | undefined {
  return candidates
    .filter((candidate) => candidate.type === "paragraph")
    .filter((candidate) => candidate !== exclude)
    .filter((candidate) => firstFont(candidate.fonts) || candidate.fontSizePt)
    .sort((a, b) => scoreTitleCandidate(b) - scoreTitleCandidate(a))[0]
}

function selectHeading1Candidate(candidates: StyleCandidate[], exclude?: StyleCandidate): StyleCandidate | undefined {
  return candidates
    .filter((candidate) => candidate.type === "paragraph")
    .filter((candidate) => candidate !== exclude)
    .filter((candidate) => firstFont(candidate.fonts) || candidate.fontSizePt)
    .sort((a, b) => scoreHeading1Candidate(b) - scoreHeading1Candidate(a))[0]
}

function selectTitleAndHeading1Candidates(candidates: StyleCandidate[]): { title?: StyleCandidate; heading1?: StyleCandidate } {
  const title = selectTitleCandidate(candidates)
  const heading1 = selectHeading1Candidate(candidates, title)
  return { title, heading1 }
}

function selectBodyCandidate(candidates: StyleCandidate[], input: DocxExecutableStyleFactsInput): StyleCandidate | undefined {
  const usage = parseUsage(input.facts.styles.paragraphStyleUsage?.value)
  const usageIndex = new Map(usage.map((item, index) => [item.value.toLowerCase(), usage.length - index]))
  return candidates
    .filter((candidate) => candidate.type === "paragraph")
    .filter((candidate) => firstFont(candidate.fonts) || candidate.fontSizePt)
    .sort((a, b) => bodyScore(b, usageIndex) - bodyScore(a, usageIndex))[0]
}

function bodyScore(candidate: StyleCandidate, usageIndex: Map<string, number>): number {
  const token = normalizedToken(candidate.styleId, candidate.name)
  let score = usageIndex.get(candidate.styleId.toLowerCase()) ?? usageIndex.get(candidate.name.toLowerCase()) ?? 0
  if (token.includes("body") || token.includes("normal") || token.includes("正文")) score += 10
  if (token.includes("text")) score += 4
  return score
}

function attr(
  name: string,
  value: string | number | boolean,
  options: { unit?: string; confidence?: FormatProfileConfidence; evidenceRefs?: string[] } = {},
): FormatSpecRuleAttribute {
  return {
    name,
    value: String(value),
    ...(options.unit ? { unit: options.unit } : {}),
    ...(options.confidence ? { confidence: options.confidence } : {}),
    ...(options.evidenceRefs?.length ? { evidenceRefs: [...new Set(options.evidenceRefs)] } : {}),
  }
}

function attrsFromStyle(candidate: StyleCandidate | undefined, fallback: { font?: string; fontSizePt?: number; evidenceRefs?: string[] } = {}): FormatSpecRuleAttribute[] {
  const evidenceRefs = [...new Set([...(candidate?.evidenceRefs ?? []), ...(fallback.evidenceRefs ?? [])])]
  const font = firstFont(candidate?.fonts ?? []) ?? fallback.font
  const fontSizePt = candidate?.fontSizePt ?? fallback.fontSizePt
  const attributes: FormatSpecRuleAttribute[] = []
  if (font) attributes.push(attr("fontFamily", font, { confidence: "high", evidenceRefs }))
  if (fontSizePt) attributes.push(attr("fontSizePt", Number(fontSizePt.toFixed(2)), { unit: "pt", confidence: "high", evidenceRefs }))
  if (candidate?.bold !== undefined) attributes.push(attr("bold", candidate.bold, { confidence: "medium", evidenceRefs }))
  if (candidate?.lineSpacingTwips) attributes.push(attr("lineSpacingTwips", candidate.lineSpacingTwips, { unit: "twip", confidence: "high", evidenceRefs }))
  return attributes
}

function attrsFromValues(font: string | undefined, fontSizePt: number | undefined, evidenceRefs: string[]): FormatSpecRuleAttribute[] {
  const attributes: FormatSpecRuleAttribute[] = []
  if (font) attributes.push(attr("fontFamily", font, { confidence: "high", evidenceRefs }))
  if (fontSizePt) attributes.push(attr("fontSizePt", Number(fontSizePt.toFixed(2)), { unit: "pt", confidence: "high", evidenceRefs }))
  return attributes
}

function ruleWithAttrs(
  id: string,
  dimension: "page.size" | "page.margin" | "title.main" | "heading.level1" | "heading.level2" | "heading.level3" | "paragraph.body",
  target: "page" | "title" | "heading" | "paragraph",
  ruleText: string,
  detail: string,
  attributes: FormatSpecRuleAttribute[],
  confidence: FormatProfileConfidence,
): FormatSpecRule | undefined {
  if (!attributes.length) return undefined
  const evidenceRefs = [...new Set(attributes.flatMap((item) => item.evidenceRefs ?? []))]
  return {
    id,
    target,
    dimension,
    rule: ruleText,
    detail,
    source: "detected",
    confidence,
    ...(evidenceRefs.length ? { evidenceRefs } : {}),
    attributes,
  }
}

function pageSizeAttrs(input: DocxExecutableStyleFactsInput): FormatSpecRuleAttribute[] {
  const fact = input.facts.layout.pageSizeTwips
  const value = asRecord(fact?.value)
  const width = asNumber(value.widthTwips)
  const height = asNumber(value.heightTwips)
  const attrs: FormatSpecRuleAttribute[] = []
  if (width) attrs.push(attr("pageWidthTwips", width, { unit: "twip", confidence: "high", evidenceRefs: fact?.evidenceRefs ?? [] }))
  if (height) attrs.push(attr("pageHeightTwips", height, { unit: "twip", confidence: "high", evidenceRefs: fact?.evidenceRefs ?? [] }))
  if (width && height && Math.abs(width - 11906) < 80 && Math.abs(height - 16838) < 120) {
    attrs.push(attr("paperSize", "A4", { confidence: "medium", evidenceRefs: fact?.evidenceRefs ?? [] }))
  }
  return attrs
}

function pageMarginAttrs(input: DocxExecutableStyleFactsInput): FormatSpecRuleAttribute[] {
  const fact = input.facts.layout.marginsTwips
  const value = asRecord(fact?.value)
  const attrs: FormatSpecRuleAttribute[] = []
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const margin = asNumber(value[side])
    if (margin !== undefined && margin >= 0) {
      attrs.push(attr(`margin${side[0].toUpperCase()}${side.slice(1)}Twips`, margin, { unit: "twip", confidence: "high", evidenceRefs: fact?.evidenceRefs ?? [] }))
    }
  }
  for (const side of ["header", "footer"] as const) {
    const margin = asNumber(value[side])
    if (margin !== undefined && margin >= 0) {
      attrs.push(attr(`${side}DistanceTwips`, margin, { unit: "twip", confidence: "high", evidenceRefs: fact?.evidenceRefs ?? [] }))
    }
  }
  return attrs
}

export function buildDocxExecutableStyleRules(input: DocxExecutableStyleFactsInput | undefined): FormatSpecRule[] {
  if (!input) return []
  const candidates = parseStyleCandidates(input.facts.styles.definitions)
  const dominant = dominantFont(input)
  const dominantBody = dominantBodyFont(input)
  const dominantSize = dominantFontSize(input)
  const bodyCandidate = selectBodyCandidate(candidates, input)
  const selected = selectTitleAndHeading1Candidates(candidates)
  const rules: Array<FormatSpecRule | undefined> = []

  const sizeAttrs = pageSizeAttrs(input)
  if (sizeAttrs.length) {
    rules.push(ruleWithAttrs(
      "docx-stylefacts-page-size",
      "page.size",
      "page",
      "DOCX page size uses deterministic source page facts when available.",
      "Detected page size is an executable export hint for the DOCX writer; it does not copy source content.",
      sizeAttrs,
      input.confidence,
    ))
  }

  const marginAttrs = pageMarginAttrs(input)
  if (marginAttrs.length) {
    rules.push(ruleWithAttrs(
      "docx-stylefacts-page-margin",
      "page.margin",
      "page",
      "DOCX page margins use deterministic source page facts when available.",
      "Detected margins are executable export hints for the DOCX writer; missing sides fall back to the formal baseline.",
      marginAttrs,
      input.confidence,
    ))
  }

  const titleAttrs = attrsFromStyle(selected.title)
  if (titleAttrs.length) {
    rules.push(ruleWithAttrs(
      "docx-stylefacts-title-main",
      "title.main",
      "title",
      "Main title uses deterministic DOCX style facts when available.",
      "Detected style facts provide executable font and size hints for the document title; missing layout fields remain covered by the baseline.",
      titleAttrs,
      input.confidence,
    ))
  }

  const headingAttrs = attrsFromStyle(selected.heading1)
  if (headingAttrs.length) {
    headingAttrs.push(attr("numberingPattern", "一、", { confidence: "medium", evidenceRefs: headingAttrs.flatMap((item) => item.evidenceRefs ?? []) }))
    rules.push(ruleWithAttrs(
      "docx-stylefacts-heading-level1",
      "heading.level1",
      "heading",
      "Level-one heading uses deterministic DOCX style facts when available.",
      "Detected heading style facts provide executable font and size hints for level-one headings; numbering remains a formal-writing structural default.",
      headingAttrs,
      input.confidence,
    ))
  }

  const bodyEvidenceRefs = [...new Set([
    ...dominantBody.evidenceRefs,
    ...dominant.evidenceRefs,
    ...dominantSize.evidenceRefs,
    ...(bodyCandidate?.evidenceRefs ?? []),
  ])]
  const bodyAttrs = attrsFromValues(
    dominantBody.value ?? firstFont(bodyCandidate?.fonts ?? []) ?? dominant.value,
    dominantSize.value ?? bodyCandidate?.fontSizePt,
    bodyEvidenceRefs,
  )
  if (bodyAttrs.length) {
    bodyAttrs.push(
      attr("firstLineIndentChars", "2", { confidence: "medium", evidenceRefs: bodyAttrs.flatMap((item) => item.evidenceRefs ?? []) }),
      bodyCandidate?.lineSpacingTwips
        ? attr("lineSpacingTwips", bodyCandidate.lineSpacingTwips, { unit: "twip", confidence: "high", evidenceRefs: bodyAttrs.flatMap((item) => item.evidenceRefs ?? []) })
        : attr("lineSpacingPt", "30", { unit: "pt", confidence: "medium", evidenceRefs: bodyAttrs.flatMap((item) => item.evidenceRefs ?? []) }),
      attr("alignment", "both-or-justified", { confidence: "medium", evidenceRefs: bodyAttrs.flatMap((item) => item.evidenceRefs ?? []) }),
    )
    rules.push(ruleWithAttrs(
      "docx-stylefacts-paragraph-body",
      "paragraph.body",
      "paragraph",
      "Body paragraph uses deterministic DOCX style facts when available.",
      "Detected style facts provide executable font and size hints for body paragraphs; paragraph layout fields remain formal-writing defaults.",
      bodyAttrs,
      input.confidence,
    ))
  }

  return rules.filter((item): item is FormatSpecRule => Boolean(item))
}
