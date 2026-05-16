# DOCX-first Export Preflight

日期：2026-05-14  
状态：local preflight / no product integration  
目的：在不干扰当前 FormatSpec / formatRuleSynthesis 主线的前提下，验证 DOCX-first 正式导出可以采用“结构化中间稿 → 确定性 DOCX adapter → validation/audit”的闭环。

## 1. 当前策略

下一阶段正式导出先聚焦 DOCX：

```text
Draft version
→ Evidence / references
→ FormatProfile / StyleFacts / FormatSpec
→ DocxExportContract
→ DocxIntermediateDocument
→ DocxMatchReview
→ DOCXExportAdapter
→ DocxExportRecord / Audit
```

PPTX / XLSX / PDF 暂不进入正式导出实现。

## 2. 本次实验产物

```text
experiments/docx-export/docx-intermediate-sample.json
experiments/docx-export/docx-first-smoke.docx
experiments/docx-export/docx-first-structured.docx
```

`docx-intermediate-sample.json` 是一个最小结构化中间稿示例：

```json
[
  {"type":"heading","level":1,"text":"一、背景与目标"},
  {"type":"paragraph","text":"..."},
  {"type":"heading","level":1,"text":"二、生成合同"},
  {"type":"paragraph","text":"..."},
  {"type":"heading","level":2,"text":"（一）硬性边界"},
  {"type":"paragraph","text":"..."},
  {"type":"heading","level":1,"text":"三、导出前检查"},
  {"type":"paragraph","text":"..."}
]
```

这验证了：LLM 后续不必直接写 `.docx`，它可以只输出可检查的 `DocxIntermediateDocument`，再由确定性 adapter 生成 DOCX。

## 3. 使用的工具

本次使用本地已安装的 `minimax-docx` skill 的 OpenXML SDK CLI：

```text
C:\Users\Dante\.agents\skills\minimax-docx\scripts\dotnet\MiniMaxAIDocx.Cli\bin\Debug\net8.0\MiniMaxAIDocx.Cli.exe
```

环境备注：

- `env_check.sh` 在当前 Windows / no-WSL 表面不可用。
- 本机有 .NET 9 SDK/runtime。
- 该 CLI 目标为 net8.0，直接运行缺少 net8 runtime；设置 `DOTNET_ROLL_FORWARD=Major` 后可运行。

命令模式：

```powershell
$env:DOTNET_ROLL_FORWARD='Major'
MiniMaxAIDocx.Cli.exe create ...
MiniMaxAIDocx.Cli.exe validate --business ...
MiniMaxAIDocx.Cli.exe analyze --json ...
MiniMaxAIDocx.Cli.exe diff ...
```

## 4. 验证结果

### 4.1 生成

```text
Created report document: experiments\docx-export\docx-first-smoke.docx
Created report document: experiments\docx-export\docx-first-structured.docx
```

### 4.2 validate

`docx-first-structured.docx`:

```text
Validation: PASSED
WARNINGS (1):
  Orphaned relationship is defined but never referenced
```

解释：结构验证通过；存在一个孤立 relationship warning，后续如果采用 OpenXML SDK adapter，应纳入 `DocxValidationPipeline` 的 warning 分类和修复策略。

### 4.3 analyze

`docx-first-structured.docx` 分析结果：

```text
Sections: 1
Headings: 4
Tables: 0
Images: 0
Headers: 1
Footers: 1
Paragraphs: 13
```

检测到 heading：

```text
Heading1: 一、背景与目标
Heading1: 二、生成合同
Heading2: （一）硬性边界
Heading1: 三、导出前检查
```

ZIP/XML 级检查：

```json
{
  "zip_entries": 7,
  "heading_style_refs": ["Heading1", "Heading1", "Heading2", "Heading1"],
  "style_outline_levels": ["0", "1", "2", "3", "4", "5"],
  "has_toc_field": true,
  "has_header": true,
  "has_footer": true
}
```

这说明最小 DOCX adapter 可以保留：

- 标题样式；
- TOC field；
- header/footer；
- outline level；
- 可回读结构。

### 4.4 diff

对比 smoke docx 与 structured docx：

```text
13 paragraphs changed, 0 styles modified, 0 structural changes
```

这对后续 `DocxMatchReview` 有启发：文本变化、样式变化、结构变化可以分层报告，不要只输出“通过/失败”。

## 5. 本地依赖状态

当前项目 `node_modules` 中未安装：

```text
docx
mammoth
docxtemplater
docx-templates
pizzip
jszip
```

因此若第一版选择 TS 侧 `dolanmiu/docx` + `mammoth.js`，需要新增依赖并做许可证/包体积/桌面端打包评估。

当前环境未发现 LibreOffice / soffice，因此 OpenAI 式 “DOCX → PDF → PNG render check” 暂不可本地直接验证。可作为后续可选验证门。

## 6. 初步设计判断

### 6.1 MVP 可行路线

第一版可以先做：

```text
DocxIntermediateDocument(JSON/Markdown)
→ deterministic DOCX adapter
→ XML/business validation
→ analyze/text extraction
→ DocxMatchReview
→ ExportRecord
```

### 6.2 两个 adapter 候选

#### Option A: TS adapter

```text
dolanmiu/docx + mammoth.js
```

优点：

- 更贴近当前 TS/Tauri 前端代码；
- MVP 快；
- 易于把 `DocxIntermediateDocument` 映射到段落、标题、表格。

风险：

- 复杂 section、页眉页脚、TOC、模板继承能力需要验证；
- 需要新增依赖。

#### Option B: OpenXML SDK sidecar

```text
MiniMax/OpenXML SDK CLI or product-owned .NET sidecar
```

优点：

- 对复杂 DOCX 结构更强；
- validation / repair / analyze / diff 能力成熟；
- 更适合后续模板应用、页眉页脚、多 section、公文格式。

风险：

- 引入 .NET runtime/sidecar 复杂度；
- 当前 CLI 需要 `DOTNET_ROLL_FORWARD=Major` 才能在本机运行；
- 产品分发和跨平台打包成本更高。

### 6.3 建议

先设计数据合同，不急着选最终 adapter：

```text
DocxExportContract
DocxIntermediateDocument
DocxMatchReview
DocxExportRecord
DocxValidationPipeline
```

然后用同一组 fixtures 同时比较：

```text
TS docx adapter
OpenXML SDK adapter
```

以验证：

- heading / outline / TOC；
- CJK 字体和字号；
- 表格；
- header/footer；
- section/page margins；
- text extraction / audit；
- warning 分类。

## 7. 下一步建议

1. 建立 `DocxExportContract` PRD/test spec。
2. 定义 `DocxIntermediateDocument` schema，至少支持 heading、paragraph、list、table、evidence marker。
3. 定义 `DocxMatchReview`：
   - required sections；
   - heading order；
   - evidence refs；
   - forbidden claims；
   - style/FormatSpec coverage；
   - validation warnings/errors。
4. 用当前实验文件作为第一批 fixture。
5. 决定 MVP adapter：TS `docx` 还是 OpenXML SDK sidecar。

## 8. 不变边界

- LLM 不直接生成 `.docx`。
- LLM 不修改事实层。
- 默认 evidence-only。
- 不承诺高保真视觉复刻。
- 导出必须绑定 draft version、FormatSpec hash、profile/source hash、model/provider metadata 和 validation result。
