import { describe, expect, it } from "vitest"

import {
  buildDocxExportContract,
  containsForbiddenDocxExportLeakage,
  deriveDocxRequiredSections,
} from "@/lib/docx-export-contract"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx export contract", () => {
  it("builds a source-bounded contract without raw draft text", () => {
    const draft = createDocxExportDraft()
    const contract = buildDocxExportContract({
      draft,
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
      userInstruction: "不修改正文，只调整格式。",
      exportId: "export-1",
      now: 100,
    })

    expect(contract.contractVersion).toBe("docx-export-contract.v0")
    expect(contract.exportId).toBe("export-1")
    expect(contract.draftContentHash).toBe(draft.source.contentHash)
    expect(contract.referenceCount).toBe(1)
    expect(contract.formatSpecHash).toBe("format-spec-hash-1")
    expect(contract.contentLeakagePolicy).toEqual({ includeSourceBodyText: false, includeRawEvidenceDump: false })
    expect(contract.exportBoundaries).toContain("docx-only")
    expect(contract.requiredSections).toEqual(["一、背景", "二、平台架构", "三、目的与意义"])
    expect(contract.formatRules.map((rule) => rule.id)).toContain("document-title-rule")
    expect(contract.formatRules.find((rule) => rule.id === "document-title-rule")?.priority).toBe("must")
    expect(containsForbiddenDocxExportLeakage(contract)).toBe(false)
    expect(JSON.stringify(contract)).not.toContain(draft.content)
  })

  it("derives stable required Chinese numbered sections", () => {
    expect(deriveDocxRequiredSections("一、背景\n正文\n二、平台架构")).toEqual(["一、背景", "二、平台架构"])
  })

  it("rejects forbidden raw source leakage keys", () => {
    expect(containsForbiddenDocxExportLeakage({ nested: { rawSourceText: "secret" } })).toBe(true)
    expect(containsForbiddenDocxExportLeakage({ nested: { summary: "safe" } })).toBe(false)
  })
})
