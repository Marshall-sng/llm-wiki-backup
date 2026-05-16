# PRD: DOCX-first Export Contract Spike

状态：active experiment design  
日期：2026-05-14

## Objective

验证 DOCX-first 正式导出是否应以以下产品边界进入下一阶段：

```text
DraftRecord + FormatSpec
→ DocxExportContract
→ DocxIntermediateDocument
→ DOCX preflight evidence
→ DocxMatchReview
```

本实验只判断合同/中间结构/审查闭环是否成立，不实现 UI、store、产品导出按钮或最终 adapter。

## RALPLAN-DR Summary

### Principles

1. Contract-first：先验证导出合同和审查边界，不先绑定最终 adapter。
2. DOCX-only：本实验不做 PPTX / XLSX / PDF。
3. Deterministic boundary：LLM 不直接写 DOCX，也不直接判定成功。
4. Review-first：成功不是“生成文件”，而是能解释结构、格式覆盖、边界和 validation 结果。
5. No new dependency：第一轮不安装 `docx` / `mammoth`，复用已有 OpenXML preflight 证据。

### Decision Drivers

1. 能否把 DraftRecord 与 FormatSpec 稳定收敛成可审计合同。
2. 能否把 Markdown/Draft 内容映射为最小 DocxIntermediateDocument。
3. 能否用 DocxMatchReview 阻断缺章节、格式规则未覆盖、来源正文泄漏和 DOCX validation error。

### Selected Option

选择 **Option A: Contract-only + OpenXML preflight reuse**。

理由：最窄、最快、风险最小；不被 adapter 选型和新增依赖绑架；能回答是否进入产品化设计。

## In Scope

- 实验级 `DocxExportContract`。
- 实验级 `DocxIntermediateDocument` block schema。
- 从 fixture DraftRecord 解析标题、段落、列表、简单 Markdown 表格。
- 将 FormatSpec rules 映射到合同和 block ruleRefs。
- 复用 `experiments/docx-export/docx-first-structured.docx` 做 DOCX preflight evidence。
- 生成 `DocxMatchReview` 正例与负例结果。

## Out of Scope

- UI / store / Tauri command 产品集成。
- 新增 npm 依赖。
- 高保真复刻、模板文件、复杂表格、图片、页眉页脚实现。
- 多格式导出。
- LLM 直接生成 `.docx`。

## Outputs

```text
experiments/docx-first-export-contract/outputs/latest/export-contract.json
experiments/docx-first-export-contract/outputs/latest/docx-intermediate.json
experiments/docx-first-export-contract/outputs/latest/match-review.json
experiments/docx-first-export-contract/outputs/latest/summary.json
experiments/docx-first-export-contract/outputs/latest/summary.md
```

## Productization Decision

实验通过后，下一步进入 DOCX-first Formal Export PRD/Test Spec 产品化设计；但 adapter 选型仍可在下一阶段比较 TS adapter 与 OpenXML sidecar。
