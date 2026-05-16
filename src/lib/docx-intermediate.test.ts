import { describe, expect, it } from "vitest"

import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import type { DraftProcessingFormatProfileSnapshot } from "@/lib/format-profile-types"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx intermediate document", () => {
  it("maps markdown draft content into DOCX-oriented blocks with rule refs", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft(),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    expect(intermediate.schemaVersion).toBe("docx-intermediate-document.v0")
    expect(intermediate.blocks[0]).toMatchObject({ type: "documentTitle", text: "云南省数据流通利用基础设施平台介绍" })
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "heading", level: 1, text: "一、背景" }))
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "heading", level: 2, text: "（一）国家全域节点" }))
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "paragraph" }))
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "list", ordered: true, items: ["审核数据资源登记；", "上报至国家全域节点；"] }))
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "list", ordered: false, items: ["保留来源事实边界；", "不承诺视觉复刻；"] }))
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "table", columns: ["项目", "要求"], rows: [["标题", "保持层级"]] }))
    expect(intermediate.blocks.flatMap((block) => block.ruleRefs)).toEqual(expect.arrayContaining([
      "document-title-rule",
      "section-title-rule",
      "subsection-title-rule",
      "ordered-list-rule",
      "unordered-list-rule",
      "table-rule",
    ]))
    expect(intermediate.intermediateHash).toHaveLength(64)
  })

  it("attaches format rule refs only to matching structural roles", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft(),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    const documentTitle = intermediate.blocks.find((block) => block.type === "documentTitle")
    const sectionHeading = intermediate.blocks.find((block) => block.type === "heading" && block.level === 1 && block.text === "一、背景")
    const subsectionHeading = intermediate.blocks.find((block) => block.type === "heading" && block.level === 2)
    const orderedList = intermediate.blocks.find((block) => block.type === "list" && block.ordered)
    const unorderedList = intermediate.blocks.find((block) => block.type === "list" && !block.ordered)

    expect(documentTitle?.ruleRefs).toEqual(["document-title-rule"])
    expect(sectionHeading?.ruleRefs).toEqual(["section-title-rule"])
    expect(subsectionHeading?.ruleRefs).toEqual(["subsection-title-rule"])
    expect(orderedList?.ruleRefs).toEqual(["ordered-list-rule"])
    expect(unorderedList?.ruleRefs).toEqual(["unordered-list-rule"])
  })

  it("uses draft title when markdown has no H1 document title", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft("一、背景\n\n正文"),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    expect(intermediate.blocks[0]).toMatchObject({ type: "documentTitle", text: "云南省数据流通利用基础设施平台介绍" })
    expect(intermediate.diagnostics).toContainEqual(expect.objectContaining({ severity: "info" }))
  })

  it("maps generic DOCX title rules to the document title block", () => {
    const snapshot: DraftProcessingFormatProfileSnapshot = {
      ...createDocxFormatProfileSnapshot(),
      formatSpec: {
        ...createDocxFormatProfileSnapshot().formatSpec,
        rules: [
          {
            id: "docx-title",
            target: "title",
            rule: "主标题独立成行。",
            detail: "标题由当前底稿事实决定。",
            source: "standard-default",
            confidence: "medium",
          },
        ],
      },
    }
    const intermediate = buildDocxIntermediateDocument({ draft: createDocxExportDraft(), formatProfileSnapshot: snapshot })
    expect(intermediate.blocks[0]).toMatchObject({ type: "documentTitle", ruleRefs: ["docx-title"] })
  })

  it("normalizes visual full-width indentation into structural DOCX roles", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft([
        "云南省大数据有限公司简介",
        "",
        "  一、发展定位",
        "",
        "  云南省大数据有限公司是省属国有功能性企业。",
      ].join("\n")),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    expect(intermediate.blocks[0]).toMatchObject({ type: "documentTitle", text: "云南省大数据有限公司简介", formatDimensions: ["title.main"] })
    expect(intermediate.blocks[1]).toMatchObject({ type: "heading", level: 1, text: "一、发展定位", formatDimensions: ["heading.level1"] })
    expect(intermediate.blocks[2]).toMatchObject({ type: "paragraph", text: "云南省大数据有限公司是省属国有功能性企业。", formatDimensions: ["paragraph.body"] })
    expect(JSON.stringify(intermediate.blocks)).not.toContain("  ")
  })

  it("recovers conservative bare-list runs only after colon introductions", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft([
        "# 云南省大数据有限公司简介",
        "",
        "一、发展定位",
        "",
        "省委省政府赋予公司两大核心发展定位：",
        "支撑数字政府建设：作为全省数字政府公共平台和政务信息系统的重要建设运维主体",
        "推进数据要素市场化配置：作为全省公共数据一级开发主体",
        "",
        "二、人才队伍",
      ].join("\n")),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    expect(intermediate.blocks).toContainEqual(expect.objectContaining({
      type: "list",
      ordered: true,
      items: [
        "支撑数字政府建设：作为全省数字政府公共平台和政务信息系统的重要建设运维主体",
        "推进数据要素市场化配置：作为全省公共数据一级开发主体",
      ],
      diagnostics: ["bare-list-recovered"],
      formatDimensions: ["list.numbering"],
    }))
    expect(intermediate.diagnostics).toContainEqual(expect.objectContaining({ message: "Recovered a conservative bare-list run for DOCX export." }))
  })

  it("does not recover narrative paragraphs as bare lists", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft([
        "# 材料",
        "",
        "一、背景",
        "",
        "具体说明如下：",
        "这是一段较长的解释性文字，用来说明背景、目的、范围和依据，不应被改写为列表。",
        "这也是另一段说明性文字，虽然紧跟在冒号之后，但仍然是正文段落。",
      ].join("\n")),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    expect(intermediate.blocks.some((block) => block.type === "list")).toBe(false)
    expect(intermediate.blocks.filter((block) => block.type === "paragraph").map((block) => block.text)).toEqual(expect.arrayContaining([
      "这是一段较长的解释性文字，用来说明背景、目的、范围和依据，不应被改写为列表。",
      "这也是另一段说明性文字，虽然紧跟在冒号之后，但仍然是正文段落。",
    ]))
  })

  it("keeps consecutive numeric lines as ordered lists instead of level-three headings", () => {
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft([
        "# 材料",
        "",
        "一、重点任务",
        "",
        "1. 省级政务云建设",
        "2. 新一代电子政务外网建设",
      ].join("\n")),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
    })

    expect(intermediate.blocks).toContainEqual(expect.objectContaining({ type: "list", ordered: true, items: ["省级政务云建设", "新一代电子政务外网建设"] }))
    expect(intermediate.blocks).not.toContainEqual(expect.objectContaining({ type: "heading", level: 3, text: "1. 省级政务云建设" }))
  })

  it("preserves visible numeric lines as text when only baseline numbering rules exist", () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = profile.formatSpec.rules.map((rule) => (
      rule.id === "ordered-list-rule" ? { ...rule, source: "standard-default" as const, dimension: "list.numbering" as const } : rule
    ))
    const intermediate = buildDocxIntermediateDocument({
      draft: createDocxExportDraft([
        "# 材料",
        "",
        "一、重点任务",
        "",
        "1. 省级政务云建设",
        "2. 新一代电子政务外网建设",
      ].join("\n")),
      formatProfileSnapshot: profile,
    })

    expect(intermediate.blocks).not.toContainEqual(expect.objectContaining({ type: "list", ordered: true }))
    expect(intermediate.blocks).toContainEqual(expect.objectContaining({
      type: "paragraph",
      text: "1. 省级政务云建设",
      autoNumberingIntent: "visible-number-text",
      roleSource: "visible-number-text",
    }))
  })
})
