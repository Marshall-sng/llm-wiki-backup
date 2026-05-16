import { asArray, sha256, stableJson } from './utils.mjs';
import { renderGenerationInstruction } from './renderer.mjs';

const TOP_KEYS = new Set(['schemaVersion', 'caseId', 'confidence', 'semanticOverlay', 'diagnostics']);
const CONFIDENCE = new Set(['high', 'medium', 'low', 'unknown']);
const OVERLAY_KEYS = new Set(['documentKind', 'structureSummary', 'styleSummary', 'writingConstraints', 'formatBoundaries']);
const CLAIM_KEYS = new Set(['value', 'evidenceRefs', 'inference', 'rationale']);
const FORBIDDEN_TERMS = [
  '手动输入模板', '手写模板', '手填模板', '用户手填', '手动模板',
  '高保真导出', '高保真复刻', '精确复刻', '正式导出样式',
  '直接生成PPTX', '直接生成 PPTX', '直接生成Excel', '直接生成 Excel', '导出成品',
];

function collectText(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectText(item, out));
  return out;
}

function fail(ruleResults, code, message, extra = {}) {
  ruleResults.push({ code, pass: false, message, ...extra });
}

function pass(ruleResults, code, message, extra = {}) {
  ruleResults.push({ code, pass: true, message, ...extra });
}

export function validateOverlaySchema(overlay, input) {
  const ruleResults = [];
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    fail(ruleResults, 'schema.object', 'LLM output must be a JSON object');
    return { ok: false, ruleResults };
  }
  for (const key of Object.keys(overlay)) {
    if (!TOP_KEYS.has(key)) fail(ruleResults, 'schema.additionalProperties', `Unexpected top-level property: ${key}`);
  }
  if (overlay.schemaVersion !== 'format-profile-llm-overlay.v0') fail(ruleResults, 'schema.schemaVersion', 'schemaVersion mismatch');
  if (overlay.caseId !== input.case.caseId) fail(ruleResults, 'schema.caseId', `caseId mismatch: expected ${input.case.caseId}`);
  if (!overlay.confidence || typeof overlay.confidence !== 'object') fail(ruleResults, 'schema.confidence', 'confidence object is required');
  else {
    for (const key of Object.keys(overlay.confidence)) if (!['semanticConfidence', 'notes'].includes(key)) fail(ruleResults, 'schema.confidence.additionalProperties', `Unexpected confidence property: ${key}`);
    if (!CONFIDENCE.has(overlay.confidence.semanticConfidence)) fail(ruleResults, 'schema.confidence.semanticConfidence', 'semanticConfidence must be high/medium/low/unknown');
    if (overlay.confidence.notes !== undefined && !Array.isArray(overlay.confidence.notes)) fail(ruleResults, 'schema.confidence.notes', 'confidence.notes must be an array when present');
  }
  if (!overlay.semanticOverlay || typeof overlay.semanticOverlay !== 'object' || Array.isArray(overlay.semanticOverlay)) fail(ruleResults, 'schema.semanticOverlay', 'semanticOverlay object is required');
  else {
    for (const [key, claim] of Object.entries(overlay.semanticOverlay)) {
      if (!OVERLAY_KEYS.has(key)) {
        fail(ruleResults, 'schema.semanticOverlay.additionalProperties', `Unexpected semanticOverlay property: ${key}`);
        continue;
      }
      validateClaim(ruleResults, key, claim);
    }
  }
  if (overlay.diagnostics !== undefined) {
    if (!Array.isArray(overlay.diagnostics)) fail(ruleResults, 'schema.diagnostics', 'diagnostics must be an array');
    else overlay.diagnostics.forEach((diag, index) => {
      if (!diag || typeof diag !== 'object' || Array.isArray(diag)) return fail(ruleResults, 'schema.diagnostics.item', `diagnostic ${index} must be an object`);
      for (const key of Object.keys(diag)) if (!['severity', 'code', 'message', 'evidenceRefs'].includes(key)) fail(ruleResults, 'schema.diagnostics.additionalProperties', `Unexpected diagnostic property: ${key}`);
      if (!['info', 'warning'].includes(diag.severity)) fail(ruleResults, 'schema.diagnostics.severity', `diagnostic ${index} severity must be info/warning`);
      if (typeof diag.code !== 'string' || typeof diag.message !== 'string') fail(ruleResults, 'schema.diagnostics.required', `diagnostic ${index} requires code/message`);
    });
  }
  if (ruleResults.some((r) => !r.pass)) return { ok: false, ruleResults };
  pass(ruleResults, 'schema.closed', 'Overlay matches closed harness schema');
  return { ok: true, ruleResults };
}

function validateClaim(ruleResults, name, claim) {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return fail(ruleResults, 'schema.claim.object', `${name} must be an object`);
  for (const key of Object.keys(claim)) if (!CLAIM_KEYS.has(key)) fail(ruleResults, 'schema.claim.additionalProperties', `Unexpected claim property ${name}.${key}`);
  const valueOk = typeof claim.value === 'string' || (Array.isArray(claim.value) && claim.value.every((x) => typeof x === 'string'));
  if (!valueOk) fail(ruleResults, 'schema.claim.value', `${name}.value must be string or string[]`);
  if (!Array.isArray(claim.evidenceRefs) || claim.evidenceRefs.length < 1 || !claim.evidenceRefs.every((x) => typeof x === 'string')) fail(ruleResults, 'schema.claim.evidenceRefs', `${name}.evidenceRefs must be a non-empty string[]`);
  if (typeof claim.inference !== 'boolean') fail(ruleResults, 'schema.claim.inference', `${name}.inference must be boolean`);
  if (typeof claim.rationale !== 'string' || claim.rationale.length < 1) fail(ruleResults, 'schema.claim.rationale', `${name}.rationale is required`);
}

function checkEvidence(input, overlay, ruleResults) {
  const evidenceIds = new Set([...input.rawEvidence.map((item) => item.id), ...asArray(input.sourceContext?.chunks).map((item) => item.id)]);
  let checked = 0;
  for (const [name, claim] of Object.entries(overlay.semanticOverlay || {})) {
    for (const ref of asArray(claim.evidenceRefs)) {
      checked += 1;
      if (!evidenceIds.has(ref)) fail(ruleResults, 'evidence.ref.exists', `${name} references missing evidence: ${ref}`, { ref });
    }
  }
  if (!ruleResults.some((r) => r.code === 'evidence.ref.exists' && !r.pass)) pass(ruleResults, 'evidence.ref.exists', `All ${checked} evidence references exist`);
}

function checkForbiddenTerms(overlay, ruleResults) {
  const text = collectText(overlay).join('\n');
  const hits = FORBIDDEN_TERMS.filter((term) => text.includes(term));
  if (hits.length) fail(ruleResults, 'boundary.forbidden_terms', `Forbidden terms found: ${hits.join(', ')}`, { hits });
  else pass(ruleResults, 'boundary.forbidden_terms', 'No forbidden template/export promises found');
}

function calcStructureNoiseScore(input, overlay) {
  const values = collectClaimValues(overlay.semanticOverlay?.structureSummary);
  if (values.length === 0) return 0.45;
  const numericOnly = values.filter((x) => /^[\d\s\.、-]+$/.test(x.trim())).length;
  const overlong = values.filter((x) => x.length > 130).length;
  let score = 1 - (numericOnly + overlong) / Math.max(1, values.length);
  if (input.case.formatType === 'docx') {
    const chapterish = values.some((x) => /第.+[章节]/u.test(x) || /章|条|总则|附则/u.test(x));
    if (chapterish) score += 0.08;
  }
  if (input.case.formatType === 'pptx' && values.some((x) => /页|幻灯片|逐页|汇报/u.test(x))) score += 0.08;
  if (input.case.formatType === 'xlsx' && values.some((x) => /工作表|指标|数据|表/u.test(x))) score += 0.08;
  if (input.case.formatType === 'pdf' && values.some((x) => /PDF|页|文本层|扫描/u.test(x))) score += 0.08;
  return clamp(score);
}

function collectClaimValues(claim) {
  if (!claim) return [];
  return Array.isArray(claim.value) ? claim.value : [claim.value].filter(Boolean);
}

function calcInstructionCompressionScore(input, rendered) {
  const baseLen = Math.max(1, input.deterministicGenerationInstruction.length);
  const ratio = rendered.length / baseLen;
  if (rendered.length <= (input.case.constraints?.maxInstructionChars || 4000) && ratio <= 0.75) return 1;
  if (rendered.length <= (input.case.constraints?.maxInstructionChars || 4000)) return 0.85;
  return 0.4;
}


function calcTypedCoverage(input, overlay, type) {
  const rawIds = new Set(input.rawEvidence.map((item) => item.id));
  const sourceIds = new Set(asArray(input.sourceContext?.chunks).map((item) => item.id));
  const claims = Object.values(overlay.semanticOverlay || {});
  if (!claims.length) return 0;
  let count = 0;
  for (const claim of claims) {
    const refs = asArray(claim.evidenceRefs);
    if (type === 'raw' && refs.some((ref) => rawIds.has(ref))) count += 1;
    if (type === 'source' && refs.some((ref) => sourceIds.has(ref))) count += 1;
  }
  return count / claims.length;
}

function calcEvidenceCoverageScore(overlay) {
  const claims = Object.values(overlay.semanticOverlay || {});
  if (!claims.length) return 0.4;
  return claims.filter((claim) => asArray(claim.evidenceRefs).length > 0).length / claims.length;
}

function calcBoundarySafetyScore(input, overlay, rendered) {
  const text = `${collectText(overlay).join('\n')}\n${rendered}`;
  if (FORBIDDEN_TERMS.some((term) => text.includes(term))) return 0;
  let score = 0.82;
  if (/不承诺|不代表|不根据格式画像虚构|事实边界/.test(text)) score += 0.1;
  if (input.case.formatType === 'pdf' && /参考|不承诺/.test(text)) score += 0.05;
  if (['xlsx', 'pptx'].includes(input.case.formatType) && /不承诺导出|不代表正式导出|边界/.test(text)) score += 0.05;
  return clamp(score);
}

function clamp(value) { return Math.max(0, Math.min(1, value)); }

export function evaluateOverlay(input, overlay) {
  const schema = validateOverlaySchema(overlay, input);
  const ruleResults = [...schema.ruleResults];
  if (!schema.ok) {
    return {
      schemaVersion: 'format-profile-evaluator-report.v0',
      caseId: input.case.caseId,
      verdict: 'fail',
      ruleResults,
      metrics: { qualityScore: 0 },
      diagnostics: [{ severity: 'error', code: 'schema_invalid', message: 'Overlay failed closed schema validation.' }],
    };
  }
  checkEvidence(input, overlay, ruleResults);
  checkForbiddenTerms(overlay, ruleResults);
  const rendered = renderGenerationInstruction(input, overlay);
  if (rendered.length > (input.case.constraints?.maxInstructionChars || 4000)) fail(ruleResults, 'renderer.max_chars', 'Rendered instruction exceeds case maxInstructionChars');
  else pass(ruleResults, 'renderer.max_chars', 'Rendered instruction stays within case budget', { length: rendered.length });

  const metrics = {
    structureNoiseScore: calcStructureNoiseScore(input, overlay),
    instructionCompressionScore: calcInstructionCompressionScore(input, rendered),
    evidenceCoverageScore: calcEvidenceCoverageScore(overlay),
    rawEvidenceCoverageScore: calcTypedCoverage(input, overlay, 'raw'),
    sourceContextCoverageScore: calcTypedCoverage(input, overlay, 'source'),
    boundarySafetyScore: calcBoundarySafetyScore(input, overlay, rendered),
  };
  metrics.qualityScore = 0.35 * metrics.structureNoiseScore + 0.25 * metrics.instructionCompressionScore + 0.20 * metrics.evidenceCoverageScore + 0.20 * metrics.boundarySafetyScore;
  const threshold = input.case.expected?.qualityThreshold ?? 0.7;
  if (metrics.qualityScore >= threshold) pass(ruleResults, 'metrics.quality_threshold', `Quality score ${metrics.qualityScore.toFixed(3)} >= ${threshold}`);
  else fail(ruleResults, 'metrics.quality_threshold', `Quality score ${metrics.qualityScore.toFixed(3)} < ${threshold}`);

  const verdict = ruleResults.every((r) => r.pass) ? 'pass' : 'fail';
  return {
    schemaVersion: 'format-profile-evaluator-report.v0',
    caseId: input.case.caseId,
    verdict,
    ruleResults,
    metrics,
    diagnostics: verdict === 'pass' ? [] : [{ severity: 'error', code: 'evaluator_rejected', message: 'Overlay failed evaluator checks.' }],
    renderedInstructionSha256: sha256(rendered),
  };
}
