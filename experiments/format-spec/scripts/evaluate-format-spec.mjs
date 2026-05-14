#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(harnessRoot, '..', '..');

const TYPE_TARGETS = {
  docx: ['page', 'title', 'heading', 'numbering', 'typography', 'paragraph', 'table', 'boundary'],
  xlsx: ['workbook', 'sheet', 'table-region', 'header', 'data-region', 'style', 'formula', 'number-format', 'boundary'],
  pptx: ['deck', 'theme', 'layout', 'cover-slide', 'content-slide', 'bullet', 'visual-density', 'boundary'],
  pdf: ['page', 'text-layer', 'image-density', 'font-ref', 'scan-risk', 'reference-use', 'boundary'],
};

const MIN_RULES = { docx: 16, xlsx: 12, pptx: 12, pdf: 8 };
const RULE_SOURCES = new Set(['detected', 'inferred', 'standard-default']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const FILE_TYPES = new Set(['docx', 'xlsx', 'pptx', 'pdf']);
const FORBIDDEN_PROMISES = ['完全还原', '像素级', '高保真复刻', '保证导出', '自动生成 DOCX', '自动生成 XLSX', '自动生成 PPTX', '自动生成 PDF'];
const EVIDENCE_DUMP_MARKERS = ['rawEvidence', 'sha256', 'raw.docx.paragraph', 'raw.pptx.slide', 'raw.xlsx.sheet', 'raw.pdf.fact'];

function parseArgs(argv) {
  const args = { caseId: null, selfTest: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--case') args.caseId = argv[++i];
    else if (arg === '--no-self-test') args.selfTest = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return 'Usage: node experiments/format-spec/scripts/evaluate-format-spec.mjs [--case CASE_ID] [--no-self-test]';
}

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

async function readText(file) {
  return readFile(file, 'utf8');
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(sortStable(value), null, 2)}\n`, 'utf8');
}

async function writeText(file, value) {
  await writeFile(file, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function sortStable(value) {
  if (Array.isArray(value)) return value.map(sortStable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortStable(value[key])]));
  return value;
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(file) {
  return sha256Text(await readFile(file));
}

function normalizeLeakText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。；：、“”‘’（）《》【】()\[\]{}:;,.!?！？\-—_]/g, '')
    .toLowerCase();
}

function rawTextSamples(input) {
  const samples = [];
  for (const item of Array.isArray(input.rawEvidence) ? input.rawEvidence : []) {
    if (typeof item.text === 'string' && item.text.trim()) samples.push(item.text.trim());
    if (item.value && typeof item.value === 'object') {
      const textSample = item.value.textSample;
      if (Array.isArray(textSample)) for (const text of textSample) if (typeof text === 'string' && text.trim()) samples.push(text.trim());
    }
  }
  return samples.filter((text) => normalizeLeakText(text).length >= 8);
}

function findRawLeaks(rendered, input) {
  const normalizedRendered = normalizeLeakText(rendered);
  const exactHits = [];
  const normalizedHits = [];
  const highRiskShortHits = [];
  for (const sample of rawTextSamples(input)) {
    if (sample.length > 20 && rendered.includes(sample)) exactHits.push(sample.slice(0, 80));
    const normalized = normalizeLeakText(sample);
    if (normalized.length >= 16 && normalizedRendered.includes(normalized)) normalizedHits.push(sample.slice(0, 80));
    if (normalized.length >= 8 && normalized.length < 16 && normalizedRendered.includes(normalized)) highRiskShortHits.push(sample.slice(0, 80));
  }
  return { exactHits, normalizedHits, highRiskShortHits };
}

function fail(diagnostics, code, message) {
  diagnostics.push({ severity: 'error', code, message });
}

function warn(diagnostics, code, message) {
  diagnostics.push({ severity: 'warning', code, message });
}

function evaluateLoadedArtifacts({ caseConfig, input, spec, formatSpecMd, draftPromptMd, outputDir, provenance = {} }) {
  const diagnostics = [];
  const type = caseConfig.formatType || spec.sourceFileType;
  const minRules = caseConfig.expected?.minRules || MIN_RULES[type] || 1;
  const rules = Array.isArray(spec.rules) ? spec.rules : [];
  const targets = new Set(rules.map((item) => item.target));
  const allHumanText = `${formatSpecMd}\n${draftPromptMd}`;

  if (spec.schemaVersion !== 'format-spec.v0') fail(diagnostics, 'schema-version', 'schemaVersion must be format-spec.v0');
  if (!FILE_TYPES.has(spec.sourceFileType)) fail(diagnostics, 'filetype-enum', `invalid sourceFileType: ${spec.sourceFileType}`);
  if (spec.sourceFileType !== type) fail(diagnostics, 'type-mismatch', `sourceFileType ${spec.sourceFileType} does not match case ${type}`);
  if (!spec.caseId) fail(diagnostics, 'schema-field', 'missing caseId');
  if (!spec.documentIntent) fail(diagnostics, 'schema-field', 'missing documentIntent');
  if (!CONFIDENCE.has(spec.confidence)) fail(diagnostics, 'confidence-enum', `invalid spec confidence: ${spec.confidence}`);
  if (!Array.isArray(spec.globalBoundaries) || spec.globalBoundaries.length < 3) fail(diagnostics, 'boundaries', 'globalBoundaries must include at least 3 items');
  if (spec.contentLeakagePolicy?.includeSourceBodyText !== false) fail(diagnostics, 'content-policy', 'includeSourceBodyText must be false');
  if (spec.contentLeakagePolicy?.includeRawEvidenceDump !== false) fail(diagnostics, 'content-policy', 'includeRawEvidenceDump must be false');
  if (spec.contentLeakagePolicy?.promptMayIncludeEvidenceIds !== false) fail(diagnostics, 'content-policy', 'promptMayIncludeEvidenceIds must be false');

  const typeKeys = spec.typeSpecific && typeof spec.typeSpecific === 'object' ? Object.keys(spec.typeSpecific) : [];
  if (typeKeys.length !== 1 || typeKeys[0] !== type) fail(diagnostics, 'type-specific', 'typeSpecific must contain only current file type branch');
  if (rules.length < minRules) fail(diagnostics, 'rule-count', `rules must be >= ${minRules}`);

  for (const target of TYPE_TARGETS[type] || []) if (!targets.has(target)) fail(diagnostics, 'coverage', `missing target ${target}`);
  for (const item of rules) {
    for (const key of ['id', 'target', 'rule', 'detail', 'source', 'confidence']) if (!item?.[key]) fail(diagnostics, 'rule-field', `rule ${item?.id || '<unknown>'} missing ${key}`);
    if (!TYPE_TARGETS[type]?.includes(item.target)) fail(diagnostics, 'target-enum', `rule ${item?.id || '<unknown>'} target is not allowed for ${type}: ${item.target}`);
    if (!RULE_SOURCES.has(item.source)) fail(diagnostics, 'source-enum', `rule ${item?.id || '<unknown>'} has invalid source: ${item.source}`);
    if (!CONFIDENCE.has(item.confidence)) fail(diagnostics, 'confidence-enum', `rule ${item?.id || '<unknown>'} has invalid confidence: ${item.confidence}`);
  }

  const leaks = findRawLeaks(allHumanText, input);
  if (leaks.exactHits.length) fail(diagnostics, 'content-leak-exact', `human artifacts contain raw evidence text: ${leaks.exactHits.slice(0, 3).join(' | ')}`);
  if (leaks.normalizedHits.length) fail(diagnostics, 'content-leak-normalized', `human artifacts contain normalized raw evidence text: ${leaks.normalizedHits.slice(0, 3).join(' | ')}`);
  if (leaks.highRiskShortHits.length) warn(diagnostics, 'content-leak-short-risk', `human artifacts contain short high-risk source text: ${leaks.highRiskShortHits.slice(0, 3).join(' | ')}`);

  for (const marker of EVIDENCE_DUMP_MARKERS) {
    if (draftPromptMd.includes(marker)) fail(diagnostics, 'prompt-evidence-dump', `draft prompt contains evidence dump marker: ${marker}`);
  }
  for (const phrase of FORBIDDEN_PROMISES) {
    if (allHumanText.includes(phrase)) fail(diagnostics, 'boundary-forbidden', `forbidden promise phrase: ${phrase}`);
  }
  for (const required of ['不根据格式画像虚构事实', '不承诺导出']) {
    if (!allHumanText.includes(required)) fail(diagnostics, 'boundary-required', `missing required boundary: ${required}`);
  }
  if (!allHumanText.includes('不承诺视觉')) warn(diagnostics, 'boundary-wording', 'visual reproduction boundary should be explicit');

  if (type === 'docx' && !/(字体|字号)/.test(allHumanText)) fail(diagnostics, 'detail-docx-typography', 'DOCX must mention typography detail');
  if (type === 'docx' && !/(缩进|对齐|行距)/.test(allHumanText)) fail(diagnostics, 'detail-docx-paragraph', 'DOCX must mention indentation/alignment/line spacing detail');
  if (type === 'xlsx' && !/(表头|数据区|单位|数字格式)/.test(allHumanText)) fail(diagnostics, 'detail-xlsx', 'XLSX must mention table header/data region/unit or number format');
  if (type === 'pptx' && !/(封面|内容页|bullet|要点)/i.test(allHumanText)) fail(diagnostics, 'detail-pptx', 'PPTX must mention slide type or bullet density');
  if (type === 'pdf' && !/(文本层|扫描风险)/.test(allHumanText)) fail(diagnostics, 'detail-pdf', 'PDF must mention text layer or scan risk');

  if (!provenance.inputSha256 || !provenance.caseSha256 || !provenance.generatorSha256 || !provenance.evaluatorSha256) warn(diagnostics, 'provenance', 'run provenance is incomplete');

  return {
    schemaVersion: 'format-spec-evaluation.v1',
    caseId: caseConfig.caseId,
    verdict: diagnostics.some((item) => item.severity === 'error') ? 'fail' : 'pass',
    metrics: { ruleCount: rules.length, targetCount: targets.size, diagnosticCount: diagnostics.length },
    diagnostics,
    provenance,
    outputDir: outputDir ? path.relative(repoRoot, outputDir).replaceAll('\\', '/') : undefined,
  };
}

function buildValidBase(type = 'docx') {
  const targets = TYPE_TARGETS[type];
  return {
    caseConfig: { caseId: 'negative-self-test', formatType: type, expected: { minRules: targets.length } },
    input: { rawEvidence: [{ text: '第一条 为认真学习贯彻重要要求，建立健全制度体系。', value: { textSample: ['这里输入你的标题'] } }] },
    spec: {
      schemaVersion: 'format-spec.v0',
      caseId: 'negative-self-test',
      sourceFileType: type,
      documentIntent: 'self test',
      confidence: 'medium',
      globalBoundaries: ['不根据格式画像虚构事实。', '不承诺导出。', '不承诺视觉还原。'],
      contentLeakagePolicy: { includeSourceBodyText: false, includeRawEvidenceDump: false, promptMayIncludeEvidenceIds: false },
      rules: targets.map((target, index) => ({ id: `${type}-${target}-${index}`, target, rule: `${target} rule`, detail: '包含字体、字号、缩进、对齐、行距、表头、数据区、单位、数字格式、封面、内容页、bullet、文本层、扫描风险等验证词。', source: 'standard-default', confidence: 'medium' })),
      typeSpecific: { [type]: {} },
    },
    formatSpecMd: '不根据格式画像虚构事实。不承诺导出。不承诺视觉还原。字体 字号 缩进 对齐 行距 表头 数据区 单位 数字格式 封面 内容页 bullet 文本层 扫描风险',
    draftPromptMd: '不根据格式画像虚构事实。不承诺导出。不承诺视觉还原。字体 字号 缩进 对齐 行距 表头 数据区 单位 数字格式 封面 内容页 bullet 文本层 扫描风险',
    provenance: { inputSha256: 'x', caseSha256: 'x', generatorSha256: 'x', evaluatorSha256: 'x' },
  };
}

function runNegativeSelfTests() {
  const cases = [];
  const leakage = buildValidBase('docx');
  leakage.draftPromptMd += '\n第一 条，为认真学习贯彻重要要求，建立健全制度体系。';
  cases.push(['normalized-raw-leakage', leakage, 'content-leak-normalized']);

  const dump = buildValidBase('docx');
  dump.draftPromptMd += '\nraw.docx.paragraph.0001 sha256 abc';
  cases.push(['evidence-id-dump', dump, 'prompt-evidence-dump']);

  const promise = buildValidBase('pptx');
  promise.draftPromptMd += '\n可以自动生成 PPTX 文件并高保真复刻。';
  cases.push(['forbidden-promise', promise, 'boundary-forbidden']);

  const missingTarget = buildValidBase('xlsx');
  missingTarget.spec.rules = missingTarget.spec.rules.filter((item) => item.target !== 'header');
  cases.push(['missing-target', missingTarget, 'coverage']);

  const multiType = buildValidBase('pdf');
  multiType.spec.typeSpecific.docx = {};
  cases.push(['multiple-type-specific', multiType, 'type-specific']);

  const results = [];
  for (const [name, payload, expectedCode] of cases) {
    const report = evaluateLoadedArtifacts(payload);
    const codes = report.diagnostics.map((item) => item.code);
    results.push({ name, expectedCode, verdict: report.verdict, ok: report.verdict === 'fail' && codes.includes(expectedCode), codes });
  }
  return results;
}

async function loadCases(args) {
  const caseDir = path.join(harnessRoot, 'cases');
  const files = (await readdir(caseDir)).filter((file) => file.endsWith('.case.json')).sort();
  const cases = [];
  for (const file of files) {
    const config = await readJson(path.join(caseDir, file));
    if (!args.caseId || config.caseId === args.caseId) cases.push(config);
  }
  if (!cases.length) throw new Error(`No cases matched${args.caseId ? `: ${args.caseId}` : ''}`);
  return cases;
}

async function evaluateCase(caseConfig) {
  const outputDir = path.join(harnessRoot, 'outputs', caseConfig.caseId);
  const inputPath = path.resolve(repoRoot, caseConfig.inputPath);
  const casePath = path.join(harnessRoot, 'cases', `${caseConfig.caseId}.case.json`);
  const [input, spec, formatSpecMd, draftPromptMd] = await Promise.all([
    readJson(inputPath),
    readJson(path.join(outputDir, 'format-spec.json')),
    readText(path.join(outputDir, 'format-spec.md')),
    readText(path.join(outputDir, 'draft-prompt.md')),
  ]);
  const provenance = {
    inputPath: caseConfig.inputPath,
    inputSha256: await sha256File(inputPath),
    caseSha256: await sha256File(casePath),
    generatorSha256: await sha256File(path.join(__dirname, 'run-format-spec.mjs')),
    evaluatorSha256: await sha256File(__filename),
    formatSpecSha256: await sha256File(path.join(outputDir, 'format-spec.json')),
    formatSpecMarkdownSha256: await sha256File(path.join(outputDir, 'format-spec.md')),
    draftPromptSha256: await sha256File(path.join(outputDir, 'draft-prompt.md')),
  };
  const report = evaluateLoadedArtifacts({ caseConfig, input, spec, formatSpecMd, draftPromptMd, outputDir, provenance });
  await writeJson(path.join(outputDir, 'evaluation.json'), report);
  return { caseId: caseConfig.caseId, formatType: caseConfig.formatType, verdict: report.verdict, ruleCount: report.metrics.ruleCount, diagnostics: report.diagnostics, provenance, outputDir: report.outputDir };
}

function renderSummary(summary) {
  const lines = ['# FormatSpec Independent Evaluator Summary', '', `Generated: ${summary.generatedAt}`, '', '| Case | Type | Verdict | Rules | Output |', '| --- | --- | --- | ---: | --- |'];
  for (const result of summary.results) lines.push(`| ${result.caseId} | ${result.formatType} | ${result.verdict} | ${result.ruleCount} | ${result.outputDir} |`);
  lines.push('', `Happy path: ${summary.passed}/${summary.total} passed.`);
  lines.push(`Negative self-tests: ${summary.negativeSelfTests.passed}/${summary.negativeSelfTests.total} passed.`);
  if (summary.failed.length) {
    lines.push('', '## Failures');
    for (const result of summary.results.filter((item) => item.verdict !== 'pass')) {
      lines.push(`### ${result.caseId}`);
      for (const diagnostic of result.diagnostics) lines.push(`- [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const negativeResults = args.selfTest ? runNegativeSelfTests() : [];
  const negativeFailed = negativeResults.filter((item) => !item.ok);
  const cases = await loadCases(args);
  const results = [];
  for (const item of cases) results.push(await evaluateCase(item));
  await mkdir(path.join(harnessRoot, 'reports'), { recursive: true });
  const failed = results.filter((item) => item.verdict !== 'pass').map((item) => item.caseId);
  const summary = {
    schemaVersion: 'format-spec-independent-evaluator-summary.v0',
    generatedAt: new Date().toISOString(),
    provenance: {
      evaluatorSha256: await sha256File(__filename),
      generatorSha256: await sha256File(path.join(__dirname, 'run-format-spec.mjs')),
      caseCount: cases.length,
      cases: results.map((item) => ({
        caseId: item.caseId,
        inputPath: item.provenance.inputPath,
        inputSha256: item.provenance.inputSha256,
        caseSha256: item.provenance.caseSha256,
        formatSpecSha256: item.provenance.formatSpecSha256,
        formatSpecMarkdownSha256: item.provenance.formatSpecMarkdownSha256,
        draftPromptSha256: item.provenance.draftPromptSha256,
      })),
    },
    total: results.length,
    passed: results.filter((item) => item.verdict === 'pass').length,
    failed,
    negativeSelfTests: { total: negativeResults.length, passed: negativeResults.filter((item) => item.ok).length, failed: negativeFailed.map((item) => item.name), results: negativeResults },
    results,
  };
  await writeJson(path.join(harnessRoot, 'reports', 'independent-evaluator-summary.json'), summary);
  await writeText(path.join(harnessRoot, 'reports', 'independent-evaluator-summary.md'), renderSummary(summary));
  for (const result of results) console.log(`${result.caseId}: ${result.verdict} rules=${result.ruleCount} output=${result.outputDir}`);
  if (negativeResults.length) console.log(`negative-self-tests: ${summary.negativeSelfTests.passed}/${summary.negativeSelfTests.total}`);
  if (failed.length || negativeFailed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
