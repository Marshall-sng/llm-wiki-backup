# Wiki Precision + LongDoc 实验追踪表

## 分支

`research/wiki-precision-longdoc`

## 实验目标

找出能够支撑以下能力的当前最优方案：

1. 任意格式素材完整、精准生成 Wiki。
2. 超长文本也能完整、精准生成 Wiki。
3. 支持长文工程化生成。
4. 支持精准定位。
5. 支持精准检索和证据不足处理。

## 文档索引

| 类型 | 路径 | 状态 |
| --- | --- | --- |
| 研究任务书 | `.omx/plans/requirements/wiki-precision-longdoc-research-task.md` | 已完成 |
| 架构诊断 | `.omx/plans/requirements/wiki-precision-longdoc-architecture-diagnosis.md` | 已完成 |
| pkm-tool 经验提炼 | `.omx/plans/requirements/pkm-tool-knowledge-transfer-wiki-longdoc.md` | 已完成 |
| 候选方案 | `.omx/plans/requirements/wiki-precision-longdoc-candidate-solutions.md` | 已完成 |
| 长文定位分析 | `.omx/plans/requirements/wiki-precision-longdoc-longdoc-position.md` | 已完成 |
| 实验计划 | `.omx/plans/requirements/wiki-precision-longdoc-experiment-plan.md` | 已完成 |
| 最终汇报 | `.omx/plans/requirements/wiki-precision-longdoc-final-report.md` | 已完成 |
| 实验脚本 | `experiments/wiki-precision-longdoc/run_experiments.py` | 已完成 |
| 实验执行记录 | `experiments/wiki-precision-longdoc/experiment-results.md` | 已完成 |

## 实验状态

| 编号 | 实验 | 状态 | 产物 |
| --- | --- | --- | --- |
| E1 | Excel 表格完整抽取 | passed | `experiments/wiki-precision-longdoc/artifacts/first-batch-enterprises.structured.json` |
| E2 | 超长文本尾部实体覆盖 | passed | `experiments/wiki-precision-longdoc/artifacts/long-text-tail-coverage.json` |
| E3 | EvidenceAnchor 模型 | passed | `experiments/wiki-precision-longdoc/schemas/evidence-anchor.schema.json` |
| E4 | 精准检索 / insufficient evidence | passed | `experiments/wiki-precision-longdoc/artifacts/retrieval-smoke.json` |
| E5 | Wiki 覆盖率 / 遗漏审计 | issues_found | `experiments/wiki-precision-longdoc/artifacts/wiki-coverage-audit.json` |
| E6 | 长文生成工程骨架 | passed | `experiments/wiki-precision-longdoc/artifacts/long-document-project-skeleton.json` |

## 当前最优判断

当前最优路线是：

```text
EvidenceAnchor-first
+ StructuredExtraction sidecar
+ CoverageAudit
```

长文工程采用混合定位：

```text
底层长文能力贯穿全链路；长文成稿作为独立 LongDocumentProject 编排模块。
```

## 后续实验登记规则

新增实验必须先在本表追加：

- 要验证的架构问题；
- 输入材料；
- 预期输出；
- 验证标准；
- 失败判据；
- 产物路径。

执行后再更新状态和 `run-log.md`。
