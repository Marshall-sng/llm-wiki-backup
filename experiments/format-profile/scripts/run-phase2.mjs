#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildMarkdownReport,
  readJson,
  runProfileCase,
  summarizeByFormat,
  writeJson,
  writeText
} from "./lib/profile-runner.mjs";

const repoRoot = resolve(process.cwd());
const inventoryPath = join(repoRoot, "runtime", "format-profile", "manifests", "sample-inventory.json");
const outputRoot = join(repoRoot, "runtime", "format-profile", "outputs", "phase2");
const generatedCasesPath = join(repoRoot, "runtime", "format-profile", "manifests", "phase2-generated-cases.json");
const reportDir = join(repoRoot, "runtime", "format-profile", "reports");

function sanitizeCaseId(value) {
  return value
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-80) || "sample";
}

function normalizeInventoryPath(value) {
  return value.replace(/^\.?[\\/]/, "").replaceAll("\\", "/");
}

function defaultTaskFor(format, fileName) {
  if (format === "xlsx") {
    return {
      title: `批量探测 XLSX 样本：${fileName}`,
      userGoal: "根据该表格成品提炼表格结构、指标表达和可用于底稿生成的约束。",
      materials: ["该 case 用于批量探测，不调用 LLM，不生成 Excel 成品。"]
    };
  }
  if (format === "pptx") {
    return {
      title: `批量探测 PPTX 样本：${fileName}`,
      userGoal: "根据该演示成品提炼汇报结构、页面组织和可用于逐页底稿生成的约束。",
      materials: ["该 case 用于批量探测，不调用 LLM，不生成 PPTX 成品。"]
    };
  }
  if (format === "pdf") {
    return {
      title: `批量探测 PDF 样本：${fileName}`,
      userGoal: "根据该 PDF 成品判断可解析文本、页面结构和是否适合作为格式参考。",
      materials: ["该 case 用于批量探测，不承诺 PDF 高保真还原。"]
    };
  }
  return {
    title: `批量探测 DOCX 样本：${fileName}`,
    userGoal: "根据该 Word 成品提炼正式文稿结构、样式线索和可用于底稿生成的约束。",
    materials: ["该 case 用于批量探测，不调用 LLM，不生成 DOCX 成品。"]
  };
}

function buildBatchCases(inventory) {
  return inventory.items.map((item, index) => {
    const sourcePath = normalizeInventoryPath(item.relative_path);
    const fileName = sourcePath.split("/").at(-1) ?? `sample-${index + 1}.${item.format}`;
    const format = item.format;
    const isAdapt = format === "docx" || format === "pdf";
    const task = defaultTaskFor(format, fileName);
    if (isAdapt) {
      task.existingDraft = "这是一个用于批量实验的占位底稿。真实生成阶段应在保留事实的基础上，按照格式画像调整结构、语气和表达方式。";
    }
    return {
      schemaVersion: "format-profile-case.v0",
      caseId: `batch_${String(index + 1).padStart(2, "0")}_${sanitizeCaseId(fileName)}`,
      mode: isAdapt ? "adapt_draft_to_profile" : "generate_from_profile",
      source: {
        path: sourcePath,
        expectedFormat: format
      },
      task,
      overrides: {
        experiment: "phase2-batch",
        formatBoundary:
          format === "docx"
            ? "DOCX 用于正式文稿结构和样式线索。"
            : format === "xlsx"
              ? "XLSX 用于表格结构和指标表达，不生成 Excel 成品。"
              : format === "pptx"
                ? "PPTX 用于汇报结构和逐页底稿，不生成 PPTX 成品。"
                : "PDF 仅作为成品参考，不承诺高保真还原。"
      },
      inventory: {
        sha256: item.sha256,
        bytes: item.bytes
      }
    };
  });
}

function buildPhase2Markdown(results, summary) {
  const base = buildMarkdownReport(
    "FormatProfile Phase 2 Batch Report",
    results,
    "Phase 2 extends Phase 1 probing to the full local sample inventory. It measures probe success and risk distribution only; no frontend, export, or LLM generation is performed."
  );
  const byFormatRows = summary.byFormat
    .map((item) => `| ${item.format} | ${item.total} | ${item.ready} | ${item.failed} | ${item.confidence.medium} | ${item.confidence.low} | ${item.confidence.unknown} | ${item.totalBytes} |`)
    .join("\n");
  const riskItems = results
    .filter((item) => item.status !== "ready" || item.confidence === "low" || item.confidence === "unknown" || (item.riskFlags?.length ?? 0) > 0)
    .map((item) => `- ${item.caseId} (${item.format}, ${item.confidence}, ${item.riskFlags?.join(", ") || "status/confidence"}): ${item.probeSummary ?? "无探测摘要"}`)
    .join("\n") || "- 无";
  return `${base}

## By format

| Format | Total | Ready | Failed | Medium confidence | Low confidence | Unknown confidence | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${byFormatRows}

## Risk queue

${riskItems}
`;
}

function main() {
  const inventory = readJson(inventoryPath);
  const cases = buildBatchCases(inventory);
  mkdirSync(reportDir, { recursive: true });
  writeJson(generatedCasesPath, {
    schemaVersion: "format-profile-phase2-generated-cases.v0",
    generatedAt: new Date().toISOString(),
    inventoryPath: "runtime/format-profile/manifests/sample-inventory.json",
    total: cases.length,
    cases
  });

  const results = cases.map((caseData) =>
    runProfileCase({
      repoRoot,
      outputRoot,
      phaseName: "Phase 2",
      casePath: null,
      caseData
    })
  );

  const summary = {
    total: results.length,
    valid: results.filter((item) => item.validationErrors.length === 0).length,
    failed: results.filter((item) => item.validationErrors.length > 0).length,
    byFormat: summarizeByFormat(results)
  };
  const report = {
    schemaVersion: "format-profile-phase2-report.v0",
    generatedAt: new Date().toISOString(),
    inventoryPath: "runtime/format-profile/manifests/sample-inventory.json",
    casesPath: "runtime/format-profile/manifests/phase2-generated-cases.json",
    cases: results,
    summary
  };

  writeJson(join(reportDir, "phase2-report.json"), report);
  writeText(join(reportDir, "phase2-report.md"), buildPhase2Markdown(results, summary));
  console.log(JSON.stringify(summary, null, 2));
}

main();
