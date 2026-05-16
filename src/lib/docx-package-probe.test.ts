import { describe, expect, it } from "vitest"

import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import { probeDocxPackage } from "@/lib/docx-package-probe"
import { renderDocxWithTsAdapter } from "@/lib/docx-ts-adapter"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx package probe", () => {
  it("detects required DOCX package parts and structural assertions", async () => {
    const draft = createDocxExportDraft()
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const rendered = await renderDocxWithTsAdapter(intermediate, draft.title)
    const probe = await probeDocxPackage(rendered.bytes, {
      documentTitle: draft.title,
      level1Headings: ["一、背景", "二、平台架构", "三、目的与意义"],
      level2Headings: ["（一）国家全域节点"],
      paragraphSnippets: ["随着国家层面", "国家全域节点负责", "平台将为数据流通利用提供公共服务"],
      requireOrderedList: true,
      requireUnorderedList: true,
      requireTable: true,
    })

    expect(probe.validationErrors).toEqual([])
    expect(probe.knownWarnings).toEqual(expect.arrayContaining(["manual-word-openability-not-tested", "pixel-perfect-rendering-not-claimed"]))
    expect(probe.structuralAssertions.map((item) => item.id)).toEqual(expect.arrayContaining([
      "document-title-present",
      "level1-headings-present",
      "level2-heading-present",
      "ordered-list-distinguishable",
      "unordered-list-distinguishable",
      "simple-table-shape",
    ]))
  })

  it("turns invalid or empty bytes into validation errors", async () => {
    await expect(probeDocxPackage(new Uint8Array())).resolves.toMatchObject({ validationErrors: ["empty-docx-bytes"] })
    const invalid = await probeDocxPackage(new Uint8Array([1, 2, 3, 4]))
    expect(invalid.validationErrors).toContain("docx-package-probe-exception")
  })

  it("validates visible paragraph text across DOCX run boundaries instead of raw XML substrings", async () => {
    const draft = createDocxExportDraft([
      "# 云南省大数据有限公司简介",
      "",
      "**云南省大数据有限公司**是经云南省委、省政府批准成立的省属国有功能性企业。",
    ].join("\n"))
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const rendered = await renderDocxWithTsAdapter(intermediate, draft.title)
    const probe = await probeDocxPackage(rendered.bytes, {
      documentTitle: "云南省大数据有限公司简介",
      paragraphSnippets: ["云南省大数据有限公司是经云南省委、省政府批准"],
    })

    expect(probe.validationErrors).toEqual([])
  })
})
