import type {
  DraftProcessingAssistantMessage,
  DraftProcessingContext,
  DraftProcessingFormatProfileSnapshot,
  MessageReference,
} from "@/lib/format-profile-types"
import type { DraftDerivationMeta, DraftRecord } from "@/lib/draft-types"
import { buildFormatProfileSnapshot } from "@/lib/format-profile"
import type { FormatProfileRecord } from "@/lib/format-profile-types"

function formatReferences(references: MessageReference[]): string {
  if (references.length === 0) return "无引用资料。"
  return references.map((ref, index) => `${index + 1}. ${ref.title} (${ref.path})`).join("\n")
}

function formatProfilePromptBlock(profile?: DraftProcessingFormatProfileSnapshot): string | null {
  if (!profile) return null
  return profile.formatSpec?.promptBlock ?? null
}

export function buildDraftFormatProfileSnapshot(profile: FormatProfileRecord): DraftProcessingFormatProfileSnapshot {
  return buildFormatProfileSnapshot(profile)
}

export function buildDraftProcessingPrompt(
  draft: DraftRecord,
  instruction: string,
  _profileSnapshot?: DraftProcessingFormatProfileSnapshot,
): string {
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
  const profileBlock = formatProfilePromptBlock(context.formatProfileSnapshot)
  return [
    "你是底稿加工助手，只能围绕当前底稿、用户修改要求、底稿已有引用和显式选择的格式画像进行修订。",
    "",
    "## 底稿输出契约",
    "- 当前任务的产物是可保存为新底稿的文档正文，不是聊天回答。",
    "- 只输出完整修订稿正文；不要输出确认、寒暄、解释、修改说明、分析过程、前言或结语。",
    "- 输出必须从文档标题或正文第一段开始；不要在正文前添加“好的”“以下为”“这是根据您的要求”等聊天式前缀。",
    "- 如果用户要求“不修改正文”，应理解为不改事实、引用和语义；仍可执行标题层级、编号、列表、段落、表格等纯格式调整。",
    "",
    "## 结构角色约束",
    "- Markdown 只是底稿存储表达；必须先判断 document-title、section-title、subsection-title、paragraph、ordered-list、unordered-list、table 等结构角色，再选择对应标记。",
    "- 全文主标题不得被降级为普通章节或小标题；同一层级标题应保持同一种编号和标记体系。",
    "- 列表、表格和段落的表现形式可以按格式约束调整，但不得新增事实、删除引用或改变原有语义。",
    "",
    "## 工作规则",
    "- 必须使用中文回复。",
    "- 不要把当前底稿加工上下文扩散到普通 Chat。",
    "- 不要声称已经覆盖、保存或替换原底稿；系统只会在用户确认后另存为新底稿。",
    "- 不要主动引入未提供的 wiki 页面或外部资料。",
    "- 输出完整修订稿，便于用户直接保存为新底稿。",
    ...(profileBlock ? [
      "- 本会话携带 FormatSpec 格式约束；该约束只作用于本次底稿加工会话，不代表普通 Chat 默认受格式画像影响。",
      "- 当 FormatSpec 存在时，必须把它当作本次修订的有效格式合同，主动应用到标题层级、编号体系、列表样式、段落组织和表格呈现。",
      "- 如果用户要求不修改正文，应理解为不改事实、引用和语义；仍应执行 FormatSpec 允许的纯格式调整。",
      "- 如果 FormatSpec 或用户编辑约束包含多个格式动作，必须逐项检查并尽量全部执行；标题、列表、编号三类规则不得只执行其中一部分。",
      "- 用户显式修改要求和来源事实优先于格式约束；格式约束不得引入新事实。",
      "",
      profileBlock,
    ] : []),
    "",
    `## 来源底稿\n${context.draftTitle}`,
    `父底稿内容哈希：${context.parentContentHash}`,
    `修改要求：${context.instruction}`,
  ].join("\n")
}

export function buildDraftDerivation(
  context: DraftProcessingContext,
  assistantMessage: DraftProcessingAssistantMessage,
): DraftDerivationMeta {
  const derivation: DraftDerivationMeta = {
    parentDraftId: context.draftId,
    parentDraftTitle: context.draftTitle,
    parentContentHash: context.parentContentHash,
    instruction: context.instruction,
    processingConversationId: assistantMessage.conversationId,
  }
  if (context.formatProfileSnapshot) {
    derivation.formatProfileId = context.formatProfileSnapshot.id
    derivation.formatProfileTitle = context.formatProfileSnapshot.title
  }
  return derivation
}
