import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { asArray, evidenceItem, inferFormat, readJson, relPath, sha256, stableJson, truncateText, writeJson } from './utils.mjs';
import { buildSourceContext, sanitizeArtifact } from './source-context.mjs';

const KIND_BY_FORMAT = {
  docx: { primary: 'raw.docx.paragraph', style: 'raw.docx.style' },
  xlsx: { primary: 'raw.xlsx.sheet', style: 'profile.style' },
  pptx: { primary: 'raw.pptx.slide', style: 'profile.style' },
  pdf: { primary: 'raw.pdf.fact', style: 'profile.style' },
};

export async function listCases(harnessRoot) {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(path.join(harnessRoot, 'cases'))).filter((name) => name.endsWith('.case.json')).sort();
  return Promise.all(files.map((name) => readJson(path.join(harnessRoot, 'cases', name))));
}

export async function loadCase(harnessRoot, caseId) {
  return readJson(path.join(harnessRoot, 'cases', `${caseId}.case.json`));
}

function addDocxEvidence(items, profile, sourcePath) {
  const headings = asArray(profile?.rawProbeFacts?.structure?.headingCandidates ?? profile?.structureProfile?.sections);
  headings.slice(0, 40).forEach((heading, index) => {
    items.push(evidenceItem({
      id: `raw.docx.paragraph.${String(index + 1).padStart(4, '0')}`,
      kind: 'raw.docx.paragraph',
      sourcePath,
      pointer: `/rawProbeFacts/structure/headingCandidates/${index}`,
      text: heading?.text,
      value: { index: heading?.index, styleId: heading?.styleId, styleName: heading?.styleName, outlineLevel: heading?.outlineLevel ?? null },
    }));
  });
  const styles = [
    ...asArray(profile?.styleProfile?.typography?.fontUsage).map((x) => ({ type: 'fontUsage', ...x })),
    ...asArray(profile?.styleProfile?.typography?.fontSizeUsageHalfPoints).map((x) => ({ type: 'fontSizeHalfPoints', ...x })),
    ...asArray(profile?.styleProfile?.typography?.styles).map((x) => ({ type: 'styleDef', ...x })),
  ];
  styles.slice(0, 60).forEach((style, index) => items.push(evidenceItem({
    id: `raw.docx.style.${String(index + 1).padStart(4, '0')}`,
    kind: 'raw.docx.style',
    sourcePath,
    pointer: `/styleProfile/typography/${style.type}/${index}`,
    text: style.name || style.value || style.styleId,
    value: style,
  })));
}

function addXlsxEvidence(items, profile, sourcePath) {
  const sheets = asArray(profile?.rawProbeFacts?.structure?.sheets ?? profile?.styleProfile?.formatSpecific?.sheets ?? profile?.structureProfile?.sections);
  const fallbackSheetCount = profile?.rawProbeFacts?.structure?.sheetCount ?? profile?.styleProfile?.formatSpecific?.sheetCount;
  if (sheets.length === 0 && fallbackSheetCount !== undefined) {
    items.push(evidenceItem({ id: 'raw.xlsx.sheet.0001', kind: 'raw.xlsx.sheet', sourcePath, pointer: '/rawProbeFacts/structure/sheetCount', text: `sheetCount=${fallbackSheetCount}`, value: { sheetCount: fallbackSheetCount } }));
  }
  sheets.slice(0, 40).forEach((sheet, index) => items.push(evidenceItem({
    id: `raw.xlsx.sheet.${String(index + 1).padStart(4, '0')}`,
    kind: 'raw.xlsx.sheet',
    sourcePath,
    pointer: `/rawProbeFacts/structure/sheets/${index}`,
    text: sheet?.name || sheet?.text || sheet?.title || `sheet-${index + 1}`,
    value: sheet,
  })));
}

function addPptxEvidence(items, profile, sourcePath) {
  const slides = asArray(profile?.rawProbeFacts?.structure?.slides ?? profile?.structureProfile?.sections);
  const slideCount = profile?.structureProfile?.slideCount ?? profile?.rawProbeFacts?.structure?.slideCount;
  if (slides.length === 0 && slideCount !== undefined) {
    items.push(evidenceItem({ id: 'raw.pptx.slide.0001', kind: 'raw.pptx.slide', sourcePath, pointer: '/structureProfile/slideCount', text: `slideCount=${slideCount}`, value: { slideCount, layoutCount: profile?.structureProfile?.layoutCount, masterCount: profile?.structureProfile?.masterCount } }));
  }
  slides.slice(0, 50).forEach((slide, index) => items.push(evidenceItem({
    id: `raw.pptx.slide.${String(index + 1).padStart(4, '0')}`,
    kind: 'raw.pptx.slide',
    sourcePath,
    pointer: `/rawProbeFacts/structure/slides/${index}`,
    text: slide?.title || slide?.text || slide?.name || `slide-${index + 1}`,
    value: slide,
  })));
}

function addPdfEvidence(items, profile, sourcePath) {
  const facts = {
    pageCount: profile?.structureProfile?.pageCount ?? profile?.rawProbeFacts?.structure?.pageCount,
    textOperatorCount: profile?.structureProfile?.textOperatorCount ?? profile?.rawProbeFacts?.structure?.textOperatorCount,
    imageCount: profile?.structureProfile?.imageCount ?? profile?.rawProbeFacts?.structure?.imageCount,
    scanLikely: profile?.structureProfile?.scanLikely ?? profile?.rawProbeFacts?.structure?.scanLikely,
    fontRefs: profile?.styleProfile?.typography?.fonts,
  };
  Object.entries(facts).forEach(([name, value]) => {
    if (value !== undefined) items.push(evidenceItem({ id: `raw.pdf.fact.${name}`, kind: 'raw.pdf.fact', sourcePath, pointer: `/pdfFacts/${name}`, text: `${name}: ${Array.isArray(value) ? value.join(', ') : value}`, value }));
  });
}

function addProfileEvidence(items, profile, sourcePath) {
  asArray(profile?.structureProfile?.sections).slice(0, 40).forEach((section, index) => items.push(evidenceItem({
    id: `profile.structure.${String(index + 1).padStart(4, '0')}`,
    kind: 'profile.structure',
    sourcePath,
    pointer: `/structureProfile/sections/${index}`,
    text: section?.text || section?.title || section?.kind,
    value: section,
  })));
  const stylePointers = [
    ['layout', profile?.styleProfile?.layout],
    ['typography', profile?.styleProfile?.typography],
    ['colors', profile?.styleProfile?.colors],
    ['formatSpecific', profile?.styleProfile?.formatSpecific],
  ];
  stylePointers.forEach(([name, value], index) => {
    if (value && (typeof value !== 'object' || Object.keys(value).length > 0)) items.push(evidenceItem({ id: `profile.style.${String(index + 1).padStart(4, '0')}`, kind: 'profile.style', sourcePath, pointer: `/styleProfile/${name}`, text: `${name} evidence`, value }));
  });
  asArray(profile?.diagnostics).forEach((diag, index) => items.push(evidenceItem({ id: `diagnostic.${String(index + 1).padStart(4, '0')}`, kind: 'diagnostic', sourcePath, pointer: `/diagnostics/${index}`, text: `${diag.severity || 'info'} ${diag.code || ''}: ${diag.message || ''}`, value: diag })));
}

export function buildEvidenceCatalog(profile, caseConfig, repoRoot) {
  const items = [];
  const format = caseConfig.formatType || inferFormat(profile);
  const sourcePath = profile?.source?.path;
  if (format === 'docx') addDocxEvidence(items, profile, sourcePath);
  if (format === 'xlsx') addXlsxEvidence(items, profile, sourcePath);
  if (format === 'pptx') addPptxEvidence(items, profile, sourcePath);
  if (format === 'pdf') addPdfEvidence(items, profile, sourcePath);
  addProfileEvidence(items, profile, sourcePath);

  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function loadRefinementInput({ repoRoot, harnessRoot, caseConfig, outputDir, dataScope = 'evidence-only', requestedScope = dataScope }) {
  const runtimeDir = path.join(repoRoot, 'runtime', 'format-profile', 'outputs', caseConfig.phase || 'phase2', caseConfig.sourceCaseId);
  const profilePath = path.join(runtimeDir, 'profile.json');
  const instructionPath = path.join(runtimeDir, 'generation-instruction.md');
  const diagnosticsPath = path.join(runtimeDir, 'diagnostics.json');
  const profile = await readJson(profilePath);
  const generationInstruction = await readFile(instructionPath, 'utf8');
  let diagnostics = profile?.diagnostics || [];
  try { diagnostics = await readJson(diagnosticsPath); } catch {}
  const rawEvidence = buildEvidenceCatalog(profile, caseConfig, repoRoot);
  const sourceContext = buildSourceContext({ case: caseConfig, deterministicProfile: profile, rawEvidence }, dataScope);
  const input = {
    schemaVersion: 'format-profile-refinement-input.v0',
    case: caseConfig,
    deterministicProfile: profile,
    deterministicGenerationInstruction: generationInstruction,
    diagnostics,
    rawEvidence,
    sourceContext,
    dataScope: { requestedScope, effectiveScope: dataScope, sourceContextAuthorized: dataScope !== 'evidence-only', sourceContextChunkCount: sourceContext.stats.chunkCount, sourceContextSha256: sourceContext.sha256, caps: sourceContext.caps ?? null, redactionStats: sourceContext.stats },
    hashes: {
      deterministicProfileSha256: sha256(profile),
      deterministicInstructionSha256: sha256(generationInstruction),
      rawEvidenceSha256: sha256(rawEvidence),
      sourceContextSha256: sourceContext.sha256,
    },
    paths: {
      runtimeDir: relPath(repoRoot, runtimeDir),
      profilePath: relPath(repoRoot, profilePath),
      instructionPath: relPath(repoRoot, instructionPath),
      diagnosticsPath: relPath(repoRoot, diagnosticsPath),
    },
  };
  if (outputDir) {
    await writeJson(path.join(outputDir, 'input.json'), sanitizeArtifact(input));
    await writeJson(path.join(outputDir, 'raw-evidence.json'), sanitizeArtifact(rawEvidence));
    await writeJson(path.join(outputDir, 'source-context.json'), sanitizeArtifact(sourceContext));
    await writeJson(path.join(outputDir, 'deterministic-profile.json'), sanitizeArtifact(profile));
  }
  return input;
}
