import { describe, expect, it } from "vitest"

import { containsForbiddenDocxExportLeakage } from "@/lib/docx-export-contract"
import { buildDocxIntermediateDocument } from "@/lib/docx-intermediate"
import { probeDocxPackage } from "@/lib/docx-package-probe"
import { renderDocxWithTsAdapter, DOCX_NPM_ADAPTER_ID } from "@/lib/docx-ts-adapter"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "@/test-helpers/docx-export-fixtures"

describe("docx ts adapter", () => {
  it("generates browser-safe DOCX bytes with stable adapter metadata", async () => {
    const draft = createDocxExportDraft()
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)

    expect(result.adapterResult.adapterId).toBe(DOCX_NPM_ADAPTER_ID)
    expect(result.bytes).toBeInstanceOf(Uint8Array)
    expect(result.bytes.byteLength).toBeGreaterThan(1000)
    expect(result.adapterResult.sizeBytes).toBe(result.bytes.byteLength)
    expect(result.adapterResult.outputPath).toBeUndefined()
    expect(result.adapterResult.knownWarnings).toEqual(expect.arrayContaining(["manual-word-openability-not-tested", "high-fidelity-style-replica-not-supported"]))
    expect(containsForbiddenDocxExportLeakage(result.adapterResult)).toBe(false)
  })

  it("produces bytes that satisfy product structural probes", async () => {
    const draft = createDocxExportDraft()
    const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot: createDocxFormatProfileSnapshot() })
    const result = await renderDocxWithTsAdapter(intermediate, draft.title)
    const probe = await probeDocxPackage(result.bytes)

    expect(probe.validationErrors).toEqual([])
    expect(probe.structuralAssertions.every((item) => item.passed)).toBe(true)
    expect(probe.packageParts).toEqual(expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]))
  })
})
