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
})
