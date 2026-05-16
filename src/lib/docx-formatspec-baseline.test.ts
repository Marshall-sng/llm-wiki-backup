import { describe, expect, it } from "vitest"

import {
  auditDocxFormatSpecBaseline,
  buildDocxFormalBaselineRules,
  DOCX_BASELINE_DIMENSIONS,
  ensureDocxFormatSpecBaseline,
  normalizeDocxBaselineDimension,
} from "@/lib/docx-formatspec-baseline"
import type { FormatSpecRule } from "@/lib/format-profile-types"

describe("docx FormatSpec baseline", () => {
  it("defines the formal DOCX minimum baseline dimensions with executable attributes", () => {
    const rules = buildDocxFormalBaselineRules()
    const byDimension = new Map(rules.map((rule) => [rule.dimension, rule]))

    expect(rules).toHaveLength(DOCX_BASELINE_DIMENSIONS.length)
    for (const dimension of DOCX_BASELINE_DIMENSIONS) {
      expect(byDimension.has(dimension)).toBe(true)
      expect(byDimension.get(dimension)?.attributes?.length).toBeGreaterThan(0)
    }
    expect(byDimension.get("title.main")?.attributes?.map((item) => item.name)).toEqual(expect.arrayContaining(["fontFamily", "fontSizePt", "alignment", "lineSpacingPt"]))
    expect(byDimension.get("paragraph.body")?.attributes?.map((item) => item.name)).toEqual(expect.arrayContaining(["fontFamily", "fontSizePt", "firstLineIndentChars", "lineSpacingPt"]))
    expect(byDimension.get("page.margin")?.attributes?.map((item) => item.name)).toEqual(expect.arrayContaining([
      "marginTopCm.detectedLayout",
      "marginTopCm.instructionalText",
      "marginConflict",
    ]))
  })

  it("audits and fills missing dimensions without overriding source-specific attributes", () => {
    const sourceRule: FormatSpecRule = {
      id: "source-margin-rule",
      target: "page",
      normType: "page-margin",
      dimension: "page.margin",
      rule: "来源页边距优先",
      detail: "当前来源文件提供了页边距。",
      source: "detected",
      confidence: "high",
      attributes: [{ name: "marginTopCm.detectedLayout", value: "3.90", unit: "cm", confidence: "high" }],
    }

    const result = ensureDocxFormatSpecBaseline([sourceRule])
    const audit = auditDocxFormatSpecBaseline(result.rules)

    expect(audit.verdict).toBe("pass")
    expect(audit.missingDimensions).toEqual([])
    expect(result.rules.filter((rule) => rule.dimension === "page.margin")).toEqual([sourceRule])
    expect(result.rules.some((rule) => rule.dimension === "title.main" && rule.id.startsWith("docx-baseline-"))).toBe(true)
  })

  it("does not let weak overlay attributes suppress a stronger baseline dimension", () => {
    const weakOverlayRule: FormatSpecRule = {
      id: "llm-paragraph-spacing",
      target: "paragraph",
      normType: "spacing",
      rule: "段落需要稳定行距",
      detail: "只有 spacing 线索，不含正文必要字体字号。",
      source: "inferred",
      confidence: "medium",
      attributes: [{ name: "lineSpacing", value: "stable", confidence: "medium" }],
    }

    const result = ensureDocxFormatSpecBaseline([weakOverlayRule])
    const paragraphRules = result.rules.filter((rule) => rule.dimension === "paragraph.body")

    expect(paragraphRules.some((rule) => rule.id === "llm-paragraph-spacing")).toBe(true)
    expect(paragraphRules.some((rule) => rule.id === "docx-baseline-paragraph-body")).toBe(true)
    expect(result.audit.verdict).toBe("pass")
  })

  it("uses conservative dimension normalization and rejects ambiguous rules as coverage", () => {
    expect(normalizeDocxBaselineDimension({
      id: "docx-page-size",
      target: "page",
      rule: "页面规格",
      detail: "A4",
      source: "detected",
      confidence: "high",
    })).toBe("page.size")
    expect(normalizeDocxBaselineDimension({
      id: "ambiguous-title",
      target: "title",
      rule: "标题",
      detail: "无法区分主副标题",
      source: "inferred",
      confidence: "medium",
    })).toBeUndefined()
    expect(normalizeDocxBaselineDimension({
      id: "ambiguous-page",
      target: "page",
      rule: "页面",
      detail: "无法区分页大小或边距",
      source: "inferred",
      confidence: "medium",
    })).toBeUndefined()
  })
})
