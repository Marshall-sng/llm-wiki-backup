import { describe, expect, it } from "vitest"

import { resolveDocxStylePolicy } from "@/lib/docx-format-style"
import { createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx format style resolver", () => {
  it("resolves canonical FormatSpec dimensions into writer style policy", () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [
      {
        id: "title-main",
        target: "title",
        dimension: "title.main",
        rule: "主标题",
        detail: "主标题居中。",
        source: "standard-default",
        confidence: "high",
        attributes: [
          { name: "fontFamily", value: "方正小标宋简体", confidence: "high" },
          { name: "fontSizePt", value: "22", unit: "pt", confidence: "high" },
          { name: "alignment", value: "center", confidence: "high" },
        ],
      },
      {
        id: "body",
        target: "paragraph",
        dimension: "paragraph.body",
        rule: "正文",
        detail: "正文缩进。",
        source: "standard-default",
        confidence: "high",
        attributes: [
          { name: "fontFamily", value: "FangSong", confidence: "high" },
          { name: "fontSizePt", value: "16", unit: "pt", confidence: "high" },
          { name: "firstLineIndentChars", value: "2", confidence: "high" },
          { name: "lineSpacingTwips", value: "570", unit: "twip", confidence: "high" },
        ],
      },
    ]

    const policy = resolveDocxStylePolicy(profile)

    expect(policy.ruleRefsByDimension["title.main"]).toEqual(["title-main"])
    expect(policy.byDimension["title.main"]).toMatchObject({ fontFamily: "方正小标宋简体", fontSizeHalfPoints: 44, alignment: "center" })
    expect(policy.byDimension["paragraph.body"]).toMatchObject({ fontFamily: "仿宋", fontSizeHalfPoints: 32, firstLineIndentTwips: 640, lineSpacingTwips: 570 })
  })

  it("keeps safe defaults for legacy snapshots without canonical dimensions", () => {
    const policy = resolveDocxStylePolicy(createDocxFormatProfileSnapshot())

    expect(policy.byDimension["title.main"]?.fontSizeHalfPoints).toBe(44)
    expect(policy.byDimension["heading.level1"]?.fontFamily).toBe("黑体")
    expect(policy.byDimension["heading.level2"]?.fontFamily).toBe("楷体")
    expect(policy.byDimension["paragraph.body"]?.fontFamily).toBe("仿宋")
  })

  it("normalizes common Chinese source font variants only at the writer boundary", () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [{
      id: "stylefacts-body",
      target: "paragraph",
      dimension: "paragraph.body",
      rule: "正文使用来源样式事实",
      detail: "FormatSpec 保留来源字体名，writer resolver 负责安全规范化。",
      source: "detected",
      confidence: "high",
      attributes: [
        { name: "fontFamily", value: "仿宋_GB2312", confidence: "high" },
        { name: "fontSizePt", value: "16", unit: "pt", confidence: "high" },
      ],
    }]

    const policy = resolveDocxStylePolicy(profile)

    expect(profile.formatSpec.rules[0].attributes?.[0].value).toBe("仿宋_GB2312")
    expect(policy.byDimension["paragraph.body"]?.fontFamily).toBe("仿宋_GB2312")
  })

  it("resolves DOCX page margin and size attributes for the writer", () => {
    const profile = createDocxFormatProfileSnapshot()
    profile.formatSpec.rules = [
      {
        id: "page-size",
        target: "page",
        dimension: "page.size",
        rule: "页面尺寸",
        detail: "使用来源页面尺寸。",
        source: "detected",
        confidence: "high",
        attributes: [
          { name: "pageWidthTwips", value: "11906", unit: "twip", confidence: "high" },
          { name: "pageHeightTwips", value: "16838", unit: "twip", confidence: "high" },
        ],
      },
      {
        id: "page-margin",
        target: "page",
        dimension: "page.margin",
        rule: "页边距",
        detail: "使用来源页边距。",
        source: "detected",
        confidence: "high",
        attributes: [
          { name: "marginTopTwips", value: "2211", unit: "twip", confidence: "high" },
          { name: "marginRightTwips", value: "1531", unit: "twip", confidence: "high" },
          { name: "marginBottomTwips", value: "1888", unit: "twip", confidence: "high" },
          { name: "marginLeftTwips", value: "1531", unit: "twip", confidence: "high" },
          { name: "headerDistanceTwips", value: "851", unit: "twip", confidence: "high" },
          { name: "footerDistanceTwips", value: "992", unit: "twip", confidence: "high" },
        ],
      },
    ]

    const policy = resolveDocxStylePolicy(profile)

    expect(policy.page.sizeTwips).toEqual({ width: 11906, height: 16838 })
    expect(policy.page.marginTwips).toEqual({ top: 2211, right: 1531, bottom: 1888, left: 1531 })
    expect(policy.page.headerTwips).toBe(851)
    expect(policy.page.footerTwips).toBe(992)
  })
})
