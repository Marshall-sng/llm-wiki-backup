import type { FormatProfileProbe } from "@/commands/fs"
import type { FormatDiagnosticSeverity, FormatProfileConfidence, FormatProfileDiagnostic, FormatProfileFileType, FormatProfileRecord } from "@/lib/format-profile-types"

export type StyleFactConfidence = FormatProfileConfidence | "unknown"
export type StyleFactUnit = "pt" | "twip" | "cm" | "halfPoint" | "emu" | "rgb"

export interface StyleFact<T = unknown> {
  value: T
  unit?: StyleFactUnit
  confidence: StyleFactConfidence
  evidenceRefs: string[]
  derived?: boolean
  notes?: string[]
}

export interface StyleFactEvidence {
  id: string
  kind: string
  pointer: string
  confidence: StyleFactConfidence
  sha256: string
  description?: string
  value?: unknown
}

export interface StyleFactsEnvelope {
  schemaVersion: "format-profile-style-facts.v0"
  source: {
    fileType: FormatProfileFileType
    sourceName: string
    sourcePath?: string
  }
  parser: {
    deterministic: true
    authority: "deterministic-parser"
    evidenceAuthority: "parser-generated"
  }
  capabilities: {
    canGuideGeneration: true
    canGuideAdaptation: true
    canGuideExport: false
    highFidelityScope: string
    llmMayInterpret: true
    llmMayCreateFacts: false
  }
  styleFacts: Record<string, unknown>
  evidence: StyleFactEvidence[]
  diagnostics: FormatProfileDiagnostic[]
  metadata: {
    styleFactsSha256: string
    builtAt: number
  }
}

interface BuildStyleFactsInput {
  fileType: FormatProfileFileType
  sourceName: string
  sourcePath?: string
  probe?: FormatProfileProbe | null
  now?: number
}

type UnknownRecord = Record<string, unknown>

const schemaVersion = "format-profile-style-facts.v0" as const
const highFidelityScope = "fixture-backed deterministic parser fidelity for covered style fields; not visual/export reproduction"

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : undefined
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

function getCount(record: UnknownRecord | undefined, key: string): number {
  return asNumber(record?.[key]) ?? 0
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function sortStable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortStable)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as UnknownRecord).sort().map((key) => [key, sortStable((value as UnknownRecord)[key])]))
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortStable(value))
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

export function sha256Text(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const bitLength = bytes.length * 8
  const withOne = bytes.length + 1
  const paddedLength = Math.ceil((withOne + 8) / 64) * 64
  const data = new Uint8Array(paddedLength)
  data.set(bytes)
  data[bytes.length] = 0x80
  const view = new DataView(data.buffer)
  const high = Math.floor(bitLength / 0x100000000)
  const low = bitLength >>> 0
  view.setUint32(paddedLength - 8, high)
  view.setUint32(paddedLength - 4, low)

  const w = new Uint32Array(64)
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7]
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
  return Array.from(h).map((item) => item.toString(16).padStart(8, "0")).join("")
}

export function sha256Stable(value: unknown): string {
  return sha256Text(stableStringify(value))
}

function createCatalog(fileType: FormatProfileFileType) {
  const evidence: StyleFactEvidence[] = []
  const add = (suffix: string, kind: string, pointer: string, value: unknown, confidence: StyleFactConfidence, description?: string) => {
    const item: StyleFactEvidence = {
      id: `style.${fileType}.${suffix}`,
      kind,
      pointer,
      confidence,
      value: clone(value),
      description,
      sha256: sha256Stable({ kind, pointer, value }),
    }
    evidence.push(item)
    return item.id
  }
  return { evidence, add }
}

function fact<T>(value: T, evidenceRefs: string[], options: { confidence?: StyleFactConfidence; unit?: StyleFactUnit; derived?: boolean; notes?: string[] } = {}): StyleFact<T> {
  if (evidenceRefs.length === 0) throw new Error("StyleFact requires evidenceRefs")
  return {
    value: clone(value),
    confidence: options.confidence ?? "medium",
    evidenceRefs,
    ...(options.unit ? { unit: options.unit } : {}),
    ...(options.derived ? { derived: true } : {}),
    ...(options.notes?.length ? { notes: options.notes } : {}),
  }
}

function halfPointUsageToPt(usage: unknown): { value: number; count?: number }[] {
  return asArray(usage).map((entry) => {
    const record = asRecord(entry)
    const raw = record ? record.value : entry
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    const count = asNumber(record?.count)
    return count === undefined ? { value: parsed / 2 } : { value: parsed / 2, count }
  }).filter((item): item is { value: number; count?: number } => Boolean(item))
}

function twipsToCm(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Number((parsed * 2.54 / 1440).toFixed(2))
}

function tableStatsTotals(sheetStats: unknown[], key: string): number {
  return sheetStats.reduce<number>((sum, item) => sum + getCount(asRecord(item), key), 0)
}

function stripSlideTextSample(item: unknown): unknown {
  const record = asRecord(item)
  if (!record) return item
  const { textSample: _textSample, ...rest } = record
  return rest
}

function buildDocxFacts(probe: FormatProfileProbe, catalog: ReturnType<typeof createCatalog>) {
  const structure = asRecord(probe.structure) ?? {}
  const style = asRecord(probe.style) ?? {}
  const confidence: StyleFactConfidence = style ? "high" : "low"
  const page = asRecord(style.page) ?? {}
  const counts = { paragraphs: structure.paragraphs, runs: structure.runs, tables: structure.tables }
  const evPage = catalog.add("layout.0001", "openxml-docx-page", "probe.style.page", page, confidence)
  const evFonts = catalog.add("fontUsage.0001", "openxml-docx-fonts", "probe.style.fonts/fontUsage", { fonts: style.fonts, fontUsage: style.fontUsage }, confidence)
  const evSizes = catalog.add("fontSize.0001", "openxml-docx-font-sizes", "probe.style.fontSizeUsageHalfPoints", style.fontSizeUsageHalfPoints ?? [], confidence)
  const evStyles = catalog.add("styleDef.0001", "openxml-docx-style-definitions", "probe.style.styles", { styleCount: style.styleCount, styleIds: style.styleIds, styles: style.styles }, confidence)
  const evParagraphStyles = catalog.add("paragraphStyleUsage.0001", "openxml-docx-paragraph-style-usage", "probe.structure.paragraphStyleUsage", structure.paragraphStyleUsage ?? [], confidence)
  const evCounts = catalog.add("structureCounts.0001", "openxml-docx-structure-counts", "probe.structure.counts", counts, confidence)
  const evNumbering = catalog.add("numbering.0001", "openxml-docx-numbering", "probe.style.numberingDefinitions", style.numberingDefinitions ?? 0, confidence)
  const pageSizeTwips = { widthTwips: page.widthTwips, heightTwips: page.heightTwips, orientation: page.orientation ?? null }
  const pageSizeCm = { widthCm: twipsToCm(page.widthTwips), heightCm: twipsToCm(page.heightTwips) }
  return {
    layout: {
      pageSizeTwips: fact(pageSizeTwips, [evPage], { unit: "twip", confidence }),
      pageSizeCm: fact(pageSizeCm, [evPage], { unit: "cm", confidence, derived: true, notes: ["Converted deterministically from twips."] }),
      marginsTwips: fact(asRecord(page.marginsTwips) ?? {}, [evPage], { unit: "twip", confidence }),
    },
    typography: {
      fonts: fact(asArray(style.fonts), [evFonts, evStyles], { confidence }),
      fontUsage: fact(asArray(style.fontUsage), [evFonts], { confidence }),
      fontSizeUsageHalfPoints: fact(asArray(style.fontSizeUsageHalfPoints), [evSizes], { unit: "halfPoint", confidence }),
      fontSizeUsagePt: fact(halfPointUsageToPt(style.fontSizeUsageHalfPoints), [evSizes], { unit: "pt", confidence, derived: true }),
    },
    styles: {
      styleCount: fact(getCount(style, "styleCount"), [evStyles], { confidence }),
      styleIds: fact(asArray(style.styleIds), [evStyles], { confidence }),
      definitions: fact(asArray(style.styles), [evStyles], { confidence }),
      paragraphStyleUsage: fact(asArray(structure.paragraphStyleUsage), [evParagraphStyles], { confidence }),
    },
    structure: {
      counts: fact(counts, [evCounts], { confidence }),
      numberingDefinitions: fact(getCount(style, "numberingDefinitions"), [evNumbering], { confidence }),
    },
  }
}

function buildXlsxFacts(probe: FormatProfileProbe, catalog: ReturnType<typeof createCatalog>) {
  const structure = asRecord(probe.structure) ?? {}
  const style = asRecord(probe.style) ?? {}
  const confidence: StyleFactConfidence = "high"
  const sheetStats = asArray(structure.sheetStats)
  const evSheets = catalog.add("sheets.0001", "openxml-xlsx-sheets", "probe.structure.sheets", { sheetCount: structure.sheetCount, sheets: structure.sheets }, confidence)
  const evSheetStats = catalog.add("sheetStats.0001", "openxml-xlsx-sheet-stats", "probe.structure.sheetStats", sheetStats, confidence)
  const evStyles = catalog.add("styleCounts.0001", "openxml-xlsx-style-counts", "probe.style", style, confidence)
  return {
    workbook: {
      sheetCount: fact(getCount(structure, "sheetCount"), [evSheets], { confidence }),
      sheets: fact(asArray(structure.sheets), [evSheets], { confidence }),
    },
    layout: {
      sheetStats: fact(sheetStats, [evSheetStats], { confidence }),
      dimensions: fact(sheetStats.map((item) => {
        const record = asRecord(item) ?? {}
        return { path: record.path, dimension: record.dimension, rowCount: record.rowCount, cellCount: record.cellCount }
      }), [evSheetStats], { confidence, derived: true }),
    },
    styles: {
      cellStyleCount: fact(getCount(style, "cellStyleCount"), [evStyles], { confidence }),
      fontCount: fact(getCount(style, "fontCount"), [evStyles], { confidence }),
      fillCount: fact(getCount(style, "fillCount"), [evStyles], { confidence }),
      borderCount: fact(getCount(style, "borderCount"), [evStyles], { confidence }),
      sharedStringCount: fact(getCount(style, "sharedStringCount"), [evStyles], { confidence }),
    },
    formulasAndMerges: {
      mergedCellCount: fact(tableStatsTotals(sheetStats, "mergedCellCount"), [evSheetStats], { confidence, derived: true }),
      formulaCount: fact(tableStatsTotals(sheetStats, "formulaCount"), [evSheetStats], { confidence, derived: true }),
    },
  }
}

function buildPptxFacts(probe: FormatProfileProbe, catalog: ReturnType<typeof createCatalog>) {
  const structure = asRecord(probe.structure) ?? {}
  const style = asRecord(probe.style) ?? {}
  const confidence: StyleFactConfidence = "medium"
  const safeSlideStats = asArray(structure.slideStats).slice(0, 12).map(stripSlideTextSample)
  const evDeck = catalog.add("deck.0001", "openxml-pptx-deck-counts", "probe.structure", { slideCount: structure.slideCount, layoutCount: structure.layoutCount, masterCount: structure.masterCount }, confidence)
  const evSlideStats = catalog.add("slideStats.0001", "openxml-pptx-slide-stats", "probe.structure.slideStats.noTextSample", safeSlideStats, confidence)
  const evTheme = catalog.add("theme.0001", "openxml-pptx-theme", "probe.style", style, confidence)
  return {
    deck: {
      slideCount: fact(getCount(structure, "slideCount"), [evDeck], { confidence }),
      layoutCount: fact(getCount(structure, "layoutCount"), [evDeck], { confidence }),
      masterCount: fact(getCount(structure, "masterCount"), [evDeck], { confidence }),
    },
    layout: {
      slideStatsSample: fact(safeSlideStats, [evSlideStats], { confidence, notes: ["Text samples are excluded from StyleFacts in Phase A."] }),
    },
    theme: {
      themeCount: fact(getCount(style, "themeCount"), [evTheme], { confidence }),
      themeName: fact(asString(style.themeName) ?? null, [evTheme], { confidence }),
      colorSchemeCount: fact(getCount(style, "colorSchemeCount"), [evTheme], { confidence }),
      fontSchemeCount: fact(getCount(style, "fontSchemeCount"), [evTheme], { confidence }),
    },
  }
}

function buildPdfFacts(probe: FormatProfileProbe, catalog: ReturnType<typeof createCatalog>) {
  const structure = asRecord(probe.structure) ?? {}
  const style = asRecord(probe.style) ?? {}
  const confidence: StyleFactConfidence = structure.scanLikely === true ? "low" : "medium"
  const evPage = catalog.add("page.0001", "pdf-byte-probe-page-text-image-counts", "probe.structure", structure, confidence)
  const evFonts = catalog.add("fontRefs.0001", "pdf-byte-probe-font-refs", "probe.style.fontRefs", style.fontRefs ?? [], confidence)
  return {
    layout: {
      pageCount: fact(getCount(structure, "pageCount"), [evPage], { confidence }),
    },
    typography: {
      fontRefs: fact(asArray(style.fontRefs), [evFonts], { confidence, notes: ["PDF font refs are diagnostic resource names, not authoring fonts."] }),
    },
    diagnostics: {
      textOperatorCount: fact(getCount(structure, "textOperatorCount"), [evPage], { confidence }),
      imageCount: fact(getCount(structure, "imageCount"), [evPage], { confidence }),
      hasTextLayerHint: fact(structure.hasTextLayerHint === true, [evPage], { confidence }),
      scanLikely: fact(structure.scanLikely === true, [evPage], { confidence }),
    },
  }
}

function buildUnavailableFacts(_fileType: FormatProfileFileType, catalog: ReturnType<typeof createCatalog>, reason: string) {
  const ev = catalog.add("availability.0001", "probe-availability", "probe", { available: false, reason }, "low")
  return {
    availability: {
      hasDeterministicProbe: fact(false, [ev], { confidence: "low", notes: [reason] }),
    },
  }
}

function diagnosticsFor(fileType: FormatProfileFileType, probe?: FormatProfileProbe | null): FormatProfileDiagnostic[] {
  const diagnostics: FormatProfileDiagnostic[] = [{
    id: "stylefacts-boundary",
    severity: "info",
    message: "当前为确定性样式事实，用于底稿约束；不代表导出复刻或视觉还原。",
  }]
  if (!probe) diagnostics.push({ id: "stylefacts-no-probe", severity: "warning", message: "未获得确定性探测结果，样式事实降级为弱证据。" })
  if (fileType === "pptx") diagnostics.push({ id: "stylefacts-pptx-baseline", severity: "info", message: "PPTX 当前为主题和版式诊断线索，不承诺生成 PPTX 文件。" })
  if (fileType === "pdf") diagnostics.push({ id: "stylefacts-pdf-baseline", severity: "info", message: "PDF 当前为低/中置信成品参考，不承诺高保真还原。" })
  return diagnostics
}

export function buildStyleFactsFromProbe(input: BuildStyleFactsInput): StyleFactsEnvelope {
  const catalog = createCatalog(input.fileType)
  const probe = input.probe ?? null
  let styleFacts: Record<string, unknown>
  if (!probe) styleFacts = buildUnavailableFacts(input.fileType, catalog, "probe unavailable")
  else if (input.fileType === "docx") styleFacts = buildDocxFacts(probe, catalog)
  else if (input.fileType === "xlsx") styleFacts = buildXlsxFacts(probe, catalog)
  else if (input.fileType === "pptx") styleFacts = buildPptxFacts(probe, catalog)
  else if (input.fileType === "pdf") styleFacts = buildPdfFacts(probe, catalog)
  else styleFacts = buildUnavailableFacts(input.fileType, catalog, "unsupported file type")

  const deterministic = {
    schemaVersion,
    source: {
      fileType: input.fileType,
      sourceName: input.sourceName,
      ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
    },
    parser: {
      deterministic: true as const,
      authority: "deterministic-parser" as const,
      evidenceAuthority: "parser-generated" as const,
    },
    capabilities: {
      canGuideGeneration: true as const,
      canGuideAdaptation: true as const,
      canGuideExport: false as const,
      highFidelityScope,
      llmMayInterpret: true as const,
      llmMayCreateFacts: false as const,
    },
    styleFacts,
    evidence: catalog.evidence,
    diagnostics: diagnosticsFor(input.fileType, probe),
  }
  return {
    ...deterministic,
    metadata: {
      styleFactsSha256: sha256Stable(deterministic),
      builtAt: input.now ?? Date.now(),
    },
  }
}

function factAt<T>(styleFacts: StyleFactsEnvelope | undefined, path: string): StyleFact<T> | undefined {
  const value = path.split(".").reduce<unknown>((cursor, key) => asRecord(cursor)?.[key], styleFacts?.styleFacts)
  return asRecord(value)?.evidenceRefs ? value as StyleFact<T> : undefined
}

function listText(value: unknown, limit = 8): string[] {
  return asArray(value).map((item) => {
    if (typeof item === "string") return item
    const record = asRecord(item)
    const label = asString(record?.value) ?? asString(record?.name) ?? asString(record?.styleId) ?? asString(record?.dimension)
    const count = asNumber(record?.count)
    return label ? (count ? `${label}(${count})` : label) : ""
  }).filter(Boolean).slice(0, limit)
}

export function styleSummaryForHumans(styleFacts?: StyleFactsEnvelope, fileType?: FormatProfileFileType, limit = 8): string[] {
  if (!styleFacts) return ["未提取到确定性样式事实；保留旧版格式画像摘要。"]
  const type = fileType ?? styleFacts.source.fileType
  const summary: string[] = []
  if (type === "docx") {
    const fontList = factAt<unknown[]>(styleFacts, "typography.fonts")?.value
    const fonts = factAt<unknown[]>(styleFacts, "typography.fontUsage")?.value ?? fontList
    const sizes = factAt<{ value: number; count?: number }[]>(styleFacts, "typography.fontSizeUsagePt")?.value
    const page = factAt<{ widthCm?: number; heightCm?: number }>(styleFacts, "layout.pageSizeCm")?.value
    const styleCount = factAt<number>(styleFacts, "styles.styleCount")?.value
    const paraStyles = factAt<unknown[]>(styleFacts, "styles.paragraphStyleUsage")?.value
    if (listText(fontList).length) summary.push(`字体线索：${listText(fontList).join("、")}`)
    if (listText(fonts).length) summary.push(`字体使用：${listText(fonts).join("、")}`)
    if (sizes?.length) summary.push(`字号线索：${sizes.slice(0, 8).map((item) => `${item.value}pt${item.count ? `(${item.count})` : ""}`).join("、")}`)
    if (page?.widthCm && page?.heightCm) summary.push(`页面线索：约 ${page.widthCm}cm × ${page.heightCm}cm`)
    if (typeof styleCount === "number") summary.push(`样式定义：${styleCount} 个`)
    if (listText(paraStyles).length) summary.push(`段落样式使用：${listText(paraStyles).join("、")}`)
  } else if (type === "xlsx") {
    const sheetCount = factAt<number>(styleFacts, "workbook.sheetCount")?.value
    const dimensions = factAt<unknown[]>(styleFacts, "layout.dimensions")?.value
    const fontCount = factAt<number>(styleFacts, "styles.fontCount")?.value
    const fillCount = factAt<number>(styleFacts, "styles.fillCount")?.value
    const borderCount = factAt<number>(styleFacts, "styles.borderCount")?.value
    const formulaCount = factAt<number>(styleFacts, "formulasAndMerges.formulaCount")?.value
    const mergedCellCount = factAt<number>(styleFacts, "formulasAndMerges.mergedCellCount")?.value
    summary.push(`工作簿结构：工作表 ${sheetCount ?? 0} 个${listText(dimensions, 3).length ? `，区域 ${listText(dimensions, 3).join("、")}` : ""}`)
    summary.push(`单元格样式：字体 ${fontCount ?? 0}；填充 ${fillCount ?? 0}；边框 ${borderCount ?? 0}。`)
    summary.push(`表格复杂度：合并单元格 ${mergedCellCount ?? 0}；公式 ${formulaCount ?? 0}。`)
  } else if (type === "pptx") {
    const slideCount = factAt<number>(styleFacts, "deck.slideCount")?.value
    const layoutCount = factAt<number>(styleFacts, "deck.layoutCount")?.value
    const masterCount = factAt<number>(styleFacts, "deck.masterCount")?.value
    const themeName = factAt<string | null>(styleFacts, "theme.themeName")?.value
    const colorSchemeCount = factAt<number>(styleFacts, "theme.colorSchemeCount")?.value
    const fontSchemeCount = factAt<number>(styleFacts, "theme.fontSchemeCount")?.value
    summary.push(`演示结构：幻灯片 ${slideCount ?? 0}，版式 ${layoutCount ?? 0}，母版 ${masterCount ?? 0}。`)
    summary.push(`主题线索：${themeName ?? "未命名主题"}；配色方案 ${colorSchemeCount ?? 0}；字体方案 ${fontSchemeCount ?? 0}。`)
    summary.push("边界：PPTX 线索用于汇报大纲和逐页内容，不承诺生成 PPTX 文件。")
  } else if (type === "pdf") {
    const pageCount = factAt<number>(styleFacts, "layout.pageCount")?.value
    const imageCount = factAt<number>(styleFacts, "diagnostics.imageCount")?.value
    const scanLikely = factAt<boolean>(styleFacts, "diagnostics.scanLikely")?.value
    const fontRefs = factAt<unknown[]>(styleFacts, "typography.fontRefs")?.value
    summary.push(`PDF 页面线索：${pageCount ?? 0} 页；图片 ${imageCount ?? 0}；扫描风险 ${scanLikely ? "较高" : "未明显触发"}。`)
    if (listText(fontRefs, 6).length) summary.push(`PDF 字体引用：${listText(fontRefs, 6).join("、")}`)
    summary.push("边界：PDF 仅作为低/中置信成品参考，不承诺还原版式。")
  } else {
    summary.push("当前格式不支持稳定样式事实，仅保留弱诊断。")
  }
  summary.push("边界：确定性样式事实仅用于底稿约束，不代表导出复刻。")
  return summary.slice(0, limit)
}

export function deriveStyleProfileFromStyleFacts(styleFacts: StyleFactsEnvelope, fileType: FormatProfileFileType): FormatProfileRecord["styleProfile"] {
  const typography: Record<string, unknown> = {}
  const layout: Record<string, unknown> = {}
  const colors: Record<string, unknown> = {}
  const formatSpecific: Record<string, unknown> = {}
  if (fileType === "docx") {
    typography.fonts = factAt(styleFacts, "typography.fonts")?.value
    typography.fontUsage = factAt(styleFacts, "typography.fontUsage")?.value
    typography.fontSizeUsageHalfPoints = factAt(styleFacts, "typography.fontSizeUsageHalfPoints")?.value
    typography.fontSizeUsagePt = factAt(styleFacts, "typography.fontSizeUsagePt")?.value
    typography.styles = factAt(styleFacts, "styles.definitions")?.value
    layout.page = factAt(styleFacts, "layout.pageSizeTwips")?.value
    layout.pageSizeCm = factAt(styleFacts, "layout.pageSizeCm")?.value
    formatSpecific.numberingDefinitions = factAt(styleFacts, "structure.numberingDefinitions")?.value
  } else if (fileType === "xlsx") {
    layout.sheets = factAt(styleFacts, "workbook.sheets")?.value
    layout.sheetStats = factAt(styleFacts, "layout.sheetStats")?.value
    formatSpecific.cellStyleCount = factAt(styleFacts, "styles.cellStyleCount")?.value
    formatSpecific.fontCount = factAt(styleFacts, "styles.fontCount")?.value
    formatSpecific.fillCount = factAt(styleFacts, "styles.fillCount")?.value
    formatSpecific.borderCount = factAt(styleFacts, "styles.borderCount")?.value
    formatSpecific.sharedStringCount = factAt(styleFacts, "styles.sharedStringCount")?.value
  } else if (fileType === "pptx") {
    layout.slideCount = factAt(styleFacts, "deck.slideCount")?.value
    layout.layoutCount = factAt(styleFacts, "deck.layoutCount")?.value
    layout.masterCount = factAt(styleFacts, "deck.masterCount")?.value
    colors.colorSchemeCount = factAt(styleFacts, "theme.colorSchemeCount")?.value
    typography.fontSchemeCount = factAt(styleFacts, "theme.fontSchemeCount")?.value
    formatSpecific.themeName = factAt(styleFacts, "theme.themeName")?.value
    formatSpecific.themeCount = factAt(styleFacts, "theme.themeCount")?.value
  } else if (fileType === "pdf") {
    layout.pageCount = factAt(styleFacts, "layout.pageCount")?.value
    typography.fontRefs = factAt(styleFacts, "typography.fontRefs")?.value
    formatSpecific.scanLikely = factAt(styleFacts, "diagnostics.scanLikely")?.value
  }
  return {
    toneHints: fileType === "docx" ? ["正式", "结构化", "面向成稿"] : ["参考型", "需降级说明"],
    layoutHints: [`来源格式：${fileType.toUpperCase()}`],
    confidence: styleFacts.evidence.some((item) => item.confidence === "high") ? "high" : (fileType === "pdf" ? "medium" : "low"),
    typography,
    layout,
    colors,
    formatSpecific,
    evidenceSummary: styleSummaryForHumans(styleFacts, fileType),
  }
}

export function styleFactsDiagnostics(styleFacts?: StyleFactsEnvelope): FormatProfileDiagnostic[] {
  return styleFacts?.diagnostics.map((item) => ({ ...item })) ?? []
}

export function styleFactsBoundaryDiagnostic(styleFacts?: StyleFactsEnvelope): FormatProfileDiagnostic | null {
  if (!styleFacts) return null
  return {
    id: "stylefacts-not-llm-refined",
    severity: "info" as FormatDiagnosticSeverity,
    message: "当前为确定性样式事实，未进行智能精炼。",
  }
}
