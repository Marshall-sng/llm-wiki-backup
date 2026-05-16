# PRD: DOCX-first Formal Export Productization

状态：active productization design  
日期：2026-05-14

## 1. Product Objective

将当前“底稿 + 格式画像约束”的能力推进到 DOCX-first 正式导出闭环：

```text
DraftRecord
→ DocxExportContract
→ DocxIntermediateDocument
→ DOCXExportAdapter
→ DocxMatchReview
→ DocxExportRecord / Audit
```

第一版目标是：从一个已有底稿导出一个可打开、结构正确、基础格式可控、带审查和审计记录的 DOCX 文件。

## 2. Current Evidence

前置实验已通过：

```powershell
node experiments/docx-first-export-contract/scripts/run-docx-first-export-contract.mjs
```

实验结论：`DocxExportContract + DocxIntermediateDocument + DocxMatchReview` 可以作为产品化边界。

关键证据：

- Contract gate PASS：合同字段完整，未泄漏来源全文。
- Intermediate gate PASS：可表达 documentTitle、heading、paragraph、list、table，并携带 FormatSpec ruleRefs。
- DOCX preflight gate PASS：既有 DOCX 可解包、可读 document.xml、可识别 heading styles / paragraph count。
- Review gate PASS：缺章节、来源泄漏、validation error 均能 fail；格式覆盖缺失可见。

## 3. Principles

1. **Contract-first**：先稳定导出合同，不把导出逻辑藏在 UI 或 adapter 内。
2. **Intermediate-first**：不直接 `Markdown → DOCX`，先转结构化中间文档。
3. **Review-first**：导出成功必须有 MatchReview，而不是只看文件是否生成。
4. **DOCX-only MVP**：本阶段不做 PPTX / XLSX / PDF 导出。
5. **No high-fidelity promise**：不承诺视觉复刻、pixel-perfect 或原文件精确还原。
6. **No template comeback**：第一版不恢复外部手工模板文件路线。
7. **Deterministic adapter**：最终 DOCX 由确定性 adapter 生成；LLM 不直接写 DOCX，也不直接判定合格。

## 4. Product Scope

### In scope

- `DocxExportContract` 产品类型与 builder。
- `DocxIntermediateDocument` 产品类型与 Draft markdown parser。
- FormatSpec 到 DOCX 可表达规则的映射。
- `DocxMatchReview` 产品类型与 evaluator。
- `DocxExportRecord / Audit` 类型与基础持久化边界。
- Adapter comparison gate：TS adapter vs OpenXML sidecar。
- MVP adapter 选择后的最小 DOCX 写入。
- 诊断：applied / skipped / unsupported / warning / error。

### Out of scope for MVP

- 高保真复刻。
- 外部模板文件套用。
- PPTX / XLSX / PDF 导出。
- LLM 直接生成 DOCX。
- 自动目录最终可用性保证。
- 页眉页脚复杂继承。
- 图片、脚注、尾注、批注、修订痕迹。
- 复杂表格合并单元格。
- LibreOffice/PDF/PNG 视觉渲染比对。

## 5. Core Contracts

### 5.1 DocxExportContract

建议字段：

```ts
interface DocxExportContract {
  contractVersion: 'docx-export-contract.v0'
  exportId: string
  draftId: string
  draftTitle: string
  draftContentHash: string
  formatProfileId?: string
  formatProfileTitle?: string
  formatSpecHash?: string
  sourceProfileHash?: string
  userInstruction?: string
  documentIntent: 'formal-docx-export'
  requiredSections: string[]
  allowedBlocks: DocxBlockType[]
  formatRules: DocxExportRule[]
  contentLeakagePolicy: {
    includeSourceBodyText: false
    includeRawEvidenceDump: false
  }
  exportBoundaries: string[]
  validationPolicy: {
    validationError: 'fail'
    knownWarning: 'warn'
  }
  createdAt: number
  contractHash: string
}
```

原则：合同只放规则、边界、hash 和引用身份，不放来源全文。

### 5.2 DocxIntermediateDocument

建议字段：

```ts
interface DocxIntermediateDocument {
  schemaVersion: 'docx-intermediate-document.v0'
  sourceDraftId: string
  sourceDraftContentHash: string
  blocks: DocxIntermediateBlock[]
  diagnostics: DocxIntermediateDiagnostic[]
  intermediateHash: string
}
```

MVP block：

- `documentTitle`
- `heading`
- `paragraph`
- `list`
- `table`

每个 block 可携带：

- `ruleRefs`
- `sourceLineRange`
- `diagnostics`

### 5.3 DOCXExportAdapter

Adapter 接口：

```ts
interface DOCXExportAdapter {
  adapterId: string
  capabilities: DocxAdapterCapability[]
  export(input: {
    contract: DocxExportContract
    document: DocxIntermediateDocument
    outputPath: string
  }): Promise<DocxAdapterResult>
}
```

MVP adapter 选择仍需比较：

- TS adapter：可能基于 `docx` / 后续 text extraction 工具。
- OpenXML sidecar：可能基于 .NET / OpenXML SDK。

### 5.4 DocxMatchReview

Review 输出：

```ts
interface DocxMatchReview {
  reviewVersion: 'docx-match-review.v0'
  verdict: 'pass' | 'warn' | 'fail'
  blockingIssues: DocxReviewIssue[]
  warnings: DocxReviewIssue[]
  sectionReview: SectionReview
  formatCoverage: FormatCoverageReview
  contentBoundaryReview: ContentBoundaryReview
  docxValidation: DocxValidationReview
  auditRefs: {
    exportContractHash: string
    intermediateHash: string
    formatSpecHash?: string
    sourceProfileHash?: string
  }
}
```

Review 要求：

- 缺少必填章节：fail。
- 来源全文泄漏：fail。
- DOCX validation error：fail。
- known warning：warn。
- should 级格式规则未覆盖：warn。
- must 级格式规则未覆盖：fail。

### 5.5 DocxExportRecord / Audit

记录字段：

```ts
interface DocxExportRecord {
  exportId: string
  draftId: string
  draftTitle: string
  draftContentHash: string
  formatProfileId?: string
  formatSpecHash?: string
  exportContractHash: string
  intermediateHash: string
  outputPath: string
  adapterId: string
  createdAt: number
  reviewVerdict: 'pass' | 'warn' | 'fail'
  diagnostics: DocxReviewIssue[]
}
```

## 6. Adapter Decision Gate

实现产品 adapter 前，必须用同一组 fixture 比较 TS adapter 与 OpenXML sidecar。

比较指标：

- 能否生成可打开 DOCX。
- heading / outline 是否可回读。
- CJK 字体字号是否可控。
- 数字列表 / 项目符号列表是否可控。
- 简单表格是否保留。
- 页边距是否可控。
- 是否能返回 validation / warning / analyze 结果。
- 桌面端打包和运行时成本。
- 许可证和依赖体积。

决策规则：

- 若 TS adapter 能满足 MVP 且打包成本低，优先 TS adapter。
- 若 TS adapter 无法稳定支持 CJK/outline/list/table/page margins，则选 OpenXML sidecar 或保留 sidecar 作为验证器。
- 不允许为了快速 UI 演示绕过 MatchReview / ExportRecord。

## 7. Suggested Implementation Slices

### Slice A — Contract / Intermediate / Review product library

产品化实验中已验证的合同层：

```text
src/lib/docx-export-contract.ts
src/lib/docx-intermediate.ts
src/lib/docx-match-review.ts
src/lib/docx-export-record.ts
```

不写 DOCX 文件，只做类型、builder、parser、reviewer 和测试。

### Slice B — Adapter comparison spike

新增 adapter 比较实验或产品内受控 harness：

```text
experiments/docx-adapter-comparison/
```

比较 TS adapter 与 OpenXML sidecar。

### Slice C — MVP adapter integration

选择 adapter 后，接入最小导出：

```text
DocxIntermediateDocument → output.docx → DocxMatchReview → DocxExportRecord
```

### Slice D — UI entry

最后再接 UI：

- Draft 详情页 / 操作区增加“导出 DOCX”。
- 显示导出诊断与审查结果。
- 不直接覆盖底稿。

## 8. Acceptance Criteria

产品化完成必须满足：

1. 从 DraftRecord 构建稳定 DocxExportContract。
2. Draft markdown 能转成 DocxIntermediateDocument。
3. FormatSpec 可表达规则能进入 ruleRefs / formatCoverage。
4. MatchReview 能区分 pass / warn / fail。
5. 来源正文泄漏、缺章节、validation error 均可 fail。
6. 导出记录包含 draft hash、FormatSpec hash、contract hash、intermediate hash、adapterId 和 review verdict。
7. MVP DOCX 能打开，结构不为空。
8. 不承诺高保真，不恢复手动模板路线。

## 9. Next Step

先实现 Slice A：Contract / Intermediate / Review product library。  
在 Slice A 通过后，再做 adapter comparison gate。
