import { describe, expect, it } from "vitest"

import type { DocxExportContract } from "@/lib/docx-export-contract"
import { buildDocxExportContract } from "@/lib/docx-export-contract"
import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import { reviewDocxExport } from "@/lib/docx-match-review"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

function createReviewInput() {
  const draft = createDocxExportDraft()
  const formatProfileSnapshot = createDocxFormatProfileSnapshot()
  const contract = buildDocxExportContract({ draft, formatProfileSnapshot, exportId: "export-1", now: 100 })
  const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot })
  return { contract, intermediate }
}

describe("docx match review", () => {
  it("passes when required sections and format rules are covered", () => {
    const { contract, intermediate } = createReviewInput()
    const review = reviewDocxExport({ contract, intermediate, adapterResult: { adapterId: "stub-adapter", outputPath: "out.docx", sizeBytes: 10 } })

    expect(review.verdict).toBe("pass")
    expect(review.blockingIssues).toEqual([])
    expect(review.sectionReview.missing).toEqual([])
    expect(review.docxValidation.outputPath).toBe("out.docx")
  })

  it("fails when a required section is missing", () => {
    const { contract, intermediate } = createReviewInput()
    const review = reviewDocxExport({
      contract,
      intermediate: { ...intermediate, blocks: intermediate.blocks.filter((block) => !(block.type === "heading" && block.text === "二、平台架构")) },
    })

    expect(review.verdict).toBe("fail")
    expect(review.blockingIssues).toContainEqual(expect.objectContaining({ code: "missing-required-section", section: "二、平台架构" }))
  })

  it("fails uncovered must rules and warns for adapter warnings", () => {
    const { contract, intermediate } = createReviewInput()
    const review = reviewDocxExport({
      contract,
      intermediate: { ...intermediate, blocks: intermediate.blocks.map((block) => ({ ...block, ruleRefs: block.ruleRefs.filter((ruleRef) => ruleRef !== "document-title-rule") })) },
      adapterResult: { adapterId: "stub-adapter", knownWarnings: ["minor style warning"] },
    })

    expect(review.verdict).toBe("fail")
    expect(review.blockingIssues).toContainEqual(expect.objectContaining({ code: "must-rule-uncovered", ruleId: "document-title-rule" }))
    expect(review.warnings).toContainEqual(expect.objectContaining({ code: "docx-validation-warning" }))
  })

  it("blocks forbidden source leakage and validation errors", () => {
    const { contract, intermediate } = createReviewInput()
    const leakingContract = { ...contract, rawSourceText: "full source" } as unknown as DocxExportContract
    const review = reviewDocxExport({
      contract: leakingContract,
      intermediate,
      adapterResult: { adapterId: "stub-adapter", validationErrors: ["invalid package"] },
    })

    expect(review.verdict).toBe("fail")
    expect(review.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "source-leakage" }),
      expect.objectContaining({ code: "docx-validation-error" }),
    ]))
  })

  it("does not block export on non-block boundary/style rules that cannot be covered by document blocks", () => {
    const { contract, intermediate } = createReviewInput()
    const review = reviewDocxExport({
      contract: {
        ...contract,
        formatRules: [
          ...contract.formatRules,
          {
            id: "docx-page-boundary",
            target: "page",
            rule: "页面线索不等于导出版式承诺。",
            detail: "不得自动补造页边距、页眉页脚或精确分页。",
            priority: "must",
          },
          {
            id: "docx-title-boundary",
            target: "title",
            rule: "标题只表达文种和主题。",
            detail: "不得复制来源画像题名。",
            priority: "must",
          },
          {
            id: "docx-typography-boundary",
            target: "typography",
            rule: "字体字号只约束正式程度和可读性。",
            detail: "不得承诺导出复刻。",
            priority: "must",
          },
        ],
      },
      intermediate,
      adapterResult: { adapterId: "stub-adapter", knownWarnings: ["manual-word-openability-not-tested"] },
    })

    expect(review.verdict).toBe("warn")
    expect(review.blockingIssues).toEqual([])
    expect(review.formatCoverage.uncoveredMust).not.toEqual(expect.arrayContaining([
      "docx-page-boundary",
      "docx-title-boundary",
      "docx-typography-boundary",
    ]))
  })

  it("does not warn about table rules when the current draft has no table blocks", () => {
    const draft = createDocxExportDraft([
      "# 无表格文稿",
      "",
      "一、背景",
      "",
      "正文内容。",
    ].join("\n"))
    const formatProfileSnapshot = createDocxFormatProfileSnapshot()
    const contract = buildDocxExportContract({
      draft,
      formatProfileSnapshot: {
        ...formatProfileSnapshot,
        formatSpec: {
          ...formatProfileSnapshot.formatSpec,
          rules: [
            ...formatProfileSnapshot.formatSpec.rules,
            {
              id: "docx-table-readability",
              target: "table",
              rule: "表内文字短语化、字段化。",
              detail: "证据不足时不强制生成表格。",
              source: "standard-default",
              confidence: "medium",
            },
          ],
        },
      },
      exportId: "no-table-export",
      now: 100,
    })
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot })
    const review = reviewDocxExport({ contract, intermediate, adapterResult: { adapterId: "stub-adapter" } })

    expect(review.warnings).not.toContainEqual(expect.objectContaining({ ruleId: "docx-table" }))
    expect(review.warnings).not.toContainEqual(expect.objectContaining({ ruleId: "docx-table-readability" }))
    expect(review.formatCoverage.uncoveredShould).not.toEqual(expect.arrayContaining(["docx-table", "docx-table-readability"]))
  })
})
