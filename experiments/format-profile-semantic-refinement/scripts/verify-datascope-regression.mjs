#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
let baseline = null;
let candidate = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--baseline') baseline = args[++i];
  else if (args[i] === '--candidate') candidate = args[++i];
}
if (!baseline || !candidate) throw new Error('--baseline and --candidate are required');

const cases = ['docx-policy', 'xlsx-metrics', 'pptx-briefing', 'pdf-reference'];
function normalize(out) {
  return {
    caseId: out.caseId,
    attemptStatus: out.attemptStatus,
    evaluatorVerdict: out.evaluatorVerdict,
    finalStatus: out.finalStatus,
    fallbackReason: out.fallbackReason ?? null,
    deterministicProfileSha256: out.hashes?.deterministicProfileSha256,
    deterministicInstructionSha256: out.hashes?.deterministicInstructionSha256,
    rawEvidenceSha256: out.hashes?.rawEvidenceSha256,
    renderedInstructionSha256: out.hashes?.renderedInstructionSha256,
    hasAcceptedOverlay: !!out.acceptedOverlay,
  };
}
const failures = [];
for (const c of cases) {
  const b = JSON.parse(await readFile(path.join(baseline, c, 'harness-output.json'), 'utf8'));
  const d = JSON.parse(await readFile(path.join(candidate, c, 'harness-output.json'), 'utf8'));
  const nb = normalize(b);
  const nd = normalize(d);
  if (JSON.stringify(nb) !== JSON.stringify(nd)) failures.push({ caseId: c, baseline: nb, candidate: nd });
}
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, cases }, null, 2));
