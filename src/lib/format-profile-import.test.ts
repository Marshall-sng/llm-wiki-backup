import { describe, expect, it, vi } from "vitest"
import { importFormatProfileFromPath } from "./format-profile-import"

describe("format-profile-import", () => {
  it("imports by read/probe only and does not require cache-writing preprocessing", async () => {
    const readFile = vi.fn(async () => "第一章 总则\n正文内容".repeat(30))
    const probeFormatProfile = vi.fn(async () => ({
      kind: "office_zip" as const,
      officeKind: "docx" as const,
      structure: { paragraphs: 12, tables: 0, headingCandidates: [{ text: "第一章 总则" }] },
      style: { fonts: ["FangSong"], fontUsage: [{ value: "FangSong", count: 8 }] },
    }))

    const profile = await importFormatProfileFromPath("D:/llm_wiki/基准素材_复制.docx", {
      readFile,
      probeFormatProfile,
    })

    expect(readFile).toHaveBeenCalledOnce()
    expect(probeFormatProfile).toHaveBeenCalledOnce()
    expect(profile.title).toBe("基准素材_复制")
    expect(profile.fileType).toBe("docx")
    expect(profile.confidence).toBe("high")
  })

  it("still imports probe-only style evidence when text extraction fails", async () => {
    const readFile = vi.fn(async () => {
      throw new Error("binary read failed")
    })
    const probeFormatProfile = vi.fn(async () => ({
      kind: "office_zip" as const,
      officeKind: "docx" as const,
      structure: { paragraphs: 1, tables: 0 },
      style: { fonts: ["FangSong"], fontUsage: [{ value: "FangSong", count: 8 }] },
    }))

    const profile = await importFormatProfileFromPath("D:/llm_wiki/样式.docx", {
      readFile,
      probeFormatProfile,
    })

    expect(profile.fileType).toBe("docx")
    expect(profile.styleProfile.evidenceSummary?.join("\n")).toContain("FangSong")
    expect(profile.diagnostics.map((item) => item.message).join("\n")).not.toContain("binary read failed")
  })

  it("surfaces a clear error when neither text nor probe can be read", async () => {
    await expect(importFormatProfileFromPath("D:/llm_wiki/坏文件.docx", {
      readFile: vi.fn(async () => {
        throw new Error("read failed")
      }),
      probeFormatProfile: vi.fn(async () => {
        throw new Error("probe failed")
      }),
    })).rejects.toThrow("read failed")
  })
})
