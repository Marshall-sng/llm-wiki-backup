import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx"

import type { DocxIntermediateBlock, DocxIntermediateDocument } from "@/lib/docx-intermediate"
import type { DocxAdapterResultLike } from "@/lib/docx-match-review"

export const DOCX_NPM_ADAPTER_ID = "docx-npm.v1" as const

export interface DocxTsAdapterResult {
  adapterResult: DocxAdapterResultLike
  bytes: Uint8Array
}

function textRun(text: string, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text, bold: options.bold, size: options.size ?? 31, font: "FangSong" })
}

function paragraphForBlock(block: DocxIntermediateBlock): Paragraph | null {
  if (block.type === "documentTitle") {
    return new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [textRun(block.text, { bold: true, size: 44 })] })
  }
  if (block.type === "heading") {
    return new Paragraph({ heading: block.level <= 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [textRun(block.text, { bold: true, size: block.level <= 1 ? 32 : 31 })] })
  }
  if (block.type === "paragraph") return new Paragraph({ children: [textRun(block.text)] })
  return null
}

function tableForBlock(block: Extract<DocxIntermediateBlock, { type: "table" }>): Table {
  return new Table({
    rows: [
      new TableRow({ children: block.columns.map((column) => new TableCell({ children: [new Paragraph({ children: [textRun(column, { bold: true })] })] })) }),
      ...block.rows.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: [textRun(cell)] })] })) })),
    ],
  })
}

export async function renderDocxWithTsAdapter(intermediate: DocxIntermediateDocument, title: string): Promise<DocxTsAdapterResult> {
  const children: Array<Paragraph | Table> = []
  for (const block of intermediate.blocks) {
    const paragraph = paragraphForBlock(block)
    if (paragraph) {
      children.push(paragraph)
      continue
    }
    if (block.type === "list") {
      for (const item of block.items) {
        children.push(new Paragraph({ children: [textRun(item)], numbering: { reference: block.ordered ? "ordered-list" : "bullet-list", level: 0 } }))
      }
      continue
    }
    if (block.type === "table") children.push(tableForBlock(block))
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
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 44, bold: true, font: "FangSong" } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "FangSong" } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 31, bold: true, font: "FangSong" } },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  })

  const arrayBuffer = await Packer.toArrayBuffer(document)
  const bytes = new Uint8Array(arrayBuffer)
  return {
    adapterResult: {
      adapterId: DOCX_NPM_ADAPTER_ID,
      sizeBytes: bytes.byteLength,
      validationErrors: [],
      knownWarnings: ["manual-word-openability-not-tested", "high-fidelity-style-replica-not-supported"],
    },
    bytes,
  }
}
