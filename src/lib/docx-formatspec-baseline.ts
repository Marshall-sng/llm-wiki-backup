import type { FormatProfileConfidence, FormatSpecRule, FormatSpecRuleAttribute } from "@/lib/format-profile-types"

export const DOCX_FORMATSPEC_BASELINE_VERSION = "docx-formal-writing-baseline.20210625.v0" as const
export const DOCX_FORMATSPEC_BASELINE_AUDIT_VERSION = "docx-formatspec-baseline-audit.v0" as const

export type DocxBaselineDimension =
  | "page.size"
  | "page.margin"
  | "title.main"
  | "title.subtitle"
  | "title.multiline"
  | "heading.level1"
  | "heading.level2"
  | "heading.level3"
  | "paragraph.body"
  | "list.numbering"
  | "table.readability"
  | "boundary.no-source-copy"

export const DOCX_BASELINE_DIMENSIONS: readonly DocxBaselineDimension[] = [
  "page.size",
  "page.margin",
  "title.main",
  "title.subtitle",
  "title.multiline",
  "heading.level1",
  "heading.level2",
  "heading.level3",
  "paragraph.body",
  "list.numbering",
  "table.readability",
  "boundary.no-source-copy",
] as const

export interface DocxFormatSpecBaselineAudit {
  schemaVersion: typeof DOCX_FORMATSPEC_BASELINE_AUDIT_VERSION
  baselineVersion: typeof DOCX_FORMATSPEC_BASELINE_VERSION
  verdict: "pass" | "gap"
  coveredDimensions: DocxBaselineDimension[]
  missingDimensions: DocxBaselineDimension[]
  baselineFilledDimensions: DocxBaselineDimension[]
  warnings: string[]
}

function attr(name: string, value: string, unit?: string): FormatSpecRuleAttribute {
  return {
    name,
    value,
    ...(unit ? { unit } : {}),
    confidence: "high",
    evidenceRefs: ["baseline.docx.formal-writing.20210625"],
  }
}

function baselineRule(
  dimension: DocxBaselineDimension,
  target: string,
  normType: string,
  rule: string,
  detail: string,
  attributes: FormatSpecRuleAttribute[],
  confidence: FormatProfileConfidence,
): FormatSpecRule {
  return {
    id: `docx-baseline-${dimension.replace(/\./g, "-")}`,
    target,
    normType,
    dimension,
    rule,
    detail,
    source: "standard-default",
    confidence,
    evidenceRefs: ["baseline.docx.formal-writing.20210625"],
    attributes,
  }
}

export function isDocxBaselineDimension(value: string | undefined): value is DocxBaselineDimension {
  return typeof value === "string" && (DOCX_BASELINE_DIMENSIONS as readonly string[]).includes(value)
}

export function buildDocxFormalBaselineRules(confidence: FormatProfileConfidence = "high"): FormatSpecRule[] {
  return [
    baselineRule(
      "page.size",
      "page",
      "page-size",
      "页面规格采用正式 DOCX 文稿 A4 基线。",
      "最低基线为 A4 页面，约 21.0cm × 29.7cm；当前来源有更具体页面事实时可特化。",
      [attr("pageWidthCm", "21.0", "cm"), attr("pageHeightCm", "29.7", "cm"), attr("paperSize", "A4")],
      confidence,
    ),
    baselineRule(
      "page.margin",
      "page",
      "page-margin",
      "页边距必须保留来源语义，不能混合无来源值。",
      "行文格式同时存在 DOCX XML 实际值与正文规范文字值；两者冲突时保留双来源 attributes 并提示 warning。",
      [
        attr("marginTopCm.detectedLayout", "2.54", "cm"),
        attr("marginBottomCm.detectedLayout", "2.54", "cm"),
        attr("marginLeftCm.detectedLayout", "3.17", "cm"),
        attr("marginRightCm.detectedLayout", "3.17", "cm"),
        attr("marginTopCm.instructionalText", "3.9", "cm"),
        attr("marginBottomCm.instructionalText", "2.5", "cm"),
        attr("marginLeftCm.instructionalText", "2.7", "cm"),
        attr("marginRightCm.instructionalText", "2.7", "cm"),
        attr("marginConflict", "detected-layout-vs-instructional-format-text"),
      ],
      confidence,
    ),
    baselineRule(
      "title.main",
      "title",
      "main-title",
      "全文主标题独立成行并使用正式公文标题样式。",
      "最低基线：方正小标宋简体、22pt、居中、固定行距约 30pt；不得降级为章节标题。",
      [attr("fontFamily", "方正小标宋简体"), attr("fontSizePt", "22", "pt"), attr("alignment", "center"), attr("lineSpacingPt", "30", "pt")],
      confidence,
    ),
    baselineRule(
      "title.subtitle",
      "title",
      "subtitle",
      "副标题、日期或讲话人行使用正式居中副标题样式。",
      "最低基线：楷体、16pt、居中、固定行距约 30pt。",
      [attr("fontFamily", "楷体"), attr("fontSizePt", "16", "pt"), attr("alignment", "center"), attr("lineSpacingPt", "30", "pt")],
      confidence,
    ),
    baselineRule(
      "title.multiline",
      "title",
      "multiline-title",
      "多行标题应保持正式文稿标题排布。",
      "多行标题可呈梯形/菱形排布；多个发文机关之间用空格分隔，不使用顿号。",
      [attr("multilineArrangement", "trapezoid-or-diamond"), attr("issuingOrgSeparator", "space"), attr("avoidSeparator", "顿号")],
      confidence,
    ),
    baselineRule(
      "heading.level1",
      "heading",
      "level1",
      "一级标题使用中文序号层级。",
      "最低基线：一、；黑体；16pt；缩进约 2 字符；固定行距约 30pt。",
      [attr("numberingPattern", "一、"), attr("fontFamily", "黑体"), attr("fontSizePt", "16", "pt"), attr("firstLineIndentChars", "2"), attr("lineSpacingPt", "30", "pt")],
      confidence,
    ),
    baselineRule(
      "heading.level2",
      "heading",
      "level2",
      "二级标题使用括号中文序号层级。",
      "最低基线：（一）；楷体；16pt；缩进约 2 字符；固定行距约 30pt。",
      [attr("numberingPattern", "（一）"), attr("fontFamily", "楷体"), attr("fontSizePt", "16", "pt"), attr("firstLineIndentChars", "2"), attr("lineSpacingPt", "30", "pt")],
      confidence,
    ),
    baselineRule(
      "heading.level3",
      "heading",
      "level3",
      "三级标题使用阿拉伯数字层级。",
      "最低基线：1.；仿宋；16pt；加粗；缩进约 2 字符；固定行距约 30pt。",
      [attr("numberingPattern", "1."), attr("fontFamily", "仿宋"), attr("fontSizePt", "16", "pt"), attr("bold", "true"), attr("firstLineIndentChars", "2"), attr("lineSpacingPt", "30", "pt")],
      confidence,
    ),
    baselineRule(
      "paragraph.body",
      "paragraph",
      "body",
      "正文段落使用正式文稿正文样式。",
      "最低基线：仿宋、16pt、首行缩进约 2 字符、固定行距约 30pt、正式文稿对齐。",
      [attr("fontFamily", "仿宋"), attr("fontSizePt", "16", "pt"), attr("firstLineIndentChars", "2"), attr("lineSpacingPt", "30", "pt"), attr("alignment", "both-or-justified")],
      confidence,
    ),
    baselineRule(
      "list.numbering",
      "numbering",
      "hierarchy",
      "同层编号必须同形且连续。",
      "不得混用标题层级和列表层级；长句、事实和引用保持在正文或条款中。",
      [attr("sameLevelSameShape", "true"), attr("numberingContinuity", "required")],
      confidence,
    ),
    baselineRule(
      "table.readability",
      "table",
      "readability",
      "表格只承载清单、阈值、对照或矩阵。",
      "表头应字段化；证据不足时不强制生成表格。",
      [attr("tablePurpose", "list-threshold-comparison-matrix"), attr("headerStyle", "fieldized"), attr("doNotForceTableWithoutEvidence", "true")],
      confidence,
    ),
    baselineRule(
      "boundary.no-source-copy",
      "boundary",
      "source-boundary",
      "格式约束不得复制来源正文。",
      "不得把来源格式文件的正文、条款或候选标题直接写入目标底稿。",
      [attr("sourceBodyCopy", "forbidden"), attr("candidateTitleCopy", "forbidden")],
      "high",
    ),
  ]
}

function tokenText(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase().replace(/[_\s]/g, "-")
}

function hasAttribute(rule: FormatSpecRule, pattern: RegExp): boolean {
  return (rule.attributes ?? []).some((attribute) => pattern.test(attribute.name))
}

export function normalizeDocxBaselineDimension(rule: FormatSpecRule): DocxBaselineDimension | undefined {
  if (isDocxBaselineDimension(rule.dimension)) return rule.dimension

  const tokens = tokenText(rule.id, rule.target, rule.normType)
  if (rule.target === "page") {
    if (tokens.includes("page-size") || hasAttribute(rule, /page(width|height)|paper/i)) return "page.size"
    if (tokens.includes("margin") || hasAttribute(rule, /margin/i)) return "page.margin"
    return undefined
  }
  if (rule.target === "title") {
    if (tokens.includes("main-title") || tokens.includes("document-title") || tokens.endsWith("title-main")) return "title.main"
    if (tokens.includes("subtitle") || tokens.includes("speaker") || tokens.includes("date")) return "title.subtitle"
    if (tokens.includes("multiline") || tokens.includes("issuing-org")) return "title.multiline"
    return undefined
  }
  if (rule.target === "heading") {
    if (/(^|-)h?1($|-)|heading-1|level-?1/.test(tokens)) return "heading.level1"
    if (/(^|-)h?2($|-)|heading-2|level-?2/.test(tokens)) return "heading.level2"
    if (/(^|-)h?3($|-)|heading-3|level-?3/.test(tokens)) return "heading.level3"
    return undefined
  }
  if (rule.target === "paragraph" || rule.target === "body" || tokens.includes("body")) return "paragraph.body"
  if (rule.target === "numbering" || rule.target === "list" || tokens.includes("numbering")) return "list.numbering"
  if (rule.target === "table" && (tokens.includes("readability") || tokens.includes("table-readability"))) return "table.readability"
  if (rule.target === "boundary" && (tokens.includes("source-copy") || tokens.includes("source-boundary") || tokens.includes("no-source-copy"))) return "boundary.no-source-copy"
  return undefined
}

function ruleWithNormalizedDimension(rule: FormatSpecRule): FormatSpecRule {
  const dimension = normalizeDocxBaselineDimension(rule)
  return dimension && rule.dimension !== dimension ? { ...rule, dimension } : rule
}

function attributeNames(rule: FormatSpecRule): string[] {
  return (rule.attributes ?? []).map((attribute) => attribute.name.toLowerCase())
}

function hasAnyAttribute(rule: FormatSpecRule, patterns: RegExp[]): boolean {
  const names = attributeNames(rule)
  return names.some((name) => patterns.some((pattern) => pattern.test(name)))
}

function hasAnyRuleAttributes(rule: FormatSpecRule): boolean {
  return Boolean(rule.attributes?.length)
}

function hasRequiredCoverageAttributes(rule: FormatSpecRule, dimension: DocxBaselineDimension): boolean {
  switch (dimension) {
    case "page.size":
      return hasAnyAttribute(rule, [/pagewidth/, /pageheight/, /papersize/])
    case "page.margin":
      return hasAnyAttribute(rule, [/margin/])
    case "title.main":
    case "title.subtitle":
      return hasAnyAttribute(rule, [/fontfamily/, /font/, /fontsize/]) && hasAnyAttribute(rule, [/alignment/, /linespacing/])
    case "title.multiline":
      return hasAnyAttribute(rule, [/multiline/, /issuingorg/, /separator/])
    case "heading.level1":
    case "heading.level2":
    case "heading.level3":
      return hasAnyAttribute(rule, [/numberingpattern/]) && hasAnyAttribute(rule, [/fontfamily/, /font/, /fontsize/])
    case "paragraph.body":
      return hasAnyAttribute(rule, [/fontfamily/, /font/, /fontsize/]) && hasAnyAttribute(rule, [/indent/, /linespacing/, /alignment/])
    case "list.numbering":
      return hasAnyAttribute(rule, [/numbering/, /samelevelsameshape/, /continuity/])
    case "table.readability":
      return hasAnyAttribute(rule, [/tablepurpose/, /headerstyle/, /donotforcetable/])
    case "boundary.no-source-copy":
      return hasAnyAttribute(rule, [/sourcebodycopy/, /candidatetitlecopy/])
  }
}

function dedupeByIdPreservingOrder(rules: FormatSpecRule[]): FormatSpecRule[] {
  const result: FormatSpecRule[] = []
  const indexById = new Map<string, number>()
  for (const rule of rules) {
    const existingIndex = indexById.get(rule.id)
    if (existingIndex === undefined) {
      indexById.set(rule.id, result.length)
      result.push(rule)
      continue
    }
    const existing = result[existingIndex]
    if (!existing.dimension && rule.dimension) {
      result[existingIndex] = rule
      continue
    }
    if (existing.dimension && !hasAnyRuleAttributes(existing) && hasAnyRuleAttributes(rule)) {
      result[existingIndex] = rule
    }
  }
  return result
}

export function auditDocxFormatSpecBaseline(rules: FormatSpecRule[]): DocxFormatSpecBaselineAudit {
  const normalized = rules.map(ruleWithNormalizedDimension)
  const coveredSet = new Set<DocxBaselineDimension>()
  const baselineFilledSet = new Set<DocxBaselineDimension>()
  const warnings = new Set<string>()

  for (const rule of normalized) {
    const dimension = normalizeDocxBaselineDimension(rule)
    if (!dimension) continue
    if (hasRequiredCoverageAttributes(rule, dimension)) coveredSet.add(dimension)
    if (rule.id.startsWith("docx-baseline-")) baselineFilledSet.add(dimension)
    if (dimension === "page.margin" && (rule.attributes ?? []).some((attribute) => attribute.name === "marginConflict")) {
      warnings.add("page.margin has both detected-layout and instructional-format-text sources")
    }
  }

  const coveredDimensions = DOCX_BASELINE_DIMENSIONS.filter((dimension) => coveredSet.has(dimension))
  const missingDimensions = DOCX_BASELINE_DIMENSIONS.filter((dimension) => !coveredSet.has(dimension))
  return {
    schemaVersion: DOCX_FORMATSPEC_BASELINE_AUDIT_VERSION,
    baselineVersion: DOCX_FORMATSPEC_BASELINE_VERSION,
    verdict: missingDimensions.length ? "gap" : "pass",
    coveredDimensions,
    missingDimensions,
    baselineFilledDimensions: DOCX_BASELINE_DIMENSIONS.filter((dimension) => baselineFilledSet.has(dimension)),
    warnings: [...warnings].sort(),
  }
}

export function ensureDocxFormatSpecBaseline(
  rules: FormatSpecRule[],
  options: { confidence?: FormatProfileConfidence } = {},
): { rules: FormatSpecRule[]; audit: DocxFormatSpecBaselineAudit } {
  const normalizedRules = rules.map(ruleWithNormalizedDimension)
  const covered = new Set<DocxBaselineDimension>()
  for (const rule of normalizedRules) {
    const dimension = normalizeDocxBaselineDimension(rule)
    if (dimension && hasRequiredCoverageAttributes(rule, dimension)) covered.add(dimension)
  }

  const baselineRules = buildDocxFormalBaselineRules(options.confidence ?? "high")
    .filter((rule) => !covered.has(rule.dimension as DocxBaselineDimension))
  const deduped = dedupeByIdPreservingOrder([...normalizedRules, ...baselineRules])
  return {
    rules: deduped,
    audit: auditDocxFormatSpecBaseline(deduped),
  }
}
