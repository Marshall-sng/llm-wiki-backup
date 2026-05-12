import type {
  DisplayMessage,
  DraftProcessingContext,
  DraftProcessingTemplateSnapshot,
  MessageReference,
} from "@/stores/chat-store"
import type { DraftDerivationMeta, DraftRecord } from "@/stores/draft-store"
import type { TemplateRecord } from "@/stores/template-store"

function formatReferences(references: MessageReference[]): string {
  if (references.length === 0) return "无引用资料。"
  return references.map((ref, index) => `${index + 1}. ${ref.title} (${ref.path})`).join("\n")
}

function formatLineList(lines: string[]): string {
  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "未设置。"
}

function formatTemplateSnapshot(template?: DraftProcessingTemplateSnapshot): string | null {
  if (!template) return null
  return [
    `## 当前模板约束\n${template.title}`,
    template.description ? `\n### 模板说明\n${template.description}` : "",
    template.intent ? `\n### 写作目标\n${template.intent}` : "",
    `\n### 必备章节\n${formatLineList(template.requiredSections)}`,
    `\n### 章节顺序\n${formatLineList(template.sectionOrder)}`,
    template.tone ? `\n### 语气要求\n${template.tone}` : "",
    template.lengthLimit ? `\n### 长度要求\n${template.lengthLimit}` : "",
    template.citationPolicy ? `\n### 引用规则\n${template.citationPolicy}` : "",
  ].filter(Boolean).join("\n")
}

export function buildDraftTemplateSnapshot(template: TemplateRecord): DraftProcessingTemplateSnapshot {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    intent: template.intent,
    requiredSections: [...template.requiredSections],
    sectionOrder: [...template.sectionOrder],
    tone: template.tone,
    lengthLimit: template.lengthLimit,
    citationPolicy: template.citationPolicy,
    capturedAt: Date.now(),
  }
}

export function buildDraftProcessingPrompt(
  draft: DraftRecord,
  instruction: string,
  templateSnapshot?: DraftProcessingTemplateSnapshot,
): string {
  const trimmedInstruction = instruction.trim()
  const templateBlock = formatTemplateSnapshot(templateSnapshot)
  return [
    "请根据以下底稿和修改要求，输出一份完整修订稿。",
    "",
    "## 保护约束",
    "- 不要自动覆盖原底稿。",
    "- 除非修改要求明确要求，否则不要删除原底稿中的关键信息。",
    "- 如果只要求修改局部内容，请尽量保持其他部分的结构、事实和长度稳定。",
    "- 输出完整修订稿，不要只输出修改说明。",
    ...(templateBlock ? [
      "- 本次加工已显式选择模板；请在不破坏底稿事实和引用的前提下，尽量遵循模板结构与约束。",
      "",
      templateBlock,
    ] : []),
    "",
    `## 来源底稿标题\n${draft.title}`,
    "",
    `## 修改要求\n${trimmedInstruction}`,
    "",
    `## 引用资料\n${formatReferences(draft.references)}`,
    "",
    `## 原底稿内容\n${draft.content}`,
  ].join("\n")
}

export function buildDraftProcessingSystemPrompt(context: DraftProcessingContext): string {
  const templateBlock = formatTemplateSnapshot(context.templateSnapshot)
  return [
    "你是底稿加工助手，只能围绕当前底稿、用户修改要求和底稿已有引用进行修订。",
    "",
    "## 工作规则",
    "- 必须使用中文回复。",
    "- 不要把当前底稿加工上下文扩散到普通 Chat。",
    "- 不要声称已经覆盖、保存或替换原底稿；系统只会在用户确认后另存为新底稿。",
    "- 不要主动引入未提供的 wiki 页面或外部资料。",
    "- 输出完整修订稿，便于用户直接保存为新底稿。",
    ...(templateBlock ? [
      "- 本会话携带模板快照；模板只约束本次底稿加工会话，不代表普通 Chat 默认受模板影响。",
      "",
      templateBlock,
    ] : []),
    "",
    `## 来源底稿\n${context.draftTitle}`,
    `父底稿内容哈希：${context.parentContentHash}`,
    `修改要求：${context.instruction}`,
  ].join("\n")
}

export function buildDraftDerivation(
  context: DraftProcessingContext,
  assistantMessage: DisplayMessage,
): DraftDerivationMeta {
  const derivation: DraftDerivationMeta = {
    parentDraftId: context.draftId,
    parentDraftTitle: context.draftTitle,
    parentContentHash: context.parentContentHash,
    instruction: context.instruction,
    processingConversationId: assistantMessage.conversationId,
  }
  if (context.templateSnapshot) {
    derivation.templateId = context.templateSnapshot.id
    derivation.templateTitle = context.templateSnapshot.title
  }
  return derivation
}
