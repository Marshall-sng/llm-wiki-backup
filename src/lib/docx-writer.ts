import type { DraftRecord } from "@/lib/draft-types"
import type { DraftProcessingFormatProfileSnapshot } from "@/lib/format-profile-types"
import { buildDocxExportContract } from "@/lib/docx-export-contract"
import type { DocxExportContract } from "@/lib/docx-export-contract"
import { buildDocxFidelityDiagnostics } from "@/lib/docx-fidelity-diagnostics"
import type { DocxFidelityDiagnosticsReport } from "@/lib/docx-fidelity-diagnostics"
import { buildDocxExportRecord } from "@/lib/docx-export-record"
import type { DocxExportRecord } from "@/lib/docx-export-record"
import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import type { DocxIntermediateDocument } from "@/lib/docx-intermediate"
import { probeDocxPackage } from "@/lib/docx-package-probe"
import type { DocxPackageProbeExpectations } from "@/lib/docx-package-probe"
import { normalizeDocxInlineText, parseDocxInlineSegments, renderDocxWithTsAdapter } from "@/lib/docx-ts-adapter"
import { reviewDocxExport } from "@/lib/docx-match-review"
import type { DocxAdapterResultLike, DocxMatchReview } from "@/lib/docx-match-review"

export interface WriteDocxExportInput {
  draft: DraftRecord
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
  userInstruction?: string
  exportId?: string
  now?: number
}

export interface WriteDocxExportResult {
  contract: DocxExportContract
  intermediate: DocxIntermediateDocument
  adapterResult: DocxAdapterResultLike
  fidelityDiagnostics: DocxFidelityDiagnosticsReport
  review: DocxMatchReview
  record: DocxExportRecord
  bytes: Uint8Array
}

export function mergeDocxAdapterAndProbeResult(
  adapterResult: DocxAdapterResultLike,
  probeResult: { validationErrors: string[]; knownWarnings: string[] },
): DocxAdapterResultLike {
  return {
    ...adapterResult,
    validationErrors: [...new Set([...(adapterResult.validationErrors ?? []), ...probeResult.validationErrors])],
    knownWarnings: [...new Set([...(adapterResult.knownWarnings ?? []), ...probeResult.knownWarnings])],
  }
}

export async function writeDocxExport(input: WriteDocxExportInput): Promise<WriteDocxExportResult> {
  const contract = buildDocxExportContract({
    draft: input.draft,
    formatProfileSnapshot: input.formatProfileSnapshot,
    userInstruction: input.userInstruction,
    exportId: input.exportId,
    now: input.now,
  })
  const intermediate = buildDocxIntermediateDocument({ draft: input.draft, formatProfileSnapshot: input.formatProfileSnapshot })
  const rendered = await renderDocxWithTsAdapter(intermediate, contract.draftTitle)
  const probe = await probeDocxPackage(rendered.bytes, buildProbeExpectations(intermediate))
  const fidelityDiagnostics = await buildDocxFidelityDiagnostics({
    formatProfileSnapshot: input.formatProfileSnapshot,
    intermediate,
    bytes: rendered.bytes,
  })
  const adapterResult = mergeDocxAdapterAndProbeResult(rendered.adapterResult, probe)
  const review = reviewDocxExport({ contract, intermediate, adapterResult })
  const record = buildDocxExportRecord({ contract, intermediate, adapterResult, review, now: input.now })
  return { contract, intermediate, adapterResult, fidelityDiagnostics, review, record, bytes: rendered.bytes }
}

function buildProbeExpectations(intermediate: DocxIntermediateDocument): DocxPackageProbeExpectations {
  const title = intermediate.blocks.find((block) => block.type === "documentTitle")
  const headings = intermediate.blocks.filter((block) => block.type === "heading")
  const paragraphs = intermediate.blocks.filter((block) => block.type === "paragraph")
  const subsectionHeadings = headings.filter((block) => block.level >= 3 || /^（.+）/.test(block.text))
  return {
    documentTitle: title ? normalizeDocxInlineText(title.text) : undefined,
    level1Headings: headings.filter((block) => !subsectionHeadings.includes(block)).slice(0, 3).map((block) => normalizeDocxInlineText(block.text)),
    level2Headings: subsectionHeadings.slice(0, 3).map((block) => normalizeDocxInlineText(block.text)),
    paragraphSnippets: paragraphs.slice(0, 3).map((block) => firstProbeVisibleRun(block.text)),
    requireOrderedList: intermediate.blocks.some((block) => block.type === "list" && block.ordered),
    requireUnorderedList: intermediate.blocks.some((block) => block.type === "list" && !block.ordered),
    requireTable: intermediate.blocks.some((block) => block.type === "table"),
  }
}

function firstProbeVisibleRun(text: string): string {
  const segment = parseDocxInlineSegments(text).map((item) => item.text.trim()).find(Boolean)
  return (segment || normalizeDocxInlineText(text)).slice(0, 24)
}
