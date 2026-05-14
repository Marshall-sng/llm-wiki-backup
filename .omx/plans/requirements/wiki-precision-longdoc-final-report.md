# Wiki 精准生成与长文工程前置研究最终汇报

分支：`research/wiki-precision-longdoc`

## 一、当前最大短板

当前 llm_wiki 的核心短板不是“没有 converted”，而是：

```text
converted markdown 被当作 LLM 输入，
但没有被提升为可审计、可定位、可全量覆盖的事实结构。
```

已验证事实：

- 代码层面：`src/lib/source-conversion.ts` 会将非文本 source 转成 `.llm-wiki/converted/*.md`，并在新鲜时复用。
- 实例层面：“第一批企业名单.xlsx”的 ingest cache hash 与 converted markdown bytes hash 一致，说明实际使用了 converted markdown。
- 结果层面：`wiki/sources/第一批企业名单.md` 仍然重写了原始序号、弱化字段、丢失联系人/电话/项目编号等行级事实。

结论：问题发生在 `converted → LLM summary/wiki generation` 阶段。LLM 生成的 source page 是人类可读摘要，不是事实保真投影。

## 二、实验结果摘要

计划文件：`.omx/plans/requirements/wiki-precision-longdoc-experiment-plan.md`

执行记录：`experiments/wiki-precision-longdoc/experiment-results.md`

产物目录：`experiments/wiki-precision-longdoc/artifacts/`

| 实验 | 状态 | 关键证据 | 对方案的影响 |
| --- | --- | --- | --- |
| E1 Excel 完整抽取 | passed | 第一张表保留 18 条企业记录；原始序号 `1,2,3,4,6,7,8,5,...`；第二张表保留项目编号 `12,23,24,39` | 支持 row-level structured sidecar |
| E2 超长文本尾部覆盖 | passed | naive first-50000 未命中尾部实体；chunked coverage 命中 | 支持 coverage-aware long reading |
| E3 EvidenceAnchor | passed | 一个 schema 可表达 xlsx row、text range、pdf block、docx paragraph、pptx slide-shape | 支持“分类型 anchor + 统一接口” |
| E4 精准检索 | passed | `云南白药 联系人` 返回 row anchor；无证据查询返回 insufficient_evidence | 支持 structured retrieval + explicit insufficiency |
| E5 Wiki 覆盖审计 | issues_found | 自动发现 serial rewrite、project id loss、contact/phone field loss | 支持 deterministic audit/review items |
| E6 长文工程骨架 | passed | 每个 section 都有 evidenceRefs；`singleResponseAllowed=false` | 支持“底层贯穿 + 独立编排”的混合路线 |

## 三、哪些初始假设被支持 / 修正 / 未验证

### 被支持

1. **表格需要 row/cell 级结构化抽取**  
   E1 证明 xlsx 可以稳定提取行级 facts，而当前 wiki summary 会改写/丢失这些 facts。

2. **长文需要 coverage-aware reading**  
   E2 证明 fixed truncation 会漏尾部实体。

3. **LLM 不应单独负责全量覆盖**  
   E5 证明 deterministic audit 能发现 LLM summary 未主动暴露的问题。

4. **长文工程需要底层 evidence 能力支撑**  
   E6 证明长文成稿模块如果没有 section evidence refs，会退化为不可审计写作。

### 被修正

1. **“统一 EvidenceAnchor”应改为“分类型 anchor + 统一接口”**  
   表格、文本、PDF、DOCX、PPTX 的 locator 形状不同，强行统一 locator 会丢格式信息。应统一外层接口，保留内部 locator 差异。

2. **review items 不一定完全由 LLM 生成**  
   当前更优判断：deterministic coverage audit 生成基础 review items；LLM 可补充语义类 conflict/duplicate/suggestion。

### 未验证

1. PDF/DOCX/PPTX 的真实结构锚点还需要真实样本实验。
2. SQLite/Arrow/Parquet 是否优于 JSON sidecar 未验证。
3. LLM verifier 对遗漏审计的边际收益未验证。
4. Agentic long reading 是否优于 deterministic chunk + verifier 未验证。

## 四、当前最优路线

推荐路线：

```text
EvidenceAnchor-first + StructuredExtraction sidecar + CoverageAudit
```

阶段性目标架构：

```text
Raw Source
  ↓
SourceIdentity
  ↓
SourceConversion
  ↓
StructuredExtraction sidecar
  ↓
EvidenceAnchor Index
  ↓
RetrievalOrchestrator
  ↓
WikiCandidate Generator
  ↓
Coverage / Omission Audit
  ↓
Human-readable Wiki
  ↓
Draft / LongDocumentProject / DOCX export
```

### 为什么优于其他候选路线

| 路线 | 判断 |
| --- | --- |
| 只增强 converted markdown | 改动小，但仍难保证 xlsx row/cell、PDF page/block、DOCX paragraph/table 的结构保真 |
| 直接上 DB/table-index | 能力强，但当前阶段复杂度偏高，容易扰乱主线 |
| 全靠 agentic long reading | 语义能力强，但覆盖率不可稳定证明，成本高 |
| EvidenceAnchor + JSON sidecar | 最小可行、可渐进、能直接解决已知 Excel 问题，也服务 DOCX-first |

因此当前最优不是重写 ingest，而是先补一个可独立验证的中间合同：

```text
.llm-wiki/structured/<sourceId>.json
.llm-wiki/anchors/<sourceId>.json 或统一索引
```

## 五、长文工程定位

推荐混合路线：

```text
底层长文能力贯穿全链路；长文成稿作为独立编排模块。
```

### 应贯穿全链路的能力

- chunk / section / page / row coverage
- evidence anchors
- evidence packets
- coverage summary
- omission audit
- retrieval against anchors

这些能力不是“写长报告”专用，而是 ingest、Wiki、RAG、Draft、DOCX 都需要的基础设施。

### 应作为独立 LongDocumentProject 的能力

- outline
- section plan
- per-section evidence pack
- section draft
- merge
- lint / review
- export
- task state / UI

### 实施顺序

1. 先实现底层 evidence anchor + structured extraction + coverage audit。
2. 再让 Wiki 生成和 retrieval 消费这些 evidence。
3. 最后做 LongDocumentProject 的成稿编排和 UI。

## 六、与 DOCX-first 路线是否冲突

不冲突。关系是：

```text
Wiki 精准生成研究：提供事实、证据、定位、覆盖率
DOCX-first：消费 draft、format spec、evidence refs，生成正式文档
```

DOCX-first 需要的不是完整原文堆砌，而是：

- draft sections
- evidence refs
- source coverage
- citation / appendix policy
- content leakage policy
- export record / audit

本研究提供的是上游证据合同，正好补齐 DOCX-first 的事实来源和可审计性。

## 七、建议的最小闭环

### 闭环 1：XLSX structured sidecar + audit

输入：`raw/sources/*.xlsx`  
输出：`.llm-wiki/structured/<sourceId>.json`  
验证：企业/项目/联系人/电话/原始序号不丢失。

### 闭环 2：EvidenceAnchor schema + resolver

输入：structured rows / text chunks / future pdf/docx anchors  
输出：统一可引用 anchor IDs。  
验证：retrieval、wiki page、draft、docx export 都可引用 anchor。

### 闭环 3：WikiCandidate projection

输入：structured sidecar  
输出：source/entity/concept/relation candidates，而不是直接让 LLM 自由生成最终 Wiki。  
验证：候选覆盖率 >= source facts 的设定阈值。

### 闭环 4：CoverageAudit / ReviewItems

输入：source facts + generated wiki candidates  
输出：missing_entity、field_loss、serial_rewrite、possible_duplicate、low_confidence。  
验证：能稳定发现“第一批企业名单”的已知问题。

### 闭环 5：RetrievalOrchestrator smoke

输入：structured anchors + wiki pages + embeddings。  
输出：带 anchor 的命中；无证据时 explicit insufficient evidence。

## 八、建议推迟的工作

- 完整 PDF/DOCX/PPTX 高保真结构抽取：先做样本实验再产品化。
- 全量 DB 化：先用 JSON sidecar 验证合同。
- LongDocumentProject UI：底层 evidence/coverage 未稳定前不要先做 UI。
- LLM agentic reading 大规模接入：先作为 verifier/补充，不作为基础覆盖保证。

## 九、下一阶段可交给执行终端的任务清单

1. 新增 `SourceIdentity` 轻量合同：sourceId、rawPath、convertedPath、wikiSourcePath、fileType、hash、aliases。
2. 新增 `StructuredExtraction` v0 合同，先支持 xlsx。
3. 新增 `EvidenceAnchor` v0 类型，采用分类型 locator + 统一外层接口。
4. 为 xlsx ingest 增加 sidecar 生成实验性路径，不改 UI。
5. 为“第一批企业名单.xlsx”写回归测试：
   - 18 条企业记录；
   - 原始序号顺序保留；
   - 试点项目编号 12/23/24/39 保留；
   - 联系人/电话字段保留。
6. 新增 `CoverageAudit` v0：比较 structured facts 与 wiki candidates，生成 review items。
7. 新增 retrieval smoke：查询具体联系人返回 row anchor；无证据查询返回 insufficient evidence。
8. 与 DOCX-first 对接：让 Draft/DocxExportContract 的 evidenceRefs 可引用 EvidenceAnchor。

## 十、最终判断

当前最优方案不是“更会写摘要的 LLM prompt”，而是：

```text
格式感知结构化抽取
+ 可定位 EvidenceAnchor
+ 覆盖率/遗漏审计
+ LLM 语义归纳
+ Wiki/Draft/DOCX 消费同一证据层
```

LLM 的角色应从“唯一生成者”降级为“语义归纳与候选生成者”；全量覆盖、定位、审计应由结构化抽取、索引和测试保障。
