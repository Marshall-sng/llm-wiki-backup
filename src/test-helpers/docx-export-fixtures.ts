import type { DraftRecord } from "@/lib/draft-types"
import type { DraftProcessingFormatProfileSnapshot, FormatSpecRule } from "@/lib/format-profile-types"

export function createDocxExportDraft(content?: string): DraftRecord {
  return {
    id: "draft-docx-export-1",
    title: "云南省数据流通利用基础设施平台介绍",
    content: content ?? [
      "# 云南省数据流通利用基础设施平台介绍",
      "",
      "一、背景",
      "",
      "随着国家层面大力推进数据要素市场化配置改革，平台建设具有重要意义[1]。",
      "",
      "二、平台架构",
      "",
      "（一）国家全域节点",
      "",
      "国家全域节点负责提供统一规范。",
      "",
      "1. 审核数据资源登记；",
      "2. 上报至国家全域节点；",
      "",
      "- 保留来源事实边界；",
      "- 不承诺视觉复刻；",
      "",
      "| 项目 | 要求 |",
      "| :--- | :--- |",
      "| 标题 | 保持层级 |",
      "",
      "三、目的与意义",
      "",
      "平台将为数据流通利用提供公共服务。",
    ].join("\n"),
    references: [{ title: "Source", path: "wiki/source.md" }],
    source: {
      kind: "chat-assistant",
      conversationId: "conversation-1",
      messageId: "message-1",
      messageTimestamp: 1,
      contentHash: "draft-content-hash-1",
    },
    versions: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

export function createDocxFormatRules(): FormatSpecRule[] {
  return [
    {
      id: "document-title-rule",
      target: "document-title",
      rule: "全文主标题独立成行",
      detail: "主标题不得被降级为章节标题。",
      source: "inferred",
      confidence: "high",
      evidenceRefs: ["style.docx.title.0001"],
    },
    {
      id: "section-title-rule",
      target: "section-title",
      rule: "一级标题使用中文序号",
      detail: "一级标题使用“一、二、三”层级。",
      source: "inferred",
      confidence: "high",
      evidenceRefs: ["style.docx.heading.0001"],
    },
    {
      id: "subsection-title-rule",
      target: "subsection-title",
      rule: "二级标题使用括号中文序号",
      detail: "二级标题使用“（一）（二）（三）”层级。",
      source: "inferred",
      confidence: "medium",
      evidenceRefs: ["style.docx.heading.0002"],
    },
    {
      id: "ordered-list-rule",
      target: "ordered-list",
      rule: "列表使用数字编号",
      detail: "有顺序的要点使用数字编号。",
      source: "inferred",
      confidence: "medium",
      evidenceRefs: ["style.docx.list.0001"],
    },
    {
      id: "unordered-list-rule",
      target: "unordered-list",
      rule: "无序列表使用项目符号",
      detail: "无顺序的要点使用项目符号。",
      source: "inferred",
      confidence: "medium",
      evidenceRefs: ["style.docx.list.0002"],
    },
    {
      id: "table-rule",
      target: "table",
      rule: "表格保留行列结构",
      detail: "表格导出时保留表头和数据行。",
      source: "detected",
      confidence: "medium",
      evidenceRefs: ["style.docx.table.0001"],
    },
  ]
}

export function createDocxFormatProfileSnapshot(): DraftProcessingFormatProfileSnapshot {
  return {
    id: "format-profile-1",
    title: "正式文稿格式画像",
    fileType: "docx",
    confidence: "high",
    capturedAt: 1,
    sourceProfileHash: "source-profile-hash-1",
    formatSpecHash: "format-spec-hash-1",
    diagnostics: [],
    formatSpec: {
      schemaVersion: "format-spec.v0",
      rendererVersion: "format-spec-renderer.v0",
      policyVersion: "format-spec-policy.v0",
      sourceFileType: "docx",
      documentIntent: "formal-document",
      confidence: "high",
      contentLeakagePolicy: {
        includeSourceBodyText: false,
        includeRawEvidenceDump: false,
        promptMayIncludeEvidenceIds: false,
      },
      boundaries: ["来源事实优先", "不承诺像素级渲染等价"],
      rules: createDocxFormatRules(),
      promptBlock: "按正式文稿格式约束生成。",
      summaryLines: ["主标题独立成行", "一级标题使用中文序号"],
    },
  }
}
