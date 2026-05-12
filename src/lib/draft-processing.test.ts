import { describe, expect, it } from "vitest"
import { buildDraftDerivation, buildDraftProcessingPrompt, buildDraftProcessingSystemPrompt } from "./draft-processing"
import type { DraftProcessingContext, DisplayMessage } from "@/stores/chat-store"
import type { DraftRecord } from "@/stores/draft-store"

const draft: DraftRecord = {
  id: "draft-1",
  title: "项目风险底稿",
  content: "## 风险提醒\n旧内容",
  references: [{ title: "风险资料", path: "wiki/risk.md" }],
  source: {
    kind: "chat-assistant",
    conversationId: "conv-parent",
    messageId: "msg-parent",
    messageTimestamp: 1,
    contentHash: "hash-parent",
  },
  createdAt: 1,
  updatedAt: 1,
}

const context: DraftProcessingContext = {
  draftId: draft.id,
  draftTitle: draft.title,
  parentContentHash: draft.source.contentHash,
  instruction: "只改风险提醒部分，正文不要缩短",
  references: draft.references,
  startedAt: 2,
}

describe("draft-processing prompt helpers", () => {
  it("builds a Chinese prompt with instruction, draft, references, safeguards, and full-output requirement", () => {
    const prompt = buildDraftProcessingPrompt(draft, context.instruction)

    expect(prompt).toContain("修改要求")
    expect(prompt).toContain(context.instruction)
    expect(prompt).toContain(draft.title)
    expect(prompt).toContain(draft.content)
    expect(prompt).toContain("风险资料")
    expect(prompt).toContain("不要自动覆盖原底稿")
    expect(prompt).toContain("输出完整修订稿")
  })

  it("still builds a valid prompt when references are empty", () => {
    const prompt = buildDraftProcessingPrompt({ ...draft, references: [] }, "改成正式口吻")

    expect(prompt).toContain("无引用资料")
    expect(prompt).toContain("改成正式口吻")
    expect(prompt).toContain("输出完整修订稿")
  })

  it("builds a Chinese system prompt scoped to draft processing", () => {
    const systemPrompt = buildDraftProcessingSystemPrompt(context)

    expect(systemPrompt).toContain("底稿加工助手")
    expect(systemPrompt).toContain("必须使用中文")
    expect(systemPrompt).toContain("不要主动引入未提供的 wiki 页面")
    expect(systemPrompt).toContain(context.parentContentHash)
  })

  it("builds derivation metadata from processing context and assistant message", () => {
    const message: DisplayMessage = {
      id: "msg-child",
      role: "assistant",
      content: "新底稿",
      timestamp: 3,
      conversationId: "conv-processing",
    }

    expect(buildDraftDerivation(context, message)).toEqual({
      parentDraftId: "draft-1",
      parentDraftTitle: "项目风险底稿",
      parentContentHash: "hash-parent",
      instruction: context.instruction,
      processingConversationId: "conv-processing",
    })
  })
})
