import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative, resolve } from "node:path";
import { probeDocument } from "./document-probe.mjs";

const supportedFormats = new Set(["docx", "xlsx", "pptx", "pdf"]);

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function normalizeRepoPath(repoRoot, path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

export function loadCaseFiles(casesDir) {
  return readdirSync(casesDir)
    .filter((name) => name.endsWith(".case.json"))
    .sort()
    .map((name) => {
      const path = join(casesDir, name);
      return { path, caseData: readJson(path) };
    });
}

export function validateCase(caseData) {
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

function capabilityFor(format, probe, phaseName) {
  const confidence = confidenceFor(format, probe);
  if (format === "docx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: true,
      canGuideExport: false,
      confidence,
      notes: [`${phaseName} 已接入 DOCX ZIP/XML 基础探测；仍未生成 DOCX 成品。`]
    };
  }
  if (format === "xlsx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: false,
      canGuideExport: false,
      confidence,
      notes: [`${phaseName} 已接入 XLSX workbook/sheet/style 基础探测；用于表格化表达参考。`]
    };
  }
  if (format === "pptx") {
    return {
      canGuideGeneration: true,
      canGuideAdaptation: false,
      canGuideExport: false,
      confidence,
      notes: [`${phaseName} 已接入 PPTX slide/theme/layout 基础探测；用于逐页汇报底稿参考。`]
    };
  }
  return {
    canGuideGeneration: true,
    canGuideAdaptation: true,
    canGuideExport: false,
    confidence,
    notes: [`${phaseName} 已接入 PDF 基础字节诊断；复杂版式和扫描件仍需降级。`]
  };
}

export function formatProbeSummary(format, probe) {
  if (!probe) return "无探测结果";
  if (format === "docx") {
    return `段落 ${probe.structure.paragraphs}、候选标题 ${probe.structure.headingCandidates?.length ?? 0}、表格 ${probe.structure.tables}、样式 ${probe.style.styleCount}、字体线索 ${probe.style.fonts.length}`;
  }
  if (format === "xlsx") {
    return `工作表 ${probe.structure.sheetCount}、共享字符串 ${probe.style.sharedStringCount}、字体 ${probe.style.fontCount}、填充 ${probe.style.fillCount}`;
  }
  if (format === "pptx") {
    return `幻灯片 ${probe.structure.slideCount}、版式 ${probe.structure.layoutCount}、母版 ${probe.structure.masterCount}、主题 ${probe.style.themeCount}`;
  }
  return `页对象 ${probe.structure.pageCount}、文本操作符 ${probe.structure.textOperatorCount}、图片 ${probe.structure.imageCount}、字体线索 ${probe.style.fontRefs.length}`;
}

function buildDiagnostics(caseData, sourcePath, format, caseErrors, probeError, probe, phaseName) {
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
    code: "probe.completed",
    message: `${phaseName} 已完成 ${format.toUpperCase()} 基础探测：${formatProbeSummary(format, probe)}。`
  });
  if (format === "xlsx") diagnostics.push({ severity: "info", code: "format.xlsx.boundary", message: "XLSX 用作表格结构和指标表达参考，不在本阶段生成 Excel 成品。" });
  if (format === "pptx") diagnostics.push({ severity: "info", code: "format.pptx.boundary", message: "PPTX 用作汇报结构和逐页内容参考，不在本阶段生成 PPTX 成品。" });
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
      sections: (probe.structure.headingCandidates ?? []).map((heading) => ({
        kind: "heading-candidate",
        index: heading.index,
        text: heading.text,
        styleId: heading.styleId,
        styleName: heading.styleName,
        outlineLevel: heading.outlineLevel,
        numberingId: heading.numberingId,
        numberingLevel: heading.numberingLevel
      })),
      tables: Array.from({ length: Math.min(probe.structure.tables, 20) }, (_, index) => ({ index: index + 1, source: "word/document.xml" })),
      counts: { paragraphs: probe.structure.paragraphs, runs: probe.structure.runs, tables: probe.structure.tables },
      sectionPattern: probe.structure.sectionPattern,
      headingStyleRefs: probe.structure.headingStyleRefs,
      paragraphStyleUsage: probe.structure.paragraphStyleUsage,
      numberingUsage: probe.structure.numberingUsage,
      paragraphSamples: probe.structure.paragraphSamples,
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
      layout: { page: probe.style.page },
      typography: {
        fonts: probe.style.fonts,
        fontUsage: probe.style.fontUsage,
        fontSizeUsageHalfPoints: probe.style.fontSizeUsageHalfPoints,
        styleCount: probe.style.styleCount,
        styleIds: probe.style.styleIds,
        styles: probe.style.styles
      },
      colors: {},
      formatSpecific: {
        extractionStage: "basic_probe",
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
      layout: { sheets: probe.structure.sheetStats.map((sheet) => ({ path: sheet.path, dimension: sheet.dimension })) },
      typography: { fontCount: probe.style.fontCount },
      colors: { fillCount: probe.style.fillCount, borderCount: probe.style.borderCount },
      formatSpecific: {
        extractionStage: "basic_probe",
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
      layout: { slideCount: probe.structure.slideCount, layoutCount: probe.structure.layoutCount, masterCount: probe.structure.masterCount },
      typography: { fontSchemeCount: probe.style.fontSchemeCount },
      colors: { colorSchemeCount: probe.style.colorSchemeCount },
      formatSpecific: {
        extractionStage: "basic_probe",
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
    layout: { pageCount: probe.structure.pageCount },
    typography: { fontRefs: probe.style.fontRefs },
    colors: {},
    formatSpecific: {
      extractionStage: "basic_probe",
      realParserAttached: true,
      pdfHeader: probe.header,
      encrypted: probe.structure.encrypted,
      hasTextLayerHint: probe.structure.hasTextLayerHint,
      scanLikely: probe.structure.scanLikely
    },
    evidence
  };
}

function buildWritingProfile(format, confidence, evidence) {
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

function buildProfile(repoRoot, phaseName, caseData, sourcePath, format, diagnostics, probe) {
  const sourceStat = statSync(sourcePath);
  const relativeSource = normalizeRepoPath(repoRoot, sourcePath);
  const profileId = `profile_${caseData.caseId}`;
  const confidence = confidenceFor(format, probe);
  const evidence = [{ kind: "file_probe", description: `${phaseName} runner 已读取样本并完成基础格式探测。`, path: relativeSource }];
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
    documentKind: { label: inferDocumentKind(format, caseData.mode, probe), confidence, evidence },
    capabilities: capabilityFor(format, probe, phaseName),
    structureProfile: buildStructureProfile(format, probe, confidence, evidence),
    styleProfile: buildStyleProfile(format, probe, confidence, evidence),
    writingProfile: buildWritingProfile(format, confidence, evidence),
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
  const profileGuidance = buildProfileGuidance(profile);
  return `# Generation Instruction: ${caseData.caseId}

## 任务

${caseData.task.userGoal}

## 模式

${caseData.mode === "generate_from_profile" ? "先选择格式画像，再按画像生成底稿。" : "已有底稿适配到格式画像。"}

## 探测摘要

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

## 画像约束

${profileGuidance}

## 能力边界

${profile.diagnostics.map((item) => `- [${item.severity}] ${item.code}: ${item.message}`).join("\n")}
`;
}

function buildProfileGuidance(profile) {
  if (profile.source.fileType === "docx") return buildDocxGuidance(profile);
  if (profile.source.fileType === "xlsx") {
    return [
      "- 将该格式视为表格/指标表达参考，而不是普通长文皮肤。",
      `- 工作表线索：${profile.structureProfile.sections.map((sheet) => sheet.name).filter(Boolean).slice(0, 8).join("、") || "未识别"}`,
      "- 输出底稿时优先组织为指标分组、字段口径、结论摘要和补充说明。"
    ].join("\n");
  }
  if (profile.source.fileType === "pptx") {
    return [
      "- 将该格式视为逐页汇报结构参考，而不是普通长文皮肤。",
      `- 页数线索：${profile.structureProfile.slideCount ?? 0} 页；版式线索：${profile.structureProfile.layoutCount ?? 0} 个。`,
      "- 输出底稿时优先按“页标题—核心观点—讲述要点”组织。"
    ].join("\n");
  }
  return [
    "- 将 PDF 作为成品参考，不承诺还原原始版式。",
    `- 页面线索：${profile.structureProfile.pageCount ?? 0} 页；文本层线索：${profile.structureProfile.textOperatorCount ?? 0}。`,
    "- 若 PDF 图片密集或字体线索不足，生成时只参考文体与结构，不复制排版。"
  ].join("\n");
}

function buildDocxGuidance(profile) {
  const sections = profile.structureProfile.sections ?? [];
  const styleUsage = profile.structureProfile.paragraphStyleUsage ?? [];
  const numberingUsage = profile.structureProfile.numberingUsage ?? [];
  const typography = profile.styleProfile.typography ?? {};
  const page = profile.styleProfile.layout?.page ?? {};
  const headingLines = sections.slice(0, 12).map((section, index) => {
    const prefix = section.outlineLevel != null ? `level ${section.outlineLevel}` : "candidate";
    return `  ${index + 1}. (${prefix}) ${section.text}`;
  });
  const styleLines = styleUsage.slice(0, 8).map((item) => `  - ${item.value}: ${item.count}`).join("\n") || "  - 未识别段落样式频率";
  const fontLines = (typography.fontUsage ?? []).slice(0, 8).map((item) => `  - ${item.value}: ${item.count}`).join("\n") || "  - 未识别字体频率";
  const sizeLines = (typography.fontSizeUsageHalfPoints ?? []).slice(0, 8).map((item) => `  - ${item.value} half-points: ${item.count}`).join("\n") || "  - 未识别字号频率";
  const numberingLine = numberingUsage.length > 0
    ? numberingUsage.slice(0, 6).map((item) => `${item.value}(${item.count})`).join("、")
    : "未识别显式编号定义";
  const pageLine = page?.widthTwips
    ? `- 页面线索：${page.widthTwips}×${page.heightTwips} twips；页边距 ${JSON.stringify(page.marginsTwips ?? {})}。`
    : "- 页面线索：未识别页面尺寸或页边距。";
  const sectionPolicy = profile.structureProfile.sectionPattern === "chinese-numbered-sections"
    ? "- 结构策略：优先使用中文序号/条目化章节，但不要机械复制原文标题。"
    : profile.structureProfile.sectionPattern === "decimal-numbered-sections"
      ? "- 结构策略：优先使用数字分级标题。"
      : profile.structureProfile.sectionPattern === "style-based-headings"
        ? "- 结构策略：优先使用样式化标题层级。"
        : "- 结构策略：标题层级证据混合或不足，生成时保持清晰分节并标注低置信度。";

  return [
    "- DOCX 用作正式文稿/制度材料写作约束，不是导出版式承诺。",
    `- 章节模式：${profile.structureProfile.sectionPattern ?? "unknown"}。`,
    sectionPolicy,
    `- 候选标题数量：${sections.length}；生成时把它们当作结构风格证据，不要逐字复用。`,
    "- 候选标题样例：",
    headingLines.length > 0 ? headingLines.join("\n") : "  - 未识别候选标题",
    "- 段落样式使用频率：",
    styleLines,
    `- 编号线索：${numberingLine}。`,
    "- 字体线索：",
    fontLines,
    "- 字号线索：",
    sizeLines,
    pageLine,
    "- 生成策略：先确定用户材料需要的章节，再套用上述结构/语气/层级线索；不要为了匹配样式而编造事实。",
    "- 适配策略：已有底稿与候选标题冲突时，优先保留事实内容，再重组为更接近目标文体的章节。"
  ].join("\n");
}

function buildDraft(caseData, profile) {
  return buildOfflineDraft(caseData, profile);
}

function buildOfflineDraft(caseData, profile) {
  if (profile.source.fileType === "docx") return buildDocxOfflineDraft(caseData, profile);
  if (profile.source.fileType === "xlsx") return buildXlsxOfflineDraft(caseData, profile);
  if (profile.source.fileType === "pptx") return buildPptxOfflineDraft(caseData, profile);
  return buildPdfOfflineDraft(caseData, profile);
}

function materialsBlock(caseData) {
  return (caseData.task.materials ?? []).map((item) => `- ${item}`).join("\n") || "- 无额外材料";
}

function baseDraftHeader(caseData, profile) {
  return `# ${caseData.task.title}

> 离线模拟底稿：使用 FormatProfile 和 FormatBinding 规则生成，用于验证结构路径；未调用真实 LLM。

## 绑定信息

- 模式：${caseData.mode}
- 来源格式：${profile.source.fileType}
- 推断用途：${profile.documentKind.label}
- 画像置信度：${profile.capabilities.confidence}
- 探测摘要：${formatProbeSummary(profile.source.fileType, profile.rawProbeFacts)}
`;
}

function selectDocxDraftSections(profile) {
  const pattern = profile.structureProfile.sectionPattern;
  const candidates = (profile.structureProfile.sections ?? []).map((section) => section.text).filter(Boolean);
  if (pattern === "chinese-numbered-sections") {
    return ["一、背景与依据", "二、总体目标", "三、主要内容", "四、实施路径", "五、保障措施"];
  }
  if (pattern === "decimal-numbered-sections") {
    return ["1. 背景与目标", "2. 结构设计", "3. 关键任务", "4. 实施安排", "5. 风险与保障"];
  }
  if (candidates.length > 0) {
    return candidates.slice(0, 5).map((text, index) => {
      const cleaned = text.replace(/\s+/g, " ").slice(0, 28);
      return `${index + 1}. ${cleaned}`;
    });
  }
  return ["一、背景", "二、目标", "三、内容", "四、安排", "五、说明"];
}

function buildDocxOfflineDraft(caseData, profile) {
  const materialLines = (caseData.task.materials ?? []).map((item) => `- ${item}`).join("\n") || "- 无额外材料";
  const summary = formatProbeSummary(profile.source.fileType, profile.rawProbeFacts);
  const sections = selectDocxDraftSections(profile);
  const styleUsage = (profile.structureProfile.paragraphStyleUsage ?? []).slice(0, 3).map((item) => item.value).join("、") || "未识别";
  const fontUsage = (profile.styleProfile.typography?.fontUsage ?? []).slice(0, 3).map((item) => item.value).join("、") || "未识别";
  const sectionBlocks = sections.map((section, index) => `${section}

本节应围绕“${caseData.task.userGoal}”展开，吸收用户材料中的事实信息，并保持正式、结构化表达。${index === 0 ? "先交代背景、依据和问题来源。" : index === sections.length - 1 ? "最后收束为保障、风险或后续安排。" : "中间章节应说明任务、流程、措施或成效。"}
`).join("\n");
  if (caseData.mode === "adapt_draft_to_profile") {
    return `${baseDraftHeader(caseData, profile)}

## 原始底稿

${caseData.task.existingDraft}

## 适配目标与格式线索

- 探测摘要：${summary}
- 章节模式：${profile.structureProfile.sectionPattern ?? "unknown"}
- 常见段落样式：${styleUsage}
- 常见字体线索：${fontUsage}
- 适配重点：结构、语气、表达方式，而非高保真还原源文件。

## 材料约束

${materialLines}

## 离线模拟改写结构

${sectionBlocks}

## 模拟器诊断

- 已验证已有底稿可进入 FormatBinding 适配路径。
- 当前为规则化结构模拟，真实生成器后续应补足语义展开和事实一致性检查。
`;
  }
  return `${baseDraftHeader(caseData, profile)}

## 生成目标

${caseData.task.userGoal}

## DOCX 格式线索

- 探测摘要：${summary}
- 章节模式：${profile.structureProfile.sectionPattern ?? "unknown"}
- 常见段落样式：${styleUsage}
- 常见字体线索：${fontUsage}

## 材料约束

${materialLines}

## 离线模拟底稿结构

${sectionBlocks}

## 模拟器诊断

- 已验证先选格式画像再生成底稿路径。
- 当前为规则化结构模拟，真实生成器后续应补足语义展开和事实一致性检查。
`;
}

function buildXlsxOfflineDraft(caseData, profile) {
  const sheets = profile.structureProfile.sections ?? [];
  const sheetLines = sheets.slice(0, 8).map((sheet, index) => `| ${index + 1} | ${sheet.name ?? sheet.path ?? "未命名工作表"} | 指标分组/口径/备注 |`).join("\n");
  return `${baseDraftHeader(caseData, profile)}

## 生成目标

${caseData.task.userGoal}

## 表格化结构模拟

| 序号 | 工作表/区域线索 | 建议底稿用途 |
| ---: | --- | --- |
${sheetLines || "| 1 | 未识别 | 指标说明 |"}

## 指标分析底稿骨架

### 一、指标概览

围绕用户目标列出核心指标、统计口径和当前状态。

### 二、分组说明

根据工作表或区域线索，把内容拆分为指标组、数据来源、计算方式和解释口径。

### 三、结论摘要

输出面向管理层的简短结论，避免写成长篇制度材料。

## 材料约束

${materialsBlock(caseData)}
`;
}

function buildPptxOfflineDraft(caseData, profile) {
  const slides = profile.structureProfile.sections ?? [];
  const selected = slides.slice(0, 8);
  const slideBlocks = selected.map((slide, index) => `### 第 ${index + 1} 页：${slide.textSample?.[0] ?? "页面主题"}

- 核心观点：围绕用户目标提炼一个页面级观点。
- 讲述要点：结合材料说明背景、结构、功能或价值。
- 版式线索：shape ${slide.shapeCount ?? 0}，picture ${slide.pictureCount ?? 0}，table ${slide.tableCount ?? 0}。
`).join("\n");
  return `${baseDraftHeader(caseData, profile)}

## 生成目标

${caseData.task.userGoal}

## 逐页汇报模拟

${slideBlocks || "### 第 1 页：汇报概览\n\n- 核心观点：围绕用户目标提炼汇报主题。\n- 讲述要点：补充背景、内容和价值。\n"}

## 材料约束

${materialsBlock(caseData)}

## 模拟器诊断

- PPTX 路径输出逐页内容草稿，不输出 PPTX 文件。
`;
}

function buildPdfOfflineDraft(caseData, profile) {
  return `${baseDraftHeader(caseData, profile)}

${caseData.mode === "adapt_draft_to_profile" ? `## 原始底稿\n\n${caseData.task.existingDraft}\n` : `## 生成目标\n\n${caseData.task.userGoal}\n`}
## PDF 参考路径模拟

### 一、参考边界

该 PDF 仅作为成品风格参考。当前识别到 ${profile.structureProfile.pageCount ?? 0} 个页对象、${profile.structureProfile.textOperatorCount ?? 0} 个文本操作符、${profile.structureProfile.imageCount ?? 0} 个图片线索。

### 二、底稿组织建议

保留用户事实，参考 PDF 的成品表达方式组织为简介、结构、功能、价值和后续安排。

### 三、低保真提醒

不复制 PDF 排版；如图片密集或字体线索不足，应降低格式遵循置信度。

## 材料约束

${materialsBlock(caseData)}
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

export function runProfileCase(options) {
  const { repoRoot, outputRoot, phaseName, casePath, caseData } = options;
  const caseErrors = validateCase(caseData);
  const sourcePath = resolve(repoRoot, normalize(caseData.source?.path ?? ""));
  const format = extname(sourcePath).slice(1).toLowerCase();
  const caseOut = join(outputRoot, caseData.caseId ?? basename(casePath ?? "case", ".case.json"));
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

  const diagnostics = buildDiagnostics(caseData, sourcePath, format, caseErrors, probeError, probe, phaseName);
  const hasFatal = diagnostics.some((item) => item.severity === "error");

  if (hasFatal) {
    const diagnosticsEnvelope = {
      schemaVersion: "format-diagnostics.v0",
      caseId: caseData.caseId ?? basename(casePath ?? "case"),
      status: "failed",
      diagnostics
    };
    writeJson(join(caseOut, "diagnostics.json"), diagnosticsEnvelope);
    return {
      caseId: diagnosticsEnvelope.caseId,
      status: "failed",
      format,
      mode: caseData.mode,
      sourcePath: caseData.source?.path ?? "",
      outputDir: normalizeRepoPath(repoRoot, caseOut),
      diagnosticsCount: diagnostics.length,
      validationErrors: diagnostics.map((item) => item.message)
    };
  }

  const profile = buildProfile(repoRoot, phaseName, caseData, sourcePath, format, diagnostics, probe);
  const binding = buildBinding(caseData, profile);
  const diagnosticsEnvelope = { schemaVersion: "format-diagnostics.v0", caseId: caseData.caseId, status: "ready", diagnostics };
  const instruction = buildInstruction(caseData, profile, binding);
  const draft = buildDraft(caseData, profile);
  const validationErrors = minimalValidateOutput(caseData, profile, binding, diagnosticsEnvelope);

  writeJson(join(caseOut, "profile.json"), profile);
  writeJson(join(caseOut, "binding.json"), binding);
  writeJson(join(caseOut, "diagnostics.json"), diagnosticsEnvelope);
  writeText(join(caseOut, "generation-instruction.md"), instruction);
  writeText(join(caseOut, "draft-output.md"), draft);

  const metrics = extractMetrics(format, probe);
  return {
    caseId: caseData.caseId,
    status: validationErrors.length === 0 ? "ready" : "failed",
    format,
    mode: caseData.mode,
    sourcePath: normalizeRepoPath(repoRoot, sourcePath),
    outputDir: normalizeRepoPath(repoRoot, caseOut),
    diagnosticsCount: diagnostics.length,
    validationErrors,
    probeSummary: formatProbeSummary(format, probe),
    confidence: profile.capabilities.confidence,
    byteSize: profile.source.byteSize,
    metrics,
    riskFlags: assessProbeRisks(format, metrics)
  };
}

function extractMetrics(format, probe) {
  if (!probe) return {};
  if (format === "docx") {
    return {
      paragraphs: probe.structure.paragraphs,
      headingCandidateCount: probe.structure.headingCandidates?.length ?? 0,
      tables: probe.structure.tables,
      styleCount: probe.style.styleCount,
      fontCount: probe.style.fonts.length,
      paragraphStyleUsageCount: probe.structure.paragraphStyleUsage?.length ?? 0,
      textSampleCount: probe.structure.textSample.length
    };
  }
  if (format === "xlsx") {
    return {
      sheetCount: probe.structure.sheetCount,
      sharedStringCount: probe.style.sharedStringCount,
      fontCount: probe.style.fontCount,
      fillCount: probe.style.fillCount,
      formulaCount: probe.structure.sheetStats.reduce((sum, sheet) => sum + sheet.formulaCount, 0)
    };
  }
  if (format === "pptx") {
    return {
      slideCount: probe.structure.slideCount,
      layoutCount: probe.structure.layoutCount,
      masterCount: probe.structure.masterCount,
      themeCount: probe.style.themeCount,
      sampledSlideTextCount: probe.structure.slideStats.reduce((sum, slide) => sum + slide.textCount, 0)
    };
  }
  return {
    pageCount: probe.structure.pageCount,
    textOperatorCount: probe.structure.textOperatorCount,
    imageCount: probe.structure.imageCount,
    fontRefCount: probe.style.fontRefs.length,
    scanLikely: probe.structure.scanLikely
  };
}

function assessProbeRisks(format, metrics) {
  const risks = [];
  if (format === "docx") {
    if ((metrics.paragraphs ?? 0) > 1000) risks.push("long-docx-structure");
    if ((metrics.tables ?? 0) > 20) risks.push("table-heavy-docx");
    if ((metrics.styleCount ?? 0) <= 4) risks.push("sparse-docx-style-definitions");
    if ((metrics.headingCandidateCount ?? 0) === 0) risks.push("docx-no-heading-candidates");
  }
  if (format === "xlsx") {
    if ((metrics.sharedStringCount ?? 0) === 0) risks.push("xlsx-inline-or-empty-shared-strings");
    if ((metrics.fontCount ?? 0) <= 1 && (metrics.fillCount ?? 0) <= 1) risks.push("sparse-xlsx-style-evidence");
    if ((metrics.formulaCount ?? 0) > 0) risks.push("xlsx-formula-semantics");
  }
  if (format === "pptx") {
    if ((metrics.slideCount ?? 0) > 30) risks.push("large-pptx-deck");
    if ((metrics.layoutCount ?? 0) > 30) risks.push("many-pptx-layouts");
    if ((metrics.sampledSlideTextCount ?? 0) === 0) risks.push("pptx-low-text-signal");
  }
  if (format === "pdf") {
    if ((metrics.fontRefCount ?? 0) === 0) risks.push("pdf-no-font-reference-signal");
    if ((metrics.imageCount ?? 0) > Math.max(10, (metrics.textOperatorCount ?? 0) * 2)) risks.push("pdf-image-heavy");
    if ((metrics.pageCount ?? 0) > 40) risks.push("long-pdf");
    if (metrics.scanLikely) risks.push("pdf-scan-likely");
  }
  return risks;
}

export function buildMarkdownReport(title, results, note) {
  const passed = results.filter((item) => item.validationErrors.length === 0).length;
  const rows = results
    .map((item) => `| ${item.caseId} | ${item.format} | ${item.mode ?? "-"} | ${item.status} | ${item.confidence ?? "-"} | ${item.diagnosticsCount} | ${item.probeSummary ?? "-"} |`)
    .join("\n");
  const failures = results
    .filter((item) => item.validationErrors.length > 0)
    .flatMap((item) => item.validationErrors.map((error) => `- ${item.caseId}: ${error}`))
    .join("\n") || "- 无";
  return `# ${title}

## Summary

- Cases: ${results.length}
- Probe-valid outputs: ${passed}
- Failed outputs: ${results.length - passed}

## Cases

| Case | Format | Mode | Status | Confidence | Diagnostics | Probe summary |
| --- | --- | --- | --- | --- | ---: | --- |
${rows}

## Validation errors

${failures}

## Note

${note}
`;
}

export function summarizeByFormat(results) {
  const groups = new Map();
  for (const item of results) {
    if (!groups.has(item.format)) groups.set(item.format, []);
    groups.get(item.format).push(item);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([format, items]) => ({
      format,
      total: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      failed: items.filter((item) => item.status === "failed").length,
      confidence: Object.fromEntries(["high", "medium", "low", "unknown"].map((level) => [level, items.filter((item) => item.confidence === level).length])),
      totalBytes: items.reduce((sum, item) => sum + (item.byteSize ?? 0), 0)
    }));
}
