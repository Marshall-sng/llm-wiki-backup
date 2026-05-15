import type { CoverageAuditReport, WikiCandidate } from "./source-sidecar-types"

function frontmatterValue(value: string | number): string {
  return typeof value === "number" ? String(value) : JSON.stringify(value)
}

export interface XlsxPrecisionPageInput {
  sourceFileName: string
  sourceBaseName: string
  sourceId: string
  sidecarPath: string
  auditPath: string
  candidate: WikiCandidate
  auditReport: CoverageAuditReport
}

export function xlsxPrecisionPagePath(sourceBaseName: string): string {
  return `wiki/sources/${sourceBaseName}-precision.md`
}

export function renderXlsxPrecisionPage(input: XlsxPrecisionPageInput): string {
  const lines = [
    "---",
    "type: source-precision",
    `title: ${frontmatterValue(`${input.sourceBaseName} 精准事实页`)}`,
    `source: ${frontmatterValue(input.sourceFileName)}`,
    `sourceId: ${frontmatterValue(input.sourceId)}`,
    `sidecarPath: ${frontmatterValue(input.sidecarPath)}`,
    `auditPath: ${frontmatterValue(input.auditPath)}`,
    `coverageRatio: ${input.auditReport.coverage_ratio}`,
    "generatedBy: xlsx-precision-p0",
    "---",
    "",
    `# ${input.sourceBaseName} 精准事实页`,
    "",
    `- 覆盖率：${input.auditReport.coverage_ratio}`,
    `- 必检字段：${input.auditReport.total_required_field_checks}`,
    `- 缺失字段：${input.auditReport.missingCount}`,
    "",
  ]

  for (const entity of input.candidate.entityCandidates) {
    lines.push(`## ${entity.name}`)
    lines.push(`- evidence: ${entity.evidenceRefs.map((ref) => ref.anchor_id).join(", ")}`)
    const facts = input.candidate.factCandidates.filter((fact) => fact.subject === entity.name)
    for (const fact of facts) {
      const value = Array.isArray(fact.object) ? fact.object.join("、") : String(fact.object)
      const refs = fact.evidenceRefs.map((ref) => ref.anchor_id).join(", ")
      lines.push(`- ${fact.predicate}: ${value} _(evidence: ${refs})_`)
    }
    lines.push("")
  }

  lines.push("## Evidence Debug")
  for (const ref of input.candidate.evidenceRefs) {
    lines.push(`- ${ref.anchor_id}: ${ref.quote_preview ?? ""}`)
  }
  return `${lines.join("\n").trimEnd()}\n`
}
