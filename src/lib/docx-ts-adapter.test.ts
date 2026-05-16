import { describe, expect, it } from "vitest"
import JSZip from "jszip"

import { containsForbiddenDocxExportLeakage } from "@/lib/docx-export-contract"
import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import { probeDocxPackage } from "@/lib/docx-package-probe"
import { renderDocxWithTsAdapter, DOCX_NPM_ADAPTER_ID } from "@/lib/docx-ts-adapter"
import { buildFormatSpecSnapshot } from "@/lib/format-spec"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"
import { createDocxStyleFactsProfile, DOCX_STYLEFACTS_POISON } from "@/test-helpers/docx-stylefacts-profile-fixtures"

describe("docx ts adapter", () => {
  it("generates browser-safe DOCX bytes with stable adapter metadata", async () => {
    const draft = createDocxExportDraft()
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)

    expect(result.adapterResult.adapterId).toBe(DOCX_NPM_ADAPTER_ID)
    expect(result.bytes).toBeInstanceOf(Uint8Array)
    expect(result.bytes.byteLength).toBeGreaterThan(1000)
    expect(result.adapterResult.sizeBytes).toBe(result.bytes.byteLength)
    expect(result.adapterResult.outputPath).toBeUndefined()
    expect(result.adapterResult.knownWarnings).toEqual(expect.arrayContaining(["manual-word-openability-not-tested", "pixel-perfect-rendering-not-claimed"]))
    expect(containsForbiddenDocxExportLeakage(result.adapterResult)).toBe(false)
  })

  it("produces bytes that satisfy product structural probes", async () => {
    const draft = createDocxExportDraft()
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)
    const probe = await probeDocxPackage(result.bytes)

    expect(probe.validationErrors).toEqual([])
    expect(probe.structuralAssertions.every((item) => item.passed)).toBe(true)
    expect(probe.packageParts).toEqual(expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]))
  })

  it("writes observable formal DOCX style evidence instead of literal visual indentation", async () => {
    const draft = createDocxExportDraft([
      "云南省大数据有限公司简介",
      "",
      "  一、发展定位",
      "",
      "  云南省大数据有限公司是省属国有功能性企业。",
      "",
      "核心任务包括：",
      "支撑数字政府建设：作为重要建设运维主体",
      "推进数据要素市场化配置：作为公共数据一级开发主体",
    ].join("\n"))
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)
    const zip = await JSZip.loadAsync(result.bytes)
    const documentXml = await zip.file("word/document.xml")?.async("string") ?? ""
    const stylesXml = await zip.file("word/styles.xml")?.async("string") ?? ""
    const numberingXml = await zip.file("word/numbering.xml")?.async("string") ?? ""

    expect(documentXml).not.toContain(" ")
    expect(documentXml).toContain('w:val="Title"')
    expect(documentXml).toContain('w:val="Heading1"')
    expect(documentXml + stylesXml).toMatch(/<w:spacing\b/)
    expect(documentXml + stylesXml).toMatch(/<w:ind\b/)
    expect(documentXml + stylesXml).toMatch(/w:eastAsia="(?:仿宋|黑体|楷体|宋体|方正小标宋简体)"/)
    expect(numberingXml).toContain('w:val="decimal"')
  })

  it("changes exported style XML when FormatSpec attributes change", async () => {
    const firstProfile = createDocxFormatProfileSnapshot()
    firstProfile.formatSpec.rules = [{
      id: "body-16pt",
      target: "paragraph",
      dimension: "paragraph.body",
      rule: "正文 16pt",
      detail: "正文使用 16pt。",
      source: "standard-default",
      confidence: "high",
      attributes: [{ name: "fontSizePt", value: "16", unit: "pt", confidence: "high" }],
    }]
    const secondProfile = createDocxFormatProfileSnapshot()
    secondProfile.formatSpec.rules = [{
      id: "body-18pt",
      target: "paragraph",
      dimension: "paragraph.body",
      rule: "正文 18pt",
      detail: "正文使用 18pt。",
      source: "standard-default",
      confidence: "high",
      attributes: [{ name: "fontSizePt", value: "18", unit: "pt", confidence: "high" }],
    }]
    const draft = createDocxExportDraft("# 标题\n\n一、背景\n\n正文段落。")
    const first = await renderDocxWithTsAdapter(buildDocxIntermediateDocument({ draft, formatProfileSnapshot: firstProfile }), draft.title)
    const second = await renderDocxWithTsAdapter(buildDocxIntermediateDocument({ draft, formatProfileSnapshot: secondProfile }), draft.title)
    const firstStyles = await (await JSZip.loadAsync(first.bytes)).file("word/styles.xml")?.async("string") ?? ""
    const secondStyles = await (await JSZip.loadAsync(second.bytes)).file("word/styles.xml")?.async("string") ?? ""

    expect(firstStyles).toContain('w:val="32"')
    expect(secondStyles).toContain('w:val="36"')
    expect(firstStyles).not.toBe(secondStyles)
  })

  it("uses StyleFacts-backed FormatSpec attributes to produce different DOCX styles", async () => {
    const firstSource = createDocxStyleFactsProfile({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      poison: DOCX_STYLEFACTS_POISON,
    })
    const secondSource = createDocxStyleFactsProfile({
      titleFont: "SimHei",
      titleSizePt: 20,
      bodyFont: "KaiTi",
      bodySizePt: 15,
      poison: DOCX_STYLEFACTS_POISON,
    })
    const firstSpec = buildFormatSpecSnapshot(firstSource)
    const secondSpec = buildFormatSpecSnapshot(secondSource)
    const firstProfile = createDocxFormatProfileSnapshot()
    firstProfile.formatSpec = firstSpec.formatSpec
    firstProfile.formatSpecHash = firstSpec.formatSpecHash
    firstProfile.sourceProfileHash = firstSpec.sourceProfileHash
    const secondProfile = createDocxFormatProfileSnapshot()
    secondProfile.formatSpec = secondSpec.formatSpec
    secondProfile.formatSpecHash = secondSpec.formatSpecHash
    secondProfile.sourceProfileHash = secondSpec.sourceProfileHash
    const draft = createDocxExportDraft("# 云南省大数据有限公司简介\n\n一、发展定位\n\n云南省大数据有限公司是省属国有功能性企业。")

    const first = await renderDocxWithTsAdapter(buildDocxIntermediateDocument({ draft, formatProfileSnapshot: firstProfile }), draft.title)
    const second = await renderDocxWithTsAdapter(buildDocxIntermediateDocument({ draft, formatProfileSnapshot: secondProfile }), draft.title)
    const firstStyles = await (await JSZip.loadAsync(first.bytes)).file("word/styles.xml")?.async("string") ?? ""
    const secondStyles = await (await JSZip.loadAsync(second.bytes)).file("word/styles.xml")?.async("string") ?? ""
    const firstDocument = await (await JSZip.loadAsync(first.bytes)).file("word/document.xml")?.async("string") ?? ""

    expect(firstStyles).not.toBe(secondStyles)
    expect(firstStyles).toContain('w:eastAsia="方正小标宋简体"')
    expect(firstStyles).toContain('w:eastAsia="仿宋_GB2312"')
    expect(firstStyles).toContain('w:val="44"')
    expect(secondStyles).toContain('w:eastAsia="楷体"')
    expect(secondStyles).toContain('w:val="30"')
    expect(`${firstStyles}\n${firstDocument}`).not.toContain(DOCX_STYLEFACTS_POISON)
  })

  it("writes StyleFacts-backed page margins into section properties", async () => {
    const source = createDocxStyleFactsProfile({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      pageSizeTwips: { widthTwips: 11906, heightTwips: 16838 },
      marginsTwips: { top: 2211, right: 1531, bottom: 1888, left: 1531 },
    })
    const spec = buildFormatSpecSnapshot(source)
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec = {
      ...spec.formatSpec,
      rules: spec.formatSpec.rules.filter((rule) => rule.dimension !== "list.numbering" && !rule.target.includes("list")),
    }
    profile.formatSpecHash = spec.formatSpecHash
    profile.sourceProfileHash = spec.sourceProfileHash
    const draft = createDocxExportDraft("# 云南省大数据有限公司简介\n\n一、发展定位\n\n正文段落。")

    const result = await renderDocxWithTsAdapter(buildDocxIntermediateDocument({ draft, formatProfileSnapshot: profile }), draft.title)
    const documentXml = await (await JSZip.loadAsync(result.bytes)).file("word/document.xml")?.async("string") ?? ""

    expect(documentXml).toContain('<w:pgMar w:top="2211"')
    expect(documentXml).toContain('w:right="1531"')
    expect(documentXml).toContain('w:bottom="1888"')
    expect(documentXml).toContain('w:left="1531"')
  })

  it("writes StyleFacts-backed header/footer distances and exact line spacing", async () => {
    const source = createDocxStyleFactsProfile({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      headingFont: "黑体",
      headingSizePt: 16,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      marginsTwips: { top: 2211, right: 1531, bottom: 1888, left: 1531, header: 851, footer: 992 },
      titleLineSpacingTwips: 570,
      headingLineSpacingTwips: 570,
      bodyLineSpacingTwips: 570,
    })
    const spec = buildFormatSpecSnapshot(source)
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec = {
      ...spec.formatSpec,
      rules: spec.formatSpec.rules.filter((rule) => rule.dimension !== "list.numbering" && !rule.target.includes("list")),
    }
    profile.formatSpecHash = spec.formatSpecHash
    profile.sourceProfileHash = spec.sourceProfileHash
    const draft = createDocxExportDraft("# 云南省大数据有限公司简介\n\n一、发展定位\n\n1. 省级政务云建设\n2. 新一代电子政务外网建设")

    const result = await renderDocxWithTsAdapter(buildDocxIntermediateDocument({ draft, formatProfileSnapshot: profile }), draft.title)
    const zip = await JSZip.loadAsync(result.bytes)
    const documentXml = await zip.file("word/document.xml")?.async("string") ?? ""
    const stylesXml = await zip.file("word/styles.xml")?.async("string") ?? ""

    expect(documentXml).toContain('w:header="851"')
    expect(documentXml).toContain('w:footer="992"')
    expect(stylesXml).toContain('w:line="570"')
    expect(documentXml).toContain("1. 省级政务云建设")
    expect(documentXml).not.toMatch(/1\. 省级政务云建设[\s\S]*?<w:numPr>/)
  })

  it("renders markdown emphasis and wiki links as DOCX inline runs without leaking markers", async () => {
    const draft = createDocxExportDraft([
      "# 云南省大数据有限公司简介",
      "",
      "**云南省大数据有限公司**由[[云南省国资委]]和[[中国电子信息产业集团有限公司|中国电子]]共同持股。",
      "",
      "一、发展定位",
      "",
      "核心任务包括：",
      "**支撑数字政府建设**：作为全省数字政府公共平台和政务信息系统的重要建设运维主体。",
      "[[云南省数据流通利用基础设施平台]]建设。",
    ].join("\n"))
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)
    const documentXml = await (await JSZip.loadAsync(result.bytes)).file("word/document.xml")?.async("string") ?? ""

    expect(documentXml).not.toContain("**")
    expect(documentXml).not.toContain("[[")
    expect(documentXml).not.toContain("]]")
    expect(documentXml).toContain("云南省大数据有限公司")
    expect(documentXml).toContain("云南省国资委")
    expect(documentXml).toContain("中国电子")
    expect(documentXml).toContain("支撑数字政府建设")
    expect(documentXml).toContain("<w:b/>")
  })

  it("does not export LLM-generated &emsp; indentation entities as literal Word text", async () => {
    const draft = createDocxExportDraft([
      "# 云南省大数据有限公司简介",
      "",
      "&emsp;&emsp;**云南省大数据有限公司**是省属国有功能性企业。",
    ].join("\n"))
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)
    const documentXml = await (await JSZip.loadAsync(result.bytes)).file("word/document.xml")?.async("string") ?? ""

    expect(JSON.stringify(intermediate.blocks)).not.toContain("&emsp;")
    expect(documentXml).not.toContain("&amp;emsp;")
    expect(documentXml).not.toContain("&emsp;")
    expect(documentXml).not.toContain(" ")
    expect(documentXml).toContain("云南省大数据有限公司")
  })
})
