import type { LlmConfig } from "@/stores/wiki-store"
import type { FormatProfileConfidence, FormatProfileDiagnostic, FormatProfileFileType, FormatProfileRecord } from "@/lib/format-profile-types"
import type { StyleFactConfidence, StyleFactsEnvelope } from "@/lib/style-facts"
import { sha256Stable, styleSummaryForHumans } from "@/lib/style-facts"
import { streamChat, type RequestOverrides } from "@/lib/llm-client"
import type { ChatMessage } from "@/lib/llm-providers"
import { hasUsableLlm } from "@/lib/has-usable-llm"

export type SemanticConfidence = "high" | "medium" | "low"
export type OverlaySchemaVersion = "format-profile-llm-overlay.v1"
export type OverlayClaimKind = "document-kind" | "structure" | "style" | "generation-guidance" | "warning"
export type SemanticOverlayStoredStatus = "running" | "accepted" | "rejected" | "failed"
export type SemanticOverlayDerivedStatus = "not-configured" | "eligible" | "stale"
export type SemanticOverlayStatus = SemanticOverlayStoredStatus | SemanticOverlayDerivedStatus
export type SemanticOverlayDataScope = "evidence-only"
export type OverlayEvaluatorStatus = "accepted" | "rejected"
export type OverlayViolationCode =
  | "invalid-json"
  | "schema-invalid"
  | "unknown-field"
  | "missing-evidence-ref"
  | "unknown-evidence-ref"
  | "fact-creation-attempt"
  | "renderer-bypass-attempt"
  | "data-scope-violation"
  | "boundary-keyword"
  | "quality-threshold"

export type SemanticOverlayFallbackReason =
  | "not-configured"
  | "cancelled"
  | "timeout"
  | "provider-error"
  | "empty-response"
  | "invalid-json"
  | "schema-invalid"
  | "evaluator-rejected"
  | "stale-overlay"
  | "interrupted"

export interface OverlayClaim {
  id: string
  kind: OverlayClaimKind
  text: string
  confidence: SemanticConfidence
  evidenceRefs: string[]
}

export interface OverlayFormatRuleAttribute {
  name: string
  value: string
  unit?: string
  confidence?: SemanticConfidence
  evidenceRefs?: string[]
}

export interface OverlayFormatRule {
  id: string
  target: string
  normType: string
  rule: string
  detail: string
  source: "llm-inferred" | "detected" | "standard-default"
  confidence: SemanticConfidence
  evidenceRefs: string[]
  attributes?: OverlayFormatRuleAttribute[]
}

export interface LLMOverlayOutput {
  schemaVersion: OverlaySchemaVersion
  language: "zh" | "en" | "mixed"
  documentKind: OverlayClaim | null
  structureInterpretation: OverlayClaim[]
  styleInterpretation: OverlayClaim[]
  generationGuidance: OverlayClaim[]
  formatRuleSynthesis: OverlayFormatRule[]
  warnings: OverlayClaim[]
  uncertainty: string[]
}

export interface OverlayEvaluatorReport {
  status: OverlayEvaluatorStatus
  schemaVersion: "format-profile-llm-overlay-evaluator.v1"
  evidenceRefCoverage: number
  acceptedClaimCount: number
  rejectedClaimCount: number
  violations: Array<{ code: OverlayViolationCode; message: string; claimId?: string }>
  warnings: string[]
  fallbackReason?: SemanticOverlayFallbackReason
}

export interface SemanticOverlayKey {
  profileId: string
  profileUpdatedAt: number
  profileSnapshotHash: string
  styleFactsSha256: string
}

export interface SemanticOverlayProvenance {
  key: SemanticOverlayKey
  dataScope: SemanticOverlayDataScope
  overlaySchemaVersion: OverlaySchemaVersion
  evaluatorSchemaVersion: "format-profile-llm-overlay-evaluator.v1"
  providerId: string
  modelId?: string
  requestSettings: {
    temperature?: number
    maxTokens?: number
    timeoutMs: number
  }
  startedAt: number
  completedAt?: number
}

export interface SemanticOverlayAuditEntry {
  id: string
  at: number
  event: "started" | "accepted" | "rejected" | "failed" | "cancelled" | "stale-detected"
  status: SemanticOverlayStatus
  reason?: SemanticOverlayFallbackReason | string
  key: SemanticOverlayKey
  providerId?: string
  modelId?: string
  evaluatorStatus?: OverlayEvaluatorStatus
  evidenceRefs?: string[]
}

export interface FormatProfileSemanticOverlayState {
  status: SemanticOverlayStoredStatus
  key: SemanticOverlayKey
  dataScope: SemanticOverlayDataScope
  output?: LLMOverlayOutput
  evaluatorReport?: OverlayEvaluatorReport
  provenance: SemanticOverlayProvenance
  fallbackReason?: SemanticOverlayFallbackReason
  fallbackMessage?: string
  auditTrail: SemanticOverlayAuditEntry[]
}

export interface EvidenceOnlyOverlayInput {
  schemaVersion: "format-profile-overlay-input.v1"
  dataScope: "evidence-only"
  profile: {
    id: string
    title: string
    sourceName: string
    fileType: FormatProfileFileType
    documentKind: string
    confidence: FormatProfileConfidence
    updatedAt: number
  }
  snapshot: {
    profileSnapshotHash: string
    styleFactsSchemaVersion?: string
    styleFactsSha256?: string
    semanticStatus: SemanticOverlayStatus
  }
  summaries: {
    structure: string[]
    styleFacts: string[]
    diagnostics: Array<{ id: string; severity: FormatProfileDiagnostic["severity"]; message: string }>
  }
  evidenceCatalog: Array<{
    id: string
    kind: string
    pointer: string
    confidence: StyleFactConfidence
    description?: string
    valueDigest: string
  }>
  constraints: string[]
}

export type OverlayProviderResult =
  | { status: "completed"; text: string; providerId: string; modelId?: string; elapsedMs: number }
  | { status: "cancelled"; reason: "cancelled"; providerId?: string; modelId?: string; elapsedMs: number }
  | { status: "failed"; reason: "timeout" | "provider-error" | "empty-response"; message?: string; providerId?: string; modelId?: string; elapsedMs: number }

const overlaySchemaVersion: OverlaySchemaVersion = "format-profile-llm-overlay.v1"
const evaluatorSchemaVersion = "format-profile-llm-overlay-evaluator.v1" as const
const overlayInputSchemaVersion = "format-profile-overlay-input.v1" as const
const maxAuditEntries = 20

const topLevelKeys = new Set(["schemaVersion", "language", "documentKind", "structureInterpretation", "styleInterpretation", "generationGuidance", "formatRuleSynthesis", "warnings", "uncertainty"])
const claimKeys = new Set(["id", "kind", "text", "confidence", "evidenceRefs"])
const formatRuleKeys = new Set(["id", "target", "normType", "rule", "detail", "source", "confidence", "evidenceRefs", "attributes"])
const formatRuleAttributeKeys = new Set(["name", "value", "unit", "confidence", "evidenceRefs"])
const claimKinds = new Set<OverlayClaimKind>(["document-kind", "structure", "style", "generation-guidance", "warning"])
const confidences = new Set<SemanticConfidence>(["high", "medium", "low"])
const formatRuleSources = new Set(["llm-inferred", "detected", "standard-default"])
const formatRuleSourceAliases = new Map<string, OverlayFormatRule["source"]>([
  ["llm-inferred", "llm-inferred"],
  ["llm_inferred", "llm-inferred"],
  ["llminferred", "llm-inferred"],
  ["model-inferred", "llm-inferred"],
  ["model_inferred", "llm-inferred"],
  ["ai-inferred", "llm-inferred"],
  ["ai_inferred", "llm-inferred"],
  ["inferred", "llm-inferred"],
  ["detected", "detected"],
  ["evidence-based", "detected"],
  ["evidence_based", "detected"],
  ["evidencebased", "detected"],
  ["from-evidence", "detected"],
  ["from_evidence", "detected"],
  ["standard-default", "standard-default"],
  ["standard_default", "standard-default"],
  ["standarddefault", "standard-default"],
  ["default", "standard-default"],
  ["fallback", "standard-default"],
])
const languages = new Set(["zh", "en", "mixed"])
const forbiddenKeys = new Set([
  "styleFacts",
  "styleFactsPatch",
  "generationInstruction",
  "finalInstruction",
  "prompt",
  "rawText",
  "textSample",
  "snippets",
  "fulltext",
  "sourceContext",
  "export",
])
const boundaryPatterns = [
  /高保真/,
  /复刻/,
  /还原版式/,
  /视觉还原/,
  /perfect\s*match/i,
  /pixel[-\s]*perfect/i,
  /high[-\s]*fidelity/i,
  /exact\s+recreat/i,
]

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function normalizeFormatRuleSource(value: unknown): OverlayFormatRule["source"] | undefined {
  if (typeof value !== "string") return undefined
  const key = value.trim().toLowerCase().replace(/\s+/g, "-")
  return formatRuleSourceAliases.get(key)
}

function describeReceivedValue(value: unknown): string {
  if (value === undefined) return "undefined"
  try {
    const serialized = JSON.stringify(value)
    return serialized && serialized.length > 120 ? `${serialized.slice(0, 120)}...` : serialized ?? String(value)
  } catch {
    return String(value)
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function profileSnapshotHash(profile: Pick<FormatProfileRecord, "id" | "updatedAt" | "styleFacts">): string {
  return `${profile.id}:${profile.updatedAt}:${profile.styleFacts?.metadata.styleFactsSha256 ?? "legacy"}`
}

export function buildSemanticOverlayKey(profile: Pick<FormatProfileRecord, "id" | "updatedAt" | "styleFacts">): SemanticOverlayKey {
  return {
    profileId: profile.id,
    profileUpdatedAt: profile.updatedAt,
    profileSnapshotHash: profileSnapshotHash(profile),
    styleFactsSha256: profile.styleFacts?.metadata.styleFactsSha256 ?? "legacy",
  }
}

function sameKey(a: SemanticOverlayKey | undefined, b: SemanticOverlayKey): boolean {
  if (!a) return false
  return (
    a.profileId === b.profileId &&
    a.profileUpdatedAt === b.profileUpdatedAt &&
    a.profileSnapshotHash === b.profileSnapshotHash &&
    a.styleFactsSha256 === b.styleFactsSha256
  )
}

export function deriveSemanticOverlayStatus(profile: FormatProfileRecord, providerUsable = false): SemanticOverlayStatus {
  const currentKey = buildSemanticOverlayKey(profile)
  const overlay = profile.semanticOverlay
  if (overlay && !sameKey(overlay.key, currentKey)) return "stale"
  if (overlay?.status === "running") return "running"
  if (overlay?.status === "accepted") return "accepted"
  if (overlay?.status === "rejected") return "rejected"
  if (overlay?.status === "failed") return "failed"
  return providerUsable ? "eligible" : "not-configured"
}

export function getAcceptedSemanticOverlay(profile: FormatProfileRecord): FormatProfileSemanticOverlayState | null {
  if (!profile.semanticOverlay || profile.semanticOverlay.status !== "accepted") return null
  return sameKey(profile.semanticOverlay.key, buildSemanticOverlayKey(profile)) ? profile.semanticOverlay : null
}

function bounded(items: string[] | undefined, limit: number, charLimit = 180): string[] {
  return (items ?? []).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, limit).map((item) => item.slice(0, charLimit))
}

export function buildEvidenceOnlyOverlayInput(profile: FormatProfileRecord, providerUsable = true): EvidenceOnlyOverlayInput {
  const status = deriveSemanticOverlayStatus(profile, providerUsable)
  const styleFacts = profile.styleFacts
  const styleFactsSummary = styleFacts ? styleSummaryForHumans(styleFacts, profile.fileType, 8) : bounded(profile.styleProfile.evidenceSummary, 8)
  return {
    schemaVersion: overlayInputSchemaVersion,
    dataScope: "evidence-only",
    profile: {
      id: profile.id,
      title: profile.title,
      sourceName: profile.sourceName,
      fileType: profile.fileType,
      documentKind: profile.documentKind,
      confidence: profile.confidence,
      updatedAt: profile.updatedAt,
    },
    snapshot: {
      profileSnapshotHash: profileSnapshotHash(profile),
      ...(styleFacts ? { styleFactsSchemaVersion: styleFacts.schemaVersion } : {}),
      ...(styleFacts?.metadata.styleFactsSha256 ? { styleFactsSha256: styleFacts.metadata.styleFactsSha256 } : {}),
      semanticStatus: status,
    },
    summaries: {
      structure: bounded([
        ...profile.structureProfile.sections.slice(0, 8).map((section, index) => `${index + 1}. ${section.title} (${section.evidence})`),
        ...profile.structureProfile.evidenceSummary,
      ], 12),
      styleFacts: bounded(styleFactsSummary, 8),
      diagnostics: profile.diagnostics.slice(0, 12).map((item) => ({ id: item.id, severity: item.severity, message: item.message.slice(0, 220) })),
    },
    evidenceCatalog: buildEvidenceCatalog(styleFacts),
    constraints: bounded(profile.writingProfile.constraints, 8, 240),
  }
}

export function buildEvidenceCatalog(styleFacts?: StyleFactsEnvelope): EvidenceOnlyOverlayInput["evidenceCatalog"] {
  return (styleFacts?.evidence ?? []).slice(0, 80).map((item) => ({
    id: item.id,
    kind: item.kind,
    pointer: item.pointer,
    confidence: item.confidence,
    ...(item.description ? { description: item.description.slice(0, 160) } : {}),
    valueDigest: item.sha256 || sha256Stable({ kind: item.kind, pointer: item.pointer, value: item.value }),
  }))
}

export function buildSemanticOverlayPrompt(input: EvidenceOnlyOverlayInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是格式画像语义解释器。只能解释输入中的 evidence-only 样式事实和摘要。",
        "禁止创建、覆盖、删除或修正字体、字号、页边距、颜色、版式等事实。",
        "禁止输出 generationInstruction/finalInstruction/rawText/textSample/snippets/fulltext/sourceContext/export 等字段。",
        "必须只输出 JSON，且必须符合 schemaVersion format-profile-llm-overlay.v1。",
        "每个 claim 必须引用 evidenceCatalog 中存在的 evidenceRefs。",
        "可以输出 formatRuleSynthesis：把证据归纳为类似 GB/T 9704-2012 的细粒度格式规则，规则必须包含 target、normType、rule、detail、confidence、evidenceRefs 和 attributes；source 可省略。",
        "formatRuleSynthesis.source 如需输出，只能使用 llm-inferred、detected 或 standard-default；省略或无法识别时系统会按 llm-inferred 审计。",
        "formatRuleSynthesis 中的 attributes 可以继承父规则 evidenceRefs；规则本身必须引用 evidenceCatalog 中存在的 evidenceRefs。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请将以下 FormatProfile 证据解释为简洁、可用于写作约束的人类摘要。只返回 JSON。",
        "",
        JSON.stringify({
          expectedSchema: {
            schemaVersion: overlaySchemaVersion,
            language: "zh | en | mixed",
            documentKind: "OverlayClaim | null",
            structureInterpretation: "OverlayClaim[] max 6",
            styleInterpretation: "OverlayClaim[] max 8",
            generationGuidance: "OverlayClaim[] max 8",
            formatRuleSynthesis: "OverlayFormatRule[] max 16; fields: id,target,normType,rule,detail,confidence,evidenceRefs,attributes; optional source(llm-inferred|detected|standard-default)",
            warnings: "OverlayClaim[] max 6",
            uncertainty: "string[] max 5",
          },
          input,
        }, null, 2),
      ].join("\n"),
    },
  ]
}

function violation(code: OverlayViolationCode, message: string, claimId?: string) {
  return { code, message, ...(claimId ? { claimId } : {}) }
}

function containsForbiddenKey(node: unknown): string | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = containsForbiddenKey(item)
      if (found) return found
    }
    return null
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (forbiddenKeys.has(key)) return key
    const found = containsForbiddenKey(value)
    if (found) return found
  }
  return null
}

function containsBoundaryKeyword(node: unknown): boolean {
  const text = typeof node === "string" ? node : JSON.stringify(node)
  if (/(不|未|不能|无法|不承诺|不得|禁止|avoid|do not|does not|not)\s*.{0,12}(高保真|复刻|还原版式|视觉还原|perfect\s*match|pixel[-\s]*perfect|high[-\s]*fidelity|exact\s+recreat)/i.test(text)) {
    return false
  }
  return boundaryPatterns.some((pattern) => pattern.test(text))
}

function normalizeClaimShape(value: unknown, expectedKind: OverlayClaimKind | null, index = 0): unknown {
  const record = asRecord(value)
  if (!record) return value
  const text = asString(record.text) ?? asString(record.claim) ?? asString(record.summary)
  const evidenceRefs = asArray(record.evidenceRefs).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  return {
    id: asString(record.id) ?? `${expectedKind ?? "claim"}-${index + 1}`,
    kind: asString(record.kind) ?? expectedKind,
    text,
    confidence: asString(record.confidence) ?? "medium",
    evidenceRefs,
  }
}

function normalizeOverlayShape(record: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...record }
  if (typeof normalized.documentKind === "string") normalized.documentKind = null
  normalized.structureInterpretation = asArray(normalized.structureInterpretation).map((item, index) => normalizeClaimShape(item, "structure", index))
  normalized.styleInterpretation = asArray(normalized.styleInterpretation).map((item, index) => normalizeClaimShape(item, "style", index))
  normalized.generationGuidance = asArray(normalized.generationGuidance).map((item, index) => normalizeClaimShape(item, "generation-guidance", index))
  normalized.formatRuleSynthesis = asArray(normalized.formatRuleSynthesis)
  normalized.warnings = asArray(normalized.warnings).map((item, index) => normalizeClaimShape(item, "warning", index))
  if (!Array.isArray(normalized.uncertainty)) normalized.uncertainty = []
  return normalized
}

function parseClaim(value: unknown, expectedKind: OverlayClaimKind | null, violations: OverlayEvaluatorReport["violations"], warnings: string[]): OverlayClaim | null {
  const record = asRecord(value)
  if (!record) {
    violations.push(violation("schema-invalid", "claim must be an object"))
    return null
  }
  for (const key of Object.keys(record)) {
    if (!claimKeys.has(key)) violations.push(violation("unknown-field", `unknown claim field: ${key}`, asString(record.id)))
  }
  const id = asString(record.id)
  const kind = asString(record.kind) as OverlayClaimKind | undefined
  const text = asString(record.text)
  const confidence = asString(record.confidence) as SemanticConfidence | undefined
  const evidenceRefs = asArray(record.evidenceRefs).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  if (!id || id.length > 64) violations.push(violation("schema-invalid", "claim id is required and must be <=64 chars", id))
  if (!kind || !claimKinds.has(kind)) violations.push(violation("schema-invalid", "claim kind is invalid", id))
  if (expectedKind && kind && kind !== expectedKind) violations.push(violation("schema-invalid", `claim kind must be ${expectedKind}`, id))
  if (!text || text.length > 240) violations.push(violation("schema-invalid", "claim text is required and must be <=240 chars", id))
  if (!confidence || !confidences.has(confidence)) violations.push(violation("schema-invalid", "claim confidence is invalid", id))
  if (evidenceRefs.length === 0) {
    warnings.push(`Dropped uncited claim${id ? ` ${id}` : ""}; every accepted claim must cite evidenceRefs.`)
    return null
  }
  if (evidenceRefs.length > 8) violations.push(violation("schema-invalid", "claim cannot cite more than 8 evidenceRefs", id))
  if (!id || !kind || !text || !confidence) return null
  return { id, kind, text, confidence, evidenceRefs }
}

function parseClaimArray(value: unknown, max: number, expectedKind: OverlayClaimKind | null, violations: OverlayEvaluatorReport["violations"], warnings: string[]): OverlayClaim[] {
  const items = asArray(value)
  if (!Array.isArray(value)) violations.push(violation("schema-invalid", "claim collection must be an array"))
  if (items.length > max) violations.push(violation("schema-invalid", `claim collection exceeds max ${max}`))
  return items.slice(0, max).map((item) => parseClaim(item, expectedKind, violations, warnings)).filter((item): item is OverlayClaim => Boolean(item))
}

function parseFormatRuleAttribute(value: unknown, parentEvidenceRefs: string[], violations: OverlayEvaluatorReport["violations"], ruleId?: string): OverlayFormatRuleAttribute | null {
  const record = asRecord(value)
  if (!record) {
    violations.push(violation("schema-invalid", "format rule attribute must be an object", ruleId))
    return null
  }
  for (const key of Object.keys(record)) {
    if (!formatRuleAttributeKeys.has(key)) violations.push(violation("unknown-field", `unknown format rule attribute field: ${key}`, ruleId))
  }
  const name = asString(record.name)
  const valueText = asString(record.value)
  const unit = asString(record.unit)
  const confidence = asString(record.confidence) as SemanticConfidence | undefined
  const evidenceRefs = asArray(record.evidenceRefs).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  if (!name || name.length > 64) violations.push(violation("schema-invalid", "attribute name is required and must be <=64 chars", ruleId))
  if (!valueText || valueText.length > 160) violations.push(violation("schema-invalid", "attribute value is required and must be <=160 chars", ruleId))
  if (confidence && !confidences.has(confidence)) violations.push(violation("schema-invalid", "attribute confidence is invalid", ruleId))
  if (!name || !valueText) return null
  return {
    name,
    value: valueText,
    ...(unit ? { unit } : {}),
    ...(confidence ? { confidence } : {}),
    evidenceRefs: evidenceRefs.length ? evidenceRefs : parentEvidenceRefs,
  }
}

function parseFormatRule(value: unknown, index: number, violations: OverlayEvaluatorReport["violations"], warnings: string[]): OverlayFormatRule | null {
  const record = asRecord(value)
  if (!record) {
    violations.push(violation("schema-invalid", "format rule must be an object"))
    return null
  }
  for (const key of Object.keys(record)) {
    if (!formatRuleKeys.has(key)) violations.push(violation("unknown-field", `unknown format rule field: ${key}`, asString(record.id)))
  }
  const id = asString(record.id) ?? `format-rule-${index + 1}`
  const target = asString(record.target)
  const normType = asString(record.normType)
  const ruleText = asString(record.rule)
  const detail = asString(record.detail)
  const source = record.source === undefined ? "llm-inferred" : normalizeFormatRuleSource(record.source)
  const confidence = asString(record.confidence) as SemanticConfidence | undefined
  const evidenceRefs = asArray(record.evidenceRefs).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  if (!id || id.length > 64) violations.push(violation("schema-invalid", "format rule id is required and must be <=64 chars", id))
  if (!target || target.length > 64) violations.push(violation("schema-invalid", "format rule target is required and must be <=64 chars", id))
  if (!normType || normType.length > 64) violations.push(violation("schema-invalid", "format rule normType is required and must be <=64 chars", id))
  if (!ruleText || ruleText.length > 240) violations.push(violation("schema-invalid", "format rule rule is required and must be <=240 chars", id))
  if (!detail || detail.length > 320) violations.push(violation("schema-invalid", "format rule detail is required and must be <=320 chars", id))
  if (record.source === undefined) {
    warnings.push(`Defaulted format rule source to llm-inferred for ${id}; source is system provenance, not a required model fact.`)
  } else if (!source || !formatRuleSources.has(source)) {
    warnings.push(`Defaulted unknown format rule source to llm-inferred for ${id}; received ${describeReceivedValue(record.source)}.`)
  }
  if (!confidence || !confidences.has(confidence)) violations.push(violation("schema-invalid", "format rule confidence is invalid", id))
  if (evidenceRefs.length === 0) {
    warnings.push(`Dropped uncited format rule ${id}; every accepted format rule must cite evidenceRefs.`)
    return null
  }
  if (evidenceRefs.length > 8) violations.push(violation("schema-invalid", "format rule cannot cite more than 8 evidenceRefs", id))
  if (!target || !normType || !ruleText || !detail || !confidence) return null
  const attributes = asArray(record.attributes).slice(0, 12).map((item) => parseFormatRuleAttribute(item, evidenceRefs, violations, id)).filter((item): item is OverlayFormatRuleAttribute => Boolean(item))
  return { id, target, normType, rule: ruleText, detail, source: source ?? "llm-inferred", confidence, evidenceRefs, ...(attributes.length ? { attributes } : {}) }
}

function parseFormatRuleArray(value: unknown, violations: OverlayEvaluatorReport["violations"], warnings: string[]): OverlayFormatRule[] {
  const items = asArray(value)
  if (!Array.isArray(value)) violations.push(violation("schema-invalid", "formatRuleSynthesis must be an array"))
  if (items.length > 16) violations.push(violation("schema-invalid", "formatRuleSynthesis exceeds max 16"))
  return items.slice(0, 16).map((item, index) => parseFormatRule(item, index, violations, warnings)).filter((item): item is OverlayFormatRule => Boolean(item))
}

export function parseAndEvaluateSemanticOverlay(rawText: string, evidenceIds: Set<string>): { output: LLMOverlayOutput | null; report: OverlayEvaluatorReport } {
  const violations: OverlayEvaluatorReport["violations"] = []
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return {
      output: null,
      report: rejectedReport([violation("invalid-json", "provider output is not valid JSON")], "invalid-json"),
    }
  }

  const parsedRecord = asRecord(parsed)
  if (!parsedRecord) {
    return { output: null, report: rejectedReport([violation("schema-invalid", "overlay output must be an object")], "schema-invalid") }
  }
  const record = normalizeOverlayShape(parsedRecord)
  for (const key of Object.keys(record)) {
    if (!topLevelKeys.has(key)) violations.push(violation("unknown-field", `unknown top-level field: ${key}`))
  }
  const forbidden = containsForbiddenKey(record)
  if (forbidden) violations.push(violation("fact-creation-attempt", `forbidden field: ${forbidden}`))
  if (containsBoundaryKeyword(record)) violations.push(violation("boundary-keyword", "overlay contains forbidden fidelity/export promise"))
  if (record.schemaVersion !== overlaySchemaVersion) violations.push(violation("schema-invalid", "schemaVersion is invalid"))
  if (!languages.has(String(record.language))) violations.push(violation("schema-invalid", "language is invalid"))

  const documentKind = record.documentKind === null ? null : parseClaim(record.documentKind, "document-kind", violations, warnings)
  const structureInterpretation = parseClaimArray(record.structureInterpretation, 6, "structure", violations, warnings)
  const styleInterpretation = parseClaimArray(record.styleInterpretation, 8, "style", violations, warnings)
  const generationGuidance = parseClaimArray(record.generationGuidance, 8, "generation-guidance", violations, warnings)
  const formatRuleSynthesis = parseFormatRuleArray(record.formatRuleSynthesis, violations, warnings)
  const warningClaims = parseClaimArray(record.warnings, 6, "warning", violations, warnings)
  const uncertainty = asArray(record.uncertainty).filter((item): item is string => typeof item === "string").slice(0, 5).map((item) => item.slice(0, 160))
  if (!Array.isArray(record.uncertainty)) violations.push(violation("schema-invalid", "uncertainty must be an array"))

  const claims = [documentKind, ...structureInterpretation, ...styleInterpretation, ...generationGuidance, ...warningClaims].filter((item): item is OverlayClaim => Boolean(item))
  for (const claim of claims) {
    for (const ref of claim.evidenceRefs) {
      if (!evidenceIds.has(ref)) violations.push(violation("unknown-evidence-ref", `unknown evidence ref: ${ref}`, claim.id))
    }
  }
  for (const ruleItem of formatRuleSynthesis) {
    for (const ref of ruleItem.evidenceRefs) {
      if (!evidenceIds.has(ref)) violations.push(violation("unknown-evidence-ref", `unknown evidence ref: ${ref}`, ruleItem.id))
    }
    for (const attribute of ruleItem.attributes ?? []) {
      for (const ref of attribute.evidenceRefs ?? ruleItem.evidenceRefs) {
        if (!evidenceIds.has(ref)) violations.push(violation("unknown-evidence-ref", `unknown evidence ref: ${ref}`, ruleItem.id))
      }
    }
  }
  if (claims.length === 0 && formatRuleSynthesis.length === 0) violations.push(violation("quality-threshold", "overlay must contain at least one evidence-cited claim or format rule"))
  const refs = [
    ...claims.flatMap((claim) => claim.evidenceRefs),
    ...formatRuleSynthesis.flatMap((ruleItem) => [
      ...ruleItem.evidenceRefs,
      ...(ruleItem.attributes ?? []).flatMap((attribute) => attribute.evidenceRefs ?? ruleItem.evidenceRefs),
    ]),
  ]
  const knownRefs = refs.filter((ref) => evidenceIds.has(ref))
  const coverage = refs.length === 0 ? 0 : knownRefs.length / refs.length
  if (coverage < 1) violations.push(violation("quality-threshold", "evidenceRefCoverage must be 1"))

  if (violations.length > 0) return { output: null, report: rejectedReport(violations, fallbackFor(violations)) }

  const output: LLMOverlayOutput = {
    schemaVersion: overlaySchemaVersion,
    language: record.language as LLMOverlayOutput["language"],
    documentKind,
    structureInterpretation,
      styleInterpretation,
      generationGuidance,
      formatRuleSynthesis,
    warnings: warningClaims,
    uncertainty,
  }
  return {
    output,
    report: {
      status: "accepted",
      schemaVersion: evaluatorSchemaVersion,
      evidenceRefCoverage: 1,
      acceptedClaimCount: claims.length,
      rejectedClaimCount: warnings.filter((item) => item.startsWith("Dropped uncited claim")).length,
      violations: [],
      warnings,
    },
  }
}

function fallbackFor(violations: OverlayEvaluatorReport["violations"]): SemanticOverlayFallbackReason {
  if (violations.some((item) => item.code === "invalid-json")) return "invalid-json"
  if (violations.some((item) => item.code === "schema-invalid" || item.code === "unknown-field")) return "schema-invalid"
  return "evaluator-rejected"
}

function rejectedReport(violations: OverlayEvaluatorReport["violations"], fallbackReason: SemanticOverlayFallbackReason): OverlayEvaluatorReport {
  return {
    status: "rejected",
    schemaVersion: evaluatorSchemaVersion,
    evidenceRefCoverage: 0,
    acceptedClaimCount: 0,
    rejectedClaimCount: violations.length,
    violations,
    warnings: [],
    fallbackReason,
  }
}

export function semanticOverlaySummaryLines(profile: FormatProfileRecord, limit = 8): string[] {
  const accepted = getAcceptedSemanticOverlay(profile)
  if (!accepted?.output) return []
  const output = accepted.output
  return [
    ...(output.documentKind ? [`文档定位解释：${output.documentKind.text}`] : []),
    ...output.structureInterpretation.map((claim) => `结构解释：${claim.text}`),
    ...output.styleInterpretation.map((claim) => `样式解释：${claim.text}`),
    ...output.generationGuidance.map((claim) => `写作建议：${claim.text}`),
    ...(output.formatRuleSynthesis?.length ? [`格式规则归纳：${output.formatRuleSynthesis.length} 条细粒度规则已通过证据校验。`] : []),
    ...output.warnings.map((claim) => `边界提醒：${claim.text}`),
    ...output.uncertainty.map((item) => `不确定性：${item}`),
  ].slice(0, limit)
}

export function semanticOverlayEvidenceRefs(profile: FormatProfileRecord): string[] {
  const output = getAcceptedSemanticOverlay(profile)?.output
  if (!output) return []
  const claims = [output.documentKind, ...output.structureInterpretation, ...output.styleInterpretation, ...output.generationGuidance, ...output.warnings].filter((item): item is OverlayClaim => Boolean(item))
  const ruleRefs = (output.formatRuleSynthesis ?? []).flatMap((ruleItem) => [
    ...ruleItem.evidenceRefs,
    ...(ruleItem.attributes ?? []).flatMap((attribute) => attribute.evidenceRefs ?? ruleItem.evidenceRefs),
  ])
  return Array.from(new Set([...claims.flatMap((claim) => claim.evidenceRefs), ...ruleRefs])).slice(0, 24)
}

export function appendAudit(
  existing: SemanticOverlayAuditEntry[] | undefined,
  entry: Omit<SemanticOverlayAuditEntry, "id">,
): SemanticOverlayAuditEntry[] {
  return [
    ...(existing ?? []),
    { ...entry, id: `overlay_audit_${entry.at}_${Math.random().toString(36).slice(2, 8)}` },
  ].slice(-maxAuditEntries)
}

export function expireInterruptedRunningOverlay(profile: FormatProfileRecord, now = Date.now()): FormatProfileRecord {
  const overlay = profile.semanticOverlay
  if (!overlay || overlay.status !== "running") return profile
  const key = buildSemanticOverlayKey(profile)
  const auditTrail = appendAudit(overlay.auditTrail, {
    at: now,
    event: "failed",
    status: "failed",
    reason: "interrupted",
    key,
    providerId: overlay.provenance.providerId,
    modelId: overlay.provenance.modelId,
  })
  return {
    ...profile,
    semanticOverlay: {
      ...overlay,
      status: "failed",
      key,
      output: undefined,
      fallbackReason: "interrupted",
      provenance: { ...overlay.provenance, completedAt: overlay.provenance.completedAt ?? now },
      auditTrail,
    },
  }
}

export function createRunningSemanticOverlay(profile: FormatProfileRecord, config: LlmConfig, timeoutMs: number, now = Date.now()): FormatProfileSemanticOverlayState {
  const key = buildSemanticOverlayKey(profile)
  const provenance: SemanticOverlayProvenance = {
    key,
    dataScope: "evidence-only",
    overlaySchemaVersion,
    evaluatorSchemaVersion,
    providerId: config.provider,
    ...(config.model ? { modelId: config.model } : {}),
    requestSettings: { temperature: 0, maxTokens: 3600, timeoutMs },
    startedAt: now,
  }
  return {
    status: "running",
    key,
    dataScope: "evidence-only",
    provenance,
    auditTrail: appendAudit([], {
      at: now,
      event: "started",
      status: "running",
      key,
      providerId: config.provider,
      modelId: config.model || undefined,
    }),
  }
}

export function completeSemanticOverlay(
  running: FormatProfileSemanticOverlayState,
  result: OverlayProviderResult,
  evidenceIds: Set<string>,
  now = Date.now(),
): FormatProfileSemanticOverlayState {
  const common = {
    ...running,
    provenance: { ...running.provenance, completedAt: now },
  }
  if (result.status !== "completed") {
    const reason = result.status === "cancelled" ? "cancelled" : result.reason
    return {
      ...common,
      status: "failed",
      output: undefined,
      fallbackReason: reason,
      ...(result.status === "failed" && result.message ? { fallbackMessage: result.message.slice(0, 500) } : {}),
      auditTrail: appendAudit(running.auditTrail, {
        at: now,
        event: result.status === "cancelled" ? "cancelled" : "failed",
        status: "failed",
        reason,
        key: running.key,
        providerId: result.providerId,
        modelId: result.modelId,
      }),
    }
  }

  const evaluated = parseAndEvaluateSemanticOverlay(result.text, evidenceIds)
  if (evaluated.output && evaluated.report.status === "accepted") {
    return {
      ...common,
      status: "accepted",
      output: evaluated.output,
      evaluatorReport: evaluated.report,
      fallbackReason: undefined,
      auditTrail: appendAudit(running.auditTrail, {
        at: now,
        event: "accepted",
        status: "accepted",
        key: running.key,
        providerId: result.providerId,
        modelId: result.modelId,
        evaluatorStatus: "accepted",
        evidenceRefs: semanticOutputEvidenceRefs(evaluated.output),
      }),
    }
  }
  return {
    ...common,
    status: "rejected",
    output: undefined,
    evaluatorReport: evaluated.report,
    fallbackReason: evaluated.report.fallbackReason ?? "evaluator-rejected",
    fallbackMessage: formatOverlayRejectionDiagnostic(evaluated.report, result.text),
    auditTrail: appendAudit(running.auditTrail, {
      at: now,
      event: "rejected",
      status: "rejected",
      reason: evaluated.report.fallbackReason ?? "evaluator-rejected",
      key: running.key,
      providerId: result.providerId,
      modelId: result.modelId,
      evaluatorStatus: "rejected",
    }),
  }
}

export function formatOverlayRejectionDiagnostic(report: OverlayEvaluatorReport, rawText: string): string {
  const violations = report.violations.slice(0, 8).map((item, index) => {
    const claim = item.claimId ? ` claim=${item.claimId}` : ""
    return `${index + 1}. ${item.code}${claim}: ${item.message}`
  })
  const normalizedOutput = rawText.replace(/\s+/g, " ").trim()
  const outputPreview = normalizedOutput.length > 800 ? `${normalizedOutput.slice(0, 800)}...` : normalizedOutput
  return [
    "Evaluator violations:",
    ...(violations.length ? violations : ["- no detailed violations recorded"]),
    "",
    "Model output preview:",
    outputPreview || "(empty)",
  ].join("\n")
}

function semanticOutputEvidenceRefs(output: LLMOverlayOutput): string[] {
  const claims = [output.documentKind, ...output.structureInterpretation, ...output.styleInterpretation, ...output.generationGuidance, ...output.warnings].filter((item): item is OverlayClaim => Boolean(item))
  const ruleRefs = (output.formatRuleSynthesis ?? []).flatMap((ruleItem) => [
    ...ruleItem.evidenceRefs,
    ...(ruleItem.attributes ?? []).flatMap((attribute) => attribute.evidenceRefs ?? ruleItem.evidenceRefs),
  ])
  return Array.from(new Set([...claims.flatMap((claim) => claim.evidenceRefs), ...ruleRefs])).slice(0, 24)
}

export function shouldAllowSemanticOverlayRequest(config: Pick<LlmConfig, "provider" | "apiKey">): boolean {
  return hasUsableLlm(config)
}

export async function requestSemanticOverlayCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { timeoutMs?: number; signal?: AbortSignal; requestOverrides?: RequestOverrides } = {},
): Promise<OverlayProviderResult> {
  const started = Date.now()
  const timeoutMs = options.timeoutMs ?? 300_000
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true })
  }
  let output = ""
  try {
    await new Promise<void>((resolve, reject) => {
      void streamChat(
        config,
        messages,
        {
          onToken: (token) => { output += token },
          onDone: () => resolve(),
          onError: (error) => reject(error),
        },
        controller.signal,
        options.requestOverrides ?? { temperature: 0, max_tokens: 3600, reasoning: { mode: "off" } },
      )
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (timedOut) return { status: "failed", reason: "timeout", providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
    if (options.signal?.aborted) return { status: "cancelled", reason: "cancelled", providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
    return { status: "failed", reason: "provider-error", message: err instanceof Error ? err.message : String(err), providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
  }
  clearTimeout(timeoutId)
  if (timedOut) return { status: "failed", reason: "timeout", providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
  if (options.signal?.aborted || controller.signal.aborted) return { status: "cancelled", reason: "cancelled", providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
  if (!output.trim()) return { status: "failed", reason: "empty-response", providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
  return { status: "completed", text: output.trim(), providerId: config.provider, modelId: config.model || undefined, elapsedMs: Date.now() - started }
}
