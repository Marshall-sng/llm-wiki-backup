import type { DraftRecord } from "@/lib/draft-types"
import type { DraftProcessingFormatProfileSnapshot, FormatSpecRule } from "@/lib/format-profile-types"
import { resolveDocxStylePolicy, type DocxFormatDimension, type DocxResolvedStylePolicy } from "@/lib/docx-format-style"
import { normalizeDocxBaselineDimension } from "@/lib/docx-formatspec-baseline"
import { sha256Stable } from "@/lib/style-facts"
import { normalizeWhitespaceHtmlEntities } from "@/lib/text-normalization"

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
  formatDimensions?: DocxFormatDimension[]
  diagnostics?: string[]
  roleSource?: "markdown-heading" | "plain-title" | "chinese-section" | "decimal-heading" | "markdown-list" | "visible-number-text" | "recovered-bare-list" | "paragraph" | "table"
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
  autoNumberingIntent?: "none" | "visible-number-text"
}

export interface DocxListBlock extends DocxIntermediateBaseBlock {
  type: "list"
  ordered: boolean
  items: string[]
  autoNumberingIntent?: "auto-list" | "recovered-bare-list"
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
  stylePolicy: DocxResolvedStylePolicy
  intermediateHash: string
}

export interface BuildDocxIntermediateDocumentInput {
  draft: DraftRecord
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
}

type RuleTarget = "documentTitle" | "heading1" | "heading2" | "heading3" | "paragraph" | "orderedList" | "unorderedList" | "table"

const TARGET_DIMENSION: Record<RuleTarget, DocxFormatDimension> = {
  documentTitle: "title.main",
  heading1: "heading.level1",
  heading2: "heading.level2",
  heading3: "heading.level3",
  paragraph: "paragraph.body",
  orderedList: "list.numbering",
  unorderedList: "list.numbering",
  table: "table.readability",
}

function normalizeTarget(value: string): string {
  return value.toLowerCase().replace(/[_\s]/g, "-")
}

function ruleMatches(rule: FormatSpecRule, target: RuleTarget): boolean {
  if (normalizeDocxBaselineDimension(rule) === TARGET_DIMENSION[target]) return true
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
  if (target === "heading3") return has("third-level-title", "heading-3", "level-3-heading")
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

function blockMeta(snapshot: DraftProcessingFormatProfileSnapshot | undefined, target: RuleTarget) {
  return {
    ruleRefs: ruleRefs(snapshot, target),
    formatDimensions: [TARGET_DIMENSION[target]],
  }
}

function normalizeLineForDocx(line: string): string {
  return normalizeWhitespaceHtmlEntities(line).replace(/^[\s\u00a0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000]+/u, "").trimEnd()
}

function splitTableLine(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
}

function isTableSeparator(line: string | undefined): boolean {
  return Boolean(line && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
}

function parseMarkdownTable(lines: string[], start: number): { block: Omit<DocxTableBlock, "ruleRefs" | "sourceLineRange">; next: number } | null {
  const first = normalizeLineForDocx(lines[start] ?? "")
  if (!first.includes("|") || !isTableSeparator(lines[start + 1])) return null
  const columns = splitTableLine(first)
  const rows: string[][] = []
  let index = start + 2
  while (index < lines.length && normalizeLineForDocx(lines[index]).includes("|")) {
    rows.push(splitTableLine(normalizeLineForDocx(lines[index])))
    index += 1
  }
  return { block: { type: "table", columns, rows }, next: index }
}

function isChineseLevel1Heading(line: string): boolean {
  return /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+\u3001/.test(line)
}

function isChineseLevel2Heading(line: string): boolean {
  return /^\uff08[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+\uff09/.test(line)
}

function isStructuralLine(line: string): boolean {
  return /^#{1,6}\s+/.test(line) ||
    isChineseLevel1Heading(line) ||
    isChineseLevel2Heading(line) ||
    /^\d+[\.\u3001]\s*(.+)$/.test(line) ||
    /^[-*]\s+/.test(line) ||
    line.includes("|")
}

function isPlainDocumentTitle(line: string, blocks: DocxIntermediateBlock[], lines: string[], index: number): boolean {
  if (blocks.length > 0) return false
  if (line.length > 80) return false
  if (isStructuralLine(line)) return false
  if (/[。；;：:]$/.test(line)) return false
  const next = lines[index + 1]
  return next === undefined || !normalizeLineForDocx(next)
}

function isLikelyLevel3Heading(line: string, lines: string[], index: number): boolean {
  const match = line.match(/^\d+[\.\u3001]\s*(.+)$/)
  if (!match) return false
  const text = match[1].trim()
  if (!text || text.length > 40 || /[。；;：:]$/.test(text)) return false
  let cursor = index + 1
  while (cursor < lines.length && !normalizeLineForDocx(lines[cursor])) cursor += 1
  const next = normalizeLineForDocx(lines[cursor] ?? "")
  return !/^\d+[\.\u3001]\s*(.+)$/.test(next)
}

function canRecoverBareList(snapshot: DraftProcessingFormatProfileSnapshot | undefined): boolean {
  return (snapshot?.formatSpec.rules ?? [])
    .filter((rule) => ruleMatches(rule, "orderedList"))
    .some((rule) => rule.source !== "standard-default" && !rule.id.startsWith("docx-baseline-"))
}

function hasExplicitListRule(snapshot: DraftProcessingFormatProfileSnapshot | undefined, target: "orderedList" | "unorderedList"): boolean {
  return (snapshot?.formatSpec.rules ?? [])
    .filter((rule) => ruleMatches(rule, target))
    .some((rule) => rule.source !== "standard-default" && !rule.id.startsWith("docx-baseline-"))
}

function isBareListCandidate(line: string): boolean {
  if (!line || isStructuralLine(line)) return false
  if (line.length > 80) return false
  if (/[。.]$/.test(line) && !/^.{1,24}[：:]/.test(line)) return false
  return true
}

function parseBareListRun(lines: string[], start: number): { items: string[]; next: number } | null {
  const items: string[] = []
  let cursor = start
  while (cursor < lines.length) {
    const line = normalizeLineForDocx(lines[cursor])
    if (!line) {
      cursor += 1
      if (items.length > 0) break
      continue
    }
    if (!isBareListCandidate(line)) break
    items.push(line)
    cursor += 1
  }
  return items.length >= 2 ? { items, next: cursor } : null
}

export function buildDocxIntermediateDocument(input: BuildDocxIntermediateDocumentInput): DocxIntermediateDocument {
  const { draft, formatProfileSnapshot } = input
  const lines = draft.content.split(/\r?\n/)
  const stylePolicy = resolveDocxStylePolicy(formatProfileSnapshot)
  const blocks: DocxIntermediateBlock[] = []
  const diagnostics: DocxIntermediateDiagnostic[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = normalizeLineForDocx(rawLine)
    const lineNumber = index + 1
    if (!line) {
      index += 1
      continue
    }

    const table = parseMarkdownTable(lines, index)
    if (table) {
      blocks.push({
        ...table.block,
        ...blockMeta(formatProfileSnapshot, "table"),
        sourceLineRange: { start: lineNumber, end: table.next },
      })
      index = table.next
      continue
    }

    const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/)
    if (markdownHeading) {
      const markdownLevel = markdownHeading[1].length
      const text = markdownHeading[2].trim()
      const structuralLevel = isChineseLevel1Heading(text) ? 1 : isChineseLevel2Heading(text) ? 2 : markdownLevel
      if (markdownLevel === 1 && structuralLevel === 1 && !isChineseLevel1Heading(text) && !blocks.some((block) => block.type === "documentTitle")) {
        blocks.push({ type: "documentTitle", text, ...blockMeta(formatProfileSnapshot, "documentTitle"), roleSource: "markdown-heading", sourceLineRange: { start: lineNumber, end: lineNumber } })
      } else {
        blocks.push({ type: "heading", level: structuralLevel, text, ...blockMeta(formatProfileSnapshot, structuralLevel <= 1 ? "heading1" : structuralLevel === 2 ? "heading2" : "heading3"), roleSource: "markdown-heading", sourceLineRange: { start: lineNumber, end: lineNumber } })
      }
      index += 1
      continue
    }

    if (isPlainDocumentTitle(line, blocks, lines, index)) {
      blocks.push({ type: "documentTitle", text: line, ...blockMeta(formatProfileSnapshot, "documentTitle"), roleSource: "plain-title", sourceLineRange: { start: lineNumber, end: lineNumber } })
      index += 1
      continue
    }

    if (isChineseLevel1Heading(line)) {
      blocks.push({ type: "heading", level: 1, text: line, ...blockMeta(formatProfileSnapshot, "heading1"), roleSource: "chinese-section", sourceLineRange: { start: lineNumber, end: lineNumber } })
      index += 1
      continue
    }

    if (isChineseLevel2Heading(line)) {
      blocks.push({ type: "heading", level: 2, text: line, ...blockMeta(formatProfileSnapshot, "heading2"), roleSource: "chinese-section", sourceLineRange: { start: lineNumber, end: lineNumber } })
      index += 1
      continue
    }

    if (isLikelyLevel3Heading(line, lines, index)) {
      blocks.push({ type: "heading", level: 3, text: line, ...blockMeta(formatProfileSnapshot, "heading3"), roleSource: "decimal-heading", sourceLineRange: { start: lineNumber, end: lineNumber } })
      index += 1
      continue
    }

    const orderedItems: string[] = []
    let cursor = index
    while (cursor < lines.length) {
      const match = normalizeLineForDocx(lines[cursor]).match(/^\d+[\.\u3001]\s*(.+)$/)
      if (!match) break
      orderedItems.push(match[1])
      cursor += 1
    }
    if (orderedItems.length > 0) {
      if (hasExplicitListRule(formatProfileSnapshot, "orderedList") && orderedItems.length >= 2) {
        blocks.push({ type: "list", ordered: true, items: orderedItems, autoNumberingIntent: "auto-list", roleSource: "markdown-list", ...blockMeta(formatProfileSnapshot, "orderedList"), sourceLineRange: { start: lineNumber, end: cursor } })
      } else {
        blocks.push(...orderedItems.map((_item, offset) => ({
          type: "paragraph" as const,
          text: normalizeLineForDocx(lines[index + offset]),
          autoNumberingIntent: "visible-number-text" as const,
          roleSource: "visible-number-text" as const,
          ...blockMeta(formatProfileSnapshot, "paragraph"),
          sourceLineRange: { start: lineNumber + offset, end: lineNumber + offset },
        })))
      }
      index = cursor
      continue
    }

    const bulletItems: string[] = []
    cursor = index
    while (cursor < lines.length) {
      const match = normalizeLineForDocx(lines[cursor]).match(/^[-*]\s+(.+)$/)
      if (!match) break
      bulletItems.push(match[1])
      cursor += 1
    }
    if (bulletItems.length > 0) {
      if (hasExplicitListRule(formatProfileSnapshot, "unorderedList") && bulletItems.length >= 2) {
        blocks.push({ type: "list", ordered: false, items: bulletItems, autoNumberingIntent: "auto-list", roleSource: "markdown-list", ...blockMeta(formatProfileSnapshot, "unorderedList"), sourceLineRange: { start: lineNumber, end: cursor } })
      } else {
        blocks.push(...bulletItems.map((_item, offset) => ({
          type: "paragraph" as const,
          text: normalizeLineForDocx(lines[index + offset]),
          autoNumberingIntent: "visible-number-text" as const,
          roleSource: "visible-number-text" as const,
          ...blockMeta(formatProfileSnapshot, "paragraph"),
          sourceLineRange: { start: lineNumber + offset, end: lineNumber + offset },
        })))
      }
      index = cursor
      continue
    }

    const bareListRun = /[：:]$/.test(line) && canRecoverBareList(formatProfileSnapshot)
      ? parseBareListRun(lines, index + 1)
      : null
    if (bareListRun) {
      blocks.push({ type: "paragraph", text: line, autoNumberingIntent: "none", roleSource: "paragraph", ...blockMeta(formatProfileSnapshot, "paragraph"), sourceLineRange: { start: lineNumber, end: lineNumber } })
      blocks.push({
        type: "list",
        ordered: true,
        items: bareListRun.items,
        autoNumberingIntent: "recovered-bare-list",
        roleSource: "recovered-bare-list",
        ...blockMeta(formatProfileSnapshot, "orderedList"),
        sourceLineRange: { start: lineNumber + 1, end: bareListRun.next },
        diagnostics: ["bare-list-recovered"],
      })
      diagnostics.push({ severity: "info", message: "Recovered a conservative bare-list run for DOCX export.", sourceLine: lineNumber + 1 })
      index = bareListRun.next
      continue
    }

    blocks.push({ type: "paragraph", text: line, autoNumberingIntent: "none", roleSource: "paragraph", ...blockMeta(formatProfileSnapshot, "paragraph"), sourceLineRange: { start: lineNumber, end: lineNumber } })
    index += 1
  }

  if (!blocks.some((block) => block.type === "documentTitle")) {
    diagnostics.push({ severity: "info", message: "No markdown H1 title found; using draft title as documentTitle." })
    blocks.unshift({ type: "documentTitle", text: draft.title, ...blockMeta(formatProfileSnapshot, "documentTitle"), roleSource: "plain-title", sourceLineRange: { start: 0, end: 0 } })
  }

  const withoutHash = {
    schemaVersion: DOCX_INTERMEDIATE_SCHEMA_VERSION,
    sourceDraftId: draft.id,
    sourceDraftContentHash: draft.source.contentHash,
    blocks,
    diagnostics,
    stylePolicy,
  }
  return {
    ...withoutHash,
    intermediateHash: sha256Stable(withoutHash),
  }
}
