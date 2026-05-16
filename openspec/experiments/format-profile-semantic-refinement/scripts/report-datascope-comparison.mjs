#!/usr/bin/env node
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'experiments/format-profile-semantic-refinement';
const outputs = path.join(root, 'outputs');
const rows = [];
async function exists(file) { try { await readFile(file); return true; } catch { return false; } }
for (const mode of await readdir(outputs).catch(() => [])) {
  const modeDir = path.join(outputs, mode);
  for (const requested of await readdir(modeDir).catch(() => [])) {
    const reqDir = path.join(modeDir, requested);
    for (const effective of await readdir(reqDir).catch(() => [])) {
      const effDir = path.join(reqDir, effective);
      for (const caseId of await readdir(effDir).catch(() => [])) {
        const outPath = path.join(effDir, caseId, 'harness-output.json');
        if (!await exists(outPath)) continue;
        const out = JSON.parse(await readFile(outPath, 'utf8'));
        let report = { metrics: {} };
        try { report = JSON.parse(await readFile(path.join(effDir, caseId, 'evaluator-report.json'), 'utf8')); } catch {}
        rows.push({ mode, requestedScope: requested, effectiveScope: effective, caseId, attemptStatus: out.attemptStatus, evaluatorVerdict: out.evaluatorVerdict, finalStatus: out.finalStatus, fallbackReason: out.fallbackReason, qualityScore: report.metrics?.qualityScore, rawEvidenceCoverageScore: report.metrics?.rawEvidenceCoverageScore, sourceContextCoverageScore: report.metrics?.sourceContextCoverageScore, sourceContextChunkCount: out.dataScope?.sourceContextChunkCount });
      }
    }
  }
}
await mkdir(path.join(root, 'reports'), { recursive: true });
await writeFile(path.join(root, 'reports', 'datascope-comparison.json'), `${JSON.stringify({ schemaVersion: 'format-profile-datascope-comparison.v0', rows }, null, 2)}\n`, 'utf8');
const lines = ['# FormatProfile DataScope Comparison', '', '| Mode | Case | Requested | Effective | Final | Verdict | Fallback | Quality | RawCov | SourceCov | Chunks |', '| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |'];
for (const r of rows.sort((a,b)=>`${a.mode}${a.caseId}${a.requestedScope}`.localeCompare(`${b.mode}${b.caseId}${b.requestedScope}`))) {
  const f = (x) => x === undefined || x === null ? '' : (typeof x === 'number' ? x.toFixed(3) : x);
  lines.push(`| ${r.mode} | ${r.caseId} | ${r.requestedScope} | ${r.effectiveScope} | ${r.finalStatus} | ${r.evaluatorVerdict} | ${r.fallbackReason || ''} | ${f(r.qualityScore)} | ${f(r.rawEvidenceCoverageScore)} | ${f(r.sourceContextCoverageScore)} | ${r.sourceContextChunkCount ?? ''} |`);
}
await writeFile(path.join(root, 'reports', 'datascope-comparison.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, rows: rows.length }, null, 2));
