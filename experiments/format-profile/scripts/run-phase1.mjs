#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative, resolve } from "node:path";
import { probeDocument } from "./lib/document-probe.mjs";

const repoRoot = resolve(process.cwd());
const experimentRoot = join(repoRoot, "experiments", "format-profile");
const casesDir = join(experimentRoot, "cases");
const outputRoot = join(repoRoot, "runtime", "format-profile", "outputs", "phase1");
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
  if (caseData.schemaVersion !== "format-profile-case.v0") errors.push("schemaVersion must be format-profile-case.v0");
  if (!caseData.caseId || !/^[a-z0-9][a-z0-9_-]*$/.test(caseData.caseId)) errors.push("caseId must use lowercase letters, numbers, '_' or '-'");
  if (!["generate_from_profile", "adapt_draft_to_profile"].includes(caseData.mode)) errors.push("mode must be generate_from_profile or adapt_draft_to_profile");
  if (!caseData.source?.path) errors.push("source.path is required");
  if (!caseData.task?.title || !caseData.task?.userGoal) errors.push("task.title and task.userGoal are required");
  if (caseData.mode === "adapt_draft_to_profile" && !caseData.task?.existingDraft) errors.push("adapt_draft_to_profile requires task.existingDraft");
  return errors;
}

function inferDocumentKind(format, mode, probe) {
  if (format === "docx") return mode === "adapt_draft_to_profile" ? "制度/正式文稿" : "报告/正式文稿";
  if (format === "xlsx") return "表格/指标分析";
  if (format === "pptx") return "汇报演示";
  if (format === "pdf") return probe?.structure?.scanLikely ? "扫描 PDF/低置信度参考" : "成品参考/宣传介绍";
  return "未知";
}

function confidenceFor(format, probe) {
  if (!probe) return "unknown";
  if (format === "docx") return probe.structure?.paragraphs > 0 ? "medium" : "low";
  if (format === "xlsx") return probe.structure?.sheetCount > 0 ? "medium" : "low";
  if (format === "pptx") return probe.structure?.slideCount > 0 ? "medium" : "low";
  if (format === "pdf") return probe.structure?.hasTextLayerHint ? "medium" : "low";
  return "unknown";
}

function capabilityFor(format, probe) {
  const confidence = confidenceFor(format, probe);
  if (format === "docx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: true,
      canGuideExport: false,
      confidence,
      notes: ["Phase 1 已接入 DOCX ZIP/XML 基础探测；仍未生成 DOCX 成品。"]
    };
  }
  if (format === "xlsx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: false,
      canGuideExport: false,
      confidence,
      notes: ["Phase 1 已接入 XLSX workbook/sheet/style 基础探测；用于表格化表达参考。"]
    };
  }
  if (format === "pptx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: false,
      canGuideExport: false,
      confidence,
      notes: ["Phase 1 已接入 PPTX slide/theme/layout 基础探测；用于逐页汇报底稿参考。"]
    };
  }
  return {
    canGuideGeneration: true,
    canGuideAdaptation: true,
    canGuideExport: false,
    confidence,
    notes: ["Phase 1 已接入 PDF 基础字节诊断；复杂版式和扫描件仍需降级。"]
  };
}

function formatProbeSummary(format, probe) {
  if (!probe) return "无探测结果";
  if (format === "docx") {
    return `段落 ${probe.structure.paragraphs}、表格 ${probe.structure.tables}、样式 ${probe.style.styleCount}、字体线索 ${probe.style.fonts.length}`;
  }
  if (format === "xlsx") {
    return `工作表 ${probe.structure.sheetCount}、共享字符串 ${probe.style.sharedStringCount}、字体 ${probe.style.fontCount}、填充 ${probe.style.fillCount}`;
  }
  if (format === "pptx") {
    return `幻灯片 ${probe.structure.slideCount}、版式 ${probe.structure.layoutCount}、母版 ${probe.structure.masterCount}、主题 ${probe.style.themeCount}`;
  }
  return `页对象 ${probe.structure.pageCount}、文本操作符 ${probe.structure.textOperatorCount}、图片 ${probe.structure.imageCount}、字体线索 ${probe.style.fontRefs.length}`;
}

function buildDiagnostics(caseData, sourcePath, format, caseErrors, probeError, probe) {
  const diagnostics = [];
  for (const error of caseErrors) diagnostics.push({ severity: "error", code: "case.invalid", message: error });
  if (!existsSync(sourcePath)) {
    diagnostics.push({ severity: "error", code: "source.missing", message: `样本文件不存在：${caseData.source?.path ?? ""}` });
    return diagnostics;
  }
  if (!supportedFormats.has(format)) diagnostics.push({ severity: "error", code: "source.unsupported_format", message: `不支持的样本格式：${format}` });
  if (caseData.source?.expectedFormat && caseData.source.expectedFormat !== format) {
    diagnostics.push({ severity: "error", code: "source.expected_format_mismatch", message: `case 期望 ${caseData.source.expectedFormat}，实际为 ${format}` });
  }
  if (probeError) {
    diagnostics.push({ severity: "error", code: "probe.failed", message: probeError.message });
    return diagnostics;
  }
  diagnostics.push({
    severity: "info",
    code: "probe.phase1.completed",
    message: `Phase 1 已完成 ${format.toUpperCase()} 基础探测：${formatProbeSummary(format, probe)}。`
  });
  if (format === "xlsx") {
    diagnostics.push({ severity: "info", code: "format.xlsx.boundary", message: "XLSX 用作表格结构和指标表达参考，不在本阶段生成 Excel 成品。" });
  }
  if (format === "pptx") {
    diagnostics.push({ severity: "info", code: "format.pptx.boundary", message: "PPTX 用作汇报结构和逐页内容参考，不在本阶段生成 PPTX 成品。" });
  }
  if (format === "pdf") {
    const severity = probe?.structure?.scanLikely ? "warning" : "info";
    const message = probe?.structure?.scanLikely
      ? "PDF 更像扫描或图片型成品，缺少文本层线索；只能低置信度参考。"
      : "PDF 有文本层或字体线索，可作为中低置信度参考成品。";
    diagnostics.push({ severity, code: "format.pdf.text_layer_diagnostic", message });
  }
  if (caseData.mode === "adapt_draft_to_profile") {
    diagnostics.push({ severity: "info", code: "binding.adaptation_mode", message: "该 case 验证已有底稿适配格式画像，需要记录结构冲突和改写边界。" });
  }
  return diagnostics;
}

function buildStructureProfile(format, probe, confidence, evidence) {
  if (format === "docx") {
    return {
      confidence,
      sections: probe.structure.headingStyleRefs.map((styleId) => ({ kind: "heading-style-ref", styleId })),
      tables: Array.from({ length: Math.min(probe.structure.tables, 20) }, (_, index) => ({ index: index + 1, source: "word/document.xml" })),
      counts: {
        paragraphs: probe.structure.paragraphs,
        runs: probe.structure.runs,
        tables: probe.structure.tables
      },
      textSample: probe.structure.textSample,
      evidence
    };
  }
  if (format === "xlsx") {
    return {
      confidence,
      sections: probe.structure.sheets.map((sheet, index) => ({ kind: "worksheet", index: index + 1, name: sheet.name, sheetId: sheet.sheetId })),
      tables: probe.structure.sheetStats.map((sheet) => ({
        path: sheet.path,
        dimension: sheet.dimension,
        rowCount: sheet.rowCount,
        cellCount: sheet.cellCount,
        mergedCellCount: sheet.mergedCellCount,
        formulaCount: sheet.formulaCount
      })),
      evidence
    };
  }
  if (format === "pptx") {
    return {
      confidence,
      sections: probe.structure.slideStats.map((slide, index) => ({
        kind: "slide",
        index: index + 1,
        path: slide.path,
        textCount: slide.textCount,
        shapeCount: slide.shapeCount,
        pictureCount: slide.pictureCount,
        tableCount: slide.tableCount,
        textSample: slide.textSample
      })),
      tables: probe.structure.slideStats.filter((slide) => slide.tableCount > 0).map((slide) => ({ path: slide.path, tableCount: slide.tableCount })),
      slideCount: probe.structure.slideCount,
      layoutCount: probe.structure.layoutCount,
      masterCount: probe.structure.masterCount,
      evidence
    };
  }
  return {
    confidence,
    sections: [],
    tables: [],
    pageCount: probe.structure.pageCount,
    textOperatorCount: probe.structure.textOperatorCount,
    imageCount: probe.structure.imageCount,
    scanLikely: probe.structure.scanLikely,
    evidence
  };
}

function buildStyleProfile(format, probe, confidence, evidence) {
  if (format === "docx") {
    return {
      confidence,
      layout: {},
      typography: {
        fonts: probe.style.fonts,
        styleCount: probe.style.styleCount,
        styleIds: probe.style.styleIds
      },
      colors: {},
      formatSpecific: {
        extractionStage: "phase1_basic_probe",
        realParserAttached: true,
        officeKind: probe.officeKind,
        entryCount: probe.entryCount,
        numberingDefinitions: probe.style.numberingDefinitions
      },
      evidence
    };
  }
  if (format === "xlsx") {
    return {
      confidence,
      layout: {
        sheets: probe.structure.sheetStats.map((sheet) => ({ path: sheet.path, dimension: sheet.dimension }))
      },
      typography: {
        fontCount: probe.style.fontCount
      },
      colors: {
        fillCount: probe.style.fillCount,
        borderCount: probe.style.borderCount
      },
      formatSpecific: {
        extractionStage: "phase1_basic_probe",
        realParserAttached: true,
        officeKind: probe.officeKind,
        cellStyleCount: probe.style.cellStyleCount,
        sharedStringCount: probe.style.sharedStringCount
      },
      evidence
    };
  }
  if (format === "pptx") {
    return {
      confidence,
      layout: {
        slideCount: probe.structure.slideCount,
        layoutCount: probe.structure.layoutCount,
        masterCount: probe.structure.masterCount
      },
      typography: {
        fontSchemeCount: probe.style.fontSchemeCount
      },
      colors: {
        colorSchemeCount: probe.style.colorSchemeCount
      },
      formatSpecific: {
        extractionStage: "phase1_basic_probe",
        realParserAttached: true,
        officeKind: probe.officeKind,
        themeCount: probe.style.themeCount,
        themeName: probe.style.themeName
      },
      evidence
    };
  }
  return {
    confidence,
    layout: {
      pageCount: probe.structure.pageCount
    },
    typography: {
      fontRefs: probe.style.fontRefs
    },
    colors: {},
    formatSpecific: {
      extractionStage: "phase1_basic_probe",
      realParserAttached: true,
      pdfHeader: probe.header,
      encrypted: probe.structure.encrypted,
      hasTextLayerHint: probe.structure.hasTextLayerHint,
      scanLikely: probe.structure.scanLikely
    },
    evidence
  };
}

function buildWritingProfile(format, probe, confidence, evidence) {
  if (format === "xlsx") {
    return {
      confidence: "low",
      tone: ["分析型", "指标导向"],
      genre: ["表格化分析"],
      constraints: ["优先生成指标分组、口径解释和结论摘要，不强行写成长文。"],
      evidence
    };
  }
  if (format === "pptx") {
    return {
      confidence: "low",
      tone: ["汇报型", "要点化"],
      genre: ["逐页汇报底稿"],
      constraints: ["按幻灯片页组织内容；每页包含标题、核心观点和讲述要点。"],
      evidence
    };
  }
  if (format === "pdf") {
    return {
      confidence: confidence === "medium" ? "low" : "unknown",
      tone: ["参考成品"],
      genre: ["宣传介绍或正式材料"],
      constraints: ["PDF 只作为参考，不承诺还原原始排版。"],
      evidence
    };
  }
  return {
    confidence: "low",
    tone: ["正式", "结构化"],
    genre: ["正式文稿"],
    constraints: ["按标题层级、段落和表格线索组织底稿；真实行文风格需后续内容解析/LLM 提炼。"],
    evidence
  };
}

function buildProfile(caseData, sourcePath, format, diagnostics, probe) {
  const sourceStat = statSync(sourcePath);
  const relativeSource = normalizeRepoPath(sourcePath);
  const profileId = `profile_${caseData.caseId}`;
  const confidence = confidenceFor(format, probe);
  const evidence = [
    {
      kind: "file_probe",
      description: "Phase 1 runner 已读取样本并完成基础格式探测。",
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
      label: inferDocumentKind(format, caseData.mode, probe),
      confidence,
      evidence
    },
    capabilities: capabilityFor(format, probe),
    structureProfile: buildStructureProfile(format, probe, confidence, evidence),
    styleProfile: buildStyleProfile(format, probe, confidence, evidence),
    writingProfile: buildWritingProfile(format, probe, confidence, evidence),
    diagnostics,
    rawProbeFacts: probe
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

## Phase 1 探测摘要

- Profile: ${profile.profileId}
- 文件类型: ${profile.source.fileType}
- 文档类型推断: ${profile.documentKind.label}
- 画像置信度: ${profile.capabilities.confidence}
- Snapshot: ${binding.profileSnapshotHash}
- 探测摘要: ${formatProbeSummary(profile.source.fileType, profile.rawProbeFacts)}

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
  const summary = formatProbeSummary(profile.source.fileType, profile.rawProbeFacts);
  if (caseData.mode === "adapt_draft_to_profile") {
    return `# ${caseData.task.title}

> Phase 1 探测底稿：已使用真实文件基础探测结果，但尚未接入真实 LLM 生成。

## 原始底稿

${caseData.task.existingDraft}

## 适配目标

- 参考格式：${profile.documentKind.label}
- 文件类型：${profile.source.fileType}
- 探测摘要：${summary}
- 适配重点：结构、语气、表达方式，而非高保真还原源文件。

## 材料约束

${materialLines}

## 下一步生成器应完成

在保留事实的前提下，按当前 FormatBinding 重组标题、段落和表达风格，并输出结构冲突诊断。
`;
  }
  return `# ${caseData.task.title}

> Phase 1 探测底稿：已使用真实文件基础探测结果，但尚未接入真实 LLM 生成。

## 生成目标

${caseData.task.userGoal}

## 参考格式

- 类型：${profile.source.fileType}
- 推断用途：${profile.documentKind.label}
- 当前置信度：${profile.capabilities.confidence}
- 探测摘要：${summary}

## 材料约束

${materialLines}

## 下一步生成器应完成

按当前 FormatBinding 生成正式底稿，并根据格式类型选择文章、表格化分析或逐页汇报结构。
`;
}

function minimalValidateOutput(caseData, profile, binding, diagnosticsEnvelope) {
  const errors = [];
  if (profile.schemaVersion !== "format-profile.v0") errors.push("profile schemaVersion mismatch");
  if (binding.schemaVersion !== "format-binding.v0") errors.push("binding schemaVersion mismatch");
  if (diagnosticsEnvelope.schemaVersion !== "format-diagnostics.v0") errors.push("diagnostics schemaVersion mismatch");
  if (binding.caseId !== caseData.caseId) errors.push("binding caseId mismatch");
  if (!profile.rawProbeFacts) errors.push("rawProbeFacts missing");
  if (!profile.source.sha256 || profile.source.sha256.length !== 64) errors.push("profile source sha256 missing");
  if (!binding.profileSnapshotHash || binding.profileSnapshotHash.length !== 64) errors.push("binding profileSnapshotHash missing");
  return errors;
}

function runCase(casePath, caseData) {
  const caseErrors = validateCase(caseData);
  const sourcePath = resolve(repoRoot, normalize(caseData.source?.path ?? ""));
  const format = extname(sourcePath).slice(1).toLowerCase();
  const caseOut = join(outputRoot, caseData.caseId ?? basename(casePath, ".case.json"));
  mkdirSync(caseOut, { recursive: true });

  let probe = null;
  let probeError = null;
  if (existsSync(sourcePath) && supportedFormats.has(format)) {
    try {
      probe = probeDocument(readFileSync(sourcePath), format);
    } catch (error) {
      probeError = error;
    }
  }

  const diagnostics = buildDiagnostics(caseData, sourcePath, format, caseErrors, probeError, probe);
  const hasFatal = diagnostics.some((item) => item.severity === "error");

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

  const profile = buildProfile(caseData, sourcePath, format, diagnostics, probe);
  const binding = buildBinding(caseData, profile);
  const diagnosticsEnvelope = {
    schemaVersion: "format-diagnostics.v0",
    caseId: caseData.caseId,
    status: "ready",
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
    status: validationErrors.length === 0 ? "ready" : "failed",
    format,
    mode: caseData.mode,
    outputDir: normalizeRepoPath(caseOut),
    diagnosticsCount: diagnostics.length,
    validationErrors,
    probeSummary: formatProbeSummary(format, probe)
  };
}

function buildMarkdownReport(results) {
  const passed = results.filter((item) => item.validationErrors.length === 0).length;
  const rows = results
    .map((item) => `| ${item.caseId} | ${item.format} | ${item.mode ?? "-"} | ${item.status} | ${item.diagnosticsCount} | ${item.probeSummary ?? "-"} | ${item.outputDir} |`)
    .join("\n");
  const failures = results
    .filter((item) => item.validationErrors.length > 0)
    .flatMap((item) => item.validationErrors.map((error) => `- ${item.caseId}: ${error}`))
    .join("\n") || "- 无";
  return `# FormatProfile Phase 1 Report

## Summary

- Cases: ${results.length}
- Probe-valid outputs: ${passed}
- Failed outputs: ${results.length - passed}

## Cases

| Case | Format | Mode | Status | Diagnostics | Probe summary | Output |
| --- | --- | --- | --- | ---: | --- | --- |
${rows}

## Validation errors

${failures}

## Note

Phase 1 performs real base probing for Office ZIP/XML and PDF byte-level diagnostics, but still does not perform high-fidelity style extraction, LLM writing-style inference, frontend integration, or export.
`;
}

function main() {
  const caseEntries = loadCases();
  if (caseEntries.length === 0) throw new Error(`No cases found under ${casesDir}`);
  const results = caseEntries.map(({ path, caseData }) => runCase(path, caseData));
  const report = {
    schemaVersion: "format-profile-phase1-report.v0",
    generatedAt: new Date().toISOString(),
    cases: results,
    summary: {
      total: results.length,
      valid: results.filter((item) => item.validationErrors.length === 0).length,
      failed: results.filter((item) => item.validationErrors.length > 0).length
    }
  };
  mkdirSync(reportDir, { recursive: true });
  writeJson(join(reportDir, "phase1-report.json"), report);
  writeText(join(reportDir, "phase1-report.md"), buildMarkdownReport(results));
  console.log(JSON.stringify(report.summary, null, 2));
}

main();
