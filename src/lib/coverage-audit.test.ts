import { describe, expect, it } from "vitest"
import { auditFirstBatchCompanyCoverage, toCoverageAuditReviewMetadata } from "./coverage-audit"
import {
  makeFirstBatchCompanyFixtureSidecar,
  makeFullFirstBatchWikiText,
  makeSummaryStyleFirstBatchWikiText,
} from "@/test-helpers/first-batch-company-fixture"
import { makeEvidenceRef } from "./source-sidecar-types"

describe("coverage audit for first batch company wiki", () => {
  it("passes a full candidate with coverage ratio 1.0", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const rows = sidecar.domain_rows?.first_batch ?? []
    const report = auditFirstBatchCompanyCoverage({
      sourceId: sidecar.source.source_id,
      rows,
      candidateText: makeFullFirstBatchWikiText(rows),
    })
    expect(report.coverage_ratio).toBe(1)
    expect(report.consumed_required_field_checks).toBe(report.total_required_field_checks)
    expect(report.status).toBe("passed")
    expect(report.missingCount).toBe(0)
  })

  it("flags summary-style wiki output as materially incomplete", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const rows = sidecar.domain_rows?.first_batch ?? []
    const report = auditFirstBatchCompanyCoverage({
      sourceId: sidecar.source.source_id,
      rows,
      candidateText: makeSummaryStyleFirstBatchWikiText(rows),
    })
    expect(report.coverage_ratio).toBeLessThan(0.75)
    expect(report.status).toBe("failed")
    expect(report.missingChecks.some((check) => check.field === "contact")).toBe(true)
    expect(report.missingChecks.some((check) => check.field === "phone")).toBe(true)
  })

  it("counts ignored_with_reason only when both reason and anchor evidence exist", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const row = sidecar.domain_rows?.first_batch?.[0]
    expect(row).toBeDefined()
    const anchor = sidecar.anchors.find((item) => item.anchor_id === row?.cell_anchor_ids.phone)
    expect(anchor).toBeDefined()
    const report = auditFirstBatchCompanyCoverage({
      sourceId: sidecar.source.source_id,
      rows: row ? [row] : [],
      candidateText: [row?.enterprise_name, row?.project_name, row?.industry, row?.original_serial, row?.contacts[0], ...row?.source_worksheets ?? []]
        .filter((item): item is string => item !== undefined)
        .join("\n"),
      ignored: anchor && row ? [{
        row_anchor_id: row.row_anchor_id,
        field: "phone",
        expected: row.phones[0],
        reason: "电话号码在公开 Wiki 中脱敏，但保留单元格证据锚点。",
        evidenceRefs: [makeEvidenceRef(anchor)],
      }] : [],
    })
    expect(report.ignoredChecks).toHaveLength(1)
    expect(report.coverage_ratio).toBe(1)
  })

  it("does not count ignored values without reason and evidence anchor", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const row = sidecar.domain_rows?.first_batch?.[0]
    const report = auditFirstBatchCompanyCoverage({
      sourceId: sidecar.source.source_id,
      rows: row ? [row] : [],
      candidateText: [row?.enterprise_name, row?.project_name, row?.industry, row?.original_serial, row?.contacts[0], ...row?.source_worksheets ?? []]
        .filter((item): item is string => item !== undefined)
        .join("\n"),
      ignored: row ? [{ row_anchor_id: row.row_anchor_id, field: "phone", expected: row.phones[0] }] : [],
    })
    expect(report.ignoredChecks).toHaveLength(0)
    expect(report.missingChecks.some((check) => check.field === "phone")).toBe(true)
  })

  it("produces review metadata suitable for ReviewItem.metadata", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const rows = sidecar.domain_rows?.first_batch ?? []
    const report = auditFirstBatchCompanyCoverage({
      sourceId: sidecar.source.source_id,
      auditPath: ".omx/plans/experiments/wiki-precision-longdoc/audits/first-batch.json",
      rows,
      candidateText: makeSummaryStyleFirstBatchWikiText(rows),
    })
    const metadata = toCoverageAuditReviewMetadata(report)
    expect(metadata.sourceId).toBe(sidecar.source.source_id)
    expect(metadata.auditPath).toBe(".omx/plans/experiments/wiki-precision-longdoc/audits/first-batch.json")
    expect(metadata.missingCount).toBeGreaterThan(0)
    expect(metadata.blockingCount).toBeGreaterThan(0)
    expect(metadata.fields).toEqual(expect.arrayContaining(["project_name", "contact", "phone"]))
  })
})
