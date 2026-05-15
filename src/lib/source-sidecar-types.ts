export type SourceFormat = "xlsx" | "docx" | "pdf" | "txt" | "md" | "html" | "unknown"

export interface SourceIdentity {
  source_id: string
  format: SourceFormat
  uri: string
  title?: string
  origin?: string
  content_hash?: string
  relative_path?: string
  mtime_ms?: number
  size_bytes?: number
}

export interface EvidenceText {
  preview: string
  text_len: number
  text_hash?: string
}

export interface EvidenceAnchor<Selector extends Record<string, unknown> = Record<string, unknown>> {
  anchor_id: string
  source_id: string
  format: SourceFormat
  kind: string
  selector: Selector
  text: EvidenceText
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface EvidenceRef<Selector extends Record<string, unknown> = Record<string, unknown>> {
  source_id: string
  anchor_id: string
  selector: Selector
  quote_preview?: string
}

export interface CoverageSummary {
  anchor_count: number
  row_anchor_count?: number
  cell_anchor_count?: number
  page_anchor_count?: number
  paragraph_anchor_count?: number
  chunk_anchor_count?: number
}

export interface ExtractionQuality {
  warnings: string[]
  unsupported_features: string[]
  confidence: number
}

export interface FirstBatchCompanyRow {
  row_id: string
  row_anchor_id: string
  source_id: string
  enterprise_name: string
  project_name: string
  original_serial: string
  industry: string
  contacts: string[]
  phones: string[]
  source_worksheets: string[]
  cell_anchor_ids: Record<string, string>
}

export interface FirstBatchPilotRow {
  row_id: string
  row_anchor_id: string
  source_id: string
  unit_name: string
  project_name: string
  source_worksheets: string[]
  cell_anchor_ids: Record<string, string>
}

export interface SourceSidecar {
  schema_version: string
  source: SourceIdentity
  anchors: EvidenceAnchor[]
  coverage: CoverageSummary
  quality: ExtractionQuality
  review_items?: unknown[]
  metadata?: Record<string, unknown>
  domain_rows?: {
    first_batch?: FirstBatchCompanyRow[]
    pilot_units?: FirstBatchPilotRow[]
  }
}

export interface EntityCandidate {
  entity_id: string
  name: string
  type: "organization" | "person" | "project" | "concept" | string
  evidenceRefs: EvidenceRef[]
  original_serials?: string[]
  source_sheets?: string[]
  metadata?: Record<string, unknown>
}

export interface FactCandidate {
  fact_id: string
  subject: string
  predicate: string
  object: string | number | boolean | string[] | Record<string, unknown>
  evidenceRefs: EvidenceRef[]
  kind?: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface WikiCandidate {
  candidate_id: string
  source_id: string
  title: string
  entityCandidates: EntityCandidate[]
  factCandidates: FactCandidate[]
  evidenceRefs: EvidenceRef[]
  draftMarkdown?: string
  metadata?: Record<string, unknown>
}

export type CoverageCheckStatus = "covered" | "consumed_with_row_anchor" | "missing" | "ignored_with_reason"
export type CoverageCheckSeverity = "blocking" | "review"

export interface CoverageAuditCheck {
  check_id: string
  row_anchor_id: string
  field: string
  expected: string
  severity: CoverageCheckSeverity
  status: CoverageCheckStatus
  evidenceRefs: EvidenceRef[]
  reason?: string
}

export interface CoverageAuditReport {
  sourceId: string
  auditPath?: string
  total_required_field_checks: number
  consumed_required_field_checks: number
  coverage_ratio: number
  missingCount: number
  blockingCount: number
  reviewCount: number
  status: "passed" | "needs_review" | "failed"
  checks: CoverageAuditCheck[]
  missingChecks: CoverageAuditCheck[]
  ignoredChecks: CoverageAuditCheck[]
  rowAnchorOnlyChecks?: CoverageAuditCheck[]
}

export function makeEvidenceRef(anchor: EvidenceAnchor): EvidenceRef {
  return {
    source_id: anchor.source_id,
    anchor_id: anchor.anchor_id,
    selector: anchor.selector,
    quote_preview: anchor.text.preview,
  }
}
