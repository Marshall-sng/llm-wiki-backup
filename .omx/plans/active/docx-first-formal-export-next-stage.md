# DOCX-first Formal Export 下一阶段活动计划

状态：active / next-stage planning anchor  
日期：2026-05-14

## 当前判断

FormatProfile → StyleFacts → SemanticOverlay → FormatSpec → Editable Format Constraints → Draft Output Contract 的产品化阶段已经提交并收口。当前不再继续在 FormatSpec prompt 阶段追加局部规则。

下一阶段主线切换为：

```text
DOCX-first Formal Export
```

## 为什么切到 DOCX-first

1. 原始正式材料场景以 DOCX 报告、通知、制度、方案、汇报稿为主。
2. DOCX 最适合先验证 Draft version、引用证据、FormatSpec、导出合同、匹配审查和审计闭环。
3. PPTX / XLSX / PDF 暂时保留在导入画像、格式理解和后续 adapter 候选层，不进入下一阶段正式导出主线。

## 下一阶段建议闭环

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

## 首轮设计对象

- `DocxExportContract`：从底稿、引用、FormatSpec、用户导出意图生成稳定导出合同。
- `DocxIntermediateDocument`：中间文档结构，承载标题、段落、列表、表格、引用、页眉页脚候选。
- `DocxMatchReview`：导出前/后检查，判断结构、引用和可表达格式是否满足合同。
- `DocxExportRecord / Audit`：记录导出输入、合同 hash、结果、诊断和边界说明。

## 约束

- 不恢复手动模板库。
- 不让 LLM 修改 StyleFacts / FormatProfile / FormatSpec 的事实层。
- 不默认发送 snippets/fulltext。
- 不承诺 pixel-perfect、高保真视觉复刻或原文件精确还原。
- 第一版只承诺 DOCX，不承诺 PPTX / XLSX / PDF 导出。
- 导出合格性由 MatchReview / validator / audit 判断，不由 LLM 直接判定。

## 参考文件

- `archive/2026-05-requirements-supporting-records/docx-first-export-strategy-shift.md`
- `active/formal-export-reference-findings.md`
- `requirements/migration-decision-log.md`
- `requirements/migration-traceability-matrix.md`
