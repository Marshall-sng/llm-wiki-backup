import type { FormatProfileSemanticOverlayState, SemanticOverlayStatus } from "@/lib/format-profile-semantic-overlay"
import type { StyleFactsEnvelope } from "@/lib/style-facts"

export type FormatProfileFileType = "docx" | "xlsx" | "pptx" | "pdf" | "unknown"
export type FormatProfileConfidence = "high" | "medium" | "low"
export type FormatDiagnosticSeverity = "info" | "warning" | "error"

export interface MessageReference {
  title: string
  path: string
}

export interface FormatProfileDiagnostic {
  id: string
  severity: FormatDiagnosticSeverity
  message: string
  recommendation?: string
}

export interface FormatProfileSection {
  title: string
  level?: number
  evidence: "markdown-heading" | "numbered-line" | "short-line" | "probe-heading" | "worksheet" | "slide" | "page"
}

export type FormatSpecRuleSource = "detected" | "inferred" | "standard-default"

export interface FormatSpecRuleAttribute {
  name: string
  value: string
  unit?: string
  confidence?: FormatProfileConfidence
  evidenceRefs?: string[]
}

export interface FormatSpecRule {
  id: string
  target: string
  normType?: string
  rule: string
  detail: string
  source: FormatSpecRuleSource
  confidence: FormatProfileConfidence
  evidenceRefs?: string[]
  attributes?: FormatSpecRuleAttribute[]
}

export interface FormatSpecContentLeakagePolicy {
  includeSourceBodyText: false
  includeRawEvidenceDump: false
  promptMayIncludeEvidenceIds: false
}

export interface FormatSpecSnapshot {
  schemaVersion: string
  rendererVersion: string
  policyVersion: string
  sourceFileType: FormatProfileFileType
  documentIntent: string
  confidence: FormatProfileConfidence
  contentLeakagePolicy: FormatSpecContentLeakagePolicy
  boundaries: string[]
  rules: FormatSpecRule[]
  promptBlock: string
  summaryLines: string[]
}

export interface EditableFormatSpecOverride {
  schemaVersion: "editable-format-constraints.v0"
  sourceFormatSpecHash: string
  promptBlock: string
  updatedAt: number
  editedBy: "user"
}

export interface DraftProcessingFormatProfileSnapshot {
  id: string
  title: string
  fileType: FormatProfileFileType
  confidence: FormatProfileConfidence
  capturedAt: number
  sourceProfileHash: string
  formatSpecHash: string
  diagnostics: FormatProfileDiagnostic[]
  formatSpec: FormatSpecSnapshot
  styleFactsSha256?: string
  styleFactsSchemaVersion?: "format-profile-style-facts.v0"
  dataScope?: "evidence-only"
  semanticStatus?: SemanticOverlayStatus
  legacyGenerationInstruction?: string
  /** @deprecated use sourceProfileHash and formatSpecHash */
  profileSnapshotHash?: string
  /** @deprecated compatibility only; draft-processing must not render this field */
  generationInstruction?: string
  /** @deprecated compatibility only; draft-processing must not render this field */
  styleFactsSummary?: string[]
  /** @deprecated compatibility only; draft-processing must not render this field */
  semanticOverlaySummary?: string[]
}

export interface DraftProcessingContext {
  draftId: string
  draftTitle: string
  parentContentHash: string
  instruction: string
  references: MessageReference[]
  startedAt: number
  formatProfileSnapshot?: DraftProcessingFormatProfileSnapshot
}

export interface DraftProcessingAssistantMessage {
  conversationId: string
}

export interface FormatProfileRecord {
  id: string
  title: string
  sourceName: string
  sourcePath?: string
  fileType: FormatProfileFileType
  sourceKind: "finished-file"
  documentKind: string
  confidence: FormatProfileConfidence
  importedAt: number
  updatedAt: number
  structureProfile: {
    sectionPattern: string
    sections: FormatProfileSection[]
    evidenceSummary: string[]
    formatSpecific?: Record<string, unknown>
  }
  styleProfile: {
    toneHints: string[]
    layoutHints: string[]
    confidence?: FormatProfileConfidence
    typography?: Record<string, unknown>
    layout?: Record<string, unknown>
    colors?: Record<string, unknown>
    formatSpecific?: Record<string, unknown>
    evidenceSummary?: string[]
  }
  styleFacts?: StyleFactsEnvelope
  semanticOverlay?: FormatProfileSemanticOverlayState
  editableFormatSpec?: EditableFormatSpecOverride
  refinement?: {
    semanticStatus: SemanticOverlayStatus
    dataScope: "evidence-only"
  }
  writingProfile: {
    generationInstruction: string
    constraints: string[]
  }
  diagnostics: FormatProfileDiagnostic[]
  textSample: string
}
