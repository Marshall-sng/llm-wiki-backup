import type { DraftRecord } from "@/lib/draft-types"
import type { DraftProcessingFormatProfileSnapshot } from "@/lib/format-profile-types"
import { writeDocxExport } from "@/lib/docx-writer"
import type { WriteDocxExportInput, WriteDocxExportResult } from "@/lib/docx-writer"

export type DocxExportSaveOutcomeKind = "cancelled" | "success" | "warning" | "failed"

export interface DocxExportSaveOutcome {
  kind: DocxExportSaveOutcomeKind
  path?: string
  sizeBytes?: number
  diagnostics: string[]
  result?: WriteDocxExportResult
}

export interface RunDocxExportSaveFlowDeps {
  choosePath: (defaultPath: string) => Promise<string | null>
  writeBinaryFileBase64: (path: string, contentsBase64: string) => Promise<void>
  writeDocxExportImpl?: (input: WriteDocxExportInput) => Promise<WriteDocxExportResult>
}

export interface RunDocxExportSaveFlowInput {
  draft: DraftRecord
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
}

export function sanitizeDocxFilename(title: string): string {
  const safe = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
  return (safe || "draft").slice(0, 120)
}

export function defaultDocxFilename(title: string): string {
  return `${sanitizeDocxFilename(title)}.docx`
}

export function isDocxPath(path: string): boolean {
  return /\.docx$/i.test(path.trim())
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function issueDiagnostics(result: WriteDocxExportResult): string[] {
  return [...new Set([
    ...result.review.blockingIssues.map((issue) => issue.message),
    ...result.review.warnings.map((warning) => warning.message),
    ...result.adapterResult.knownWarnings ?? [],
  ].filter(Boolean))]
}

export async function runDocxExportSaveFlow(
  input: RunDocxExportSaveFlowInput,
  deps: RunDocxExportSaveFlowDeps,
): Promise<DocxExportSaveOutcome> {
  const selectedPath = await deps.choosePath(defaultDocxFilename(input.draft.title))
  if (!selectedPath) return { kind: "cancelled", diagnostics: [] }
  if (!isDocxPath(selectedPath)) {
    return { kind: "failed", path: selectedPath, diagnostics: ["invalid-docx-extension"] }
  }

  const writer = deps.writeDocxExportImpl ?? writeDocxExport
  let result: WriteDocxExportResult
  try {
    result = await writer({ draft: input.draft, formatProfileSnapshot: input.formatProfileSnapshot })
  } catch (error) {
    return { kind: "failed", path: selectedPath, diagnostics: [`docx-export-failed:${error instanceof Error ? error.message : String(error)}`] }
  }

  if (result.review.verdict === "fail") {
    return { kind: "failed", path: selectedPath, diagnostics: issueDiagnostics(result), result }
  }

  try {
    await deps.writeBinaryFileBase64(selectedPath, uint8ArrayToBase64(result.bytes))
  } catch (error) {
    return { kind: "failed", path: selectedPath, diagnostics: [`docx-write-failed:${error instanceof Error ? error.message : String(error)}`], result }
  }

  return {
    kind: result.review.verdict === "warn" ? "warning" : "success",
    path: selectedPath,
    sizeBytes: result.bytes.byteLength,
    diagnostics: issueDiagnostics(result),
    result,
  }
}
