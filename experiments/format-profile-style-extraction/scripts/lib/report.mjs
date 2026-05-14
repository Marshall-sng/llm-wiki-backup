import fs from 'node:fs';
import path from 'node:path';
import { stableStringify } from './stable-json.mjs';

export function writeModeReport(runtimeRoot, mode, caseResults) {
  const report = {
    schemaVersion: 'format-profile-style-extraction-report.v0',
    mode,
    caseResults,
    summary: {
      total: caseResults.length,
      passed: caseResults.filter((result) => result.status === 'pass').length,
      failed: caseResults.filter((result) => result.status !== 'pass').length,
      boundary: 'High-fidelity means fixture-backed deterministic parser fidelity, not visual/export fidelity.'
    }
  };
  const reportPath = path.join(runtimeRoot, 'reports', `${mode}.report.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${stableStringify(report)}\n`, 'utf8');
  return reportPath;
}

export function writeMarkdownSummary(runtimeRoot, caseId, mode, styleEnvelope, overlayResult) {
  const outPath = path.join(runtimeRoot, 'outputs', mode, caseId, 'final-style-summary.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const overlayLine = overlayResult ? `\n- Overlay status: ${overlayResult.status}` : '';
  const lines = [
    `# Style extraction summary: ${caseId}`,
    '',
    `- Format: ${styleEnvelope.source.fileType}`,
    `- Deterministic hash: ${styleEnvelope.metadata.styleFactsSha256}`,
    '- Boundary: high-fidelity means fixture-backed deterministic style facts; no export/reproduction promise.',
    '- LLM/mock overlays are advisory only and cannot modify `style-facts.json`.',
    overlayLine,
    '',
    '## Productization mapping',
    '',
    '- DOCX: map typography, page layout, style definitions, paragraph style usage, and structure counts into future FormatProfile style facts.',
    '- XLSX: map sheet dimensions, style counts, merge/formula counts, and workbook facts into future FormatProfile diagnostics.',
    '- PPTX: map slide/layout/master/theme facts as baseline diagnostics until richer theme/layout fixtures exist.',
    '- PDF: map page/text/font/image/scan indicators as low/medium-confidence diagnostics, not renderer-grade style facts.'
  ];
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
  return outPath;
}
