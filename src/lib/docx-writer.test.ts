import { describe, expect, it } from "vitest"

import { containsForbiddenDocxExportLeakage } from "@/lib/docx-export-contract"
import { DOCX_NPM_ADAPTER_ID } from "@/lib/docx-ts-adapter"
import { mergeDocxAdapterAndProbeResult, writeDocxExport } from "@/lib/docx-writer"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx writer", () => {
  it("runs the full library-only DOCX export pipeline", async () => {
    const result = await writeDocxExport({
      draft: createDocxExportDraft(),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
      userInstruction: "不修改正文，只导出 DOCX。",
      exportId: "writer-test-export",
      now: 100,
    })

    expect(result.contract.exportId).toBe("writer-test-export")
    expect(result.intermediate.blocks.length).toBeGreaterThan(0)
    expect(result.bytes.byteLength).toBeGreaterThan(1000)
    expect(result.adapterResult.adapterId).toBe(DOCX_NPM_ADAPTER_ID)
    expect(result.adapterResult.outputPath).toBeUndefined()
    expect(result.adapterResult.validationErrors).toEqual([])
    expect(result.fidelityDiagnostics.schemaVersion).toBe("docx-fidelity-diagnostics.v0")
    expect(result.fidelityDiagnostics.gaps.map((gap) => gap.reason)).not.toContain("docx-validation-error")
    expect(result.review.verdict).toBe("warn")
    expect(result.record.status).toBe("warning")
    expect(result.record.exportContractHash).toBe(result.contract.contractHash)
    expect(result.record.intermediateHash).toBe(result.intermediate.intermediateHash)
    expect(containsForbiddenDocxExportLeakage(result)).toBe(false)
  })

  it("validates exported visible text after markdown emphasis and wiki links are normalized", async () => {
    const result = await writeDocxExport({
      draft: createDocxExportDraft([
        "# 云南省大数据有限公司简介",
        "",
        "  **云南省大数据有限公司**是经云南省委、省政府批准，于2023年9月13日正式注册成立的省属国有功能性企业。公司由[[云南省国资委]]和[[中国电子信息产业集团有限公司|中国电子]]共同持股[1][3]。",
        "",
        "  一、发展定位",
        "",
        "  （一）核心定位",
        "",
        "  省委省政府赋予公司两大核心发展定位[1]：",
        "",
        "**支撑数字政府建设**：作为全省数字政府公共平台和政务信息系统的重要建设运维主体。",
        "[[云南省数据流通利用基础设施平台]]建设。",
      ].join("\n")),
      formatProfileSnapshot: createDocxFormatProfileSnapshot(),
      exportId: "writer-inline-normalization",
      now: 100,
    })

    expect(result.adapterResult.validationErrors).toEqual([])
    expect(result.review.verdict).toBe("warn")
    expect(result.record.status).toBe("warning")
  })

  it("merges probe validation errors into adapter metadata before review", () => {
    const merged = mergeDocxAdapterAndProbeResult(
      { adapterId: DOCX_NPM_ADAPTER_ID, sizeBytes: 10, validationErrors: ["adapter-error"], knownWarnings: ["adapter-warning"] },
      { validationErrors: ["probe-error", "adapter-error"], knownWarnings: ["probe-warning", "adapter-warning"] },
    )

    expect(merged.validationErrors).toEqual(["adapter-error", "probe-error"])
    expect(merged.knownWarnings).toEqual(["adapter-warning", "probe-warning"])
  })
})
