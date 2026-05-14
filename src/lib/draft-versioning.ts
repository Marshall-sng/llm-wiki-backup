import type { MessageReference } from "@/lib/format-profile-types"

export type DraftVersionReason = "manual-snapshot" | "restore" | "ai-processing"

export interface DraftVersion {
  id: string
  title: string
  content: string
  references: MessageReference[]
  contentHash: string
  createdAt: number
  reason: DraftVersionReason
  parentDraftId?: string
  parentVersionId?: string
  note?: string
}

export interface DraftCompareResult {
  addedLines: number
  removedLines: number
  unchangedLines: number
  totalCurrentLines: number
  totalVersionLines: number
  changedRatio: number
  tooLarge: boolean
}

export interface BuildDraftVersionInput {
  draftId: string
  title: string
  content: string
  references: MessageReference[]
  contentHash: string
  reason: DraftVersionReason
  parentVersionId?: string
  note?: string
}

const DEFAULT_MAX_COMPARE_LINES = 2000

function nextVersionId(): string {
  return `draft_version_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function splitLines(text: string): string[] {
  if (text.length === 0) return []
  return text.split(/\r?\n/)
}

export function cloneReferences(references: MessageReference[]): MessageReference[] {
  return references.map((reference) => ({
    title: reference.title,
    path: reference.path,
  }))
}

export function buildDraftVersion(input: BuildDraftVersionInput): DraftVersion {
  return {
    id: nextVersionId(),
    title: input.title,
    content: input.content,
    references: cloneReferences(input.references),
    contentHash: input.contentHash,
    createdAt: Date.now(),
    reason: input.reason,
    parentDraftId: input.draftId,
    parentVersionId: input.parentVersionId,
    note: input.note,
  }
}

function countLcs(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const previous = new Array(b.length + 1).fill(0)
  const current = new Array(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1] + 1
        : Math.max(previous[j], current[j - 1])
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j]
      current[j] = 0
    }
  }

  return previous[b.length]
}

export function compareDraftText(
  current: string,
  version: string,
  options?: { maxLines?: number },
): DraftCompareResult {
  const currentLines = splitLines(current)
  const versionLines = splitLines(version)
  const totalCurrentLines = currentLines.length
  const totalVersionLines = versionLines.length
  const maxLines = options?.maxLines ?? DEFAULT_MAX_COMPARE_LINES

  if (totalCurrentLines + totalVersionLines > maxLines) {
    return {
      addedLines: 0,
      removedLines: 0,
      unchangedLines: 0,
      totalCurrentLines,
      totalVersionLines,
      changedRatio: 0,
      tooLarge: true,
    }
  }

  const unchangedLines = countLcs(currentLines, versionLines)
  const addedLines = totalCurrentLines - unchangedLines
  const removedLines = totalVersionLines - unchangedLines
  const changedRatio = (addedLines + removedLines) / Math.max(totalCurrentLines, totalVersionLines, 1)

  return {
    addedLines,
    removedLines,
    unchangedLines,
    totalCurrentLines,
    totalVersionLines,
    changedRatio,
    tooLarge: false,
  }
}
