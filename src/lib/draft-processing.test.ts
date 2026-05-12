import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildDraftDerivation,
  buildDraftProcessingPrompt,
  buildDraftProcessingSystemPrompt,
  buildDraftTemplateSnapshot,
} from "./draft-processing"
import type { DraftProcessingContext, DisplayMessage } from "@/stores/chat-store"
import type { DraftRecord } from "@/stores/draft-store"
import type { TemplateRecord } from "@/stores/template-store"

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
  versions: [],
  createdAt: 1,
  updatedAt: 1,
}

const template: TemplateRecord = {
  id: "template-1",
  title: "正式汇报模板",
  description: "用于正式材料",
  intent: "形成汇报稿",
  requiredSections: ["背景", "风险提醒", "结论"],
  sectionOrder: ["一、背景", "二、风险提醒", "三、结论"],
  tone: "正式、审慎",
  lengthLimit: "不少于 2000 字",
  citationPolicy: "保留引用标记",
  createdAt: 1,
  updatedAt: 2,
}

const context: DraftProcessingContext = {
  draftId: draft.id,
  draftTitle: draft.title,
  parentContentHash: draft.source.contentHash,
  instruction: "只改风险提醒部分，正文不要缩短",
  references: draft.references,
  startedAt: 2,
}

afterEach(() => {
  vi.useRealTimers()
})

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
    expect(prompt).not.toContain("当前模板约束")
  })

  it("still builds a valid prompt when references are empty", () => {
    const prompt = buildDraftProcessingPrompt({ ...draft, references: [] }, "改成正式口吻")

    expect(prompt).toContain("无引用资料")
    expect(prompt).toContain("改成正式口吻")
    expect(prompt).toContain("输出完整修订稿")
  })

  it("adds template constraints when a template snapshot is supplied", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const snapshot = buildDraftTemplateSnapshot(template)
    const prompt = buildDraftProcessingPrompt(draft, context.instruction, snapshot)

    expect(snapshot).toMatchObject({
      id: template.id,
      title: template.title,
      requiredSections: template.requiredSections,
      sectionOrder: template.sectionOrder,
      capturedAt: 1_700_000_000_000,
    })
    expect(snapshot.requiredSections).not.toBe(template.requiredSections)
    expect(prompt).toContain("当前模板约束")
    expect(prompt).toContain("正式汇报模板")
    expect(prompt).toContain("- 背景")
    expect(prompt).toContain("正式、审慎")
    expect(prompt).toContain("保留引用标记")
    expect(prompt).toContain("不要自动覆盖原底稿")
  })

  it("builds a Chinese system prompt scoped to draft processing", () => {
    const systemPrompt = buildDraftProcessingSystemPrompt(context)

    expect(systemPrompt).toContain("底稿加工助手")
    expect(systemPrompt).toContain("必须使用中文")
    expect(systemPrompt).toContain("不要主动引入未提供的 wiki 页面")
    expect(systemPrompt).toContain(context.parentContentHash)
    expect(systemPrompt).not.toContain("模板快照")
  })

  it("adds template scope to the system prompt only for template-processing conversations", () => {
    const snapshot = buildDraftTemplateSnapshot(template)
    const systemPrompt = buildDraftProcessingSystemPrompt({ ...context, templateSnapshot: snapshot })

    expect(systemPrompt).toContain("模板快照")
    expect(systemPrompt).toContain("普通 Chat 默认受模板影响")
    expect(systemPrompt).toContain(template.title)
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

  it("records template identity in derivation metadata when present", () => {
    const message: DisplayMessage = {
      id: "msg-child",
      role: "assistant",
      content: "新底稿",
      timestamp: 3,
      conversationId: "conv-processing",
    }
    const snapshot = buildDraftTemplateSnapshot(template)

    expect(buildDraftDerivation({ ...context, templateSnapshot: snapshot }, message)).toMatchObject({
      templateId: template.id,
      templateTitle: template.title,
    })
  })
})
