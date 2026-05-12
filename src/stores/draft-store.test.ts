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
      createdAt: 1,
      updatedAt: 2,
    }

    useDraftStore.getState().setDrafts([draft], { silent: true })

    expect(useDraftStore.getState().drafts).toEqual([draft])
    expect(useDraftStore.getState().drafts[0].derivation).toEqual(derivation)
    expect(useDraftStore.getState().selectedDraftId).toBe(draft.id)
    expect(useDraftStore.getState().lastChange.persist).toBe("none")
  })
})

describe("cleanDraftContent", () => {
  it("removes hidden source comments and thinking blocks", () => {
    expect(cleanDraftContent("<!-- sources: [] -->\n<think>hidden</think>\nVisible")).toBe("Visible")
  })
})
