# Wiki Precision + LongDoc 实验决策记录

## D1：建立独立实验追踪目录

Date: 2026-05-15

Decision: 在 `.omx/plans/experiments/wiki-precision-longdoc/` 下建立实验追踪主目录。

Reason: 用户要求为了不扰乱主线进度，除 Git 分支隔离外，还需要在 `.omx/plans` 内独立管理实验记录和追踪。

Consequence:

- 后续实验主控记录进入本目录。
- 已完成的研究文档暂不移动，避免造成额外 churn；本目录通过索引引用它们。
- 生产化前再决定是否把成熟结论同步回 requirements / traceability matrix。

## D2：不移动已提交研究文档

Date: 2026-05-15

Decision: 保留已提交在 `.omx/plans/requirements/` 的研究任务书、架构诊断、候选方案、最终汇报等文件。

Reason: 这些文件已经作为迁移需求相关研究成果提交；移动会引入无必要的历史噪音。实验追踪目录只作为主控索引与后续增量记录。

## D3：实验结果先停留在研究分支

Date: 2026-05-15

Decision: 实验产物保留在 `research/wiki-precision-longdoc`，不直接合入主线生产代码。

Reason: 本任务是探索实验；生产化需要后续单独 PR / 分支，且需与 DOCX-first 和当前主线进度协调。
