import { buildEvidenceAnchorIndex, evidenceRefForAnchorId } from "./evidence-anchor-index"
import type { EntityCandidate, EvidenceRef, FactCandidate, FirstBatchCompanyRow, SourceSidecar, WikiCandidate } from "./source-sidecar-types"
import { makeEvidenceRef } from "./source-sidecar-types"

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function splitProjectParts(projectName: string): string[] {
  return projectName
    .split(/[；;、，,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function firstRef(refs: Array<EvidenceRef | undefined>, fallback: EvidenceRef): EvidenceRef[] {
  return [refs.find((ref): ref is EvidenceRef => ref !== undefined) ?? fallback]
}

function fact(
  row: FirstBatchCompanyRow,
  predicate: string,
  object: FactCandidate["object"],
  evidenceRefs: EvidenceRef[],
  ordinal: number,
): FactCandidate {
  return {
    fact_id: `${row.row_id}:${predicate}:${ordinal}`,
    subject: row.enterprise_name,
    predicate,
    object,
    evidenceRefs,
    kind: "first_batch_company",
    confidence: 1,
    metadata: {
      row_id: row.row_id,
      row_anchor_id: row.row_anchor_id,
      original_serial: row.original_serial,
    },
  }
}

export function projectFirstBatchCompanyWikiCandidate(sidecar: SourceSidecar): WikiCandidate {
  const rows = sidecar.domain_rows?.first_batch ?? []
  const index = buildEvidenceAnchorIndex(sidecar.anchors)
  const entityCandidates: EntityCandidate[] = []
  const factCandidates: FactCandidate[] = []
  const allRefs: EvidenceRef[] = []

  for (const row of rows) {
    const rowAnchor = index.byAnchorId.get(row.row_anchor_id)
    const rowRef = rowAnchor ? makeEvidenceRef(rowAnchor) : {
      source_id: row.source_id,
      anchor_id: row.row_anchor_id,
      selector: { row_id: row.row_id },
      quote_preview: row.enterprise_name,
    }
    allRefs.push(rowRef)

    const enterpriseRef = evidenceRefForAnchorId(index, row.cell_anchor_ids.enterprise_name)
    const projectRef = evidenceRefForAnchorId(index, row.cell_anchor_ids.project_name)
    const contactRef = evidenceRefForAnchorId(index, row.cell_anchor_ids.contact)
    const phoneRef = evidenceRefForAnchorId(index, row.cell_anchor_ids.phone)
    const industryRef = evidenceRefForAnchorId(index, row.cell_anchor_ids.industry)
    const serialRef = evidenceRefForAnchorId(index, row.cell_anchor_ids.original_serial)

    entityCandidates.push({
      entity_id: `organization:${safeSlug(row.enterprise_name)}`,
      name: row.enterprise_name,
      type: "organization",
      evidenceRefs: firstRef([enterpriseRef], rowRef),
      original_serials: [row.original_serial],
      source_sheets: row.source_worksheets,
      metadata: { row_id: row.row_id, row_anchor_id: row.row_anchor_id },
    })

    let ordinal = 0
    factCandidates.push(fact(row, "listed_in_first_batch", true, [rowRef], ordinal++))
    factCandidates.push(fact(row, "original_serial", row.original_serial, firstRef([serialRef], rowRef), ordinal++))
    factCandidates.push(fact(row, "industry", row.industry, firstRef([industryRef], rowRef), ordinal++))
    factCandidates.push(fact(row, "project_name", row.project_name, firstRef([projectRef], rowRef), ordinal++))

    for (const projectPart of splitProjectParts(row.project_name)) {
      factCandidates.push(fact(row, "project_component", projectPart, firstRef([projectRef], rowRef), ordinal++))
    }

    for (const contact of row.contacts) {
      factCandidates.push(fact(row, "contact", contact, firstRef([contactRef], rowRef), ordinal++))
    }

    for (const phone of row.phones) {
      factCandidates.push(fact(row, "phone", phone, firstRef([phoneRef], rowRef), ordinal++))
    }

    row.source_worksheets.forEach((sheet, sheetIndex) => {
      const sheetRef = evidenceRefForAnchorId(index, row.cell_anchor_ids[`source_worksheet_${sheetIndex + 1}`])
      factCandidates.push(fact(row, "source_worksheet", sheet, firstRef([sheetRef], rowRef), ordinal++))
    })
  }

  return {
    candidate_id: `${sidecar.source.source_id}:first_batch_company:wiki_candidate`,
    source_id: sidecar.source.source_id,
    title: "第一批企业名单 Wiki 候选",
    entityCandidates,
    factCandidates,
    evidenceRefs: allRefs,
    metadata: {
      source_format: sidecar.source.format,
      row_count: rows.length,
      projection: "first_batch_company_v1",
    },
  }
}

export function renderFirstBatchWikiCandidateMarkdown(candidate: WikiCandidate): string {
  const lines = [`# ${candidate.title}`, ""]
  for (const entity of candidate.entityCandidates) {
    lines.push(`## ${entity.name}`)
    const facts = candidate.factCandidates.filter((item) => item.subject === entity.name)
    for (const item of facts) {
      const value = Array.isArray(item.object) ? item.object.join("、") : String(item.object)
      lines.push(`- ${item.predicate}: ${value}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}
