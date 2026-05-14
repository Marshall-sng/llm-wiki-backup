import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildFormatProfileFromExtractedText } from "@/lib/format-profile"
import { buildFormatSpec, buildFormatSpecAuditView, buildFormatSpecSnapshot, renderFormatSpecPromptBlock } from "@/lib/format-spec"
import { completeSemanticOverlay, createRunningSemanticOverlay } from "@/lib/format-profile-semantic-overlay"
import type { FormatProfileRecord } from "@/lib/format-profile-types"
import type { LlmConfig } from "@/stores/wiki-store"

const config: LlmConfig = {
  provider: "custom",
  apiKey: "",
  model: "mock-model",
  ollamaUrl: "http://localhost:11434",
  customEndpoint: "http://localhost:1234/v1/chat/completions",
  maxContextSize: 10000,
  apiMode: "chat_completions",
}

function profileFor(fileType: "docx" | "xlsx" | "pptx" | "pdf"): FormatProfileRecord {
  if (fileType === "docx") {
    return buildFormatProfileFromExtractedText({
      sourcePath: "/project/source-secret.docx",
      now: 11,
      extractedText: "第一章 不应泄露的来源章节\n第一条 来源条款正文不应进入约束".repeat(20),
      probe: {
        kind: "office_zip",
        officeKind: "docx",
        structure: { paragraphs: 2, runs: 2, tables: 0, headingCandidates: [{ text: "第一章 不应泄露的来源章节", outlineLevel: "0", styleId: "Heading1" }] },
        style: { styleCount: 2, fonts: ["FangSong"], fontUsage: [{ value: "FangSong", count: 5 }], fontSizeUsageHalfPoints: [{ value: "31", count: 5 }], page: { widthTwips: "11905", heightTwips: "16834" } },
      },
    })
  }
  if (fileType === "xlsx") {
    return buildFormatProfileFromExtractedText({
      sourcePath: "/project/secret-workbook.xlsx",
      now: 12,
      extractedText: "秘密表格正文".repeat(30),
      probe: {
        kind: "office_zip",
        officeKind: "xlsx",
        structure: { sheetCount: 1, sheets: [{ name: "秘密工作表" }], sheetStats: [{ path: "xl/worksheets/sheet1.xml", dimension: "A1:C3", rowCount: 3, cellCount: 9, formulaCount: 1 }] },
        style: { cellStyleCount: 2, fontCount: 1, fillCount: 1, borderCount: 1, sharedStringCount: 3 },
      },
    })
  }
  if (fileType === "pptx") {
    return buildFormatProfileFromExtractedText({
      sourcePath: "/project/secret-deck.pptx",
      now: 13,
      extractedText: "秘密演示正文".repeat(30),
      probe: {
        kind: "office_zip",
        officeKind: "pptx",
        structure: { slideCount: 1, layoutCount: 1, masterCount: 1, slideStats: [{ path: "ppt/slides/slide1.xml", textSample: ["秘密页标题"], textCount: 1 }] },
        style: { themeCount: 1, themeName: "Office Theme", colorSchemeCount: 1, fontSchemeCount: 1 },
      },
    })
  }
  return buildFormatProfileFromExtractedText({
    sourcePath: "/project/secret.pdf",
    now: 14,
    extractedText: "秘密PDF正文".repeat(30),
    probe: { kind: "pdf", structure: { pageCount: 2, textOperatorCount: 10, imageCount: 1, hasTextLayerHint: true, scanLikely: false }, style: { fontRefs: ["ABCDEE+SimSun"] } },
  })
}

describe("format-spec", () => {
  it.each([
    ["docx", "正式文稿", "heading"],
    ["xlsx", "工作簿/指标口径", "table-region"],
    ["pptx", "汇报页序", "content-slide"],
    ["pdf", "扫描风险", "scan-risk"],
  ] as const)("renders bounded %s rules without raw source content", (fileType, expectedSummary, expectedTarget) => {
    const profile = profileFor(fileType)
    const spec = buildFormatSpec(profile)
    const promptBlock = renderFormatSpecPromptBlock(spec)

    expect(spec.schemaVersion).toBe("format-spec.v0")
    expect(spec.rendererVersion).toBe("format-spec-renderer.v0")
    expect(spec.policyVersion).toBe("evidence-only-no-source-text.v0")
    expect(spec.contentLeakagePolicy).toEqual({
      includeSourceBodyText: false,
      includeRawEvidenceDump: false,
      promptMayIncludeEvidenceIds: false,
    })
    expect(spec.summaryLines.join("\n")).toContain(expectedSummary)
    expect(spec.rules.map((item) => item.target)).toContain(expectedTarget)
    expect(promptBlock).toContain("格式约束（FormatSpec）")
    expect(promptBlock).toContain("必守边界")
    expect(promptBlock).toContain("不承诺视觉还原")
    expect(promptBlock).not.toContain("StyleFacts：")
    expect(promptBlock).not.toContain("画像生成约束")
    expect(promptBlock).not.toContain("不应泄露")
    expect(promptBlock).not.toContain("秘密工作表")
    expect(promptBlock).not.toContain("秘密页标题")
    expect(promptBlock).not.toContain("秘密PDF正文")
  })

  it("separates source profile hash from renderer hash", () => {
    const profile = profileFor("docx")
    const snapshot = buildFormatSpecSnapshot(profile)

    expect(snapshot.sourceProfileHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.formatSpecHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.sourceProfileHash).not.toBe(snapshot.formatSpecHash)
    expect(snapshot.formatSpec.sourceFileType).toBe("docx")
    expect(snapshot.formatSpec.documentIntent).toBe("formal-document")
    expect(snapshot.formatSpec.confidence).toBe(profile.confidence)
    expect(snapshot.formatSpec.contentLeakagePolicy.includeSourceBodyText).toBe(false)
    expect(snapshot.formatSpec.boundaries.length).toBeGreaterThan(0)
    expect(snapshot.formatSpec.rules.length).toBeGreaterThan(0)
    expect(snapshot.formatSpec.promptBlock).toContain("格式约束（FormatSpec）")
  })

  it("builds a structured audit view without parsing prompt text", () => {
    const profile = profileFor("xlsx")
    const snapshot = buildFormatSpecSnapshot(profile)
    const audit = buildFormatSpecAuditView(snapshot.formatSpec, {
      sourceProfileHash: snapshot.sourceProfileHash,
      formatSpecHash: snapshot.formatSpecHash,
      legacyGenerationInstruction: "legacy",
    })

    expect(audit.sourceFileType).toBe("xlsx")
    expect(audit.formatSpecHash).toBe(snapshot.formatSpecHash)
    expect(audit.sourceProfileHash).toBe(snapshot.sourceProfileHash)
    expect(audit.legacyGenerationInstructionPresent).toBe(true)
    expect(audit.rulesByTarget.map((group) => group.target)).toContain("table-region")
    expect(audit.promptBlock).toBe(snapshot.formatSpec.promptBlock)
    expect(JSON.stringify(audit)).not.toContain("rawEvidence")
    expect(JSON.stringify(audit)).not.toContain("styleFacts\":")
  })

  it("uses user-edited FormatSpec prompt block when override matches the current auto hash", () => {
    const profile = profileFor("docx")
    const autoSnapshot = buildFormatSpecSnapshot(profile)
    const editedPrompt = `${autoSnapshot.formatSpec.promptBlock}\n\n### 用户编辑\n- 正文段落必须保留用户确认的缩进说明。`
    const withEdit: FormatProfileRecord = {
      ...profile,
      editableFormatSpec: {
        schemaVersion: "editable-format-constraints.v0",
        sourceFormatSpecHash: autoSnapshot.formatSpecHash,
        promptBlock: editedPrompt,
        updatedAt: 22,
        editedBy: "user",
      },
    }

    const editedSnapshot = buildFormatSpecSnapshot(withEdit)

    expect(editedSnapshot.formatSpec.promptBlock).toBe(editedPrompt)
    expect(editedSnapshot.formatSpecHash).not.toBe(autoSnapshot.formatSpecHash)
    expect(editedSnapshot.formatSpec.summaryLines.join("\n")).toContain("用户已编辑格式约束")
  })

  it("ignores stale user-edited FormatSpec overrides when the auto hash no longer matches", () => {
    const profile = profileFor("docx")
    const autoSnapshot = buildFormatSpecSnapshot(profile)
    const withStaleEdit: FormatProfileRecord = {
      ...profile,
      editableFormatSpec: {
        schemaVersion: "editable-format-constraints.v0",
        sourceFormatSpecHash: "stale",
        promptBlock: "stale edited prompt",
        updatedAt: 22,
        editedBy: "user",
      },
    }

    const staleSnapshot = buildFormatSpecSnapshot(withStaleEdit)

    expect(staleSnapshot.formatSpec.promptBlock).toBe(autoSnapshot.formatSpec.promptBlock)
    expect(staleSnapshot.formatSpecHash).toBe(autoSnapshot.formatSpecHash)
  })

  it("uses accepted LLM synthesized format rules before deterministic fallback rules", () => {
    const profile = profileFor("docx")
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const running = createRunningSemanticOverlay(profile, config, 1000, 20)
    const overlay = {
      schemaVersion: "format-profile-llm-overlay.v1",
      language: "zh",
      documentKind: null,
      structureInterpretation: [],
      styleInterpretation: [],
      generationGuidance: [],
      formatRuleSynthesis: [{
        id: "llm-rule-body",
        target: "paragraph",
        normType: "spacing",
        rule: "LLM 归纳正文段落规则",
        detail: "正文段落需要显式缩进、对齐和行距属性。",
        source: "llm-inferred",
        confidence: "medium",
        evidenceRefs: [evidenceRef],
        attributes: [
          { name: "indent", value: "first-line", evidenceRefs: [evidenceRef] },
          { name: "alignment", value: "justified", evidenceRefs: [evidenceRef] },
          { name: "lineSpacing", value: "stable", evidenceRefs: [evidenceRef] },
        ],
      }],
      warnings: [],
      uncertainty: [],
    }
    const completed = completeSemanticOverlay(
      running,
      { status: "completed", text: JSON.stringify(overlay), providerId: "custom", modelId: "mock-model", elapsedMs: 1 },
      new Set([evidenceRef]),
      21,
    )
    const spec = buildFormatSpec({ ...profile, semanticOverlay: completed })
    const promptBlock = renderFormatSpecPromptBlock(spec)

    expect(completed.status).toBe("accepted")
    expect(spec.rules).toHaveLength(1)
    expect(spec.rules[0]).toMatchObject({ id: "llm-rule-body", target: "paragraph", normType: "spacing", source: "inferred" })
    expect(spec.rules[0].attributes?.map((item) => item.name)).toEqual(["indent", "alignment", "lineSpacing"])
    expect(promptBlock).toContain("LLM 归纳正文段落规则")
    expect(promptBlock).toContain("indent: first-line")
  })

  it("keeps legacy snapshots without structured audit fields from crashing", () => {
    const audit = buildFormatSpecAuditView({
      schemaVersion: "format-spec.v0",
      rendererVersion: "format-spec-renderer.v0",
      policyVersion: "evidence-only-no-source-text.v0",
      promptBlock: "legacy prompt block",
      summaryLines: ["legacy summary"],
    } as never)

    expect(audit.sourceFileType).toBe("unknown")
    expect(audit.documentIntent).toBe("unknown-reference")
    expect(audit.confidence).toBe("low")
    expect(audit.contentLeakagePolicy.includeSourceBodyText).toBe(false)
    expect(audit.summaryLines).toEqual(["legacy summary"])
    expect(audit.boundaries).toEqual([])
    expect(audit.rulesByTarget).toEqual([])
    expect(audit.promptBlock).toBe("legacy prompt block")
  })

  it("keeps format-profile and draft-processing free of store imports", () => {
    const formatProfileSource = readFileSync("src/lib/format-profile.ts", "utf8")
    const draftProcessingSource = readFileSync("src/lib/draft-processing.ts", "utf8")

    expect(formatProfileSource).not.toMatch(/from\s+["']@\/stores\//)
    expect(draftProcessingSource).not.toMatch(/from\s+["']@\/stores\//)
  })
})
