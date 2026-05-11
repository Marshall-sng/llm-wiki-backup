import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadDrafts, saveDrafts } from "./draft-persist"
import type { DraftRecord } from "@/stores/draft-store"

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { createDirectory, readFile, writeFile } from "@/commands/fs"

const mockCreateDirectory = vi.mocked(createDirectory)
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

const draft: DraftRecord = {
  id: "draft-1",
  title: "Draft",
  content: "Body",
  references: [{ title: "Ref", path: "wiki/sources/ref.md" }],
  source: {
    kind: "chat-assistant",
    conversationId: "conv-1",
    messageId: "msg-1",
    messageTimestamp: 1,
    contentHash: "hash",
  },
  createdAt: 2,
  updatedAt: 3,
}

beforeEach(() => {
  mockCreateDirectory.mockReset()
  mockReadFile.mockReset()
  mockWriteFile.mockReset()
  mockCreateDirectory.mockResolvedValue(undefined as unknown as void)
})

describe("draft-persist", () => {
  it("saves drafts under the project .llm-wiki folder", async () => {
    await saveDrafts("/project", [draft])

    expect(mockCreateDirectory).toHaveBeenCalledWith("/project/.llm-wiki")
    expect(mockWriteFile).toHaveBeenCalledOnce()
    expect(mockWriteFile.mock.calls[0][0]).toBe("/project/.llm-wiki/drafts.json")
    expect(JSON.parse(mockWriteFile.mock.calls[0][1] as string)).toEqual({
      version: 1,
      drafts: [draft],
    })
  })

  it("loads the versioned draft envelope", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ version: 1, drafts: [draft] }))

    await expect(loadDrafts("/project")).resolves.toEqual([draft])
  })

  it("loads a legacy top-level draft array", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([draft]))

    await expect(loadDrafts("/project")).resolves.toEqual([draft])
  })

  it("returns an empty list for missing or corrupt files", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"))
    await expect(loadDrafts("/project")).resolves.toEqual([])

    mockReadFile.mockResolvedValue("not json")
    await expect(loadDrafts("/project")).resolves.toEqual([])
  })
})
