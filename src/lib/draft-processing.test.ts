import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildDraftDerivation,
  buildDraftProcessingPrompt,
  buildDraftProcessingSystemPrompt,
  buildDraftFormatProfileSnapshot,
} from "./draft-processing"
import type { DraftProcessingContext } from "@/lib/format-profile-types"
import type { DisplayMessage } from "@/stores/chat-store"
import type { DraftRecord } from "@/lib/draft-types"
import { buildFormatProfileFromExtractedText, buildFormatProfileSnapshot } from "@/lib/format-profile"
import type { FormatProfileRecord } from "@/lib/format-profile-types"

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

const profile: FormatProfileRecord = {
  id: "profile-1",
  title: "正式汇报画像",
  sourceName: "report.docx",
  sourcePath: "/project/report.docx",
  fileType: "docx",
  sourceKind: "finished-file",
  documentKind: "formal-document",
  confidence: "high",
  importedAt: 1,
  updatedAt: 2,
  structureProfile: {
    sectionPattern: "numbered-sections",
    sections: [{ title: "风险提醒", evidence: "numbered-line" }],
    evidenceSummary: ["识别到 1 个结构线索。"],
  },
  styleProfile: { toneHints: ["正式"], layoutHints: ["DOCX"] },
  writingProfile: {
    generationInstruction: "## 格式画像约束\n画像：正式汇报画像\n### 写作约束\n- 按正式文稿组织底稿。",
    constraints: ["按正式文稿组织底稿。"],
  },
  diagnostics: [{ id: "docx", severity: "info", message: "DOCX 可作为正式文稿画像。" }],
  textSample: "样例文本",
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
  it("builds a Chinese user prompt with instruction, draft, references, safeguards, and no profile block", () => {
    const snapshot = buildDraftFormatProfileSnapshot(profile)
    const prompt = buildDraftProcessingPrompt(draft, context.instruction, snapshot)

    expect(prompt).toContain("修改要求")
    expect(prompt).toContain(context.instruction)
    expect(prompt).toContain(draft.title)
    expect(prompt).toContain(draft.content)
    expect(prompt).toContain("风险资料")
    expect(prompt).toContain("不要自动覆盖原底稿")
    expect(prompt).toContain("输出完整修订稿")
    expect(prompt).not.toContain("当前格式画像")
    expect(prompt).not.toContain("当前模板约束")
    expect(prompt).not.toContain("格式约束（FormatSpec）")
    expect(prompt).not.toContain("画像生成约束")
    expect(prompt).not.toContain("StyleFacts")
  })

  it("still builds a valid prompt when references are empty", () => {
    const prompt = buildDraftProcessingPrompt({ ...draft, references: [] }, "改成正式口吻")

    expect(prompt).toContain("无引用资料")
    expect(prompt).toContain("改成正式口吻")
    expect(prompt).toContain("输出完整修订稿")
  })

  it("materializes a FormatSpec snapshot while keeping legacy instruction compatibility", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const snapshot = buildDraftFormatProfileSnapshot(profile)

    expect(snapshot).toMatchObject({
      id: profile.id,
      title: profile.title,
      fileType: profile.fileType,
      confidence: profile.confidence,
      capturedAt: 1_700_000_000_000,
      formatSpec: {
        schemaVersion: "format-spec.v0",
        rendererVersion: "format-spec-renderer.v0",
        policyVersion: "evidence-only-no-source-text.v0",
      },
    })
    expect(snapshot.sourceProfileHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.formatSpecHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.profileSnapshotHash).toContain("legacy")
    expect(snapshot.legacyGenerationInstruction).toContain("格式画像约束")
    expect(snapshot.generationInstruction).toBe(snapshot.legacyGenerationInstruction)
    expect(snapshot.diagnostics).not.toBe(profile.diagnostics)
  })

  it("adds FormatSpec to the system prompt exactly once for profile-processing conversations", () => {
    const snapshot = buildDraftFormatProfileSnapshot(profile)
    const systemPrompt = buildDraftProcessingSystemPrompt({ ...context, formatProfileSnapshot: snapshot })

    expect(systemPrompt).toContain("FormatSpec 格式约束")
    expect(systemPrompt).toContain("底稿输出契约")
    expect(systemPrompt).toContain("可保存为新底稿的文档正文，不是聊天回答")
    expect(systemPrompt).toContain("结构角色约束")
    expect(systemPrompt).toContain("document-title")
    expect(systemPrompt).toContain("全文主标题不得被降级")
    expect(systemPrompt).toContain("有效格式合同")
    expect(systemPrompt).toContain("仍应执行 FormatSpec 允许的纯格式调整")
    expect(systemPrompt).toContain("必须逐项检查并尽量全部执行")
    expect(systemPrompt).toContain("格式约束（FormatSpec）")
    expect(systemPrompt).toContain("普通 Chat 默认受格式画像影响")
    expect(systemPrompt).not.toContain("格式画像快照")
    expect(systemPrompt).not.toContain("画像生成约束")
    expect(systemPrompt).not.toContain("按正式文稿组织底稿。")
    expect(systemPrompt.match(/格式约束（FormatSpec）/g)).toHaveLength(1)
  })

  it("carries visible user-edited constraints into the active system prompt", () => {
    const snapshot = buildDraftFormatProfileSnapshot(profile)
    const editedMarker = "显性影响力测试：所有二级标题必须改为“第X部分 标题”，所有项目符号列表必须改为数字列表。"
    const checklistMarker = "- [ ] 所有项目符号列表必须改为数字列表“1. 2. 3.”。"
    const editedSnapshot = {
      ...snapshot,
      formatSpec: {
        ...snapshot.formatSpec,
        promptBlock: `${snapshot.formatSpec.promptBlock}\n\n### 用户编辑约束\n- ${editedMarker}\n${checklistMarker}`,
      },
    }
    const systemPrompt = buildDraftProcessingSystemPrompt({ ...context, formatProfileSnapshot: editedSnapshot })

    expect(systemPrompt).toContain(editedMarker)
    expect(systemPrompt).toContain(checklistMarker)
    expect(systemPrompt).toContain("主动应用到标题层级、编号体系、列表样式")
    expect(systemPrompt).toContain("标题、列表、编号三类规则不得只执行其中一部分")
  })

  it("adds bounded StyleFacts metadata to snapshots without leaking probe samples into prompts", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const styleProfile = buildFormatProfileFromExtractedText({
      sourcePath: "/project/style.docx",
      now: 10,
      extractedText: "第一章 总则".repeat(30),
      probe: {
        kind: "office_zip",
        officeKind: "docx",
        structure: { paragraphs: 1, runs: 1, tables: 0, paragraphSamples: [{ text: "不要进入提示", index: 1 }] },
        style: { styleCount: 1, fonts: ["FangSong"], fontUsage: [{ value: "FangSong", count: 1 }], fontSizeUsageHalfPoints: [{ value: "21", count: 1 }], page: { widthTwips: "11905", heightTwips: "16834" } },
      },
    })
    const draftSnapshot = buildDraftFormatProfileSnapshot(styleProfile)
    const generalSnapshot = buildFormatProfileSnapshot(styleProfile)
    const userPrompt = buildDraftProcessingPrompt(draft, context.instruction, draftSnapshot)
    const systemPrompt = buildDraftProcessingSystemPrompt({ ...context, formatProfileSnapshot: draftSnapshot })

    expect(draftSnapshot.styleFactsSha256).toBe(styleProfile.styleFacts?.metadata.styleFactsSha256)
    expect(generalSnapshot.styleFactsSha256).toBe(draftSnapshot.styleFactsSha256)
    expect(draftSnapshot.styleFactsSchemaVersion).toBe("format-profile-style-facts.v0")
    expect(draftSnapshot.dataScope).toBe("evidence-only")
    expect(draftSnapshot.semanticStatus).toBe("not-configured")
    expect(draftSnapshot.styleFactsSummary?.join("\n")).toContain("FangSong")
    expect(systemPrompt).toContain("格式约束（FormatSpec）")
    expect(systemPrompt).not.toContain("不要进入提示")
    expect(systemPrompt).not.toContain("styleFacts\":")
    expect(userPrompt).not.toContain("FangSong")
    expect(userPrompt).not.toContain("StyleFacts")
  })

  it("builds a Chinese system prompt scoped to draft processing", () => {
    const systemPrompt = buildDraftProcessingSystemPrompt(context)

    expect(systemPrompt).toContain("底稿加工助手")
    expect(systemPrompt).toContain("底稿输出契约")
    expect(systemPrompt).toContain("只输出完整修订稿正文")
    expect(systemPrompt).toContain("不要输出确认、寒暄、解释、修改说明")
    expect(systemPrompt).toContain("Markdown 只是底稿存储表达")
    expect(systemPrompt).toContain("如果用户要求“不修改正文”，应理解为不改事实、引用和语义")
    expect(systemPrompt).toContain("必须使用中文")
    expect(systemPrompt).toContain("不要主动引入未提供的 wiki 页面")
    expect(systemPrompt).toContain(context.parentContentHash)
    expect(systemPrompt).not.toContain("格式画像快照")
    expect(systemPrompt).not.toContain("格式约束（FormatSpec）")
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

  it("records format profile identity in derivation metadata when present", () => {
    const message: DisplayMessage = {
      id: "msg-child",
      role: "assistant",
      content: "新底稿",
      timestamp: 3,
      conversationId: "conv-processing",
    }
    const snapshot = buildDraftFormatProfileSnapshot(profile)

    expect(buildDraftDerivation({ ...context, formatProfileSnapshot: snapshot }, message)).toMatchObject({
      formatProfileId: profile.id,
      formatProfileTitle: profile.title,
    })
  })
})
