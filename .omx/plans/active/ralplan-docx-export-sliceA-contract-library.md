# RALPLAN: DOCX-first Export Slice A — Contract / Intermediate / Review / Record Library

状态：approved planning baseline / ready for implementation  
日期：2026-05-14

## 1. Goal

实现 DOCX-first Formal Export 的 Slice A 产品库，不写 DOCX 文件，不做 adapter 对比，不做 UI。

目标链路：

```text
DraftRecord + FormatSpec snapshot
→ DocxExportContract
→ DocxIntermediateDocument
→ DocxMatchReview
→ DocxExportRecord
```

## 2. RALPLAN-DR Summary

### Principles

1. **Contract-first**：导出前必须有明确合同，记录底稿、格式画像、FormatSpec、边界和 validation policy。
2. **Intermediate-first**：Draft markdown 先转结构化中间文档，不直接进入 DOCX adapter。
3. **Review-first**：导出成功必须以后续 MatchReview 为准，Slice A 先实现 review 规则。
4. **Evidence boundary**：不得把来源全文、raw evidence dump 或未授权 snippets 放入导出合同。
5. **No adapter yet**：本阶段不选择 TS adapter 或 OpenXML sidecar。

### Decision Drivers

1. **安全性**：防止出现“导出按钮存在但没有审计”的伪完成。
2. **可测试性**：合同、中间结构、审查、记录都必须能单元测试。
3. **可替换性**：后续 adapter 选择不应反向污染合同层。

### Viable Options

#### Option A — 先实现纯库层（推荐）

范围：`src/lib/docx-export-contract.ts`、`docx-intermediate.ts`、`docx-match-review.ts`、`docx-export-record.ts` 与对应测试。

优点：最小、可测试、不会引入 adapter/依赖/UI 风险。  
缺点：本阶段不会生成真实 DOCX。

#### Option B — 纯库层 + 最小假 adapter

优点：能模拟完整链路。  
缺点：容易让假 adapter 被误认为真实导出能力，违背当前阶段边界。

#### Option C — 直接进入 adapter

优点：更快看到文件。  
缺点：绕过 contract/review gate，重现 fake export button 风险。

### Recommendation

选择 Option A。

## 3. ADR

### Decision

Slice A 只实现产品库层：

```text
DocxExportContract
DocxIntermediateDocument
DocxMatchReview
DocxExportRecord
```

### Why

前置实验已经证明该边界可产品化，但还未证明 adapter 选型。先把边界固化成产品代码和测试，可以让后续 TS/OpenXML adapter 都遵循相同合同。

### Alternatives considered

- 直接做 adapter：拒绝，因为缺少 MatchReview / ExportRecord 会导致不可审计导出。
- 直接做 UI：拒绝，因为没有 adapter 和 review 之前 UI 只能制造伪完成。
- 恢复模板文件路线：拒绝，因为当前阶段已明确放弃手动模板。

### Consequences

- 本阶段结束后仍不会生成 DOCX。
- 后续 Slice B 可以用同一套 contract/intermediate/review 测试 adapter。
- 产品代码会新增 docx export domain types，但不引入新 npm 依赖。

## 4. Implementation Scope

### Files to add

```text
src/lib/docx-export-contract.ts
src/lib/docx-export-contract.test.ts
src/lib/docx-intermediate.ts
src/lib/docx-intermediate.test.ts
src/lib/docx-match-review.ts
src/lib/docx-match-review.test.ts
src/lib/docx-export-record.ts
src/lib/docx-export-record.test.ts
```

### Files to avoid

本阶段不修改：

```text
src/components/**
src/stores/**
src-tauri/**
package.json
```

除非测试发现必须补类型导出，但默认不需要。

## 5. Contract Requirements

`DocxExportContract` builder 必须：

- 接收 DraftRecord-like input。
- 接收可选 FormatSpec snapshot-like input。
- 生成稳定 `contractHash`。
- 包含 draft id/title/content hash。
- 包含 formatProfileId / formatSpecHash / sourceProfileHash（如存在）。
- 包含 formatRules。
- 包含 contentLeakagePolicy。
- 包含 exportBoundaries。
- 禁止 rawSourceText / sourceBodyText / fullText / rawEvidenceDump。

## 6. Intermediate Requirements

`DocxIntermediateDocument` parser 必须支持：

- `# 主标题` → documentTitle。
- `一、标题` → heading level 1。
- `（一）标题` → heading level 2。
- 普通段落 → paragraph。
- 数字列表 → ordered list。
- `-` / `*` → unordered list。
- Markdown table → table。
- block 顺序稳定。
- 可根据 FormatSpec rule target 附加 ruleRefs。

## 7. MatchReview Requirements

`DocxMatchReview` 必须支持：

- `pass | warn | fail`。
- 缺 required section：fail。
- must rule uncovered：fail。
- should rule uncovered：warn。
- source leakage：fail。
- validation error：fail。
- known validation warning：warn。
- 输出 sectionReview / formatCoverage / contentBoundaryReview / docxValidation / auditRefs。

## 8. ExportRecord Requirements

`DocxExportRecord` builder 必须：

- 接收 contract、intermediate、adapter result-like object、review。
- 记录 exportId、draftId、draftContentHash、formatSpecHash、contractHash、intermediateHash、adapterId、outputPath、reviewVerdict。
- fail review 不能被记录为 success。
- 支持序列化。

## 9. Test Plan

运行：

```powershell
npx vitest run src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
npm run typecheck
```

如改动影响公共类型，再运行：

```powershell
npm run test:mocks
npm run build
```

## 10. Acceptance Criteria

- 四个新增测试文件通过。
- `npm run typecheck` 通过。
- 不新增 npm 依赖。
- 不修改 UI/store/Tauri。
- 没有任何“已导出 DOCX”的产品声明。
- 代码边界可供 Slice B adapter comparison 复用。

## 11. Stop Condition

当 Slice A 产品库和测试通过后停止，不继续自动进入 adapter comparison，除非用户明确要求进入 Slice B。
