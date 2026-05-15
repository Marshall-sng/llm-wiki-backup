import { extractXlsxSidecarPayload, writeFile, type XlsxSidecarPayload } from "@/commands/fs"
import { buildXlsxSourceSidecar } from "./xlsx-sidecar"
import { findSourceSidecarsForSource, loadSourceSidecar, persistSourceSidecar, sourceSidecarPath, type SourceSidecarMatch } from "./source-sidecar-persist"
import type { CoverageAuditReport, SourceSidecar, WikiCandidate } from "./source-sidecar-types"
import { projectFirstBatchCompanyWikiCandidate } from "./wiki-candidate-projection"
import { auditFirstBatchCompanyCoverage, toCoverageAuditReviewMetadata } from "./coverage-audit"

export type XlsxPrecisionRolloutMode = "disabled" | "observe" | "block"

export interface EnsureXlsxSidecarDeps {
  extractPayload: (sourcePath: string) => Promise<XlsxSidecarPayload>
  persist: (projectPath: string, sidecar: SourceSidecar) => Promise<string>
  load: (path: string) => Promise<SourceSidecar | null>
  findExistingForSource: (projectPath: string, sourceId: string) => Promise<SourceSidecarMatch[]>
  persistAudit: (path: string, report: unknown) => Promise<void>
}

export interface EnsureXlsxSidecarInput {
  projectPath: string
  sourcePath: string
  enabled?: boolean
  mode?: XlsxPrecisionRolloutMode
  deps?: Partial<EnsureXlsxSidecarDeps>
}

export interface XlsxPrecisionReviewPayload {
  title: string
  description: string
  metadata: Record<string, unknown>
}

export type EnsureXlsxSidecarResult =
  | { status: "disabled"; mode: "disabled"; reason: string }
  | { status: "skipped"; mode: Exclude<XlsxPrecisionRolloutMode, "disabled">; reason: string }
  | {
      status: "fresh" | "written" | "stale-rewritten"
      mode: Exclude<XlsxPrecisionRolloutMode, "disabled">
      path: string
      sidecar: SourceSidecar
      previousSidecar?: SourceSidecar
      candidate?: WikiCandidate
      auditReport?: CoverageAuditReport
      review?: XlsxPrecisionReviewPayload
      wouldBlockPaths: string[]
    }
  | { status: "error"; mode: Exclude<XlsxPrecisionRolloutMode, "disabled">; reason: string; review: XlsxPrecisionReviewPayload; wouldBlockPaths: string[] }

const defaultDeps: EnsureXlsxSidecarDeps = {
  extractPayload: extractXlsxSidecarPayload,
  persist: persistSourceSidecar,
  load: loadSourceSidecar,
  findExistingForSource: findSourceSidecarsForSource,
  persistAudit: async (path, report) => {
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
  },
}

export function isXlsxSourcePath(path: string): boolean {
  return /\.xlsx$/i.test(path.trim())
}

export function resolveXlsxPrecisionRolloutMode(
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
): XlsxPrecisionRolloutMode {
  try {
    const mode = storage?.getItem("llm-wiki.xlsxPrecisionRolloutMode")
    if (mode === "disabled" || mode === "observe" || mode === "block") return mode
    return storage?.getItem("llm-wiki.enableXlsxSourceSidecar") === "true" ? "observe" : "disabled"
  } catch {
    return "disabled"
  }
}

export function readXlsxSourceSidecarFeatureFlag(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): boolean {
  return resolveXlsxPrecisionRolloutMode(storage) !== "disabled"
}

function resolveInputMode(input: EnsureXlsxSidecarInput): XlsxPrecisionRolloutMode {
  if (input.mode !== undefined) return input.mode
  if (input.enabled !== undefined) return input.enabled ? "observe" : "disabled"
  return "disabled"
}

function isFreshSidecar(existing: SourceSidecar | null, next: SourceSidecar): boolean {
  if (existing === null) return false
  return existing.schema_version === next.schema_version
    && existing.source.content_hash === next.source.content_hash
    && existing.source.size_bytes === next.source.size_bytes
}

function reviewPayload(
  sourceId: string,
  title: string,
  description: string,
  metadata: Record<string, unknown>,
): XlsxPrecisionReviewPayload {
  return {
    title,
    description,
    metadata: { sourceId, ...metadata },
  }
}

function auditKey(sourceId: string, status: string): string {
  return `${sourceId}#xlsx-precision-p0#${status}`
}

function buildWouldBlockPaths(sourcePath: string): string[] {
  const fileName = sourcePath.replace(/\\/g, "/").split("/").pop() ?? sourcePath
  const baseName = fileName.replace(/\.[^.]+$/, "")
  return [
    "wiki/entities/*",
    "wiki/concepts/*",
    "wiki/index.md",
    "wiki/overview.md",
    "wiki/log.md",
    `wiki/sources/${baseName}-precision.md`,
  ]
}

export function shouldBlockXlsxPrecisionResult(result: EnsureXlsxSidecarResult): boolean {
  if (result.mode !== "block") return false
  if (result.status === "error") return true
  if (result.status === "skipped") return false
  return result.auditReport?.status !== "passed"
}

export function xlsxPrecisionReviewItem(result: EnsureXlsxSidecarResult): XlsxPrecisionReviewPayload | undefined {
  return "review" in result ? result.review : undefined
}

export async function ensureXlsxSourceSidecarFresh(input: EnsureXlsxSidecarInput): Promise<EnsureXlsxSidecarResult> {
  const mode = resolveInputMode(input)
  if (mode === "disabled") {
    return { status: "disabled", mode, reason: "xlsx precision rollout mode is disabled" }
  }
  if (!isXlsxSourcePath(input.sourcePath)) {
    return { status: "skipped", mode, reason: "source is not .xlsx" }
  }

  const deps = { ...defaultDeps, ...(input.deps ?? {}) }
  try {
    const payload = await deps.extractPayload(input.sourcePath)
    const sidecar = buildXlsxSourceSidecar(payload)
    const path = sourceSidecarPath(input.projectPath, sidecar)
    const existingAtCurrentPath = await deps.load(path)
    const sourceMatches = existingAtCurrentPath === null
      ? await deps.findExistingForSource(input.projectPath, sidecar.source.source_id)
      : []
    const priorMatch = existingAtCurrentPath === null ? sourceMatches[0] : undefined
    const existing = existingAtCurrentPath ?? priorMatch?.sidecar ?? null
    const fresh = isFreshSidecar(existing, sidecar)
    const persistedPath = fresh ? (priorMatch?.path ?? path) : await deps.persist(input.projectPath, sidecar)
    const status = fresh ? "fresh" : existing === null ? "written" : "stale-rewritten"
    const rows = sidecar.domain_rows?.first_batch ?? []
    const wouldBlockPaths = buildWouldBlockPaths(input.sourcePath)

    if (rows.length === 0) {
      const auditPath = `${persistedPath}.audit.json`
      await deps.persistAudit(auditPath, {
        sourceId: sidecar.source.source_id,
        auditPath,
        status: "unsupported_xlsx_schema",
        total_required_field_checks: 0,
        consumed_required_field_checks: 0,
        coverage_ratio: 0,
        missingCount: 1,
        blockingCount: 1,
        fields: ["domain_rows"],
        warnings: sidecar.quality.warnings,
      })
      return {
        status,
        mode,
        path: persistedPath,
        sidecar,
        previousSidecar: existing ?? undefined,
        review: reviewPayload(
          sidecar.source.source_id,
          `Coverage audit failed: ${auditKey(sidecar.source.source_id, "unsupported_xlsx_schema")}`,
          "XLSX sidecar was created, but no supported first-batch table structure was detected.",
          { auditKey: auditKey(sidecar.source.source_id, "unsupported_xlsx_schema"), auditPath, fields: ["domain_rows"], missingCount: 1, blockingCount: 1, sidecarPath: persistedPath, wouldBlockPaths },
        ),
        wouldBlockPaths,
      }
    }

    const candidate = projectFirstBatchCompanyWikiCandidate(sidecar)
    const auditReport = auditFirstBatchCompanyCoverage({
      sourceId: sidecar.source.source_id,
      rows,
      candidate,
      anchors: sidecar.anchors,
      auditPath: `${persistedPath}.audit.json`,
    })
    await deps.persistAudit(auditReport.auditPath ?? `${persistedPath}.audit.json`, auditReport)
    const review = auditReport.status === "passed" ? undefined : reviewPayload(
      sidecar.source.source_id,
      `Coverage audit failed: ${auditKey(sidecar.source.source_id, auditReport.status)}`,
      `XLSX precision audit ${auditReport.status}: ${auditReport.missingCount} missing required field checks.`,
      { ...toCoverageAuditReviewMetadata(auditReport), auditKey: auditKey(sidecar.source.source_id, auditReport.status), sidecarPath: persistedPath, wouldBlockPaths },
    )

    return {
      status,
      mode,
      path: persistedPath,
      sidecar,
      previousSidecar: existing ?? undefined,
      candidate,
      auditReport,
      review,
      wouldBlockPaths,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      status: "error",
      mode,
      reason,
      review: reviewPayload(input.sourcePath, `Coverage audit failed: ${auditKey(input.sourcePath, "extract_error")}`, reason, {
        auditKey: auditKey(input.sourcePath, "extract_error"),
        fields: ["extract_xlsx_sidecar_payload"],
        missingCount: 1,
        blockingCount: 1,
        wouldBlockPaths: buildWouldBlockPaths(input.sourcePath),
      }),
      wouldBlockPaths: buildWouldBlockPaths(input.sourcePath),
    }
  }
}
