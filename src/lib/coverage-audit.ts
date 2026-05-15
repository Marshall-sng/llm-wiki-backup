import type {
  CoverageAuditCheck,
  CoverageAuditReport,
  EntityCandidate,
  EvidenceAnchor,
  EvidenceRef,
  FactCandidate,
  FirstBatchCompanyRow,
  WikiCandidate,
} from "./source-sidecar-types"

export interface IgnoredCoverageCheck {
  row_anchor_id: string
  field: string
  expected?: string
  reason?: string
  evidenceRefs?: EvidenceRef[]
}

export interface FirstBatchCoverageAuditInput {
  sourceId: string
  rows: FirstBatchCompanyRow[]
  candidate?: Pick<WikiCandidate, "entityCandidates" | "factCandidates">
  anchors?: EvidenceAnchor[]
  /** Diagnostic/legacy context only. Plain text is never counted as coverage evidence. */
  candidateText?: string
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

const fieldPredicates: Record<string, string[]> = {
  project_name: ["project_name", "project_component"],
  industry: ["industry"],
  original_serial: ["original_serial"],
  contact: ["contact"],
  phone: ["phone"],
  source_worksheet: ["source_worksheet"],
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

function includesValue(haystack: string, value: string): boolean {
  return normalized(haystack).includes(normalized(value))
}

function objectContainsValue(object: FactCandidate["object"], value: string): boolean {
  if (typeof object === "string") return includesValue(object, value)
  if (typeof object === "number" || typeof object === "boolean") return String(object) === value
  if (Array.isArray(object)) return object.some((item) => includesValue(item, value))
  return JSON.stringify(object).includes(value)
}

function requiredValuesForRow(row: FirstBatchCompanyRow): RequiredValue[] {
  const values: RequiredValue[] = [
    { row, field: "enterprise_name", value: row.enterprise_name, severity: "blocking" },
    { row, field: "project_name", value: row.project_name, severity: "blocking" },
    { row, field: "industry", value: row.industry, severity: "review" },
    { row, field: "original_serial", value: row.original_serial, severity: "review" },
  ]

  for (const contact of row.contacts) values.push({ row, field: "contact", value: contact, severity: "review" })
  for (const phone of row.phones) values.push({ row, field: "phone", value: phone, severity: "review" })
  for (const worksheet of row.source_worksheets) values.push({ row, field: "source_worksheet", value: worksheet, severity: "review" })

  return values.filter((item) => item.value.trim().length > 0)
}

function anchorsById(anchors: EvidenceAnchor[] | undefined): Map<string, EvidenceAnchor> | undefined {
  return anchors === undefined ? undefined : new Map(anchors.map((anchor) => [anchor.anchor_id, anchor]))
}

function evidenceRefsExist(refs: EvidenceRef[], anchorIndex: Map<string, EvidenceAnchor> | undefined): boolean {
  if (refs.length === 0 || anchorIndex === undefined) return false
  return refs.some((ref) => anchorIndex.has(ref.anchor_id))
}

function expectedAnchorIds(value: RequiredValue): string[] {
  if (value.field === "source_worksheet") {
    return value.row.source_worksheets
      .map((worksheet, index) => worksheet === value.value ? value.row.cell_anchor_ids[`source_worksheet_${index + 1}`] : undefined)
      .filter((anchorId): anchorId is string => anchorId !== undefined)
  }
  const anchorId = value.row.cell_anchor_ids[value.field]
  return anchorId === undefined ? [] : [anchorId]
}

function rowAnchorRefs(refs: EvidenceRef[], value: RequiredValue, anchorIndex: Map<string, EvidenceAnchor> | undefined): EvidenceRef[] {
  if (anchorIndex === undefined) return []
  return refs.filter((ref) => {
    const anchor = anchorIndex.get(ref.anchor_id)
    return ref.anchor_id === value.row.row_anchor_id || anchor?.kind === "xlsx.row"
  })
}

function preciseFieldRefs(refs: EvidenceRef[], value: RequiredValue, anchorIndex: Map<string, EvidenceAnchor> | undefined): EvidenceRef[] {
  if (anchorIndex === undefined) return []
  const expected = expectedAnchorIds(value)
  if (value.field === "source_worksheet" && expected.some((anchorId) => anchorId === value.row.row_anchor_id)) {
    return refs.filter((ref) => ref.anchor_id === value.row.row_anchor_id && anchorIndex.has(ref.anchor_id))
  }
  return refs.filter((ref) => {
    const anchor = anchorIndex.get(ref.anchor_id)
    return expected.includes(ref.anchor_id) && anchor?.kind === "xlsx.cell"
  })
}

interface CandidateMatch {
  preciseRefs: EvidenceRef[]
  rowAnchorRefs: EvidenceRef[]
}

function emptyMatch(): CandidateMatch {
  return { preciseRefs: [], rowAnchorRefs: [] }
}

function entityMatches(value: RequiredValue, entities: EntityCandidate[], anchorIndex: Map<string, EvidenceAnchor> | undefined): CandidateMatch {
  const entity = entities.find((item) => item.name === value.value && evidenceRefsExist(item.evidenceRefs, anchorIndex))
  if (entity === undefined) return emptyMatch()
  return {
    preciseRefs: preciseFieldRefs(entity.evidenceRefs, value, anchorIndex),
    rowAnchorRefs: rowAnchorRefs(entity.evidenceRefs, value, anchorIndex),
  }
}

function factMatches(value: RequiredValue, facts: FactCandidate[], anchorIndex: Map<string, EvidenceAnchor> | undefined): CandidateMatch {
  const predicates = fieldPredicates[value.field] ?? [value.field]
  const fact = facts.find((item) => {
    return item.subject === value.row.enterprise_name
      && predicates.includes(item.predicate)
      && objectContainsValue(item.object, value.value)
      && evidenceRefsExist(item.evidenceRefs, anchorIndex)
  })
  if (fact === undefined) return emptyMatch()
  return {
    preciseRefs: preciseFieldRefs(fact.evidenceRefs, value, anchorIndex),
    rowAnchorRefs: rowAnchorRefs(fact.evidenceRefs, value, anchorIndex),
  }
}

function candidateEvidenceRefs(value: RequiredValue, input: FirstBatchCoverageAuditInput, anchorIndex: Map<string, EvidenceAnchor> | undefined): CandidateMatch {
  if (input.candidate === undefined) return emptyMatch()
  if (value.field === "enterprise_name") {
    return entityMatches(value, input.candidate.entityCandidates, anchorIndex)
  }
  return factMatches(value, input.candidate.factCandidates, anchorIndex)
}

function findUsableIgnore(value: RequiredValue, ignored: IgnoredCoverageCheck[], anchorIndex: Map<string, EvidenceAnchor> | undefined): IgnoredCoverageCheck | undefined {
  return ignored.find((item) => {
    const refs = item.evidenceRefs ?? []
    const fieldMatches = item.row_anchor_id === value.row.row_anchor_id && item.field === value.field
    const valueMatches = item.expected === undefined || item.expected === value.value
    const hasReason = item.reason !== undefined && item.reason.trim().length > 0
    return fieldMatches && valueMatches && hasReason && evidenceRefsExist(refs, anchorIndex)
  })
}

export function auditFirstBatchCompanyCoverage(input: FirstBatchCoverageAuditInput): CoverageAuditReport {
  const anchorIndex = anchorsById(input.anchors)
  const requiredValues = input.rows.flatMap(requiredValuesForRow)
  const checks: CoverageAuditCheck[] = requiredValues.map((required, index) => {
    const checkId = `${required.row.row_id}:${required.field}:${index}`
    const candidateMatch = candidateEvidenceRefs(required, input, anchorIndex)
    const evidenceRefs = candidateMatch.preciseRefs

    if (evidenceRefsExist(evidenceRefs, anchorIndex)) {
      return {
        check_id: checkId,
        row_anchor_id: required.row.row_anchor_id,
        field: required.field,
        expected: required.value,
        severity: required.severity,
        status: "covered",
        evidenceRefs,
      }
    }

    if (evidenceRefsExist(candidateMatch.rowAnchorRefs, anchorIndex)) {
      return {
        check_id: checkId,
        row_anchor_id: required.row.row_anchor_id,
        field: required.field,
        expected: required.value,
        severity: required.severity,
        status: "consumed_with_row_anchor",
        evidenceRefs: candidateMatch.rowAnchorRefs,
        reason: "Value is present with row-level evidence but lacks a precise field/cell anchor.",
      }
    }

    const usableIgnore = findUsableIgnore(required, input.ignored ?? [], anchorIndex)
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

  const consumed = checks.filter((check) => check.status === "covered" || check.status === "ignored_with_reason" || check.status === "consumed_with_row_anchor").length
  const missingChecks = checks.filter((check) => check.status === "missing")
  const ignoredChecks = checks.filter((check) => check.status === "ignored_with_reason")
  const rowAnchorOnlyChecks = checks.filter((check) => check.status === "consumed_with_row_anchor")
  const blockingCount = missingChecks.filter((check) => check.severity === "blocking").length
  const reviewCount = missingChecks.filter((check) => check.severity === "review").length
  const coverageRatio = checks.length === 0 ? 1 : consumed / checks.length
  const passRatio = input.passRatio ?? 0.95
  const status: CoverageAuditReport["status"] = coverageRatio >= passRatio && blockingCount === 0 && rowAnchorOnlyChecks.length === 0
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
    rowAnchorOnlyChecks,
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
    rowAnchorOnlyCount: report.rowAnchorOnlyChecks?.length ?? 0,
    rowAnchorOnlyFields: Array.from(new Set((report.rowAnchorOnlyChecks ?? []).map((check) => check.field))),
  }
}
