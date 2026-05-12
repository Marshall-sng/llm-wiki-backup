import { describe, expect, it, vi } from "vitest"
import { buildDraftVersion, compareDraftText } from "./draft-versioning"

describe("buildDraftVersion", () => {
  it("builds an immutable snapshot and deep-copies references", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const references = [{ title: "Source", path: "wiki/source.md" }]

    const version = buildDraftVersion({
      draftId: "draft-1",
      title: "Draft",
      content: "Body",
      references,
      contentHash: "abc123",
      reason: "manual-snapshot",
      note: "before edit",
    })

    references[0].title = "Mutated"

    expect(version.id).toMatch(/^draft_version_/)
    expect(version).toMatchObject({
      title: "Draft",
      content: "Body",
      contentHash: "abc123",
      createdAt: 1_700_000_000_000,
      reason: "manual-snapshot",
      parentDraftId: "draft-1",
      note: "before edit",
    })
    expect(version.references).toEqual([{ title: "Source", path: "wiki/source.md" }])
    expect(version.references).not.toBe(references)
    vi.useRealTimers()
  })
})

describe("compareDraftText", () => {
  it("returns zero changes for identical text", () => {
    expect(compareDraftText("a\nb", "a\nb")).toMatchObject({
      addedLines: 0,
      removedLines: 0,
      unchangedLines: 2,
      totalCurrentLines: 2,
      totalVersionLines: 2,
      changedRatio: 0,
      tooLarge: false,
    })
  })

  it("counts pure additions", () => {
    expect(compareDraftText("a\nb\nc", "a")).toMatchObject({
      addedLines: 2,
      removedLines: 0,
      unchangedLines: 1,
      changedRatio: 2 / 3,
    })
  })

  it("counts pure removals", () => {
    expect(compareDraftText("a", "a\nb\nc")).toMatchObject({
      addedLines: 0,
      removedLines: 2,
      unchangedLines: 1,
      changedRatio: 2 / 3,
    })
  })

  it("handles duplicate lines deterministically with LCS", () => {
    expect(compareDraftText("a\nb\na\nc", "a\na\nc")).toMatchObject({
      addedLines: 1,
      removedLines: 0,
      unchangedLines: 3,
      changedRatio: 1 / 4,
    })
  })

  it("handles empty text", () => {
    expect(compareDraftText("", "")).toMatchObject({
      addedLines: 0,
      removedLines: 0,
      unchangedLines: 0,
      totalCurrentLines: 0,
      totalVersionLines: 0,
      changedRatio: 0,
    })
  })

  it("skips detailed comparison when line count exceeds threshold", () => {
    const current = ["a", "b", "c"].join("\n")
    const version = ["a", "b", "c"].join("\n")
    expect(compareDraftText(current, version, { maxLines: 5 })).toMatchObject({
      totalCurrentLines: 3,
      totalVersionLines: 3,
      tooLarge: true,
    })
  })
})
