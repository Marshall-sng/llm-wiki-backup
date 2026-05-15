import { describe, expect, it } from "vitest"
import { makeFirstBatchCompanyFixtureSidecar } from "@/test-helpers/first-batch-company-fixture"
import { projectFirstBatchCompanyWikiCandidate, renderFirstBatchWikiCandidateMarkdown } from "./wiki-candidate-projection"

describe("first batch wiki candidate projection", () => {
  it("projects all first-batch rows into entity candidates", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const candidate = projectFirstBatchCompanyWikiCandidate(sidecar)
    expect(candidate.entityCandidates.length).toBeGreaterThanOrEqual(18)
    expect(candidate.entityCandidates.map((item) => item.name)).toContain("杭州数源科技有限公司")
    expect(candidate.entityCandidates.every((item) => item.evidenceRefs.length > 0)).toBe(true)
  })

  it("projects row-level and cell-level facts with evidence refs", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const candidate = projectFirstBatchCompanyWikiCandidate(sidecar)
    expect(candidate.factCandidates.length).toBeGreaterThanOrEqual(147)
    expect(candidate.factCandidates.every((item) => item.evidenceRefs.length > 0)).toBe(true)
    expect(candidate.factCandidates.every((item) => item.evidenceRefs[0].anchor_id.length > 0)).toBe(true)
  })

  it("preserves contact and phone facts for all rows that have them", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const candidate = projectFirstBatchCompanyWikiCandidate(sidecar)
    const contactFacts = candidate.factCandidates.filter((item) => item.predicate === "contact")
    const phoneFacts = candidate.factCandidates.filter((item) => item.predicate === "phone")
    expect(contactFacts).toHaveLength(13)
    expect(phoneFacts).toHaveLength(13)
  })

  it("renders a markdown candidate that still contains row evidence values", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const candidate = projectFirstBatchCompanyWikiCandidate(sidecar)
    const markdown = renderFirstBatchWikiCandidateMarkdown(candidate)
    expect(markdown).toContain("联系人1")
    expect(markdown).toContain("13800000001")
    expect(markdown).toContain("企业申报明细")
  })
})
