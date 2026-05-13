#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildMarkdownReport,
  loadCaseFiles,
  runProfileCase,
  summarizeByFormat,
  writeJson,
  writeText
} from "./lib/profile-runner.mjs";

const repoRoot = resolve(process.cwd());
const experimentRoot = join(repoRoot, "experiments", "format-profile");
const casesDir = join(experimentRoot, "cases");
const outputRoot = join(repoRoot, "runtime", "format-profile", "outputs", "phase1");
const reportDir = join(repoRoot, "runtime", "format-profile", "reports");

function main() {
  const caseEntries = loadCaseFiles(casesDir);
  if (caseEntries.length === 0) throw new Error(`No cases found under ${casesDir}`);

  const results = caseEntries.map(({ path, caseData }) =>
    runProfileCase({
      repoRoot,
      outputRoot,
      phaseName: "Phase 1",
      casePath: path,
      caseData
    })
  );

  const report = {
    schemaVersion: "format-profile-phase1-report.v0",
    generatedAt: new Date().toISOString(),
    cases: results,
    summary: {
      total: results.length,
      valid: results.filter((item) => item.validationErrors.length === 0).length,
      failed: results.filter((item) => item.validationErrors.length > 0).length,
      byFormat: summarizeByFormat(results)
    }
  };

  mkdirSync(reportDir, { recursive: true });
  writeJson(join(reportDir, "phase1-report.json"), report);
  writeText(
    join(reportDir, "phase1-report.md"),
    buildMarkdownReport(
      "FormatProfile Phase 1 Report",
      results,
      "Phase 1 performs real base probing for Office ZIP/XML and PDF byte-level diagnostics, but still does not perform high-fidelity style extraction, LLM writing-style inference, frontend integration, or export."
    )
  );

  console.log(JSON.stringify(report.summary, null, 2));
}

main();
