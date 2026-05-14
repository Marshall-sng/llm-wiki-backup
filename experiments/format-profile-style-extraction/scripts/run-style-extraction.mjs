#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, selectCases, runtimeRoot, writeJson } from './lib/case-loader.mjs';
import { stableStringify } from './lib/stable-json.mjs';
import { buildStyleFacts } from './lib/style-parser.mjs';
import { createOverlay, validateOverlay } from './lib/overlay.mjs';
import { writeMarkdownSummary, writeModeReport } from './lib/report.mjs';

const overlayModes = new Set(['mock-pass', 'mock-hallucination', 'mock-overwrite-facts', 'mock-unknown-evidence']);
const validModes = new Set(['deterministic', ...overlayModes]);

function outputDirFor(mode, caseId) {
  return path.join(runtimeRoot, 'outputs', mode, caseId);
}

function runCase(caseDef, mode) {
  const styleEnvelope = buildStyleFacts(caseDef);
  const outDir = outputDirFor(mode, caseDef.caseId);
  fs.mkdirSync(outDir, { recursive: true });
  writeJson(path.join(outDir, 'style-facts.json'), styleEnvelope, stableStringify);
  fs.writeFileSync(path.join(outDir, 'style-facts.sha256'), `${styleEnvelope.metadata.styleFactsSha256}\n`, 'utf8');

  let overlayResult = null;
  if (overlayModes.has(mode)) {
    const rawOverlay = createOverlay(mode, caseDef.caseId, styleEnvelope);
    writeJson(path.join(outDir, 'style-interpretation-overlay.raw.json'), rawOverlay, stableStringify);
    overlayResult = validateOverlay(rawOverlay, styleEnvelope);
    const overlayFile = overlayResult.status === 'accepted' ? 'style-interpretation-overlay.json' : 'style-interpretation-overlay.rejected.json';
    writeJson(path.join(outDir, overlayFile), overlayResult, stableStringify);
    writeJson(path.join(outDir, 'overlay-result.json'), {
      mode,
      status: overlayResult.status,
      factHashUnchanged: true,
      deterministicHash: styleEnvelope.metadata.styleFactsSha256,
      diagnostics: overlayResult.diagnostics ?? []
    }, stableStringify);
  }
  writeMarkdownSummary(runtimeRoot, caseDef.caseId, mode, styleEnvelope, overlayResult);
  return {
    caseId: caseDef.caseId,
    format: caseDef.format,
    status: 'pass',
    outputDir: path.relative(process.cwd(), outDir).replace(/\\/g, '/'),
    styleFactsSha256: styleEnvelope.metadata.styleFactsSha256,
    overlayStatus: overlayResult?.status ?? 'not-run'
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!validModes.has(args.mode)) throw new Error(`Unsupported mode ${args.mode}`);
  const cases = selectCases(args.caseId);
  const results = cases.map((caseDef) => runCase(caseDef, args.mode));
  const reportPath = writeModeReport(runtimeRoot, args.mode, results);
  console.log(JSON.stringify({ mode: args.mode, cases: results.length, reportPath: path.relative(process.cwd(), reportPath).replace(/\\/g, '/') }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exit(1);
}
