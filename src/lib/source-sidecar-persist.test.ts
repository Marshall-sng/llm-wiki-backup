import { describe, expect, it } from "vitest"
import { makeFirstBatchCompanyFixtureSidecar } from "@/test-helpers/first-batch-company-fixture"
import { safeSidecarFileName, serializeSourceSidecar, sourceSidecarDirectory, sourceSidecarPath } from "./source-sidecar-persist"

describe("source sidecar persistence helpers", () => {
  it("builds sidecar paths under .llm-wiki/sidecars", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    sidecar.source.content_hash = "abcdef0123456789abcdef0123456789"
    const path = sourceSidecarPath("D:/workspace/demo", sidecar)
    expect(sourceSidecarDirectory("D:/workspace/demo")).toBe("D:/workspace/demo/.llm-wiki/sidecars")
    expect(path).toBe("D:/workspace/demo/.llm-wiki/sidecars/第一批企业名单.xlsx.abcdef0123456789.sidecar.json")
  })

  it("sanitizes unsafe source names while preserving hash freshness", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    sidecar.source.title = "a/b:c?.xlsx"
    sidecar.source.content_hash = "0123456789abcdef9999"
    expect(safeSidecarFileName(sidecar)).toBe("b-c-.xlsx.0123456789abcdef.sidecar.json")
  })

  it("serializes deterministic JSON with trailing newline", () => {
    const sidecar = makeFirstBatchCompanyFixtureSidecar()
    const serialized = serializeSourceSidecar(sidecar)
    expect(serialized.endsWith("\n")).toBe(true)
    expect(JSON.parse(serialized).schema_version).toBe("source-sidecar/v1")
  })
})
