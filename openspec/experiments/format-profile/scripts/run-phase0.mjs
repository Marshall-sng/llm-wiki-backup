#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const experimentRoot = join(repoRoot, "experiments", "format-profile");
const casesDir = join(experimentRoot, "cases");
const outputRoot = join(repoRoot, "runtime", "format-profile", "outputs", "phase0");
const reportDir = join(repoRoot, "runtime", "format-profile", "reports");
const supportedFormats = new Set(["docx", "xlsx", "pptx", "pdf"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeRepoPath(path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function loadCases() {
  return readdirSync(casesDir)
    .filter((name) => name.endsWith(".case.json"))
    .sort()
    .map((name) => {
      const path = join(casesDir, name);
      return { path, caseData: readJson(path) };
    });
}

function validateCase(caseData) {
  const errors = [];
  if (caseData.schemaVersion !== "format-profile-case.v0") {
    errors.push("schemaVersion must be format-profile-case.v0");
  }
  if (!caseData.caseId || !/^[a-z0-9][a-z0-9_-]*$/.test(caseData.caseId)) {
    errors.push("caseId must use lowercase letters, numbers, '_' or '-'");
  }
  if (!["generate_from_profile", "adapt_draft_to_profile"].includes(caseData.mode)) {
    errors.push("mode must be generate_from_profile or adapt_draft_to_profile");
  }
  if (!caseData.source?.path) {
    errors.push("source.path is required");
  }
  if (!caseData.task?.title || !caseData.task?.userGoal) {
    errors.push("task.title and task.userGoal are required");
  }
  if (caseData.mode === "adapt_draft_to_profile" && !caseData.task?.existingDraft) {
    errors.push("adapt_draft_to_profile requires task.existingDraft");
  }
  return errors;
}

function inferDocumentKind(format, mode) {
  if (format === "docx") {
    return mode === "adapt_draft_to_profile" ? "制度/正式文稿" : "报告/正式文稿";
  }
  if (format === "xlsx") return "表格/指标分析";
  if (format === "pptx") return "汇报演示";
  if (format === "pdf") return "成品参考/宣传介绍";
  return "未知";
}

function capabilityFor(format) {
  if (format === "docx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: true,
      canGuideExport: false,
      confidence: "medium",
      notes: ["Phase 0 仅锁定协议；真实 DOCX 样式解析尚未接入。"]
    };
  }
  if (format === "xlsx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: false,
      canGuideExport: false,
      confidence: "low",
      notes: ["XLSX 在本实验中用于表格结构和指标表达参考，不强行转成长文模板。"]
    };
  }
  if (format === "pptx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: false,
      canGuideExport: false,
      confidence: "low",
      notes: ["PPTX 在本实验中用于汇报结构和逐页表达参考，不承诺生成 PPTX 文件。"]
    };
  }
  return {
    canGuideGeneration: true,
    canGuideAdaptation: true,
    canGuideExport: false,
    confidence: "low",
    notes: ["PDF 在本实验中只作为参考成品；扫描件或复杂版式必须降级诊断。"]
  };
}

function buildFormatSpecific(format) {
  const common = {
    extractionStage: "phase0_placeholder",
    realParserAttached: false
  };
  if (format === "docx") {
    return {
      ...common,
      expectedFutureFacts: ["styles.xml", "document.xml", "numbering.xml", "section properties", "tables"]
    };
  }
  if (format === "xlsx") {
    return {
      ...common,
      expectedFutureFacts: ["workbook sheets", "sheet dimensions", "merged cells", "cell styles", "formulas/charts"]
    };
  }
  if (format === "pptx") {
    return {
      ...common,
      expectedFutureFacts: ["slides", "slide layouts", "masters", "theme colors", "placeholders"]
    };
  }
  return {
    ...common,
    expectedFutureFacts: ["page count", "text blocks", "coordinates", "font hints", "scan/OCR diagnostics"]
  };
}

function buildDiagnostics(caseData, sourcePath, format, caseErrors) {
  const diagnostics = [];
  for (const error of caseErrors) {
    diagnostics.push({
      severity: "error",
      code: "case.invalid",
      message: error
    });
  }
  if (!existsSync(sourcePath)) {
    diagnostics.push({
      severity: "error",
      code: "source.missing",
      message: `样本文件不存在：${caseData.source?.path ?? ""}`
    });
    return diagnostics;
  }
  if (!supportedFormats.has(format)) {
    diagnostics.push({
      severity: "error",
      code: "source.unsupported_format",
      message: `不支持的样本格式：${format}`
    });
  }
  if (caseData.source?.expectedFormat && caseData.source.expectedFormat !== format) {
    diagnostics.push({
      severity: "error",
      code: "source.expected_format_mismatch",
      message: `case 期望 ${caseData.source.expectedFormat}，实际为 ${format}`
    });
  }
  diagnostics.push({
    severity: "warning",
    code: "parser.placeholder",
    message: "Phase 0 仅生成协议级占位画像，尚未接入真实格式解析器。"
  });
  if (format === "xlsx") {
    diagnostics.push({
      severity: "info",
      code: "format.xlsx.boundary",
      message: "XLSX 用作表格结构和指标表达参考，不在本阶段生成 Excel 成品。"
    });
  }
  if (format === "pptx") {
    diagnostics.push({
      severity: "info",
      code: "format.pptx.boundary",
      message: "PPTX 用作汇报结构和逐页内容参考，不在本阶段生成 PPTX 成品。"
    });
  }
  if (format === "pdf") {
    diagnostics.push({
      severity: "warning",
      code: "format.pdf.low_confidence_until_parser",
      message: "PDF 在真实解析器接入前只能作为低置信度成品参考。"
    });
  }
  if (caseData.mode === "adapt_draft_to_profile") {
    diagnostics.push({
      severity: "info",
      code: "binding.adaptation_mode",
      message: "该 case 验证已有底稿适配格式画像，需要记录结构冲突和改写边界。"
    });
  }
  return diagnostics;
}

function buildProfile(caseData, sourcePath, format, diagnostics) {
  const sourceStat = statSync(sourcePath);
  const relativeSource = normalizeRepoPath(sourcePath);
  const profileId = `profile_${caseData.caseId}`;
  const evidence = [
    {
      kind: "file_metadata",
      description: "Phase 0 runner 已读取样本文件元数据。",
      path: relativeSource
    }
  ];
  return {
    schemaVersion: "format-profile.v0",
    profileId,
    source: {
      path: relativeSource,
      fileName: basename(sourcePath),
      fileType: format,
      sha256: sha256File(sourcePath),
      byteSize: sourceStat.size
    },
    documentKind: {
      label: inferDocumentKind(format, caseData.mode),
      confidence: "low",
      evidence
    },
    capabilities: capabilityFor(format),
    structureProfile: {
      confidence: "unknown",
      sections: [],
      tables: [],
      evidence
    },
    styleProfile: {
      confidence: "unknown",
      layout: {},
      typography: {},
      colors: {},
      formatSpecific: buildFormatSpecific(format),
      evidence
    },
    writingProfile: {
      confidence: "unknown",
      tone: [],
      genre: [],
      constraints: [],
      evidence
    },
    diagnostics
  };
}

function buildBinding(caseData, profile) {
  const snapshot = JSON.stringify(profile);
  return {
    schemaVersion: "format-binding.v0",
    bindingId: `binding_${caseData.caseId}`,
    caseId: caseData.caseId,
    mode: caseData.mode,
    profileId: profile.profileId,
    profileSnapshotHash: sha256Text(snapshot),
    overrides: caseData.overrides ?? {},
    diagnostics: profile.diagnostics
  };
}

function buildInstruction(caseData, profile, binding) {
  const overrides = Object.entries(binding.overrides)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n") || "- 无";
  return `# Generation Instruction: ${caseData.caseId}

## 任务

${caseData.task.userGoal}

## 模式

${caseData.mode === "generate_from_profile" ? "先选择格式画像，再按画像生成底稿。" : "已有底稿适配到格式画像。"}

## 来源格式画像

- Profile: ${profile.profileId}
- 文件类型: ${profile.source.fileType}
- 文档类型推断: ${profile.documentKind.label}
- 画像置信度: ${profile.capabilities.confidence}
- Snapshot: ${binding.profileSnapshotHash}

## 临时调整

${overrides}

## 写作约束

1. 优先满足用户目标，不把格式说明混入正文。
2. 持续遵守当前 FormatBinding；后续补写、改写和续写均默认继承该绑定。
3. 如果格式画像与用户材料冲突，保留用户事实，并在 diagnostics 中说明冲突。
4. 对 DOCX，优先生成正式文稿结构；对 XLSX，优先生成表格化分析；对 PPTX，优先生成逐页汇报底稿；对 PDF，仅作为参考成品。

## 能力边界

${profile.diagnostics.map((item) => `- [${item.severity}] ${item.code}: ${item.message}`).join("\n")}
`;
}

function buildDraft(caseData, profile) {
  const materialLines = (caseData.task.materials ?? []).map((item) => `- ${item}`).join("\n") || "- 无额外材料";
  if (caseData.mode === "adapt_draft_to_profile") {
    return `# ${caseData.task.title}

> Phase 0 占位底稿：用于验证已有底稿适配格式画像的输出协议，尚未接入真实 LLM 或格式解析器。

## 原始底稿

${caseData.task.existingDraft}

## 适配目标

- 参考格式：${profile.documentKind.label}
- 文件类型：${profile.source.fileType}
- 适配重点：结构、语气、表达方式，而非高保真还原源文件。

## 材料约束

${materialLines}

## 待真实生成器完成

后续生成器应在保留事实的前提下，按当前 FormatBinding 重组标题、段落和表达风格，并输出冲突诊断。
`;
  }
  return `# ${caseData.task.title}

> Phase 0 占位底稿：用于验证先选格式画像再生成底稿的输出协议，尚未接入真实 LLM 或格式解析器。

## 生成目标

${caseData.task.userGoal}

## 参考格式

- 类型：${profile.source.fileType}
- 推断用途：${profile.documentKind.label}
- 当前置信度：${profile.capabilities.confidence}

## 材料约束

${materialLines}

## 待真实生成器完成

后续生成器应按当前 FormatBinding 生成正式底稿，并根据格式类型选择文章、表格化分析或逐页汇报结构。
`;
}

function minimalValidateOutput(caseData, profile, binding, diagnosticsEnvelope) {
  const errors = [];
  if (profile.schemaVersion !== "format-profile.v0") errors.push("profile schemaVersion mismatch");
  if (binding.schemaVersion !== "format-binding.v0") errors.push("binding schemaVersion mismatch");
  if (diagnosticsEnvelope.schemaVersion !== "format-diagnostics.v0") errors.push("diagnostics schemaVersion mismatch");
  if (binding.caseId !== caseData.caseId) errors.push("binding caseId mismatch");
  if (!profile.source.sha256 || profile.source.sha256.length !== 64) errors.push("profile source sha256 missing");
  if (!binding.profileSnapshotHash || binding.profileSnapshotHash.length !== 64) errors.push("binding profileSnapshotHash missing");
  return errors;
}

function runCase(casePath, caseData) {
  const caseErrors = validateCase(caseData);
  const sourcePath = resolve(repoRoot, normalize(caseData.source?.path ?? ""));
  const format = extname(sourcePath).slice(1).toLowerCase();
  const diagnostics = buildDiagnostics(caseData, sourcePath, format, caseErrors);
  const hasFatal = diagnostics.some((item) => item.severity === "error");
  const caseOut = join(outputRoot, caseData.caseId ?? basename(casePath, ".case.json"));
  mkdirSync(caseOut, { recursive: true });

  if (hasFatal) {
    const diagnosticsEnvelope = {
      schemaVersion: "format-diagnostics.v0",
      caseId: caseData.caseId ?? basename(casePath),
      status: "failed",
      diagnostics
    };
    writeJson(join(caseOut, "diagnostics.json"), diagnosticsEnvelope);
    return {
      caseId: diagnosticsEnvelope.caseId,
      status: "failed",
      format,
      outputDir: normalizeRepoPath(caseOut),
      diagnosticsCount: diagnostics.length,
      validationErrors: diagnostics.map((item) => item.message)
    };
  }

  const profile = buildProfile(caseData, sourcePath, format, diagnostics);
  const binding = buildBinding(caseData, profile);
  const diagnosticsEnvelope = {
    schemaVersion: "format-diagnostics.v0",
    caseId: caseData.caseId,
    status: "degraded",
    diagnostics
  };
  const instruction = buildInstruction(caseData, profile, binding);
  const draft = buildDraft(caseData, profile);
  const validationErrors = minimalValidateOutput(caseData, profile, binding, diagnosticsEnvelope);

  writeJson(join(caseOut, "profile.json"), profile);
  writeJson(join(caseOut, "binding.json"), binding);
  writeJson(join(caseOut, "diagnostics.json"), diagnosticsEnvelope);
  writeText(join(caseOut, "generation-instruction.md"), instruction);
  writeText(join(caseOut, "draft-output.md"), draft);

  return {
    caseId: caseData.caseId,
    status: validationErrors.length === 0 ? "degraded" : "failed",
    format,
    mode: caseData.mode,
    outputDir: normalizeRepoPath(caseOut),
    diagnosticsCount: diagnostics.length,
    validationErrors
  };
}

function buildMarkdownReport(results) {
  const passed = results.filter((item) => item.validationErrors.length === 0).length;
  const rows = results
    .map((item) => `| ${item.caseId} | ${item.format} | ${item.mode ?? "-"} | ${item.status} | ${item.diagnosticsCount} | ${item.outputDir} |`)
    .join("\n");
  const failures = results
    .filter((item) => item.validationErrors.length > 0)
    .flatMap((item) => item.validationErrors.map((error) => `- ${item.caseId}: ${error}`))
    .join("\n") || "- 无";
  return `# FormatProfile Phase 0 Report

## Summary

- Cases: ${results.length}
- Protocol-valid outputs: ${passed}
- Failed outputs: ${results.length - passed}

## Cases

| Case | Format | Mode | Status | Diagnostics | Output |
| --- | --- | --- | --- | ---: | --- |
${rows}

## Validation errors

${failures}

## Note

Phase 0 intentionally uses placeholder extraction. A status of \`degraded\` is expected until real parsers are attached.
`;
}

function main() {
  const caseEntries = loadCases();
  if (caseEntries.length === 0) {
    throw new Error(`No cases found under ${casesDir}`);
  }
  const results = caseEntries.map(({ path, caseData }) => runCase(path, caseData));
  const report = {
    schemaVersion: "format-profile-phase0-report.v0",
    generatedAt: new Date().toISOString(),
    cases: results,
    summary: {
      total: results.length,
      valid: results.filter((item) => item.validationErrors.length === 0).length,
      failed: results.filter((item) => item.validationErrors.length > 0).length
    }
  };
  mkdirSync(reportDir, { recursive: true });
  writeJson(join(reportDir, "phase0-report.json"), report);
  writeText(join(reportDir, "phase0-report.md"), buildMarkdownReport(results));
  console.log(JSON.stringify(report.summary, null, 2));
}

main();
