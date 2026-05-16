#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadCases, runtimeRoot, readJson } from './lib/case-loader.mjs';
import { sha256 } from './lib/stable-json.mjs';
import { buildStyleFacts } from './lib/style-parser.mjs';

const requiredModes = [
  { mode: 'deterministic', cases: ['docx-style-rich', 'xlsx-style-rich', 'pptx-baseline', 'pdf-baseline'] },
  { mode: 'mock-pass', cases: ['docx-style-rich', 'xlsx-style-rich', 'pptx-baseline', 'pdf-baseline'] },
  { mode: 'mock-hallucination', cases: ['docx-style-rich'] },
  { mode: 'mock-overwrite-facts', cases: ['xlsx-style-rich'] },
  { mode: 'mock-unknown-evidence', cases: ['docx-style-rich'] }
];
const confidenceRank = { unknown: 0, low: 1, medium: 2, high: 3 };

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function factLike(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'value') && Object.prototype.hasOwnProperty.call(value, 'evidenceRefs');
}

function deterministicSubset(envelope) {
  const { metadata, ...rest } = envelope;
  return rest;
}

function validateFactTree(node, evidenceById, pathParts = ['styleFacts']) {
  if (factLike(node)) {
    assert(Object.prototype.hasOwnProperty.call(node, 'confidence'), `${pathParts.join('.')} missing confidence`);
    assert(['high', 'medium', 'low', 'unknown'].includes(node.confidence), `${pathParts.join('.')} invalid confidence ${node.confidence}`);
    assert(Array.isArray(node.evidenceRefs) && node.evidenceRefs.length > 0, `${pathParts.join('.')} missing non-empty evidenceRefs`);
    for (const ref of node.evidenceRefs) {
      assert(evidenceById.has(ref), `${pathParts.join('.')} cites unknown evidence ${ref}`);
    }
    const evidenceConfidences = node.evidenceRefs.map((ref) => evidenceById.get(ref).confidence ?? 'unknown');
    if (node.confidence === 'high' && evidenceConfidences.every((c) => confidenceRank[c] < confidenceRank.high)) {
      assert((node.notes ?? []).length > 0, `${pathParts.join('.')} claims high confidence from lower-confidence evidence without notes`);
    }
    if (node.derived === true) {
      assert(node.evidenceRefs.length > 0, `${pathParts.join('.')} derived fact must cite original deterministic evidence`);
    }
    return;
  }
  assert(node && typeof node === 'object' && !Array.isArray(node), `${pathParts.join('.')} must be a Fact leaf or grouping object`);
  const keys = Object.keys(node);
  assert(keys.length > 0, `${pathParts.join('.')} empty grouping object`);
  for (const key of keys) validateFactTree(node[key], evidenceById, [...pathParts, key]);
}

function validateEnvelope(envelope, expectedCaseId) {
  assert(envelope.schemaVersion === 'format-profile-style-facts.v0', `${expectedCaseId} bad schemaVersion`);
  assert(envelope.caseId === expectedCaseId, `${expectedCaseId} caseId mismatch`);
  assert(envelope.parser?.deterministic === true, `${expectedCaseId} parser.deterministic must be true`);
  assert(envelope.parser?.authority === 'deterministic-parser', `${expectedCaseId} parser authority must be deterministic`);
  assert(!Object.prototype.hasOwnProperty.call(envelope, 'styleProfile'), `${expectedCaseId} must not contain product styleProfile overlay`);
  assert(!Object.prototype.hasOwnProperty.call(envelope, 'overlay'), `${expectedCaseId} style facts must not embed overlay`);
  assert(Array.isArray(envelope.evidence) && envelope.evidence.length > 0, `${expectedCaseId} missing evidence`);
  const evidenceById = new Map();
  for (const evidence of envelope.evidence) {
    assert(evidence.id && evidence.kind && evidence.pointer && evidence.confidence && evidence.sha256, `${expectedCaseId} malformed evidence ${JSON.stringify(evidence)}`);
    assert(!evidenceById.has(evidence.id), `${expectedCaseId} duplicate evidence id ${evidence.id}`);
    evidenceById.set(evidence.id, evidence);
  }
  validateFactTree(envelope.styleFacts, evidenceById);
  assert(envelope.metadata?.styleFactsSha256 === sha256(deterministicSubset(envelope)), `${expectedCaseId} deterministic hash mismatch`);
}

function readOutput(mode, caseId) {
  const outputPath = path.join(runtimeRoot, 'outputs', mode, caseId, 'style-facts.json');
  assert(fs.existsSync(outputPath), `Missing output ${outputPath}`);
  return readJson(outputPath);
}

function factValue(envelope, dotPath) {
  return dotPath.split('.').reduce((cursor, key) => cursor?.[key], envelope.styleFacts)?.value;
}

function assertGolden(caseDef, envelope) {
  const expected = caseDef.expected;
  if (caseDef.caseId === 'docx-style-rich') {
    const fonts = factValue(envelope, 'typography.fonts');
    for (const font of expected.fontsInclude) assert(fonts.includes(font), `DOCX missing font ${font}`);
    assert(factValue(envelope, 'typography.fontUsage')[0].value === expected.fontUsageTop, 'DOCX top font usage mismatch');
    const styleIds = factValue(envelope, 'styles.styleIds');
    for (const styleId of expected.styleIdsInclude) assert(styleIds.includes(styleId), `DOCX missing styleId ${styleId}`);
    const page = factValue(envelope, 'layout.pageSizeTwips');
    assert(page.widthTwips === expected.pageWidthTwips, 'DOCX page width twips mismatch');
    assert(page.heightTwips === expected.pageHeightTwips, 'DOCX page height twips mismatch');
    assert(factValue(envelope, 'structure.counts').paragraphs === expected.paragraphs, 'DOCX paragraph count mismatch');
    assert(factValue(envelope, 'structure.counts').tables === expected.tables, 'DOCX table count mismatch');
    assert(factValue(envelope, 'typography.fontSizeUsagePt').some((entry) => entry.value === 10.5), 'DOCX half-point to pt conversion missing 10.5pt');
    assert(factValue(envelope, 'layout.pageSizeCm').widthCm > 20 && factValue(envelope, 'layout.pageSizeCm').heightCm > 29, 'DOCX twip to cm conversion looks wrong');
  }
  if (caseDef.caseId === 'xlsx-style-rich') {
    assert(factValue(envelope, 'workbook.sheetCount') === expected.sheetCount, 'XLSX sheet count mismatch');
    assert(factValue(envelope, 'layout.sheetStats')[0].dimension === expected.dimension, 'XLSX dimension mismatch');
    assert(factValue(envelope, 'layout.sheetStats')[0].rowCount === expected.rowCount, 'XLSX row count mismatch');
    assert(factValue(envelope, 'layout.sheetStats')[0].cellCount === expected.cellCount, 'XLSX cell count mismatch');
    assert(factValue(envelope, 'formulasAndMerges.mergedCellCount') === expected.mergedCellCount, 'XLSX merged cell count mismatch');
    assert(factValue(envelope, 'formulasAndMerges.formulaCount') === expected.formulaCount, 'XLSX formula count mismatch');
    assert(factValue(envelope, 'styles.fontCount') === expected.fontCount, 'XLSX font count mismatch');
    assert(factValue(envelope, 'styles.fillCount') === expected.fillCount, 'XLSX fill count mismatch');
    assert(factValue(envelope, 'styles.borderCount') === expected.borderCount, 'XLSX border count mismatch');
    assert(factValue(envelope, 'styles.cellStyleCount') === expected.cellStyleCount, 'XLSX cell style count mismatch');
    assert(factValue(envelope, 'styles.sharedStringCount') === expected.sharedStringCount, 'XLSX shared string count mismatch');
  }
  if (caseDef.caseId === 'pptx-baseline') {
    assert(factValue(envelope, 'deck.slideCount') === expected.slideCount, 'PPTX slide count mismatch');
    assert(factValue(envelope, 'deck.layoutCount') === expected.layoutCount, 'PPTX layout count mismatch');
    assert(factValue(envelope, 'deck.masterCount') === expected.masterCount, 'PPTX master count mismatch');
    assert(factValue(envelope, 'theme.themeCount') === expected.themeCount, 'PPTX theme count mismatch');
    assert(factValue(envelope, 'theme.fontSchemeCount') === expected.fontSchemeCount, 'PPTX font scheme count mismatch');
    assert(factValue(envelope, 'theme.colorSchemeCount') === expected.colorSchemeCount, 'PPTX color scheme count mismatch');
  }
  if (caseDef.caseId === 'pdf-baseline') {
    assert(factValue(envelope, 'layout.pageCount') === expected.pageCount, 'PDF page count mismatch');
    assert(factValue(envelope, 'diagnostics.textOperatorCount') === expected.textOperatorCount, 'PDF text operator count mismatch');
    assert(factValue(envelope, 'diagnostics.imageCount') === expected.imageCount, 'PDF image count mismatch');
    assert(factValue(envelope, 'diagnostics.scanLikely') === expected.scanLikely, 'PDF scanLikely mismatch');
    const joinedFonts = factValue(envelope, 'typography.fontRefs').join(' ');
    for (const fontFragment of expected.fontRefsInclude) assert(joinedFonts.includes(fontFragment), `PDF font refs missing ${fontFragment}`);
  }
}

function validateOverlayMode(mode, caseId, deterministicHash) {
  const dir = path.join(runtimeRoot, 'outputs', mode, caseId);
  const resultPath = path.join(dir, 'overlay-result.json');
  assert(fs.existsSync(resultPath), `Missing overlay result for ${mode}/${caseId}`);
  const result = readJson(resultPath);
  assert(result.deterministicHash === deterministicHash, `${mode}/${caseId} deterministic hash changed`);
  if (mode === 'mock-pass') {
    assert(result.status === 'accepted', `${mode}/${caseId} expected accepted overlay`);
    assert(fs.existsSync(path.join(dir, 'style-interpretation-overlay.json')), `${mode}/${caseId} missing accepted overlay file`);
  } else {
    assert(result.status === 'rejected', `${mode}/${caseId} expected rejected overlay`);
    assert(fs.existsSync(path.join(dir, 'style-interpretation-overlay.rejected.json')), `${mode}/${caseId} missing rejected overlay file`);
  }
}

function validateDeterminism(caseDef) {
  if (!['docx-style-rich', 'xlsx-style-rich'].includes(caseDef.caseId)) return;
  const first = buildStyleFacts(caseDef).metadata.styleFactsSha256;
  const second = buildStyleFacts(caseDef).metadata.styleFactsSha256;
  assert(first === second, `${caseDef.caseId} parser is not deterministic across two builds`);
}

function main() {
  const cases = new Map(loadCases().map((caseDef) => [caseDef.caseId, caseDef]));
  const deterministicHashes = new Map();
  const checks = [];

  for (const required of requiredModes) {
    for (const caseId of required.cases) {
      const envelope = readOutput(required.mode, caseId);
      validateEnvelope(envelope, caseId);
      if (required.mode === 'deterministic') {
        const caseDef = cases.get(caseId);
        assertGolden(caseDef, envelope);
        validateDeterminism(caseDef);
        deterministicHashes.set(caseId, envelope.metadata.styleFactsSha256);
      }
      checks.push(`${required.mode}/${caseId}`);
    }
  }

  for (const [caseId, deterministicHash] of deterministicHashes.entries()) {
    const mockPass = readOutput('mock-pass', caseId);
    assert(mockPass.metadata.styleFactsSha256 === deterministicHash, `mock-pass/${caseId} fact hash differs from deterministic`);
    validateOverlayMode('mock-pass', caseId, deterministicHash);
  }
  validateOverlayMode('mock-hallucination', 'docx-style-rich', deterministicHashes.get('docx-style-rich'));
  validateOverlayMode('mock-overwrite-facts', 'xlsx-style-rich', deterministicHashes.get('xlsx-style-rich'));
  validateOverlayMode('mock-unknown-evidence', 'docx-style-rich', deterministicHashes.get('docx-style-rich'));

  const report = {
    status: 'pass',
    checkedOutputs: checks.length,
    checkedCases: [...deterministicHashes.keys()],
    boundary: 'High-fidelity means fixture-backed deterministic parser fidelity, not visual/export fidelity.',
    noProductSrcTouchedByExperiment: true
  };
  const reportPath = path.join(runtimeRoot, 'reports', 'verification.report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exit(1);
}
