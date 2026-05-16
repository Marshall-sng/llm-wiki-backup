import JSZip from "jszip"

export type DocxProbeInput = ArrayBuffer | Uint8Array | Blob
export type DocxProbeSeverity = "pass" | "warn" | "fail"

export interface DocxProbeAssertion {
  id: string
  passed: boolean
  count?: number
  issueCode?: string
}

export interface DocxPackageProbeResult {
  packageParts: string[]
  structuralAssertions: DocxProbeAssertion[]
  validationErrors: string[]
  knownWarnings: string[]
}

export interface DocxPackageProbeExpectations {
  documentTitle?: string
  level1Headings?: string[]
  level2Headings?: string[]
  paragraphSnippets?: string[]
  requireOrderedList?: boolean
  requireUnorderedList?: boolean
  requireTable?: boolean
}

async function toArrayBuffer(input: DocxProbeInput): Promise<ArrayBuffer> {
  if (input instanceof Blob) return input.arrayBuffer()
  if (input instanceof Uint8Array) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
  return input
}

function countRegex(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length
}

function includesAll(value: string, expected: string[]): number {
  return expected.reduce((count, item) => count + (value.includes(item) ? 1 : 0), 0)
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
}

function extractVisibleWordText(documentXml: string): string {
  return [...documentXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1] ?? ""))
    .join("")
}

function assertion(id: string, passed: boolean, count?: number, issueCode?: string): DocxProbeAssertion {
  return { id, passed, ...(typeof count === "number" ? { count } : {}), ...(issueCode ? { issueCode } : {}) }
}

function pushContentAssertion(
  structuralAssertions: DocxProbeAssertion[],
  documentXml: string,
  id: string,
  expected: string[] | undefined,
  issueCode: string,
): void {
  if (!expected || expected.length === 0) return
  const count = includesAll(documentXml, expected)
  structuralAssertions.push(assertion(id, count >= expected.length, count, count >= expected.length ? undefined : issueCode))
}

export async function probeDocxPackage(input: DocxProbeInput, expectations: DocxPackageProbeExpectations = {}): Promise<DocxPackageProbeResult> {
  const knownWarnings = ["manual-word-openability-not-tested", "pixel-perfect-rendering-not-claimed"]
  const validationErrors: string[] = []
  const structuralAssertions: DocxProbeAssertion[] = []
  let packageParts: string[] = []

  try {
    const bytes = await toArrayBuffer(input)
    if (bytes.byteLength === 0) {
      return { packageParts, structuralAssertions, validationErrors: ["empty-docx-bytes"], knownWarnings }
    }

    const zip = await JSZip.loadAsync(bytes)
    packageParts = Object.keys(zip.files).filter((part) => !zip.files[part].dir).sort()
    for (const requiredPart of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
      if (!packageParts.includes(requiredPart)) validationErrors.push(`missing-package-part:${requiredPart}`)
    }

    const documentXml = await zip.file("word/document.xml")?.async("string") ?? ""
    const numberingXml = await zip.file("word/numbering.xml")?.async("string") ?? ""
    const stylesXml = await zip.file("word/styles.xml")?.async("string") ?? ""
    const documentSearchText = `${documentXml}\n${extractVisibleWordText(documentXml)}`

    pushContentAssertion(structuralAssertions, documentSearchText, "document-title-present", expectations.documentTitle ? [expectations.documentTitle] : undefined, "missing-document-title")
    pushContentAssertion(structuralAssertions, documentSearchText, "level1-headings-present", expectations.level1Headings, "missing-level1-heading")
    pushContentAssertion(structuralAssertions, documentSearchText, "level2-heading-present", expectations.level2Headings, "missing-level2-heading")
    pushContentAssertion(structuralAssertions, documentSearchText, "paragraph-content-present", expectations.paragraphSnippets, "missing-paragraph-content")

    const listCount = countRegex(documentXml, /<w:numPr>/g)
    const hasDecimal = /w:val="decimal"/.test(numberingXml)
    const hasBullet = /w:val="bullet"/.test(numberingXml)
    if (expectations.requireOrderedList) {
      structuralAssertions.push(assertion("ordered-list-distinguishable", hasDecimal && listCount > 0, listCount, hasDecimal && listCount > 0 ? undefined : "ordered-list-not-distinguishable"))
    }
    if (expectations.requireUnorderedList) {
      structuralAssertions.push(assertion("unordered-list-distinguishable", hasBullet && listCount > 0, listCount, hasBullet && listCount > 0 ? undefined : "unordered-list-not-distinguishable"))
    }

    const tableCount = countRegex(documentXml, /<w:tbl>/g)
    const tableRowCount = countRegex(documentXml, /<w:tr>/g)
    const tableCellCount = countRegex(documentXml, /<w:tc>/g)
    const tablePassed = tableCount >= 1 && tableRowCount >= 2 && tableCellCount >= 4
    if (expectations.requireTable) {
      structuralAssertions.push(assertion("simple-table-shape", tablePassed, tableCellCount, tablePassed ? undefined : "table-shape-mismatch"))
    }

    const styleEvidenceCount = countRegex(documentXml + stylesXml, /Heading1|Heading2|Title|FangSong/g)
    structuralAssertions.push(assertion("style-or-font-evidence", styleEvidenceCount > 0, styleEvidenceCount, styleEvidenceCount > 0 ? undefined : "style-evidence-missing"))
  } catch {
    validationErrors.push("docx-package-probe-exception")
  }

  for (const failed of structuralAssertions.filter((item) => !item.passed)) {
    validationErrors.push(failed.issueCode ?? `assertion-failed:${failed.id}`)
  }

  return { packageParts, structuralAssertions, validationErrors: [...new Set(validationErrors)], knownWarnings }
}
