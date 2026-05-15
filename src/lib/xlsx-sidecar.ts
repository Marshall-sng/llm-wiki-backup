import type { XlsxSidecarPayload } from "@/commands/fs"
import type { EvidenceAnchor, SourceSidecar } from "./source-sidecar-types"

function slugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "sheet"
}

function textHashHint(sourceHash: string, suffix: string): string {
  return `${sourceHash.slice(0, 16)}:${suffix}`
}

function rowPreview(values: string[]): string {
  return values.join(" | ").slice(0, 500)
}

export function buildXlsxSourceSidecar(payload: XlsxSidecarPayload): SourceSidecar {
  const anchors: EvidenceAnchor[] = []

  for (const sheet of payload.sheets) {
    const sheetSlug = slugPart(sheet.name)
    const cellsByRow = new Map<number, typeof sheet.cells>()
    for (const cell of sheet.cells) {
      const rowCells = cellsByRow.get(cell.row) ?? []
      rowCells.push(cell)
      cellsByRow.set(cell.row, rowCells)
    }

    for (const [rowNumber, rowCells] of Array.from(cellsByRow.entries()).sort(([left], [right]) => left - right)) {
      const sortedRowCells = [...rowCells].sort((left, right) => left.column - right.column)
      const rowAnchorId = `xlsx:${sheetSlug}:row:${rowNumber}`
      anchors.push({
        anchor_id: rowAnchorId,
        source_id: payload.path,
        format: "xlsx",
        kind: "xlsx.row",
        selector: { sheet: sheet.name, row: rowNumber },
        text: {
          preview: rowPreview(sortedRowCells.map((cell) => cell.value)),
          text_len: sortedRowCells.reduce((sum, cell) => sum + cell.value.length, 0),
          text_hash: textHashHint(payload.sha256, rowAnchorId),
        },
        confidence: 1,
        metadata: { cell_count: sortedRowCells.length },
      })

      for (const cell of sortedRowCells) {
        const cellAnchorId = `xlsx:${sheetSlug}:cell:${cell.row}:${cell.column}`
        anchors.push({
          anchor_id: cellAnchorId,
          source_id: payload.path,
          format: "xlsx",
          kind: "xlsx.cell",
          selector: { sheet: sheet.name, row: cell.row, column: cell.column, address: cell.address },
          text: {
            preview: cell.value,
            text_len: cell.value.length,
            text_hash: textHashHint(payload.sha256, cellAnchorId),
          },
          confidence: 1,
          metadata: { row_anchor_id: rowAnchorId },
        })
      }
    }
  }

  const rowAnchorCount = anchors.filter((anchor) => anchor.kind === "xlsx.row").length
  const cellAnchorCount = anchors.filter((anchor) => anchor.kind === "xlsx.cell").length

  return {
    schema_version: "source-sidecar/v1",
    source: {
      source_id: payload.path,
      format: "xlsx",
      uri: payload.path,
      title: payload.fileName,
      content_hash: payload.sha256,
      mtime_ms: payload.modifiedMs ?? undefined,
      size_bytes: payload.sizeBytes,
    },
    anchors,
    coverage: {
      anchor_count: anchors.length,
      row_anchor_count: rowAnchorCount,
      cell_anchor_count: cellAnchorCount,
    },
    quality: {
      warnings: [],
      unsupported_features: [],
      confidence: 1,
    },
  }
}
