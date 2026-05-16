# 实验执行记录

执行时间：2026-05-14T17:31:35.749088+00:00

## 总结

```json
{
  "E1_excel_status": "passed",
  "E2_long_text_status": "passed",
  "E3_anchor_status": "passed",
  "E4_retrieval_status": "passed",
  "E5_wiki_audit_status": "issues_found",
  "E6_longdoc_status": "passed",
  "artifactDir": "D:\\llm_wiki\\experiments\\wiki-precision-longdoc\\artifacts"
}
```

## E1 Excel 表格完整抽取

Evidence：`first-batch-enterprises.structured.json` 保留了第一张表 18 条企业记录，原始序号为 `['1', '2', '3', '4', '6', '7', '8', '5', '9', '10', '11', '12', '13', '14', '18', '15', '16', '17']`；第二张表项目编号为 `['12', '23', '24', '39']`。

Inference：表格材料需要至少 row-level sidecar；仅让 LLM 写 source summary 会改写序号和丢字段。

## E2 超长文本尾部实体覆盖

Evidence：naive first-50000 contains tail = `False`；chunked contains tail = `True`。

Inference：任何超长材料 ingest/wiki 生成都需要 coverage-aware reading，不应只依赖 fixed truncation。

## E3 EvidenceAnchor

Evidence：`evidence-anchor-samples.json` 和 `schemas/evidence-anchor.schema.json` 可以表达 xlsx row、text range、pdf page-block、docx paragraph、pptx slide-shape。

Inference：更合适的是“分类型 anchor + 统一接口”，而不是强行一个 locator 形状覆盖所有格式。

## E4 精准检索 / insufficient evidence

Evidence：`retrieval-smoke.json` 中 `云南白药 联系人` 返回 row anchor；`火星矿产权属审批时限` 返回 insufficient_evidence。

Inference：structured rows + simple lexical matching already能比 Wiki summary 更可靠地处理一部分事实查询；后续应接入 hybrid retrieval。

## E5 Wiki 覆盖率 / 遗漏审计

Evidence：`wiki-coverage-audit.json` 生成 review items，发现 source serial rewrite、pilot project id loss、contact/phone field loss 等。

Inference：review items 不应只由 LLM 自愿生成，至少需要 deterministic coverage audit。

## E6 长文生成工程

Evidence：`long-document-project-skeleton.json` 的每个 section 都有 evidenceRefs，且 `singleResponseAllowed=false`。

Inference：长文成稿应是独立编排模块，但其前提能力（coverage/evidence anchors/evidence packets）必须贯穿全链路。

## Unknown

- PDF/DOCX/PPTX 的真实结构锚点仍需真实样本实验。
- 是否引入 SQLite/Arrow/Parquet 仍需性能和复杂度对比。
- LLM verifier 在遗漏审计中的边际收益尚未测试。
