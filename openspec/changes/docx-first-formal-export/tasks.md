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

## Slice D — UI & Productization (Pending)

- [ ] ⬜ Draft 详情页增加"导出 DOCX"按钮
- [ ] ⬜ 导出诊断与审查结果展示
- [ ] ⬜ Fidelity coverage 报告可视化
- [ ] ⬜ 导出记录列表 / 审计入口
- [ ] ⬜ E2 writer 样式映射增强（编号、缩进、行距全面覆盖）
- [ ] ⬜ E3 保真度报告产品化
