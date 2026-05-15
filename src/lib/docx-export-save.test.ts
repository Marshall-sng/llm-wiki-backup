import { describe, expect, it, vi } from "vitest"

import {
  defaultDocxFilename,
  isDocxPath,
  runDocxExportSaveFlow,
  sanitizeDocxFilename,
  uint8ArrayToBase64,
} from "@/lib/docx-export-save"
import type { WriteDocxExportResult } from "@/lib/docx-writer"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function writerResult(verdict: "pass" | "warn" | "fail"): WriteDocxExportResult {
  return {
    bytes: new Uint8Array([80, 75, 3, 4, 255, 0, 128]),
    adapterResult: {
      adapterId: "docx-npm.v1",
      sizeBytes: 7,
      validationErrors: verdict === "fail" ? ["probe-error"] : [],
      knownWarnings: verdict === "warn" ? ["manual-word-openability-not-tested"] : [],
    },
    review: {
      reviewVersion: "docx-match-review.v0",
      verdict,
      blockingIssues: verdict === "fail" ? [{ code: "docx-validation-error", message: "DOCX validation failed" }] : [],
      warnings: verdict === "warn" ? [{ code: "known-warning", message: "Manual Word openability not tested" }] : [],
      sectionReview: { required: [], found: [], missing: [] },
      formatCoverage: { requiredRules: [], coveredRules: [], uncoveredMust: [], uncoveredShould: [] },
      contentBoundaryReview: { includeSourceBodyText: false, includeRawEvidenceDump: false, leakageDetected: false },
      docxValidation: { validationErrors: [], knownWarnings: [] },
      auditRefs: {
        exportContractHash: "contract-hash",
        intermediateHash: "intermediate-hash",
      },
    },
    contract: {} as WriteDocxExportResult["contract"],
    intermediate: {} as WriteDocxExportResult["intermediate"],
    record: {} as WriteDocxExportResult["record"],
  }
}

describe("docx export save helpers", () => {
  it("builds safe default docx filenames and validates exact save paths", () => {
    expect(sanitizeDocxFilename(' A/B:C*D? "E"  ')).toBe("A B C D E")
    expect(defaultDocxFilename("")).toBe("draft.docx")
    expect(defaultDocxFilename("正式文稿")).toBe("正式文稿.docx")
    expect(isDocxPath("D:/out/正式文稿.DOCX")).toBe(true)
    expect(isDocxPath("D:/out/正式文稿")).toBe(false)
  })

  it("converts large byte arrays to base64 without changing bytes", () => {
    const bytes = new Uint8Array(100_000)
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251
    const roundTrip = base64ToUint8Array(uint8ArrayToBase64(bytes))
    expect(roundTrip).toEqual(bytes)
  })

  it("cancels before writer or file write", async () => {
    const writer = vi.fn()
    const writeBinary = vi.fn()
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft() },
      { choosePath: vi.fn(async () => null), writeBinaryFileBase64: writeBinary, writeDocxExportImpl: writer },
    )
    expect(outcome.kind).toBe("cancelled")
    expect(writer).not.toHaveBeenCalled()
    expect(writeBinary).not.toHaveBeenCalled()
  })

  it("blocks non-docx paths without silently mutating the returned path", async () => {
    const writer = vi.fn()
    const writeBinary = vi.fn()
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft() },
      { choosePath: vi.fn(async () => "D:/out/report.txt"), writeBinaryFileBase64: writeBinary, writeDocxExportImpl: writer },
    )
    expect(outcome).toMatchObject({ kind: "failed", path: "D:/out/report.txt" })
    expect(outcome.diagnostics).toContain("invalid-docx-extension")
    expect(writer).not.toHaveBeenCalled()
    expect(writeBinary).not.toHaveBeenCalled()
  })

  it("blocks failed review before writing", async () => {
    const writer = vi.fn(async () => writerResult("fail"))
    const writeBinary = vi.fn()
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft() },
      { choosePath: vi.fn(async () => "D:/out/report.docx"), writeBinaryFileBase64: writeBinary, writeDocxExportImpl: writer },
    )
    expect(outcome.kind).toBe("failed")
    expect(writeBinary).not.toHaveBeenCalled()
  })

  it("writes warning results and forwards active format profile snapshot", async () => {
    const profile = createDocxFormatProfileSnapshot()
    const writer = vi.fn(async () => writerResult("warn"))
    const writeBinary = vi.fn(async () => undefined)
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft(), formatProfileSnapshot: profile },
      { choosePath: vi.fn(async () => "D:/out/report.docx"), writeBinaryFileBase64: writeBinary, writeDocxExportImpl: writer },
    )
    expect(outcome.kind).toBe("warning")
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({ formatProfileSnapshot: profile }))
    expect(writeBinary).toHaveBeenCalledWith("D:/out/report.docx", expect.any(String))
  })

  it("writes pass results as success outcomes", async () => {
    const writeBinary = vi.fn(async () => undefined)
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft() },
      {
        choosePath: vi.fn(async () => "D:/out/report.docx"),
        writeBinaryFileBase64: writeBinary,
        writeDocxExportImpl: vi.fn(async () => writerResult("pass")),
      },
    )
    expect(outcome.kind).toBe("success")
    expect(writeBinary).toHaveBeenCalledOnce()
  })

  it("turns write failures into failed outcomes", async () => {
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft() },
      {
        choosePath: vi.fn(async () => "D:/out/report.docx"),
        writeBinaryFileBase64: vi.fn(async () => { throw new Error("disk full") }),
        writeDocxExportImpl: vi.fn(async () => writerResult("pass")),
      },
    )
    expect(outcome.kind).toBe("failed")
    expect(outcome.diagnostics.join("\n")).toContain("disk full")
  })

  it("deduplicates repeated warning diagnostics", async () => {
    const warningResult = writerResult("warn")
    warningResult.review.warnings = [
      { code: "docx-validation-warning", message: "manual-word-openability-not-tested" },
      { code: "docx-validation-warning", message: "manual-word-openability-not-tested" },
    ]
    warningResult.adapterResult.knownWarnings = [
      "manual-word-openability-not-tested",
      "high-fidelity-style-replica-not-supported",
      "high-fidelity-style-replica-not-supported",
    ]
    const outcome = await runDocxExportSaveFlow(
      { draft: createDocxExportDraft() },
      {
        choosePath: vi.fn(async () => "D:/out/report.docx"),
        writeBinaryFileBase64: vi.fn(async () => undefined),
        writeDocxExportImpl: vi.fn(async () => warningResult),
      },
    )

    expect(outcome.diagnostics).toEqual([
      "manual-word-openability-not-tested",
      "high-fidelity-style-replica-not-supported",
    ])
  })
})
