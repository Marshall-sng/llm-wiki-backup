const forbiddenTopLevelKeys = new Set([
  'styleFacts', 'styleProfile', 'typography', 'layout', 'colors', 'spacing', 'borders', 'styles', 'formatSpecific'
]);
const allowedTopLevelKeys = new Set(['schemaVersion', 'caseId', 'status', 'claims', 'diagnostics']);

export function createOverlay(mode, caseId, styleEnvelope) {
  const firstEvidence = styleEnvelope.evidence[0]?.id;
  if (mode === 'mock-pass') {
    return {
      schemaVersion: 'format-profile-style-interpretation.v0',
      caseId,
      status: 'accepted',
      claims: [
        {
          text: `${styleEnvelope.source.fileType.toUpperCase()} 样式事实可用于生成前诊断与格式约束提示，但不能承诺导出复刻。`,
          evidenceRefs: [firstEvidence],
          confidence: 'medium'
        }
      ],
      diagnostics: []
    };
  }
  if (mode === 'mock-hallucination') {
    return {
      schemaVersion: 'format-profile-style-interpretation.v0',
      caseId,
      status: 'accepted',
      claims: [
        { text: 'LLM claims the document uses Comic Sans and A3 landscape layout.', evidenceRefs: [], confidence: 'high' }
      ],
      diagnostics: []
    };
  }
  if (mode === 'mock-overwrite-facts') {
    return {
      schemaVersion: 'format-profile-style-interpretation.v0',
      caseId,
      status: 'accepted',
      claims: [{ text: 'Attempt to smuggle facts.', evidenceRefs: [firstEvidence], confidence: 'medium' }],
      styleFacts: { typography: { fonts: ['Comic Sans MS'] } }
    };
  }
  if (mode === 'mock-unknown-evidence') {
    return {
      schemaVersion: 'format-profile-style-interpretation.v0',
      caseId,
      status: 'accepted',
      claims: [{ text: 'Claim cites unknown evidence.', evidenceRefs: ['style.docx.missing.9999'], confidence: 'medium' }],
      diagnostics: []
    };
  }
  throw new Error(`Unsupported overlay mode ${mode}`);
}

export function validateOverlay(rawOverlay, styleEnvelope) {
  const diagnostics = [];
  for (const key of Object.keys(rawOverlay)) {
    if (forbiddenTopLevelKeys.has(key)) diagnostics.push({ severity: 'error', code: 'overlay.forbidden_fact_field', message: `Forbidden overlay key: ${key}` });
    else if (!allowedTopLevelKeys.has(key)) diagnostics.push({ severity: 'error', code: 'overlay.unknown_top_level_key', message: `Unknown overlay key: ${key}` });
  }
  if (rawOverlay.schemaVersion !== 'format-profile-style-interpretation.v0') {
    diagnostics.push({ severity: 'error', code: 'overlay.bad_schema_version', message: 'Overlay schema version mismatch.' });
  }
  if (rawOverlay.caseId !== styleEnvelope.caseId) {
    diagnostics.push({ severity: 'error', code: 'overlay.case_mismatch', message: 'Overlay caseId does not match deterministic facts.' });
  }
  if (!Array.isArray(rawOverlay.claims)) {
    diagnostics.push({ severity: 'error', code: 'overlay.claims_not_array', message: 'Overlay claims must be an array.' });
  }
  const evidenceIds = new Set(styleEnvelope.evidence.map((entry) => entry.id));
  for (const [index, claim] of (rawOverlay.claims ?? []).entries()) {
    if (!Array.isArray(claim.evidenceRefs) || claim.evidenceRefs.length === 0) {
      diagnostics.push({ severity: 'error', code: 'overlay.claim_missing_evidence', message: `Claim ${index} has no evidenceRefs.` });
    } else {
      for (const ref of claim.evidenceRefs) {
        if (!evidenceIds.has(ref)) diagnostics.push({ severity: 'error', code: 'overlay.unknown_evidence', message: `Claim ${index} cites unknown evidence ${ref}.` });
      }
    }
    if (/Comic Sans|A3 landscape/i.test(claim.text ?? '')) {
      diagnostics.push({ severity: 'error', code: 'overlay.uncited_hallucination_pattern', message: `Claim ${index} contains known unsupported hallucination text.` });
    }
  }
  if (diagnostics.some((d) => d.severity === 'error')) {
    return {
      schemaVersion: 'format-profile-style-interpretation.v0',
      caseId: styleEnvelope.caseId,
      status: 'rejected',
      claims: [],
      diagnostics
    };
  }
  return {
    schemaVersion: 'format-profile-style-interpretation.v0',
    caseId: styleEnvelope.caseId,
    status: 'accepted',
    claims: rawOverlay.claims,
    diagnostics
  };
}
