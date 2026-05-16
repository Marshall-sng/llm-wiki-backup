# 后续生产化候选任务清单

本文件只记录从探索实验导出的候选任务，不代表已批准立即进入主线开发。

## P0：最小事实层闭环

1. 定义 `SourceIdentity` v0。
2. 定义 `StructuredExtraction` v0。
3. 定义 `EvidenceAnchor` v0：统一外层接口 + 分格式 locator。
4. 为 xlsx 增加 structured sidecar 生成路径。
5. 为“第一批企业名单.xlsx”增加回归测试。
6. 增加 CoverageAudit v0，至少发现：
   - serial rewrite；
   - project id loss；
   - field loss；
   - missing exact entity；
   - evidence gap。

## P1：检索与 Wiki 候选生成

1. RetrievalOrchestrator smoke：structured rows + wiki + embeddings。
2. WikiCandidate projection：从 structured facts 生成 source/entity/relation candidates。
3. Review item merge：deterministic audit + LLM semantic review。

## P2：长文工程底层能力

1. Text chunk/section coverage sidecar。
2. Per-section evidence packet。
3. LongDocumentProject skeleton 与 Draft/DOCX evidenceRefs 对接。

## P3：真实多格式扩展实验

1. PDF page/block anchor。
2. DOCX paragraph/table anchor。
3. PPTX slide/shape anchor。
4. Web page DOM/text anchor。
