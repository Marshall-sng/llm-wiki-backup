import type { DisplayMessage, DraftProcessingContext, MessageReference } from "@/stores/chat-store"
import type { DraftDerivationMeta, DraftRecord } from "@/stores/draft-store"

function formatReferences(references: MessageReference[]): string {
  if (references.length === 0) return "无引用资料。"
  return references.map((ref, index) => `${index + 1}. ${ref.title} (${ref.path})`).join("\n")
}

export function buildDraftProcessingPrompt(draft: DraftRecord, instruction: string): string {
  const trimmedInstruction = instruction.trim()
  return [
    "请根据以下底稿和修改要求，输出一份完整修订稿。",
    "",
    "## 保护约束",
    "- 不要自动覆盖原底稿。",
    "- 除非修改要求明确要求，否则不要删除原底稿中的关键信息。",
    "- 如果只要求修改局部内容，请尽量保持其他部分的结构、事实和长度稳定。",
    "- 输出完整修订稿，不要只输出修改说明。",
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
  return [
    "你是底稿加工助手，只能围绕当前底稿、用户修改要求和底稿已有引用进行修订。",
    "",
    "## 工作规则",
    "- 必须使用中文回复。",
    "- 不要把当前底稿加工上下文扩散到普通 Chat。",
    "- 不要声称已经覆盖、保存或替换原底稿；系统只会在用户确认后另存为新底稿。",
    "- 不要主动引入未提供的 wiki 页面或外部资料。",
    "- 输出完整修订稿，便于用户直接保存为新底稿。",
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
  return {
    parentDraftId: context.draftId,
    parentDraftTitle: context.draftTitle,
    parentContentHash: context.parentContentHash,
    instruction: context.instruction,
    processingConversationId: assistantMessage.conversationId,
  }
}
