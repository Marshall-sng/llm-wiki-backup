# PRD: XLSX Precision P0

来源计划：`.omx/plans/xlsx-precision-p0-productization-plan.md`
状态：Architect APPROVE + Critic APPROVE
日期：2026-05-15

> 本文件是 ralplan 终态 PRD 入口。完整 ADR、选项比较、执行分工和修订记录见来源计划。

## 产品目标

从 raw XLSX 建立可追踪事实保真闭环：

```text
SourceSidecar freshness
→ first-batch domain_rows
→ WikiCandidate
→ CoverageAudit
→ ReviewItem / write gate
→ deterministic precision source page
```

## 核心决策

- 默认 `disabled`，不改变现有 ingest 行为。
- `observe` 只记录 `wouldBlockPaths` / audit artifact / ReviewItem，不阻断写入或 cache。
- `block` 是 P0 验收模式：audit 未通过时阻断 target/entity/precision pages。
- P0 不直接写 `wiki/entities/*`，先写 `wiki/sources/<sourceBaseName>-precision.md`。
- CoverageAudit 必须消费 `entityCandidates`、`factCandidates` 和 sidecar anchors，不能只靠字符串包含。

## 范围

- XLSX only。
- P0 只做 first-batch detector，不做通用 XLSX schema detector。
- 不触碰 DOCX-first 未提交工作。
- 保留原 source summary 安全路径。

## 非目标

- 不接 DOCX/PDF/TXT/PPTX。
- 不做 UI 大改。
- 不让 observe 模式作为 P0 完成标准。

## 执行阶段

- D1 freshness 状态模型。
- D2 first-batch domain_rows extraction。
- D3 projection + CoverageAudit gate。
- D4 ReviewItem 与 cache-hit 行为。
- D5 deterministic precision source page write。
- D6 回归收口与文档。
