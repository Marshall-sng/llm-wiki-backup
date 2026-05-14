import { describe, expect, it, vi } from "vitest"
import { buildFormatProfileFromExtractedText, buildFormatProfileSnapshot } from "@/lib/format-profile"
import {
  buildEvidenceOnlyOverlayInput,
  buildSemanticOverlayKey,
  completeSemanticOverlay,
  createRunningSemanticOverlay,
  deriveSemanticOverlayStatus,
  expireInterruptedRunningOverlay,
  parseAndEvaluateSemanticOverlay,
  semanticOverlaySummaryLines,
} from "./format-profile-semantic-overlay"
import type { FormatProfileProbe } from "@/commands/fs"
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

function makeProfile() {
  const probe: FormatProfileProbe = {
    kind: "office_zip",
    officeKind: "docx",
    structure: {
      paragraphs: 2,
      runs: 4,
      tables: 0,
      paragraphSamples: [{ text: "SECRET_PARAGRAPH_SAMPLE", index: 0 }],
      headingCandidates: [{ text: "第一章 总则", outlineLevel: "0" }],
    },
    style: {
      styleCount: 1,
      styles: [{ styleId: "Normal", name: "Normal" }],
      fonts: ["FangSong"],
      fontUsage: [{ value: "FangSong", count: 2 }],
      fontSizeUsageHalfPoints: [{ value: "21", count: 2 }],
      page: { widthTwips: "11905", heightTwips: "16834" },
    },
  }
  return buildFormatProfileFromExtractedText({
    sourcePath: "D:/fixtures/policy.docx",
    extractedText: "SECRET_TEXT_SAMPLE\n第一章 总则\n正文内容用于画像。",
    probe,
    now: 10,
  })
}

function validOverlay(evidenceRef: string) {
  return JSON.stringify({
    schemaVersion: "format-profile-llm-overlay.v1",
    language: "zh",
    documentKind: {
      id: "doc-kind",
      kind: "document-kind",
      text: "该文件像正式制度类文稿，应保持条款化表达。",
      confidence: "high",
      evidenceRefs: [evidenceRef],
    },
    structureInterpretation: [{
      id: "structure-1",
      kind: "structure",
      text: "结构以章节和条款推进，适合生成分层底稿。",
      confidence: "medium",
      evidenceRefs: [evidenceRef],
    }],
    styleInterpretation: [{
      id: "style-1",
      kind: "style",
      text: "字体和字号证据支持正式文稿的稳健排版参考。",
      confidence: "medium",
      evidenceRefs: [evidenceRef],
    }],
    generationGuidance: [{
      id: "guide-1",
      kind: "generation-guidance",
      text: "生成时优先使用章节、条款和简洁约束语句。",
      confidence: "medium",
      evidenceRefs: [evidenceRef],
    }],
    warnings: [],
    uncertainty: ["仅作为底稿约束参考。"],
  })
}

describe("format-profile semantic overlay", () => {
  it("builds an evidence-only allowlisted input without raw text or sample-bearing blobs", () => {
    const profile = makeProfile()
    const input = buildEvidenceOnlyOverlayInput(profile)
    const payload = JSON.stringify(input)

    expect(input.dataScope).toBe("evidence-only")
    expect(payload).toContain(profile.styleFacts?.metadata.styleFactsSha256)
    expect(payload).not.toContain("SECRET_TEXT_SAMPLE")
    expect(payload).not.toContain("SECRET_PARAGRAPH_SAMPLE")
    expect(payload).not.toContain("paragraphSamples")
    expect(payload).not.toContain("textSample")
    expect(payload).not.toContain("fulltext")
    expect(payload).not.toContain("snippets")
    expect(input.evidenceCatalog[0]).toHaveProperty("valueDigest")
  })

  it("accepts only evidence-cited closed-schema overlays", () => {
    const profile = makeProfile()
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const accepted = parseAndEvaluateSemanticOverlay(validOverlay(evidenceRef), new Set([evidenceRef]))

    expect(accepted.output?.schemaVersion).toBe("format-profile-llm-overlay.v1")
    expect(accepted.report.status).toBe("accepted")
    expect(accepted.report.evidenceRefCoverage).toBe(1)

    const unknown = parseAndEvaluateSemanticOverlay(validOverlay("missing.ref"), new Set([evidenceRef]))
    expect(unknown.output).toBeNull()
    expect(unknown.report.status).toBe("rejected")
    expect(unknown.report.violations.some((item) => item.code === "unknown-evidence-ref")).toBe(true)

    const overwrite = parseAndEvaluateSemanticOverlay(JSON.stringify({
      ...JSON.parse(validOverlay(evidenceRef)),
      styleFactsPatch: { typography: { fonts: ["Invented"] } },
    }), new Set([evidenceRef]))
    expect(overwrite.report.violations.some((item) => item.code === "unknown-field" || item.code === "fact-creation-attempt")).toBe(true)
  })

  it("accepts evidence-cited format rule synthesis and rejects unknown rule evidence", () => {
    const profile = makeProfile()
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const withRules = {
      ...JSON.parse(validOverlay(evidenceRef)),
      formatRuleSynthesis: [{
        id: "docx-body-rule",
        target: "paragraph",
        normType: "spacing",
        rule: "正文段落使用稳定缩进、对齐和行距。",
        detail: "该规则由样式事实归纳而来，只约束底稿排版，不承诺导出复刻。",
        source: "llm-inferred",
        confidence: "medium",
        evidenceRefs: [evidenceRef],
        attributes: [
          { name: "indent", value: "首行缩进", evidenceRefs: [evidenceRef] },
          { name: "lineSpacing", value: "稳定行距" },
        ],
      }],
    }

    const accepted = parseAndEvaluateSemanticOverlay(JSON.stringify(withRules), new Set([evidenceRef]))
    expect(accepted.report.status).toBe("accepted")
    expect(accepted.output?.formatRuleSynthesis).toHaveLength(1)
    expect(accepted.output?.formatRuleSynthesis[0].attributes?.[1].evidenceRefs).toEqual([evidenceRef])
    const inferredAlias = parseAndEvaluateSemanticOverlay(JSON.stringify({
      ...withRules,
      formatRuleSynthesis: [{ ...withRules.formatRuleSynthesis[0], source: "inferred" }],
    }), new Set([evidenceRef]))
    expect(inferredAlias.report.status).toBe("accepted")
    expect(inferredAlias.output?.formatRuleSynthesis[0].source).toBe("llm-inferred")

    const missingSource = parseAndEvaluateSemanticOverlay(JSON.stringify({
      ...withRules,
      formatRuleSynthesis: [{ ...withRules.formatRuleSynthesis[0], source: undefined }],
    }), new Set([evidenceRef]))
    expect(missingSource.report.status).toBe("accepted")
    expect(missingSource.output?.formatRuleSynthesis[0].source).toBe("llm-inferred")
    expect(missingSource.report.warnings.some((item) => item.includes("Defaulted format rule source"))).toBe(true)

    const invalidSource = parseAndEvaluateSemanticOverlay(JSON.stringify({
      ...withRules,
      formatRuleSynthesis: [{ ...withRules.formatRuleSynthesis[0], source: "parser" }],
    }), new Set([evidenceRef]))
    expect(invalidSource.report.status).toBe("accepted")
    expect(invalidSource.output?.formatRuleSynthesis[0].source).toBe("llm-inferred")
    expect(invalidSource.report.warnings.some((item) => item.includes('received "parser"'))).toBe(true)

    const rejected = parseAndEvaluateSemanticOverlay(JSON.stringify({
      ...withRules,
      formatRuleSynthesis: [{ ...withRules.formatRuleSynthesis[0], evidenceRefs: ["missing.evidence"] }],
    }), new Set([evidenceRef]))
    expect(rejected.output).toBeNull()
    expect(rejected.report.violations.some((item) => item.code === "unknown-evidence-ref")).toBe(true)
  })

  it("stores accepted overlay separately and derives stale/fallback states", () => {
    const profile = makeProfile()
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const running = createRunningSemanticOverlay(profile, config, 1000, 20)
    const completed = completeSemanticOverlay(
      running,
      { status: "completed", text: validOverlay(evidenceRef), providerId: "custom", modelId: "mock-model", elapsedMs: 1 },
      new Set([evidenceRef]),
      21,
    )
    const acceptedProfile = { ...profile, semanticOverlay: completed }

    expect(completed.status).toBe("accepted")
    expect(acceptedProfile.styleFacts?.metadata.styleFactsSha256).toBe(profile.styleFacts?.metadata.styleFactsSha256)
    expect(deriveSemanticOverlayStatus(acceptedProfile, true)).toBe("accepted")
    expect(semanticOverlaySummaryLines(acceptedProfile).join("\n")).toContain("正式制度类文稿")
    expect(buildFormatProfileSnapshot(acceptedProfile).semanticStatus).toBe("accepted")

    const stale = { ...acceptedProfile, updatedAt: 999 }
    expect(deriveSemanticOverlayStatus(stale, true)).toBe("stale")
  })

  it("stores evaluator violations and model output preview for rejected overlays", () => {
    const profile = makeProfile()
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const running = createRunningSemanticOverlay(profile, config, 1000, 20)
    const unsafeOutput = JSON.stringify({
      ...JSON.parse(validOverlay(evidenceRef)),
      styleFactsPatch: { typography: { fonts: ["Invented"] } },
    })

    const completed = completeSemanticOverlay(
      running,
      { status: "completed", text: unsafeOutput, providerId: "custom", modelId: "mock-model", elapsedMs: 1 },
      new Set([evidenceRef]),
      21,
    )

    expect(completed.status).toBe("rejected")
    expect(completed.fallbackReason).toBe("schema-invalid")
    expect(completed.evaluatorReport?.violations.length).toBeGreaterThan(0)
    expect(completed.fallbackMessage).toContain("Evaluator violations")
    expect(completed.fallbackMessage).toContain("Model output preview")
    expect(completed.fallbackMessage).toContain("styleFactsPatch")
  })

  it("normalizes common model claim shape without inventing evidence", () => {
    const profile = makeProfile()
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const modelLikeOutput = JSON.stringify({
      schemaVersion: "format-profile-llm-overlay.v1",
      language: "zh",
      documentKind: "formal-document",
      structureInterpretation: [{ claim: "文档结构较完整，适合按章节组织底稿。", evidenceRefs: [evidenceRef] }],
      styleInterpretation: [{ claim: "字体线索显示正式文稿风格。", evidenceRefs: [evidenceRef] }],
      generationGuidance: [{ claim: "生成时保持条款化表达。", evidenceRefs: [evidenceRef] }],
      warnings: [{ claim: "不承诺高保真复刻。", evidenceRefs: [evidenceRef] }],
      uncertainty: [],
    })

    const evaluated = parseAndEvaluateSemanticOverlay(modelLikeOutput, new Set([evidenceRef]))

    expect(evaluated.report.status).toBe("accepted")
    expect(evaluated.output?.documentKind).toBeNull()
    expect(evaluated.output?.structureInterpretation[0]).toMatchObject({
      id: "structure-1",
      kind: "structure",
      text: "文档结构较完整，适合按章节组织底稿。",
      confidence: "medium",
      evidenceRefs: [evidenceRef],
    })
  })

  it("drops uncited guidance instead of rejecting cited interpretations", () => {
    const profile = makeProfile()
    const evidenceRef = profile.styleFacts!.evidence[0].id
    const mixedOutput = JSON.stringify({
      schemaVersion: "format-profile-llm-overlay.v1",
      language: "zh",
      documentKind: "formal-document",
      structureInterpretation: [{ claim: "文档结构较完整。", evidenceRefs: [evidenceRef] }],
      styleInterpretation: [{ claim: "字体线索支持正式文稿风格。", evidenceRefs: [evidenceRef] }],
      generationGuidance: [
        { claim: "生成时保持条款化表达。", evidenceRefs: [evidenceRef] },
        { claim: "避免口语化表达。" },
      ],
      warnings: [{ claim: "不承诺高保真复刻。" }],
      uncertainty: [],
    })

    const evaluated = parseAndEvaluateSemanticOverlay(mixedOutput, new Set([evidenceRef]))

    expect(evaluated.report.status).toBe("accepted")
    expect(evaluated.output?.generationGuidance).toHaveLength(1)
    expect(evaluated.output?.warnings).toHaveLength(0)
    expect(evaluated.report.rejectedClaimCount).toBe(2)
    expect(evaluated.report.warnings.join("\n")).toContain("Dropped uncited claim")
  })

  it("expires persisted running overlays on hydration", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123)
    const profile = makeProfile()
    const running = createRunningSemanticOverlay(profile, config, 1000, 20)
    const recovered = expireInterruptedRunningOverlay({ ...profile, semanticOverlay: running }, 30)

    expect(recovered.semanticOverlay?.status).toBe("failed")
    expect(recovered.semanticOverlay?.fallbackReason).toBe("interrupted")
    const audit = recovered.semanticOverlay?.auditTrail ?? []
    expect(audit[audit.length - 1]?.event).toBe("failed")
    vi.restoreAllMocks()
  })

  it("uses the explicit stale key components", () => {
    const profile = makeProfile()
    const key = buildSemanticOverlayKey(profile)
    expect(key).toEqual({
      profileId: profile.id,
      profileUpdatedAt: profile.updatedAt,
      profileSnapshotHash: `${profile.id}:${profile.updatedAt}:${profile.styleFacts?.metadata.styleFactsSha256}`,
      styleFactsSha256: profile.styleFacts?.metadata.styleFactsSha256,
    })
  })
})
