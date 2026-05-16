import { getAcceptedSemanticOverlay, type OverlayFormatRule } from "@/lib/format-profile-semantic-overlay"
import { ensureDocxFormatSpecBaseline } from "@/lib/docx-formatspec-baseline"
import { buildDocxExecutableStyleFactsInput, buildDocxExecutableStyleRules } from "@/lib/docx-stylefacts-format-attributes"
import { sha256Stable } from "@/lib/style-facts"
import type {
  DraftProcessingFormatProfileSnapshot,
  FormatProfileConfidence,
  FormatProfileFileType,
  FormatProfileRecord,
  FormatSpecContentLeakagePolicy,
  FormatSpecRule,
  FormatSpecRuleSource,
  FormatSpecSnapshot,
} from "@/lib/format-profile-types"

export const FORMAT_SPEC_SCHEMA_VERSION = "format-spec.v0" as const
export const FORMAT_SPEC_RENDERER_VERSION = "format-spec-renderer.v0" as const
export const FORMAT_SPEC_POLICY_VERSION = "evidence-only-no-source-text.v0" as const

export type { FormatSpecContentLeakagePolicy, FormatSpecRule, FormatSpecRuleSource, FormatSpecSnapshot } from "@/lib/format-profile-types"

export interface FormatSpec {
  schemaVersion: typeof FORMAT_SPEC_SCHEMA_VERSION
  rendererVersion: typeof FORMAT_SPEC_RENDERER_VERSION
  policyVersion: typeof FORMAT_SPEC_POLICY_VERSION
  sourceFileType: FormatProfileFileType
  documentIntent: string
  confidence: FormatProfileConfidence
  contentLeakagePolicy: FormatSpecContentLeakagePolicy
  summaryLines: string[]
  boundaries: string[]
  rules: FormatSpecRule[]
}

function rule(id: string, target: string, ruleText: string, detail: string, source: FormatSpecRuleSource, confidence: FormatProfileConfidence): FormatSpecRule {
  return { id, target, rule: ruleText, detail, source, confidence }
}

function confidenceForOverlay(value: string): FormatProfileConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium"
}

function sourceForOverlay(value: OverlayFormatRule["source"]): FormatSpecRuleSource {
  if (value === "detected") return "detected"
  if (value === "standard-default") return "standard-default"
  return "inferred"
}

function overlayRuleToFormatSpec(ruleItem: OverlayFormatRule): FormatSpecRule {
  return {
    id: ruleItem.id,
    target: ruleItem.target,
    normType: ruleItem.normType,
    rule: ruleItem.rule,
    detail: ruleItem.detail,
    source: sourceForOverlay(ruleItem.source),
    confidence: confidenceForOverlay(ruleItem.confidence),
    evidenceRefs: [...ruleItem.evidenceRefs],
    attributes: (ruleItem.attributes ?? []).map((attribute) => ({
      name: attribute.name,
      value: attribute.value,
      ...(attribute.unit ? { unit: attribute.unit } : {}),
      ...(attribute.confidence ? { confidence: confidenceForOverlay(attribute.confidence) } : {}),
      evidenceRefs: [...(attribute.evidenceRefs ?? ruleItem.evidenceRefs)],
    })),
  }
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function listText(value: unknown, limit = 6): string[] {
  return asArray(value).map((item) => {
    if (typeof item === "string") return item
    const record = asRecord(item)
    const label = typeof record.value === "string"
      ? record.value
      : typeof record.name === "string"
        ? record.name
        : typeof record.dimension === "string"
          ? record.dimension
          : typeof record.styleId === "string"
            ? record.styleId
            : ""
    const count = asNumber(record.count)
    return label ? (count ? `${label}(${count})` : label) : ""
  }).filter(Boolean).slice(0, limit)
}

function summaryEvidence(profile: FormatProfileRecord, limit = 3): string {
  const summary = profile.styleProfile.evidenceSummary?.slice(0, limit).join("；")
  return summary || "未取得稳定样式摘要；按类型默认规则降级。"
}

function boundaries(): string[] {
  return [
    "进入底稿生成/修订场景后，只输出可保存为底稿的文档正文，不输出聊天式前后缀、解释或修改说明。",
    "来源事实优先于格式约束。",
    "不根据格式画像虚构事实、金额、条款、结论或引用。",
    "格式画像不得把来源格式文件的正文、条款或候选标题写入目标底稿。",
    "DOCX-first 阶段以可观测 DOCX 属性作为高保真收敛目标；无法确认的属性必须降级为默认规则或诊断。",
    "不承诺像素级匹配、Word/WPS 渲染完全等价、印章水印或精确分页。",
    "默认数据范围为 evidence-only，不注入来源正文、raw evidence、snippets 或 fulltext。",
  ]
}

function buildDocxRules(profile: FormatProfileRecord): FormatSpecRule[] {
  const hasStyleFacts = Boolean(profile.styleFacts)
  const typography = asRecord(profile.styleProfile.typography)
  const layout = asRecord(profile.styleProfile.layout)
  const page = asRecord(layout.pageSizeCm)
  const fonts = listText(typography.fontUsage).length ? listText(typography.fontUsage) : listText(typography.fonts)
  const sizes = listText(typography.fontSizeUsagePt)
  const paraStyles = listText(asRecord(profile.styleProfile.formatSpecific).paragraphStyleUsage)
  const pageDetail = page.widthCm && page.heightCm
    ? `检测页尺寸约 ${page.widthCm}cm × ${page.heightCm}cm；可观测页面属性进入 DOCX writer 规则。`
    : "页面尺寸、方向和边距证据不足时使用正式文稿基线并产生诊断。"
  const fontDetail = fonts.length || sizes.length
    ? `检测样式摘要：${[fonts.length ? `字体 ${fonts.join("、")}` : "", sizes.length ? `字号 ${sizes.join("、")}` : ""].filter(Boolean).join("；")}。`
    : summaryEvidence(profile)
  return [
    rule("docx-page-size", "page", "按正式文稿页面组织。", pageDetail, "detected", profile.confidence),
    rule("docx-page-boundary", "page", "页面线索不等于导出版式承诺。", "页边距、页眉页脚、印章、水印或精确分页均不得由画像自动补造。", "standard-default", "high"),
    rule("docx-title", "title", "主标题独立成行。", "标题由当前底稿事实决定，不复制来源画像题名。", "standard-default", "medium"),
    rule("docx-title-boundary", "title", "标题只表达文种和主题。", "来源文件题名、候选标题或条款原文不得直接进入目标底稿标题。", "standard-default", "high"),
    rule("docx-heading-1", "heading", "一级标题表达章节或大节。", "可采用章、节或“一、”式层级；标题应短，不承载完整正文。", "standard-default", "medium"),
    rule("docx-heading-2", "heading", "二级/三级标题保持同层同形。", "可采用“（一）”“1.”“（1）”等层级；不要混用编号体系。", "standard-default", "medium"),
    rule("docx-heading-3", "heading", "低层级标题用于具体事项。", "同一层级的符号、缩进和句式保持一致；长句应回落为正文条款。", "standard-default", "medium"),
    rule("docx-numbering", "numbering", "条款编号连续且层级清晰。", "长句、金额、范围和权限保留在正文条款内，不提升为格式标题。", "inferred", "high"),
    rule("docx-typography-font", "typography", "参考检测到的字体事实。", hasStyleFacts ? fontDetail : "样式事实不足时只保留正式文稿语气和层级规则。", hasStyleFacts ? "detected" : "inferred", profile.confidence),
    rule("docx-typography-boundary", "typography", "字体字号只约束正式程度和可读性。", "优先转为角色化 DOCX 属性；不得根据字体推断不存在的业务结论。", "standard-default", "high"),
    rule("docx-paragraph", "paragraph", "正文段落保持正式文稿段落规则。", "建议首行缩进、稳定行距、左对齐或两端对齐；不把正文压成来源清单。", "standard-default", "medium"),
    rule("docx-paragraph-style", "paragraph", "同类段落同形。", paraStyles.length ? `可参考段落样式使用线索：${paraStyles.join("、")}；但不复刻样式定义。` : "缺少段落样式使用证据时，保持标题、正文、表格说明三类段落清晰分离。", paraStyles.length ? "detected" : "standard-default", profile.confidence),
    rule("docx-table", "table", "表格承载清单、阈值、对照或审批矩阵。", "表格事实必须来自当前底稿或引用资料，不由格式画像补造。", "standard-default", "high"),
    rule("docx-table-readability", "table", "表内文字短语化、字段化。", "表头用于字段名，表格标题与正文条款层级分离；证据不足时不强制生成表格。", "standard-default", "medium"),
    rule("docx-boundary", "boundary", "格式只约束写法。", "不得把来源格式文件的正文、条款或候选标题写入目标底稿。", "standard-default", "high"),
  ]
}

function buildXlsxRules(profile: FormatProfileRecord): FormatSpecRule[] {
  const formatSpecific = asRecord(profile.styleProfile.formatSpecific)
  const sheetStats = asArray(asRecord(profile.styleProfile.layout).sheetStats)
  const dimensions = listText(sheetStats.map((item) => asRecord(item).dimension).filter(Boolean))
  const formulaCount = sheetStats.reduce<number>((sum, item) => sum + (asNumber(asRecord(item).formulaCount) ?? 0), 0)
  const styleCounts = [
    `单元格样式 ${formatSpecific.cellStyleCount ?? 0}`,
    `字体 ${formatSpecific.fontCount ?? 0}`,
    `填充 ${formatSpecific.fillCount ?? 0}`,
    `边框 ${formatSpecific.borderCount ?? 0}`,
  ].join("；")
  return [
    rule("xlsx-workbook", "workbook", "以工作簿/工作表为组织单元。", dimensions.length ? `检测表区域线索：${dimensions.join("、")}；生成表格说明、指标口径和观察结论。` : "生成表格说明、指标口径和观察结论，而不是伪造电子表格文件。", "detected", profile.confidence),
    rule("xlsx-sheet", "sheet", "工作表名只作为定位线索。", "不得根据工作表名推断不存在的业务主题。", "standard-default", "high"),
    rule("xlsx-region", "table-region", "区分标题区、表头、数据区和备注/合计区。", "证据不足时提示需确认，不擅自补齐行列结构。", "inferred", "medium"),
    rule("xlsx-header", "header", "表头短、字段化、同列口径一致。", "说明字段关系、单位和统计口径，不擅自改列名。", "standard-default", "medium"),
    rule("xlsx-data", "data-region", "数据区保持行列关系。", "不要把单元格事实打散为无序段落。", "standard-default", "high"),
    rule("xlsx-style", "style", "单元格样式统计只作复杂度线索。", `${styleCounts}；颜色、填充、边框不能自动解释为风险等级、状态或业务结论。`, "detected", profile.confidence),
    rule("xlsx-formula", "formula", "公式和合计保持事实边界。", `检测公式数量线索 ${formulaCount}；探测不到公式明细时只提示证据不足，不自动计算。`, "inferred", "high"),
    rule("xlsx-number", "number-format", "金额、比例、日期和数量必须保留单位。", "未知单位不得补造；数字格式服务可读性。", "standard-default", "high"),
    rule("xlsx-boundary", "boundary", "XLSX 画像只指导表格类底稿。", "不承诺生成或导出电子表格文件。", "standard-default", "high"),
  ]
}

function buildPptxRules(profile: FormatProfileRecord): FormatSpecRule[] {
  const layout = asRecord(profile.styleProfile.layout)
  const formatSpecific = asRecord(profile.styleProfile.formatSpecific)
  const colors = asRecord(profile.styleProfile.colors)
  const typography = asRecord(profile.styleProfile.typography)
  const deckDetail = `检测到幻灯片 ${layout.slideCount ?? 0}、版式 ${layout.layoutCount ?? 0}、母版 ${layout.masterCount ?? 0}；主题 ${formatSpecific.themeName ?? "未命名"}；配色方案 ${colors.colorSchemeCount ?? 0}；字体方案 ${typography.fontSchemeCount ?? 0}。`
  return [
    rule("pptx-deck", "deck", "以演示文稿页序组织内容。", `${deckDetail}输出汇报大纲或逐页草稿，不承诺生成 PPTX 文件。`, "detected", profile.confidence),
    rule("pptx-theme", "theme", "主题只作为视觉风格线索。", "不还原母版、动画、图片位置或模板占位符。", "detected", profile.confidence),
    rule("pptx-layout", "layout", "按封面、目录/过渡、内容、总结组织。", "无法稳定识别版式时输出逐页大纲。", "inferred", "medium"),
    rule("pptx-cover", "cover-slide", "封面只使用当前任务事实。", "不得复用来源模板示例人名、占位标题或演示文字。", "standard-default", "high"),
    rule("pptx-content", "content-slide", "每页聚焦一个主题。", "标题短句化；正文建议 3-5 个要点或一个图表说明。", "standard-default", "medium"),
    rule("pptx-bullet", "bullet", "bullet 并列、短句、同层同形。", "要点只重组用户事实，不补造数据或案例。", "standard-default", "high"),
    rule("pptx-density", "visual-density", "控制页面信息密度。", "长文应拆成页标题、核心观点、支撑事实和备注。", "standard-default", "medium"),
    rule("pptx-boundary", "boundary", "PPTX 画像用于汇报草稿。", "不承诺生成 PPTX、复刻主题、图片位置或母版。", "standard-default", "high"),
  ]
}

function buildPdfRules(profile: FormatProfileRecord): FormatSpecRule[] {
  const layout = asRecord(profile.styleProfile.layout)
  const formatSpecific = asRecord(profile.styleProfile.formatSpecific)
  const typography = asRecord(profile.styleProfile.typography)
  const fontRefs = listText(typography.fontRefs)
  return [
    rule("pdf-page", "page", "PDF 以页为参考单位。", `页数线索 ${layout.pageCount ?? 0}；可参考篇幅和页面密度，但不反推完整可编辑模板。`, "detected", profile.confidence),
    rule("pdf-text", "text-layer", "文本层线索决定可参考程度。", "文本层不足时只做低置信参考。", "detected", profile.confidence),
    rule("pdf-image", "image-density", "图片密度只作版面复杂度诊断。", "不补造图片内容、位置或图注。", "inferred", "medium"),
    rule("pdf-font", "font-ref", "字体引用不是可编辑字体承诺。", fontRefs.length ? `检测字体引用：${fontRefs.join("、")}；PDF 字体资源名只能作为诊断，不作为导出字体规则。` : "PDF 字体资源名只能作为诊断，不作为导出字体规则。", "detected", profile.confidence),
    rule("pdf-scan", "scan-risk", "扫描风险影响置信度。", `扫描风险：${formatSpecific.scanLikely ? "较高" : "未明显触发"}；扫描风险高时不得输出细排版规则。`, "detected", profile.confidence),
    rule("pdf-reference", "reference-use", "PDF 适合作为成品参考。", "可参考栏目密度、正式程度和图文比例。", "standard-default", "medium"),
    rule("pdf-boundary", "boundary", "PDF 画像不承诺视觉还原。", "不能承诺跨页布局、印章、水印、页眉页脚或装订效果。", "standard-default", "high"),
  ]
}

function rulesFor(profile: FormatProfileRecord): FormatSpecRule[] {
  if (profile.fileType === "docx") return buildDocxRules(profile)
  if (profile.fileType === "xlsx") return buildXlsxRules(profile)
  if (profile.fileType === "pptx") return buildPptxRules(profile)
  if (profile.fileType === "pdf") return buildPdfRules(profile)
  return [rule("unknown-boundary", "boundary", "未知格式只作弱参考。", "不承诺结构、样式、导出或视觉还原。", "standard-default", "low")]
}

function summaryLinesFor(profile: FormatProfileRecord): string[] {
  if (profile.fileType === "docx") return ["DOCX：按正式文稿规则组织标题、层级、编号、段落和表格。"]
  if (profile.fileType === "xlsx") return ["XLSX：按工作簿/指标口径组织表格说明、数据区和数字格式边界。"]
  if (profile.fileType === "pptx") return ["PPTX：按汇报页序组织封面、内容页、要点和页面密度。"]
  if (profile.fileType === "pdf") return ["PDF：仅作低/中置信成品参考，强调文本层、图片密度和扫描风险。"]
  return ["未知格式：仅作弱格式参考。"]
}

export function buildFormatSpec(profile: FormatProfileRecord): FormatSpec {
  const acceptedOverlay = getAcceptedSemanticOverlay(profile)
  const synthesizedRules = acceptedOverlay?.output?.formatRuleSynthesis?.map(overlayRuleToFormatSpec) ?? []
  const docxStyleFactRules = profile.fileType === "docx"
    ? buildDocxExecutableStyleRules(buildDocxExecutableStyleFactsInput(profile.styleFacts, profile.confidence))
    : []
  const deterministicRules = rulesFor(profile)
  const docxBaselineResult = profile.fileType === "docx"
    ? ensureDocxFormatSpecBaseline([...docxStyleFactRules, ...deterministicRules, ...synthesizedRules], { confidence: profile.confidence })
    : null
  const effectiveRules = docxBaselineResult?.rules ?? (synthesizedRules.length ? synthesizedRules : deterministicRules)
  return {
    schemaVersion: FORMAT_SPEC_SCHEMA_VERSION,
    rendererVersion: FORMAT_SPEC_RENDERER_VERSION,
    policyVersion: FORMAT_SPEC_POLICY_VERSION,
    sourceFileType: profile.fileType,
    documentIntent: profile.documentKind,
    confidence: profile.confidence,
    contentLeakagePolicy: {
      includeSourceBodyText: false,
      includeRawEvidenceDump: false,
      promptMayIncludeEvidenceIds: false,
    },
    summaryLines: [
      ...summaryLinesFor(profile),
      ...(docxStyleFactRules.length
        ? [`DOCX StyleFacts 已生成 ${docxStyleFactRules.length} 条受限可执行样式/页面属性（page/title/heading/body），用于 writer 规则。`]
        : []),
      ...(docxBaselineResult
        ? [`DOCX FormatSpec 已应用正式文稿最低基线覆盖：${docxBaselineResult.audit.coveredDimensions.length}/${docxBaselineResult.audit.coveredDimensions.length + docxBaselineResult.audit.missingDimensions.length} 个维度。`]
        : []),
      synthesizedRules.length
        ? `LLM 已归纳 ${synthesizedRules.length} 条细粒度 FormatRuleSpec 规则；事实层仍以确定性 StyleFacts 为准。`
        : acceptedOverlay ? "智能解释已被接受，但仅作为规则解释层，不写入事实层。" : "未使用已接受的智能解释时，仍使用确定性画像生成格式规则。",
    ],
    boundaries: profile.fileType === "docx"
      ? [...boundaries(), "DOCX 可将确定性 StyleFacts 的受限字段转为 page/title/heading/body writer 规则；这不是模板回放、全文复制或像素级视觉等价承诺。"]
      : boundaries(),
    rules: effectiveRules,
  }
}


export function renderFormatSpecPromptBlock(spec: FormatSpec): string {
  return [
    "## 格式约束（FormatSpec）",
    "",
    `- 来源格式：${spec.sourceFileType.toUpperCase()}`,
    `- 文档定位：${spec.documentIntent}`,
    `- 置信度：${spec.confidence}`,
    "",
    "### 类型摘要",
    ...spec.summaryLines.map((item) => `- ${item}`),
    "",
    "### 必守边界",
    ...spec.boundaries.map((item) => `- ${item}`),
    "",
    "### 格式规则",
    ...spec.rules.flatMap((item) => {
      const role = item.dimension ?? item.normType ?? item.target
      const head = `- 【${item.target}/${role}】${item.rule} ${item.detail}`
      const attributes = (item.attributes ?? []).slice(0, 8).map((attribute) => `  - ${attribute.name}: ${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ""}`)
      return [head, ...attributes]
    }),
  ].join("\n")
}

export function buildFormatSpecHash(spec: FormatSpec, promptBlock = renderFormatSpecPromptBlock(spec)): string {
  return sha256Stable({
    schemaVersion: spec.schemaVersion,
    rendererVersion: spec.rendererVersion,
    policyVersion: spec.policyVersion,
    sourceFileType: spec.sourceFileType,
    documentIntent: spec.documentIntent,
    confidence: spec.confidence,
    contentLeakagePolicy: spec.contentLeakagePolicy,
    summaryLines: spec.summaryLines,
    boundaries: spec.boundaries,
    rules: spec.rules,
    promptBlock,
  })
}

export function buildSourceProfileHash(profile: FormatProfileRecord): string {
  return sha256Stable({
    id: profile.id,
    updatedAt: profile.updatedAt,
    fileType: profile.fileType,
    confidence: profile.confidence,
    styleFactsSha256: profile.styleFacts?.metadata.styleFactsSha256 ?? "legacy",
    semanticOverlayStatus: profile.semanticOverlay?.status ?? profile.refinement?.semanticStatus ?? "not-configured",
    semanticOverlayKey: profile.semanticOverlay?.key ?? null,
  })
}

export function buildFormatSpecSnapshot(profile: FormatProfileRecord): Pick<DraftProcessingFormatProfileSnapshot, "formatSpec" | "formatSpecHash" | "sourceProfileHash"> {
  const spec = buildFormatSpec(profile)
  const promptBlock = renderFormatSpecPromptBlock(spec)
  const baseFormatSpecHash = buildFormatSpecHash(spec, promptBlock)
  const editableOverride = profile.editableFormatSpec
  const useEditablePrompt = Boolean(
    editableOverride?.sourceFormatSpecHash === baseFormatSpecHash &&
    editableOverride.promptBlock.trim(),
  )
  const effectivePromptBlock = useEditablePrompt ? editableOverride!.promptBlock : promptBlock
  const effectiveSummaryLines = useEditablePrompt
    ? [...spec.summaryLines, "用户已编辑格式约束；底稿加工使用编辑后的约束文本。"]
    : spec.summaryLines
  return {
    sourceProfileHash: buildSourceProfileHash(profile),
    formatSpecHash: buildFormatSpecHash(spec, effectivePromptBlock),
    formatSpec: {
      schemaVersion: spec.schemaVersion,
      rendererVersion: spec.rendererVersion,
      policyVersion: spec.policyVersion,
      sourceFileType: spec.sourceFileType,
      documentIntent: spec.documentIntent,
      confidence: spec.confidence,
      contentLeakagePolicy: spec.contentLeakagePolicy,
      boundaries: spec.boundaries,
      rules: spec.rules,
      promptBlock: effectivePromptBlock,
      summaryLines: effectiveSummaryLines,
    },
  }
}

export interface FormatSpecAuditView {
  schemaVersion: string
  rendererVersion: string
  policyVersion: string
  sourceFileType: FormatProfileFileType
  documentIntent: string
  confidence: FormatProfileConfidence
  contentLeakagePolicy: FormatSpecContentLeakagePolicy
  sourceProfileHash?: string
  formatSpecHash?: string
  summaryLines: string[]
  boundaries: string[]
  rulesByTarget: Array<{ target: string; rules: FormatSpecRule[] }>
  promptBlock: string
  legacyGenerationInstructionPresent: boolean
}

export function buildFormatSpecAuditView(
  snapshot: FormatSpecSnapshot,
  options: {
    sourceProfileHash?: string
    formatSpecHash?: string
    legacyGenerationInstruction?: string
  } = {},
): FormatSpecAuditView {
  const rules = Array.isArray(snapshot.rules) ? snapshot.rules : []
  const boundaries = Array.isArray(snapshot.boundaries) ? snapshot.boundaries : []
  const summaryLines = Array.isArray(snapshot.summaryLines) ? snapshot.summaryLines : []
  const contentLeakagePolicy = snapshot.contentLeakagePolicy ?? {
    includeSourceBodyText: false,
    includeRawEvidenceDump: false,
    promptMayIncludeEvidenceIds: false,
  }
  const grouped = new Map<string, FormatSpecRule[]>()
  for (const item of rules) {
    grouped.set(item.target, [...(grouped.get(item.target) ?? []), item])
  }
  return {
    schemaVersion: snapshot.schemaVersion,
    rendererVersion: snapshot.rendererVersion,
    policyVersion: snapshot.policyVersion,
    sourceFileType: snapshot.sourceFileType ?? "unknown",
    documentIntent: snapshot.documentIntent ?? "unknown-reference",
    confidence: snapshot.confidence ?? "low",
    contentLeakagePolicy,
    sourceProfileHash: options.sourceProfileHash,
    formatSpecHash: options.formatSpecHash,
    summaryLines: [...summaryLines],
    boundaries: [...boundaries],
    rulesByTarget: Array.from(grouped.entries()).map(([target, rules]) => ({ target, rules: rules.map((ruleItem) => ({ ...ruleItem })) })),
    promptBlock: snapshot.promptBlock ?? "",
    legacyGenerationInstructionPresent: Boolean(options.legacyGenerationInstruction?.trim()),
  }
}
