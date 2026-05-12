import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadTemplates, saveTemplates } from "./template-persist"
import type { TemplateRecord } from "@/stores/template-store"

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { createDirectory, readFile, writeFile } from "@/commands/fs"

const mockCreateDirectory = vi.mocked(createDirectory)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

const template: TemplateRecord = {
  id: "template-1",
  title: "Template",
  description: "Description",
  intent: "Intent",
  requiredSections: ["Background"],
  sectionOrder: ["Background"],
  tone: "Formal",
  lengthLimit: "Short",
  citationPolicy: "Keep citations",
  createdAt: 1,
  updatedAt: 2,
}

beforeEach(() => {
  mockCreateDirectory.mockReset()
  mockReadFile.mockReset()
  mockWriteFile.mockReset()
  mockCreateDirectory.mockResolvedValue(undefined as unknown as void)
})

describe("template-persist", () => {
  it("saves templates and active binding under the project .llm-wiki folder", async () => {
    await saveTemplates("/project", [template], template.id)

    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/.llm-wiki")
    expect(mockWriteFile).toHaveBeenCalledOnce()
    expect(mockWriteFile.mock.calls[0][0]).toBe("/project/.llm-wiki/templates.json")
    expect(JSON.parse(mockWriteFile.mock.calls[0][1] as string)).toEqual({
      version: 1,
      templates: [template],
      activeTemplateId: template.id,
    })
  })

  it("loads the versioned template envelope", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      version: 1,
      templates: [template],
      activeTemplateId: template.id,
    }))

    await expect(loadTemplates("/project")).resolves.toEqual({
      version: 1,
      templates: [template],
      activeTemplateId: template.id,
    })
  })

  it("loads a legacy top-level template array", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([template]))

    await expect(loadTemplates("/project")).resolves.toEqual({
      version: 1,
      templates: [template],
      activeTemplateId: null,
    })
  })

  it("returns an empty envelope for missing or corrupt files", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"))
    await expect(loadTemplates("/project")).resolves.toEqual({
      version: 1,
      templates: [],
      activeTemplateId: null,
    })

    mockReadFile.mockResolvedValue("not json")
    await expect(loadTemplates("/project")).resolves.toEqual({
      version: 1,
      templates: [],
      activeTemplateId: null,
    })
  })
})
