# 长文工程在整体链路中的位置：研究版判断

## 问题

长文工程到底是一个单独功能模块，还是贯穿 ingest / wiki / retrieval / draft / export 的基础能力？

## 路线 A：贯穿全链路的基础能力

能力包括：

- ingest 阶段：长文本分块、section detection、coverage summary、尾部覆盖。
- structured extraction 阶段：chunk-level extraction、row/page/block-level extraction、possible omission。
- wiki generation 阶段：分块候选合并、实体/概念去重、coverage audit。
- retrieval 阶段：EvidencePacket、定位引用、insufficient evidence。
- draft 阶段：按 evidence pack 写作和修改。
- DOCX export 阶段：章节、引用、审计记录、内容来源说明。

优点：解决“任何超长输入都不能只读开头”的基础问题。

风险：若一开始全链路铺开，会拖慢 DOCX-first 和 Wiki 修复的最小闭环。

## 路线 B：独立 Long Document Project

能力包括：

- 用户明确要求“写长报告/压缩长文/生成 15000 字成稿”时启动。
- outline → section plan → per-section evidence pack → section draft → merge → lint/review → export。

优点：产品边界清晰，适合后续 UI 和任务队列。

风险：如果底层没有 coverage/evidence，独立模块会重演 pkm-tool handoff：有计划，无可靠成稿。

## 当前推荐：混合路线

```text
底层长文能力贯穿全链路；长文成稿作为独立编排模块。
```

### 应贯穿的能力

- chunk/section/page/row coverage
- evidence anchor
- evidence packet
- coverage summary
- omission audit
- retrieval against anchors

### 应独立保留的能力

- LongDocumentProject run
- outline / section plan
- per-section draft queue
- merge / lint / review / export
- 长文任务 UI / 状态管理

### 当前阶段优先级

1. 先做底层 evidence anchor + structured extraction + coverage audit。
2. 再让 Wiki 生成和 retrieval 消费这些 evidence。
3. 最后做 LongDocumentProject 成稿编排。

## 仍需实验验证

- chunk-only 是否足以覆盖长文本实体，还是需要 section/topic-aware chunk。
- 长文生成的 evidence pack 粒度：按 section、按 claim、还是按 paragraph。
- LongDocumentProject 是否应直接输出 DOCX intermediate，而不是先输出 Markdown。
