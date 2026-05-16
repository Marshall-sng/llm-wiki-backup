# Test Spec: DOCX-first Export Contract Spike

状态：active experiment test spec  
日期：2026-05-14

## Command

```powershell
node experiments/docx-first-export-contract/scripts/run-docx-first-export-contract.mjs
```

## Pass Gates

### Contract Gate

- Contract 包含 `contractVersion`、`draftId`、`draftContentHash`、`formatSpecHash`、`sourceProfileHash`、`formatRules`、`contentLeakagePolicy`、`exportBoundaries`、`validationPolicy`。
- Contract 不包含 `rawSourceText` / `sourceBodyText` / `fullText` 等来源全文泄漏字段。
- FormatSpec rule id 能进入 contract。

### Intermediate Gate

- 能从 DraftRecord fixture 生成 `DocxIntermediateDocument`。
- 至少包含 documentTitle、heading、paragraph、list、table block。
- block 顺序稳定。
- heading/list/table 至少能关联 ruleRefs。

### DOCX Preflight Gate

- 复用已有 `experiments/docx-export/docx-first-structured.docx`。
- 能确认 DOCX 文件存在、非空、可解包、包含 `word/document.xml`。
- 能提取 heading style refs / paragraph count / zip entries。
- validation warning 进入 review，不被吞掉。

### Review Gate

- 正例 verdict 允许 `pass` 或 `warn`，但 blockingIssues 必须为空。
- 缺少必填章节负例必须 fail。
- FormatSpec 关键规则未覆盖必须 warn 或 fail。
- 来源正文泄漏负例必须 fail。
- DOCX validation error 负例必须 fail。

## Fail Gates

- 必须让 LLM 直接写 DOCX 才能完成实验。
- Review 只能检查文件存在，不能解释结构/规则/边界。
- Contract 被具体 adapter 私有字段污染。
- 无法阻断来源正文泄漏。

## Success Meaning

通过表示可以进入 DOCX-first 产品化设计；不表示已经完成产品导出、不表示高保真、不表示 adapter 已最终选型。
