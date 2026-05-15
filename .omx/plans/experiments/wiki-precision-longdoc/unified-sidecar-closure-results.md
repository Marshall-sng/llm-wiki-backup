# 统一 SourceSidecar / EvidenceAnchor 最小闭环实验结果

## 总结论

- evidence：已把 DOCX / PDF / TXT / XLSX 的实验产物归一为 SourceSidecar 结构。
- evidence：已生成 EvidenceAnchorIndex，并完成 query → anchor → selector 的最小检索定位烟测。
- evidence：烟测包含 positive hits 与 insufficient evidence 负例。
- inference：统一接口 + 分格式 selector 是当前最优路线；不应把所有格式强行压成 Markdown 或单一 selector。
- unknown：本轮聚合使用的是代表性 anchor artifact；生产接入必须持久化完整 sidecar。

## 产物

- `experiments/wiki-precision-longdoc/schemas/source-sidecar.schema.json`
- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/source-sidecar-examples.json`
- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/evidence-anchor-index.json`
- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/coverage-summary.json`
- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/retrieval-smoke-results.json`
- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/wiki-candidate-skeleton.json`

## 覆盖汇总

| 格式 | sources | declared anchors | artifact anchors | text units | quality |
|---|---:|---:|---:|---:|---|
| docx | 3 | 9376 | 60 | 8155 | {'partial': 3} |
| txt | 1 | 234 | 8 | 4442676 | {'partial': 1} |
| xlsx | 2 | 2220 | 60 | 49047 | {'partial': 2} |
| pdf | 4 | 6913 | 99 | 204390 | {'partial': 4} |

## 检索定位烟测

- passed：True

| query_id | status | top anchor | selector |
|---|---|---|---|
| Q-docx-table | hit | `S007:docx:p:00002` | `{"paragraph_index": 2, "block_index": 2, "style": null}` |
| Q-pdf-regulation | hit | `S003:pdf:line:p0001:l0001` | `{"page": 1, "line_index": 1, "item_indices": [1, 2], "bbox_approx": {"x_min": 183.60156975805947, "y_avg": 681.9199784266671, "x_max": 411.9858930127908, "height_max": 20.400000281999915}}` |
| Q-txt-tail | hit | `S002:txt:chunk:00234` | `{"chunk_index": 234, "char_start": 4427000, "char_end": 4442676, "line_start": 172162, "line_end": 172820}` |
| Q-xlsx-data-element | hit | `S040:xlsx:Sheet1:r:2` | `{"sheet": "Sheet1", "row": 2}` |
| Q-insufficient | insufficient_evidence | - | - |

## WikiCandidate 骨架

- candidate_count：10
- 每个 candidate 已包含 source_id、format、coverage、quality、seed_facts、review_items。

## 对下一步的影响

1. 可以进入“第一批企业名单.xlsx”真实闭环，但应基于统一 SourceSidecar，而不是写 XLSX 特例。
2. 生产设计需要先实现 full sidecar 持久化，再让 Wiki/RAG/长文/DOCX 导出消费 anchor index。
3. CoverageAudit 应成为 Wiki 生成前置门禁：当 declared anchors 与可用 anchors 不一致，必须产生 ReviewItem。
4. PDF.js 路线可进入 schema 化，但仍需 reading order / header footer / quality gate 后续实验。
