import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadFormatProfiles, saveFormatProfiles } from "./format-profile-persist"
import { buildFormatProfileFromExtractedText, type FormatProfileRecord } from "./format-profile"

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { createDirectory, readFile, writeFile } from "@/commands/fs"

const mockCreateDirectory = vi.mocked(createDirectory)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

const profile: FormatProfileRecord = {
  id: "profile-1",
  title: "Profile",
  sourceName: "report.docx",
  fileType: "docx",
  sourceKind: "finished-file",
  documentKind: "formal-document",
  confidence: "high",
  importedAt: 1,
  updatedAt: 2,
  structureProfile: { sectionPattern: "numbered", sections: [], evidenceSummary: [] },
  styleProfile: { toneHints: [], layoutHints: [] },
  writingProfile: { generationInstruction: "instruction", constraints: [] },
  diagnostics: [],
  textSample: "",
}

beforeEach(() => {
  mockCreateDirectory.mockReset()
  mockReadFile.mockReset()
  mockWriteFile.mockReset()
  mockCreateDirectory.mockResolvedValue(undefined as unknown as void)
})

describe("format-profile-persist", () => {
  it("saves profiles and active binding under the project .llm-wiki folder", async () => {
    await saveFormatProfiles("/project", [profile], profile.id)

    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/.llm-wiki")
    expect(mockWriteFile).toHaveBeenCalledOnce()
    expect(mockWriteFile.mock.calls[0][0]).toBe("/project/.llm-wiki/format-profiles.json")
    expect(JSON.parse(mockWriteFile.mock.calls[0][1] as string)).toEqual({
      version: 1,
      profiles: [profile],
      activeProfileId: profile.id,
    })
  })

  it("loads the versioned profile envelope", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ version: 1, profiles: [profile], activeProfileId: profile.id }))

    await expect(loadFormatProfiles("/project")).resolves.toEqual({
      version: 1,
      profiles: [profile],
      activeProfileId: profile.id,
    })
  })

  it("round-trips a StyleFacts-backed profile without dropping metadata", async () => {
    const richProfile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/rich.docx",
      now: 11,
      extractedText: "第一章 总则".repeat(30),
      probe: {
        kind: "office_zip",
        officeKind: "docx",
        structure: { paragraphs: 1, runs: 1, tables: 0 },
        style: { styleCount: 1, fonts: ["FangSong"], fontUsage: [{ value: "FangSong", count: 1 }], page: { widthTwips: "11905", heightTwips: "16834" } },
      },
    })

    await saveFormatProfiles("/project", [richProfile], richProfile.id)

    const lastCall = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1]
    const saved = JSON.parse(lastCall?.[1] as string)
    expect(saved.profiles[0].styleFacts.schemaVersion).toBe("format-profile-style-facts.v0")
    expect(saved.profiles[0].styleFacts.metadata.styleFactsSha256).toBe(richProfile.styleFacts?.metadata.styleFactsSha256)
    expect(saved.profiles[0].styleFacts.evidence.length).toBeGreaterThan(0)

    mockReadFile.mockResolvedValue(JSON.stringify(saved))
    const loaded = await loadFormatProfiles("/project")
    expect(loaded.profiles[0].styleFacts?.metadata.styleFactsSha256).toBe(richProfile.styleFacts?.metadata.styleFactsSha256)
  })


  it("returns an empty envelope for missing or corrupt files", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"))
    await expect(loadFormatProfiles("/project")).resolves.toEqual({ version: 1, profiles: [], activeProfileId: null })

    mockReadFile.mockResolvedValue("not json")
    await expect(loadFormatProfiles("/project")).resolves.toEqual({ version: 1, profiles: [], activeProfileId: null })
  })
})
