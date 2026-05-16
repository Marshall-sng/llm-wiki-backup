# 候选方案集与推荐目标架构（研究版）

## 候选路线

### 路线 A：converted markdown 增强路线

做法：继续以 `.llm-wiki/converted/*.md` 为主输入，但要求 converter 输出更规范的 Markdown：稳定表格、frontmatter、source anchors、图片 alt、页码标记等。

优点：
- 与当前 ingest 改动最小。
- 能继续复用现有 LLM prompt、embedding、search。

缺点：
- Markdown table 对 Excel 多行单元格、合并单元格、原始序号、类型和公式表达不稳定。
- LLM 仍可能摘要重写而非保真投影。

需要实验：增强 Markdown 是否足以保存 xlsx 行级事实和长文定位。

### 路线 B：StructuredExtraction sidecar 路线

做法：为每个 source 生成 `.llm-wiki/structured/<sourceId>.json`，其中包含不同格式的结构化事实与 anchors。Wiki 由 sidecar 投影生成，LLM 只做语义归纳和别名/关系补全。

优点：
- 最符合“事实/定位优先”。
- 对 Excel、PDF、DOCX/PPTX 可分别建专用 anchor。
- 便于 coverage audit 和 DOCX evidence refs。

缺点：
- 需要新增数据合同、存储、索引和审计逻辑。
- 初期复杂度高。

需要实验：sidecar 的最小字段是否足以覆盖“第一批企业名单”并驱动 Wiki/review。

### 路线 C：SQLite / table-index 路线

做法：将结构化事实、anchors、entities、relations、chunks 写入本地 SQLite/LanceDB/混合索引。Wiki 是视图，检索直接查索引。

优点：
- 检索和审计能力强。
- 表格行、实体关系和证据追踪查询方便。

缺点：
- 与当前文件型 Wiki 心智有距离。
- 需要维护 DB 与文件系统同步。

需要实验：本阶段是否值得引入 DB，还是先用 JSON sidecar 足够。

### 路线 D：Evidence-anchor-first 混合路线

做法：先定义统一或分类型 EvidenceAnchor，然后让 converted、structured、chunk、Wiki、draft、DOCX 都引用同一 anchor 接口。底层可先 JSON sidecar，未来可迁移到 DB。

优点：
- 不绑定单一存储实现。
- 同时服务 Wiki、RAG、长文、DOCX。
- 可渐进接入现有架构。

缺点：
- 需要认真定义 anchor schema 和 resolver。
- 如果 schema 过抽象，会变成空洞中间层。

需要实验：不同格式能否映射到统一接口，同时保留格式特有定位能力。

### 路线 E：Agentic long reading 路线

做法：对超长文本，使用 agentic reading / map-reduce / verifier / omission audit，让 LLM 分段阅读、交叉检查遗漏。

优点：
- 对语义密集长文本更强。
- 可补足规则抽取无法处理的隐含关系。

缺点：
- 成本和不确定性高。
- 仍需要 deterministic coverage 作为边界。

需要实验：仅靠 agentic reading 是否会漏尾部/低频实体；与 chunk coverage 如何组合。

## 当前推荐：D + B 的分阶段混合路线

当前最优判断：

```text
EvidenceAnchor-first interface
→ JSON StructuredExtraction sidecar as first implementation
→ format-specific indexes: RowIndex / ChunkIndex / PageIndex
→ WikiCandidate + OmissionAudit
→ RetrievalOrchestrator
→ Draft / LongDocumentProject / DOCX export consume EvidencePacket
```

理由：

1. 对当前架构侵入较小：先落在 `.llm-wiki/structured` 与 `experiments/`，无需重写现有 ingest。
2. 能解决已知真实问题：Excel 行级事实不能靠 LLM summary 保证。
3. 与 DOCX-first 不冲突：DOCX export 需要 evidence refs，EvidenceAnchor 正是上游合同。
4. 长文工程可混合定位：底层 coverage/chunk/evidence 是全链路能力；长文成稿项目作为独立编排模块。

## 推荐目标架构

```text
Raw Source
  ↓
SourceIdentity
  - sourceId / canonicalTitle / aliases / fileType / rawPath / convertedPath / wikiPath
  ↓
SourceConversion
  - converted markdown / extracted images / plain text projection
  ↓
StructuredExtraction sidecar
  - text blocks / table rows / pdf pages / docx paragraphs / pptx slides / media captions
  ↓
EvidenceAnchor Index
  - TextAnchor / TableAnchor / PageAnchor / OfficeAnchor / WebAnchor
  ↓
RetrievalOrchestrator
  - lexical + vector + structured + graph + rerank + coverage
  ↓
WikiCandidate Generator
  - source page / entity / concept / relation / synthesis candidates
  ↓
OmissionAudit + ReviewItems
  - missing entity / duplicate / conflict / low confidence / evidence gap
  ↓
Human-readable Wiki
  ↓
Draft / LongDocumentProject / DOCX export
```

## 长文工程边界（初步）

应拆成两层：

1. 贯穿全链路的基础能力：Chunk/Section coverage、EvidencePacket、coverage summary、anchor resolver、omission audit。
2. 独立 LongDocumentProject：outline、section plan、per-section draft、merge、lint/review、export。

这不是最终结论，需要通过实验验证。
