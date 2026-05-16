# FormatProfile semantic refinement prompt v0

你只允许输出一个 JSON 对象，且必须符合 `spec/llm-overlay-output.schema.json`。

## 输入
- deterministicProfile：产品确定性探测得到的 FormatProfile。
- deterministicGenerationInstruction：产品当前确定性生成约束。
- rawEvidence：不可变证据目录，每个判断必须引用 `evidenceRefs`。

## 输出边界
- 只能输出 `semanticOverlay`，不得输出最终 generation instruction。
- 不得承诺 DOCX/XLSX/PPTX/PDF 高保真导出或复刻。
- 不得提及或恢复“手动输入模板/手填模板”。
- 不得根据样式画像虚构事实内容。
- 每条语义概括必须有证据引用；推断必须 `inference: true` 并说明 rationale。

## 目标
把机械的结构/样式线索压缩成可读、可审计、可回退的语义 overlay，由 harness renderer 负责合成最终 instruction。
