import type { DocxExportContract } from "@/lib/docx-export-contract"
import type { DocxIntermediateDocument } from "@/lib/docx-intermediate"
import type { DocxAdapterResultLike, DocxMatchReview, DocxReviewIssue } from "@/lib/docx-match-review"

export const DOCX_EXPORT_RECORD_VERSION = "docx-export-record.v0" as const

export interface DocxExportRecord {
  recordVersion: typeof DOCX_EXPORT_RECORD_VERSION
  exportId: string
  draftId: string
  draftTitle: string
  draftContentHash: string
  formatProfileId?: string
  formatSpecHash?: string
  exportContractHash: string
  intermediateHash: string
  outputPath?: string
  adapterId: string
  createdAt: number
  reviewVerdict: "pass" | "warn" | "fail"
  status: "success" | "warning" | "failed"
  diagnostics: DocxReviewIssue[]
}

export interface BuildDocxExportRecordInput {
  contract: DocxExportContract
  intermediate: DocxIntermediateDocument
  adapterResult: DocxAdapterResultLike
  review: DocxMatchReview
  now?: number
}

export function buildDocxExportRecord(input: BuildDocxExportRecordInput): DocxExportRecord {
  const { contract, intermediate, adapterResult, review } = input
  const status = review.verdict === "fail" ? "failed" : review.verdict === "warn" ? "warning" : "success"
  return {
    recordVersion: DOCX_EXPORT_RECORD_VERSION,
    exportId: contract.exportId,
    draftId: contract.draftId,
    draftTitle: contract.draftTitle,
    draftContentHash: contract.draftContentHash,
    ...(contract.formatProfileId ? { formatProfileId: contract.formatProfileId } : {}),
    ...(contract.formatSpecHash ? { formatSpecHash: contract.formatSpecHash } : {}),
    exportContractHash: contract.contractHash,
    intermediateHash: intermediate.intermediateHash,
    ...(adapterResult.outputPath ? { outputPath: adapterResult.outputPath } : {}),
    adapterId: adapterResult.adapterId,
    createdAt: input.now ?? Date.now(),
    reviewVerdict: review.verdict,
    status,
    diagnostics: [...review.blockingIssues, ...review.warnings],
  }
}
