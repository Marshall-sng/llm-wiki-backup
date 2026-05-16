import { describe, expect, it } from "vitest"

import { buildDocxExportContract } from "@/lib/docx-export-contract"
import { buildDocxExecutableStyleFactsInput, buildDocxExecutableStyleRules } from "@/lib/docx-stylefacts-format-attributes"
import { buildFormatSpecSnapshot } from "@/lib/format-spec"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"
import { createDocxStyleFactsEnvelope, createDocxStyleFactsProfile, DOCX_STYLEFACTS_POISON } from "@/test-helpers/docx-stylefacts-profile-fixtures"

describe("DOCX StyleFacts executable FormatSpec attributes", () => {
  it("constructs a sanitized input catalog without raw evidence values", () => {
    const styleFacts = createDocxStyleFactsEnvelope({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      poison: DOCX_STYLEFACTS_POISON,
    })

    const input = buildDocxExecutableStyleFactsInput(styleFacts, "high")

    expect(input).toBeTruthy()
    const serialized = JSON.stringify(input)
    expect(serialized).toContain("style.docx.styleDef.0001")
    expect(serialized).not.toContain(DOCX_STYLEFACTS_POISON)
    expect(serialized).not.toContain("value\":{\"poison\"")
  })

  it("emits detected rules only for the supported DOCX dimensions", () => {
    const input = buildDocxExecutableStyleFactsInput(createDocxStyleFactsEnvelope({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      headingFont: "黑体",
      headingSizePt: 16,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
    }), "high")

    const rules = buildDocxExecutableStyleRules(input)

    expect(rules.map((rule) => rule.dimension)).toEqual(["page.size", "page.margin", "title.main", "heading.level1", "paragraph.body"])
    expect(rules.every((rule) => rule.source === "detected")).toBe(true)
    expect(rules.flatMap((rule) => rule.attributes ?? []).map((attribute) => attribute.value)).toEqual(expect.arrayContaining(["方正小标宋简体", "仿宋_GB2312", "22", "16"]))
    expect(JSON.stringify(rules)).not.toContain(DOCX_STYLEFACTS_POISON)
  })

  it("prefers Chinese body fonts over Latin fallback usage when building body rules", () => {
    const styleFacts = createDocxStyleFactsEnvelope({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
    })
    const typography = styleFacts.styleFacts.typography as { fontUsage: { value: unknown[] } }
    typography.fontUsage.value = [
      { value: "Times New Roman", count: 87 },
      { value: "zh-CN", count: 85 },
      { value: "仿宋_GB2312", count: 74 },
      { value: "黑体", count: 6 },
    ]

    const bodyRule = buildDocxExecutableStyleRules(buildDocxExecutableStyleFactsInput(styleFacts, "high"))
      .find((rule) => rule.dimension === "paragraph.body")

    expect(bodyRule?.attributes?.find((attribute) => attribute.name === "fontFamily")?.value).toBe("仿宋_GB2312")
  })

  it("prefers dominant body font usage over paragraph-style defaults for body paragraphs", () => {
    const input = buildDocxExecutableStyleFactsInput(createDocxStyleFactsEnvelope({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      bodyStyleSizePt: 10.5,
    }), "high")

    const bodyRule = buildDocxExecutableStyleRules(input).find((rule) => rule.dimension === "paragraph.body")

    expect(bodyRule?.attributes?.find((attribute) => attribute.name === "fontFamily")?.value).toBe("仿宋_GB2312")
    expect(bodyRule?.attributes?.find((attribute) => attribute.name === "fontSizePt")?.value).toBe("16")
  })

  it("carries DOCX line spacing and header/footer distances as executable attributes", () => {
    const input = buildDocxExecutableStyleFactsInput(createDocxStyleFactsEnvelope({
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
    }), "high")

    const rules = buildDocxExecutableStyleRules(input)
    const title = rules.find((rule) => rule.dimension === "title.main")
    const heading = rules.find((rule) => rule.dimension === "heading.level1")
    const body = rules.find((rule) => rule.dimension === "paragraph.body")
    const page = rules.find((rule) => rule.dimension === "page.margin")

    expect(title?.attributes).toContainEqual(expect.objectContaining({ name: "lineSpacingTwips", value: "570" }))
    expect(heading?.attributes).toContainEqual(expect.objectContaining({ name: "lineSpacingTwips", value: "570" }))
    expect(body?.attributes).toContainEqual(expect.objectContaining({ name: "lineSpacingTwips", value: "570" }))
    expect(page?.attributes).toContainEqual(expect.objectContaining({ name: "headerDistanceTwips", value: "851" }))
    expect(page?.attributes).toContainEqual(expect.objectContaining({ name: "footerDistanceTwips", value: "992" }))
  })

  it("keeps raw evidence and unrelated profile text out of FormatSpec and prompt blocks", () => {
    const profile = createDocxStyleFactsProfile({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      poison: DOCX_STYLEFACTS_POISON,
    })
    const snapshot = buildFormatSpecSnapshot(profile)
    const serialized = JSON.stringify(snapshot)

    expect(snapshot.formatSpec.rules.map((rule) => rule.id)).toEqual(expect.arrayContaining([
      "docx-stylefacts-title-main",
      "docx-stylefacts-heading-level1",
      "docx-stylefacts-paragraph-body",
      "docx-stylefacts-page-margin",
    ]))
    expect(snapshot.formatSpec.boundaries.join("\n")).toContain("writer 规则")
    expect(serialized).not.toContain(DOCX_STYLEFACTS_POISON)
    expect(serialized).not.toContain("rawEvidence")
    expect(serialized).not.toContain("styleFacts\":")
  })

  it("drops malformed evidenceRefs that are not registered evidence IDs before export", () => {
    const poisonRef = `${DOCX_STYLEFACTS_POISON}_AS_EVIDENCE_REF`
    const profile = createDocxStyleFactsProfile({
      titleFont: "方正小标宋简体",
      titleSizePt: 22,
      bodyFont: "仿宋_GB2312",
      bodySizePt: 16,
      poisonEvidenceRef: poisonRef,
    })

    const input = buildDocxExecutableStyleFactsInput(profile.styleFacts, "high")
    const rules = buildDocxExecutableStyleRules(input)
    const snapshot = buildFormatSpecSnapshot(profile)
    const exportProfile = createDocxFormatProfileSnapshot()
    exportProfile.formatSpec = snapshot.formatSpec
    exportProfile.formatSpecHash = snapshot.formatSpecHash
    exportProfile.sourceProfileHash = snapshot.sourceProfileHash
    const contract = buildDocxExportContract({
      draft: createDocxExportDraft("# 标题\n\n正文段落。"),
      formatProfileSnapshot: exportProfile,
      now: 1,
    })

    expect(JSON.stringify(input)).not.toContain(poisonRef)
    expect(JSON.stringify(rules)).not.toContain(poisonRef)
    expect(JSON.stringify(snapshot)).not.toContain(poisonRef)
    expect(JSON.stringify(contract)).not.toContain(poisonRef)
    expect(rules.flatMap((rule) => rule.evidenceRefs ?? [])).toEqual(expect.arrayContaining(["style.docx.styleDef.0001"]))
  })
})
