import { beforeEach, describe, expect, it, vi } from "vitest"
import { normalizeConversation, useChatStore, type DraftProcessingContext } from "./chat-store"

const context: DraftProcessingContext = {
  draftId: "draft-1",
  draftTitle: "底稿一",
  parentContentHash: "abc123",
  instruction: "只改风险提醒",
  references: [{ title: "资料 A", path: "wiki/a.md" }],
  startedAt: 1_700_000_000_000,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    isStreaming: false,
    streamingContent: "",
    mode: "chat",
    ingestSource: null,
    maxHistoryMessages: 10,
    pendingDraftProcessingRequest: null,
  })
})

describe("chat-store conversations", () => {
  it("keeps default conversation creation compatible", () => {
    const id = useChatStore.getState().createConversation()
    const conversation = useChatStore.getState().conversations[0]

    expect(conversation).toMatchObject({
      id,
      title: "New Conversation",
      kind: "normal",
    })
    expect(useChatStore.getState().activeConversationId).toBe(id)
  })

  it("creates draft-processing conversations with context and preserves their title", () => {
    const id = useChatStore.getState().createConversation({
      title: "加工：底稿一",
      kind: "draft-processing",
      draftContext: context,
    })

    useChatStore.getState().addMessage("user", "加工请求正文")

    const conversation = useChatStore.getState().conversations.find((c) => c.id === id)
    expect(conversation).toMatchObject({
      id,
      title: "加工：底稿一",
      kind: "draft-processing",
      draftContext: context,
    })
  })

  it("consumes pending draft-processing requests once", () => {
    useChatStore.getState().enqueueDraftProcessingRequest({
      id: "req-1",
      conversationId: "conv-1",
      prompt: "prompt",
    })

    expect(useChatStore.getState().consumeDraftProcessingRequest("other")).toBeNull()
    expect(useChatStore.getState().consumeDraftProcessingRequest("req-1")).toMatchObject({
      id: "req-1",
      conversationId: "conv-1",
      prompt: "prompt",
    })
    expect(useChatStore.getState().consumeDraftProcessingRequest("req-1")).toBeNull()
  })

  it("normalizes legacy conversations without metadata as normal", () => {
    const normalized = normalizeConversation({
      id: "legacy",
      title: "Legacy",
      createdAt: 1,
      updatedAt: 2,
    })

    expect(normalized.kind).toBe("normal")
    expect(normalized.draftContext).toBeUndefined()
  })
})
