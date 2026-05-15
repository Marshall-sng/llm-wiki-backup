import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx"
import JSZip from "jszip"

import { buildDocxExportContract, containsForbiddenDocxExportLeakage } from "../../../src/lib/docx-export-contract.ts"
import type { DocxExportContract } from "../../../src/lib/docx-export-contract.ts"
import { buildDocxExportRecord } from "../../../src/lib/docx-export-record.ts"
import { buildDocxIntermediateDocument } from "../../../src/lib/docx-intermediate.ts"
import type { DocxIntermediateBlock, DocxIntermediateDocument } from "../../../src/lib/docx-intermediate.ts"
import { reviewDocxExport } from "../../../src/lib/docx-match-review.ts"
import type { DocxAdapterResultLike, DocxMatchReview } from "../../../src/lib/docx-match-review.ts"
import { createDocxExportDraft, createDocxFormatProfileSnapshot } from "../../../src/test-helpers/docx-export-fixtures.ts"

type Risk = "low" | "medium" | "high"
type LicenseRisk = Risk | "unknown"
type Verdict = "pass" | "warn" | "fail"

interface StructuralAssertion {
  id: string
  passed: boolean
  count?: number
  hash?: string
  issueCode?: string
}

interface CandidateReport {
  adapterResult: DocxAdapterResultLike
  capabilities: string[]
  unsupportedCapabilities: string[]
  validationResult: {
    packageParts: string[]
    structuralAssertions: StructuralAssertion[]
    validationErrorCodes: string[]
    knownWarningCodes: string[]
  }
  reviewSummary: {
    verdict: "pass" | "warn" | "fail"
    blockingIssueCodes: string[]
    warningCodes: string[]
  }
  recordSummary: {
    status: "success" | "warning" | "failed"
    exportContractHash: string
    intermediateHash: string
    adapterId: string
  }
  packagingRisk: Risk
  licenseRisk: LicenseRisk
  maintenanceRisk: Risk
  runtimeCost: Risk
  evidenceSummary: Array<{ assertionId: string; result: Verdict; summary: string }>
  rejectedAlternatives: string[]
  tested: string[]
  notTested: string[]
  scopeRisk: "narrow" | "moderate" | "broad"
  confidence: "low" | "medium" | "high"
  recommendation: {
    status: "non-binding"
    nextStepOnly: true
    summary: string
  }
}

interface SharedInput {
  contract: DocxExportContract
  intermediate: DocxIntermediateDocument
}

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const artifactsDir = path.join(experimentRoot, "artifacts")
const reportsDir = path.join(experimentRoot, "reports")
const fixturesDir = path.join(experimentRoot, "fixtures")
const forbiddenKeys = new Set(["rawSourceText", "sourceBodyText", "fullText", "rawEvidenceDump", "sourceText", "rawXml", "documentXml"])

function ensureCleanDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function parseArgs() {
  const adapterFlagIndex = process.argv.indexOf("--adapter")
  const adapter = adapterFlagIndex >= 0 ? process.argv[adapterFlagIndex + 1] : "all"
  if (!new Set(["ts-docx", "openxml", "all"]).has(adapter)) {
    throw new Error(`Unknown adapter: ${adapter}`)
  }
  return adapter as "ts-docx" | "openxml" | "all"
}

function createSharedInput(): SharedInput {
  const draft = createDocxExportDraft()
  const formatProfileSnapshot = createDocxFormatProfileSnapshot()
  const contract = buildDocxExportContract({ draft, formatProfileSnapshot, exportId: "slice-b-shared-fixture", now: 1_715_734_400_000 })
  const intermediate = buildDocxIntermediateDocument({ draft, formatProfileSnapshot })
  return { contract, intermediate }
}

function writeSharedFixture(shared: SharedInput) {
  ensureCleanDir(fixturesDir)
  writeFileSync(path.join(fixturesDir, "shared-input.json"), JSON.stringify(shared, null, 2), "utf-8")
}

function textRun(text: string, options: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text, bold: options.bold, size: options.size ?? 31, font: "FangSong" })
}

function paragraphForBlock(block: DocxIntermediateBlock): Paragraph | null {
  if (block.type === "documentTitle") {
    return new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [textRun(block.text, { bold: true, size: 44 })] })
  }
  if (block.type === "heading") {
    return new Paragraph({ heading: block.level <= 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [textRun(block.text, { bold: true, size: block.level <= 1 ? 32 : 31 })] })
  }
  if (block.type === "paragraph") return new Paragraph({ children: [textRun(block.text)] })
  return null
}

async function runTsDocxAdapter(shared: SharedInput): Promise<DocxAdapterResultLike> {
  const outputPath = path.join(artifactsDir, "ts-docx", "output.docx")
  ensureCleanDir(path.dirname(outputPath))
  const children: Array<Paragraph | Table> = []

  for (const block of shared.intermediate.blocks) {
    const paragraph = paragraphForBlock(block)
    if (paragraph) {
      children.push(paragraph)
      continue
    }
    if (block.type === "list") {
      for (const item of block.items) {
        children.push(new Paragraph({ children: [textRun(item)], numbering: { reference: block.ordered ? "ordered-list" : "bullet-list", level: 0 } }))
      }
      continue
    }
    if (block.type === "table") {
      children.push(new Table({
        rows: [
          new TableRow({ children: block.columns.map((column) => new TableCell({ children: [new Paragraph({ children: [textRun(column, { bold: true })] })] })) }),
          ...block.rows.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: [textRun(cell)] })] })) })),
        ],
      }))
    }
  }

  const document = new Document({
    title: shared.contract.draftTitle,
    creator: "docx-adapter-comparison",
    numbering: {
      config: [
        { reference: "ordered-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }] },
        { reference: "bullet-list", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT }] },
      ],
    },
    styles: {
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 44, bold: true, font: "FangSong" } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "FangSong" } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 31, bold: true, font: "FangSong" } },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  })
  const buffer = await Packer.toBuffer(document)
  writeFileSync(outputPath, buffer)
  return { adapterId: "ts-docx", outputPath, sizeBytes: statSync(outputPath).size, validationErrors: [], knownWarnings: ["cjk-style-fidelity-not-manually-opened"] }
}

function runOpenXmlAdapter(shared: SharedInput): DocxAdapterResultLike {
  const outputPath = path.join(artifactsDir, "openxml", "output.docx")
  const inputPath = path.join(artifactsDir, "openxml", "input.json")
  ensureCleanDir(path.dirname(outputPath))
  writeFileSync(inputPath, JSON.stringify(shared, null, 2), "utf-8")
  try {
    execFileSync("dotnet", ["run", "--project", path.join(experimentRoot, "adapters", "openxml-sidecar", "OpenXmlSidecar.csproj"), "--", inputPath, outputPath], {
      cwd: experimentRoot,
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 120_000,
    })
    return { adapterId: "openxml-sidecar", outputPath, sizeBytes: statSync(outputPath).size, validationErrors: [], knownWarnings: ["sidecar-runtime-cost-requires-product-assessment"] }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown sidecar error"
    return { adapterId: "openxml-sidecar", outputPath, sizeBytes: existsSync(outputPath) ? statSync(outputPath).size : 0, validationErrors: [`sidecar-execution-failed:${sha256(message).slice(0, 12)}`], knownWarnings: [] }
  }
}

async function readDocxParts(outputPath: string | undefined) {
  if (!outputPath || !existsSync(outputPath)) throw new Error("missing-output-docx")
  const zip = await JSZip.loadAsync(readFileSync(outputPath))
  const parts = Object.keys(zip.files).filter((part) => !zip.files[part].dir).sort()
  const documentXml = await zip.file("word/document.xml")?.async("string")
  const numberingXml = await zip.file("word/numbering.xml")?.async("string")
  const stylesXml = await zip.file("word/styles.xml")?.async("string")
  return { parts, documentXml: documentXml ?? "", numberingXml: numberingXml ?? "", stylesXml: stylesXml ?? "" }
}

function countAll(xml: string, values: string[]): number {
  return values.reduce((count, value) => count + (xml.includes(value) ? 1 : 0), 0)
}

function countRegex(xml: string, pattern: RegExp): number {
  return [...xml.matchAll(pattern)].length
}

function assertion(id: string, passed: boolean, count?: number, issueCode?: string, hash?: string): StructuralAssertion {
  return { id, passed, ...(typeof count === "number" ? { count } : {}), ...(issueCode ? { issueCode } : {}), ...(hash ? { hash } : {}) }
}

async function validateDocx(adapterResult: DocxAdapterResultLike, shared: SharedInput) {
  const validationErrors = [...(adapterResult.validationErrors ?? [])]
  const knownWarnings = [...(adapterResult.knownWarnings ?? [])]
  const structuralAssertions: StructuralAssertion[] = []
  let packageParts: string[] = []
  try {
    const { parts, documentXml, numberingXml, stylesXml } = await readDocxParts(adapterResult.outputPath)
    packageParts = parts
    for (const requiredPart of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
      if (!parts.includes(requiredPart)) validationErrors.push(`missing-package-part:${requiredPart}`)
    }
    if (!parts.includes("word/styles.xml")) knownWarnings.push("styles-part-missing")
    if (!parts.includes("word/numbering.xml")) validationErrors.push("numbering-part-missing")

    const titleCount = countAll(documentXml, ["云南省数据流通利用基础设施平台介绍"])
    structuralAssertions.push(assertion("document-title-present", titleCount > 0, titleCount, titleCount > 0 ? undefined : "missing-document-title", sha256(String(titleCount))))

    const sectionCount = countAll(documentXml, ["一、背景", "二、平台架构", "三、目的与意义"])
    structuralAssertions.push(assertion("level1-headings-present", sectionCount >= 3, sectionCount, sectionCount >= 3 ? undefined : "missing-level1-heading", sha256(String(sectionCount))))

    const subsectionCount = countAll(documentXml, ["（一）国家全域节点"])
    structuralAssertions.push(assertion("level2-heading-present", subsectionCount > 0, subsectionCount, subsectionCount > 0 ? undefined : "missing-level2-heading", sha256(String(subsectionCount))))

    const paragraphCount = countAll(documentXml, ["随着国家层面", "国家全域节点负责", "平台将为数据流通利用提供公共服务"])
    structuralAssertions.push(assertion("paragraph-content-present", paragraphCount >= 3, paragraphCount, paragraphCount >= 3 ? undefined : "missing-paragraph-content", sha256(String(paragraphCount))))

    const listCount = countRegex(documentXml, /<w:numPr>/g)
    const hasDecimal = /w:val="decimal"/.test(numberingXml)
    const hasBullet = /w:val="bullet"/.test(numberingXml)
    structuralAssertions.push(assertion("ordered-list-distinguishable", hasDecimal && listCount >= 2, listCount, hasDecimal && listCount >= 2 ? undefined : "ordered-list-not-distinguishable", sha256(`${hasDecimal}:${listCount}`)))
    structuralAssertions.push(assertion("unordered-list-distinguishable", hasBullet && listCount >= 4, listCount, hasBullet && listCount >= 4 ? undefined : "unordered-list-not-distinguishable", sha256(`${hasBullet}:${listCount}`)))

    const tableCount = countRegex(documentXml, /<w:tbl>/g)
    const tableRowCount = countRegex(documentXml, /<w:tr>/g)
    const tableCellCount = countRegex(documentXml, /<w:tc>/g)
    const tablePassed = tableCount >= 1 && tableRowCount >= 2 && tableCellCount >= 4
    structuralAssertions.push(assertion("simple-table-shape", tablePassed, tableCellCount, tablePassed ? undefined : "table-shape-mismatch", sha256(`${tableCount}:${tableRowCount}:${tableCellCount}`)))

    const styleEvidenceCount = countRegex(documentXml + stylesXml, /Heading1|Heading2|Title|FangSong/g)
    structuralAssertions.push(assertion("style-or-font-evidence", styleEvidenceCount > 0, styleEvidenceCount, styleEvidenceCount > 0 ? undefined : "style-evidence-missing", sha256(String(styleEvidenceCount))))
  } catch (error) {
    validationErrors.push(`docx-probe-exception:${sha256(error instanceof Error ? error.message : String(error)).slice(0, 12)}`)
  }

  for (const failed of structuralAssertions.filter((item) => !item.passed)) {
    validationErrors.push(failed.issueCode ?? `assertion-failed:${failed.id}`)
  }
  return { packageParts, structuralAssertions, validationErrorCodes: [...new Set(validationErrors)], knownWarningCodes: [...new Set(knownWarnings)] }
}

function assertNoLeakage(report: unknown, shared: SharedInput) {
  if (containsForbiddenDocxExportLeakage(report)) throw new Error("report contains forbidden leakage keys")
  const lines = shared.intermediate.blocks.flatMap((block) => {
    if (block.type === "documentTitle" || block.type === "heading" || block.type === "paragraph") return [block.text]
    if (block.type === "list") return block.items
    if (block.type === "table") return [...block.columns, ...block.rows.flat()]
    return []
  }).filter((line) => line.length >= 12)
  function visit(value: unknown, keyPath: string[] = []) {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...keyPath, String(index)]))
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        if (forbiddenKeys.has(key)) throw new Error(`forbidden report key:${key}`)
        visit(nested, [...keyPath, key])
      }
      return
    }
    if (typeof value !== "string") return
    const joinedPath = keyPath.join(".")
    if (/<\/?w:|<\?xml|<document|<pkg:/i.test(value)) throw new Error(`raw XML leaked at ${joinedPath}`)
    if (joinedPath.endsWith("packageParts") || joinedPath.includes("outputPath")) return
    for (const line of lines) {
      if (value.includes(line)) throw new Error(`source text leaked at ${joinedPath}`)
    }
  }
  visit(report)
}

function summarizeReview(review: DocxMatchReview) {
  return {
    verdict: review.verdict,
    blockingIssueCodes: review.blockingIssues.map((item) => item.code),
    warningCodes: review.warnings.map((item) => item.code),
  }
}

function redactAdapterResult(adapterResult: DocxAdapterResultLike): DocxAdapterResultLike {
  return {
    ...adapterResult,
    ...(adapterResult.outputPath ? { outputPath: path.relative(experimentRoot, adapterResult.outputPath).replace(/\\/g, "/") } : {}),
  }
}

async function buildReport(shared: SharedInput, adapterResult: DocxAdapterResultLike, risk: Pick<CandidateReport, "packagingRisk" | "licenseRisk" | "maintenanceRisk" | "runtimeCost" | "scopeRisk" | "confidence">, capabilities: string[], unsupportedCapabilities: string[]): Promise<CandidateReport> {
  const validationResult = await validateDocx(adapterResult, shared)
  const normalizedAdapterResult: DocxAdapterResultLike = {
    ...adapterResult,
    validationErrors: validationResult.validationErrorCodes,
    knownWarnings: validationResult.knownWarningCodes,
  }
  const review = reviewDocxExport({ contract: shared.contract, intermediate: shared.intermediate, adapterResult: normalizedAdapterResult })
  const record = buildDocxExportRecord({ contract: shared.contract, intermediate: shared.intermediate, adapterResult: normalizedAdapterResult, review, now: Date.now() })
  const report: CandidateReport = {
    adapterResult: redactAdapterResult(normalizedAdapterResult),
    capabilities,
    unsupportedCapabilities,
    validationResult,
    reviewSummary: summarizeReview(review),
    recordSummary: {
      status: record.status,
      exportContractHash: record.exportContractHash,
      intermediateHash: record.intermediateHash,
      adapterId: record.adapterId,
    },
    ...risk,
    evidenceSummary: validationResult.structuralAssertions.map((item) => ({ assertionId: item.id, result: item.passed ? "pass" : "fail", summary: item.passed ? "redacted structural assertion passed" : "redacted structural assertion failed" })),
    rejectedAlternatives: ["external-template-route", "direct-ui-export-button"],
    tested: ["shared-contract-built", "shared-intermediate-built", "docx-package-probed", "structural-assertions-probed", "match-review-built", "export-record-built", "redacted-report-leakage-scan"],
    notTested: ["manual-word-openability", "desktop-save-flow", "product-dependency-integration", "high-fidelity-style-replica"],
    recommendation: { status: "non-binding", nextStepOnly: true, summary: "Use this evidence only for the next Slice C adapter-selection plan; do not treat it as final adapter choice." },
  }
  assertNoLeakage(report, shared)
  return report
}

function writeReport(adapterId: string, report: CandidateReport) {
  ensureCleanDir(reportsDir)
  writeFileSync(path.join(reportsDir, `${adapterId}.json`), JSON.stringify(report, null, 2), "utf-8")
  const md = [
    `# ${adapterId} redacted comparison report`,
    "",
    `- Verdict: ${report.reviewSummary.verdict}`,
    `- Record status: ${report.recordSummary.status}`,
    `- Validation errors: ${report.validationResult.validationErrorCodes.length}`,
    `- Known warnings: ${report.validationResult.knownWarningCodes.length}`,
    `- Packaging risk: ${report.packagingRisk}`,
    `- Runtime cost: ${report.runtimeCost}`,
    `- License risk: ${report.licenseRisk}`,
    `- Confidence: ${report.confidence}`,
    "",
    "## Structural Assertions",
    ...report.validationResult.structuralAssertions.map((item) => `- ${item.id}: ${item.passed ? "PASS" : "FAIL"}${typeof item.count === "number" ? ` (count=${item.count})` : ""}${item.issueCode ? ` (${item.issueCode})` : ""}`),
    "",
    "Recommendation: non-binding; Slice C must make a separate adapter decision.",
  ].join("\n")
  assertNoLeakage(md, createSharedInput())
  writeFileSync(path.join(reportsDir, `${adapterId}.md`), md, "utf-8")
}

function writeAggregate(reports: CandidateReport[]) {
  const aggregate = {
    schemaVersion: "docx-adapter-comparison-report.v0",
    generatedAt: new Date().toISOString(),
    status: "non-binding-comparison-complete",
    adapters: reports.map((report) => ({
      adapterId: report.adapterResult.adapterId,
      verdict: report.reviewSummary.verdict,
      recordStatus: report.recordSummary.status,
      validationErrorCount: report.validationResult.validationErrorCodes.length,
      knownWarningCount: report.validationResult.knownWarningCodes.length,
      packagingRisk: report.packagingRisk,
      runtimeCost: report.runtimeCost,
      licenseRisk: report.licenseRisk,
      confidence: report.confidence,
    })),
    nextStep: "Slice C may use this redacted report to choose an adapter in a separate plan; this report does not choose one.",
  }
  assertNoLeakage(aggregate, createSharedInput())
  writeFileSync(path.join(reportsDir, "summary.json"), JSON.stringify(aggregate, null, 2), "utf-8")
  const md = [
    "# DOCX Adapter Comparison Summary",
    "",
    "Status: non-binding comparison complete; no final adapter selected.",
    "",
    "| Adapter | Verdict | Record | Validation Errors | Warnings | Packaging Risk | Runtime Cost |",
    "| --- | --- | --- | ---: | ---: | --- | --- |",
    ...aggregate.adapters.map((adapter) => `| ${adapter.adapterId} | ${adapter.verdict} | ${adapter.recordStatus} | ${adapter.validationErrorCount} | ${adapter.knownWarningCount} | ${adapter.packagingRisk} | ${adapter.runtimeCost} |`),
    "",
    aggregate.nextStep,
  ].join("\n")
  assertNoLeakage(md, createSharedInput())
  writeFileSync(path.join(reportsDir, "summary.md"), md, "utf-8")
}

async function run(adapter: "ts-docx" | "openxml" | "all") {
  ensureCleanDir(artifactsDir)
  ensureCleanDir(reportsDir)
  const shared = createSharedInput()
  writeSharedFixture(shared)
  const reports: CandidateReport[] = []

  if (adapter === "ts-docx" || adapter === "all") {
    const adapterResult = await runTsDocxAdapter(shared)
    const report = await buildReport(shared, adapterResult, { packagingRisk: "medium", licenseRisk: "low", maintenanceRisk: "medium", runtimeCost: "low", scopeRisk: "narrow", confidence: "medium" }, ["document-title", "heading", "paragraph", "ordered-list", "unordered-list", "simple-table", "basic-styles"], ["manual-word-openability", "high-fidelity-replica"])
    writeReport("ts-docx", report)
    reports.push(report)
  }

  if (adapter === "openxml" || adapter === "all") {
    const adapterResult = runOpenXmlAdapter(shared)
    const report = await buildReport(shared, adapterResult, { packagingRisk: "high", licenseRisk: "low", maintenanceRisk: "medium", runtimeCost: "high", scopeRisk: "moderate", confidence: adapterResult.validationErrors?.length ? "low" : "medium" }, ["document-title", "heading", "paragraph", "ordered-list", "unordered-list", "simple-table", "basic-styles", "low-level-openxml-control"], ["product-sidecar-packaging", "manual-word-openability", "high-fidelity-replica"])
    writeReport("openxml-sidecar", report)
    reports.push(report)
  }

  if (adapter === "all") writeAggregate(reports)
  console.log(JSON.stringify({ adapter, reports: reports.map((report) => ({ adapterId: report.adapterResult.adapterId, verdict: report.reviewSummary.verdict, status: report.recordSummary.status, errors: report.validationResult.validationErrorCodes.length, warnings: report.validationResult.knownWarningCodes.length })) }, null, 2))
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("run-comparison.ts")) {
  const adapter = parseArgs()
  run(adapter).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
