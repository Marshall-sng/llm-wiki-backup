import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { useDraftStore, cleanDraftContent, hashDraftContent, type DraftRecord } from "./draft-store"
import type { DisplayMessage } from "./chat-store"

function makeMessage(overrides: Partial<DisplayMessage> = {}): DisplayMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "# Useful answer\n\nBody",
    timestamp: 123,
    conversationId: "conv-1",
    references: [{ title: "Source A", path: "wiki/sources/a.md" }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
  useDraftStore.setState({
    drafts: [],
    selectedDraftId: null,
    lastChange: { revision: 0, persist: "none" },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("draft-store", () => {
  it("creates an editable draft from an assistant message with source metadata", () => {
    const draft = useDraftStore.getState().createDraftFromMessage(makeMessage())

    expect(draft.id).toMatch(/^draft_/) 
    expect(draft.title).toBe("Useful answer")
    expect(draft.content).toBe("# Useful answer\n\nBody")
    expect(draft.references).toEqual([{ title: "Source A", path: "wiki/sources/a.md" }])
    expect(draft.source).toMatchObject({
      kind: "chat-assistant",
      conversationId: "conv-1",
      messageId: "msg-1",
      messageTimestamp: 123,
      contentHash: hashDraftContent(draft.content),
    })
    expect(draft.versions).toEqual([])
    expect(useDraftStore.getState().selectedDraftId).toBe(draft.id)
    expect(useDraftStore.getState().lastChange.persist).toBe("immediate")
  })

  it("deduplicates repeated draft creation for the same message", () => {
    const store = useDraftStore.getState()
    const first = store.createDraftFromMessage(makeMessage())
    const second = useDraftStore.getState().createDraftFromMessage(makeMessage())

    expect(second.id).toBe(first.id)
    expect(useDraftStore.getState().drafts).toHaveLength(1)
  })

  it("attaches derivation metadata when creating a processed draft", () => {
    const derivation = {
      parentDraftId: "draft-parent",
      parentDraftTitle: "Parent Draft",
      parentContentHash: "parent-hash",
      instruction: "只改风险提醒",
      processingConversationId: "conv-processing",
    }

    const draft = useDraftStore.getState().createDraftFromMessage(makeMessage(), { derivation })

    expect(draft.derivation).toEqual(derivation)
  })

  it("forceNew creates a new draft even when content hash matches an existing draft", () => {
    const first = useDraftStore.getState().createDraftFromMessage(makeMessage())
    const derivation = {
      parentDraftId: first.id,
      parentDraftTitle: first.title,
      parentContentHash: first.source.contentHash,
      instruction: "保存为新底稿",
      processingConversationId: "conv-processing",
    }

    const second = useDraftStore.getState().createDraftFromMessage(makeMessage(), {
      derivation,
      forceNew: true,
    })

    expect(second.id).not.toBe(first.id)
    expect(second.derivation).toEqual(derivation)
    expect(useDraftStore.getState().drafts).toHaveLength(2)
  })

  it("updates title/content and refreshes the content hash", () => {
    const draft = useDraftStore.getState().createDraftFromMessage(makeMessage())
    useDraftStore.getState().updateDraft(draft.id, { title: "Edited", content: "Edited content" })

    const updated = useDraftStore.getState().drafts[0]
    expect(updated.title).toBe("Edited")
    expect(updated.content).toBe("Edited content")
    expect(updated.source.contentHash).toBe(hashDraftContent("Edited content"))
    expect(useDraftStore.getState().lastChange.persist).toBe("debounced")
  })

  it("deletes the selected draft and selects the next draft", () => {
    const first = useDraftStore.getState().createDraftFromMessage(makeMessage({ id: "msg-1", content: "One" }))
    const second = useDraftStore.getState().createDraftFromMessage(makeMessage({ id: "msg-2", content: "Two" }))

    useDraftStore.getState().deleteDraft(second.id)

    expect(useDraftStore.getState().drafts.map((draft) => draft.id)).toEqual([first.id])
    expect(useDraftStore.getState().selectedDraftId).toBe(first.id)
    expect(useDraftStore.getState().lastChange.persist).toBe("immediate")
  })

  it("hydrates silently without triggering persistence", () => {
    const derivation = {
      parentDraftId: "draft-parent",
      parentDraftTitle: "Parent",
      parentContentHash: "hash-parent",
      instruction: "加工要求",
      processingConversationId: "conv-processing",
    }
    const draft: DraftRecord = {
      id: "draft-existing",
      title: "Existing",
      content: "Existing body",
      references: [],
      source: {
        kind: "chat-assistant",
        conversationId: "conv",
        messageId: "msg",
        messageTimestamp: 1,
        contentHash: "abc",
      },
      derivation,
      versions: [],
      createdAt: 1,
      updatedAt: 2,
    }

    useDraftStore.getState().setDrafts([draft], { silent: true })

    expect(useDraftStore.getState().drafts).toEqual([draft])
    expect(useDraftStore.getState().drafts[0].derivation).toEqual(derivation)
    expect(useDraftStore.getState().selectedDraftId).toBe(draft.id)
    expect(useDraftStore.getState().lastChange.persist).toBe("none")
  })

  it("normalizes legacy drafts to an empty versions array", () => {
    const legacy = {
      id: "draft-legacy",
      title: "Legacy",
      content: "Legacy body",
      references: [],
      source: {
        kind: "chat-assistant" as const,
        conversationId: "conv",
        messageId: "msg",
        messageTimestamp: 1,
        contentHash: "abc",
      },
      createdAt: 1,
      updatedAt: 2,
    } as unknown as DraftRecord

    useDraftStore.getState().setDrafts([legacy], { silent: true })

    expect(useDraftStore.getState().drafts[0].versions).toEqual([])
    expect(useDraftStore.getState().drafts[0].restoration).toBeUndefined()
  })

  it("creates version snapshots newest-first and persists immediately", () => {
    const draft = useDraftStore.getState().createDraftFromMessage(makeMessage())
    vi.setSystemTime(1_700_000_000_100)
    const snapshot = useDraftStore.getState().createVersionSnapshot(draft.id, { note: "before edit" })

    const updated = useDraftStore.getState().drafts[0]
    expect(snapshot).toMatchObject({
      title: draft.title,
      content: draft.content,
      contentHash: draft.source.contentHash,
      reason: "manual-snapshot",
      note: "before edit",
      parentDraftId: draft.id,
    })
    expect(updated.versions[0]).toBe(snapshot)
    expect(updated.updatedAt).toBe(1_700_000_000_100)
    expect(useDraftStore.getState().lastChange.persist).toBe("immediate")
  })

  it("does not auto-create snapshots on update", () => {
    const draft = useDraftStore.getState().createDraftFromMessage(makeMessage())
    useDraftStore.getState().updateDraft(draft.id, { content: "Edited" })

    expect(useDraftStore.getState().drafts[0].versions).toEqual([])
  })

  it("returns null when snapshot or restore targets are missing", () => {
    expect(useDraftStore.getState().createVersionSnapshot("missing")).toBeNull()
    expect(useDraftStore.getState().restoreVersionAsDraft("missing", "missing-version")).toBeNull()
  })

  it("restores a version as a new selected draft without overwriting the parent", () => {
    const parent = useDraftStore.getState().createDraftFromMessage(makeMessage({ content: "Original" }))
    const snapshot = useDraftStore.getState().createVersionSnapshot(parent.id)
    expect(snapshot).not.toBeNull()
    useDraftStore.getState().updateDraft(parent.id, { content: "Edited" })
    vi.setSystemTime(1_700_000_000_200)

    const restored = useDraftStore.getState().restoreVersionAsDraft(parent.id, snapshot!.id)

    expect(restored).not.toBeNull()
    expect(restored!.id).not.toBe(parent.id)
    expect(restored!.content).toBe("Original")
    expect(restored!.references).toEqual(parent.references)
    expect(restored!.references).not.toBe(parent.references)
    expect(restored!.source).toMatchObject({
      conversationId: parent.source.conversationId,
      messageId: parent.source.messageId,
      contentHash: hashDraftContent("Original"),
    })
    expect(restored!.versions).toEqual([])
    expect(restored!.restoration).toEqual({
      parentDraftId: parent.id,
      parentDraftTitle: parent.title,
      parentVersionId: snapshot!.id,
      parentContentHash: snapshot!.contentHash,
      restoredAt: 1_700_000_000_200,
    })
    expect(useDraftStore.getState().selectedDraftId).toBe(restored!.id)
    expect(useDraftStore.getState().drafts.find((item) => item.id === parent.id)?.content).toBe("Edited")
    expect(useDraftStore.getState().lastChange.persist).toBe("immediate")
  })

  it("hydrates and normalizes versions and restoration metadata", () => {
    const draft = {
      id: "draft-with-version",
      title: "Current",
      content: "Current body",
      references: [],
      source: {
        kind: "chat-assistant" as const,
        conversationId: "conv",
        messageId: "msg",
        messageTimestamp: 1,
        contentHash: "current-hash",
      },
      versions: [
        {
          id: "version-1",
          title: "Old",
          content: "Old body",
          references: [{ title: "Ref", path: "wiki/ref.md" }],
          contentHash: "old-hash",
          createdAt: 3,
          reason: "restore" as const,
        },
      ],
      restoration: {
        parentDraftId: "parent",
        parentDraftTitle: "Parent",
        parentVersionId: "version-parent",
        parentContentHash: "parent-hash",
        restoredAt: 4,
      },
      createdAt: 1,
      updatedAt: 2,
    } satisfies DraftRecord

    useDraftStore.getState().setDrafts([draft], { silent: true })

    expect(useDraftStore.getState().drafts[0].versions).toHaveLength(1)
    expect(useDraftStore.getState().drafts[0].versions[0]).toMatchObject({
      id: "version-1",
      title: "Old",
      references: [{ title: "Ref", path: "wiki/ref.md" }],
      reason: "restore",
    })
    expect(useDraftStore.getState().drafts[0].restoration).toEqual(draft.restoration)
  })
})

describe("cleanDraftContent", () => {
  it("removes hidden source comments and thinking blocks", () => {
    expect(cleanDraftContent("<!-- sources: [] -->\n<think>hidden</think>\nVisible")).toBe("Visible")
  })

  it("normalizes LLM-generated whitespace HTML entities when saving a draft", () => {
    expect(cleanDraftContent("# 标题\n\n&emsp;&emsp;云南省大数据有限公司")).toBe("# 标题\n\n云南省大数据有限公司")
    expect(cleanDraftContent("&lt;保留普通 HTML 示例&gt;")).toBe("&lt;保留普通 HTML 示例&gt;")
  })
})
