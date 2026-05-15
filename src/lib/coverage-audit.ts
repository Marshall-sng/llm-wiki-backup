import type { CoverageAuditCheck, CoverageAuditReport, EvidenceRef, FirstBatchCompanyRow } from "./source-sidecar-types"

export interface IgnoredCoverageCheck {
  row_anchor_id: string
  field: string
  expected?: string
  reason?: string
  evidenceRefs?: EvidenceRef[]
}

export interface FirstBatchCoverageAuditInput {
  sourceId: string
  candidateText: string
  rows: FirstBatchCompanyRow[]
  auditPath?: string
  ignored?: IgnoredCoverageCheck[]
  passRatio?: number
}

interface RequiredValue {
  row: FirstBatchCompanyRow
  field: string
  value: string
  severity: CoverageAuditCheck["severity"]
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

function includesValue(haystack: string, value: string): boolean {
  return normalized(haystack).includes(normalized(value))
}

function requiredValuesForRow(row: FirstBatchCompanyRow): RequiredValue[] {
  const values: RequiredValue[] = [
    { row, field: "enterprise_name", value: row.enterprise_name, severity: "blocking" },
    { row, field: "project_name", value: row.project_name, severity: "blocking" },
    { row, field: "industry", value: row.industry, severity: "review" },
    { row, field: "original_serial", value: row.original_serial, severity: "review" },
  ]

  for (const contact of row.contacts) {
    values.push({ row, field: "contact", value: contact, severity: "review" })
  }

  for (const phone of row.phones) {
    values.push({ row, field: "phone", value: phone, severity: "review" })
  }

  for (const worksheet of row.source_worksheets) {
    values.push({ row, field: "source_worksheet", value: worksheet, severity: "review" })
  }

  return values.filter((item) => item.value.trim().length > 0)
}

function findUsableIgnore(value: RequiredValue, ignored: IgnoredCoverageCheck[]): IgnoredCoverageCheck | undefined {
  return ignored.find((item) => {
    const fieldMatches = item.row_anchor_id === value.row.row_anchor_id && item.field === value.field
    const valueMatches = item.expected === undefined || item.expected === value.value
    const hasReason = item.reason !== undefined && item.reason.trim().length > 0
    const hasAnchorRef = (item.evidenceRefs ?? []).some((ref) => ref.anchor_id.trim().length > 0)
    return fieldMatches && valueMatches && hasReason && hasAnchorRef
  })
}

export function auditFirstBatchCompanyCoverage(input: FirstBatchCoverageAuditInput): CoverageAuditReport {
  const requiredValues = input.rows.flatMap(requiredValuesForRow)
  const checks: CoverageAuditCheck[] = requiredValues.map((required, index) => {
    const checkId = `${required.row.row_id}:${required.field}:${index}`
    if (includesValue(input.candidateText, required.value)) {
      return {
        check_id: checkId,
        row_anchor_id: required.row.row_anchor_id,
        field: required.field,
        expected: required.value,
        severity: required.severity,
        status: "covered",
        evidenceRefs: [{
          source_id: required.row.source_id,
          anchor_id: required.row.row_anchor_id,
          selector: { row_id: required.row.row_id },
          quote_preview: required.value,
        }],
      }
    }

    const usableIgnore = findUsableIgnore(required, input.ignored ?? [])
    if (usableIgnore !== undefined) {
      return {
        check_id: checkId,
        row_anchor_id: required.row.row_anchor_id,
        field: required.field,
        expected: required.value,
        severity: required.severity,
        status: "ignored_with_reason",
        evidenceRefs: usableIgnore.evidenceRefs ?? [],
        reason: usableIgnore.reason,
      }
    }

    return {
      check_id: checkId,
      row_anchor_id: required.row.row_anchor_id,
      field: required.field,
      expected: required.value,
      severity: required.severity,
      status: "missing",
      evidenceRefs: [],
    }
  })

  const consumed = checks.filter((check) => check.status === "covered" || check.status === "ignored_with_reason").length
  const missingChecks = checks.filter((check) => check.status === "missing")
  const ignoredChecks = checks.filter((check) => check.status === "ignored_with_reason")
  const blockingCount = missingChecks.filter((check) => check.severity === "blocking").length
  const reviewCount = missingChecks.filter((check) => check.severity === "review").length
  const coverageRatio = checks.length === 0 ? 1 : consumed / checks.length
  const passRatio = input.passRatio ?? 0.95
  const status: CoverageAuditReport["status"] = coverageRatio >= passRatio && blockingCount === 0
    ? "passed"
    : coverageRatio < 0.75 || blockingCount > 0
      ? "failed"
      : "needs_review"

  return {
    sourceId: input.sourceId,
    auditPath: input.auditPath,
    total_required_field_checks: checks.length,
    consumed_required_field_checks: consumed,
    coverage_ratio: coverageRatio,
    missingCount: missingChecks.length,
    blockingCount,
    reviewCount,
    status,
    checks,
    missingChecks,
    ignoredChecks,
  }
}

export function toCoverageAuditReviewMetadata(report: CoverageAuditReport): Record<string, unknown> {
  return {
    sourceId: report.sourceId,
    auditPath: report.auditPath,
    missingCount: report.missingCount,
    blockingCount: report.blockingCount,
    fields: Array.from(new Set(report.missingChecks.map((check) => check.field))),
    anchorIds: Array.from(new Set(report.missingChecks.map((check) => check.row_anchor_id))),
  }
}
