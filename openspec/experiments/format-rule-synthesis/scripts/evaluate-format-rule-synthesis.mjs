#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..', '..');
const runScript = path.join(root, 'scripts', 'run-format-rule-synthesis.mjs');

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeJson(file, value) { await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
async function writeText(file, value) { await writeFile(file, value.endsWith('\n') ? value : value + '\n', 'utf8'); }
function sha256Text(s) { return createHash('sha256').update(String(s)).digest('hex'); }
async function sha256File(file) { return sha256Text(await readFile(file)); }

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', c => { stdout += c.toString(); });
    child.stderr.on('data', c => { stderr += c.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function ensureRun(mode) {
  const summaryPath = path.join(root, 'reports', `${mode}-summary.json`);
  try { return await readJson(summaryPath); } catch {}
  const result = await runNode([runScript, '--mode', mode]);
  const summary = await readJson(summaryPath).catch(() => null);
  return summary || { mode, total: 0, passed: 0, failed: ['runner'], runner: result };
}

function md(report) {
  const lines = ['# FormatRuleSpec Independent Evaluation', '', `Generated: ${report.generatedAt}`, '', `Verdict: ${report.verdict}`, ''];
  lines.push('| Mode | Expected | Total | Passed | Failed |');
  lines.push('| --- | --- | ---: | ---: | --- |');
  for (const r of report.modes) lines.push(`| ${r.mode} | ${r.expected} | ${r.total} | ${r.passed} | ${r.failed.join(', ') || '-'} |`);
  lines.push('', '## Metrics');
  for (const r of report.modes) {
    lines.push(`### ${r.mode}`);
    for (const item of r.results) lines.push(`- ${item.caseId}: verdict=${item.verdict}; rules=${item.metrics?.ruleCount}; attrs=${item.metrics?.attributeCount}; score=${item.metrics?.granularityScore}`);
  }
  return lines.join('\n') + '\n';
}

const happy = await ensureRun('mock-llm');
const negative = await ensureRun('mock-uncited');
const happyOk = happy.total === 4 && happy.passed === 4 && happy.failed.length === 0;
const negativeOk = negative.total === 4 && negative.passed === 0 && negative.failed.length === 4;
const report = {
  schemaVersion: 'format-rule-synthesis-independent-evaluation.v0',
  generatedAt: new Date().toISOString(),
  verdict: happyOk && negativeOk ? 'pass' : 'fail',
  modes: [
    { mode: 'mock-llm', expected: 'all-pass', total: happy.total, passed: happy.passed, failed: happy.failed, results: happy.results || [] },
    { mode: 'mock-uncited', expected: 'all-fail', total: negative.total, passed: negative.passed, failed: negative.failed, results: negative.results || [] },
  ],
  provenance: {
    evaluatorSha256: await sha256File(__filename),
    generatorSha256: await sha256File(runScript),
    happySummarySha256: sha256Text(JSON.stringify(happy)),
    negativeSummarySha256: sha256Text(JSON.stringify(negative)),
  },
};
await mkdir(path.join(root, 'reports'), { recursive: true });
await writeJson(path.join(root, 'reports', 'independent-evaluator-summary.json'), report);
await writeText(path.join(root, 'reports', 'independent-evaluator-summary.md'), md(report));
console.log(JSON.stringify({ verdict: report.verdict, happy: `${happy.passed}/${happy.total}`, negativeFailed: `${negative.failed.length}/${negative.total}` }, null, 2));
if (report.verdict !== 'pass') process.exitCode = 1;
