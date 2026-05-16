#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { buildDeterministicCleanupOverlay } from './lib/deterministic-cleanup.mjs';
import { evaluateOverlay, validateOverlaySchema } from './lib/evaluator.mjs';
import { buildFallbackOutput } from './lib/fallback.mjs';
import { listCases, loadCase, loadRefinementInput } from './lib/load-input.mjs';
import { runLlmRefiner } from './lib/llm-refiner.mjs';
import { renderGenerationInstruction } from './lib/renderer.mjs';
import { sha256, writeJson, writeText } from './lib/utils.mjs';
import { DATA_SCOPES, sanitizeArtifact, sanitizeText, validateSourceAuthorization } from './lib/source-context.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(harnessRoot, '..', '..');

function parseArgs(argv) {
  const args = { mode: 'disabled', caseId: null, allowExternalLlm: false, dataScope: 'evidence-only', allowSnippets: false, allowFulltext: false, downgradeUnauthorized: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') args.mode = argv[++i];
    else if (arg === '--case') args.caseId = argv[++i];
    else if (arg === '--allow-external-llm') args.allowExternalLlm = true;
    else if (arg === '--data-scope') args.dataScope = argv[++i];
    else if (arg === '--allow-snippets') args.allowSnippets = true;
    else if (arg === '--allow-fulltext') args.allowFulltext = true;
    else if (arg === '--downgrade-unauthorized') args.downgradeUnauthorized = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage: node experiments/format-profile-semantic-refinement/scripts/run-refinement.mjs [--mode MODE] [--case CASE_ID] [--allow-external-llm]\n\nModes: disabled, mock-pass, mock-hallucination, mock-overreach-instruction, mock-invalid-json, mock-schema-invalid, mock-error, real-llm
Data scopes: evidence-only, evidence-plus-snippets, evidence-plus-fulltext`;
}

function evaluatorNotRun(input, code, message) {
  return {
    schemaVersion: 'format-profile-evaluator-report.v0',
    caseId: input.case.caseId,
    verdict: 'not_run',
    ruleResults: [],
    metrics: { qualityScore: 0 },
    diagnostics: [{ severity: 'error', code, message }],
  };
}

function outputNameForMode(mode) {
  return mode.replace(/[^a-z0-9_-]/gi, '_');
}

async function runCase(caseConfig, args) {
  if (!DATA_SCOPES.has(args.dataScope)) throw new Error(`Invalid --data-scope: ${args.dataScope}`);
  const auth = validateSourceAuthorization(args.dataScope, { allowSnippets: args.allowSnippets, allowFulltext: args.allowFulltext });
  const effectiveScope = auth.ok ? args.dataScope : (args.downgradeUnauthorized ? 'evidence-only' : 'unauthorized');
  const outputDir = path.join(harnessRoot, 'outputs', outputNameForMode(args.mode), args.dataScope, effectiveScope, caseConfig.caseId);
  await mkdir(outputDir, { recursive: true });
  if (!auth.ok && !args.downgradeUnauthorized) {
    const minimalCase = { schemaVersion: 'format-profile-harness-output.v0', caseId: caseConfig.caseId, attemptStatus: 'not_attempted', evaluatorVerdict: 'not_run', finalStatus: 'fallback', fallbackReason: auth.reason, dataScope: { requestedScope: args.dataScope, effectiveScope, sourceContextAuthorized: false }, hashes: {}, renderedGenerationInstruction: '', diagnostics: [{ severity: 'error', code: auth.reason, message: 'Requested source context scope was not authorized; no prompt was constructed and no LLM call was made.' }], reports: {} };
    await writeJson(path.join(outputDir, 'harness-output.json'), minimalCase);
    return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: 'fallback', attemptStatus: 'not_attempted', evaluatorVerdict: 'not_run', fallbackReason: auth.reason, outputDir };
  }
  const input = await loadRefinementInput({ repoRoot, harnessRoot, caseConfig, outputDir, dataScope: effectiveScope, requestedScope: args.dataScope });
  const deterministicCleanup = buildDeterministicCleanupOverlay(input);
  await writeJson(path.join(outputDir, 'deterministic-cleanup-overlay.json'), deterministicCleanup);

  let llmResult;
  try {
    llmResult = await runLlmRefiner(input, { mode: args.mode, allowExternalLlm: args.allowExternalLlm });
  } catch (error) {
    const report = evaluatorNotRun(input, 'llm_error', error.message);
    await writeJson(path.join(outputDir, 'evaluator-report.json'), sanitizeArtifact(report));
    const fallback = buildFallbackOutput(input, { attemptStatus: 'llm_error', fallbackReason: 'llm_error', evaluatorVerdict: 'not_run', diagnostics: report.diagnostics, evaluatorReportPath: 'evaluator-report.json' });
    fallback.dataScope = input.dataScope;
    await writeJson(path.join(outputDir, 'harness-output.json'), sanitizeArtifact(fallback));
    await writeJson(path.join(outputDir, 'fallback-output.json'), sanitizeArtifact(fallback));
    await writeText(path.join(outputDir, 'final-generation-instruction.md'), fallback.renderedGenerationInstruction);
    return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: fallback.finalStatus, attemptStatus: fallback.attemptStatus, evaluatorVerdict: fallback.evaluatorVerdict, fallbackReason: fallback.fallbackReason, outputDir };
  }

  if (llmResult.status === 'not_attempted') {
    const report = evaluatorNotRun(input, 'llm_disabled', 'LLM refinement disabled by mode.');
    await writeJson(path.join(outputDir, 'evaluator-report.json'), sanitizeArtifact(report));
    const fallback = buildFallbackOutput(input, { attemptStatus: 'not_attempted', fallbackReason: 'llm_disabled', evaluatorVerdict: 'not_run', diagnostics: report.diagnostics, evaluatorReportPath: 'evaluator-report.json' });
    fallback.dataScope = input.dataScope;
    await writeJson(path.join(outputDir, 'harness-output.json'), sanitizeArtifact(fallback));
    await writeJson(path.join(outputDir, 'fallback-output.json'), sanitizeArtifact(fallback));
    await writeText(path.join(outputDir, 'final-generation-instruction.md'), fallback.renderedGenerationInstruction);
    return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: fallback.finalStatus, attemptStatus: fallback.attemptStatus, evaluatorVerdict: fallback.evaluatorVerdict, fallbackReason: fallback.fallbackReason, outputDir };
  }

  await writeText(path.join(outputDir, 'llm-output.raw.txt'), sanitizeText(llmResult.rawText || '').text);
  if (llmResult.providerRawText) {
    const providerText = sanitizeText(llmResult.providerRawText).text;
    if (effectiveScope === 'evidence-only') await writeText(path.join(outputDir, 'llm-provider-output.raw.txt'), providerText);
    else {
      await writeText(path.join(outputDir, 'llm-provider-output.excerpt.txt'), providerText.slice(0, 1000));
      await writeText(path.join(outputDir, 'llm-provider-output.sha256'), sha256(providerText));
    }
  }
  if (llmResult.provider) await writeJson(path.join(outputDir, 'llm-provider.json'), sanitizeArtifact(llmResult.provider));
  let overlay;
  try {
    overlay = JSON.parse(llmResult.rawText);
  } catch (error) {
    const report = evaluatorNotRun(input, 'invalid_json', error.message);
    await writeJson(path.join(outputDir, 'evaluator-report.json'), sanitizeArtifact(report));
    const fallback = buildFallbackOutput(input, { attemptStatus: 'invalid_json', fallbackReason: 'invalid_json', evaluatorVerdict: 'not_run', diagnostics: report.diagnostics, evaluatorReportPath: 'evaluator-report.json' });
    fallback.dataScope = input.dataScope;
    await writeJson(path.join(outputDir, 'harness-output.json'), sanitizeArtifact(fallback));
    await writeJson(path.join(outputDir, 'fallback-output.json'), sanitizeArtifact(fallback));
    await writeText(path.join(outputDir, 'final-generation-instruction.md'), fallback.renderedGenerationInstruction);
    return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: fallback.finalStatus, attemptStatus: fallback.attemptStatus, evaluatorVerdict: fallback.evaluatorVerdict, fallbackReason: fallback.fallbackReason, outputDir };
  }

  await writeJson(path.join(outputDir, 'semantic-overlay.json'), sanitizeArtifact(overlay));
  const schema = validateOverlaySchema(overlay, input);
  if (!schema.ok) {
    const report = {
      schemaVersion: 'format-profile-evaluator-report.v0',
      caseId: input.case.caseId,
      verdict: 'not_run',
      ruleResults: schema.ruleResults,
      metrics: { qualityScore: 0 },
      diagnostics: [{ severity: 'error', code: 'schema_invalid', message: 'Overlay failed closed schema validation before semantic evaluation.' }],
    };
    await writeJson(path.join(outputDir, 'evaluator-report.json'), sanitizeArtifact(report));
    const fallback = buildFallbackOutput(input, { attemptStatus: 'schema_invalid', fallbackReason: 'schema_invalid', evaluatorVerdict: 'not_run', diagnostics: report.diagnostics, evaluatorReportPath: 'evaluator-report.json' });
    fallback.dataScope = input.dataScope;
    await writeJson(path.join(outputDir, 'harness-output.json'), sanitizeArtifact(fallback));
    await writeJson(path.join(outputDir, 'fallback-output.json'), sanitizeArtifact(fallback));
    await writeText(path.join(outputDir, 'final-generation-instruction.md'), fallback.renderedGenerationInstruction);
    return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: fallback.finalStatus, attemptStatus: fallback.attemptStatus, evaluatorVerdict: fallback.evaluatorVerdict, fallbackReason: fallback.fallbackReason, outputDir };
  }

  const report = evaluateOverlay(input, overlay);
  await writeJson(path.join(outputDir, 'evaluator-report.json'), sanitizeArtifact(report));
  if (report.verdict !== 'pass') {
    const fallback = buildFallbackOutput(input, { attemptStatus: 'llm_completed', fallbackReason: 'evaluator_rejected', evaluatorVerdict: 'fail', diagnostics: report.diagnostics, evaluatorReportPath: 'evaluator-report.json' });
    fallback.dataScope = input.dataScope;
    await writeJson(path.join(outputDir, 'harness-output.json'), sanitizeArtifact(fallback));
    await writeJson(path.join(outputDir, 'fallback-output.json'), sanitizeArtifact(fallback));
    await writeText(path.join(outputDir, 'final-generation-instruction.md'), fallback.renderedGenerationInstruction);
    return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: fallback.finalStatus, attemptStatus: fallback.attemptStatus, evaluatorVerdict: fallback.evaluatorVerdict, fallbackReason: fallback.fallbackReason, qualityScore: report.metrics.qualityScore, outputDir };
  }

  const rendered = renderGenerationInstruction(input, overlay, report);
  const output = {
    schemaVersion: 'format-profile-harness-output.v0',
    caseId: input.case.caseId,
    attemptStatus: 'llm_completed',
    evaluatorVerdict: 'pass',
    finalStatus: 'refined',
    dataScope: input.dataScope,
    hashes: {
      deterministicProfileSha256: input.hashes.deterministicProfileSha256,
      deterministicInstructionSha256: input.hashes.deterministicInstructionSha256,
      rawEvidenceSha256: input.hashes.rawEvidenceSha256,
      acceptedOverlaySha256: sha256(overlay),
      renderedInstructionSha256: sha256(rendered),
    },
    acceptedOverlay: overlay,
    renderedGenerationInstruction: rendered,
    diagnostics: report.diagnostics,
    reports: { evaluatorReportPath: 'evaluator-report.json' },
  };
  await writeJson(path.join(outputDir, 'harness-output.json'), sanitizeArtifact(output));
  await writeText(path.join(outputDir, 'final-generation-instruction.md'), rendered);
  return { caseId: caseConfig.caseId, mode: args.mode, requestedScope: args.dataScope, effectiveScope, finalStatus: output.finalStatus, attemptStatus: output.attemptStatus, evaluatorVerdict: output.evaluatorVerdict, qualityScore: report.metrics.qualityScore, outputDir };
}

function renderDecisionReport(args, results) {
  const lines = [];
  lines.push('# FormatProfile Semantic Refinement Harness Report');
  lines.push('');
  lines.push(`- Mode: ${args.mode}`);
  lines.push(`- Cases: ${results.length}`);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Case | Attempt | Verdict | Final | Fallback | Quality |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of results) lines.push(`| ${r.caseId} | ${r.attemptStatus} | ${r.evaluatorVerdict} | ${r.finalStatus} | ${r.fallbackReason || ''} | ${r.qualityScore === undefined ? '' : r.qualityScore.toFixed(3)} |`);
  lines.push('');
  lines.push('## Productization decision gate');
  lines.push('- Product integration is not enabled by this harness.');
  lines.push('- Proceed to product integration only if mock-pass refines all four golden cases and rejection modes fallback without altering deterministic hashes.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  let cases;
  if (args.caseId) cases = [await loadCase(harnessRoot, args.caseId)];
  else cases = await listCases(harnessRoot);
  const results = [];
  for (const caseConfig of cases) results.push(await runCase(caseConfig, args));
  await mkdir(path.join(harnessRoot, 'reports'), { recursive: true });
  await writeJson(path.join(harnessRoot, 'reports', 'latest-summary.json'), sanitizeArtifact({ schemaVersion: 'format-profile-harness-summary.v0', mode: args.mode, dataScope: args.dataScope, results }));
  await writeText(path.join(harnessRoot, 'reports', 'productization-decision.md'), renderDecisionReport(args, results));
  for (const result of results) {
    const quality = result.qualityScore === undefined ? '' : ` quality=${result.qualityScore.toFixed(3)}`;
    const fallback = result.fallbackReason ? ` fallback=${result.fallbackReason}` : '';
    console.log(`${result.caseId}: ${result.finalStatus} attempt=${result.attemptStatus} verdict=${result.evaluatorVerdict}${fallback}${quality}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
