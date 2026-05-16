#!/usr/bin/env node
import fs from "node:fs/promises"
import fssync from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"

const root = path.resolve("experiments/docx-first-export-contract")
const outDir = path.join(root, "outputs", "latest")
const casePath = path.join(root, "cases", "draft-format.case.json")
const preflightDocx = path.resolve("experiments/docx-export/docx-first-structured.docx")

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex")
}

function hasForbiddenLeakage(value) {
  const forbiddenKeys = new Set(["rawSourceText", "sourceBodyText", "fullText", "rawEvidenceDump", "sourceText"])
  const visit = (node) => {
    if (Array.isArray(node)) return node.some(visit)
    if (node && typeof node === "object") {
      return Object.entries(node).some(([key, val]) => forbiddenKeys.has(key) || visit(val))
    }
    return false
  }
  return visit(value)
}

function buildExportContract(testCase) {
  const { draft, formatSpec, requiredSections } = testCase
  const contract = {
    contractVersion: "docx-export-contract.v0",
    draftId: draft.id,
    draftTitle: draft.title,
    draftContentHash: draft.contentHash || sha256(draft.content),
    referenceCount: draft.references?.length ?? 0,
    formatSpecHash: formatSpec.formatSpecHash,
    sourceProfileHash: formatSpec.sourceProfileHash,
    documentIntent: "formal-docx-export",
    requiredSections,
    allowedBlocks: ["documentTitle", "heading", "paragraph", "list", "table"],
    formatRules: formatSpec.rules.map((rule) => ({
      id: rule.id,
      target: rule.target,
      priority: rule.priority,
      requirement: rule.requirement,
    })),
    contentLeakagePolicy: formatSpec.contentLeakagePolicy,
    exportBoundaries: formatSpec.exportBoundaries,
    validationPolicy: formatSpec.validationPolicy,
  }
  return { ...contract, exportContractHash: sha256(contract) }
}

function ruleForTarget(formatSpec, target) {
  return formatSpec.rules.filter((rule) => rule.target === target).map((rule) => rule.id)
}

function parseMarkdownTable(lines, start) {
  const header = lines[start]
  const sep = lines[start + 1]
  if (!header?.includes("|") || !/^\s*\|?\s*:?-{3,}:?/.test(sep || "")) return null
  const split = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
  const columns = split(header)
  const rows = []
  let index = start + 2
  while (index < lines.length && lines[index].includes("|")) {
    rows.push(split(lines[index]))
    index += 1
  }
  return { block: { type: "table", columns, rows }, next: index }
}

function parseDraftToIntermediate(testCase) {
  const { draft, formatSpec } = testCase
  const lines = draft.content.split(/\r?\n/)
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i += 1; continue }

    const table = parseMarkdownTable(lines, i)
    if (table) {
      blocks.push({ ...table.block, ruleRefs: ruleForTarget(formatSpec, "table") })
      i = table.next
      continue
    }

    const mdHeading = line.match(/^(#{1,6})\s+(.+)$/)
    if (mdHeading) {
      const level = mdHeading[1].length
      const text = mdHeading[2].trim()
      blocks.push({ type: level === 1 ? "documentTitle" : "heading", level, text, ruleRefs: ruleForTarget(formatSpec, level === 1 ? "document-title" : "section-title") })
      i += 1
      continue
    }

    if (/^[一二三四五六七八九十]+、/.test(line)) {
      blocks.push({ type: "heading", level: 1, text: line, ruleRefs: ruleForTarget(formatSpec, "section-title") })
      i += 1
      continue
    }

    if (/^（[一二三四五六七八九十]+）/.test(line)) {
      blocks.push({ type: "heading", level: 2, text: line, ruleRefs: ruleForTarget(formatSpec, "subsection-title") })
      i += 1
      continue
    }

    const orderedItems = []
    let j = i
    while (j < lines.length) {
      const m = lines[j].trim().match(/^\d+[\.、]\s*(.+)$/)
      if (!m) break
      orderedItems.push(m[1])
      j += 1
    }
    if (orderedItems.length > 0) {
      blocks.push({ type: "list", ordered: true, items: orderedItems, ruleRefs: ruleForTarget(formatSpec, "ordered-list") })
      i = j
      continue
    }

    const bulletItems = []
    j = i
    while (j < lines.length) {
      const m = lines[j].trim().match(/^[-*]\s+(.+)$/)
      if (!m) break
      bulletItems.push(m[1])
      j += 1
    }
    if (bulletItems.length > 0) {
      blocks.push({ type: "list", ordered: false, items: bulletItems, ruleRefs: [] })
      i = j
      continue
    }

    blocks.push({ type: "paragraph", text: line, ruleRefs: [] })
    i += 1
  }

  return {
    schemaVersion: "docx-intermediate-document.v0",
    sourceDraftId: draft.id,
    sourceDraftContentHash: draft.contentHash || sha256(draft.content),
    blocks,
    intermediateHash: sha256(blocks),
  }
}

async function analyzeDocxPreflight(docxPath) {
  const result = {
    docxPath,
    exists: fssync.existsSync(docxPath),
    sizeBytes: 0,
    zipEntries: 0,
    hasDocumentXml: false,
    paragraphCount: 0,
    headingStyleRefs: [],
    knownWarnings: ["orphaned relationship is defined but never referenced"],
    validationErrors: [],
  }
  if (!result.exists) {
    result.validationErrors.push("preflight DOCX file is missing")
    return result
  }
  result.sizeBytes = fssync.statSync(docxPath).size
  const extractDir = path.join(outDir, "_docx_extract")
  await fs.rm(extractDir, { recursive: true, force: true })
  await fs.mkdir(extractDir, { recursive: true })
  const zipCopy = path.join(outDir, "_preflight_docx.zip")
  await fs.copyFile(docxPath, zipCopy)
  const ps = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`], { encoding: "utf8" })
  if (ps.status !== 0) {
    result.validationErrors.push(`Expand-Archive failed: ${ps.stderr || ps.stdout}`)
    return result
  }
  const entries = []
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else entries.push(path.relative(extractDir, full).replace(/\\/g, "/"))
    }
  }
  await walk(extractDir)
  result.zipEntries = entries.length
  const documentXmlPath = path.join(extractDir, "word", "document.xml")
  result.hasDocumentXml = fssync.existsSync(documentXmlPath)
  if (!result.hasDocumentXml) {
    result.validationErrors.push("word/document.xml missing")
    return result
  }
  const xml = await fs.readFile(documentXmlPath, "utf8")
  result.paragraphCount = (xml.match(/<w:p[\s>]/g) || []).length
  result.headingStyleRefs = [...xml.matchAll(/<w:pStyle[^>]+w:val="([^"]*Heading[^"]*)"/g)].map((m) => m[1])
  await fs.rm(extractDir, { recursive: true, force: true })
  await fs.rm(zipCopy, { force: true })
  return result
}

function review({ contract, intermediate, docxPreflight, mutate = "positive" }) {
  const c = structuredClone(contract)
  const d = structuredClone(intermediate)
  const p = structuredClone(docxPreflight)

  if (mutate === "missing-section") {
    d.blocks = d.blocks.filter((block) => block.text !== "二、导出合同")
  }
  if (mutate === "missing-format-coverage") {
    for (const block of d.blocks) block.ruleRefs = []
  }
  if (mutate === "source-leakage") {
    c.rawSourceText = "FORBIDDEN SOURCE BODY TEXT"
  }
  if (mutate === "validation-error") {
    p.validationErrors.push("simulated invalid OpenXML element order")
  }

  const blockingIssues = []
  const warnings = []

  if (hasForbiddenLeakage(c)) blockingIssues.push({ code: "source-leakage", message: "contract contains forbidden raw source body/evidence field" })
  if (hasForbiddenLeakage(d)) blockingIssues.push({ code: "intermediate-source-leakage", message: "intermediate contains forbidden raw source body/evidence field" })

  const headingTexts = d.blocks.filter((b) => b.type === "heading").map((b) => b.text)
  for (const section of c.requiredSections) {
    if (!headingTexts.includes(section)) blockingIssues.push({ code: "missing-required-section", section })
  }

  const allRuleIds = new Set(c.formatRules.map((rule) => rule.id))
  const coveredRuleIds = new Set(d.blocks.flatMap((block) => block.ruleRefs || []))
  const uncoveredMust = c.formatRules.filter((rule) => rule.priority === "must" && !coveredRuleIds.has(rule.id))
  const uncoveredShould = c.formatRules.filter((rule) => rule.priority !== "must" && !coveredRuleIds.has(rule.id))
  for (const rule of uncoveredMust) blockingIssues.push({ code: "must-rule-uncovered", ruleId: rule.id })
  for (const rule of uncoveredShould) warnings.push({ code: "should-rule-uncovered", ruleId: rule.id })

  if (!p.exists || p.sizeBytes <= 0 || !p.hasDocumentXml) blockingIssues.push({ code: "docx-preflight-invalid", message: "preflight docx missing or unreadable" })
  for (const error of p.validationErrors) blockingIssues.push({ code: "docx-validation-error", message: error })
  for (const warning of p.knownWarnings) warnings.push({ code: "docx-validation-warning", message: warning })

  const verdict = blockingIssues.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass"
  return {
    reviewVersion: "docx-match-review.v0",
    scenario: mutate,
    verdict,
    blockingIssues,
    warnings,
    sectionReview: {
      required: c.requiredSections,
      found: headingTexts,
      missing: c.requiredSections.filter((section) => !headingTexts.includes(section)),
    },
    formatCoverage: {
      requiredRules: [...allRuleIds],
      coveredRules: [...coveredRuleIds],
      uncoveredMust: uncoveredMust.map((rule) => rule.id),
      uncoveredShould: uncoveredShould.map((rule) => rule.id),
    },
    contentBoundaryReview: {
      includeSourceBodyText: c.contentLeakagePolicy?.includeSourceBodyText ?? null,
      includeRawEvidenceDump: c.contentLeakagePolicy?.includeRawEvidenceDump ?? null,
      leakageDetected: hasForbiddenLeakage(c) || hasForbiddenLeakage(d),
    },
    docxValidation: p,
    auditRefs: {
      exportContractHash: c.exportContractHash,
      intermediateHash: d.intermediateHash,
      formatSpecHash: c.formatSpecHash,
      sourceProfileHash: c.sourceProfileHash,
    },
  }
}

function evaluate(reviews, contract, intermediate, docxPreflight) {
  const checks = []
  const add = (id, pass, detail) => checks.push({ id, pass, detail })
  add("contract-required-fields", ["contractVersion", "draftId", "draftContentHash", "formatSpecHash", "sourceProfileHash", "formatRules", "contentLeakagePolicy", "exportBoundaries", "validationPolicy"].every((key) => contract[key] !== undefined), "contract has required fields")
  add("contract-no-source-leakage", !hasForbiddenLeakage(contract), "contract excludes raw source body fields")
  add("intermediate-blocks", ["documentTitle", "heading", "paragraph", "list", "table"].every((type) => intermediate.blocks.some((block) => block.type === type)), "intermediate supports target block types")
  add("intermediate-rule-refs", intermediate.blocks.some((block) => (block.ruleRefs || []).length > 0), "blocks carry FormatSpec ruleRefs")
  add("docx-preflight", docxPreflight.exists && docxPreflight.sizeBytes > 0 && docxPreflight.hasDocumentXml && docxPreflight.paragraphCount > 0, "existing DOCX preflight is readable")
  add("positive-review-nonblocking", ["pass", "warn"].includes(reviews.positive.verdict) && reviews.positive.blockingIssues.length === 0, "positive review has no blocking issues")
  add("missing-section-fails", reviews["missing-section"].verdict === "fail" && reviews["missing-section"].blockingIssues.some((i) => i.code === "missing-required-section"), "missing required section fails")
  add("format-coverage-warns-or-fails", ["warn", "fail"].includes(reviews["missing-format-coverage"].verdict), "missing rule coverage is visible")
  add("source-leakage-fails", reviews["source-leakage"].verdict === "fail" && reviews["source-leakage"].blockingIssues.some((i) => i.code === "source-leakage"), "source leakage fails")
  add("validation-error-fails", reviews["validation-error"].verdict === "fail" && reviews["validation-error"].blockingIssues.some((i) => i.code === "docx-validation-error"), "validation error fails")
  return { pass: checks.every((c) => c.pass), checks }
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true })
  await fs.mkdir(outDir, { recursive: true })
  const testCase = JSON.parse(await fs.readFile(casePath, "utf8"))
  const contract = buildExportContract(testCase)
  const intermediate = parseDraftToIntermediate(testCase)
  const docxPreflight = await analyzeDocxPreflight(preflightDocx)
  const scenarios = ["positive", "missing-section", "missing-format-coverage", "source-leakage", "validation-error"]
  const reviews = Object.fromEntries(scenarios.map((scenario) => [scenario, review({ contract, intermediate, docxPreflight, mutate: scenario })]))
  const evaluation = evaluate(reviews, contract, intermediate, docxPreflight)
  const summary = {
    experiment: "docx-first-export-contract-spike",
    pass: evaluation.pass,
    decision: evaluation.pass ? "contract-intermediate-review-boundary-is-productizable" : "do-not-productize-yet",
    recommendedNext: evaluation.pass ? "Design DOCX-first Formal Export PRD/Test Spec; compare TS adapter vs OpenXML sidecar next." : "Harden contract/review before adapter work.",
    checks: evaluation.checks,
    positiveVerdict: reviews.positive.verdict,
    positiveWarnings: reviews.positive.warnings.length,
    docxPreflight: {
      exists: docxPreflight.exists,
      sizeBytes: docxPreflight.sizeBytes,
      zipEntries: docxPreflight.zipEntries,
      paragraphCount: docxPreflight.paragraphCount,
      headingStyleRefs: docxPreflight.headingStyleRefs,
      validationErrors: docxPreflight.validationErrors,
      knownWarnings: docxPreflight.knownWarnings,
    },
  }
  await fs.writeFile(path.join(outDir, "export-contract.json"), JSON.stringify(contract, null, 2), "utf8")
  await fs.writeFile(path.join(outDir, "docx-intermediate.json"), JSON.stringify(intermediate, null, 2), "utf8")
  await fs.writeFile(path.join(outDir, "match-review.json"), JSON.stringify(reviews, null, 2), "utf8")
  await fs.writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8")
  const md = [
    "# DOCX-first Export Contract Spike Summary",
    "",
    `Result: **${summary.pass ? "PASS" : "FAIL"}**`,
    "",
    `Decision: ${summary.decision}`,
    "",
    `Recommended next: ${summary.recommendedNext}`,
    "",
    "## Checks",
    "",
    ...summary.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`),
    "",
    "## Positive Review",
    "",
    `- Verdict: ${summary.positiveVerdict}`,
    `- Warning count: ${summary.positiveWarnings}`,
    "",
    "## DOCX Preflight",
    "",
    `- Exists: ${summary.docxPreflight.exists}`,
    `- Size bytes: ${summary.docxPreflight.sizeBytes}`,
    `- Zip entries: ${summary.docxPreflight.zipEntries}`,
    `- Paragraph count: ${summary.docxPreflight.paragraphCount}`,
    `- Heading style refs: ${summary.docxPreflight.headingStyleRefs.join(", ")}`,
    `- Known warnings: ${summary.docxPreflight.knownWarnings.join("; ")}`,
  ].join("\n")
  await fs.writeFile(path.join(outDir, "summary.md"), md, "utf8")
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
