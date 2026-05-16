# FormatSpec 四格式实验 — PRD / 测试合并归档

归档说明：四格式 FormatSpec 实验已完成，后续主线转入产品化和 DOCX-first 导出；实验 PRD 与测试规格合并保存。


---

## 原文件：`prd-format-spec-four-format-experiment.md`


﻿# PRD: FormatSpec 四格式实验

日期：2026-05-14  
状态：设计通过后进入实验实现  
范围：实验 harness，不直接改产品主链路

## 1. 背景与问题

当前 FormatProfile / StyleFacts / SemanticOverlay 已能把成品文件中的结构、样式事实和证据绑定解释带入产品，但最近真实底稿加工暴露出新的问题：

1. `generationInstruction` 仍直接消费了过多原始画像内容，包含来源文件的章节/条款原文，导致约束 prompt 冗余、机械、主题污染。
2. 样式约束不够细，更多是“字体列表/字号列表/结构线索摘要”，而不是可执行的格式规范。
3. 用户期望的方向不是让 LLM 复制来源正文内容，而是像 GB/T 9704-2012 那样，把格式要求拆成可执行规则：标题层级、编号符号、字体、字号、缩进、对齐、行距、表格/幻灯片/工作簿结构等。
4. 该思路必须同时适配 DOCX、XLSX、PPTX、PDF，不能只解决 DOCX。

## 2. 产品判断

新增中间层 `FormatSpec`，位于 `StyleFacts/SemanticOverlay` 与 `draft-processing prompt` 之间：

```text
成品文件
  -> deterministic probe / StyleFacts
  -> optional evidence-bound SemanticOverlay
  -> FormatSpec（详细格式规范层）
  -> draft prompt / adaptation prompt
```

`FormatSpec` 只回答“这个格式应如何组织、排版、表达”，不回答“来源文件具体写了什么”。

## 3. 本轮实验目标

本轮只做实验，不接入产品主链路。实验必须证明：

1. 能从四格式现有 evidence-only 输入生成 `format-spec.json`。
2. 能渲染人可读 `format-spec.md`。
3. 能生成面向底稿加工的 `draft-prompt.md`，且不包含来源文件正文片段。
4. 能生成 `evaluation.json`，用自动规则检查格式细节、边界和内容泄漏。
5. DOCX/XLSX/PPTX/PDF 都有类型专属规则，而不是共用一套空泛摘要。

## 4. 非目标

- 不恢复手动输入模板。
- 不接入产品 UI / Store / draft-processing 主链路。
- 不让 LLM 生成或覆盖 StyleFacts。
- 不默认发送 snippets/fulltext。
- 不承诺导出、视觉复刻、像素级还原或高保真复刻。
- 不追求从 PDF/PPTX 反推完整可编辑模板。

## 5. FormatSpec 合同草案

```ts
interface FormatSpec {
  schemaVersion: "format-spec.v0"
  caseId: string
  sourceFileType: "docx" | "xlsx" | "pptx" | "pdf"
  documentIntent: string
  confidence: "high" | "medium" | "low"
  globalBoundaries: string[]
  contentLeakagePolicy: {
    includeSourceBodyText: false
    includeRawEvidenceDump: false
    promptMayIncludeEvidenceIds: false
  }
  rules: FormatRule[]
  typeSpecific: DocxFormatSpec | XlsxFormatSpec | PptxFormatSpec | PdfFormatSpec
}

interface FormatRule {
  id: string
  target: string
  rule: string
  detail: string
  source: "detected" | "inferred" | "standard-default"
  confidence: "high" | "medium" | "low"
  evidenceRefs?: string[]
}
```

### 5.1 DOCX 规则方向

DOCX 应输出接近正式文稿规范的细粒度规则：

- 页面：纸张尺寸、方向、页边距可用性、页码/页眉页脚边界。
- 标题：主标题、一级标题、二级标题、三级标题、正文条款标题。
- 编号：章/节/条/款/项，以及“一、”“（一）”“1.”“（1）”等层级。
- 字体字号：中文正文主字体、西文字体、标题字体、表格字体、字号 pt。
- 段落：首行缩进、对齐、段前段后、行距、列表连续性。
- 表格：表格标题、表头、单元格内容密度、表格文本字体边界。
- 写作边界：只约束结构和表达，不复制来源条款原文。

### 5.2 XLSX 规则方向

XLSX 应输出表格/指标工作簿规范，而不是长文格式：

- 工作簿：工作表数量、命名、表区域、冻结/筛选如证据不足则不推断。
- 表结构：标题行、表头行、数据区、合计/备注区、空行和分组。
- 单元格样式：字体数、填充数、边框数、共享字符串规模，作为复杂度线索。
- 数值口径：金额、百分比、日期、单位、公式必须保持事实边界。
- 输出用途：生成表格说明、指标口径、观察结论；不伪造 Excel 文件。

### 5.3 PPTX 规则方向

PPTX 应输出汇报/演示规范：

- 全局：页数、母版、版式、主题、颜色/字体方案。
- 页面类型：封面、目录/过渡页、内容页、图表页、总结页。
- 每页组织：一页一主题、标题区、主体区、要点数量、图文密度。
- 文本规则：标题短句、正文 bullet、汇报语气、页脚/页码边界。
- 输出用途：生成汇报大纲或逐页草稿；不承诺生成 PPTX 文件。

### 5.4 PDF 规则方向

PDF 应输出低/中置信成品参考规范：

- 页面：页数、文本层、图片密度、扫描风险。
- 字体：字体引用只作为诊断资源名，不等同可编辑字体。
- 使用方式：作为内容和版式参考，不反推精确模板。
- 输出边界：无法保证跨页、图文位置、装订/水印/印章复刻。

## 6. 实验输入

复用现有四格式 evidence-only mock-pass 输入：

- `docx-policy`
- `xlsx-metrics`
- `pptx-briefing`
- `pdf-reference`

原因：这些输入已经由前序 harness 产出，包含 deterministicProfile、styleProfile、rawEvidence 和 dataScope，足够验证 FormatSpec 层是否能去内容化、规则化。

## 7. 成功门槛

每个 case 必须通过：

1. `format-spec.json` schema 基本字段完整。
2. `rules` 数量达到类型最低要求：DOCX >= 16，XLSX >= 12，PPTX >= 12，PDF >= 8。
3. `typeSpecific` 只出现当前文件类型分支。
4. `draft-prompt.md` 不包含 raw evidence 正文片段或来源段落长文本。
5. `draft-prompt.md` 不包含 raw evidence dump 或证据 hash 列表。
6. 输出必须包含边界：不承诺导出、不承诺视觉复刻、不根据格式画像虚构事实。
7. 输出必须包含细格式规则：字体/字号/缩进/对齐/层级/表格或页面组织等。

## 8. 实验产物

```text
experiments/format-spec/
  README.md
  cases/*.case.json
  scripts/run-format-spec.mjs
  outputs/<caseId>/format-spec.json
  outputs/<caseId>/format-spec.md
  outputs/<caseId>/draft-prompt.md
  outputs/<caseId>/evaluation.json
  reports/latest-summary.json
  reports/latest-summary.md
```

## 9. 后续产品化判断

如果本实验通过，下一步才设计产品接入：

```text
StyleFacts/SemanticOverlay -> FormatSpec builder -> prompt renderer -> UI preview/audit -> draft-processing
```

产品接入时新的 FormatSpec 应直接替代当前冗余画像约束 prompt，而不是并行叠加。

## Ralplan 修订补充（2026-05-14）

Planner 复审后，本实验增加以下门禁：

- Happy path 之外必须包含独立负例自测。
- 人读产物必须通过归一化正文泄漏检测。
- `typeSpecific`、`sourceFileType`、`source`、`confidence`、`target` 必须按枚举校验。
- summary / evaluation 必须记录输入、case、生成脚本、独立 evaluator、输出产物 hash。
- 生成器内置检查不能作为唯一证据，必须运行独立 evaluator。

新增验证命令：

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
node experiments/format-spec/scripts/evaluate-format-spec.mjs
```

独立 evaluator 必须满足：

```text
happy path: 4/4 pass
negative self-tests: 5/5 pass
```


---

## 原文件：`test-spec-format-spec-four-format-experiment.md`


﻿# Test Spec: FormatSpec 四格式实验

日期：2026-05-14  
范围：`experiments/format-spec` harness

## 1. 验证目标

验证 `FormatSpec` 能把已有 StyleFacts / deterministicProfile / evidence-only 输入转译成详细、可执行、非内容污染的格式规范。

## 2. 测试矩阵

| Case | 类型 | 重点 |
| --- | --- | --- |
| docx-policy | DOCX | 正式文稿层级、标题、条款、字体字号、段落缩进、表格边界 |
| xlsx-metrics | XLSX | 工作簿/工作表、表区域、表头、数据区、单元格样式复杂度、公式/单位边界 |
| pptx-briefing | PPTX | 页数、母版/版式/主题、封面/目录/内容/总结页、bullet 密度 |
| pdf-reference | PDF | 页数、文本层、图片密度、字体引用诊断、低保真边界 |

## 3. 自动评估规则

### 3.1 Schema 完整性

- `schemaVersion === "format-spec.v0"`
- `caseId`、`sourceFileType`、`documentIntent`、`confidence` 存在。
- `globalBoundaries` 至少 3 条。
- `rules` 非空且每条有 `id/target/rule/detail/source/confidence`。
- `contentLeakagePolicy.includeSourceBodyText === false`。
- `contentLeakagePolicy.includeRawEvidenceDump === false`。
- `contentLeakagePolicy.promptMayIncludeEvidenceIds === false`。

### 3.2 类型专属覆盖

- DOCX：必须包含 title、heading、numbering、typography、paragraph、table、page、boundary 目标。
- XLSX：必须包含 workbook、sheet、table-region、header、data-region、style、formula、number-format、boundary 目标。
- PPTX：必须包含 deck、theme、layout、cover-slide、content-slide、bullet、visual-density、boundary 目标。
- PDF：必须包含 page、text-layer、image-density、font-ref、scan-risk、reference-use、boundary 目标。

### 3.3 细节充分性

- DOCX 至少 16 条规则。
- XLSX 至少 12 条规则。
- PPTX 至少 12 条规则。
- PDF 至少 8 条规则。
- 至少一条规则必须含字体或字号信息（PDF 允许为字体引用诊断）。
- DOCX 至少一条规则必须含缩进/对齐/行距。
- XLSX 至少一条规则必须含表头/数据区/单位或数字格式。
- PPTX 至少一条规则必须含页类型或 bullet 密度。
- PDF 至少一条规则必须含文本层/扫描风险。

### 3.4 内容泄漏防护

- `format-spec.md` 和 `draft-prompt.md` 不得包含 rawEvidence 中长度超过 20 字的 `text` 原文。
- `draft-prompt.md` 不得包含 `rawEvidence`、`sha256`、`raw.docx.paragraph` 等证据转储标记。
- 允许在 `format-spec.json` 保留短 evidenceRefs，但 prompt 默认不显示 evidence ids。

### 3.5 边界防护

输出不得包含：

- “完全还原”
- “像素级”
- “高保真复刻”
- “保证导出”
- “自动生成 DOCX/XLSX/PPTX/PDF 文件”

必须包含：

- 不根据格式画像虚构事实。
- 不承诺导出或视觉复刻。
- 来源事实优先于格式约束。

## 4. 运行命令

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
```

## 5. 通过标准

- 四个 case 全部 `verdict: pass`。
- `reports/latest-summary.json` 中 `passed === total`。
- 实验报告记录输出路径和失败规则数。

## 6. 不通过处理

- 如果内容泄漏失败：先收紧 renderer，不扩大输入数据范围。
- 如果细节不足：优先补充类型专属 deterministic/default rule，不让 LLM 写事实。
- 如果边界失败：修改固定边界文案和 evaluator 禁词。

## Ralplan 修订补充：独立 evaluator 与负例门禁（2026-05-14）

### 新增验证命令

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
node experiments/format-spec/scripts/evaluate-format-spec.mjs
```

### 新增负例

独立 evaluator 必须证明以下负例会失败：

1. normalized raw text leakage：来源正文被调整空格/标点后混入 prompt。
2. evidence id dump：prompt 包含 `raw.docx.paragraph`、`sha256` 等证据转储标记。
3. forbidden promise：输出承诺“高保真复刻”或“自动生成 PPTX”等。
4. missing target：缺失类型必需 target。
5. multiple typeSpecific：同一 spec 出现多个类型分支。

### 新增通过标准

- `reports/independent-evaluator-summary.json` 中 happy path 为 4/4 pass。
- `negativeSelfTests.passed === negativeSelfTests.total`。
- 每个 `evaluation.json` 包含 provenance：input/case/generator/evaluator/output hash。
- 不存在 error 级 diagnostics。
