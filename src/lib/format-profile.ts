import type { FormatProfileProbe } from "@/commands/fs"
import { buildStyleFactsFromProbe, deriveStyleProfileFromStyleFacts, styleFactsBoundaryDiagnostic, styleFactsDiagnostics, styleSummaryForHumans, type StyleFactsEnvelope } from "@/lib/style-facts"
import { deriveSemanticOverlayStatus, getAcceptedSemanticOverlay, semanticOverlaySummaryLines } from "@/lib/format-profile-semantic-overlay"
import { buildFormatSpecSnapshot } from "@/lib/format-spec"
import type { DraftProcessingFormatProfileSnapshot, FormatDiagnosticSeverity, FormatProfileConfidence, FormatProfileDiagnostic, FormatProfileFileType, FormatProfileRecord, FormatProfileSection } from "@/lib/format-profile-types"

export type { DraftProcessingFormatProfileSnapshot, FormatDiagnosticSeverity, FormatProfileConfidence, FormatProfileDiagnostic, FormatProfileFileType, FormatProfileRecord, FormatProfileSection } from "@/lib/format-profile-types"

export interface BuildFormatProfileInput {
  sourcePath: string
  extractedText: string
  probe?: FormatProfileProbe | null
  probeError?: string | null
  now?: number
}

const supportedTypes = new Set<FormatProfileFileType>(["docx", "xlsx", "pptx", "pdf"])

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

export function inferFormatFileType(path: string): FormatProfileFileType {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return supportedTypes.has(ext as FormatProfileFileType) ? ext as FormatProfileFileType : "unknown"
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "")
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim()
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function getCount(record: Record<string, unknown> | undefined, key: string): number {
  return asNumber(record?.[key]) ?? 0
}

function topValueText(value: unknown, limit = 8): string[] {
  return asArray(value).map((item) => {
    if (typeof item === "string") return item
    const record = asRecord(item)
    const label = asString(record?.value)
    const count = asNumber(record?.count)
    return label ? (count ? `${label}(${count})` : label) : ""
  }).filter(Boolean).slice(0, limit)
}

function extractSectionsFromText(text: string): FormatProfileSection[] {
  const sections: FormatProfileSection[] = []
  const seen = new Set<string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine)
    if (!line || line.length > 80) continue

    const markdown = line.match(/^(#{1,6})\s+(.+)$/)
    const numbered = line.match(/^((?:第?[一二三四五六七八九十百千万]+[章节、.．])|(?:\d+(?:\.\d+){0,3}[、.．\s]))\s*(.+)$/)
    const looksLikeShortTitle = /^[^。！？!?；;]{4,36}$/.test(line) && /背景|目标|现状|问题|方案|措施|计划|风险|结论|摘要|目录|概述|分析|建议|附录/.test(line)

    const title = markdown?.[2] ?? numbered?.[2] ?? (looksLikeShortTitle ? line : "")
    if (!title) continue
    const normalizedTitle = title.toLowerCase()
    if (seen.has(normalizedTitle)) continue
    seen.add(normalizedTitle)
    sections.push({
      title,
      level: markdown ? markdown[1].length : undefined,
      evidence: markdown ? "markdown-heading" : numbered ? "numbered-line" : "short-line",
    })
    if (sections.length >= 16) break
  }
  return sections
}

function extractSectionsFromProbe(fileType: FormatProfileFileType, probe?: FormatProfileProbe | null): FormatProfileSection[] {
  const structure = asRecord(probe?.structure)
  if (!structure) return []

  if (fileType === "docx") {
    return asArray(structure.headingCandidates).map((item): FormatProfileSection | null => {
      const record = asRecord(item)
      const title = asString(record?.text)
      if (!title) return null
      const levelRaw = record?.outlineLevel
      const level = typeof levelRaw === "string" && /^\d+$/.test(levelRaw) ? Number(levelRaw) + 1 : undefined
      return { title, level, evidence: "probe-heading" }
    }).filter((item): item is FormatProfileSection => Boolean(item)).slice(0, 16)
  }

  if (fileType === "xlsx") {
    return asArray(structure.sheets).map((item, index): FormatProfileSection => {
      const record = asRecord(item)
      const title = asString(record?.name) ?? `Sheet ${index + 1}`
      return { title, evidence: "worksheet" }
    }).slice(0, 16)
  }

  if (fileType === "pptx") {
    return asArray(structure.slideStats).map((item, index): FormatProfileSection => {
      const record = asRecord(item)
      const sample = topValueText(record?.textSample, 1)[0]
      return { title: sample ? `第 ${index + 1} 页：${sample}` : `第 ${index + 1} 页`, evidence: "slide" }
    }).slice(0, 16)
  }

  if (fileType === "pdf" && getCount(structure, "pageCount") > 0) {
    return [{ title: `${getCount(structure, "pageCount")} 页成品参考`, evidence: "page" }]
  }

  return []
}

function mergeSections(probeSections: FormatProfileSection[], textSections: FormatProfileSection[]): FormatProfileSection[] {
  const seen = new Set<string>()
  const merged: FormatProfileSection[] = []
  for (const section of [...probeSections, ...textSections]) {
    const key = section.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(section)
    if (merged.length >= 16) break
  }
  return merged
}

function inferSectionPattern(fileType: FormatProfileFileType, sections: FormatProfileSection[], probe?: FormatProfileProbe | null): string {
  const probePattern = asString(asRecord(probe?.structure)?.sectionPattern)
  if (probePattern) return probePattern
  if (sections.length === 0) return "not-detected"
  if (fileType === "xlsx") return "workbook-sheets"
  if (fileType === "pptx") return "slide-deck"
  if (fileType === "pdf") return "page-reference"
  if (sections.some((section) => section.evidence === "markdown-heading")) return "markdown-or-converted-headings"
  if (sections.some((section) => section.evidence === "numbered-line" || section.evidence === "probe-heading")) return "numbered-or-style-sections"
  return "implicit-short-title-sections"
}

function inferDocumentKind(fileType: FormatProfileFileType): string {
  switch (fileType) {
    case "docx":
      return "formal-document"
    case "xlsx":
      return "spreadsheet-reference"
    case "pptx":
      return "presentation-reference"
    case "pdf":
      return "finished-document-reference"
    default:
      return "unknown-reference"
  }
}

function hasProbeEvidence(probe?: FormatProfileProbe | null): boolean {
  return Boolean(probe?.structure || probe?.style)
}

function hasStyleEvidence(fileType: FormatProfileFileType, probe?: FormatProfileProbe | null): boolean {
  const style = asRecord(probe?.style)
  if (!style) return false
  if (fileType === "docx") {
    return topValueText(style.fonts).length > 0 || topValueText(style.fontUsage).length > 0 || topValueText(style.fontSizeUsageHalfPoints).length > 0 || getCount(style, "styleCount") > 0
  }
  if (fileType === "xlsx") return getCount(style, "cellStyleCount") > 0 || getCount(style, "fontCount") > 0
  if (fileType === "pptx") return getCount(style, "themeCount") > 0 || Boolean(asString(style.themeName))
  if (fileType === "pdf") return topValueText(style.fontRefs).length > 0
  return false
}

function confidenceFor(fileType: FormatProfileFileType, text: string, sections: FormatProfileSection[], probe?: FormatProfileProbe | null): FormatProfileConfidence {
  if (fileType === "unknown") return "low"
  if (fileType === "pdf") {
    const structure = asRecord(probe?.structure)
    if (structure && (structure.hasTextLayerHint === true || topValueText(asRecord(probe?.style)?.fontRefs).length > 0)) return "medium"
    return text.trim().length >= 160 ? "medium" : "low"
  }
  if (hasProbeEvidence(probe) && hasStyleEvidence(fileType, probe) && sections.length >= 1) return fileType === "docx" ? "high" : "medium"
  if (text.trim().length >= 600 && sections.length >= 3) return "high"
  if (hasProbeEvidence(probe) || text.trim().length >= 160 || sections.length >= 1) return "medium"
  return "low"
}

function buildDiagnostics(fileType: FormatProfileFileType, text: string, sections: FormatProfileSection[], probe?: FormatProfileProbe | null, probeError?: string | null): FormatProfileDiagnostic[] {
  const diagnostics: FormatProfileDiagnostic[] = []
  const structure = asRecord(probe?.structure)
  const style = asRecord(probe?.style)

  if (fileType === "unknown") {
    diagnostics.push({
      id: "unsupported-format",
      severity: "warning",
      message: "文件扩展名不在当前产品化范围内。",
      recommendation: "优先使用 DOCX / XLSX / PPTX / PDF 成品文件生成格式画像。",
    })
  }
  if (probeError) {
    diagnostics.push({
      id: "probe-failed",
      severity: "warning",
      message: "未能完成成品文件结构/样式探测，已降级使用可提取文本。",
      recommendation: probeError,
    })
  }
  if (text.trim().length < 160 && !hasProbeEvidence(probe)) {
    diagnostics.push({
      id: "weak-text-evidence",
      severity: "warning",
      message: "可提取文本较少，格式画像置信度会降低。",
      recommendation: "如果是扫描 PDF 或图片型文件，请换用含文本层的成品文件。",
    })
  }
  if (sections.length === 0) {
    diagnostics.push({
      id: "no-sections-detected",
      severity: "info",
      message: "未识别到稳定章节结构。",
      recommendation: "底稿加工仍可使用该画像，但应把它视为弱格式参考。",
    })
  }
  if (fileType === "docx" && probe && !hasStyleEvidence(fileType, probe)) {
    diagnostics.push({
      id: "docx-style-evidence-missing",
      severity: "warning",
      message: "DOCX 未提取到稳定字体、字号或样式定义。",
      recommendation: "该文件可能样式定义稀疏；生成时只使用结构约束，不承诺样式复刻。",
    })
  }
  if (fileType === "docx" && structure) {
    diagnostics.push({
      id: "docx-probe-completed",
      severity: "info",
      message: `已完成 DOCX 探测：段落 ${getCount(structure, "paragraphs")}、候选标题 ${asArray(structure.headingCandidates).length}、表格 ${getCount(structure, "tables")}、样式 ${getCount(style, "styleCount")}。`,
    })
  }
  if (fileType === "pdf") {
    diagnostics.push({
      id: "pdf-low-fidelity-boundary",
      severity: "info",
      message: "PDF 当前仅作为成品参考和诊断来源，不承诺高保真还原。",
    })
    if (structure?.scanLikely === true) {
      diagnostics.push({
        id: "pdf-scan-likely",
        severity: "warning",
        message: "该 PDF 可能是扫描/图片密集文件，文本层和字体证据不足。",
        recommendation: "优先换用 DOCX 或含文本层的 PDF。",
      })
    }
  }
  if (fileType === "xlsx") {
    diagnostics.push({
      id: "xlsx-positioning",
      severity: "info",
      message: "XLSX 画像用于表格结构、指标口径和分析底稿参考，不强行转成长文模板。",
    })
  }
  if (fileType === "pptx") {
    diagnostics.push({
      id: "pptx-positioning",
      severity: "info",
      message: "PPTX 画像用于汇报结构和逐页内容底稿参考，不承诺直接生成 PPTX 文件。",
    })
  }
  return diagnostics
}

function buildStructureEvidence(fileType: FormatProfileFileType, text: string, sections: FormatProfileSection[], probe?: FormatProfileProbe | null): string[] {
  const structure = asRecord(probe?.structure)
  const evidence = [
    `从成品文件提取 ${text.trim().length} 个文本字符。`,
    `识别到 ${sections.length} 个结构线索。`,
  ]
  if (fileType === "docx" && structure) evidence.push(`DOCX XML 证据：段落 ${getCount(structure, "paragraphs")}、表格 ${getCount(structure, "tables")}、候选标题 ${asArray(structure.headingCandidates).length}。`)
  if (fileType === "xlsx" && structure) evidence.push(`XLSX 工作簿证据：工作表 ${getCount(structure, "sheetCount")} 个。`)
  if (fileType === "pptx" && structure) evidence.push(`PPTX 演示证据：幻灯片 ${getCount(structure, "slideCount")}、版式 ${getCount(structure, "layoutCount")}、母版 ${getCount(structure, "masterCount")}。`)
  if (fileType === "pdf" && structure) evidence.push(`PDF 字节证据：页数 ${getCount(structure, "pageCount")}、文本操作符 ${getCount(structure, "textOperatorCount")}、图片 ${getCount(structure, "imageCount")}。`)
  return evidence
}

function buildStyleProfile(fileType: FormatProfileFileType, styleFacts: StyleFactsEnvelope): FormatProfileRecord["styleProfile"] {
  return deriveStyleProfileFromStyleFacts(styleFacts, fileType)
}


function buildFormatSpecificProfile(fileType: FormatProfileFileType, probe?: FormatProfileProbe | null): Record<string, unknown> {
  const structure = asRecord(probe?.structure)
  if (!structure) return {}
  if (fileType === "docx") {
    return {
      paragraphs: structure.paragraphs,
      runs: structure.runs,
      tables: structure.tables,
      headingStyleRefs: structure.headingStyleRefs,
      paragraphStyleUsage: structure.paragraphStyleUsage,
      numberingUsage: structure.numberingUsage,
      paragraphSamples: structure.paragraphSamples,
    }
  }
  if (fileType === "xlsx") return { sheets: structure.sheets, sheetStats: structure.sheetStats }
  if (fileType === "pptx") return { slideStats: structure.slideStats, slideCount: structure.slideCount, layoutCount: structure.layoutCount, masterCount: structure.masterCount }
  if (fileType === "pdf") return { ...structure }
  return {}
}

function constraintsFor(fileType: FormatProfileFileType, sections: FormatProfileSection[], styleEvidence: string[]): string[] {
  const base = [
    "保留来源事实边界，不根据格式画像虚构内容。",
    "格式画像只约束结构、表达和诊断，不代表正式导出样式。",
  ]
  if (sections.length > 0) {
    base.push(`优先参考这些结构线索：${sections.slice(0, 8).map((section) => section.title).join("、")}。`)
  }
  if (styleEvidence.length > 0) {
    base.push(`参考这些样式/版式线索：${styleEvidence.slice(0, 5).join("；")}。`)
  }
  switch (fileType) {
    case "docx":
      base.push("按正式文稿/方案/报告的层级结构组织底稿；可参考字体、字号、编号和页边距线索，但不承诺导出复刻。")
      break
    case "xlsx":
      base.push("将表格线索转译为指标、口径、观察和结论，不直接伪造电子表格。")
      break
    case "pptx":
      base.push("将页面线索转译为汇报大纲、每页主题和讲述要点。")
      break
    case "pdf":
      base.push("把 PDF 作为低保真成品参考；遇到证据不足时明确说明。")
      break
  }
  return base
}

export function buildGenerationInstruction(profile: Pick<FormatProfileRecord, "id" | "updatedAt" | "title" | "fileType" | "confidence" | "documentKind" | "structureProfile" | "styleProfile" | "styleFacts" | "semanticOverlay" | "writingProfile" | "diagnostics">): string {
  const sections = profile.structureProfile.sections.slice(0, 10).map((section, index) => `${index + 1}. ${section.title}`).join("\n") || "未识别稳定章节。"
  const styleSummary = profile.styleFacts
    ? styleSummaryForHumans(profile.styleFacts, profile.fileType, 8)
    : profile.styleProfile.evidenceSummary?.slice(0, 8) ?? []
  const semanticStatus = profile.styleFacts ? deriveSemanticOverlayStatus(profile as FormatProfileRecord, false) : "not-configured"
  const semanticOverlay = getAcceptedSemanticOverlay(profile as FormatProfileRecord)
  const semanticSummary = semanticOverlaySummaryLines(profile as FormatProfileRecord, 8)
  const styleEvidence = styleSummary.map((item) => `- ${item}`).join("\n") || "- 未提取稳定样式证据。"
  const styleFactsMarker = profile.styleFacts
    ? `StyleFacts：${profile.styleFacts.schemaVersion} / ${profile.styleFacts.metadata.styleFactsSha256.slice(0, 12)} / evidence-only / ${semanticStatus}`
    : "StyleFacts：legacy-profile / unavailable"
  const semanticBlock = semanticOverlay && semanticSummary.length > 0
    ? ["", "### 智能解释（证据绑定）", ...semanticSummary.map((item) => `- ${item}`)]
    : []
  const diagnostics = profile.diagnostics.map((item) => `- [${item.severity}] ${item.message}`).join("\n") || "- 暂无诊断提醒。"
  const constraints = profile.writingProfile.constraints.map((item) => `- ${item}`).join("\n")
  return [
    "## 格式画像约束",
    `画像：${profile.title}`,
    `文件类型：${profile.fileType.toUpperCase()}`,
    `文档定位：${profile.documentKind}`,
    `置信度：${profile.confidence}`,
    styleFactsMarker,
    "",
    "### 结构线索",
    sections,
    "",
    "### 样式/版式线索",
    styleEvidence,
    "- 边界：以上为确定性样式事实摘要，仅用于底稿约束，不代表导出复刻或视觉还原。",
    ...semanticBlock,
    "",
    "### 写作约束",
    constraints,
    "",
    "### 诊断边界",
    diagnostics,
  ].join("\n")
}


export function buildFormatProfileFromExtractedText(input: BuildFormatProfileInput): FormatProfileRecord {
  const now = input.now ?? Date.now()
  const sourceName = basename(input.sourcePath)
  const fileType = inferFormatFileType(input.sourcePath)
  const sections = mergeSections(extractSectionsFromProbe(fileType, input.probe), extractSectionsFromText(input.extractedText))
  const styleFacts = buildStyleFactsFromProbe({ fileType, sourceName, sourcePath: input.sourcePath, probe: input.probe, now })
  const styleProfile = buildStyleProfile(fileType, styleFacts)
  const confidence = confidenceFor(fileType, input.extractedText, sections, input.probe)
  const styleBoundary = styleFactsBoundaryDiagnostic(styleFacts)
  const diagnostics = [
    ...buildDiagnostics(fileType, input.extractedText, sections, input.probe, input.probeError),
    ...styleFactsDiagnostics(styleFacts),
    ...(styleBoundary ? [styleBoundary] : []),
  ]
  const constraints = constraintsFor(fileType, sections, styleProfile.evidenceSummary ?? [])
  const profile: FormatProfileRecord = {
    id: `format_profile_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: stripExtension(sourceName) || "未命名格式画像",
    sourceName,
    sourcePath: input.sourcePath,
    fileType,
    sourceKind: "finished-file",
    documentKind: inferDocumentKind(fileType),
    confidence,
    importedAt: now,
    updatedAt: now,
    structureProfile: {
      sectionPattern: inferSectionPattern(fileType, sections, input.probe),
      sections,
      evidenceSummary: buildStructureEvidence(fileType, input.extractedText, sections, input.probe),
      formatSpecific: buildFormatSpecificProfile(fileType, input.probe),
    },
    styleProfile,
    styleFacts,
    refinement: {
      semanticStatus: "not-configured",
      dataScope: "evidence-only",
    },
    writingProfile: {
      generationInstruction: "",
      constraints,
    },
    diagnostics,
    textSample: input.extractedText.trim().slice(0, 1200),
  }
  profile.writingProfile.generationInstruction = buildGenerationInstruction(profile)
  return profile
}

export function buildFormatProfileSnapshot(profile: FormatProfileRecord): DraftProcessingFormatProfileSnapshot {
  const styleFactsSummary = profile.styleFacts ? styleSummaryForHumans(profile.styleFacts, profile.fileType, 6) : undefined
  const styleFactsSha256 = profile.styleFacts?.metadata.styleFactsSha256
  const semanticStatus = profile.styleFacts ? deriveSemanticOverlayStatus(profile, false) : undefined
  const semanticOverlaySummary = semanticOverlaySummaryLines(profile, 6)
  const formatSpecSnapshot = buildFormatSpecSnapshot(profile)
  const legacyProfileSnapshotHash = `${profile.id}:${profile.updatedAt}:${styleFactsSha256 ?? "legacy"}`
  return {
    id: profile.id,
    title: profile.title,
    fileType: profile.fileType,
    confidence: profile.confidence,
    sourceProfileHash: formatSpecSnapshot.sourceProfileHash,
    formatSpecHash: formatSpecSnapshot.formatSpecHash,
    formatSpec: formatSpecSnapshot.formatSpec,
    profileSnapshotHash: legacyProfileSnapshotHash,
    generationInstruction: profile.writingProfile.generationInstruction,
    legacyGenerationInstruction: profile.writingProfile.generationInstruction,
    diagnostics: profile.diagnostics.map((item) => ({ ...item })),
    capturedAt: Date.now(),
    ...(styleFactsSha256 ? { styleFactsSha256 } : {}),
    ...(profile.styleFacts ? { styleFactsSchemaVersion: profile.styleFacts.schemaVersion } : {}),
    ...(styleFactsSummary ? { styleFactsSummary } : {}),
    ...(profile.styleFacts ? { dataScope: "evidence-only" as const, semanticStatus: semanticStatus ?? "not-configured" } : {}),
    ...(semanticOverlaySummary.length ? { semanticOverlaySummary } : {}),
  }
}


export function summarizeFormatDiagnostics(profile: FormatProfileRecord): Record<FormatDiagnosticSeverity, number> {
  return profile.diagnostics.reduce<Record<FormatDiagnosticSeverity, number>>((acc, item) => {
    acc[item.severity] += 1
    return acc
  }, { info: 0, warning: 0, error: 0 })
}

