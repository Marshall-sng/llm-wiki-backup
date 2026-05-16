export function buildFallbackOutput(input, { attemptStatus, fallbackReason, diagnostics = [], evaluatorVerdict = 'not_run', evaluatorReportPath } = {}) {
  if (!fallbackReason) throw new Error('fallbackReason is required');
  const output = {
    schemaVersion: 'format-profile-harness-output.v0',
    caseId: input.case.caseId,
    attemptStatus,
    evaluatorVerdict,
    finalStatus: 'fallback',
    fallbackReason,
    hashes: {
      deterministicProfileSha256: input.hashes.deterministicProfileSha256,
      deterministicInstructionSha256: input.hashes.deterministicInstructionSha256,
      rawEvidenceSha256: input.hashes.rawEvidenceSha256,
      renderedInstructionSha256: input.hashes.deterministicInstructionSha256,
    },
    renderedGenerationInstruction: input.deterministicGenerationInstruction,
    diagnostics,
    reports: {},
  };
  if (evaluatorReportPath) output.reports.evaluatorReportPath = evaluatorReportPath;
  return output;
}
