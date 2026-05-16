# Tasks：DOCX-first Formal Export

> 🟢 = 已完成  🟡 = 部分完成  ⬜ = 未开始

## Slice A — Contract / Intermediate / Review library

- [x] 🟢 `DocxExportContract` 类型与 builder
- [x] 🟢 `DocxIntermediateDocument` 类型与 parser（title / heading / paragraph / list / table）
- [x] 🟢 FormatSpec rule → ruleRefs / formatDimensions 映射
- [x] 🟢 `DocxMatchReview` 类型与 evaluator（pass / warn / fail）
- [x] 🟢 `DocxExportRecord` 类型与 builder

## Slice B — Style & Fidelity

- [x] 🟢 `DocxFormatDimension` 定义（title.main / heading.level1-3 / paragraph.body / list.numbering / table.readability）
- [x] 🟢 `DocxResolvedStylePolicy` 解析（字体、字号、缩进、行距、对齐、页边距）
- [x] 🟢 FormatSpec 维归一化（normalizeDocxBaselineDimension）
- [x] 🟢 StyleFacts → DOCX 属性映射
- [x] 🟢 `DocxFidelityDiagnostics` 报告（restored / partial / missing / unverified）
- [x] 🟢 内联 **bold** 解析（parseDocxInlineSegments）
- [x] 🟢 Wikilink 规范化
- [x] 🟢 文本规范化（normalizeWhitespaceHtmlEntities）

## Slice C — Adapter Integration

- [x] 🟢 TS adapter 样式驱动渲染（DocxResolvedTextStyle → docx Paragraph）
- [x] 🟢 DOCX 导出管线集成 fidelity diagnostics
- [x] 🟢 FormatProfile generationInstruction 重构（委托给 FormatSpec）
- [x] 🟢 heading3 支持
- [x] 🟢 Probe expectations 增强（inline text normalization）
- [x] 🟢 自动编号意图标记（autoNumberingIntent）

## Slice E1 — Fidelity Baseline Diagnostics

- [x] 🟢 `DocxFidelityDiagnostics` 报告结构（restored / partial / missing / unverified）
- [x] 🟢 `buildDocxFidelityDiagnostics` 管线集成
- [x] 🟢 Source inventory（StyleFacts + FormatSpec rules inventory）
- [x] 🟢 Exported facts（package structure, text, styles extraction）
- [x] 🟢 保真度诊断测试覆盖

## Slice E2 — Writer Style Mapping

- [x] 🟢 `DocxFormatDimension` 维定义与归一化
- [x] 🟢 `DocxResolvedStylePolicy` 解析
- [x] 🟢 TS adapter 样式驱动渲染
- [x] 🟢 heading3 支持
- [x] 🟢 自动编号意图标记（autoNumberingIntent）
- [ ] ⬜ 编号格式完整覆盖（多级列表、自定义编号）
- [ ] ⬜ 缩进属性完整映射
- [ ] ⬜ 行距多模式支持

## Slice E3a — Executable StyleFacts

- [x] 🟢 StyleFacts → FormatSpec 属性映射（docx-stylefacts-format-attributes）
- [x] 🟢 FormatSpec 可执行属性管线
- [x] 🟢 StyleFacts profile fixtures

## Slice E3b — First Fidelity (Page Setup + Title + Body Font)

- [x] 🟢 页边距/页眉/页脚探针与匹配
- [x] 🟢 样式定义级 spacing 提取（format_probe.rs: spacing field）
- [x] 🟢 标题字体/字号/行距匹配
- [x] 🟢 正文字体方向匹配
- [x] 🟢 保守编号行为保持

## Slice E3c — Paragraph Direct Formatting (🔴 未开始)

计划文件：`openspec/changes/docx-first-formal-export/active/ralplan-slice-e3c-docx-paragraph-direct-formatting.md`
上下文：`openspec/changes/docx-first-formal-export/active/e3c-context.md`
目标：将正文段落行距从 600 → 570 twips（基准文件 85 段使用 570）

- [ ] ⬜ Step 1: Rust probe 扩展，从 `word/document.xml` 提取段落直接格式
- [ ] ⬜ Step 2: StyleFacts schema 增加 paragraph direct formatting 摘要
- [ ] ⬜ Step 3: FormatSpec executable bridge（dominant body spacing → paragraph.body.lineSpacingTwips）
- [ ] ⬜ Step 4: Writer/resolver 消费 paragraph-direct 行距
- [ ] ⬜ Step 5: 保真度诊断扩展（expected/observed bucketInputs）
- [ ] ⬜ Step 6: 回归测试（行距 570，标题仍 579，页边距不变）
- [ ] ⬜ Architect 评审

## Slice D — UI & Productization (Pending)

- [ ] ⬜ Draft 详情页增加"导出 DOCX"按钮
- [ ] ⬜ 导出诊断与审查结果展示
- [ ] ⬜ Fidelity coverage 报告可视化
- [ ] ⬜ 导出记录列表 / 审计入口
