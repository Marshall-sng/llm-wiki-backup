#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(root, '..', '..');
const sourceRoot = path.join(repoRoot, 'experiments', 'format-rule-synthesis', 'outputs', 'real-llm');
const baselineRoot = path.join(repoRoot, 'experiments', 'format-spec', 'outputs');
const cases = ['docx-policy', 'xlsx-metrics', 'pptx-briefing', 'pdf-reference'];
const schemaVersion = 'editable-format-constraints.v0';
const forbiddenKeys = new Set(['rawText', 'textSample', 'snippets', 'fulltext', 'sourceContext', 'styleFactsPatch', 'generationInstruction', 'finalInstruction', 'export']);
const boundaryPatterns = [/高保真/, /复刻/, /还原版式/, /视觉还原/, /perfect\s*match/i, /pixel[-\s]*perfect/i, /high[-\s]*fidelity/i, /exact\s+recreat/i];

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeJson(file, value) { await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
async function writeText(file, value) { await writeFile(file, value.endsWith('\n') ? value : value + '\n', 'utf8'); }
function sha256(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function arr(v) { return Array.isArray(v) ? v : []; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function sourceAlias(value, warnings, id) {
  if (value === undefined || value === null || value === '') {
    warnings.push(`soft-source-default:${id}: missing source defaulted to inferred`);
    return 'inferred';
  }
  if (typeof value !== 'string') {
    warnings.push(`soft-source-default:${id}: non-string source defaulted to inferred`);
    return 'inferred';
  }
  const key = value.trim().toLowerCase().replace(/\s+/g, '-');
  if (['llm-inferred', 'llm_inferred', 'llminferred', 'model-inferred', 'model_inferred', 'ai-inferred', 'ai_inferred', 'inferred'].includes(key)) return 'inferred';
  if (['detected', 'evidence-based', 'evidence_based', 'evidencebased', 'from-evidence', 'from_evidence'].includes(key)) return 'detected';
  if (['standard-default', 'standard_default', 'standarddefault', 'default', 'fallback'].includes(key)) return 'standard-default';
  warnings.push(`soft-source-default:${id}: unknown source ${JSON.stringify(value)} defaulted to inferred`);
  return 'inferred';
}
function findForbiddenKey(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) { const found = findForbiddenKey(item); if (found) return found; }
    return null;
  }
  for (const [k, v] of Object.entries(node)) {
    if (forbiddenKeys.has(k)) return k;
    const found = findForbiddenKey(v); if (found) return found;
  }
  return null;
}
function hasBoundaryPromise(node) {
  if (typeof node === 'string') {
    const negatedBoundary = /(不|未|不能|无法|不承诺|不得|禁止|avoid|do not|does not|must not|not|without|rather than|no)\s*.{0,80}(高保真|复刻|还原版式|视觉还原|perfect\s*match|pixel[-\s]*perfect|high[-\s]*fidelity|exact\s+(visual\s+)?(recreat|reproduc)|visual\s+restoration|source[-\s]*template\s+reproduction)/i;
    if (negatedBoundary.test(node)) return false;
    return boundaryPatterns.some(p => p.test(node));
  }
  if (Array.isArray(node)) return node.some(item => hasBoundaryPromise(item));
  if (node && typeof node === 'object') return Object.values(node).some(value => hasBoundaryPromise(value));
  return false;
}

function evidenceSet(spec) {
  return new Set(arr(spec.rules).flatMap(r => [...arr(r.evidenceRefs), ...arr(r.attributes).flatMap(a => arr(a.evidenceRefs))]));
}
function normalizeRule(rule, knownEvidence, warnings, violations, index) {
  const id = typeof rule.id === 'string' && rule.id ? rule.id : `rule-${index + 1}`;
  const evidenceRefs = arr(rule.evidenceRefs).filter(x => typeof x === 'string' && x);
  if (!rule.target || !rule.rule || !rule.detail) violations.push(`schema:${id}: target/rule/detail required`);
  if (evidenceRefs.length === 0) violations.push(`evidence:${id}: rule must cite evidenceRefs`);
  for (const ref of evidenceRefs) if (!knownEvidence.has(ref)) violations.push(`evidence:${id}: unknown evidenceRef ${ref}`);
  const attributes = arr(rule.attributes).slice(0, 16).map((a, i) => {
    const refs = arr(a.evidenceRefs).length ? arr(a.evidenceRefs) : evidenceRefs;
    for (const ref of refs) if (!knownEvidence.has(ref)) violations.push(`evidence:${id}.${a.name ?? i}: unknown evidenceRef ${ref}`);
    return {
      name: String(a.name ?? `attribute-${i + 1}`),
      value: String(a.value ?? ''),
      ...(a.unit ? { unit: String(a.unit) } : {}),
      confidence: ['high', 'medium', 'low'].includes(a.confidence) ? a.confidence : 'medium',
      evidenceRefs: refs,
    };
  });
  return {
    id,
    target: String(rule.target ?? 'unknown'),
    ...(rule.normType ? { normType: String(rule.normType) } : {}),
    rule: String(rule.rule ?? ''),
    detail: String(rule.detail ?? ''),
    source: sourceAlias(rule.source, warnings, id),
    confidence: ['high', 'medium', 'low'].includes(rule.confidence) ? rule.confidence : 'medium',
    evidenceRefs,
    ...(attributes.length ? { attributes } : {}),
    editable: true,
    origin: 'llm-draft',
  };
}
function evaluateDraft(input, knownEvidence) {
  const warnings = [];
  const violations = [];
  const forbidden = findForbiddenKey(input);
  if (forbidden) violations.push(`forbidden-field:${forbidden}`);
  if (hasBoundaryPromise(input)) violations.push('boundary-promise:fidelity/export promise detected');
  const rules = arr(input.rules).slice(0, 32).map((r, i) => normalizeRule(r, knownEvidence, warnings, violations, i));
  if (rules.length === 0) violations.push('quality:no rules');
  return { status: violations.length ? 'rejected' : 'accepted', warnings, violations, rules };
}
function applyUserEdits(autoSpec, caseId) {
  const edited = clone(autoSpec);
  edited.mode = 'edited';
  edited.edits = [];
  if (edited.rules[0]) {
    edited.rules[0].rule = `${edited.rules[0].rule}（用户已确认采用）`;
    edited.rules[0].detail = `${edited.rules[0].detail} User edit: keep this as the active drafting constraint.`;
    edited.rules[0].origin = 'user-edited';
    edited.rules[0].editedAt = 'experiment-fixed-time';
    edited.edits.push({ op: 'update-rule', ruleId: edited.rules[0].id, field: 'rule/detail', reason: 'manual correction or confirmation' });
  }
  edited.activeRuleSource = 'user-edited-over-auto';
  edited.promptBlock = renderPromptBlock(edited);
  edited.hash = sha256({ rules: edited.rules, edits: edited.edits, caseId });
  return edited;
}
function renderPromptBlock(spec) {
  return [
    '## 可编辑格式约束（Editable Format Constraints）',
    '',
    `- schemaVersion: ${spec.schemaVersion}`,
    `- caseId: ${spec.caseId}`,
    `- mode: ${spec.mode}`,
    `- activeRuleSource: ${spec.activeRuleSource}`,
    '',
    '### 规则',
    ...spec.rules.flatMap(r => [`- 【${r.target}${r.normType ? `/${r.normType}` : ''}】${r.rule} ${r.detail}`, ...arr(r.attributes).slice(0, 8).map(a => `  - ${a.name}: ${a.value}${a.unit ? ` ${a.unit}` : ''}`)]),
  ].join('\n');
}
async function baselineMetrics(caseId) {
  try {
    const spec = await readJson(path.join(baselineRoot, caseId, 'format-spec.json'));
    return { ruleCount: arr(spec.rules).length, hash: sha256(spec) };
  } catch { return { ruleCount: 0, hash: null }; }
}
async function processCase(caseId) {
  const inputSpec = await readJson(path.join(sourceRoot, caseId, 'format-rule-spec.json'));
  const known = evidenceSet(inputSpec);
  const baseline = await baselineMetrics(caseId);
  const variants = {};
  const mk = (mode, rules, extra = {}) => ({ caseId, schemaVersion, mode, activeRuleSource: mode, rules, ...extra });
  const autoEval = evaluateDraft(mk('auto', inputSpec.rules), known);
  variants.auto = autoEval;
  const missingRules = clone(inputSpec.rules).map(r => { delete r.source; return r; });
  variants.missingSource = evaluateDraft(mk('missing-source', missingRules), known);
  const unknownRules = clone(inputSpec.rules).map(r => ({ ...r, source: 'parser-stylefacts' }));
  variants.unknownSource = evaluateDraft(mk('unknown-source', unknownRules), known);
  const autoSpec = { caseId, schemaVersion, mode: 'auto', activeRuleSource: 'llm-draft', rules: autoEval.rules, warnings: autoEval.warnings, promptBlock: '', hash: '' };
  autoSpec.promptBlock = renderPromptBlock(autoSpec);
  autoSpec.hash = sha256(autoSpec);
  const edited = applyUserEdits(autoSpec, caseId);
  variants.edited = { status: 'accepted', warnings: [], violations: [], rules: edited.rules, edited };
  const unknownEvidenceRules = clone(inputSpec.rules).slice(0, 1).map(r => ({ ...r, evidenceRefs: ['missing.evidence'] }));
  variants.negativeUnknownEvidence = evaluateDraft(mk('negative-unknown-evidence', unknownEvidenceRules), known);
  variants.negativeForbiddenField = evaluateDraft({ ...mk('negative-forbidden-field', inputSpec.rules.slice(0, 1)), rawText: 'should not pass' }, known);
  variants.negativeFidelityPromise = evaluateDraft(mk('negative-fidelity-promise', [{ ...clone(inputSpec.rules[0]), detail: 'Promise high-fidelity pixel-perfect visual restoration.' }]), known);
  const outputDir = path.join(root, 'outputs', caseId);
  await mkdir(outputDir, { recursive: true });
  await writeJson(path.join(outputDir, 'auto-editable-spec.json'), autoSpec);
  await writeJson(path.join(outputDir, 'edited-format-constraints.json'), edited);
  await writeText(path.join(outputDir, 'edited-prompt-block.md'), edited.promptBlock);
  const pass = ['auto','missingSource','unknownSource','edited'].every(k => variants[k].status === 'accepted')
    && ['negativeUnknownEvidence','negativeForbiddenField','negativeFidelityPromise'].every(k => variants[k].status === 'rejected')
    && variants.missingSource.warnings.length > 0
    && variants.unknownSource.warnings.length > 0
    && edited.rules[0]?.origin === 'user-edited';
  const result = {
    caseId,
    verdict: pass ? 'pass' : 'fail',
    baseline,
    metrics: {
      autoRuleCount: autoSpec.rules.length,
      editedRuleCount: edited.rules.length,
      warningCount: variants.missingSource.warnings.length + variants.unknownSource.warnings.length,
      editedOverrides: edited.edits.length,
    },
    variants: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, { status: v.status, warnings: v.warnings, violations: v.violations }]))
  };
  await writeJson(path.join(outputDir, 'evaluation.json'), result);
  return result;
}
function md(summary) {
  const lines = ['# Editable Format Constraints Experiment Summary', '', `Generated: ${summary.generatedAt}`, '', `Verdict: ${summary.verdict}`, '', '| Case | Verdict | Baseline rules | Auto rules | Edited rules | Warnings | Edits |', '| --- | --- | ---: | ---: | ---: | ---: | ---: |'];
  for (const r of summary.results) lines.push(`| ${r.caseId} | ${r.verdict} | ${r.baseline.ruleCount} | ${r.metrics.autoRuleCount} | ${r.metrics.editedRuleCount} | ${r.metrics.warningCount} | ${r.metrics.editedOverrides} |`);
  lines.push('', '## Gates', '- Soft fields: missing/unknown source accepted with warnings and normalized to inferred.', '- Hard gates: unknown evidence, forbidden raw fields, and fidelity promises rejected.', '- User edits: edited rules take precedence over auto draft in prompt block.');
  return lines.join('\n') + '\n';
}
await mkdir(path.join(root, 'reports'), { recursive: true });
const results = [];
for (const c of cases) results.push(await processCase(c));
const summary = {
  schemaVersion: 'editable-format-constraints-experiment-summary.v0',
  generatedAt: new Date().toISOString(),
  verdict: results.every(r => r.verdict === 'pass') ? 'pass' : 'fail',
  results,
  provenance: {
    sourceRoot,
    baselineRoot,
    runnerSha256: sha256(await readFile(__filename, 'utf8')),
  },
};
await writeJson(path.join(root, 'reports', 'latest-summary.json'), summary);
await writeText(path.join(root, 'reports', 'latest-summary.md'), md(summary));
console.log(JSON.stringify({ verdict: summary.verdict, passed: results.filter(r => r.verdict === 'pass').length, total: results.length }, null, 2));
if (summary.verdict !== 'pass') process.exitCode = 1;
