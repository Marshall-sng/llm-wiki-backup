# DOCX-first Formal Export — 技术方案

## 架构

```
DraftRecord
  ↓
DocxExportContract          ← buildDocxExportContract()
  ↓
DocxIntermediateDocument    ← buildDocxIntermediateDocument()
  ├── blocks (title/heading/paragraph/list/table)
  ├── stylePolicy (resolved from FormatSpec + StyleFacts)
  └── formatDimensions
  ↓
DOCXExportAdapter            ← renderDocxWithTsAdapter()
  ├── docx npm package
  ├── inline **bold** parsing (parseDocxInlineSegments)
  └── style-driven formatting (DocxResolvedTextStyle)
  ↓
DocxPackageProbe             ← probeDocxPackage()
  ↓
DocxFidelityDiagnostics      ← buildDocxFidelityDiagnostics()
  ├── source inventory (StyleFacts + FormatSpec rules)
  ├── exported facts (package structure, text, styles)
  └── bucket: restored / partial / missing / unverified
  ↓
DocxMatchReview              ← reviewDocxExport()
  └── verdict: pass / warn / fail
  ↓
DocxExportRecord             ← buildDocxExportRecord()
```

## 核心模块

| 模块 | 文件 | 状态 |
|------|------|------|
| DocxExportContract | `src/lib/docx-export-contract.ts` | ✅ 已产品化 |
| DocxIntermediateDocument | `src/lib/docx-intermediate.ts` | ✅ 已产品化，v2 增强 |
| DocxMatchReview | `src/lib/docx-match-review.ts` | ✅ 已产品化 |
| DocxExportRecord | `src/lib/docx-export-record.ts` | ✅ 已产品化 |
| DocxTsAdapter | `src/lib/docx-ts-adapter.ts` | ✅ 已产品化，v2 增强 |
| DocxWriter | `src/lib/docx-writer.ts` | ✅ 已集成 |
| DocxPackageProbe | `src/lib/docx-package-probe.ts` | ✅ 已产品化 |
| DocxFidelityDiagnostics | `src/lib/docx-fidelity-diagnostics.ts` | ✅ 新建 |
| DocxFormatStyle | `src/lib/docx-format-style.ts` | ✅ 新建 |
| DocxFormatSpecBaseline | `src/lib/docx-formatspec-baseline.ts` | ✅ 新建 |
| DocxStyleFactsFormatAttributes | `src/lib/docx-stylefacts-format-attributes.ts` | ✅ 新建 |
| FormatSpec | `src/lib/format-spec.ts` | ✅ 维度映射增强 |
| FormatProfile | `src/lib/format-profile.ts` | ✅ generator 重构 |

## 关键决策

1. **Contract-first**：导出逻辑不藏在 UI 或 adapter 内，由合同定义"这次导出按什么做"。
2. **Intermediate-first**：不直接从 Markdown 到 DOCX，先转结构化的中间文档。
3. **Review-first**：导出成功必须有 MatchReview，不看文件是否生成。
4. **Deterministic adapter**：DOCX 由 TS adapter（`docx` npm 包）确定性生成，LLM 不直接写 DOCX。
5. **高保真诊断**：fidelity diagnostics 作为非阻塞报告，不阻断导出成功（E1 阶段）。
6. **DOCX-only**：本阶段只做 DOCX，不扩到 PPTX/XLSX/PDF。

## 后续阶段

- **E2**：Writer 样式映射增强（标题、编号、缩进、行距、表格）
- **E3**：UI 产品化（用户可读的保真度覆盖率报告、导出记录可视化）
