import { sha256, truncateText, asArray } from './utils.mjs';

export const DATA_SCOPES = new Set(['evidence-only', 'evidence-plus-snippets', 'evidence-plus-fulltext']);

export const SCOPE_CAPS = {
  'evidence-only': { maxChunks: 0, perChunkChars: 0, totalChars: 0, tokenEstimateCap: 0 },
  'evidence-plus-snippets': { maxChunks: 24, perChunkChars: 500, totalChars: 8000, tokenEstimateCap: 2500 },
  'evidence-plus-fulltext': { maxChunks: 80, perChunkChars: 1000, totalChars: 40000, tokenEstimateCap: 12000 },
};

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
  /((?:api[_-]?key|token|secret)["'\s:=]+)[A-Za-z0-9._-]{12,}/gi,
];

const PATH_PATTERNS = [
  /[A-Za-z]:\\[^\s"'<>]+/g,
  /\\\\[^\s"'<>]+\\[^\s"'<>]+/g,
  /file:\/\/\/[^\s"'<>]+/gi,
  /\/(?:Users|home|mnt|tmp|var\/folders)\/[^\s"'<>]+/g,
  /runtime[\\/]format-profile[\\/]samples[\\/][^\s"'<>]*/g,
  /\.llm-wiki[\\/][^\s"'<>]*/g,
  /\.omx[\\/][^\s"'<>]*/g,
];

export function estimateTokens(text) {
  const s = String(text || '');
  const cjk = (s.match(/[\u3400-\u9fff]/g) || []).length;
  const byCjk = Math.ceil(s.length / 2);
  const byMixed = Math.ceil(s.length / 4);
  return cjk > s.length * 0.25 ? byCjk : Math.max(byCjk, byMixed);
}

export function sanitizeText(text) {
  let out = String(text ?? '');
  const stats = { redactedPaths: 0, redactedSecrets: 0 };
  for (const pattern of PATH_PATTERNS) {
    out = out.replace(pattern, () => {
      stats.redactedPaths += 1;
      return '[REDACTED_PATH]';
    });
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, prefix = '') => {
      stats.redactedSecrets += 1;
      return `${prefix || ''}[REDACTED_SECRET]`;
    });
  }
  return { text: out.replace(/\s+/g, ' ').trim(), stats };
}

export function sanitizeValue(value) {
  if (typeof value === 'string') return sanitizeText(value).text;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (['sourcePath', 'path', 'runtimeDir', 'profilePath', 'instructionPath', 'diagnosticsPath'].includes(key)) {
        out[key] = '[REDACTED_PATH]';
      } else {
        out[key] = sanitizeValue(val);
      }
    }
    return out;
  }
  return value;
}

export function sanitizeArtifact(value) {
  return sanitizeValue(value);
}

function makeChunk({ id, kind, text, linkedEvidenceRefs = [], qualityFlags = [], cap }) {
  const sanitized = sanitizeText(text);
  const clipped = truncateText(sanitized.text, cap.perChunkChars);
  const chunk = {
    id,
    kind,
    linkedEvidenceRefs,
    text: clipped || '',
    charLength: (clipped || '').length,
    tokenEstimate: estimateTokens(clipped || ''),
    redactionStatus: sanitized.stats.redactedPaths || sanitized.stats.redactedSecrets ? 'redacted' : 'clean',
    redactionStats: sanitized.stats,
    qualityFlags,
  };
  chunk.sha256 = sha256(chunk);
  return chunk;
}

function enforceCaps(chunks, cap) {
  const out = [];
  let chars = 0;
  let tokens = 0;
  let truncated = false;
  for (const chunk of chunks) {
    if (out.length >= cap.maxChunks) { truncated = true; break; }
    if (chars + chunk.charLength > cap.totalChars || tokens + chunk.tokenEstimate > cap.tokenEstimateCap) { truncated = true; break; }
    out.push(chunk);
    chars += chunk.charLength;
    tokens += chunk.tokenEstimate;
  }
  return { chunks: out, stats: { chunkCount: out.length, totalChars: chars, tokenEstimate: tokens, truncated } };
}

function evidenceByKind(input, kind) {
  return input.rawEvidence.filter((item) => item.kind === kind);
}

function docxCandidateTexts(input, fulltext = false) {
  const p = input.deterministicProfile;
  const refs = evidenceByKind(input, 'raw.docx.paragraph');
  const paraSamples = asArray(p?.rawProbeFacts?.structure?.paragraphSamples).map((x, i) => ({ text: x.text, ref: refs[i]?.id || 'profile.structure.0001', flags: ['paragraph-sample'] }));
  const headings = asArray(p?.rawProbeFacts?.structure?.headingCandidates).map((x, i) => ({ text: x.text, ref: refs[i]?.id || refs[0]?.id, flags: ['heading-candidate'] }));
  const textSample = asArray(p?.rawProbeFacts?.structure?.textSample).map((x, i) => ({ text: x, ref: refs[i]?.id || refs[0]?.id, flags: ['text-sample'] }));
  const merged = fulltext ? [...paraSamples, ...headings, ...textSample] : [...paraSamples.slice(0, 8), ...headings.slice(0, 12), ...textSample.slice(0, 4)];
  return merged.filter((x) => x.text);
}

function xlsxCandidateTexts(input, fulltext = false) {
  const p = input.deterministicProfile;
  const refs = evidenceByKind(input, 'raw.xlsx.sheet');
  const sheets = asArray(p?.rawProbeFacts?.structure?.sheets).map((x, i) => ({ text: `工作表 ${x.name || i + 1} sheetId=${x.sheetId || ''}`, ref: refs[i]?.id || refs[0]?.id, flags: ['sheet'] }));
  const stats = asArray(p?.rawProbeFacts?.structure?.sheetStats).map((x, i) => ({ text: `工作表范围 ${x.dimension || ''} rows=${x.rowCount} cells=${x.cellCount} merged=${x.mergedCellCount} formulas=${x.formulaCount}`, ref: refs[i]?.id || refs[0]?.id, flags: ['sheet-stats'] }));
  const strings = asArray(p?.rawProbeFacts?.style?.sharedStringsSample ?? p?.styleProfile?.formatSpecific?.sharedStringsSample).map((x, i) => ({ text: String(x), ref: refs[0]?.id, flags: ['shared-string'] }));
  return (fulltext ? [...sheets, ...stats, ...strings] : [...sheets, ...stats, ...strings.slice(0, 12)]).filter((x) => x.text);
}

function pptxCandidateTexts(input, fulltext = false) {
  const p = input.deterministicProfile;
  const refs = evidenceByKind(input, 'raw.pptx.slide');
  const stats = asArray(p?.rawProbeFacts?.structure?.slideStats);
  const selected = fulltext ? stats : [...stats.slice(0, 3), ...stats.slice(8, 12), ...stats.slice(-2)];
  return selected.map((x, i) => ({
    text: `slide ${x.path || i + 1}: textCount=${x.textCount} shapeCount=${x.shapeCount} pictureCount=${x.pictureCount}; ${asArray(x.textSample).join(' / ')}`,
    ref: refs[i]?.id || refs[0]?.id,
    flags: ['slide-text'],
  })).filter((x) => x.text);
}

function pdfCandidateTexts(input, fulltext = false) {
  const p = input.deterministicProfile;
  const refs = input.rawEvidence.filter((item) => item.kind === 'raw.pdf.fact');
  const facts = refs.map((ref) => ({ text: `${ref.id}: ${ref.text || JSON.stringify(ref.value)}`, ref: ref.id, flags: ['pdf-fact'] }));
  const samples = asArray(p?.rawProbeFacts?.structure?.textSample ?? p?.structureProfile?.sections).map((x, i) => ({ text: typeof x === 'string' ? x : (x.text || x.title || JSON.stringify(x)), ref: refs[i % Math.max(1, refs.length)]?.id, flags: ['pdf-text-sample'] }));
  return (fulltext ? [...facts, ...samples] : [...facts, ...samples.slice(0, 8)]).filter((x) => x.text);
}

function candidatesFor(input, fulltext) {
  switch (input.case.formatType) {
    case 'docx': return docxCandidateTexts(input, fulltext);
    case 'xlsx': return xlsxCandidateTexts(input, fulltext);
    case 'pptx': return pptxCandidateTexts(input, fulltext);
    case 'pdf': return pdfCandidateTexts(input, fulltext);
    default: return [];
  }
}

export function buildSourceContext(input, dataScope) {
  if (dataScope === 'evidence-only') return { chunks: [], stats: { chunkCount: 0, totalChars: 0, tokenEstimate: 0, truncated: false }, sha256: sha256([]) };
  const fulltext = dataScope === 'evidence-plus-fulltext';
  const cap = SCOPE_CAPS[dataScope];
  const prefix = fulltext ? 'source.fulltext.chunk' : 'source.snippet';
  const raw = candidatesFor(input, fulltext);
  const chunks = raw.map((item, index) => makeChunk({
    id: `${prefix}.${String(index + 1).padStart(4, '0')}`,
    kind: fulltext ? 'source.fulltext.chunk' : 'source.snippet',
    text: item.text,
    linkedEvidenceRefs: item.ref ? [item.ref] : [],
    qualityFlags: item.flags,
    cap,
  })).filter((chunk) => chunk.text);
  const capped = enforceCaps(chunks, cap);
  return { ...capped, sha256: sha256(capped.chunks), caps: cap };
}

export function validateSourceAuthorization(dataScope, { allowSnippets = false, allowFulltext = false }) {
  if (!DATA_SCOPES.has(dataScope)) return { ok: false, reason: 'invalid_data_scope' };
  if (dataScope === 'evidence-plus-snippets' && !allowSnippets) return { ok: false, reason: 'source_context_unauthorized' };
  if (dataScope === 'evidence-plus-fulltext' && !allowFulltext) return { ok: false, reason: 'source_context_unauthorized' };
  return { ok: true };
}

export function collectAllowedEvidenceIds(input) {
  return [
    ...input.rawEvidence.map((item) => item.id),
    ...asArray(input.sourceContext?.chunks).map((item) => item.id),
  ];
}
