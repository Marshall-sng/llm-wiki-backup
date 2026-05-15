import { describe, expect, it } from "vitest"
import type { XlsxSidecarPayload } from "@/commands/fs"
import { buildXlsxSourceSidecar } from "./xlsx-sidecar"

function samplePayload(): XlsxSidecarPayload {
  return {
    path: "D:/project/raw/sources/第一批企业名单.xlsx",
    fileName: "第一批企业名单.xlsx",
    sizeBytes: 1024,
    modifiedMs: 1_700_000_000_000,
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    sheets: [
      {
        name: "第一批企业名单",
        rowCount: 2,
        columnCount: 3,
        cells: [
          { sheet: "第一批企业名单", row: 1, column: 1, address: "A1", value: "序号" },
          { sheet: "第一批企业名单", row: 1, column: 2, address: "B1", value: "企业名称" },
          { sheet: "第一批企业名单", row: 1, column: 3, address: "C1", value: "项目名称" },
          { sheet: "第一批企业名单", row: 1, column: 4, address: "D1", value: "联系人" },
          { sheet: "第一批企业名单", row: 1, column: 5, address: "E1", value: "电话" },
          { sheet: "第一批企业名单", row: 1, column: 6, address: "F1", value: "行业" },
          { sheet: "第一批企业名单", row: 2, column: 1, address: "A2", value: "1" },
          { sheet: "第一批企业名单", row: 2, column: 2, address: "B2", value: "杭州数源科技有限公司" },
          { sheet: "第一批企业名单", row: 2, column: 3, address: "C2", value: "数据资产登记" },
          { sheet: "第一批企业名单", row: 2, column: 4, address: "D2", value: "联系人1" },
          { sheet: "第一批企业名单", row: 2, column: 5, address: "E2", value: "13800000001" },
          { sheet: "第一批企业名单", row: 2, column: 6, address: "F2", value: "数字政务" },
        ],
      },
      {
        name: "企业申报明细",
        rowCount: 1,
        columnCount: 1,
        cells: [
          { sheet: "企业申报明细", row: 1, column: 1, address: "A1", value: "项目明细" },
        ],
      },
    ],
  }
}

describe("xlsx sidecar builder", () => {
  it("maps workbook payload into row and cell evidence anchors", () => {
    const sidecar = buildXlsxSourceSidecar(samplePayload())
    expect(sidecar.source.format).toBe("xlsx")
    expect(sidecar.source.content_hash).toBe(samplePayload().sha256)
    expect(sidecar.coverage.row_anchor_count).toBe(3)
    expect(sidecar.coverage.cell_anchor_count).toBe(13)
    expect(sidecar.coverage.anchor_count).toBe(16)
    expect(sidecar.anchors.some((anchor) => anchor.kind === "xlsx.row" && anchor.selector.sheet === "第一批企业名单")).toBe(true)
    expect(sidecar.anchors.some((anchor) => anchor.kind === "xlsx.cell" && anchor.text.preview === "13800000001")).toBe(true)
  })

  it("detects first-batch domain rows from structural headers, not file name alone", () => {
    const sidecar = buildXlsxSourceSidecar(samplePayload())
    expect(sidecar.domain_rows?.first_batch).toHaveLength(1)
    expect(sidecar.domain_rows?.first_batch?.[0]).toMatchObject({
      enterprise_name: "杭州数源科技有限公司",
      project_name: "数据资产登记",
      contacts: ["联系人1"],
      phones: ["13800000001"],
    })
    expect(sidecar.metadata?.detectors).toMatchObject({
      first_batch: expect.arrayContaining([
        expect.objectContaining({ detected: true, confidence: expect.any(Number), data_row_density: 1 }),
      ]),
    })
  })

  it("detects a first-batch table with alias headers as a second positive shape", () => {
    const sidecar = buildXlsxSourceSidecar({
      ...samplePayload(),
      fileName: "companies.xlsx",
      sheets: [{
        name: "申报企业",
        rowCount: 2,
        columnCount: 5,
        cells: [
          { sheet: "申报企业", row: 1, column: 1, address: "A1", value: "编号" },
          { sheet: "申报企业", row: 1, column: 2, address: "B1", value: "公司名称" },
          { sheet: "申报企业", row: 1, column: 3, address: "C1", value: "数据资产" },
          { sheet: "申报企业", row: 1, column: 4, address: "D1", value: "联系方式" },
          { sheet: "申报企业", row: 1, column: 5, address: "E1", value: "所属行业" },
          { sheet: "申报企业", row: 2, column: 1, address: "A2", value: "A-01" },
          { sheet: "申报企业", row: 2, column: 2, address: "B2", value: "浙江云链数据有限公司" },
          { sheet: "申报企业", row: 2, column: 3, address: "C2", value: "云链数据授权运营" },
          { sheet: "申报企业", row: 2, column: 4, address: "D2", value: "13900000001" },
          { sheet: "申报企业", row: 2, column: 5, address: "E2", value: "产业互联网" },
        ],
      }],
    })
    expect(sidecar.domain_rows?.first_batch?.[0]).toMatchObject({
      enterprise_name: "浙江云链数据有限公司",
      project_name: "云链数据授权运营",
      original_serial: "A-01",
      phones: ["13900000001"],
    })
  })

  it("does not invent first-batch domain rows for unsupported workbooks", () => {
    const sidecar = buildXlsxSourceSidecar({
      ...samplePayload(),
      fileName: "第一批企业名单.xlsx",
      sheets: [{
        name: "普通表",
        rowCount: 2,
        columnCount: 2,
        cells: [
          { sheet: "普通表", row: 1, column: 1, address: "A1", value: "名称" },
          { sheet: "普通表", row: 1, column: 2, address: "B1", value: "备注" },
          { sheet: "普通表", row: 2, column: 1, address: "A2", value: "不是企业名单" },
          { sheet: "普通表", row: 2, column: 2, address: "B2", value: "无项目列" },
        ],
      }],
    })
    expect(sidecar.domain_rows?.first_batch).toBeUndefined()
    expect(sidecar.quality.warnings).toContain("first_batch_domain_rows_not_detected")
  })

  it("rejects header-like sheets when complete data row density is too low", () => {
    const sidecar = buildXlsxSourceSidecar({
      ...samplePayload(),
      sheets: [{
        name: "异常名单",
        rowCount: 3,
        columnCount: 4,
        cells: [
          { sheet: "异常名单", row: 1, column: 1, address: "A1", value: "序号" },
          { sheet: "异常名单", row: 1, column: 2, address: "B1", value: "企业名称" },
          { sheet: "异常名单", row: 1, column: 3, address: "C1", value: "项目名称" },
          { sheet: "异常名单", row: 1, column: 4, address: "D1", value: "电话" },
          { sheet: "异常名单", row: 2, column: 2, address: "B2", value: "只有企业无项目" },
          { sheet: "异常名单", row: 3, column: 2, address: "B3", value: "仍然无项目" },
        ],
      }],
    })
    expect(sidecar.domain_rows?.first_batch).toBeUndefined()
    expect(sidecar.metadata?.detectors).toMatchObject({
      first_batch: [expect.objectContaining({ detected: false, data_row_density: 0 })],
    })
  })

  it("keeps source freshness fields from raw file metadata", () => {
    const sidecar = buildXlsxSourceSidecar(samplePayload())
    expect(sidecar.source.size_bytes).toBe(1024)
    expect(sidecar.source.mtime_ms).toBe(1_700_000_000_000)
    expect(sidecar.source.title).toBe("第一批企业名单.xlsx")
  })
})
