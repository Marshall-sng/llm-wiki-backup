import type { DraftRecord } from "@/lib/draft-types"
import type { DraftProcessingFormatProfileSnapshot, FormatSpecRule } from "@/lib/format-profile-types"
import { sha256Stable } from "@/lib/style-facts"

export const DOCX_INTERMEDIATE_SCHEMA_VERSION = "docx-intermediate-document.v0" as const

export type DocxIntermediateBlockType = "documentTitle" | "heading" | "paragraph" | "list" | "table"

export interface DocxSourceLineRange {
  start: number
  end: number
}

export interface DocxIntermediateBaseBlock {
  type: DocxIntermediateBlockType
  ruleRefs: string[]
  sourceLineRange: DocxSourceLineRange
  diagnostics?: string[]
}

export interface DocxDocumentTitleBlock extends DocxIntermediateBaseBlock {
  type: "documentTitle"
  text: string
}

export interface DocxHeadingBlock extends DocxIntermediateBaseBlock {
  type: "heading"
  level: number
  text: string
}

export interface DocxParagraphBlock extends DocxIntermediateBaseBlock {
  type: "paragraph"
  text: string
}

export interface DocxListBlock extends DocxIntermediateBaseBlock {
  type: "list"
  ordered: boolean
  items: string[]
}

export interface DocxTableBlock extends DocxIntermediateBaseBlock {
  type: "table"
  columns: string[]
  rows: string[][]
}

export type DocxIntermediateBlock =
  | DocxDocumentTitleBlock
  | DocxHeadingBlock
  | DocxParagraphBlock
  | DocxListBlock
  | DocxTableBlock

export interface DocxIntermediateDiagnostic {
  severity: "info" | "warning" | "error"
  message: string
  sourceLine?: number
}

export interface DocxIntermediateDocument {
  schemaVersion: typeof DOCX_INTERMEDIATE_SCHEMA_VERSION
  sourceDraftId: string
  sourceDraftContentHash: string
  blocks: DocxIntermediateBlock[]
  diagnostics: DocxIntermediateDiagnostic[]
  intermediateHash: string
}

export interface BuildDocxIntermediateDocumentInput {
  draft: DraftRecord
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
}

type RuleTarget = "documentTitle" | "heading1" | "heading2" | "paragraph" | "orderedList" | "unorderedList" | "table"

function normalizeTarget(value: string): string {
  return value.toLowerCase().replace(/[_\s]/g, "-")
}

function ruleMatches(rule: FormatSpecRule, target: RuleTarget): boolean {
  const candidates = [
    normalizeTarget(rule.target),
    normalizeTarget(rule.id),
    ...(rule.normType ? [normalizeTarget(rule.normType)] : []),
  ]
  const has = (...values: string[]) => candidates.some((candidate) => values.some((value) => (
    candidate === value || candidate.startsWith(`${value}-`) || candidate.endsWith(`-${value}`)
  )))

  if (target === "documentTitle") {
    return candidates.some((candidate) => (
      candidate === "title" ||
      candidate === "docx-title" ||
      candidate === "document-title" ||
      candidate === "main-title" ||
      candidate.endsWith("-document-title") ||
      candidate.endsWith("-main-title")
    ))
  }
  if (target === "heading1") return has("section-title", "heading-1", "level-1-heading", "heading")
  if (target === "heading2") return has("subsection-title", "heading-2", "level-2-heading", "heading")
  if (target === "paragraph") return has("paragraph", "body-text", "body")
  if (target === "orderedList") return has("ordered-list", "numbered-list", "numbering")
  if (target === "unorderedList") return has("unordered-list", "bullet-list", "bulleted-list", "bullet")
  if (target === "table") return has("table")
  return false
}

function ruleRefs(snapshot: DraftProcessingFormatProfileSnapshot | undefined, target: RuleTarget): string[] {
  return (snapshot?.formatSpec.rules ?? [])
    .filter((rule) => ruleMatches(rule, target))
    .map((rule) => rule.id)
}

function splitTableLine(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
}

function isTableSeparator(line: string | undefined): boolean {
  return Boolean(line && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
}

function parseMarkdownTable(lines: string[], start: number): { block: Omit<DocxTableBlock, "ruleRefs" | "sourceLineRange">; next: number } | null {
  if (!lines[start]?.includes("|") || !isTableSeparator(lines[start + 1])) return null
  const columns = splitTableLine(lines[start])
  const rows: string[][] = []
  let index = start + 2
  while (index < lines.length && lines[index].trim().includes("|")) {
    rows.push(splitTableLine(lines[index]))
    index += 1
  }
  return { block: { type: "table", columns, rows }, next: index }
}

export function buildDocxIntermediateDocument(input: BuildDocxIntermediateDocumentInput): DocxIntermediateDocument {
  const { draft, formatProfileSnapshot } = input
  const lines = draft.content.split(/\r?\n/)
  const blocks: DocxIntermediateBlock[] = []
  const diagnostics: DocxIntermediateDiagnostic[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.trim()
    const lineNumber = index + 1
    if (!line) {
      index += 1
      continue
    }

    const table = parseMarkdownTable(lines, index)
    if (table) {
      blocks.push({
        ...table.block,
        ruleRefs: ruleRefs(formatProfileSnapshot, "table"),
        sourceLineRange: { start: lineNumber, end: table.next },
      })
      index = table.next
      continue
    }

    const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/)
    if (markdownHeading) {
      const level = markdownHeading[1].length
      const text = markdownHeading[2].trim()
      if (level === 1 && !blocks.some((block) => block.type === "documentTitle")) {
        blocks.push({ type: "documentTitle", text, ruleRefs: ruleRefs(formatProfileSnapshot, "documentTitle"), sourceLineRange: { start: lineNumber, end: lineNumber } })
      } else {
        blocks.push({ type: "heading", level, text, ruleRefs: ruleRefs(formatProfileSnapshot, level <= 2 ? "heading1" : "heading2"), sourceLineRange: { start: lineNumber, end: lineNumber } })
      }
      index += 1
      continue
    }

    if (/^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+\u3001/.test(line)) {
      blocks.push({ type: "heading", level: 1, text: line, ruleRefs: ruleRefs(formatProfileSnapshot, "heading1"), sourceLineRange: { start: lineNumber, end: lineNumber } })
      index += 1
      continue
    }

    if (/^\uff08[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+\uff09/.test(line)) {
      blocks.push({ type: "heading", level: 2, text: line, ruleRefs: ruleRefs(formatProfileSnapshot, "heading2"), sourceLineRange: { start: lineNumber, end: lineNumber } })
      index += 1
      continue
    }

    const orderedItems: string[] = []
    let cursor = index
    while (cursor < lines.length) {
      const match = lines[cursor].trim().match(/^\d+[\.\u3001]\s*(.+)$/)
      if (!match) break
      orderedItems.push(match[1])
      cursor += 1
    }
    if (orderedItems.length > 0) {
      blocks.push({ type: "list", ordered: true, items: orderedItems, ruleRefs: ruleRefs(formatProfileSnapshot, "orderedList"), sourceLineRange: { start: lineNumber, end: cursor } })
      index = cursor
      continue
    }

    const bulletItems: string[] = []
    cursor = index
    while (cursor < lines.length) {
      const match = lines[cursor].trim().match(/^[-*]\s+(.+)$/)
      if (!match) break
      bulletItems.push(match[1])
      cursor += 1
    }
    if (bulletItems.length > 0) {
      blocks.push({ type: "list", ordered: false, items: bulletItems, ruleRefs: ruleRefs(formatProfileSnapshot, "unorderedList"), sourceLineRange: { start: lineNumber, end: cursor } })
      index = cursor
      continue
    }

    blocks.push({ type: "paragraph", text: line, ruleRefs: ruleRefs(formatProfileSnapshot, "paragraph"), sourceLineRange: { start: lineNumber, end: lineNumber } })
    index += 1
  }

  if (!blocks.some((block) => block.type === "documentTitle")) {
    diagnostics.push({ severity: "info", message: "No markdown H1 title found; using draft title as documentTitle." })
    blocks.unshift({ type: "documentTitle", text: draft.title, ruleRefs: ruleRefs(formatProfileSnapshot, "documentTitle"), sourceLineRange: { start: 0, end: 0 } })
  }

  const withoutHash = {
    schemaVersion: DOCX_INTERMEDIATE_SCHEMA_VERSION,
    sourceDraftId: draft.id,
    sourceDraftContentHash: draft.source.contentHash,
    blocks,
    diagnostics,
  }
  return {
    ...withoutHash,
    intermediateHash: sha256Stable(withoutHash),
  }
}
