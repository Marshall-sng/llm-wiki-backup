# FormatSpec Experiment

本实验验证新的 `FormatSpec` 中间层：把现有 FormatProfile / StyleFacts / evidence-only 输入转换为详细格式规范，再渲染为底稿加工 prompt。

目标不是产品接入，而是验证约束形态：

```text
StyleFacts / deterministicProfile / semantic evidence
  -> FormatSpec
  -> format-spec.md
  -> draft-prompt.md
  -> evaluation.json
```

## 运行

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
```

## 产物

每个 case 输出：

- `format-spec.json`
- `format-spec.md`
- `draft-prompt.md`
- `evaluation.json`

汇总输出：

- `reports/latest-summary.json`
- `reports/latest-summary.md`

## 边界

- 不恢复手动输入模板。
- 不发送 snippets/fulltext。
- 不让 LLM 生成或覆盖样式事实。
- 不承诺导出或视觉还原。
- Prompt 默认不展示 evidence ids，不转储 raw evidence。

## Ralplan 修订补充

Planner 复审指出原实验存在自证闭环风险，因此新增独立 evaluator：

```powershell
node experiments/format-spec/scripts/evaluate-format-spec.mjs
```

它独立读取已生成 artifacts，并执行 schema/enum、类型分支、目标覆盖、归一化泄漏、证据转储、边界承诺和 provenance 检查，同时内置 5 个负例自测。
