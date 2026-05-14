# pkm-tool 经验提炼：可借鉴思想与不可迁移边界

## 可借鉴思想

### 1. DocumentCatalog / TitleResolver

证据：`D:/数据流通/pkm-tool/src/core/document_catalog.py`

- `DocumentRecord` 保存 canonical title、aliases、raw_path、converted_path、processed_source_path、file_type、char_count、encoding/wiki/index status。
- alias 来源包括文件名、frontmatter、正文标题、公司名变体、source_id。

可迁移思想：llm_wiki 需要 SourceIdentity 层，把 raw/converted/wiki/entity/review/index 统一绑定。不要直接复制 pkm-tool 实现，但要吸收“材料身份先于检索/生成”的原则。

### 2. ChunkIndex / EvidencePacket

证据：`chunk_index.py`、`evidence_packet.py`

- chunk 包含 document_id、heading_path、char_start、char_end、text。
- evidence packet 包含 document_id、chunk_id、source_path、heading_path、snippet、char_start、char_end、score。

可迁移思想：精准检索和长文生成都应消费 EvidencePacket，而不是裸全文或 Wiki 摘要。

### 3. ReviewQueue / omission audit

证据：`deep_extract_contracts.py`、`deep_extractor.py`

- review 类型包括 `low_confidence`、`possible_duplicate`、`possible_omission`、`conflict`、`evidence_gap`。
- deep extractor 将失败 chunk、低置信、重复、可能遗漏写入 review queue。

可迁移思想：Wiki 生成时应生成审计项，但生成时机可以探索：ingest 同步、后台审计、检索时审计、周期审计。

### 4. LongDocumentRuntime

证据：`long_document_runtime.py`

- 长文 run 包含 prompt、target_chars、chapter_count、evidence_plan、chapters。
- 明确 `single_response_allowed: False`、`requires_chapter_queue: True`。

可迁移思想：长文不是一次 Chat；应有 section queue / evidence plan / draft merge / review / export。但它是否贯穿全链路还是独立功能，需要在本研究中判断。

### 5. Deep extraction / chunk coverage

证据：`document_chunker.py`、`deep_extractor.py`、相关 tests

- chunk plan 有 source_hash、plan_hash、text_hash。
- 测试覆盖“尾部实体不能被 legacy max input chars 截断遗漏”。

可迁移思想：全量覆盖必须有机器可验证的 chunk/row/page coverage，而不是依赖 LLM 声称“已全面阅读”。

## 不应直接迁移

1. 不迁移 pkm-tool 自建 UI / task center / project runtime。
2. 不迁移未闭环的 long document handoff，把 handoff 当完成是失败教训。
3. 不复制 pkm-tool 的 Python pipeline 到 TypeScript 主线；应提炼合同和数据模型。
4. 不默认 pkm-tool 的每个经验都是正确的；它们是候选假设，仍需实验。

## 与当前 llm_wiki 的关系

- llm_wiki 已有 raw/sources、converted、wiki、embedding、graph、review、draft/docx export 等基础。
- pkm-tool 的价值在“缺失的中间合同”：SourceIdentity、EvidenceAnchor、CoverageSummary、StructuredExtraction、OmissionAudit、LongDocumentRun。
- 最优路线应是补中间层，而不是重造底座。
