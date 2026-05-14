import { afterEach, describe, expect, it, vi } from "vitest"
import { buildFormatProfileFromExtractedText, buildFormatProfileSnapshot, buildGenerationInstruction, summarizeFormatDiagnostics } from "./format-profile"
import { styleSummaryForHumans } from "./style-facts"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("format-profile", () => {
  it("builds a product profile from extracted finished-file text", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456)
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/正式报告.docx",
      now: 1_700_000_000_000,
      extractedText: "# 项目背景\n这里是较长背景。\n\n一、风险提醒\n这里是风险。\n\n二、实施计划\n这里是计划。".repeat(20),
    })

    expect(profile.id).toMatch(/^format_profile_1700000000000_/)
    expect(profile.title).toBe("正式报告")
    expect(profile.fileType).toBe("docx")
    expect(profile.confidence).toBe("high")
    expect(profile.structureProfile.sections.map((section) => section.title)).toEqual(expect.arrayContaining(["项目背景", "风险提醒", "实施计划"]))
    expect(profile.writingProfile.generationInstruction).toContain("格式画像约束")
    expect(profile.writingProfile.generationInstruction).toContain("DOCX")
  })

  it("merges DOCX probe typography and page evidence into the product profile", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/制度.docx",
      now: 2,
      extractedText: "第一章 总则\n正文内容".repeat(20),
      probe: {
        kind: "office_zip",
        officeKind: "docx",
        structure: {
          paragraphs: 12,
          tables: 1,
          sectionPattern: "style-based-headings",
          headingCandidates: [{ text: "第一章 总则", outlineLevel: "0", styleId: "Heading1" }],
        },
        style: {
          styleCount: 3,
          fonts: ["FangSong", "SimHei"],
          fontUsage: [{ value: "FangSong", count: 8 }],
          fontSizeUsageHalfPoints: [{ value: "32", count: 2 }],
          page: { widthTwips: "11900", heightTwips: "16840" },
        },
      },
    })

    expect(profile.confidence).toBe("high")
    expect(profile.styleFacts?.schemaVersion).toBe("format-profile-style-facts.v0")
    expect(profile.styleFacts?.metadata.styleFactsSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(profile.refinement).toEqual({ semanticStatus: "not-configured", dataScope: "evidence-only" })
    expect(profile.structureProfile.sectionPattern).toBe("style-based-headings")
    expect(profile.structureProfile.sections[0]).toMatchObject({ title: "第一章 总则", evidence: "probe-heading" })
    expect(profile.styleProfile.evidenceSummary).toEqual(expect.arrayContaining([
      expect.stringContaining("字体线索"),
      expect.stringContaining("字号线索"),
      expect.stringContaining("页面线索"),
    ]))
    expect(profile.styleProfile.evidenceSummary).toEqual(styleSummaryForHumans(profile.styleFacts, profile.fileType))
    expect(profile.writingProfile.generationInstruction).toContain("StyleFacts：format-profile-style-facts.v0")
    expect(profile.writingProfile.generationInstruction).toContain("样式/版式线索")
    expect(profile.writingProfile.generationInstruction).toContain("FangSong")
    expect(profile.writingProfile.generationInstruction).not.toContain("paragraphSamples")
  })

  it("keeps weak evidence as diagnostics instead of pretending high fidelity", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/scan.pdf",
      now: 1,
      extractedText: "少量文字",
    })

    expect(profile.fileType).toBe("pdf")
    expect(profile.confidence).toBe("low")
    expect(profile.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "weak-text-evidence", severity: "warning" }),
      expect.objectContaining({ id: "pdf-low-fidelity-boundary", severity: "info" }),
    ]))
    expect(summarizeFormatDiagnostics(profile).warning).toBeGreaterThanOrEqual(1)
    expect(summarizeFormatDiagnostics(profile).info).toBeGreaterThanOrEqual(2)
  })


  it("translates XLSX probe evidence into spreadsheet constraints", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/dashboard.xlsx",
      now: 3,
      extractedText: "## 收入指标\n## 成本指标\n".repeat(10),
      probe: {
        kind: "office_zip",
        officeKind: "xlsx",
        structure: {
          sheetCount: 2,
          sheets: [{ name: "收入" }, { name: "成本" }],
          sheetStats: [{ path: "xl/worksheets/sheet1.xml", dimension: "A1:F20", rowCount: 20, cellCount: 120, formulaCount: 8 }],
        },
        style: {
          cellStyleCount: 6,
          fontCount: 3,
          fillCount: 4,
          borderCount: 2,
          sharedStringCount: 40,
        },
      },
    })

    expect(profile.fileType).toBe("xlsx")
    expect(profile.confidence).toBe("medium")
    expect(profile.structureProfile.sectionPattern).toBe("workbook-sheets")
    expect(profile.structureProfile.sections.map((section) => section.title)).toEqual(expect.arrayContaining(["收入", "成本"]))
    expect(profile.styleProfile.evidenceSummary?.join("\n")).toContain("单元格样式")
    expect(profile.writingProfile.generationInstruction).toContain("指标、口径、观察和结论")
    expect(profile.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ id: "xlsx-positioning" })]))
  })



  it("translates PPTX probe evidence into presentation constraints", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/roadshow.pptx",
      now: 4,
      extractedText: "战略目标\n执行路径\n".repeat(10),
      probe: {
        kind: "office_zip",
        officeKind: "pptx",
        structure: {
          slideCount: 3,
          layoutCount: 2,
          masterCount: 1,
          slideStats: [
            { path: "ppt/slides/slide1.xml", textSample: ["战略目标"], textCount: 3 },
            { path: "ppt/slides/slide2.xml", textSample: ["执行路径"], textCount: 4 },
          ],
        },
        style: {
          themeCount: 1,
          themeName: "Office Theme",
          colorSchemeCount: 1,
          fontSchemeCount: 1,
        },
      },
    })

    expect(profile.fileType).toBe("pptx")
    expect(profile.confidence).toBe("medium")
    expect(profile.structureProfile.sectionPattern).toBe("slide-deck")
    expect(profile.structureProfile.sections[0]).toMatchObject({ title: "第 1 页：战略目标", evidence: "slide" })
    expect(profile.styleProfile.evidenceSummary?.join("\n")).toContain("主题")
    expect(profile.writingProfile.generationInstruction).toContain("汇报大纲、每页主题和讲述要点")
    expect(profile.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ id: "pptx-positioning" })]))
  })



  it("keeps PDF probe evidence low-fidelity with scan diagnostics", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/catalog.pdf",
      now: 5,
      extractedText: "",
      probe: {
        kind: "pdf",
        structure: {
          pageCount: 8,
          textOperatorCount: 0,
          imageCount: 10,
          hasTextLayerHint: false,
          scanLikely: true,
        },
        style: {
          fontRefs: [],
        },
      },
    })

    expect(profile.fileType).toBe("pdf")
    expect(profile.confidence).toBe("low")
    expect(profile.structureProfile.sectionPattern).toBe("page-reference")
    expect(profile.structureProfile.sections[0]).toMatchObject({ title: "8 页成品参考", evidence: "page" })
    expect(profile.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "pdf-low-fidelity-boundary" }),
      expect.objectContaining({ id: "pdf-scan-likely", severity: "warning" }),
    ]))
    expect(profile.writingProfile.generationInstruction).toContain("低保真成品参考")
  })


  it("ignores probe-only style fields that are not mapped into StyleFacts summaries", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/noisy.docx",
      now: 8,
      extractedText: "第一章 总则".repeat(30),
      probe: {
        kind: "office_zip",
        officeKind: "docx",
        structure: { paragraphs: 1, runs: 1, tables: 0 },
        style: {
          styleCount: 1,
          fonts: ["FangSong"],
          fontUsage: [{ value: "FangSong", count: 1 }],
          fontSizeUsageHalfPoints: [{ value: "21", count: 1 }],
          page: { widthTwips: "11905", heightTwips: "16834" },
          ignoredProbeOnlyField: "SHOULD_NOT_APPEAR",
        },
      },
    })

    expect(profile.styleFacts).toBeTruthy()
    expect(profile.styleProfile.evidenceSummary?.join("\n")).toContain("FangSong")
    expect(profile.styleProfile.evidenceSummary?.join("\n")).not.toContain("SHOULD_NOT_APPEAR")
  })

  it("builds a profile snapshot with StyleFacts metadata", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/snapshot.docx",
      now: 9,
      extractedText: "第一章 总则".repeat(30),
      probe: {
        kind: "office_zip",
        officeKind: "docx",
        structure: { paragraphs: 1, runs: 1, tables: 0 },
        style: { styleCount: 1, fonts: ["FangSong"], fontUsage: [{ value: "FangSong", count: 1 }], page: { widthTwips: "11905", heightTwips: "16834" } },
      },
    })
    const snapshot = buildFormatProfileSnapshot(profile)

    expect(snapshot.styleFactsSha256).toBe(profile.styleFacts?.metadata.styleFactsSha256)
    expect(snapshot.styleFactsSchemaVersion).toBe("format-profile-style-facts.v0")
    expect(snapshot.dataScope).toBe("evidence-only")
    expect(snapshot.semanticStatus).toBe("not-configured")
    expect(snapshot.styleFactsSummary?.join("\n")).toContain("FangSong")
    expect(snapshot.profileSnapshotHash).toContain(profile.styleFacts!.metadata.styleFactsSha256)
  })


  it("renders generation instruction from profile evidence", () => {
    const profile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/table.xlsx",
      now: 1,
      extractedText: "## 指标口径\n## 结论建议\n".repeat(30),
    })

    const instruction = buildGenerationInstruction(profile)
    expect(instruction).toContain("XLSX")
    expect(instruction).toContain("指标口径")
    expect(instruction).toContain("不直接伪造电子表格")
  })
})


