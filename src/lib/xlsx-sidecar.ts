import type { XlsxSidecarCellPayload, XlsxSidecarPayload, XlsxSidecarSheetPayload } from "@/commands/fs"
import type { EvidenceAnchor, FirstBatchCompanyRow, SourceSidecar } from "./source-sidecar-types"

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

function normalizedHeader(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s:：_\-（）()]/g, "").trim()
}

type FirstBatchField = "enterprise_name" | "project_name" | "contact" | "phone" | "industry" | "original_serial"

const headerAliases: Record<FirstBatchField, string[]> = {
  enterprise_name: ["企业名称", "企业名", "公司名称", "企业", "单位名称", "单位"],
  project_name: ["项目名称", "项目", "数据产品", "数据资产", "应用场景"],
  contact: ["联系人", "联络人", "负责人", "联系人员"],
  phone: ["联系电话", "电话", "手机号", "手机", "联系方式"],
  industry: ["行业", "所属行业", "领域", "行业领域"],
  original_serial: ["序号", "编号", "原序号", "serial", "no"],
}

interface DetectedHeader {
  headerRow: number
  columns: Partial<Record<FirstBatchField, number>>
  confidence: number
  reason: string
}

function matchesAlias(value: string, aliases: string[]): boolean {
  const normalized = normalizedHeader(value)
  return aliases.some((alias) => normalized.includes(normalizedHeader(alias)))
}

function detectFirstBatchHeader(sheet: XlsxSidecarSheetPayload): DetectedHeader | null {
  const byRow = new Map<number, XlsxSidecarCellPayload[]>()
  for (const cell of sheet.cells) {
    const rowCells = byRow.get(cell.row) ?? []
    rowCells.push(cell)
    byRow.set(cell.row, rowCells)
  }

  let best: DetectedHeader | null = null
  for (const [rowNumber, rowCells] of byRow) {
    const columns: Partial<Record<FirstBatchField, number>> = {}
    for (const cell of rowCells) {
      for (const [field, aliases] of Object.entries(headerAliases) as Array<[FirstBatchField, string[]]>) {
        if (columns[field] === undefined && matchesAlias(cell.value, aliases)) {
          columns[field] = cell.column
        }
      }
    }
    const requiredHits = [columns.enterprise_name, columns.project_name].filter(Boolean).length
    const optionalHits = [columns.contact, columns.phone, columns.industry, columns.original_serial].filter(Boolean).length
    const score = requiredHits * 2 + optionalHits
    if (requiredHits === 2 && score >= 5) {
      const candidate = {
        headerRow: rowNumber,
        columns,
        confidence: Math.min(1, score / 8),
        reason: `matched first-batch-like headers on row ${rowNumber}: score=${score}`,
      }
      if (best === null || candidate.confidence > best.confidence) best = candidate
    }
  }
  return best
}

function cellMapForSheet(sheet: XlsxSidecarSheetPayload): Map<string, XlsxSidecarCellPayload> {
  return new Map(sheet.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]))
}

function cellValue(cells: Map<string, XlsxSidecarCellPayload>, row: number, column: number | undefined): string {
  if (column === undefined) return ""
  return cells.get(`${row}:${column}`)?.value.trim() ?? ""
}

function cellAnchorId(sheetSlug: string, row: number, column: number | undefined): string | undefined {
  return column === undefined ? undefined : `xlsx:${sheetSlug}:cell:${row}:${column}`
}

interface FirstBatchSheetDetection {
  sheet: string
  detected: boolean
  confidence: number
  reason: string
  data_row_density: number
  extracted_rows: number
}

function detectFirstBatchRows(payload: XlsxSidecarPayload): { rows: FirstBatchCompanyRow[]; detections: FirstBatchSheetDetection[] } {
  const rows: FirstBatchCompanyRow[] = []
  const detections: FirstBatchSheetDetection[] = []

  for (const sheet of payload.sheets) {
    const header = detectFirstBatchHeader(sheet)
    if (header === null || header.confidence < 0.6) {
      detections.push({
        sheet: sheet.name,
        detected: false,
        confidence: header?.confidence ?? 0,
        reason: header?.reason ?? "required first-batch headers were not found",
        data_row_density: 0,
        extracted_rows: 0,
      })
      continue
    }

    const sheetSlug = slugPart(sheet.name)
    const cells = cellMapForSheet(sheet)
    const startCount = rows.length
    let candidateDataRows = 0
    for (let rowNumber = header.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const enterprise = cellValue(cells, rowNumber, header.columns.enterprise_name)
      const project = cellValue(cells, rowNumber, header.columns.project_name)
      if (enterprise || project) candidateDataRows += 1
      if (!enterprise || !project) continue
      const serial = cellValue(cells, rowNumber, header.columns.original_serial) || String(rows.length + 1)
      const contact = cellValue(cells, rowNumber, header.columns.contact)
      const phone = cellValue(cells, rowNumber, header.columns.phone)
      const industry = cellValue(cells, rowNumber, header.columns.industry)
      const cellAnchors: Record<string, string> = {}
      for (const [field, column] of Object.entries(header.columns) as Array<[FirstBatchField, number | undefined]>) {
        const anchorId = cellAnchorId(sheetSlug, rowNumber, column)
        if (anchorId !== undefined) cellAnchors[field] = anchorId
      }
      cellAnchors.source_worksheet_1 = cellAnchors.source_worksheet_1 ?? `xlsx:${sheetSlug}:row:${rowNumber}`

      rows.push({
        row_id: `first_batch:${serial}`,
        row_anchor_id: `xlsx:${sheetSlug}:row:${rowNumber}`,
        source_id: payload.path,
        enterprise_name: enterprise,
        project_name: project,
        original_serial: serial,
        industry,
        contacts: contact ? [contact] : [],
        phones: phone ? [phone] : [],
        source_worksheets: [sheet.name],
        cell_anchor_ids: cellAnchors,
      })
    }

    const extractedRows = rows.length - startCount
    const density = candidateDataRows === 0 ? 0 : extractedRows / candidateDataRows
    const detected = extractedRows > 0 && density >= 0.5
    if (!detected) rows.splice(startCount)
    detections.push({
      sheet: sheet.name,
      detected,
      confidence: detected ? header.confidence : Math.min(header.confidence, 0.59),
      reason: detected
        ? `${header.reason}; extracted_rows=${extractedRows}; data_row_density=${density.toFixed(2)}`
        : `${header.reason}; insufficient complete data rows: extracted_rows=${extractedRows}; data_row_density=${density.toFixed(2)}`,
      data_row_density: density,
      extracted_rows: detected ? extractedRows : 0,
    })
  }

  return { rows, detections }
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
        const anchorId = `xlsx:${sheetSlug}:cell:${cell.row}:${cell.column}`
        anchors.push({
          anchor_id: anchorId,
          source_id: payload.path,
          format: "xlsx",
          kind: "xlsx.cell",
          selector: { sheet: sheet.name, row: cell.row, column: cell.column, address: cell.address },
          text: {
            preview: cell.value,
            text_len: cell.value.length,
            text_hash: textHashHint(payload.sha256, anchorId),
          },
          confidence: 1,
          metadata: { row_anchor_id: rowAnchorId },
        })
      }
    }
  }

  const rowAnchorCount = anchors.filter((anchor) => anchor.kind === "xlsx.row").length
  const cellAnchorCount = anchors.filter((anchor) => anchor.kind === "xlsx.cell").length
  const firstBatch = detectFirstBatchRows(payload)
  const firstBatchRows = firstBatch.rows
  const warnings = firstBatchRows.length === 0 ? ["first_batch_domain_rows_not_detected"] : []

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
      warnings,
      unsupported_features: [],
      confidence: firstBatchRows.length > 0 ? 1 : 0.8,
    },
    metadata: { detectors: { first_batch: firstBatch.detections } },
    domain_rows: firstBatchRows.length > 0 ? { first_batch: firstBatchRows } : undefined,
  }
}
