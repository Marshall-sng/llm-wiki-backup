import { describe, expect, it } from "vitest"
import { buildStyleFactsFromProbe, sha256Text, styleSummaryForHumans, type StyleFact } from "./style-facts"
import type { FormatProfileProbe } from "@/commands/fs"

function traverseFacts(node: unknown, evidenceIds: Set<string>, path = "styleFacts") {
  expect(node, path).toBeTruthy()
  if (node && typeof node === "object" && !Array.isArray(node) && "value" in node && "evidenceRefs" in node) {
    const fact = node as StyleFact
    expect(fact.confidence, path).toBeTruthy()
    expect(fact.evidenceRefs.length, path).toBeGreaterThan(0)
    for (const ref of fact.evidenceRefs) expect(evidenceIds.has(ref), `${path}:${ref}`).toBe(true)
    if (fact.derived) expect(fact.evidenceRefs.length, `${path}:derived`).toBeGreaterThan(0)
    return
  }
  expect(typeof node, path).toBe("object")
  expect(Array.isArray(node), path).toBe(false)
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) traverseFacts(value, evidenceIds, `${path}.${key}`)
}

const docxProbe: FormatProfileProbe = {
  kind: "office_zip",
  officeKind: "docx",
  structure: {
    paragraphs: 12,
    runs: 20,
    tables: 1,
    paragraphStyleUsage: [{ value: "BodyText", count: 8 }],
    paragraphSamples: [{ text: "第一章 总则", index: 1 }],
  },
  style: {
    styleCount: 3,
    styleIds: ["Normal", "BodyText", "TableText"],
    styles: [{ styleId: "BodyText", name: "Body Text", fonts: ["FangSong"], fontSizesHalfPoints: ["31"] }],
    fonts: ["FangSong", "SimHei"],
    fontUsage: [{ value: "FangSong", count: 8 }],
    fontSizeUsageHalfPoints: [{ value: "21", count: 3 }, { value: "31", count: 1 }],
    page: { widthTwips: "11905", heightTwips: "16834", marginsTwips: { top: "1", right: "0", bottom: "1", left: "0" } },
    numberingDefinitions: 2,
  },
}

describe("style-facts", () => {
  it("computes a standard SHA-256 synchronously", () => {
    expect(sha256Text("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  it("builds evidence-cited DOCX facts without paragraph sample text", () => {
    const envelope = buildStyleFactsFromProbe({ fileType: "docx", sourceName: "制度.docx", probe: docxProbe, now: 1 })
    expect(envelope.schemaVersion).toBe("format-profile-style-facts.v0")
    expect(envelope.capabilities.canGuideExport).toBe(false)
    const evidenceIds = new Set(envelope.evidence.map((item) => item.id))
    traverseFacts(envelope.styleFacts, evidenceIds)
    const facts = envelope.styleFacts as Record<string, any>
    expect(JSON.stringify(envelope.styleFacts)).not.toContain("第一章 总则")
    expect(facts.layout.pageSizeTwips.value).toMatchObject({ widthTwips: "11905", heightTwips: "16834" })
    expect(facts.layout.pageSizeCm).toMatchObject({ derived: true, unit: "cm" })
    expect(facts.typography.fontSizeUsagePt).toMatchObject({ derived: true, unit: "pt" })
    expect(facts.typography.fontSizeUsagePt.value[0].value).toBe(10.5)
    expect(styleSummaryForHumans(envelope, "docx").join("\n")).toContain("字体使用")
  })

  it("hashes deterministically and changes when a fact changes", () => {
    const a = buildStyleFactsFromProbe({ fileType: "docx", sourceName: "制度.docx", probe: docxProbe, now: 1 })
    const b = buildStyleFactsFromProbe({ fileType: "docx", sourceName: "制度.docx", probe: { ...docxProbe, style: { ...docxProbe.style } }, now: 999 })
    const changed = buildStyleFactsFromProbe({
      fileType: "docx",
      sourceName: "制度.docx",
      probe: { ...docxProbe, style: { ...docxProbe.style, page: { widthTwips: "12000", heightTwips: "16834" } } },
      now: 1,
    })
    expect(a.metadata.styleFactsSha256).toBe(b.metadata.styleFactsSha256)
    expect(a.metadata.builtAt).not.toBe(b.metadata.builtAt)
    expect(a.metadata.styleFactsSha256).not.toBe(changed.metadata.styleFactsSha256)
  })

  it("builds XLSX facts as table/metric guidance", () => {
    const envelope = buildStyleFactsFromProbe({
      fileType: "xlsx",
      sourceName: "指标.xlsx",
      now: 1,
      probe: {
        kind: "office_zip",
        officeKind: "xlsx",
        structure: { sheetCount: 1, sheets: [{ name: "Sheet1" }], sheetStats: [{ path: "xl/worksheets/sheet1.xml", dimension: "A1:C29", rowCount: 29, cellCount: 87, mergedCellCount: 5, formulaCount: 2 }] },
        style: { cellStyleCount: 1, fontCount: 4, fillCount: 3, borderCount: 5, sharedStringCount: 65 },
      },
    })
    traverseFacts(envelope.styleFacts, new Set(envelope.evidence.map((item) => item.id)))
    const facts = envelope.styleFacts as Record<string, any>
    expect(facts.workbook.sheetCount.value).toBe(1)
    expect(facts.formulasAndMerges.mergedCellCount.value).toBe(5)
    expect(styleSummaryForHumans(envelope, "xlsx").join("\n")).toContain("表格复杂度")
  })

  it("keeps PPTX and PDF as baseline diagnostics", () => {
    const pptx = buildStyleFactsFromProbe({
      fileType: "pptx",
      sourceName: "汇报.pptx",
      now: 1,
      probe: { kind: "office_zip", officeKind: "pptx", structure: { slideCount: 3, layoutCount: 2, masterCount: 1, slideStats: [{ textSample: ["secret"], textCount: 2 }] }, style: { themeCount: 1, themeName: "Office", colorSchemeCount: 1, fontSchemeCount: 1 } },
    })
    const pdf = buildStyleFactsFromProbe({
      fileType: "pdf",
      sourceName: "参考.pdf",
      now: 1,
      probe: { kind: "pdf", structure: { pageCount: 8, textOperatorCount: 0, imageCount: 10, scanLikely: true, hasTextLayerHint: false }, style: { fontRefs: ["SimSun"] } },
    })
    expect(JSON.stringify(pptx.styleFacts)).not.toContain("secret")
    expect(pptx.capabilities.canGuideExport).toBe(false)
    expect(pdf.capabilities.canGuideExport).toBe(false)
    expect(styleSummaryForHumans(pptx, "pptx").join("\n")).toContain("不承诺生成 PPTX")
    expect(styleSummaryForHumans(pdf, "pdf").join("\n")).toContain("不承诺还原版式")
  })

  it("returns low-confidence availability facts when probe is missing", () => {
    const envelope = buildStyleFactsFromProbe({ fileType: "unknown", sourceName: "x.bin", probe: null, now: 1 })
    traverseFacts(envelope.styleFacts, new Set(envelope.evidence.map((item) => item.id)))
    const facts = envelope.styleFacts as Record<string, any>
    expect(facts.availability.hasDeterministicProbe.value).toBe(false)
  })
})
