# 当前 llm_wiki 架构诊断：为什么还不能稳定保证全面精准 Wiki

## 证据链概览

### Source conversion

证据：

- `src/lib/source-conversion.ts:56-63` 将 `raw/sources/...` 映射到 `.llm-wiki/converted/<relative>.md`。
- `src/lib/source-conversion.ts:83-101` 在非 md/txt 文件 ingest 时，如果 converted cache 新于 raw source，则读取 converted markdown。
- `src/lib/source-conversion.ts:104-114` converted 不新鲜时调用 MarkItDown 并写入 `.llm-wiki/converted/...md`。

推断：当前项目已经存在“原始材料 → converted markdown → LLM ingest”的中间层，但 converted 只是文本输入，不是稳定事实模型。

### Ingest / Wiki generation

证据：

- `src/lib/ingest.ts:320-327` `autoIngestImpl` 读取 `loadSourceForIngest` 的 `sourceContent`。
- `src/lib/ingest.ts:542-544` 将 enriched source content 截断到 50,000 字符作为 LLM 输入。
- `src/lib/ingest.ts:553-588` 先进行 LLM analysis，再调用 generation prompt 生成 FILE/REVIEW blocks。
- `src/lib/ingest.ts:650-654` 只保证 `wiki/sources/<sourceBaseName>.md` 存在；内容仍来自 LLM 输出或 fallback。
- `src/lib/ingest.ts:707-710` 支持解析 LLM 生成的 review blocks，但这些 review items 不是覆盖率审计的硬性产物。

推断：当前 Wiki 生成是 LLM 摘要/编写型，而不是结构化事实投影型。即使输入来自 converted，输出也可能重排、摘要、丢字段、丢行级事实。

### Search / RAG

证据：

- `src/lib/search.ts:230-245` token search 不再直接搜索 `raw/sources/`，主要搜索 `wiki/`，完整 extracted text 主要依赖 embedding chunks。
- `src/lib/search.ts:274-364` token search 与 vector search 做 RRF 融合。
- `src/lib/embedding.ts:2-17` embedding pipeline 对 Markdown chunk 建向量索引，并在搜索时返回 page-level 结果及 matchedChunks。
- `src/lib/embedding.ts:278-294` 以 `chunkMarkdown` 对 Wiki page 内容分块，而不是对 raw/converted 原始事实模型统一分块。

推断：当前检索主要围绕 Wiki pages 和其 embedding chunks，而不是围绕原始材料的结构化 anchors。对于 Excel 行、PDF 页、DOCX 段落这类定位需求，现有索引粒度不够。

### Graph / Review

证据：

- `src/lib/wiki-graph.ts:159+` 基于 Wiki 文件构建图谱。
- `src/lib/sweep-reviews.ts:332-457` 可以扫 pending review，并判断是否已经被当前 Wiki 状态解决。

推断：图谱和 review 都以 Wiki 状态为主，缺少“source coverage vs wiki coverage”的审计层。

### Draft / DOCX-first export

证据：

- `src/lib/docx-export-contract.ts`、`docx-intermediate.ts`、`docx-match-review.ts` 等文件已在当前工作区出现，说明另一路线正在建设 DOCX-first 出口合同。
- `DocxExportRule` 已预留 `evidenceRefs?: string[]`。

推断：DOCX-first 与本研究不冲突；相反，DOCX 需要上游提供稳定 evidence refs、section facts 和 draft structure。

## 已发现真实问题：“第一批企业名单.xlsx”

证据：

- `.llm-wiki/converted/第一批企业名单.xlsx.md` 保留了两张表和原始序号，例如第一张表存在序号 `6,7,8,5` 的原始顺序。
- `wiki/sources/第一批企业名单.md` 中 source page 将这些重写成 `5,6,7,8`，且弱化/丢失联系人、电话、来源工作表、第二张表项目编号等行级事实。
- `.llm-wiki/ingest-cache.json` 中 `第一批企业名单.xlsx` 的 hash 与 converted markdown bytes hash 一致，说明这次确实使用了 converted markdown 作为输入。

推断：问题不是“完全没用 converted”，而是“converted 被送入 LLM 后，被 LLM 摘要重写成了不保真 Wiki”。

## 当前最大短板

1. 缺少统一 SourceIdentity / SourceObject catalog，无法把 raw、converted、wiki source、entity、embedding chunks、review items 稳定绑定。
2. 缺少格式感知的 StructuredExtraction sidecar，尤其是 xlsx row/cell、pdf page/block、docx paragraph/table、pptx slide/shape。
3. Wiki 生成缺少 coverage/audit gate：没有强制比较 source facts 与 wiki candidates。
4. 长文处理只在 embedding chunk 层部分存在，未贯穿 ingest → wiki → retrieval → draft → export。
5. 检索返回 page 层结果较多，无法稳定返回 row/cell/page/block 级 anchor。

## Unknown

- 当前生产环境 MarkItDown 对不同格式的结构保真度，需要进一步用真实样本实验。
- 是否引入 SQLite/Arrow/Parquet 作为 sidecar 存储，需要对复杂度和收益做实验。
- 长文工程应作为全链路基础能力、独立功能还是混合架构，需要实验与路线比较。
