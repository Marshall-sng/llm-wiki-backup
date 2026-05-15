import { describe, expect, it } from "vitest"
import { makeFirstBatchCompanyFixtureSidecar } from "@/test-helpers/first-batch-company-fixture"
import { makeEvidenceRef, type FactCandidate, type SourceSidecar } from "./source-sidecar-types"

function assertFactCandidate(value: FactCandidate): void {
  expect(value.evidenceRefs.length).toBeGreaterThan(0)
  expect(value.evidenceRefs[0].anchor_id).toBeTypeOf("string")
}

describe("source sidecar evidence contract", () => {
  it("keeps first-batch xlsx anchors at row and cell granularity", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    expect(sidecar.schema_version).toBe("source-sidecar/v1")
    expect(sidecar.source.format).toBe("xlsx")
    expect(sidecar.coverage.anchor_count).toBe(226)
    expect(sidecar.coverage.row_anchor_count).toBe(22)
    expect(sidecar.coverage.cell_anchor_count).toBe(204)
    expect(sidecar.domain_rows?.first_batch).toHaveLength(18)
    expect(sidecar.domain_rows?.pilot_units).toHaveLength(4)
  })

  it("converts anchors into evidence refs without dropping selectors", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const ref = makeEvidenceRef(sidecar.anchors[0])
    expect(ref.source_id).toBe(sidecar.source.source_id)
    expect(ref.anchor_id).toBe(sidecar.anchors[0].anchor_id)
    expect(ref.selector).toEqual(sidecar.anchors[0].selector)
    expect(ref.quote_preview).toBe(sidecar.anchors[0].text.preview)
  })

  it("makes the required generic candidate and sidecar types usable", () => {
    const sidecar: SourceSidecar = makeFirstBatchCompanyFixtureSidecar()
    const candidate: FactCandidate = {
      fact_id: "fact:1",
      subject: "杭州数源科技有限公司",
      predicate: "contact",
      object: "联系人1",
      evidenceRefs: [makeEvidenceRef(sidecar.anchors[1])],
    }
    assertFactCandidate(candidate)
  })
})
