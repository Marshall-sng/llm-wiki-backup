#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..', '..');
const formatSpecRoot = path.join(repoRoot, 'experiments', 'format-spec');

const REQUIRED_TARGETS = {
  docx: ['page', 'title', 'heading', 'numbering', 'typography', 'paragraph', 'table', 'boundary'],
  xlsx: ['workbook', 'sheet', 'table-region', 'header', 'data-region', 'style', 'formula', 'number-format', 'boundary'],
  pptx: ['deck', 'theme', 'layout', 'cover-slide', 'content-slide', 'bullet', 'visual-density', 'boundary'],
  pdf: ['page', 'text-layer', 'image-density', 'font-ref', 'scan-risk', 'reference-use', 'boundary'],
};

const REQUIRED_ATTRS = {
  docx: ['pageSize', 'margin', 'font', 'fontSizePt', 'alignment', 'indent', 'lineSpacing', 'paragraphSpacing', 'numbering', 'tableHeader'],
  xlsx: ['sheetName', 'tableRegion', 'headerRow', 'dataRegion', 'numberFormat', 'unit', 'columnWidth', 'border', 'fill', 'printLayout'],
  pptx: ['slideSize', 'master', 'layout', 'titleFont', 'bodyFont', 'bulletLevel', 'spacing', 'density', 'placeholder', 'theme'],
  pdf: ['pageBox', 'layoutZone', 'readingOrder', 'textLayer', 'fontRef', 'marginSignal', 'tableSignature', 'listSignature', 'imageDensity', 'scanRisk'],
};

// Do not reward rule-count inflation. A GB/T-like spec can be compact when
// each rule has explicit attributes. Minimum rule count is therefore tied to
// required target coverage; granularity is enforced by attributes and score.
const MIN_RULES = { docx: 8, xlsx: 9, pptx: 8, pdf: 7 };
const MIN_ATTRS = { docx: 18, xlsx: 16, pptx: 18, pdf: 16 };
const MIN_GRANULARITY = { docx: 82, xlsx: 78, pptx: 78, pdf: 70 };

function parseArgs(argv) {
  const args = { mode: 'mock-llm', caseId: null, allowExternalLlm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i];
    else if (a === '--case') args.caseId = argv[++i];
    else if (a === '--allow-external-llm') args.allowExternalLlm = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

async function readJson(file) { return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
async function writeJson(file, value) { await writeFile(file, JSON.stringify(sortStable(value), null, 2) + '\n', 'utf8'); }
async function writeText(file, value) { await writeFile(file, value.endsWith('\n') ? value : value + '\n', 'utf8'); }
function sha256Text(s) { return createHash('sha256').update(String(s)).digest('hex'); }
async function sha256File(file) { return sha256Text(await readFile(file)); }
function sortStable(v) { if (Array.isArray(v)) return v.map(sortStable); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortStable(v[k])])); return v; }
function asArray(v) { return Array.isArray(v) ? v : []; }
function asObj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function firstDefined(...xs) { return xs.find(x => x !== undefined && x !== null && x !== '') ?? null; }
function truncate(s, n = 180) { return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n); }
function evidenceIds(input) { return new Set(asArray(input.rawEvidence).map(e => e.id).filter(Boolean)); }
function sampleTexts(input) { return asArray(input.rawEvidence).map(e => e.text).filter(t => typeof t === 'string' && t.trim().length > 24).map(t => truncate(t, 120)); }

async function loadCases(args) {
  const dir = path.join(root, 'cases');
  const files = (await readdir(dir)).filter(f => f.endsWith('.case.json')).sort();
  const out = [];
  for (const file of files) {
    const c = await readJson(path.join(dir, file));
    if (!args.caseId || c.caseId === args.caseId) out.push(c);
  }
  if (!out.length) throw new Error('No matching cases');
  return out;
}

function buildEvidencePack(caseConfig, input, baseline) {
  const profile = input.deterministicProfile || {};
  const style = asObj(profile.styleProfile);
  return {
    schemaVersion: 'format-rule-synthesis-evidence-pack.v0',
    caseId: caseConfig.caseId,
    fileType: caseConfig.formatType,
    documentKind: profile.documentKind?.label || profile.documentKind || 'unknown',
    confidence: style.confidence || profile.confidence || 'medium',
    profileSummary: {
      structure: profile.structureProfile || {},
      styleProfile: {
        layout: style.layout || {},
        typography: style.typography || {},
        colors: style.colors || {},
        formatSpecific: style.formatSpecific || {},
        evidenceSummary: asArray(style.evidenceSummary).slice(0, 12),
      },
      diagnostics: asArray(profile.diagnostics).slice(0, 12),
    },
    evidenceCatalog: asArray(input.rawEvidence).slice(0, 80).map(e => ({
      id: e.id,
      kind: e.kind,
      pointer: e.pointer,
      text: truncate(e.text, 220),
      valueDigest: sha256Text(JSON.stringify(e.value ?? e.text ?? e.pointer ?? '')).slice(0, 16),
    })),
    currentFormatSpecControl: {
      ruleCount: asArray(baseline.rules).length,
      targets: [...new Set(asArray(baseline.rules).map(r => r.target))],
      sampleRules: asArray(baseline.rules).slice(0, 5).map(r => ({ id: r.id, target: r.target, rule: r.rule, detail: truncate(r.detail, 160) })),
    },
    instruction: 'Infer detailed GB/T-like executable formatting rules from evidence. Do not copy source body text into rules. Every non-boundary rule must cite evidenceRefs.',
  };
}

function attr(name, value, evidenceRefs, confidence = 'medium', unit) {
  return { name, value: String(value), ...(unit ? { unit } : {}), confidence, evidenceRefs };
}
function rule(id, target, normType, ruleText, detail, evidenceRefs, attributes = [], confidence = 'medium', source = 'llm-inferred') {
  return { id, target, normType, rule: ruleText, detail, source, confidence, evidenceRefs, attributes };
}
function refs(pack, kinds = [], limit = 3) {
  const selected = pack.evidenceCatalog.filter(e => !kinds.length || kinds.some(k => String(e.kind).includes(k))).map(e => e.id).filter(Boolean);
  return (selected.length ? selected : pack.evidenceCatalog.map(e => e.id)).slice(0, limit);
}
function topStyle(pack) {
  const t = pack.profileSummary.styleProfile.typography || {};
  const usage = asArray(t.fontUsage);
  const sizes = asArray(t.fontSizeUsageHalfPoints || t.fontSizeUsagePt);
  return {
    font: firstDefined(usage[0]?.value, t.fonts?.[0], 'detected-body-font'),
    size: firstDefined(sizes[0]?.value ? Number(sizes[0].value) / 2 : null, sizes[0], 'detected-size'),
  };
}

function commonBoundaries() {
  return [
    'Rules constrain drafting and audit only; they do not promise file export.',
    'Rules do not promise high-fidelity visual restoration or pixel-perfect replication.',
    'Source facts and user draft content override formatting rules.',
    'Do not copy source body text or raw evidence into the generated draft.',
  ];
}

function docxRules(pack, styleRefs, structRefs, allRefs) {
  const ts = topStyle(pack);
  return [
    rule('docx-page-size', 'page', 'page', 'Use formal A4-like page organization when page evidence supports it.', 'Represent page size as an approximate drafting constraint, not an export promise.', styleRefs, [attr('pageSize', 'A4-like portrait', styleRefs), attr('margin', 'detect-or-confirm; do not fabricate exact margins', styleRefs), attr('pageOrientation', 'portrait unless evidence contradicts', styleRefs)]),
    rule('docx-title-main', 'title', 'hierarchy', 'Main title is standalone and visually separated from body.', 'Title expresses the current draft topic; it must not reuse source file title text.', structRefs, [attr('alignment', 'center or prominent standalone line', structRefs), attr('font', ts.font, styleRefs), attr('fontSizePt', 'larger than body; infer from title/style evidence', styleRefs, 'medium', 'pt')]),
    rule('docx-heading-l1', 'heading', 'hierarchy', 'Level-1 headings represent chapters or major sections.', 'Use one consistent pattern such as Chapter/Section or Chinese numeral headings.', structRefs, [attr('numbering', 'chapter/major-section pattern', structRefs), attr('font', 'heading font from evidence or formal default', styleRefs), attr('paragraphSpacing', 'more spacing before than body', styleRefs)]),
    rule('docx-heading-l2', 'heading', 'hierarchy', 'Level-2 headings group related provisions.', 'Use one consistent second-level marker and keep heading text short.', structRefs, [attr('numbering', 'section/subsection pattern', structRefs), attr('alignment', 'left or formal heading alignment', styleRefs), attr('fontSizePt', 'between title and body', styleRefs)]),
    rule('docx-heading-l3', 'heading', 'hierarchy', 'Level-3 headings identify concrete items.', 'Do not promote long provision sentences into headings.', structRefs, [attr('numbering', 'item marker such as 1. or (1)', structRefs), attr('indent', 'same-level consistent indent', styleRefs)]),
    rule('docx-numbering-seq', 'numbering', 'numbering', 'Provision numbering is continuous and same-level markers are homogeneous.', 'Preserve chapter/article/paragraph/item ordering inferred from evidence.', structRefs, [attr('numbering', 'continuous within each level', structRefs), attr('indent', 'nested levels increase indent consistently', styleRefs)]),
    rule('docx-body-font', 'typography', 'typography', 'Body typography follows detected dominant body style.', 'Use detected font and size as drafting constraints and show uncertainty if evidence is weak.', styleRefs, [attr('font', ts.font, styleRefs), attr('fontSizePt', ts.size, styleRefs, 'medium', 'pt'), attr('lineSpacing', 'stable formal-document line spacing', styleRefs)]),
    rule('docx-body-paragraph', 'paragraph', 'spacing', 'Body paragraphs use formal paragraph rhythm.', 'Use first-line indent, consistent line spacing, and controlled before/after spacing.', styleRefs, [attr('indent', 'first-line indent around two Chinese characters when appropriate', styleRefs), attr('alignment', 'left or justified', styleRefs), attr('paragraphSpacing', 'consistent same-level spacing', styleRefs), attr('lineSpacing', 'consistent body line spacing', styleRefs)]),
    rule('docx-list-item', 'paragraph', 'hierarchy', 'List-like body items remain body text unless they are real headings.', 'Long sentences, amounts, thresholds and responsibilities remain body provisions.', structRefs, [attr('promotionPolicy', 'do not promote long provisions to headings', structRefs), attr('indent', 'list indent consistent by level', styleRefs)]),
    rule('docx-table-structure', 'table', 'table', 'Tables carry matrices, lists, thresholds or comparisons.', 'Table facts must come from user draft or references, never from the format image.', structRefs, [attr('tableHeader', 'short field labels', structRefs), attr('bodyFontSizePt', 'may be smaller than body if evidence supports', styleRefs, 'medium', 'pt'), attr('alignment', 'cell text readable and consistent', styleRefs)]),
    rule('docx-table-caption', 'table', 'hierarchy', 'Table caption is separated from body provisions.', 'Caption precedes table or is clearly attached; header cells do not contain article numbering.', structRefs, [attr('paragraphSpacing', 'caption/table spacing distinct from body', styleRefs), attr('numbering', 'table numbering optional and evidence-bound', structRefs)]),
    rule('docx-header-footer', 'page', 'page', 'Header/footer evidence is diagnostic only unless explicitly present.', 'Do not invent headers, footers, watermarks, seals, or page numbers.', styleRefs, [attr('headerFooter', 'confirm before use', styleRefs), attr('margin', 'do not infer exact header/footer distance', styleRefs)]),
    rule('docx-spacing-heading', 'heading', 'spacing', 'Heading spacing separates hierarchy without adding content.', 'Before/after spacing may differ by level but should be consistent within each level.', styleRefs, [attr('paragraphSpacing', 'level-specific consistent spacing', styleRefs), attr('lineSpacing', 'heading line spacing stable', styleRefs)]),
    rule('docx-font-fallback', 'typography', 'typography', 'Western/default fonts are compatibility evidence, not Chinese body preference.', 'Prefer body-style evidence over global font counts when they conflict.', styleRefs, [attr('fontFallback', 'do not overfit Arial/en-US counts', styleRefs), attr('font', ts.font, styleRefs)]),
    rule('docx-diagnostics', 'boundary', 'boundary', 'Uncertain layout facts are surfaced as diagnostics.', 'Weak margin or numbering evidence must lower confidence rather than create exact rules.', allRefs, [attr('confidencePolicy', 'lower confidence on weak evidence', allRefs)]),
    rule('docx-boundary', 'boundary', 'boundary', 'Never claim DOCX export or visual replication.', 'This is a drafting constraint layer only.', allRefs, [attr('exportPromise', 'forbidden', allRefs), attr('visualReplication', 'forbidden', allRefs)], 'high', 'standard-default'),
    rule('docx-appendix', 'heading', 'hierarchy', 'Appendix or attachment sections remain separate from body hierarchy.', 'Only create appendix structure when the current draft requires it.', structRefs, [attr('numbering', 'appendix labels evidence-bound', structRefs), attr('paragraphSpacing', 'separate from body', styleRefs)]),
    rule('docx-signoff', 'paragraph', 'spacing', 'Sign-off/date blocks are not inferred from style alone.', 'Do not create issuer/date/seal areas unless draft facts require them.', allRefs, [attr('alignment', 'confirm before right/center alignment', styleRefs), attr('paragraphSpacing', 'sign-off spacing evidence-bound', styleRefs)]),
  ];
}

function genericRules(type, pack, styleRefs, structRefs, allRefs) {
  const defs = {
    xlsx: [
      ['workbook', 'hierarchy', ['sheetName', 'printLayout']], ['sheet', 'hierarchy', ['sheetName', 'freezePane']],
      ['table-region', 'hierarchy', ['tableRegion', 'headerRow', 'dataRegion']], ['header', 'table', ['headerRow', 'columnWidth', 'alignment']],
      ['data-region', 'table', ['dataRegion', 'numberFormat', 'unit']], ['style', 'typography', ['fill', 'border', 'font']],
      ['formula', 'numbering', ['formulaPolicy', 'numberFormat']], ['number-format', 'typography', ['numberFormat', 'unit']],
      ['style', 'page', ['printLayout', 'pageBreak']], ['boundary', 'boundary', ['exportPromise', 'visualReplication']],
      ['style', 'spacing', ['columnWidth', 'alignment']], ['table-region', 'table', ['totalRow', 'formulaPolicy']],
      ['table-region', 'hierarchy', ['notesRegion', 'unit']], ['data-region', 'spacing', ['density', 'tableRegion']],
    ],
    pptx: [
      ['deck', 'hierarchy', ['slideSize', 'master', 'layout']], ['theme', 'typography', ['theme', 'titleFont', 'bodyFont']],
      ['layout', 'hierarchy', ['layout', 'placeholder']], ['cover-slide', 'hierarchy', ['titleFont', 'density']],
      ['content-slide', 'density', ['density', 'spacing']], ['bullet', 'hierarchy', ['bulletLevel', 'bodyFont', 'spacing']],
      ['visual-density', 'spacing', ['density', 'placeholder']], ['content-slide', 'table', ['tableHeader', 'placeholder']],
      ['boundary', 'boundary', ['exportPromise', 'visualReplication']], ['layout', 'hierarchy', ['layout', 'density']],
      ['content-slide', 'typography', ['titleFont', 'spacing']], ['content-slide', 'hierarchy', ['notesPolicy', 'density']],
      ['theme', 'typography', ['theme', 'spacing']], ['bullet', 'spacing', ['bulletLevel', 'spacing']],
    ],
    pdf: [
      ['page', 'page', ['pageBox', 'marginSignal']], ['text-layer', 'hierarchy', ['textLayer', 'readingOrder']],
      ['reference-use', 'hierarchy', ['layoutZone', 'readingOrder']], ['font-ref', 'typography', ['fontRef', 'font']],
      ['reference-use', 'table', ['tableSignature', 'listSignature']], ['image-density', 'density', ['imageDensity', 'layoutZone']],
      ['scan-risk', 'boundary', ['scanRisk', 'confidencePolicy']], ['boundary', 'boundary', ['exportPromise', 'visualReplication']],
      ['page', 'spacing', ['marginSignal', 'pageBox']], ['reference-use', 'numbering', ['listSignature', 'readingOrder']],
    ],
  };
  return defs[type].map(([target, normType, attrs], idx) => {
    const id = `${type}-${target}-${idx + 1}`.replace(/[^a-z0-9-]/g, '-');
    const evidence = target === 'boundary' ? allRefs : (normType === 'typography' || normType === 'spacing' || normType === 'page' ? styleRefs : structRefs);
    return rule(id, target, normType, `${target} uses evidence-bound ${normType} constraints.`, `The synthesized rule makes ${attrs.join(', ')} explicit and avoids source-text copying.`, evidence, attrs.map(a => attr(a, a.includes('Promise') || a === 'visualReplication' ? 'forbidden' : 'evidence-bound', evidence)), target === 'boundary' ? 'high' : 'medium', target === 'boundary' ? 'standard-default' : 'llm-inferred');
  });
}

function mockSynthesis(pack) {
  const type = pack.fileType;
  const styleRefs = refs(pack, ['style'], 5);
  const structRefs = refs(pack, ['paragraph', 'structure', 'sheet', 'slide', 'pdf'], 5);
  const allRefs = refs(pack, [], 5);
  const rules = type === 'docx' ? docxRules(pack, styleRefs, structRefs, allRefs) : genericRules(type, pack, styleRefs, structRefs, allRefs);
  return {
    schemaVersion: 'format-rule-spec-synthesis.v0',
    caseId: pack.caseId,
    sourceFileType: type,
    synthesisMode: 'mock-llm',
    confidence: 'medium',
    rationale: 'LLM-style synthesis converts existing evidence into explicit normative formatting constraints with attributes.',
    globalBoundaries: commonBoundaries(),
    rules,
  };
}

function mockUncited(pack) {
  const spec = mockSynthesis(pack);
  spec.synthesisMode = 'mock-uncited';
  if (spec.rules[0]) spec.rules[0].evidenceRefs = ['missing.evidence.0001'];
  if (spec.rules[1]) spec.rules[1].attributes = [];
  spec.globalBoundaries = ['Guarantee high-fidelity export and exact visual recreation.'];
  return spec;
}

function buildRealPrompt(pack) {
  return [
    'You are a formatting-rule synthesis engine.',
    'Return only one JSON object. No markdown fences.',
    'Goal: infer a GB/T 9704-2012-like detailed, executable formatting rule system from the evidence pack.',
    'Do not copy source body text into rules. Do not promise export, high-fidelity, exact recreation, or visual restoration.',
    'Every non-boundary rule must cite evidenceRefs from evidenceCatalog ids.',
    'Schema:',
    JSON.stringify({
      schemaVersion: 'format-rule-spec-synthesis.v0',
      caseId: pack.caseId,
      sourceFileType: pack.fileType,
      synthesisMode: 'real-llm',
      confidence: 'high|medium|low',
      rationale: 'short',
      globalBoundaries: ['...'],
      rules: [{ id: 'short-id', target: '...', normType: 'typography|hierarchy|spacing|alignment|numbering|page|table|density|boundary', rule: '...', detail: '...', source: 'llm-inferred|detected|standard-default', confidence: 'high|medium|low', evidenceRefs: ['evidence.id'], attributes: [{ name: 'fontSizePt', value: '15.5', unit: 'pt', confidence: 'medium', evidenceRefs: ['evidence.id'] }] }],
    }, null, 2),
    `Required targets: ${REQUIRED_TARGETS[pack.fileType].join(', ')}`,
    `Required attribute names should include as many as possible: ${REQUIRED_ATTRS[pack.fileType].join(', ')}`,
    'Evidence pack:',
    JSON.stringify(pack, null, 2),
  ].join('\n');
}

function extractJson(text) {
  const t = String(text || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return extractJson(fenced[1]);
  const s = t.indexOf('{');
  if (s < 0) return t;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = s; i < t.length; i++) {
    const ch = t[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return t.slice(s, i + 1);
    }
  }
  return t.slice(s);
}

async function callCodex(pack) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'format-rule-synthesis-'));
  const outFile = path.join(tmp, 'last.txt');
  const model = process.env.FORMAT_RULE_CODEX_MODEL || process.env.FORMAT_PROFILE_CODEX_MODEL || 'gpt-5.3-codex-spark';
  const args = ['exec', '-C', repoRoot, '--sandbox', 'read-only', '--ephemeral', '--output-last-message', outFile, '--model', model, '-'];
  try {
    const result = await new Promise((resolve, reject) => {
      const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'codex';
      const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'codex', ...args] : args;
      const child = spawn(command, commandArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('codex-cli timeout')); }, 360000);
      child.stdout.on('data', c => { stdout += c.toString(); });
      child.stderr.on('data', c => { stderr += c.toString(); });
      child.on('error', err => { clearTimeout(timer); reject(err); });
      child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
      child.stdin.end(buildRealPrompt(pack));
    });
    let final = '';
    try { final = await readFile(outFile, 'utf8'); } catch {}
    if (result.code !== 0 && !final.trim()) throw new Error(`codex exited ${result.code}: ${(result.stderr || result.stdout).slice(0, 1000)}`);
    return JSON.parse(extractJson(final.trim() || result.stdout));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function normalizeText(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').replace(/[，。；：、“”‘’（）《》【】()\[\]{}:;,.!?！？\-—_]/g, '').toLowerCase(); }
function containsPositiveForbiddenPromise(text, phrase) {
  const lower = String(text || '').toLowerCase();
  const needle = phrase.toLowerCase();
  let index = lower.indexOf(needle);
  while (index >= 0) {
    const context = lower.slice(Math.max(0, index - 48), index);
    if (!/(do not|does not|never|no |not |without|forbidden|avoid|禁止|不得|不承诺|不提供|不能|不会|非)/i.test(context)) return true;
    index = lower.indexOf(needle, index + needle.length);
  }
  return false;
}
function evaluate(spec, pack, input, baseline) {
  const diagnostics = [];
  const warn = (code, message) => diagnostics.push({ severity: 'warning', code, message });
  const fail = (code, message) => diagnostics.push({ severity: 'error', code, message });
  const type = pack.fileType;
  const ids = evidenceIds(input);
  const rules = asArray(spec.rules);
  const targets = new Set(rules.map(r => r.target));
  const attrNames = new Set();
  let attrCount = 0;
  let citedRefs = 0;
  let validRefs = 0;
  if (spec.schemaVersion !== 'format-rule-spec-synthesis.v0') fail('schema', 'schemaVersion invalid');
  if (spec.caseId !== pack.caseId) fail('schema', 'caseId mismatch');
  if (spec.sourceFileType !== type) fail('schema', 'sourceFileType mismatch');
  if (!Array.isArray(spec.globalBoundaries) || spec.globalBoundaries.length < 2) fail('boundary', 'globalBoundaries must include at least 2 items');
  if (rules.length < MIN_RULES[type]) fail('rule-count', `rules ${rules.length} < ${MIN_RULES[type]}`);
  for (const t of REQUIRED_TARGETS[type]) if (!targets.has(t)) fail('target-coverage', `missing target ${t}`);
  const allText = JSON.stringify(spec);
  for (const forbidden of ['高保真复刻', '完全还原', '保证导出', 'exact visual recreation', 'high-fidelity export']) {
    if (containsPositiveForbiddenPromise(allText, forbidden)) fail('forbidden-promise', `forbidden promise: ${forbidden}`);
  }
  const normAll = normalizeText(allText);
  for (const sample of sampleTexts(input)) {
    const ns = normalizeText(sample);
    if (ns.length > 18 && normAll.includes(ns)) fail('content-leak', `raw sample leaked: ${sample.slice(0, 60)}`);
  }
  for (const r of rules) {
    for (const k of ['id', 'target', 'normType', 'rule', 'detail', 'source', 'confidence']) if (!r[k]) fail('rule-schema', `rule missing ${k}`);
    const ruleRefs = asArray(r.evidenceRefs).filter(Boolean);
    if (r.target !== 'boundary' && ruleRefs.length === 0) fail('missing-evidence', `rule ${r.id} lacks evidenceRefs`);
    for (const ref of ruleRefs) { citedRefs++; if (ids.has(ref)) validRefs++; else fail('unknown-evidence', `rule ${r.id} cites ${ref}`); }
    for (const a of asArray(r.attributes)) {
      attrCount++;
      if (a?.name) attrNames.add(a.name);
      const arefs = asArray(a?.evidenceRefs).filter(Boolean);
      const effectiveRefs = arefs.length ? arefs : ruleRefs;
      for (const ref of arefs) { citedRefs++; if (ids.has(ref)) validRefs++; else fail('unknown-evidence', `attribute ${a?.name || '<unknown>'} cites ${ref}`); }
      if (!arefs.length) for (const ref of effectiveRefs) { citedRefs++; if (ids.has(ref)) validRefs++; else fail('unknown-evidence', `attribute ${a?.name || '<unknown>'} inherits ${ref}`); }
    }
  }
  if (attrCount < MIN_ATTRS[type]) fail('attribute-count', `attributes ${attrCount} < ${MIN_ATTRS[type]}`);
  for (const a of REQUIRED_ATTRS[type]) if (!attrNames.has(a)) fail('attribute-coverage', `missing attribute ${a}`);
  const targetScore = REQUIRED_TARGETS[type].filter(t => targets.has(t)).length / REQUIRED_TARGETS[type].length * 25;
  const attrScore = Math.min(30, attrCount / MIN_ATTRS[type] * 30);
  const attrCoverage = REQUIRED_ATTRS[type].filter(a => attrNames.has(a)).length / REQUIRED_ATTRS[type].length * 25;
  const evidenceScore = citedRefs === 0 ? 0 : validRefs / citedRefs * 20;
  const granularityScore = Math.round(targetScore + attrScore + attrCoverage + evidenceScore);
  if (granularityScore < MIN_GRANULARITY[type]) fail('granularity-score', `score ${granularityScore} < ${MIN_GRANULARITY[type]}`);
  const baselineAttrCount = asArray(baseline.rules).reduce((n, r) => n + asArray(r.attributes).length, 0);
  if (attrCount <= baselineAttrCount + 8) fail('baseline-delta', `attribute delta too small: candidate=${attrCount}, baseline=${baselineAttrCount}`);
  if (diagnostics.some(d => d.severity === 'error') && citedRefs > 0 && validRefs < citedRefs) warn('evidence-coverage', `valid refs ${validRefs}/${citedRefs}`);
  return {
    schemaVersion: 'format-rule-synthesis-evaluation.v0',
    caseId: pack.caseId,
    verdict: diagnostics.some(d => d.severity === 'error') ? 'fail' : 'pass',
    metrics: { ruleCount: rules.length, targetCount: targets.size, attributeCount: attrCount, requiredAttributeHits: REQUIRED_ATTRS[type].filter(a => attrNames.has(a)).length, evidenceCoverage: citedRefs === 0 ? 0 : validRefs / citedRefs, granularityScore, baselineRuleCount: asArray(baseline.rules).length, baselineAttributeCount: baselineAttrCount },
    diagnostics,
  };
}

function render(spec, evaluation) {
  const lines = [`# FormatRuleSpec Synthesis: ${spec.caseId}`, '', `- Type: ${spec.sourceFileType}`, `- Mode: ${spec.synthesisMode}`, `- Evaluation: ${evaluation.verdict}`, `- Granularity: ${evaluation.metrics.granularityScore}`, '', '## Boundaries'];
  for (const b of asArray(spec.globalBoundaries)) lines.push(`- ${b}`);
  lines.push('', '## Rules');
  for (const r of asArray(spec.rules)) {
    lines.push(`### ${r.id} / ${r.target} / ${r.normType}`);
    lines.push(`- Rule: ${r.rule}`);
    lines.push(`- Detail: ${r.detail}`);
    lines.push(`- Evidence: ${asArray(r.evidenceRefs).join(', ')}`);
    if (asArray(r.attributes).length) {
      lines.push('- Attributes:');
      for (const a of r.attributes) lines.push(`  - ${a.name}: ${a.value}${a.unit ? ` ${a.unit}` : ''} (${asArray(a.evidenceRefs).join(', ')})`);
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

async function runCase(caseConfig, args) {
  const inputPath = path.resolve(repoRoot, caseConfig.inputPath);
  const input = await readJson(inputPath);
  const baseline = await readJson(path.join(formatSpecRoot, 'outputs', caseConfig.caseId, 'format-spec.json'));
  const pack = buildEvidencePack(caseConfig, input, baseline);
  let spec;
  if (args.mode === 'mock-llm') spec = mockSynthesis(pack);
  else if (args.mode === 'mock-uncited') spec = mockUncited(pack);
  else if (args.mode === 'real-llm') {
    if (!args.allowExternalLlm) throw new Error('real-llm requires --allow-external-llm');
    spec = await callCodex(pack);
    spec.synthesisMode = 'real-llm';
  } else throw new Error(`Unknown mode ${args.mode}`);
  const evaluation = evaluate(spec, pack, input, baseline);
  const outputDir = path.join(root, 'outputs', args.mode, caseConfig.caseId);
  await mkdir(outputDir, { recursive: true });
  await writeJson(path.join(outputDir, 'evidence-pack.json'), pack);
  await writeJson(path.join(outputDir, 'format-rule-spec.json'), spec);
  await writeJson(path.join(outputDir, 'evaluation.json'), evaluation);
  await writeText(path.join(outputDir, 'format-rule-spec.md'), render(spec, evaluation));
  return {
    caseId: caseConfig.caseId,
    formatType: caseConfig.formatType,
    mode: args.mode,
    verdict: evaluation.verdict,
    metrics: evaluation.metrics,
    diagnostics: evaluation.diagnostics,
    outputDir: path.relative(repoRoot, outputDir).replaceAll('\\', '/'),
    provenance: {
      inputPath: caseConfig.inputPath,
      inputSha256: await sha256File(inputPath),
      caseSha256: await sha256File(path.join(root, 'cases', `${caseConfig.caseId}.case.json`)),
      baselineSha256: await sha256File(path.join(formatSpecRoot, 'outputs', caseConfig.caseId, 'format-spec.json')),
      scriptSha256: await sha256File(__filename),
      outputSha256: sha256Text(JSON.stringify(spec)),
    },
  };
}

function summaryMd(summary) {
  const lines = ['# FormatRuleSpec Synthesis Summary', '', `Generated: ${summary.generatedAt}`, '', '| Mode | Case | Type | Verdict | Rules | Attrs | Score | Output |', '| --- | --- | --- | --- | ---: | ---: | ---: | --- |'];
  for (const r of summary.results) lines.push(`| ${r.mode} | ${r.caseId} | ${r.formatType} | ${r.verdict} | ${r.metrics.ruleCount} | ${r.metrics.attributeCount} | ${r.metrics.granularityScore} | ${r.outputDir} |`);
  lines.push('', `Result: ${summary.passed}/${summary.total} passed.`);
  if (summary.failed.length) {
    lines.push('', '## Failures');
    for (const r of summary.results.filter(x => x.verdict !== 'pass')) {
      lines.push(`### ${r.caseId}`);
      for (const d of r.diagnostics.filter(x => x.severity === 'error').slice(0, 10)) lines.push(`- ${d.code}: ${d.message}`);
    }
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log('Usage: node run-format-rule-synthesis.mjs --mode mock-llm|mock-uncited|real-llm [--case CASE] [--allow-external-llm]'); return; }
  const cases = await loadCases(args);
  const results = [];
  for (const c of cases) results.push(await runCase(c, args));
  await mkdir(path.join(root, 'reports'), { recursive: true });
  const summary = { schemaVersion: 'format-rule-synthesis-summary.v0', generatedAt: new Date().toISOString(), mode: args.mode, total: results.length, passed: results.filter(r => r.verdict === 'pass').length, failed: results.filter(r => r.verdict !== 'pass').map(r => r.caseId), results };
  await writeJson(path.join(root, 'reports', `${args.mode}-summary.json`), summary);
  await writeText(path.join(root, 'reports', `${args.mode}-summary.md`), summaryMd(summary));
  for (const r of results) console.log(`${r.mode}/${r.caseId}: ${r.verdict} rules=${r.metrics.ruleCount} attrs=${r.metrics.attributeCount} score=${r.metrics.granularityScore}`);
  if (summary.failed.length) process.exitCode = 1;
}
main().catch(err => { console.error(err.stack || err.message); process.exitCode = 1; });
