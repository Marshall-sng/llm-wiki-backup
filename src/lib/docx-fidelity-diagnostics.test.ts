import { describe, expect, it } from "vitest"

import { containsForbiddenDocxExportLeakage } from "@/lib/docx-export-contract"
import { buildDocxFidelityDiagnostics } from "@/lib/docx-fidelity-diagnostics"
import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import { renderDocxWithTsAdapter } from "@/lib/docx-ts-adapter"
import type { DraftProcessingFormatProfileSnapshot } from "@/lib/format-profile-types"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

async function generatedReport(profile: DraftProcessingFormatProfileSnapshot = createDocxFormatProfileSnapshot()) {
  const draft = createDocxExportDraft()
  const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: profile })
  const rendered = await renderDocxWithTsAdapter(intermediate, draft.title)
  return buildDocxFidelityDiagnostics({ formatProfileSnapshot: profile, intermediate, bytes: rendered.bytes })
}

describe("docx fidelity diagnostics", () => {
  it("builds a versioned JSON-safe non-leaking report from generated DOCX bytes", async () => {
    const report = await generatedReport()

    expect(report.schemaVersion).toBe("docx-fidelity-diagnostics.v0")
    expect(report.reportHash).toBeTruthy()
    expect(report.formatSpecHash).toBe("format-spec-hash-1")
    expect(report.exportedFacts.hasDocumentXml).toBe(true)
    expect(report.exportedFacts.hasStylesXml).toBe(true)
    expect(report.exportedFacts.blockCounts.paragraphCount).toBeGreaterThan(0)
    expect(report.exportedFacts.paragraphFacts.length).toBeGreaterThan(0)
    expect(report.exportedFacts.styleSpacingFacts.length).toBeGreaterThan(0)
    expect(report.exportedFacts.pgMarFacts).toBeTruthy()
    expect(Array.isArray(report.exportedFacts.bucketInputs)).toBe(true)
    expect(report.limitations).toEqual({
      notWordWpsParityValidated: true,
      noManualTemplateRoute: true,
      notFullFidelityClaim: true,
    })
    expect(() => JSON.stringify(report)).not.toThrow()
    expect(containsForbiddenDocxExportLeakage(report)).toBe(false)
    expect(JSON.stringify(report)).not.toContain("word/document.xml")
  })

  it("classifies structural dimensions as restored when exported XML evidence exists", async () => {
    const report = await generatedReport()
    const byDimension = new Map(report.coverage.map((item) => [item.dimension, item]))

    expect(byDimension.get("document-title")?.bucket).toBe("restored")
    expect(byDimension.get("heading")?.bucket).toBe("restored")
    expect(byDimension.get("ordered-list")?.bucket).toBe("restored")
    expect(byDimension.get("unordered-list")?.bucket).toBe("restored")
    expect(byDimension.get("table")?.bucket).toBe("restored")
  })

  it("does not mark exported structure as restored when no source rules exist", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = []
    const report = await generatedReport(profile)

    expect(report.coverage.every((item) => item.bucket === "unverified")).toBe(true)
    expect(report.coverage.find((item) => item.dimension === "document-title")?.reason).toBe("exported-document-title-observed-without-source-expectation")
  })

  it("marks rule-only style expectations as unverified instead of guessing source facts", async () => {
    const report = await generatedReport()
    const typography = report.coverage.find((item) => item.dimension === "typography")
    const page = report.coverage.find((item) => item.dimension === "page")

    expect(typography?.bucket).toBe("unverified")
    expect(typography?.reason).toBe("exported-typography-observed-without-source-attribute-expectation")
    expect(page?.bucket).toBe("unverified")
    expect(page?.reason).toBe("exported-page-margins-observed-without-source-attribute-expectation")
  })

  it("surfaces partial gaps when attribute-level fidelity is expected but not yet matched", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [
      ...profile.formatSpec.rules,
      {
        id: "body-font-rule",
        target: "body-text",
        rule: "正文字体使用仿宋",
        detail: "正文应使用仿宋。",
        source: "detected",
        confidence: "high",
        evidenceRefs: ["style.docx.font.0001"],
        attributes: [{ name: "font", value: "FangSong", confidence: "high", evidenceRefs: ["style.docx.font.0001"] }],
      },
      {
        id: "page-margin-rule",
        target: "page",
        rule: "页面边距保持源文件",
        detail: "页面边距应按源文件设置。",
        source: "detected",
        confidence: "medium",
        evidenceRefs: ["style.docx.page.0001"],
        attributes: [{ name: "margin", value: "1440", unit: "twip", confidence: "medium", evidenceRefs: ["style.docx.page.0001"] }],
      },
    ]

    const report = await generatedReport(profile)
    const byDimension = new Map(report.coverage.map((item) => [item.dimension, item]))

    expect(byDimension.get("typography")?.bucket).toBe("partial")
    expect(byDimension.get("page")?.bucket).toBe("partial")
    expect(report.e2PriorityGaps.some((gap) => gap.dimension === "typography")).toBe(true)
    expect(report.e2PriorityGaps.some((gap) => gap.dimension === "page")).toBe(true)
  })

  it("uses canonical rule dimensions before legacy inference in source inventory", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [
      {
        id: "ambiguous-title-rule",
        target: "title",
        dimension: "title.main",
        rule: "主标题样式",
        detail: "主标题应使用正式标题样式。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "fontFamily", value: "方正小标宋简体", confidence: "high" }],
      },
      {
        id: "ambiguous-page-rule",
        target: "page",
        dimension: "page.margin",
        rule: "页边距",
        detail: "页边距保留来源语义。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "marginTopCm.detectedLayout", value: "2.54", unit: "cm", confidence: "high" }],
      },
      {
        id: "level-one-rule",
        target: "heading",
        dimension: "heading.level1",
        rule: "一级标题",
        detail: "一级标题使用一、层级。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "numberingPattern", value: "一、", confidence: "high" }],
      },
    ]

    const report = await generatedReport(profile)
    const byRuleId = new Map(report.sourceInventory.map((item) => [item.ruleId, item]))

    expect(byRuleId.get("ambiguous-title-rule")?.dimension).toBe("title.main")
    expect(byRuleId.get("ambiguous-page-rule")?.dimension).toBe("page.margin")
    expect(byRuleId.get("level-one-rule")?.dimension).toBe("heading.level1")
  })

  it("evaluates canonical E2 dimensions with observable exported DOCX evidence", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [
      {
        id: "canonical-title",
        target: "title",
        dimension: "title.main",
        rule: "主标题样式",
        detail: "主标题应独立居中。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "fontSizePt", value: "22", unit: "pt", confidence: "high" }],
      },
      {
        id: "canonical-heading1",
        target: "heading",
        dimension: "heading.level1",
        rule: "一级标题样式",
        detail: "一级标题应使用一、层级。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "fontSizePt", value: "16", unit: "pt", confidence: "high" }],
      },
      {
        id: "canonical-heading2",
        target: "heading",
        dimension: "heading.level2",
        rule: "二级标题样式",
        detail: "二级标题应使用（一）层级。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "fontSizePt", value: "16", unit: "pt", confidence: "high" }],
      },
      {
        id: "canonical-body",
        target: "paragraph",
        dimension: "paragraph.body",
        rule: "正文样式",
        detail: "正文应包含缩进和行距。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "firstLineIndentChars", value: "2", confidence: "high" }],
      },
      {
        id: "canonical-list",
        target: "numbering",
        dimension: "list.numbering",
        rule: "编号列表",
        detail: "列表应保留编号。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "numberingContinuity", value: "required", confidence: "high" }],
      },
    ]

    const report = await generatedReport(profile)
    const byDimension = new Map(report.coverage.map((item) => [item.dimension, item]))

    expect(byDimension.get("title.main")?.bucket).toBe("restored")
    expect(byDimension.get("heading.level1")?.bucket).toBe("restored")
    expect(byDimension.get("heading.level2")?.bucket).toBe("restored")
    expect(byDimension.get("paragraph.body")?.bucket).toBe("restored")
    expect(byDimension.get("list.numbering")?.bucket).toBe("missing")
    expect(byDimension.get("list.numbering")?.reason).toBe("list-numbering-expected-but-numbering-missing")
  })

  it("restores list numbering only when the source rule is explicit rather than a baseline default", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = profile.formatSpec.rules.map((rule) => (
      rule.id === "ordered-list-rule"
        ? { ...rule, source: "detected" as const, dimension: "list.numbering" as const }
        : rule
    ))

    const report = await generatedReport(profile)
    const list = report.coverage.find((item) => item.dimension === "list.numbering")

    expect(list?.bucket).toBe("restored")
    expect(report.exportedFacts.bucketInputs).toContainEqual(expect.objectContaining({
      dimension: "list.numbering",
      matched: true,
    }))
  })

  it("keeps heading3 and table readability as observable canonical dimensions", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [
      ...profile.formatSpec.rules,
      {
        id: "canonical-heading3",
        target: "heading",
        dimension: "heading.level3",
        rule: "三级标题样式",
        detail: "三级标题应保留结构角色。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "fontSizePt", value: "16", unit: "pt", confidence: "high" }],
      },
      {
        id: "canonical-table",
        target: "table",
        dimension: "table.readability",
        rule: "表格可读性",
        detail: "表格应保留行列结构。",
        source: "standard-default",
        confidence: "high",
        attributes: [{ name: "tablePurpose", value: "matrix", confidence: "high" }],
      },
    ]
    const draft = createDocxExportDraft([
      "# 材料",
      "",
      "一、背景",
      "",
      "1. 三级标题",
      "",
      "正文段落。",
      "",
      "| 项目 | 要求 |",
      "| :--- | :--- |",
      "| 标题 | 保持层级 |",
    ].join("\n"))
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: profile })
    const rendered = await renderDocxWithTsAdapter(intermediate, draft.title)
    const report = await buildDocxFidelityDiagnostics({ formatProfileSnapshot: profile, intermediate, bytes: rendered.bytes })
    const byDimension = new Map(report.coverage.map((item) => [item.dimension, item]))

    expect(byDimension.get("heading.level3")?.bucket).toBe("restored")
    expect(byDimension.get("table.readability")?.bucket).toBe("restored")
  })

  it("classifies a known expected table as missing when exported DOCX has no table", async () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = profile.formatSpec.rules.filter((rule) => rule.target === "table")
    const draft = createDocxExportDraft([
      "# 无表格文稿",
      "",
      "一、背景",
      "",
      "这里只包含正文，不包含表格。",
    ].join("\n"))
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: profile })
    const rendered = await renderDocxWithTsAdapter(intermediate, draft.title)
    const report = await buildDocxFidelityDiagnostics({ formatProfileSnapshot: profile, intermediate, bytes: rendered.bytes })
    const table = report.coverage.find((item) => item.dimension === "table")

    expect(table?.bucket).toBe("missing")
    expect(table?.reason).toBe("table-expected-but-not-exported")
  })
})
