import { compareDraftText, type DraftCompareResult } from "@/lib/draft-versioning"

export type DraftDiffGuardIntent = "local-edit" | "general-edit"
export type DraftDiffGuardSeverity = "none" | "warning"

export interface DraftDiffGuardResult {
  intent: DraftDiffGuardIntent
  severity: DraftDiffGuardSeverity
  shouldWarn: boolean
  reasons: string[]
  comparison: DraftCompareResult
}

interface EvaluateDraftDiffGuardInput {
  parentContent: string
  candidateContent: string
  instruction: string
  maxLines?: number
}

const LOCAL_EDIT_PATTERNS = [
  /只(?:改|修改|调整|润色|优化|重写|处理)/,
  /仅(?:改|修改|调整|润色|优化|重写|处理)/,
  /只要(?:改|修改|调整|润色|优化|重写|处理)/,
  /局部(?:修改|调整|润色|优化|重写|处理)/,
  /正文(?:不要|别|不应|不能)(?:动|改|修改|删|删除|缩短)/,
  /其他(?:部分|内容)?(?:不要|别|不应|不能)(?:动|改|修改|删|删除)/,
  /(?:不要|别|不应|不能)(?:动|改|修改|删|删除|缩短)(?:正文|其他|其余|原文|主体)/,
  /(?:不要|别|不应|不能)缩短/,
  /保留(?:原|现有|当前)?(?:结构|正文|内容|段落|事实|长度)/,
  /保持(?:原|现有|当前)?(?:结构|正文|内容|段落|事实|长度)(?:不变|稳定)?/,
  /\b(?:only|just)\b/i,
  /\b(?:do not|don't|dont)\s+(?:change|modify|rewrite|delete|shorten)\b/i,
  /\b(?:keep|preserve)\s+(?:the\s+)?(?:body|content|structure|length)\b/i,
]

export function detectDraftEditIntent(instruction: string): DraftDiffGuardIntent {
  const normalized = instruction.trim()
  if (!normalized) return "general-edit"
  return LOCAL_EDIT_PATTERNS.some((pattern) => pattern.test(normalized))
    ? "local-edit"
    : "general-edit"
}

function percent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

export function evaluateDraftDiffGuard(input: EvaluateDraftDiffGuardInput): DraftDiffGuardResult {
  const intent = detectDraftEditIntent(input.instruction)
  const comparison = compareDraftText(input.candidateContent, input.parentContent, { maxLines: input.maxLines })
  const reasons: string[] = []

  if (intent === "local-edit") {
    if (comparison.tooLarge) {
      reasons.push("内容较长，已跳过详细对比，需要人工确认是否符合局部修改要求。")
    } else {
      if (comparison.changedRatio >= 0.35) {
        reasons.push(`变化比例达到 ${percent(comparison.changedRatio)}%，可能超出局部修改范围。`)
      }
      if (comparison.removedLines >= 5 && comparison.removedLines > comparison.addedLines * 2) {
        reasons.push("删除行明显多于新增行，可能误删了非目标内容。")
      }
      if (
        comparison.totalVersionLines >= 8 &&
        comparison.totalCurrentLines < comparison.totalVersionLines * 0.7
      ) {
        reasons.push("结果行数明显少于原底稿，可能被过度缩短。")
      }
    }
  }

  const shouldWarn = reasons.length > 0
  return {
    intent,
    severity: shouldWarn ? "warning" : "none",
    shouldWarn,
    reasons,
    comparison,
  }
}
