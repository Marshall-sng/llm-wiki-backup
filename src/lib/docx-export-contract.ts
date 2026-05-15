import type { DraftRecord } from "@/lib/draft-types"
import type { DraftProcessingFormatProfileSnapshot, FormatSpecRule } from "@/lib/format-profile-types"
import { sha256Stable } from "@/lib/style-facts"

export const DOCX_EXPORT_CONTRACT_VERSION = "docx-export-contract.v0" as const

export type DocxBlockType = "documentTitle" | "heading" | "paragraph" | "list" | "table"
export type DocxExportRulePriority = "must" | "should"

export interface DocxExportRule {
  id: string
  target: string
  normType?: string
  rule: string
  detail: string
  priority: DocxExportRulePriority
  source?: string
  confidence?: string
  evidenceRefs?: string[]
}

export interface DocxContentLeakagePolicy {
  includeSourceBodyText: false
  includeRawEvidenceDump: false
}

export interface DocxValidationPolicy {
  validationError: "fail"
  knownWarning: "warn"
}

export interface DocxExportContract {
  contractVersion: typeof DOCX_EXPORT_CONTRACT_VERSION
  exportId: string
  draftId: string
  draftTitle: string
  draftContentHash: string
  referenceCount: number
  formatProfileId?: string
  formatProfileTitle?: string
  formatSpecHash?: string
  sourceProfileHash?: string
  userInstruction?: string
  documentIntent: "formal-docx-export"
  requiredSections: string[]
  allowedBlocks: DocxBlockType[]
  formatRules: DocxExportRule[]
  contentLeakagePolicy: DocxContentLeakagePolicy
  exportBoundaries: string[]
  validationPolicy: DocxValidationPolicy
  createdAt: number
  contractHash: string
}

export interface BuildDocxExportContractInput {
  draft: DraftRecord
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
  userInstruction?: string
  requiredSections?: string[]
  exportId?: string
  now?: number
}

export const FORBIDDEN_DOCX_EXPORT_LEAKAGE_KEYS = new Set([
  "rawSourceText",
  "sourceBodyText",
  "fullText",
  "rawEvidenceDump",
  "sourceText",
])

export function containsForbiddenDocxExportLeakage(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenDocxExportLeakage)
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => (
      FORBIDDEN_DOCX_EXPORT_LEAKAGE_KEYS.has(key) || containsForbiddenDocxExportLeakage(nested)
    ))
  }
  return false
}

export function deriveDocxRequiredSections(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+\u3001/.test(line))
}

function inferPriority(rule: FormatSpecRule): DocxExportRulePriority {
  if (!isDocxFormatRuleBlockCoverable(rule)) return "should"
  const target = rule.target.toLowerCase()
  const id = rule.id.toLowerCase()
  if (
    target.includes("title") ||
    target.includes("heading") ||
    target.includes("boundary") ||
    id.includes("title") ||
    id.includes("boundary")
  ) return "must"
  return "should"
}

function normalizeRuleToken(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[_\s]/g, "-")
}

export function isDocxFormatRuleBlockCoverable(rule: Pick<DocxExportRule, "id" | "target" | "normType">): boolean {
  const tokens = [
    normalizeRuleToken(rule.id),
    normalizeRuleToken(rule.target),
    normalizeRuleToken(rule.normType),
  ].filter(Boolean)
  if (tokens.some((token) => token === "boundary" || token.endsWith("-boundary") || token.includes("-boundary-"))) {
    return false
  }
  const has = (...values: string[]) => tokens.some((token) => values.some((value) => (
    token === value || token.startsWith(`${value}-`) || token.endsWith(`-${value}`)
  )))
  return has(
    "title",
    "document-title",
    "main-title",
    "heading",
    "section-title",
    "subsection-title",
    "paragraph",
    "body-text",
    "body",
    "ordered-list",
    "unordered-list",
    "numbered-list",
    "bullet-list",
    "bulleted-list",
    "numbering",
    "list",
    "table",
  )
}

export function mapFormatSpecRuleToDocxExportRule(rule: FormatSpecRule): DocxExportRule {
  return {
    id: rule.id,
    target: rule.target,
    ...(rule.normType ? { normType: rule.normType } : {}),
    rule: rule.rule,
    detail: rule.detail,
    priority: inferPriority(rule),
    source: rule.source,
    confidence: rule.confidence,
    evidenceRefs: [...(rule.evidenceRefs ?? [])],
  }
}

export function buildDocxExportContract(input: BuildDocxExportContractInput): DocxExportContract {
  const { draft, formatProfileSnapshot } = input
  const createdAt = input.now ?? Date.now()
  const draftContentHash = draft.source.contentHash
  const base = {
    contractVersion: DOCX_EXPORT_CONTRACT_VERSION,
    exportId: input.exportId ?? `docx-export-${sha256Stable({ draftId: draft.id, draftContentHash, createdAt }).slice(0, 12)}`,
    draftId: draft.id,
    draftTitle: draft.title,
    draftContentHash,
    referenceCount: draft.references.length,
    ...(formatProfileSnapshot ? {
      formatProfileId: formatProfileSnapshot.id,
      formatProfileTitle: formatProfileSnapshot.title,
      formatSpecHash: formatProfileSnapshot.formatSpecHash,
      sourceProfileHash: formatProfileSnapshot.sourceProfileHash,
    } : {}),
    ...(input.userInstruction?.trim() ? { userInstruction: input.userInstruction.trim() } : {}),
    documentIntent: "formal-docx-export" as const,
    requiredSections: input.requiredSections ?? deriveDocxRequiredSections(draft.content),
    allowedBlocks: ["documentTitle", "heading", "paragraph", "list", "table"] as DocxBlockType[],
    formatRules: (formatProfileSnapshot?.formatSpec.rules ?? []).map(mapFormatSpecRuleToDocxExportRule),
    contentLeakagePolicy: {
      includeSourceBodyText: false,
      includeRawEvidenceDump: false,
    } as DocxContentLeakagePolicy,
    exportBoundaries: [
      "docx-only",
      "no-high-fidelity-replica",
      "no-template-file",
      ...(formatProfileSnapshot?.formatSpec.boundaries ?? []),
    ],
    validationPolicy: {
      validationError: "fail",
      knownWarning: "warn",
    } as DocxValidationPolicy,
    createdAt,
  }
  if (containsForbiddenDocxExportLeakage(base)) {
    throw new Error("DocxExportContract contains forbidden source leakage fields")
  }
  return {
    ...base,
    contractHash: sha256Stable(base),
  }
}
