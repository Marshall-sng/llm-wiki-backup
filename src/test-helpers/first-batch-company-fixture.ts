import type { EvidenceAnchor, FirstBatchCompanyRow, FirstBatchPilotRow, SourceSidecar } from "@/lib/source-sidecar-types"

const SOURCE_ID = "raw/sources/第一批企业名单.xlsx"

const enterpriseNames = [
  "杭州数源科技有限公司",
  "浙江云链数据有限公司",
  "宁波港航数据服务有限公司",
  "温州智造数据有限公司",
  "湖州绿色金融数据有限公司",
  "嘉兴产业大脑有限公司",
  "绍兴黄酒产业数据有限公司",
  "金华物流数据有限公司",
  "衢州农业数据有限公司",
  "舟山海洋数据有限公司",
  "台州医药数据有限公司",
  "丽水生态数据有限公司",
  "义乌小商品数据有限公司",
  "萧山交通数据有限公司",
  "余杭城市治理数据有限公司",
  "滨江数字健康有限公司",
  "富阳水务数据有限公司",
  "临平算力服务有限公司",
]

const industries = ["数字政务", "港航物流", "智能制造", "绿色金融", "产业互联网", "现代农业"]

function makeAnchor(anchorId: string, kind: string, selector: Record<string, unknown>, preview: string): EvidenceAnchor {
  return {
    anchor_id: anchorId,
    source_id: SOURCE_ID,
    format: "xlsx",
    kind,
    selector,
    text: { preview, text_len: preview.length },
    confidence: 1,
    metadata: { fixture: "first_batch_company" },
  }
}

function makeFirstBatchRow(index: number): FirstBatchCompanyRow {
  const rowNumber = index + 2
  const serial = String(index + 1)
  const enterpriseName = enterpriseNames[index]
  const contact = index < 13 ? [`联系人${index + 1}`] : []
  const phone = index < 13 ? [`1380000${String(index + 1).padStart(4, "0")}`] : []
  const projectName = `${enterpriseName}数据资产登记；${enterpriseName}授权运营；${enterpriseName}数据服务接口`
  return {
    row_id: `first_batch:${serial}`,
    row_anchor_id: `xlsx:first_batch:row:${rowNumber}`,
    source_id: SOURCE_ID,
    enterprise_name: enterpriseName,
    project_name: projectName,
    original_serial: serial,
    industry: industries[index % industries.length],
    contacts: contact,
    phones: phone,
    source_worksheets: ["第一批企业名单", "企业申报明细"],
    cell_anchor_ids: {
      enterprise_name: `xlsx:first_batch:cell:${rowNumber}:enterprise_name`,
      project_name: `xlsx:first_batch:cell:${rowNumber}:project_name`,
      contact: `xlsx:first_batch:cell:${rowNumber}:contact`,
      phone: `xlsx:first_batch:cell:${rowNumber}:phone`,
      source_worksheet_1: `xlsx:first_batch:cell:${rowNumber}:source_worksheet_1`,
      source_worksheet_2: `xlsx:first_batch:cell:${rowNumber}:source_worksheet_2`,
      industry: `xlsx:first_batch:cell:${rowNumber}:industry`,
      original_serial: `xlsx:first_batch:cell:${rowNumber}:original_serial`,
    },
  }
}

function makePilotRow(index: number): FirstBatchPilotRow {
  const rowNumber = index + 2
  return {
    row_id: `pilot:${index + 1}`,
    row_anchor_id: `xlsx:pilot_units:row:${rowNumber}`,
    source_id: SOURCE_ID,
    unit_name: `试点单位${index + 1}`,
    project_name: `试点单位${index + 1}数据空间建设`,
    source_worksheets: ["试点单位名单"],
    cell_anchor_ids: Object.fromEntries(
      Array.from({ length: 15 }, (_, cellIndex) => [`field_${cellIndex + 1}`, `xlsx:pilot_units:cell:${rowNumber}:${cellIndex + 1}`]),
    ),
  }
}

function anchorsForFirstBatchRow(row: FirstBatchCompanyRow): EvidenceAnchor[] {
  const rowAnchor = makeAnchor(
    row.row_anchor_id,
    "xlsx.row",
    { sheet: "第一批企业名单", row: Number(row.original_serial) + 1, row_id: row.row_id },
    `${row.original_serial} ${row.enterprise_name} ${row.project_name}`,
  )
  const cellValues: Array<[string, string]> = [
    [row.cell_anchor_ids.enterprise_name, row.enterprise_name],
    [row.cell_anchor_ids.project_name, row.project_name],
    [row.cell_anchor_ids.contact, row.contacts.join("、")],
    [row.cell_anchor_ids.phone, row.phones.join("、")],
    [row.cell_anchor_ids.source_worksheet_1, row.source_worksheets[0]],
    [row.cell_anchor_ids.source_worksheet_2, row.source_worksheets[1]],
    [row.cell_anchor_ids.industry, row.industry],
    [row.cell_anchor_ids.original_serial, row.original_serial],
  ]

  return [
    rowAnchor,
    ...cellValues.map(([anchorId, value], cellIndex) => makeAnchor(
      anchorId,
      "xlsx.cell",
      { sheet: "第一批企业名单", row: Number(row.original_serial) + 1, column: cellIndex + 1, row_id: row.row_id },
      value,
    )),
  ]
}

function anchorsForPilotRow(row: FirstBatchPilotRow, rowIndex: number): EvidenceAnchor[] {
  const rowNumber = rowIndex + 2
  const rowAnchor = makeAnchor(
    row.row_anchor_id,
    "xlsx.row",
    { sheet: "试点单位名单", row: rowNumber, row_id: row.row_id },
    `${row.unit_name} ${row.project_name}`,
  )
  const cellAnchors = Object.values(row.cell_anchor_ids).map((anchorId, index) => makeAnchor(
    anchorId,
    "xlsx.cell",
    { sheet: "试点单位名单", row: rowNumber, column: index + 1, row_id: row.row_id },
    index === 0 ? row.unit_name : index === 1 ? row.project_name : `试点字段${index + 1}`,
  ))
  return [rowAnchor, ...cellAnchors]
}

export function makeFirstBatchCompanyRows(): FirstBatchCompanyRow[] {
  return enterpriseNames.map((_, index) => makeFirstBatchRow(index))
}

export function makeFirstBatchPilotRows(): FirstBatchPilotRow[] {
  return Array.from({ length: 4 }, (_, index) => makePilotRow(index))
}

export function makeFirstBatchCompanyFixtureSidecar(): SourceSidecar {
  const firstBatchRows = makeFirstBatchCompanyRows()
  const pilotRows = makeFirstBatchPilotRows()
  const anchors = [
    ...firstBatchRows.flatMap(anchorsForFirstBatchRow),
    ...pilotRows.flatMap(anchorsForPilotRow),
  ]
  const rowAnchorCount = anchors.filter((anchor) => anchor.kind === "xlsx.row").length
  const cellAnchorCount = anchors.filter((anchor) => anchor.kind === "xlsx.cell").length

  return {
    schema_version: "source-sidecar/v1",
    source: {
      source_id: SOURCE_ID,
      format: "xlsx",
      uri: "raw/sources/第一批企业名单.xlsx",
      title: "第一批企业名单.xlsx",
      origin: "phase-a-fixture",
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
    domain_rows: {
      first_batch: firstBatchRows,
      pilot_units: pilotRows,
    },
  }
}

export function makeFullFirstBatchWikiText(rows: FirstBatchCompanyRow[]): string {
  return rows.map((row) => [
    row.enterprise_name,
    row.project_name,
    row.industry,
    row.original_serial,
    ...row.contacts,
    ...row.phones,
    ...row.source_worksheets,
  ].join("\n")).join("\n---\n")
}

export function makeSummaryStyleFirstBatchWikiText(rows: FirstBatchCompanyRow[]): string {
  return rows.map((row) => `## ${row.enterprise_name}\n该企业入选第一批名单。`).join("\n")
}
