# Test Spec: DOCX-first Formal Export Productization

状态：active productization test spec  
日期：2026-05-14

## 1. Test Objective

验证 DOCX-first Formal Export 产品化是否具备稳定合同、中间文档、审查和审计边界。测试先覆盖 Slice A，再进入 adapter comparison 和 MVP adapter。

## 2. Slice A — Contract / Intermediate / Review Library

### 2.1 Contract builder tests

目标文件建议：

```text
src/lib/docx-export-contract.test.ts
```

测试项：

- 从 DraftRecord + FormatSpec snapshot 构建 `DocxExportContract`。
- contract 包含 draftId、draftContentHash、formatSpecHash、sourceProfileHash、formatRules、contentLeakagePolicy、validationPolicy。
- contractHash 稳定且随输入变化。
- 不包含 rawSourceText / sourceBodyText / fullText / rawEvidenceDump。
- 用户导出要求进入 userInstruction，但不得覆盖 evidence-only 边界。

### 2.2 Intermediate parser tests

目标文件建议：

```text
src/lib/docx-intermediate.test.ts
```

测试项：

- `# 主标题` → documentTitle。
- `一、标题` → level 1 heading。
- `（一）标题` → level 2 heading。
- 普通段落 → paragraph。
- `1. 2. 3.` → ordered list。
- `- item` → unordered list。
- Markdown table → table block。
- block 顺序稳定。
- blocks 可携带 FormatSpec ruleRefs。
- parser 不引入来源全文以外的新事实。

### 2.3 MatchReview tests

目标文件建议：

```text
src/lib/docx-match-review.test.ts
```

测试项：

- 正例：verdict 为 pass 或 warn，blockingIssues 为空。
- 缺少 required section：fail。
- must rule uncovered：fail。
- should rule uncovered：warn。
- source leakage detected：fail。
- validation error：fail。
- known warning：warn。
- review 输出 auditRefs。

### 2.4 ExportRecord tests

目标文件建议：

```text
src/lib/docx-export-record.test.ts
```

测试项：

- 从 contract + intermediate + adapter result + review 生成 ExportRecord。
- 记录 exportId、draftId、draftContentHash、formatSpecHash、contractHash、intermediateHash、adapterId、outputPath、reviewVerdict。
- fail review 不能被记录为 success。

## 3. Slice B — Adapter Comparison Gate

### 3.1 Shared fixture

使用同一份 IntermediateDocument fixture，覆盖：

- documentTitle；
- heading level 1 / 2；
- paragraph；
- ordered list；
- unordered list；
- simple table；
- references/citation text。

### 3.2 TS adapter candidate

若引入 `docx` / extraction 工具，需测试：

- 可生成 openable DOCX。
- ZIP 可解包。
- `word/document.xml` 存在。
- heading style 可识别。
- paragraph count > 0。
- list/table 可在 XML 中定位。
- CJK 字体字号可设置或明确 unsupported。

### 3.3 OpenXML sidecar candidate

若使用 OpenXML sidecar，需测试：

- sidecar 可在桌面环境启动。
- 不依赖用户手动配置不稳定 runtime。
- 可生成 / validate / analyze / diff。
- warnings 可结构化返回。
- 打包成本和失败诊断可接受。

### 3.4 Adapter decision report

必须输出：

```text
adapterId
capabilities
unsupportedCapabilities
validationResult
packagingRisk
licenseRisk
recommendation
```

## 4. Slice C — MVP Adapter Integration

通过 adapter gate 后测试：

- `DocxIntermediateDocument → output.docx`。
- outputPath 存在且非空。
- MatchReview 绑定 adapter result。
- ExportRecord 持久化或至少可序列化。
- 导出失败时返回 diagnostics，不伪装成功。

## 5. UI / Manual Smoke（最后执行）

手动测试路径：

1. 打开已有底稿。
2. 选择或不选择 FormatProfile。
3. 点击导出 DOCX。
4. 选择保存路径。
5. 查看导出审查结果。
6. 打开 DOCX 文件。
7. 核对标题、段落、列表、表格、引用是否存在。
8. 核对 diagnostics 是否说明 unsupported rules。

## 6. Verification Commands

Slice A：

```powershell
npx vitest run src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
npm run typecheck
```

Full product checkpoint：

```powershell
npm run test:mocks
npm run build
```

## 7. Pass / Fail Criteria

### Pass

- Contract / Intermediate / Review / Record tests pass。
- Source leakage tests fail as expected。
- Required section and validation error fail as expected。
- FormatSpec coverage visible。
- Adapter decision documented before UI integration。

### Fail

- Export can succeed without MatchReview。
- Export can succeed while source leakage exists。
- Adapter writes DOCX but cannot provide usable diagnostics。
- UI exposes “导出成功” without ExportRecord / review verdict。
- Implementation reintroduces manual template library as v1 requirement。
