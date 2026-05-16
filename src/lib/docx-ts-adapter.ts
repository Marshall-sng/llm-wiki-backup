import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx"

import type { DocxIntermediateBlock, DocxIntermediateDocument } from "@/lib/docx-intermediate"
import type { DocxFormatDimension, DocxResolvedStylePolicy, DocxResolvedTextStyle } from "@/lib/docx-format-style"
import type { DocxAdapterResultLike } from "@/lib/docx-match-review"
import { normalizeWhitespaceHtmlEntities } from "@/lib/text-normalization"

export const DOCX_NPM_ADAPTER_ID = "docx-npm.v1" as const

export interface DocxTsAdapterResult {
  adapterResult: DocxAdapterResultLike
  bytes: Uint8Array
}

const FALLBACK_STYLE: DocxResolvedTextStyle = { fontFamily: "FangSong", fontSizeHalfPoints: 32, lineSpacingTwips: 600 }

export interface DocxInlineSegment {
  text: string
  bold?: boolean
}

function alignment(value: DocxResolvedTextStyle["alignment"]) {
  if (value === "center") return AlignmentType.CENTER
  if (value === "justified") return AlignmentType.JUSTIFIED
  return AlignmentType.LEFT
}

function paragraphStyle(style: DocxResolvedTextStyle) {
  return {
    ...(style.alignment ? { alignment: alignment(style.alignment) } : {}),
    ...(style.firstLineIndentTwips ? { indent: { firstLine: style.firstLineIndentTwips } } : {}),
    ...(style.lineSpacingTwips ? { spacing: { line: style.lineSpacingTwips, lineRule: LineRuleType.EXACTLY } } : {}),
  }
}

function textRun(text: string, style: DocxResolvedTextStyle = FALLBACK_STYLE, options: { bold?: boolean } = {}) {
  return new TextRun({
    text,
    bold: options.bold ?? style.bold,
    size: style.fontSizeHalfPoints,
    font: {
      ascii: style.fontFamily,
      eastAsia: style.fontFamily,
      hAnsi: style.fontFamily,
      cs: style.fontFamily,
    },
  })
}

function normalizeWikiLinks(text: string): string {
  return normalizeWhitespaceHtmlEntities(text).replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_, target: string, label?: string) => (label || target).trim())
}

export function parseDocxInlineSegments(text: string): DocxInlineSegment[] {
  const segments: DocxInlineSegment[] = []
  const pattern = /\*\*([^*]+?)\*\*/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) {
      const plain = normalizeWikiLinks(text.slice(cursor, start))
      if (plain) segments.push({ text: plain })
    }
    const bold = normalizeWikiLinks(match[1])
    if (bold) segments.push({ text: bold, bold: true })
    cursor = start + match[0].length
  }
  if (cursor < text.length) {
    const plain = normalizeWikiLinks(text.slice(cursor))
    if (plain) segments.push({ text: plain })
  }
  if (segments.length === 0) return [{ text: normalizeWikiLinks(text) }]
  return segments
}

export function normalizeDocxInlineText(text: string): string {
  return parseDocxInlineSegments(text).map((segment) => segment.text).join("")
}

function textRuns(text: string, style: DocxResolvedTextStyle = FALLBACK_STYLE, options: { bold?: boolean } = {}): TextRun[] {
  return parseDocxInlineSegments(text).map((segment) => textRun(segment.text, style, { bold: options.bold ?? segment.bold }))
}

function styleForDimension(policy: DocxResolvedStylePolicy, dimension: DocxFormatDimension): DocxResolvedTextStyle {
  return policy.byDimension[dimension] ?? FALLBACK_STYLE
}

function paragraphForBlock(block: DocxIntermediateBlock, policy: DocxResolvedStylePolicy): Paragraph | null {
  if (block.type === "documentTitle") {
    const style = styleForDimension(policy, "title.main")
    return new Paragraph({ heading: HeadingLevel.TITLE, ...paragraphStyle(style), children: textRuns(block.text, style) })
  }
  if (block.type === "heading") {
    const dimension = block.level <= 1 ? "heading.level1" : block.level === 2 ? "heading.level2" : "heading.level3"
    const style = styleForDimension(policy, dimension)
    return new Paragraph({
      heading: block.level <= 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      ...paragraphStyle(style),
      children: textRuns(block.text, style),
    })
  }
  if (block.type === "paragraph") {
    const style = styleForDimension(policy, "paragraph.body")
    return new Paragraph({ ...paragraphStyle(style), children: textRuns(block.text, style) })
  }
  return null
}

function tableForBlock(block: Extract<DocxIntermediateBlock, { type: "table" }>, policy: DocxResolvedStylePolicy): Table {
  const style = styleForDimension(policy, "paragraph.body")
  return new Table({
    rows: [
      new TableRow({ children: block.columns.map((column) => new TableCell({ children: [new Paragraph({ children: textRuns(column, style, { bold: true }) })] })) }),
      ...block.rows.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: textRuns(cell, style) })] })) })),
    ],
  })
}

export async function renderDocxWithTsAdapter(intermediate: DocxIntermediateDocument, title: string): Promise<DocxTsAdapterResult> {
  const children: Array<Paragraph | Table> = []
  const policy = intermediate.stylePolicy
  for (const block of intermediate.blocks) {
    const paragraph = paragraphForBlock(block, policy)
    if (paragraph) {
      children.push(paragraph)
      continue
    }
    if (block.type === "list") {
      const style = styleForDimension(policy, "paragraph.body")
      for (const item of block.items) {
        const shouldNumber = block.autoNumberingIntent === "auto-list" || block.autoNumberingIntent === "recovered-bare-list"
        children.push(new Paragraph({
          ...paragraphStyle(style),
          ...(shouldNumber ? { indent: { left: 720, hanging: 360 } } : {}),
          children: textRuns(item, style),
          ...(shouldNumber ? { numbering: { reference: block.ordered ? "ordered-list" : "bullet-list", level: 0 } } : {}),
        }))
      }
      continue
    }
    if (block.type === "table") children.push(tableForBlock(block, policy))
  }
  const titleStyle = styleForDimension(policy, "title.main")
  const heading1Style = styleForDimension(policy, "heading.level1")
  const heading2Style = styleForDimension(policy, "heading.level2")
  const bodyStyle = styleForDimension(policy, "paragraph.body")
  const pagePolicy = policy.page
  const margin = {
    ...pagePolicy.marginTwips,
    ...(pagePolicy.headerTwips !== undefined ? { header: pagePolicy.headerTwips } : {}),
    ...(pagePolicy.footerTwips !== undefined ? { footer: pagePolicy.footerTwips } : {}),
  }

  const document = new Document({
    title,
    creator: "llm-wiki-docx-writer",
    numbering: {
      config: [
        { reference: "ordered-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }] },
        { reference: "bullet-list", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT }] },
      ],
    },
    styles: {
      paragraphStyles: [
        { id: "Normal", name: "Normal", run: { size: bodyStyle.fontSizeHalfPoints, font: bodyStyle.fontFamily }, paragraph: paragraphStyle(bodyStyle) },
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: titleStyle.fontSizeHalfPoints, bold: true, font: titleStyle.fontFamily }, paragraph: paragraphStyle(titleStyle) },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: heading1Style.fontSizeHalfPoints, bold: true, font: heading1Style.fontFamily }, paragraph: paragraphStyle(heading1Style) },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: heading2Style.fontSizeHalfPoints, bold: true, font: heading2Style.fontFamily }, paragraph: paragraphStyle(heading2Style) },
      ],
    },
    sections: [{
      properties: {
        page: {
          ...(pagePolicy.sizeTwips ? { size: { width: pagePolicy.sizeTwips.width, height: pagePolicy.sizeTwips.height } } : {}),
          margin,
        },
      },
      children,
    }],
  })

  const arrayBuffer = await Packer.toArrayBuffer(document)
  const bytes = new Uint8Array(arrayBuffer)
  return {
    adapterResult: {
      adapterId: DOCX_NPM_ADAPTER_ID,
      sizeBytes: bytes.byteLength,
      validationErrors: [],
      knownWarnings: ["manual-word-openability-not-tested", "pixel-perfect-rendering-not-claimed"],
    },
    bytes,
  }
}
