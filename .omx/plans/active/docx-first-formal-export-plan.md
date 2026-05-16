# DOCX-first Formal Export 当前阶段计划

状态：active planning / discussion-aligned draft  
日期：2026-05-14

## 1. 当前阶段目标

本阶段目标不是继续优化 FormatSpec / prompt，而是验证正式文件交付闭环：

```text
底稿 → DOCX 导出 → 导出审查 → 导出记录
```

目标产物是一个可打开、结构正确、基础格式可控、可审计、可复查的 DOCX 文件。第一版不承诺高保真复刻原文件。

## 2. 当前已有基础

上一阶段已经完成并收口：

```text
DraftRecord
→ FormatProfile
→ StyleFacts
→ SemanticOverlay
→ FormatSpec
→ Editable Format Constraints
→ Draft Output Contract
```

这些能力已经可以回答：

- 底稿是什么；
- 来源和引用是什么；
- 格式画像是什么；
- 哪些格式规则可参考；
- 用户能否编辑格式约束；
- 底稿加工输出是否应作为可保存正文，而不是聊天回复。

本阶段要补齐：

- 正式 DOCX 文件生成；
- 导出前后检查；
- 导出记录；
- 失败诊断。

## 3. 为什么 DOCX-first

1. 原始正式材料场景以 DOCX 报告、通知、制度、方案、汇报稿为主。
2. DOCX 最适合验证标题、段落、列表、表格、引用、页边距、字体、字号等正式排版问题。
3. 如果 DOCX 的导出合同、审查机制、审计记录没有跑通，直接扩到 PPTX / XLSX / PDF 会变成四个半成品。
4. 后续 PPTX / XLSX / PDF 可以复用 ExportContract / IntermediateDocument / MatchReview / Audit 的抽象。

## 4. 技术链路

建议链路：

```text
DraftRecord
→ DocxExportContract
→ DocxIntermediateDocument
→ DocxMatchReview
→ DOCXExportAdapter
→ DocxExportRecord / Audit
```

## 5. 核心对象

### 5.1 DocxExportContract

导出合同，回答“这次导出到底按什么做”。

建议包含：

- draftId；
- draftVersion / parentContentHash；
- formatProfileId；
- formatSpecHash；
- 用户导出要求；
- 必须遵守的规则；
- 尽量参考的规则；
- 当前不承诺实现的规则；
- 合同 hash。

### 5.2 DocxIntermediateDocument

中间文档结构。不要直接 `Markdown → DOCX`，而是：

```text
Markdown / Draft content
→ DocxIntermediateDocument
→ DOCX
```

建议表示：

- documentTitle；
- sections；
- paragraphs；
- orderedLists；
- unorderedLists；
- tables；
- citations；
- diagnostics。

价值：

- 可测试；
- 可审查；
- 可复用；
- 以后 PPTX / PDF 也能参考；
- MatchReview 可基于结构判断，而不是只在 Word 文件生成后再猜。

### 5.3 DOCXExportAdapter

实际生成 `.docx` 的确定性 adapter。

第一版倾向 TS/JS adapter 优先，原因：

- 当前 Draft、FormatSpec、Store 都在 TS；
- 单元测试更容易；
- MVP 更快；
- OpenXML SDK sidecar 可作为后续增强或验证参考。

若后续发现 JS docx 方案不足，再评估 OpenXML SDK / sidecar。

### 5.4 DocxMatchReview

导出审查。它不做 pixel-perfect 视觉复刻，而做：

```text
结构完整性 + 格式规则覆盖度 + 诊断边界
```

第一版检查：

- 文件存在；
- 输出非空；
- 中间文档节点数量合理；
- 标题数量与输入一致或有合理解释；
- 引用没有丢；
- 列表没有全部退化成普通段落；
- FormatSpec 中可表达规则有 applied / unsupported / skipped 状态。

### 5.5 DocxExportRecord / Audit

记录每次导出：

- exportId；
- draftId；
- parentContentHash；
- formatProfileId；
- formatSpecHash；
- exportContractHash；
- outputPath；
- createdAt；
- diagnostics；
- matchReview summary。

用户后续应能知道：这份 DOCX 是根据哪个底稿、哪个格式画像、哪个版本导出的。

## 6. LLM 位置

LLM 不直接生成 DOCX，也不直接宣布导出合格。

LLM 可以参与：

- 修订底稿；
- 解释 FormatSpec；
- 帮用户生成更清晰的导出要求；
- 必要时辅助复杂文本拆成结构角色。

但最终：

```text
DOCX 文件生成 = deterministic adapter
导出合格判断 = MatchReview / validator
导出记录 = ExportRecord
```

## 7. MVP 范围

第一版目标：

> 从一个已有 DraftRecord 导出一个可打开、结构正确、带基础格式、带审计记录的 DOCX。

MVP 支持：

- 文档标题；
- 一级/二级标题；
- 正文段落；
- 数字列表；
- 项目符号列表；
- 简单 Markdown 表格；
- 引用文本保留；
- 基础字体字号；
- 页边距；
- 导出记录；
- MatchReview。

## 8. 非目标

第一版不做：

- 高保真复刻；
- pixel-perfect；
- 复杂表格合并单元格；
- 页眉页脚；
- 自动目录；
- 脚注尾注；
- 批注修订；
- 图片；
- 直接从 FormatProfile 生成 Word 模板；
- 外部模板文件套用；
- PPTX / XLSX / PDF 导出；
- LLM 直接写最终 DOCX。

## 9. 关键产品判断

### 9.1 第一版导出目标

结构正确 + 基础正式排版 + 可审计，不承诺高保真复刻。

### 9.2 是否使用模板文件

第一版不使用外部模板文件。先用代码生成基础样式，避免变相恢复手动模板路线。

### 9.3 Adapter 技术路径

第一版 TS/JS adapter 优先，OpenXML SDK / sidecar 作为后续增强或验证参考。

### 9.4 FormatSpec 作用

- 必须读取 FormatSpec；
- 只应用 MVP 可表达的规则；
- 不支持的规则进入 diagnostics；
- 不因为不能完全执行 FormatSpec 就阻止导出；
- MatchReview 必须显示覆盖情况。

## 10. 下一步

进入 ralplan / PRD / Test Spec 设计：

```text
DOCX-first Formal Export PRD
+
DOCX-first Formal Export Test Spec
```

设计通过后再进入实现。实现前需要明确：

1. ExportContract 字段；
2. IntermediateDocument schema；
3. Markdown 到 IntermediateDocument 的解析边界；
4. FormatSpec 可表达规则映射；
5. MatchReview pass/fail/warn 规则；
6. ExportRecord 持久化位置；
7. UI 入口和用户手动测试路径。

## 11. DOCX-first Export Contract Spike 结果（2026-05-14）

实验目录：`experiments/docx-first-export-contract/`

设计产物：

```text
.omx/plans/active/prd-docx-first-export-contract-experiment.md
.omx/plans/active/test-spec-docx-first-export-contract-experiment.md
```

执行命令：

```powershell
node experiments/docx-first-export-contract/scripts/run-docx-first-export-contract.mjs
```

结果：PASS。

关键证据：

- Contract gate PASS：合同包含 draft / profile / FormatSpec / boundary / validation policy 等必需字段，且不含来源全文泄漏字段。
- Intermediate gate PASS：能从 DraftRecord fixture 生成 documentTitle、heading、paragraph、list、table blocks，并携带 FormatSpec ruleRefs。
- DOCX preflight gate PASS：复用现有 `docx-first-structured.docx`，可解包并读取 `word/document.xml`；识别 7 个 zip entries、13 个段落、Heading/TOCHeading 样式引用。
- Review gate PASS：正例为 warn 且无 blocking issue；缺章节、来源泄漏、validation error 负例均 fail；格式覆盖缺失可见。

实验结论：`DocxExportContract + DocxIntermediateDocument + DocxMatchReview` 可以作为 DOCX-first 产品化边界。

下一步：进入 DOCX-first Formal Export PRD / Test Spec 产品化设计，并在下一阶段比较 TS adapter 与 OpenXML sidecar；不要在本实验阶段直接做 UI/store 或最终 adapter。

## 12. DOCX-first Formal Export 产品化设计（2026-05-14）

设计产物：

```text
.omx/plans/active/prd-docx-first-formal-export-productization.md
.omx/plans/active/test-spec-docx-first-formal-export-productization.md
```

产品化切片：

1. Slice A：产品化 `DocxExportContract / DocxIntermediateDocument / DocxMatchReview / DocxExportRecord` 类型、builder、parser、reviewer 和单元测试；不写 DOCX 文件。
2. Slice B：adapter comparison gate，使用同一 IntermediateDocument fixture 比较 TS adapter 与 OpenXML sidecar。
3. Slice C：选择 adapter 后接入 MVP DOCX 写入。
4. Slice D：最后接 UI 入口和手动测试。

实现门禁：必须先完成 Slice A 测试；adapter 未比较前，不直接做 UI/store 和导出按钮。

## 13. Slice A 正式 RALPLAN 执行计划（2026-05-14）

计划文件：

```text
.omx/plans/active/ralplan-docx-export-sliceA-contract-library.md
```

结论：Slice A 只实现 `DocxExportContract / DocxIntermediateDocument / DocxMatchReview / DocxExportRecord` 产品库和测试。

明确不做：adapter、UI、store、Tauri、package dependency、真实 DOCX 写入。

停止条件：Slice A 测试和 typecheck 通过后停止，不自动进入 adapter comparison。


## 14. Slice A product library implemented (2026-05-14)

Implementation scope:

```text
src/lib/docx-export-contract.ts
src/lib/docx-intermediate.ts
src/lib/docx-match-review.ts
src/lib/docx-export-record.ts
src/test-helpers/docx-export-fixtures.ts
```

Added tests:

```text
src/lib/docx-export-contract.test.ts
src/lib/docx-intermediate.test.ts
src/lib/docx-match-review.test.ts
src/lib/docx-export-record.test.ts
```

Result: PASS.

Verification evidence:

```powershell
npx vitest run src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
# 4 test files passed, 12 tests passed

npm run typecheck
# PASS

npm run build
# PASS, with pre-existing Vite dynamic-import/chunk-size warnings only
```

Architect verification: APPROVED after fixing the first review finding. The fixed issue was broad `ruleRefs` matching that could falsely mark section/subsection/list rules as covered by the wrong block role. The product code now uses exact category-style matching and regression tests assert document title, section heading, subsection heading, ordered list, and unordered list rules do not cross-cover.

Boundary preserved: no adapter selected, no DOCX writer implemented, no UI/store/Tauri/package dependency changes, no high-fidelity export promise.

Next step: Slice B adapter comparison can now consume the product `DocxExportContract / DocxIntermediateDocument / DocxMatchReview / DocxExportRecord` boundary. Do not start Slice B without an explicit next-stage plan/update.


## 15. Slice B adapter comparison RALPLAN approved (2026-05-14)

Plan file:

```text
.omx/plans/active/ralplan-docx-export-sliceB-adapter-comparison.md
```

Consensus result: APPROVED after architect revision and critic review.

Purpose: compare TS/JS `docx` adapter and OpenXML SDK sidecar under an experiment-only path, using the same Slice A product boundary:

```text
DocxExportContract
→ DocxIntermediateDocument
→ adapter candidate
→ DocxMatchReview
→ DocxExportRecord
→ redacted comparison report
```

Important constraints:

- Slice B does not choose the final adapter.
- Slice B does not modify UI/store/Tauri/root package/product `src/**` files.
- Any dependency manifests must stay experiment-local under `experiments/docx-adapter-comparison/**`.
- Reports must be redacted: no raw source text, no raw evidence dump, no raw XML snippets, no raw review/record objects.
- Comparison evidence must use assertion IDs, booleans, counts, hashes, issue codes, verdicts, and status summaries.

Next execution target: implement the Slice B experiment harness and comparison reports under `experiments/docx-adapter-comparison/**` only.


## 16. Slice B adapter comparison executed (2026-05-15)

Experiment path:

```text
experiments/docx-adapter-comparison/
```

Executed candidates:

1. `ts-docx` — experiment-local TS/JS adapter using `docx` npm.
2. `openxml-sidecar` — experiment-local .NET OpenXML SDK sidecar.

Commands:

```powershell
npm --prefix experiments/docx-adapter-comparison run compare:ts-docx
npm --prefix experiments/docx-adapter-comparison run compare:openxml
npm --prefix experiments/docx-adapter-comparison run compare
```

Result:

```text
ts-docx: warn, status warning, validation errors 0, warnings 1
openxml-sidecar: warn, status warning, validation errors 0, warnings 1
```

Reports:

```text
experiments/docx-adapter-comparison/reports/ts-docx.json
experiments/docx-adapter-comparison/reports/ts-docx.md
experiments/docx-adapter-comparison/reports/openxml-sidecar.json
experiments/docx-adapter-comparison/reports/openxml-sidecar.md
experiments/docx-adapter-comparison/reports/summary.json
experiments/docx-adapter-comparison/reports/summary.md
```

Important conclusion: Slice B produced comparable redacted evidence but did **not** select a final adapter.

Observed tradeoff:

- `ts-docx` has lower runtime cost and narrower packaging risk, but remains medium packaging/maintenance risk because it would add a product npm dependency if selected later.
- `openxml-sidecar` has lower-level OpenXML control, but packaging/runtime cost is high because it requires sidecar distribution and Tauri integration assessment.

Verification evidence:

```powershell
npm --prefix experiments/docx-adapter-comparison run compare
# both candidates warn; 0 validation errors; 1 known warning each

npx vitest run src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
# 4 files / 12 tests PASS

npm run typecheck
# PASS

npm run build
# PASS, with pre-existing Vite warnings only
```

Architect verification: APPROVED.

Deslop pass: scoped search found no fallback/TODO/workaround/bypass signals in Slice B experiment files; post-deslop compare/tests/typecheck passed.

Boundary preserved:

- no final adapter selected;
- no UI/store/Tauri/product `src/**` changes for Slice B;
- root `package.json` unchanged;
- experiment-local dependencies only under `experiments/docx-adapter-comparison/package.json`;
- reports are redacted and avoid raw XML/source/evidence dumps.

Next step: design Slice C adapter selection and MVP DOCX writing plan using the Slice B report. Slice C may choose one adapter, but only after an explicit plan/decision.

## 17. Slice C adapter selection and MVP DOCX writer executed (2026-05-15)

Plan file:

```text
.omx/plans/ralplan-slice-c-docx-writer.md
```

Decision: selected the root product `docx` npm adapter with stable adapter id `docx-npm.v1` for MVP DOCX generation. `openxml-sidecar` remains rejected for this MVP slice because Slice B showed equal validation status but higher runtime and packaging cost.

Implemented product library modules:

```text
src/lib/docx-ts-adapter.ts
src/lib/docx-package-probe.ts
src/lib/docx-writer.ts
```

Added regression tests:

```text
src/lib/docx-ts-adapter.test.ts
src/lib/docx-package-probe.test.ts
src/lib/docx-writer.test.ts
```

Dependency changes:

```text
package.json
package-lock.json
```

Added runtime dependencies: `docx` and `jszip`.

Verification evidence:

```powershell
npx vitest run src/lib/docx-package-probe.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
# 7 files / 18 tests PASS

npm run typecheck
# PASS

npm run build
# PASS, with pre-existing Vite warnings only
```

Architect verification: APPROVED. No required fixes.

Boundary preserved:

- library-only Slice C; no UI/store/Tauri/save-flow integration;
- browser-safe output bytes (`Uint8Array` from `ArrayBuffer`), no Node `Buffer` product API;
- no `fs`, `path`, `child_process`, Tauri, store, UI, or experiment imports in writer path;
- product DOCX probe derives structural expectations from `DocxIntermediateDocument`, not from a single hard-coded fixture;
- known limits remain warnings: manual Word openability not tested and high-fidelity/style replica not supported;
- validation errors remain blocking and produce failed records.

Next step: Slice D should design and implement UI/store/Tauri save flow integration around `writeDocxExport`, while preserving user-selected file paths and no automatic overwrite.

## 18. Slice D DOCX export UI/save flow executed (2026-05-15)

Plan file:

```text
.omx/plans/active/ralplan-slice-d-docx-export-ui-save-flow.md
```

Purpose: connect the Slice C `writeDocxExport` library writer to a desktop-visible Drafts UI export action with an explicit user-selected `.docx` save path.

Implemented product flow:

1. Drafts view now exposes a `DOCX 导出` action for the selected draft.
2. Export opens the OS save dialog before any write.
3. Cancel writes nothing.
4. The app writes only the exact save-dialog-returned path; non-`.docx` paths are rejected rather than silently modified.
5. Failed DOCX review blocks writing.
6. Warning/pass reviews write binary DOCX bytes; warnings remain visible.
7. Tauri write errors override any previous pass/warn result and show failure.
8. The export button is disabled during an active export.

Implemented files:

```text
src/lib/docx-export-save.ts
src/lib/docx-export-save.test.ts
src/components/drafts/drafts-view.tsx
src/commands/fs.ts
src-tauri/src/commands/fs.rs
src-tauri/src/commands/file_sync.rs
src-tauri/src/lib.rs
src/i18n/en.json
src/i18n/zh.json
```

Key safety decisions:

- DOCX writer is loaded dynamically on export click so the large writer/dependency path is not part of the initial DraftsView runtime path.
- Binary DOCX bytes are converted to base64 with chunked `Uint8Array` handling; no text `write_file` path is used for DOCX bytes.
- Rust decodes base64 before opening or writing the target file; invalid base64 has no file side effect.
- Rust binary write marks `file_sync::mark_app_write_path` before and after write, matching existing app-write watcher-ignore semantics.
- UI copy states that export does not promise high-fidelity visual reproduction.

Verification evidence:

```powershell
npx vitest run src/lib/docx-export-save.test.ts src/lib/docx-package-probe.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-contract.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-match-review.test.ts src/lib/docx-export-record.test.ts src/i18n/i18n-parity.test.ts --reporter=verbose
# 9 files / 30 tests PASS

cargo test --manifest-path src-tauri/Cargo.toml write_binary_file_base64 -- --nocapture
# 3 tests PASS; existing Rust warnings only

cargo check --manifest-path src-tauri/Cargo.toml
# PASS; existing Rust warnings only

npm run build
# PASS, with pre-existing Vite warnings only
```

Architect verification: APPROVED. No required fixes.

Boundary preserved:

- no manual template route restored;
- no high-fidelity or Word-openability promise;
- no automatic overwrite path mutation;
- no automatic source ingest of exported DOCX by design; app-write markers are used for watcher ignore;
- no XLSX/PPTX expansion in this slice.

Stop condition reached: Slice C and Slice D are implemented, tested, architecture-reviewed, and recorded. Next action is human desktop testing.

## 19. Manual desktop DOCX export smoke result and warning cleanup (2026-05-15)

Manual desktop test result reported by user:

```text
DOCX 已导出，但存在提醒
C:\Users\Dante\Desktop\云南省数据流通利用基础设施平台介绍.docx
manual-word-openability-not-tested
high-fidelity-style-replica-not-supported
```

Assessment: pass for the current Slice D MVP boundary.

What this proves:

- The desktop export flow can write a `.docx` file to an explicit user-selected path.
- Previous irrelevant/blocking format-rule coverage failures were resolved.
- Previous duplicate warning diagnostics were resolved.
- Remaining warnings are intentional product boundary notes, not export failures.

Remaining intentional boundaries:

- `manual-word-openability-not-tested`: the app generated the DOCX but has not itself performed manual Word/WPS open validation.
- `high-fidelity-style-replica-not-supported`: current MVP exports a usable DOCX from draft structure and format constraints; it does not promise high-fidelity visual/style replication.

Additional verification after warning cleanup:

```powershell
npx vitest run src/lib/docx-export-save.test.ts src/lib/docx-writer.test.ts --reporter=verbose
# 2 files / 11 tests PASS

npm run typecheck
# PASS

npm run build
# PASS, with pre-existing Vite warnings only
```

Stop condition update: Slice D is manually smoke-tested enough for the current MVP boundary. Next stage should not continue polishing warning copy unless product decision changes the boundary-note UI; move to the next planned stage after user review.

## 20. Slice E1 DOCX high-fidelity baseline diagnostics implemented (2026-05-15)

Plan file:

```text
.omx/plans/active/ralplan-docx-fidelity-e1.md
```

Purpose: start DOCX-first high-fidelity work with measurement, not blind writer tuning.

Implemented E1 product/library boundary:

1. Added a standalone, versioned, JSON-safe DOCX fidelity diagnostics report.
2. Source expectations come from `formatProfileSnapshot.formatSpec.rules` and `FormatSpecRule.attributes`; full `StyleFactsEnvelope` is only an explicit optional input, not assumed to exist on the draft-processing snapshot.
3. Exported DOCX facts are reverse-probed from normalized DOCX package/XML observations, hashes, counts, and codes; raw XML/source body/evidence dumps are not stored.
4. Coverage buckets are `restored`, `partial`, `missing`, and `unverified`.
5. Missing source expectations remain `unverified`, even when exported XML happens to contain structure.
6. Fidelity gaps are non-blocking: they are not merged into adapter validation errors, review blockers, save failures, or UI success/failure state.
7. `writeDocxExport` now returns `fidelityDiagnostics` as an execution artifact for future E2/E3 use.

Implemented files:

```text
src/lib/docx-fidelity-diagnostics.ts
src/lib/docx-fidelity-diagnostics.test.ts
src/lib/docx-writer.ts
src/lib/docx-writer.test.ts
src/lib/docx-export-save.test.ts
```

Verification evidence:

```powershell
npx vitest run src/lib/docx-fidelity-diagnostics.test.ts src/lib/docx-package-probe.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-record.test.ts src/lib/docx-export-save.test.ts --reporter=verbose
# 5 files / 21 tests PASS

npm run typecheck
# PASS

npm run build
# PASS, with pre-existing Vite warnings only
```

Architecture review:

- First review returned ITERATE: exported structures were initially allowed to become restored without source expectations, and the missing bucket lacked a controlled test.
- Fix applied: no-source expectations now stay `unverified`; controlled missing-table test added; unordered-list inference fixed before ordered-list matching.
- Final architect re-review: APPROVE / CLEAR.

Boundary preserved:

- no manual template route;
- no XLSX/PPTX expansion;
- no writer style-mapping changes beyond diagnostics instrumentation;
- no 100% high-fidelity or Word/WPS parity claim;
- existing DOCX export/save semantics remain governed by review verdicts, not fidelity gaps.

Next stage: Slice E2 should use `fidelityDiagnostics.e2PriorityGaps` to choose targeted writer style mapping improvements.



## 21. Slice E2-prep DOCX FormatSpec minimum baseline coverage implemented (2026-05-15)

Plan file:

```text
.omx/plans/active/ralplan-docx-formatspec-baseline-e2prep.md
```

Purpose: before changing DOCX writer style mapping, make generated DOCX FormatSpec constraints at least as detailed as the local formal-writing baseline `行文格式（通用）20210625(1).docx`.

Implemented E2-prep product/library boundary:

1. Added `FormatSpecRule.dimension` as a backward-compatible structured coverage contract.
2. Added `src/lib/docx-formatspec-baseline.ts` with a versioned formal DOCX baseline catalog and coverage audit.
3. Baseline dimensions cover page size, page margins, main title, subtitle/date/speaker lines, multiline title behavior, level-1/2/3 headings, body paragraphs, numbering, table readability, and source-copy boundary.
4. Page margin baseline now keeps dual-source evidence semantics: `detected-layout` from Word XML `sectPr` and `instructional-format-text` from the format-guide body text; conflicts are warnings, not silent value selection.
5. DOCX FormatSpec generation no longer lets accepted LLM overlay replace deterministic DOCX rules. DOCX rules are merged and then baseline-filled.
6. Canonical dimension normalization is conservative and does not count ambiguous `page/title/heading` rules as baseline-covered.
7. `docx-fidelity-diagnostics` now reads `rule.dimension` before legacy inference, preserving old snapshot compatibility.
8. No DOCX writer/export-contract style mapping change was made in this slice; `DocxExportRule.attributes` remains a follow-up for E2 writer tuning.

Implemented files:

```text
src/lib/docx-formatspec-baseline.ts
src/lib/docx-formatspec-baseline.test.ts
src/lib/format-profile-types.ts
src/lib/format-spec.ts
src/lib/format-spec.test.ts
src/lib/docx-fidelity-diagnostics.ts
src/lib/docx-fidelity-diagnostics.test.ts
```

Verification evidence:

```powershell
npx vitest run src/lib/docx-formatspec-baseline.test.ts src/lib/format-spec.test.ts src/lib/docx-fidelity-diagnostics.test.ts --reporter=verbose
# 3 files / 23 tests PASS

npx vitest run src/lib/draft-processing.test.ts src/lib/docx-export-contract.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-save.test.ts src/lib/docx-export-record.test.ts --reporter=verbose
# 5 files / 25 tests PASS

npm run typecheck
# PASS

npm run build
# PASS, with pre-existing Vite warnings only
```

Boundary preserved:

- no manual template route;
- no XLSX/PPTX expansion;
- no automatic user-file overwrite;
- no Word/WPS visual parity claim;
- no writer/export attributes propagation in this slice.

Next stage: Slice E2 should consume the stable FormatSpec dimensions/attributes and implement targeted DOCX writer style mapping for the highest-value dimensions, with fidelity diagnostics proving improvement.

## 2026-05-15 Slice E2 implementation — DOCX structure roles + writer style mapping

Status: implemented / verified / architect-approved

Scope completed:
- Added DOCX FormatSpec style resolver (`src/lib/docx-format-style.ts`) that maps canonical dimensions such as `title.main`, `heading.level1`, `heading.level2`, `paragraph.body`, and `list.numbering` into writer style policy.
- Extended DOCX intermediate blocks with `formatDimensions` and `stylePolicy`, and normalized visual full-width/ideographic indentation at DOCX export boundary only. Stored drafts are not mutated.
- Added conservative bare-list recovery only after colon introductions, with `bare-list-recovered` diagnostics and negative tests for narrative paragraphs.
- Updated DOCX writer to consume style policy for title, heading, paragraph, and list output. XML tests verify spacing, indentation, fonts, numbering, and that different FormatSpec attributes change generated styles XML.
- Extended fidelity diagnostics to evaluate canonical dimensions directly, including title/heading/body/list/table coverage.

Verification evidence:
- `npx vitest run src/lib/docx-intermediate.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-save.test.ts src/lib/docx-fidelity-diagnostics.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` => 8 files / 55 tests PASS.
- `npm run typecheck` => PASS.
- `npm run build` => PASS; only pre-existing Vite chunk/dynamic-import warnings observed.
- Architect review after implementation => APPROVE; no blocking issues.

Boundaries preserved:
- DOCX-first only; no XLSX/PPTX expansion.
- No manual template route restored.
- No UI/store/Tauri changes in this slice.
- No auto-overwrite behavior added.
- No Word/WPS parity claim; diagnostics still report limitations.

Remaining follow-ups:
- Manual desktop Word/WPS visual inspection remains required for user-facing high-fidelity judgment.
- Later slice should address page margin/source-priority conflict and richer visual fidelity diagnostics.

## 2026-05-15 Slice E2b implementation — DOCX inline marker normalization

Status: implemented / verified.

Purpose: fix the manual-export finding that saved DOCX files still contained draft-storage inline markers such as `**...**` and `[[...]]` in Word text.

Scope completed:
- Added DOCX writer inline segmentation at the export adapter boundary.
- `**文本**` is rendered as bold Word runs instead of literal asterisks.
- `[[实体]]` is rendered as plain display text `实体`.
- `[[target|label]]` is rendered as plain display text `label`.
- Title, headings, paragraphs, list items, and table cells now use the same inline rendering path.

Verification evidence:
- `npx vitest run src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-save.test.ts --reporter=verbose` => 3 files / 16 tests PASS.
- `npx vitest run src/lib/docx-intermediate.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-save.test.ts src/lib/docx-fidelity-diagnostics.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` => 8 files / 56 tests PASS.
- `npm run typecheck` => PASS.
- `npm run build` => PASS; only pre-existing Vite dynamic-import/chunk-size warnings observed.

Boundaries preserved:
- Stored draft Markdown/wiki syntax is not mutated.
- No UI/store/Tauri/manual-template/XLSX/PPTX changes in this slice.
- No automatic overwrite behavior added.
- No Word/WPS parity claim; user manual visual inspection remains required.


## 2026-05-15 Slice E3a implementation — DOCX executable StyleFacts attributes

Status: implemented / verified / architect-approved.

Purpose: close the gap where different DOCX format profiles produced nearly identical exported styles because deterministic StyleFacts stayed as passive summaries instead of executable writer hints.

Scope completed:
- Added a DOCX-only StyleFacts-to-FormatSpec bridge for exactly `title.main`, `heading.level1`, and `paragraph.body`.
- The bridge converts deterministic font and font-size facts into limited `FormatSpecRule.attributes` while preserving source font strings at the FormatSpec layer.
- Writer boundary normalization maps common Chinese font variants such as `仿宋_GB2312` to writer-safe families only inside `resolveDocxStylePolicy`.
- `buildFormatSpec` now merges these StyleFacts-backed rules before the DOCX formal baseline, so baseline rules still fill uncovered dimensions.
- Added evidence-boundary hardening: fact-level `evidenceRefs` are filtered against the sanitized evidence catalog, preventing arbitrary/raw strings from reaching FormatSpec or DOCX export contracts.
- No UI/store/Tauri/save-flow changes; no manual-template route; no XLSX/PPTX/PDF scope expansion.

Verification evidence:
- `npx vitest run src/lib/docx-stylefacts-format-attributes.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts src/lib/format-spec.test.ts` => PASS, 4 files / 26 tests.
- `npm run typecheck` => PASS.
- `npm run test:mocks` => PASS, 104 files / 1244 tests.
- `npm run build` => PASS with pre-existing Vite dynamic-import/chunk-size warnings only.
- `npm run test` => mock suite passed, then existing unrelated `src/lib/llm-client.real-llm.test.ts` fake-Ollama Origin/CORS assertions failed; not caused by DOCX E3a.
- Architect review pass 1 found an evidenceRefs boundary gap; implemented filter and poison regression.
- Architect review pass 2 => APPROVED.
- Deslop pass: scoped changed files; no masking fallback or dead/duplicate cleanup required; safe defaults classified as grounded DOCX baseline behavior.

Boundaries preserved:
- StyleFacts `canGuideExport` remains false; E3a only permits covered deterministic fields as limited DOCX writer attributes.
- No Word/WPS visual parity claim is made by this slice.
- No raw evidence values, source text, or unregistered evidenceRefs cross into FormatSpec/prompt/export contract.

Remaining follow-ups:
- Manual desktop Word/WPS visual inspection remains required to judge real-world high fidelity.
- Next DOCX-first work should target the next highest fidelity gap, such as richer page/margin/title layout execution or visual diagnostics against the baseline material.

## 2026-05-15 Implementation Note — FormatSpec 分层修复完成

- 完成旧画像约束去源文污染：legacy generationInstruction 现在使用 FormatSpec promptBlock。
- 完成 DOCX writer 可执行属性扩展：中文字体优先、页面尺寸/页边距、正式标题角色识别。
- 完成边界文案调整：目标是 DOCX 高保真收敛；仅不承诺像素级/渲染器完全等价。
- 验证通过：targeted vitest 69、typecheck、test:mocks 1253、build。

### Fix 2026-05-15 — Accept Markdown-fenced JSON from semantic overlay providers

Decision: semantic overlay parsing now accepts provider output when the only extra wrapper is a Markdown JSON code fence, while keeping the same evidence/schema evaluator.

Why: some model endpoints return valid JSON inside ```json fences despite being instructed to output JSON only. Treating that wrapper as `invalid-json` caused unnecessary fallback to deterministic profiles.

Implemented behavior:
- Added a conservative parser candidate step that strips only full Markdown code-fence decoration or a code-fence prefix around one JSON object.
- Did not parse arbitrary chat prose or relax evidenceRefs/schema/quality checks.
- Strengthened the prompt to explicitly avoid Markdown code fences.

Verification:
- `npx vitest run src/lib/format-profile-semantic-overlay.test.ts` => PASS, 10 tests.
- `npm run typecheck` => PASS.
- `npm run build` => PASS with pre-existing Vite warnings only.

## 2026-05-15 Slice E3b RALPLAN approved — DOCX fidelity first convergence

Status: plan approved / not implemented.

Context:
- Compared `c:\Users\Dante\Desktop\云南省大数据有限公司3.docx` with `d:\llm_wiki\基准素材_复制.docx` using OpenXML inspection.
- Confirmed partial alignment: A4 page size, core page margins, body font/size direction.
- Confirmed gaps: main-title vs Chinese level-1 heading style confusion, over-conversion to Word numbering, 600 vs 570 line spacing, missing header/footer distance consumption.

Approved plan:
- `.omx/plans/ralplan-slice-e3b-docx-first-fidelity.md`

Decision:
- Use the DOCX-first high-fidelity loop: StyleFacts -> FormatSpec -> intermediate roles/intents -> writer mapping -> OpenXML diagnostics.
- Do not use a minimal writer-only patch as the primary approach.
- Do not add template replay, automatic overwrite, XLSX/PPTX expansion, or pixel-perfect Word/WPS claims.

Consensus evidence:
- Planner draft created and revised twice.
- Architect review returned ITERATE; required StyleFacts title/heading deconfliction and conservative numbering intent were added.
- Critic review returned ITERATE; required numbering decision table, StyleFacts field paths, hard boundary gates, and diagnostics schema were added.
- Critic re-review returned APPROVE; no blocker.

Execution stop condition for next phase:
- Implement Slice E3b only after starting an execution lane.
- Must pass targeted E3b tests, `npm run typecheck`, required `npm run test:mocks`, and build if feasible.
- If full mocks are blocked, run the documented minimum boundary test set and report the gap.

## 2026-05-15 Slice E3b implementation — DOCX fidelity first convergence

Status: implemented / verified / architect-approved.

Purpose: close the first measured fidelity gaps against the DOCX baseline path without restoring manual templates or claiming pixel-perfect Word/WPS parity.

Scope completed:
- Intermediate document now separates `documentTitle` from Chinese section headings and records role sources/intents for Markdown headings, plain titles, Chinese headings, visible numbered text, recovered bare lists, paragraphs, and tables.
- Visible numeric/bullet lines are preserved as ordinary paragraph text unless a source FormatSpec rule is explicit (`source !== standard-default` and not baseline-filled); this avoids over-converting formal numbered prose into Word auto-numbering.
- DOCX StyleFacts extraction now carries style line spacing and page header/footer distances through FormatSpec attributes.
- Writer style resolution consumes `lineSpacingTwips`, `headerDistanceTwips`, and `footerDistanceTwips`; DOCX adapter writes exact spacing and section margin header/footer values.
- Fidelity diagnostics now expose paragraph facts, style spacing facts, pgMar facts, and bucketInputs so source-vs-export mismatches are observable instead of inferred from summaries.
- Warning language remains honest: current boundary is “pixel-perfect rendering not claimed”, not “high fidelity unsupported”.

Verification evidence:
- `npx vitest run src/lib/docx-intermediate.test.ts src/lib/docx-format-style.test.ts src/lib/docx-stylefacts-format-attributes.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-fidelity-diagnostics.test.ts` => PASS, 5 files / 39 tests.
- `npx vitest run src/lib/style-facts.test.ts` => PASS, 1 file / 6 tests.
- `npm run typecheck` => PASS.
- `npm run test:mocks` => PASS, 106 files / 1262 tests.
- `cargo check` in `src-tauri` => PASS with existing unrelated Rust warnings.
- `npm run build` => PASS with pre-existing Vite dynamic-import/chunk-size warnings only.
- Architect review => APPROVED; no E3b blockers.

Deslop / cleanup evidence:
- Scoped fallback/TODO/workaround scan over E3b-changed files found only grounded default/fallback helper naming in style normalization and tests; no masking fallback slop requiring edits.
- No new dependency or template replay path added.

Boundaries preserved:
- DOCX-first only; no XLSX/PPTX expansion in this slice.
- Manual input/template route remains abandoned.
- No automatic overwrite behavior added.
- No raw XML/source body/evidence dump stored in diagnostics.
- No claim of 100% high fidelity, pixel-perfect rendering, or Word/WPS parity.

Next step:
- User should run manual desktop export with `基准素材_复制` as the selected format profile and compare the generated DOCX against the baseline. The next engineering slice should be driven by the remaining observed mismatch, not by adding more generic rules.
