# Generation Instruction: batch_29_pdf_local_01_platform_intro_0312

## 任务

根据该 PDF 成品判断可解析文本、页面结构和是否适合作为格式参考。

## 模式

已有底稿适配到格式画像。

## 探测摘要

- Profile: profile_batch_29_pdf_local_01_platform_intro_0312
- 文件类型: pdf
- 文档类型推断: 成品参考/宣传介绍
- 画像置信度: medium
- Snapshot: cb31b28a7a67dc9236ba2179a32de8c5624a1c11795136c4ecda60f48c545daa
- 探测摘要: 页对象 15、文本操作符 52、图片 108、字体线索 5

## 临时调整

- experiment: phase2-batch
- formatBoundary: PDF 仅作为成品参考，不承诺高保真还原。

## 写作约束

1. 优先满足用户目标，不把格式说明混入正文。
2. 持续遵守当前 FormatBinding；后续补写、改写和续写均默认继承该绑定。
3. 如果格式画像与用户材料冲突，保留用户事实，并在 diagnostics 中说明冲突。
4. 对 DOCX，优先生成正式文稿结构；对 XLSX，优先生成表格化分析；对 PPTX，优先生成逐页汇报底稿；对 PDF，仅作为参考成品。

## 画像约束

- 将 PDF 作为成品参考，不承诺还原原始版式。
- 页面线索：15 页；文本层线索：52。
- 若 PDF 图片密集或字体线索不足，生成时只参考文体与结构，不复制排版。

## 能力边界

- [info] probe.completed: Phase 2 已完成 PDF 基础探测：页对象 15、文本操作符 52、图片 108、字体线索 5。
- [info] format.pdf.text_layer_diagnostic: PDF 有文本层或字体线索，可作为中低置信度参考成品。
- [info] binding.adaptation_mode: 该 case 验证已有底稿适配格式画像，需要记录结构冲突和改写边界。
