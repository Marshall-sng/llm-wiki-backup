import type { DocxExportContract, DocxExportRule } from "@/lib/docx-export-contract"
import { containsForbiddenDocxExportLeakage, isDocxFormatRuleBlockCoverable } from "@/lib/docx-export-contract"
import type { DocxIntermediateDocument } from "@/lib/docx-intermediate"

export const DOCX_MATCH_REVIEW_VERSION = "docx-match-review.v0" as const

export interface DocxValidationReview {
  outputPath?: string
  sizeBytes?: number
  validationErrors: string[]
  knownWarnings: string[]
}

export interface DocxAdapterResultLike {
  adapterId: string
  outputPath?: string
  sizeBytes?: number
  validationErrors?: string[]
  knownWarnings?: string[]
}

export interface DocxReviewIssue {
  code: string
  message: string
  ruleId?: string
  section?: string
}

export interface DocxSectionReview {
  required: string[]
  found: string[]
  missing: string[]
}

export interface DocxFormatCoverageReview {
  requiredRules: string[]
  coveredRules: string[]
  uncoveredMust: string[]
  uncoveredShould: string[]
}

export interface DocxContentBoundaryReview {
  includeSourceBodyText: false
  includeRawEvidenceDump: false
  leakageDetected: boolean
}

export interface DocxMatchReview {
  reviewVersion: typeof DOCX_MATCH_REVIEW_VERSION
  verdict: "pass" | "warn" | "fail"
  blockingIssues: DocxReviewIssue[]
  warnings: DocxReviewIssue[]
  sectionReview: DocxSectionReview
  formatCoverage: DocxFormatCoverageReview
  contentBoundaryReview: DocxContentBoundaryReview
  docxValidation: DocxValidationReview
  auditRefs: {
    exportContractHash: string
    intermediateHash: string
    formatSpecHash?: string
    sourceProfileHash?: string
  }
}

export interface ReviewDocxExportInput {
  contract: DocxExportContract
  intermediate: DocxIntermediateDocument
  adapterResult?: DocxAdapterResultLike
}

function issue(code: string, message: string, extra: Partial<DocxReviewIssue> = {}): DocxReviewIssue {
  return { code, message, ...extra }
}

function ruleIssue(rule: DocxExportRule, code: string): DocxReviewIssue {
  return issue(code, `Format rule ${rule.id} is not covered by intermediate document blocks.`, { ruleId: rule.id })
}

function normalizedRuleText(rule: DocxExportRule): string {
  return `${rule.id} ${rule.target} ${rule.normType ?? ""}`.toLowerCase().replace(/[_\s]/g, "-")
}

function hasRuleToken(rule: DocxExportRule, ...tokens: string[]): boolean {
  const value = normalizedRuleText(rule)
  return tokens.some((token) => value === token || value.includes(token))
}

function blockTypeApplies(rule: DocxExportRule, intermediate: DocxIntermediateDocument): boolean {
  if (hasRuleToken(rule, "table")) return intermediate.blocks.some((block) => block.type === "table")
  if (hasRuleToken(rule, "ordered-list", "numbered-list", "numbering")) return intermediate.blocks.some((block) => block.type === "list" && block.ordered)
  if (hasRuleToken(rule, "unordered-list", "bullet-list", "bulleted-list")) return intermediate.blocks.some((block) => block.type === "list" && !block.ordered)
  if (hasRuleToken(rule, "list")) return intermediate.blocks.some((block) => block.type === "list")
  return true
}

export function reviewDocxExport(input: ReviewDocxExportInput): DocxMatchReview {
  const { contract, intermediate, adapterResult } = input
  const blockingIssues: DocxReviewIssue[] = []
  const warnings: DocxReviewIssue[] = []

  const foundSections = intermediate.blocks
    .filter((block) => block.type === "heading")
    .map((block) => "text" in block ? block.text : "")
    .filter(Boolean)
  const missing = contract.requiredSections.filter((section) => !foundSections.includes(section))
  for (const section of missing) {
    blockingIssues.push(issue("missing-required-section", `Required section is missing: ${section}`, { section }))
  }

  const coverableFormatRules = contract.formatRules
    .filter(isDocxFormatRuleBlockCoverable)
    .filter((rule) => blockTypeApplies(rule, intermediate))
  const coveredRules = new Set(intermediate.blocks.flatMap((block) => block.ruleRefs))
  const uncoveredMust = coverableFormatRules.filter((rule) => rule.priority === "must" && !coveredRules.has(rule.id))
  const uncoveredShould = coverableFormatRules.filter((rule) => rule.priority === "should" && !coveredRules.has(rule.id))
  blockingIssues.push(...uncoveredMust.map((rule) => ruleIssue(rule, "must-rule-uncovered")))
  warnings.push(...uncoveredShould.map((rule) => ruleIssue(rule, "should-rule-uncovered")))

  const leakageDetected = containsForbiddenDocxExportLeakage(contract) || containsForbiddenDocxExportLeakage(intermediate)
  if (leakageDetected) {
    blockingIssues.push(issue("source-leakage", "Forbidden raw source body/evidence field detected."))
  }

  const docxValidation: DocxValidationReview = {
    outputPath: adapterResult?.outputPath,
    sizeBytes: adapterResult?.sizeBytes,
    validationErrors: [...(adapterResult?.validationErrors ?? [])],
    knownWarnings: [...(adapterResult?.knownWarnings ?? [])],
  }
  for (const validationError of docxValidation.validationErrors) {
    blockingIssues.push(issue("docx-validation-error", validationError))
  }
  for (const knownWarning of docxValidation.knownWarnings) {
    warnings.push(issue("docx-validation-warning", knownWarning))
  }

  const verdict = blockingIssues.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass"
  return {
    reviewVersion: DOCX_MATCH_REVIEW_VERSION,
    verdict,
    blockingIssues,
    warnings,
    sectionReview: {
      required: [...contract.requiredSections],
      found: foundSections,
      missing,
    },
    formatCoverage: {
      requiredRules: coverableFormatRules.map((rule) => rule.id),
      coveredRules: [...coveredRules].filter((ruleId) => coverableFormatRules.some((rule) => rule.id === ruleId)),
      uncoveredMust: uncoveredMust.map((rule) => rule.id),
      uncoveredShould: uncoveredShould.map((rule) => rule.id),
    },
    contentBoundaryReview: {
      includeSourceBodyText: false,
      includeRawEvidenceDump: false,
      leakageDetected,
    },
    docxValidation,
    auditRefs: {
      exportContractHash: contract.contractHash,
      intermediateHash: intermediate.intermediateHash,
      ...(contract.formatSpecHash ? { formatSpecHash: contract.formatSpecHash } : {}),
      ...(contract.sourceProfileHash ? { sourceProfileHash: contract.sourceProfileHash } : {}),
    },
  }
}
