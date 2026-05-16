# DOCX-first Formal Export

## 为什么

原始正式材料场景（报告、通知、制度、方案、汇报稿）以 DOCX 为主。现有格式画像（FormatProfile → FormatSpec）和底稿能力已经产品化，但缺少从底稿到正式 DOCX 文件的闭环。

当前阶段目标：实现一个可打开、结构正确、基础格式可控、带审查和审计记录的 DOCX 导出管线。

## 范围

### In scope

- `DocxExportContract`：导出合同，定义"这次导出按什么做"
- `DocxIntermediateDocument`：中间文档，将底稿解析为结构化 block 序列
- `DocxMatchReview`：导出审查，判断结构/引用/格式规则是否满足合同
- `DocxExportRecord / Audit`：导出记录，保存每次导出的输入 hash、合同、审查结论
- `DOCXExportAdapter`：确定性 adapter 生成 DOCX 文件
- `DocxFidelityDiagnostics`：保真度诊断，评估导出与来源样式事实的差距
- 格式样式策略（DocxFormatDimension / DocxResolvedStylePolicy）
- FormatSpec 维归一化与 DOCX 可表达规则映射

### Out of scope

- 高保真复刻（E2+ 阶段）
- PPTX / XLSX / PDF 导出
- 外部手动模板文件
- LLM 直接生成或判定 DOCX
- 页眉页脚、图片、脚注、尾注、批注、修订痕迹
- 复杂表格合并单元格

## 验收标准

1. 从 `DraftRecord` 构建稳定 `DocxExportContract`
2. Draft markdown 可解析为 `DocxIntermediateDocument`（含 title/heading/paragraph/list/table block 类型）
3. FormatSpec 规则可进入 ruleRefs / formatDimensions
4. `DocxMatchReview` 可区分 pass / warn / fail
5. 来源泄漏、缺章节、validation error 均可 fail
6. 导出记录包含 draft hash、FormatSpec hash、contract hash、intermediate hash、adapterId、review verdict
7. MVP DOCX 可打开，结构不为空，heading / 正文 / 列表 / 表格可见
8. 保真度诊断报告可输出 restored / partial / missing / unverified 分类
9. 不承诺高保真复刻，不恢复手动模板路线
