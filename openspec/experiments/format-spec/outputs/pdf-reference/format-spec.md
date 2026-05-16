# FormatSpec：pdf-reference

- 文件类型：PDF
- 文档定位：成品参考/宣传介绍
- 置信度：medium

## 全局边界
- 来源事实优先于格式约束；不得根据格式画像虚构组织、金额、条款、结论或引用。
- FormatSpec 只约束结构、表达、排版和诊断，不承诺导出文件。
- FormatSpec 不承诺视觉还原；证据不足的字段必须降级为建议或诊断。
- 默认数据范围为 evidence-only；draft prompt 不展示 raw evidence 正文或证据转储。

## 详细格式规则
### pdf-page-1 / page
- 规则：PDF 以页为参考单位。
- 细节：检测到页数 15；可参考篇幅和页面密度，但不反推完整可编辑模板。
- 来源：detected；置信度：medium
- 证据：raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001

### pdf-text-layer-1 / text-layer
- 规则：文本层线索决定可参考程度。
- 细节：文本层提示：存在；文本层不足时只做低置信参考。
- 来源：detected；置信度：medium
- 证据：raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001

### pdf-image-density-1 / image-density
- 规则：图片密度只作为版面复杂度诊断。
- 细节：图片较多时，生成底稿应保持图文分区建议，不补造图片内容或位置。
- 来源：inferred；置信度：medium
- 证据：raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001

### pdf-font-ref-1 / font-ref
- 规则：字体引用不是可编辑字体承诺。
- 细节：字体引用线索：YWSWBG+MicrosoftYaHei-Bold、UDUJXM+SegoeUI-Bold、YMVEVT+MicrosoftYaHei、LNUHNF+SimSun、VULAQV+SegoeUI；这些是 PDF 资源名，只能用于诊断。
- 来源：detected；置信度：medium
- 证据：raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001

### pdf-scan-risk-1 / scan-risk
- 规则：扫描风险影响置信度。
- 细节：扫描风险：未明显触发；扫描风险高时不得输出细排版规则。
- 来源：detected；置信度：medium
- 证据：raw.pdf.fact.pageCount, raw.pdf.fact.textOperatorCount, raw.pdf.fact.imageCount, raw.pdf.fact.scanLikely, profile.style.0001

### pdf-reference-1 / reference-use
- 规则：PDF 适合作为成品参考。
- 细节：可参考页数、栏目密度、图文比例、正式程度；不把 PDF 当作可直接套用模板。
- 来源：standard-default；置信度：medium

### pdf-boundary-1 / boundary
- 规则：PDF 画像不承诺视觉还原。
- 细节：不能承诺跨页布局、图像位置、页眉页脚、印章、水印或装订效果。
- 来源：standard-default；置信度：high

### pdf-boundary-2 / boundary
- 规则：PDF 不产生来源事实。
- 细节：任何正文、数据、引用和结论必须来自用户底稿或授权资料，不从字体/页面线索推断。
- 来源：standard-default；置信度：high
