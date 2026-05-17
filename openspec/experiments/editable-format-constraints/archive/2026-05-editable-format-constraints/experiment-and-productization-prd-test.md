# Editable Format Constraints — 实验 / 产品化 PRD / 测试合并归档

归档说明：可编辑 FormatSpec 约束已产品化；实验与产品化规格合并保存。


---

## 原文件：`prd-editable-format-constraints-experiment.md`


# PRD: Editable Format Constraints Experiment

日期：2026-05-14

## 目标

验证格式约束从 strict overlay 转为 evidence-based、LLM 可合理推理、用户可编辑采用的产品合同是否成立。

## 用户目的

用户不是要更复杂的 schema，而是要更快获得类似 GB/T 9704-2012 那样细粒度、可执行、可修改的格式约束，用于底稿加工。

## 范围

- 复用现有四格式 FormatRuleSpec 实验输出作为 LLM 推理草案。
- 构造 Editable Format Constraint Spec：自动草案、用户编辑、最终启用规则分离。
- 验证软字段容错：缺 `source`、未知 `source` 不导致整体拒绝。
- 验证硬门禁：未知 evidenceRef、rawText/fulltext/snippets/sourceContext、导出/复刻承诺仍拒绝。

## 非目标

- 不生成 DOCX/XLSX/PPTX/PDF 成品。
- 不承诺视觉还原或高保真复刻。
- 不默认发送 snippets/fulltext。
- 不让 LLM 修改 StyleFacts 事实层。

## 对照组

1. 当前确定性 FormatSpec：作为保底规则数量和边界基线。
2. 已有真实 LLM FormatRuleSpec：作为可推理草案来源。
3. Editable Format Constraint：在草案基础上加入用户编辑覆盖与启用版本。

## 通过标准

- 四格式自动草案均能归一为 editable spec。
- 缺 `source` 和未知 `source` 均 accepted with warnings，并归为 `inferred`。
- 用户编辑后的规则优先于自动草案进入 prompt block。
- 负例 unknown evidenceRef / forbidden raw text / fidelity promise 均 rejected。
- 报告记录 baseline、auto、edited 三组指标。


---

## 原文件：`test-spec-editable-format-constraints-experiment.md`


# Test Spec: Editable Format Constraints Experiment

日期：2026-05-14

## 测试项

1. `auto`：读取 real-llm FormatRuleSpec，生成 editable draft。
2. `missing-source`：移除所有 rules.source，系统补 `inferred`，状态 accepted，带 warnings。
3. `unknown-source`：注入未知 source，状态 accepted，归一为 `inferred`，带 warnings。
4. `edited`：应用用户编辑，最终 prompt 使用 edited rules。
5. `negative-unknown-evidence`：未知 evidenceRef rejected。
6. `negative-forbidden-field`：rawText/fulltext/snippets/sourceContext rejected。
7. `negative-fidelity-promise`：高保真/复刻/视觉还原承诺 rejected。

## 命令

```powershell
node experiments/editable-format-constraints/scripts/run-editable-format-constraints.mjs
```

## 通过门槛

- auto/missing-source/unknown-source/edited 四格式全部 pass。
- 三个 negative gates 全部 fail-closed。
- 输出 `reports/latest-summary.json` 和 `reports/latest-summary.md`。


---

## 原文件：`prd-editable-format-constraints-productization.md`


# PRD: Editable Format Constraints Productization

日期：2026-05-14

## 目标

将实验通过的 evidence-based LLM 推理 + 用户可编辑格式约束产品化。用户可以查看自动生成的 FormatSpec，并在用于底稿加工前手动修改。

## 产品原则

- StyleFacts 仍是事实层，LLM 不得修改事实。
- LLM 可以基于 evidence 合理推理 GB/T-like 规则。
- 用户编辑后的格式约束优先于自动规则进入 draft-processing。
- source/id 等内部元字段由系统补齐或归一化，不应阻断有用规则。
- 硬门禁仍拒绝未知 evidenceRef、rawText/fulltext/snippets/sourceContext、导出/复刻/高保真承诺。

## MVP 方案

1. Overlay evaluator：`formatRuleSynthesis.source` 缺失或未知时不拒绝；归一为 `llm-inferred` 并记录 warning。
2. FormatProfileRecord 增加 `editableFormatSpec` 覆盖层。
3. `buildFormatSpecSnapshot()` 默认生成自动 FormatSpec；若存在与当前自动 spec hash 匹配的用户编辑覆盖，则使用覆盖后的 `promptBlock`。
4. UI 在格式画像详情页提供：
   - 查看当前自动格式约束；
   - 编辑约束文本；
   - 保存为当前画像的编辑版；
   - 重置为自动版。
5. draft-processing 只消费 snapshot 中最终启用的 promptBlock。

## 非目标

- 不做富文本规则编辑器。
- 不做 DOCX/PPTX/XLSX/PDF 导出。
- 不默认发送 snippets/fulltext。
- 不承诺视觉还原或高保真复刻。


---

## 原文件：`test-spec-editable-format-constraints-productization.md`


# Test Spec: Editable Format Constraints Productization

日期：2026-05-14

## 测试项

1. Overlay evaluator accepts missing `formatRuleSynthesis.source` and defaults to `llm-inferred` with warning.
2. Overlay evaluator accepts unknown `source` with warning and defaults to `llm-inferred`.
3. Unknown evidenceRef still rejected.
4. FormatSpec snapshot uses editable promptBlock when override matches current auto hash.
5. Stale editable override is ignored when auto FormatSpec hash changes.
6. UI/store can save and reset editable promptBlock.
7. draft-processing system prompt uses final enabled promptBlock exactly once.

## 命令

```powershell
npx vitest run src/lib/format-profile-semantic-overlay.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts src/stores/format-profile-store.test.ts --reporter=verbose
npm run typecheck
npm run test:mocks
npm run build
```
