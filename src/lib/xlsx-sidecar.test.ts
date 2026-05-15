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
          { sheet: "第一批企业名单", row: 1, column: 1, address: "A1", value: "企业名称" },
          { sheet: "第一批企业名单", row: 1, column: 2, address: "B1", value: "联系人" },
          { sheet: "第一批企业名单", row: 2, column: 1, address: "A2", value: "杭州数源科技有限公司" },
          { sheet: "第一批企业名单", row: 2, column: 2, address: "B2", value: "联系人1" },
          { sheet: "第一批企业名单", row: 2, column: 3, address: "C2", value: "13800000001" },
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
    expect(sidecar.coverage.cell_anchor_count).toBe(6)
    expect(sidecar.coverage.anchor_count).toBe(9)
    expect(sidecar.anchors.some((anchor) => anchor.kind === "xlsx.row" && anchor.selector.sheet === "第一批企业名单")).toBe(true)
    expect(sidecar.anchors.some((anchor) => anchor.kind === "xlsx.cell" && anchor.text.preview === "13800000001")).toBe(true)
  })

  it("keeps source freshness fields from raw file metadata", () => {
    const sidecar = buildXlsxSourceSidecar(samplePayload())
    expect(sidecar.source.size_bytes).toBe(1024)
    expect(sidecar.source.mtime_ms).toBe(1_700_000_000_000)
    expect(sidecar.source.title).toBe("第一批企业名单.xlsx")
  })
})
