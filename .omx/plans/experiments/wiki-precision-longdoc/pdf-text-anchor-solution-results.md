# Phase 1C PDF text-span / line anchor 方案实验结果

## 结论

- evidence：PDF.js 可以在 S003 / S004 / S036 / S001 上加载 PDF，并生成 text item 与 line anchor。
- evidence：每个 text item 均带有 transform、width、height、fontName 等可形成坐标型 selector 的字段。
- evidence：Phase 1B 中用启发式标记为 `insufficient-extraction` 的 S036 / S001，在 PDF.js 下实际可以抽取文本；这说明 PDF 抽取质量不能只靠原始 PDF 流启发式判断。
- inference：PDF.js 可作为当前 TypeScript/Tauri 架构的 PDF 主抽取方案候选。
- inference：PDF 的第一阶段生产能力应定义为 `page + text_item + line anchor + extraction_quality`，而不是直接承诺语义段落或表格恢复。
- unknown：复杂表格、跨栏阅读顺序、页眉页脚清理仍需后续质量评估；OCR 继续不纳入。

## 环境

- pdfjs-dist：5.7.284
- 依赖安装位置：`.tools/pdfjs-eval/`，未修改根目录 `package.json`。

## 样本结果

| 样本 | 状态 | 页数 | 已处理页 | 有文本页 | text items | chars | line anchors | errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| S003 | passed | 14 | 14 | 14 | 552 | 7122 | 292 | 0 |
| S004 | passed | 20 | 20 | 20 | 691 | 9770 | 442 | 0 |
| S036 | passed | 54 | 54 | 54 | 10359 | 40665 | 1959 | 0 |
| S001 | passed | 113 | 113 | 113 | 10800 | 146833 | 4220 | 0 |

## 推荐方案

推荐以 PDF.js 为当前项目的 PDF 文本抽取主路线：

```text
PDF
→ pdf.page anchor
→ pdf.text_item anchor
→ pdf.line anchor
→ extraction_quality summary
→ EvidencePacket / Retrieval / WikiCandidate
```

理由：

1. 与当前 TypeScript/Tauri 路线兼容度最高。
2. 本轮样本能生成可定位 text item 和 line anchor。
3. 不需要引入 Python runtime 或 native binary。
4. 可把失败、低文本页、低覆盖率转成 review item。

## 对 Phase 1B 判断的修正

Phase 1B 的 PDF 诊断是启发式的，只能证明“不能静默相信 PDF 已完整抽取”，不能证明某个 PDF 真的不可抽取。

本轮实验修正了两个判断：

- S036 `数据要素流通标准化白皮书`：从 `insufficient-extraction` 修正为 PDF.js 可抽取，54 页、40665 字符、1959 个 line anchors。
- S001 `易经杂说`：从 `insufficient-extraction` 修正为 PDF.js 可抽取，113 页、146833 字符、4220 个 line anchors。

因此正式路线中应把 PDF 质量判断建立在真实抽取器结果上，而不是只基于 PDF 内部流/操作符启发式。

## 需要保留的风险

- PDF.js 抽出的 line anchor 是版面启发式合并，不等价于语义段落。
- 对复杂多栏、表格、页眉页脚，仍需要 ReadingOrder / BlockMerge / HeaderFooterFilter。
- 对 extraction_quality 低的 PDF，应进入 `partial / needs-review`，不能静默进入 Wiki。
- PyMuPDF/pdfplumber 可作为后续质量对照，但不建议作为当前主线首选，除非 PDF.js 在真实材料上暴露严重质量问题。

## 下一步最小闭环

1. 把 PDF.js 输出收敛成 `PdfEvidenceAnchor` TypeScript schema。
2. 选 S003 或 S004 做 `query → line anchor → answer citation` 精准检索实验。
3. 设计 extraction quality 门禁：低字符页、加载失败、页数不一致、line 合并异常。
4. 后续再决定是否引入 PyMuPDF/pdfplumber 作为验证器，而不是主链路。
