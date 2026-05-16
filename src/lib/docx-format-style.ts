import type { DraftProcessingFormatProfileSnapshot, FormatSpecRule, FormatSpecRuleAttribute } from "@/lib/format-profile-types"
import { normalizeDocxBaselineDimension } from "@/lib/docx-formatspec-baseline"

export type DocxFormatDimension =
  | "page.size"
  | "page.margin"
  | "title.main"
  | "heading.level1"
  | "heading.level2"
  | "heading.level3"
  | "paragraph.body"
  | "list.numbering"
  | "table.readability"

export interface DocxResolvedTextStyle {
  fontFamily: string
  fontSizeHalfPoints: number
  bold?: boolean
  alignment?: "center" | "justified" | "left"
  firstLineIndentTwips?: number
  lineSpacingTwips?: number
}

export interface DocxResolvedPagePolicy {
  marginTwips: {
    top: number
    right: number
    bottom: number
    left: number
  }
  headerTwips?: number
  footerTwips?: number
  sizeTwips?: {
    width: number
    height: number
  }
}

export interface DocxResolvedStylePolicy {
  byDimension: Partial<Record<DocxFormatDimension, DocxResolvedTextStyle>>
  page: DocxResolvedPagePolicy
  ruleRefsByDimension: Partial<Record<DocxFormatDimension, string[]>>
  diagnostics: string[]
}

type DocxTextDimension = Exclude<DocxFormatDimension, "page.size" | "page.margin" | "list.numbering" | "table.readability">

const DEFAULT_STYLES: Record<DocxTextDimension, DocxResolvedTextStyle> = {
  "title.main": { fontFamily: "方正小标宋简体", fontSizeHalfPoints: 44, bold: true, alignment: "center", lineSpacingTwips: 600 },
  "heading.level1": { fontFamily: "黑体", fontSizeHalfPoints: 32, bold: true, firstLineIndentTwips: 640, lineSpacingTwips: 600 },
  "heading.level2": { fontFamily: "楷体", fontSizeHalfPoints: 32, bold: true, firstLineIndentTwips: 640, lineSpacingTwips: 600 },
  "heading.level3": { fontFamily: "仿宋", fontSizeHalfPoints: 32, bold: true, firstLineIndentTwips: 640, lineSpacingTwips: 600 },
  "paragraph.body": { fontFamily: "仿宋", fontSizeHalfPoints: 32, alignment: "justified", firstLineIndentTwips: 640, lineSpacingTwips: 600 },
}

const DEFAULT_PAGE_POLICY: DocxResolvedPagePolicy = {
  marginTwips: { top: 1440, right: 1797, bottom: 1440, left: 1797 },
  sizeTwips: { width: 11906, height: 16838 },
}

function attrsByName(rule: FormatSpecRule | undefined): Map<string, FormatSpecRuleAttribute> {
  return new Map((rule?.attributes ?? []).map((attr) => [attr.name, attr]))
}

function numberAttr(attrs: Map<string, FormatSpecRuleAttribute>, name: string): number | undefined {
  const raw = attrs.get(name)?.value
  if (!raw) return undefined
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeFontFamily(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  // Some historical baseline fixtures contain mojibake. Normalize the known
  // formal-writing fonts so writer output remains useful and testable.
  if (trimmed.includes("榛戜綋")) return "黑体"
  if (trimmed.includes("妤蜂綋")) return "楷体"
  if (trimmed.includes("浠垮畫")) return "仿宋"
  if (trimmed.includes("鏂规") || trimmed.includes("灏忔爣")) return "方正小标宋简体"
  if (trimmed.includes("瀹嬩綋")) return "宋体"
  if (trimmed.includes("黑体") || trimmed.includes("楷体") || trimmed.includes("楷體") || trimmed.includes("仿宋") || trimmed.includes("方正小标宋") || trimmed.includes("小标宋") || trimmed.includes("宋体") || trimmed.includes("宋體")) return trimmed
  if (/SimHei/i.test(trimmed)) return "黑体"
  if (/KaiTi/i.test(trimmed)) return "楷体"
  if (/FangSong/i.test(trimmed)) return "仿宋"
  if (/SimSun|Song/i.test(trimmed)) return "宋体"
  return trimmed
}
function alignment(value: string | undefined, fallback: DocxResolvedTextStyle["alignment"]): DocxResolvedTextStyle["alignment"] {
  if (!value) return fallback
  const normalized = value.toLowerCase()
  if (normalized.includes("center")) return "center"
  if (normalized.includes("justified") || normalized.includes("both")) return "justified"
  if (normalized.includes("left")) return "left"
  return fallback
}

function styleFromRule(dimension: DocxTextDimension, rule: FormatSpecRule | undefined): DocxResolvedTextStyle {
  const defaults = DEFAULT_STYLES[dimension]
  const attrs = attrsByName(rule)
  const fontSizePt = numberAttr(attrs, "fontSizePt")
  const lineSpacingTwips = twipAttr(attrs, "lineSpacingTwips")
  const firstLineIndentChars = numberAttr(attrs, "firstLineIndentChars")
  const lineSpacingPt = numberAttr(attrs, "lineSpacingPt")
  const bold = attrs.get("bold")?.value?.toLowerCase()
  return {
    ...defaults,
    fontFamily: normalizeFontFamily(attrs.get("fontFamily")?.value, defaults.fontFamily),
    fontSizeHalfPoints: fontSizePt ? Math.round(fontSizePt * 2) : defaults.fontSizeHalfPoints,
    ...(bold ? { bold: bold === "true" || bold === "1" } : {}),
    alignment: alignment(attrs.get("alignment")?.value, defaults.alignment),
    firstLineIndentTwips: firstLineIndentChars
      ? Math.round(firstLineIndentChars * ((fontSizePt ?? defaults.fontSizeHalfPoints / 2) * 20))
      : defaults.firstLineIndentTwips,
    lineSpacingTwips: lineSpacingTwips ?? (lineSpacingPt ? Math.round(lineSpacingPt * 20) : defaults.lineSpacingTwips),
  }
}

function dimensionForRule(rule: FormatSpecRule): DocxFormatDimension | undefined {
  const normalized = normalizeDocxBaselineDimension(rule)
  if (
    normalized === "page.size" ||
    normalized === "page.margin" ||
    normalized === "title.main" ||
    normalized === "heading.level1" ||
    normalized === "heading.level2" ||
    normalized === "heading.level3" ||
    normalized === "paragraph.body" ||
    normalized === "list.numbering" ||
    normalized === "table.readability"
  ) return normalized
  return undefined
}

function cmToTwips(value: number): number {
  return Math.round(value * 1440 / 2.54)
}

function twipAttr(attrs: Map<string, FormatSpecRuleAttribute>, name: string): number | undefined {
  const raw = numberAttr(attrs, name)
  return raw !== undefined && raw >= 0 ? Math.round(raw) : undefined
}

function cmAttr(attrs: Map<string, FormatSpecRuleAttribute>, ...names: string[]): number | undefined {
  for (const name of names) {
    const value = numberAttr(attrs, name)
    if (value !== undefined && value >= 0) return cmToTwips(value)
  }
  return undefined
}

function resolvePagePolicy(firstRuleByDimension: Map<DocxFormatDimension, FormatSpecRule>): DocxResolvedPagePolicy {
  const marginAttrs = attrsByName(firstRuleByDimension.get("page.margin" as DocxFormatDimension))
  const sizeAttrs = attrsByName(firstRuleByDimension.get("page.size" as DocxFormatDimension))
  const marginTwips = {
    top: twipAttr(marginAttrs, "marginTopTwips") ?? cmAttr(marginAttrs, "marginTopCm.detectedLayout", "marginTopCm", "marginTopCm.instructionalText") ?? DEFAULT_PAGE_POLICY.marginTwips.top,
    right: twipAttr(marginAttrs, "marginRightTwips") ?? cmAttr(marginAttrs, "marginRightCm.detectedLayout", "marginRightCm", "marginRightCm.instructionalText") ?? DEFAULT_PAGE_POLICY.marginTwips.right,
    bottom: twipAttr(marginAttrs, "marginBottomTwips") ?? cmAttr(marginAttrs, "marginBottomCm.detectedLayout", "marginBottomCm", "marginBottomCm.instructionalText") ?? DEFAULT_PAGE_POLICY.marginTwips.bottom,
    left: twipAttr(marginAttrs, "marginLeftTwips") ?? cmAttr(marginAttrs, "marginLeftCm.detectedLayout", "marginLeftCm", "marginLeftCm.instructionalText") ?? DEFAULT_PAGE_POLICY.marginTwips.left,
  }
  const width = twipAttr(sizeAttrs, "pageWidthTwips") ?? cmAttr(sizeAttrs, "pageWidthCm")
  const height = twipAttr(sizeAttrs, "pageHeightTwips") ?? cmAttr(sizeAttrs, "pageHeightCm")
  return {
    marginTwips,
    ...(twipAttr(marginAttrs, "headerDistanceTwips") !== undefined ? { headerTwips: twipAttr(marginAttrs, "headerDistanceTwips") } : {}),
    ...(twipAttr(marginAttrs, "footerDistanceTwips") !== undefined ? { footerTwips: twipAttr(marginAttrs, "footerDistanceTwips") } : {}),
    sizeTwips: width && height ? { width, height } : DEFAULT_PAGE_POLICY.sizeTwips,
  }
}

export function resolveDocxStylePolicy(snapshot?: DraftProcessingFormatProfileSnapshot): DocxResolvedStylePolicy {
  const ruleRefsByDimension: DocxResolvedStylePolicy["ruleRefsByDimension"] = {}
  const firstRuleByDimension = new Map<DocxFormatDimension, FormatSpecRule>()
  for (const rule of snapshot?.formatSpec.rules ?? []) {
    const dimension = dimensionForRule(rule)
    if (!dimension) continue
    ruleRefsByDimension[dimension] = [...(ruleRefsByDimension[dimension] ?? []), rule.id]
    if (!firstRuleByDimension.has(dimension)) firstRuleByDimension.set(dimension, rule)
  }

  return {
    ruleRefsByDimension,
    page: resolvePagePolicy(firstRuleByDimension),
    byDimension: {
      "title.main": styleFromRule("title.main", firstRuleByDimension.get("title.main")),
      "heading.level1": styleFromRule("heading.level1", firstRuleByDimension.get("heading.level1")),
      "heading.level2": styleFromRule("heading.level2", firstRuleByDimension.get("heading.level2")),
      "heading.level3": styleFromRule("heading.level3", firstRuleByDimension.get("heading.level3")),
      "paragraph.body": styleFromRule("paragraph.body", firstRuleByDimension.get("paragraph.body")),
    },
    diagnostics: [],
  }
}
