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
    expect(result.review.verdict).toBe("warn")
    expect(result.record.status).toBe("warning")
    expect(result.record.exportContractHash).toBe(result.contract.contractHash)
    expect(result.record.intermediateHash).toBe(result.intermediate.intermediateHash)
    expect(containsForbiddenDocxExportLeakage(result)).toBe(false)
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
