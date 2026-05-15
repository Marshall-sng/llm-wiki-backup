import { describe, expect, it } from "vitest"

import { buildDocxExportContract } from "@/lib/docx-export-contract"
import { buildDocxExportRecord } from "@/lib/docx-export-record"
import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import { reviewDocxExport } from "@/lib/docx-match-review"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx export record", () => {
  it("captures audit hashes and success status", () => {
    const draft = createDocxExportDraft()
    const formatProfileSnapshot = createDocxFormatProfileSnapshot()
    const contract = buildDocxExportContract({ draft, formatProfileSnapshot, exportId: "export-1", now: 100 })
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot })
    const adapterResult = { adapterId: "stub-adapter", outputPath: "out.docx", sizeBytes: 100 }
    const review = reviewDocxExport({ contract, intermediate, adapterResult })
    const record = buildDocxExportRecord({ contract, intermediate, adapterResult, review, now: 200 })

    expect(record).toMatchObject({
      recordVersion: "docx-export-record.v0",
      exportId: "export-1",
      draftId: draft.id,
      adapterId: "stub-adapter",
      outputPath: "out.docx",
      reviewVerdict: "pass",
      status: "success",
      createdAt: 200,
    })
    expect(record.exportContractHash).toBe(contract.contractHash)
    expect(record.intermediateHash).toBe(intermediate.intermediateHash)
    expect(record.diagnostics).toEqual([])
    expect(JSON.parse(JSON.stringify(record))).toEqual(record)
  })

  it("maps warn and fail reviews to non-success statuses", () => {
    const draft = createDocxExportDraft()
    const formatProfileSnapshot = createDocxFormatProfileSnapshot()
    const contract = buildDocxExportContract({ draft, formatProfileSnapshot, exportId: "export-1", now: 100 })
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot })
    const warningReview = reviewDocxExport({ contract, intermediate, adapterResult: { adapterId: "stub-adapter", knownWarnings: ["style warning"] } })
    const failedReview = reviewDocxExport({ contract, intermediate, adapterResult: { adapterId: "stub-adapter", validationErrors: ["invalid"] } })

    expect(buildDocxExportRecord({ contract, intermediate, adapterResult: { adapterId: "stub-adapter" }, review: warningReview }).status).toBe("warning")
    expect(buildDocxExportRecord({ contract, intermediate, adapterResult: { adapterId: "stub-adapter" }, review: failedReview }).status).toBe("failed")
  })
})
