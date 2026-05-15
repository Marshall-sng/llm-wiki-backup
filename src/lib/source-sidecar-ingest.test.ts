import { describe, expect, it } from "vitest"
import type { XlsxSidecarPayload } from "@/commands/fs"
import {
  ensureXlsxSourceSidecarFresh,
  isXlsxSourcePath,
  readXlsxSourceSidecarFeatureFlag,
  resolveXlsxPrecisionRolloutMode,
  shouldBlockXlsxPrecisionResult,
} from "./source-sidecar-ingest"
import type { SourceSidecar } from "./source-sidecar-types"

function payload(path: string, hash = "f".repeat(64)): XlsxSidecarPayload {
  return {
    path,
    fileName: "第一批企业名单.xlsx",
    sizeBytes: 100,
    modifiedMs: 123,
    sha256: hash,
    sheets: [{
      name: "申报名单",
      rowCount: 2,
      columnCount: 6,
      cells: [
        { sheet: "申报名单", row: 1, column: 1, address: "A1", value: "序号" },
        { sheet: "申报名单", row: 1, column: 2, address: "B1", value: "企业名称" },
        { sheet: "申报名单", row: 1, column: 3, address: "C1", value: "项目名称" },
        { sheet: "申报名单", row: 1, column: 4, address: "D1", value: "联系人" },
        { sheet: "申报名单", row: 1, column: 5, address: "E1", value: "电话" },
        { sheet: "申报名单", row: 1, column: 6, address: "F1", value: "行业" },
        { sheet: "申报名单", row: 2, column: 1, address: "A2", value: "1" },
        { sheet: "申报名单", row: 2, column: 2, address: "B2", value: "杭州数源科技有限公司" },
        { sheet: "申报名单", row: 2, column: 3, address: "C2", value: "数据资产登记" },
        { sheet: "申报名单", row: 2, column: 4, address: "D2", value: "联系人1" },
        { sheet: "申报名单", row: 2, column: 5, address: "E2", value: "13800000001" },
        { sheet: "申报名单", row: 2, column: 6, address: "F2", value: "数字政务" },
      ],
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

  it("resolves rollout mode with new key taking precedence over legacy boolean", () => {
    expect(resolveXlsxPrecisionRolloutMode({ getItem: () => null })).toBe("disabled")
    expect(resolveXlsxPrecisionRolloutMode({ getItem: (key) => key === "llm-wiki.enableXlsxSourceSidecar" ? "true" : null })).toBe("observe")
    expect(resolveXlsxPrecisionRolloutMode({ getItem: (key) => key === "llm-wiki.xlsxPrecisionRolloutMode" ? "block" : "false" })).toBe("block")
    expect(resolveXlsxPrecisionRolloutMode({ getItem: (key) => key === "llm-wiki.xlsxPrecisionRolloutMode" ? "observe" : "false" })).toBe("observe")
    expect(resolveXlsxPrecisionRolloutMode({ getItem: (key) => key === "llm-wiki.xlsxPrecisionRolloutMode" ? "invalid" : null })).toBe("disabled")
    expect(readXlsxSourceSidecarFeatureFlag({ getItem: () => null })).toBe(false)
  })

  it("does not extract or persist when disabled", async () => {
    let calls = 0
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/第一批企业名单.xlsx",
      mode: "disabled",
      deps: {
        extractPayload: async () => {
          calls += 1
          return payload("unused")
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
      mode: "block",
      deps: {
        extractPayload: async () => {
          calls += 1
          return payload("unused")
        },
      },
    })
    expect(result.status).toBe("skipped")
    expect(calls).toBe(0)
  })

  it("extracts, maps, audits, and persists xlsx sidecars when enabled", async () => {
    const written: SourceSidecar[] = []
    const audits: unknown[] = []
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/第一批企业名单.xlsx",
      mode: "block",
      deps: {
        extractPayload: async (sourcePath) => payload(sourcePath),
        load: async () => null,
        findExistingForSource: async () => [],
        persist: async (_projectPath, sidecar) => {
          written.push(sidecar)
          return "D:/project/.llm-wiki/sidecars/第一批企业名单.xlsx.sidecar.json"
        },
        persistAudit: async (_path, audit) => {
          audits.push(audit)
        },
      },
    })
    expect(result.status).toBe("written")
    expect(written).toHaveLength(1)
    expect(written[0].domain_rows?.first_batch).toHaveLength(1)
    expect("auditReport" in result ? result.auditReport?.status : undefined).toBe("passed")
    expect(shouldBlockXlsxPrecisionResult(result)).toBe(false)
    expect(audits).toHaveLength(1)
  })

  it("returns fresh without persisting when the existing sidecar hash matches", async () => {
    let existing: SourceSidecar | null = null
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/第一批企业名单.xlsx",
      mode: "observe",
      deps: {
        extractPayload: async (sourcePath) => payload(sourcePath),
        load: async () => existing,
        findExistingForSource: async () => existing ? [{ path: "old.sidecar.json", sidecar: existing }] : [],
        persist: async (_projectPath, sidecar) => {
          existing = sidecar
          return "sidecar.json"
        },
        persistAudit: async () => {},
      },
    })
    expect(result.status).toBe("written")
    const second = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: "D:/project/raw/sources/第一批企业名单.xlsx",
      mode: "observe",
      deps: {
        extractPayload: async (sourcePath) => payload(sourcePath),
        load: async () => existing,
        findExistingForSource: async () => existing ? [{ path: "old.sidecar.json", sidecar: existing }] : [],
        persist: async () => {
          throw new Error("should not persist fresh sidecar")
        },
        persistAudit: async () => {},
      },
    })
    expect(second.status).toBe("fresh")
  })

  it("rewrites stale sidecars discovered by source id when hash changed", async () => {
    const old = payload("D:/project/raw/sources/第一批企业名单.xlsx", "e".repeat(64))
    const oldSidecar = (await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: old.path,
      mode: "observe",
      deps: {
        extractPayload: async () => old,
        load: async () => null,
        findExistingForSource: async () => [],
        persist: async () => {
          return "old.sidecar.json"
        },
        persistAudit: async () => {},
      },
    }))
    expect(oldSidecar.status).toBe("written")
    const persisted: SourceSidecar[] = []
    const result = await ensureXlsxSourceSidecarFresh({
      projectPath: "D:/project",
      sourcePath: old.path,
      mode: "observe",
      deps: {
        extractPayload: async (sourcePath) => payload(sourcePath, "f".repeat(64)),
        load: async () => null,
        findExistingForSource: async () => "sidecar" in oldSidecar ? [{ path: "old.sidecar.json", sidecar: oldSidecar.sidecar }] : [],
        persist: async (_projectPath, sidecar) => {
          persisted.push(sidecar)
          return "new.sidecar.json"
        },
        persistAudit: async () => {},
      },
    })
    expect(result.status).toBe("stale-rewritten")
    expect(persisted[0]?.source.content_hash).toBe("f".repeat(64))
  })

})
