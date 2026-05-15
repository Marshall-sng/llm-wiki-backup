import { describe, expect, it } from "vitest"
import type { XlsxSidecarPayload } from "@/commands/fs"
import { ensureXlsxSourceSidecarFresh, isXlsxSourcePath, readXlsxSourceSidecarFeatureFlag } from "./source-sidecar-ingest"
import type { SourceSidecar } from "./source-sidecar-types"

function payload(path: string): XlsxSidecarPayload {
  return {
    path,
    fileName: "第一批企业名单.xlsx",
    sizeBytes: 100,
    modifiedMs: 123,
    sha256: "f".repeat(64),
    sheets: [{
      name: "第一批企业名单",
      rowCount: 1,
      columnCount: 1,
      cells: [{ sheet: "第一批企业名单", row: 1, column: 1, address: "A1", value: "杭州数源科技有限公司" }],
    }],
  }
}

describe("source sidecar ingest gate", () => {
  it("recognizes only xlsx source paths", () => {
    expect(isXlsxSourcePath("raw/sources/a.xlsx")).toBe(true)
    expect(isXlsxSourcePath("raw/sources/a.XLSX")).toBe(true)
    expect(isXlsxSourcePath("raw/sources/a.docx")).toBe(false)
    expect(isXlsxSourcePath("raw/sources/a.xlsx.md")).toBe(false)
  })

  it("keeps the feature flag disabled by default", () => {
    expect(readXlsxSourceSidecarFeatureFlag({ getItem: () => null })).toBe(false)
    expect(readXlsxSourceSidecarFeatureFlag({ getItem: () => "false" })).toBe(false)
    expect(readXlsxSourceSidecarFeatureFlag({ getItem: () => "true" })).toBe(true)
  })

  it("does not extract or persist when disabled", async () => {
    let calls = 0
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/第一批企业名单.xlsx",
      enabled: false,
      deps: {
        extractPayload: async () => {
          calls += 1
          return payload("unused")
        },
        persist: async () => {
          calls += 1
          return "unused"
        },
      },
    })
    expect(result.status).toBe("disabled")
    expect(calls).toBe(0)
  })

  it("does not alter non-xlsx ingest behavior even when enabled", async () => {
    let calls = 0
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/readme.txt",
      enabled: true,
      deps: {
        extractPayload: async () => {
          calls += 1
          return payload("unused")
        },
        persist: async () => {
          calls += 1
          return "unused"
        },
      },
    })
    expect(result.status).toBe("skipped")
    expect(calls).toBe(0)
  })

  it("extracts, maps, and persists xlsx sidecars when enabled", async () => {
    const written: SourceSidecar[] = []
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/第一批企业名单.xlsx",
      enabled: true,
      deps: {
        extractPayload: async (sourcePath) => payload(sourcePath),
        persist: async (_projectPath, sidecar) => {
          written.push(sidecar)
          return "D:/project/.llm-wiki/sidecars/第一批企业名单.xlsx.sidecar.json"
        },
      },
    })
    expect(result.status).toBe("written")
    expect(written).toHaveLength(1)
    expect(written[0].coverage.row_anchor_count).toBe(1)
    expect(written[0].coverage.cell_anchor_count).toBe(1)
  })
})
