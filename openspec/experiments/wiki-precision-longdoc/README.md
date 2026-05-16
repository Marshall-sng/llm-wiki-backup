# Wiki Precision + LongDoc 实验追踪目录

本目录是 `research/wiki-precision-longdoc` 分支的实验追踪主目录，集中管理实验计划、执行记录、代码产物和结论。

## 目录结构

```
openspec/experiments/wiki-precision-longdoc/
├── README.md                     ← 本文档
├── experiment-tracker.md         ← 实验总览
├── decision-log.md               ← 决策记录
├── run-log.md                    ← 执行记录索引
├── handoff-tasks.md              ← 生产化候选任务
├── ...其他计划/报告/记录文档...
├── experiment-results.md         ← 实验结果与结论
├── run_experiments.py            ← 最小原型实验脚本
├── run_first_batch_company_closure.py
├── run_multiformat_anchor_experiments.py
├── run_pdfjs_text_anchor_probe.mjs
├── run_production_readiness_supplemental_experiments.py
├── run_unified_sidecar_closure.py
├── inspect_samples.py
├── artifacts/                    ← 实验产物 JSON
├── schemas/                      ← Schema 定义
```

## 关于本目录

本目录合并了此前两条独立的文件流：

1. **计划/报告/记录文档** — 来自 `.omx/plans/requirements/`，已迁移至此
2. **可执行脚本与产物** — 来自 `experiments/wiki-precision-longdoc/`，已合并至此

两部分内容互补：文档记录"为什么做、怎么做、结论是什么"，代码区提供"实际执行"。

## 目的

- 独立追踪"完整精准 Wiki 生成 / 长文工程 / 精准定位 / 精准检索"的探索实验。
- 将实验计划、执行记录、结论、决策和后续任务集中管理。
- 不扰动当前 DOCX-first / format-profile 主线开发记录。

## 关键入口

- 实验总览：`experiment-tracker.md`
- 决策记录：`decision-log.md`
- 执行记录索引：`run-log.md`
- 生产化候选任务：`handoff-tasks.md`
