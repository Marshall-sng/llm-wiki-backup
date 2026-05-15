# Deferred Improvements / 后续改进暂存

本文档专门记录：

> 当前不是主要工作目标、暂不进入下一步最小闭环，但后续值得改进、验证、补实验或生产化增强的内容。

它不同于：

- `experiment-tracker.md`：当前实验状态追踪。
- `run-log.md`：实际执行记录。
- `handoff-tasks.md`：可交给后续终端/分支执行的生产化候选任务。
- `decision-log.md`：已经做出的路线决策。

## 记录规则

每个条目尽量包含：

- 分类；
- 优先级建议：P0 / P1 / P2 / P3；
- 当前暂缓原因；
- 触发条件；
- 可能产物。

优先级含义：

- P0：下一阶段真实闭环前可能必须解决。
- P1：进入生产化设计前应解决。
- P2：增强质量、鲁棒性或体验。
- P3：长期能力或扩展格式。

---

## PDF

### PDF reading order / 多栏阅读顺序

- 优先级：P1
- 当前暂缓原因：Phase 1C 已证明 PDF.js 可生成 text item / line anchor；阅读顺序属于质量增强，不阻塞统一证据层闭环。
- 触发条件：当 PDF line anchor 用于正式 Wiki/RAG 生成时，如果多栏、页眉页脚、脚注混入影响检索或引用。
- 可能产物：
  - `pdf-reading-order-experiment.md`
  - `pdf-line-block-merge.ts`
  - reading-order quality fixtures

### Header / Footer / Page Number 过滤

- 优先级：P1
- 当前暂缓原因：当前 PDF 实验重点是能否形成定位 anchor，不是清洗质量最优。
- 触发条件：检索结果频繁命中页眉、页脚、页码、版权行。
- 可能产物：
  - header-footer detector
  - per-page repeated-line audit

### PDF 表格结构恢复

- 优先级：P2
- 当前暂缓原因：当前路线只需要 text/line anchor；表格恢复复杂，且 XLSX 已覆盖主要表格事实链路。
- 触发条件：PDF 表格成为 Wiki 事实主要来源，且 line anchor 无法保留行列关系。
- 可能产物：
  - table-region detector
  - text-line-to-table heuristic
  - PyMuPDF/pdfplumber 对照实验

### PDF extraction quality gate

- 优先级：P1
- 当前暂缓原因：Phase 1C 只做了样本级成功验证，还没有生产级质量门禁。
- 触发条件：准备接入 ingest pipeline 前。
- 可能规则：
  - pages_processed / pages；
  - pages_with_text / pages；
  - chars per page；
  - line anchors per page；
  - failed pages；
  - suspicious repeated lines。

### OCR

- 优先级：P3
- 当前暂缓原因：用户明确当前暂不管 OCR。
- 触发条件：出现扫描版 PDF 或图片型 PDF 且业务要求纳入 Wiki。
- 可能产物：
  - OCR provider comparison；
  - scanned PDF fixture；
  - OCR confidence model。

---

## DOCX

### 图片 / 图注 / media anchor

- 优先级：P2
- 当前暂缓原因：当前 DOCX 实验证明 paragraph/table/cell anchor 可行；图片语义需要额外视觉/OCR/图注处理。
- 触发条件：DOCX 中图片承载关键事实，如架构图、流程图、盖章扫描页。
- 可能产物：
  - `docx.media` anchor；
  - image relationship map；
  - caption detector。

### 页眉页脚、脚注、尾注、批注、修订痕迹

- 优先级：P2
- 当前暂缓原因：当前样本主要验证正文和表格结构。
- 触发条件：正式材料中页眉页脚或批注包含关键版本、主体、审批信息。
- 可能产物：
  - DOCX extended parts extractor；
  - comment/revision sidecar。

### 样式到语义结构映射

- 优先级：P1
- 当前暂缓原因：不同 DOCX 样式不稳定；先保留原始 style/numbering anchor。
- 触发条件：需要稳定生成章节级 Wiki 或长文 outline。
- 可能产物：
  - heading resolver；
  - numbering hierarchy builder；
  - section coverage summary。

---

## XLSX

### 合并单元格语义恢复

- 优先级：P1
- 当前暂缓原因：当前 row/cell anchor 能保留位置，但合并单元格上下文还未语义化。
- 触发条件：真实表格存在多级表头、合并区域、跨行分类。
- 可能产物：
  - merged-cell context propagation；
  - multi-row header resolver。

### 公式值与公式文本双轨

- 优先级：P2
- 当前暂缓原因：当前实验以事实定位为主，未处理计算语义。
- 触发条件：财务、预算、指标类表格进入 Wiki 或长文报告。
- 可能产物：
  - formula anchor；
  - cached value extraction；
  - formula lineage。

### 大表索引优化

- 优先级：P2
- 当前暂缓原因：当前样本能生成 row/cell anchor，但未验证百万级表格性能。
- 触发条件：大规模 Excel 进入项目库。
- 可能产物：
  - SQLite / Parquet sidecar；
  - row index paging；
  - column statistics。

---

## TXT / Long Document

### 自动章节发现

- 优先级：P1
- 当前暂缓原因：当前 TXT 实验用固定 chunk/overlap 证明覆盖率；章节发现属于更高质量阅读。
- 触发条件：需要从小说、报告、制度全文中生成章节级 Wiki 或长文大纲。
- 可能产物：
  - title pattern detector；
  - section boundary model；
  - section-level coverage summary。

### 低置信 chunk 审计

- 优先级：P1
- 当前暂缓原因：当前只证明 tail coverage，不评估每个 chunk 的事实密度和抽取质量。
- 触发条件：长文本进入 Wiki 生成或长文成稿。
- 可能产物：
  - low-confidence chunk queue；
  - chunk entity density audit；
  - repeat-read strategy。

### 尾部实体遗漏检测

- 优先级：P0
- 当前暂缓原因：统一证据层已证明 tail anchor 可定位；下一步真实闭环可结合具体材料验证。
- 触发条件：处理超长文本或长 DOCX 时。
- 可能产物：
  - tail coverage assertion；
  - late-section entity audit。

---

## Wiki / RAG / CoverageAudit

### Entity merge / alias resolution

- 优先级：P1
- 当前暂缓原因：当前闭环只验证 query→anchor，不做实体合并。
- 触发条件：进入 WikiCandidate 生成后，同一企业/机构/项目多处出现。
- 可能产物：
  - entity candidate graph；
  - alias resolver；
  - conflict queue。

### Evidence conflict detection

- 优先级：P2
- 当前暂缓原因：当前重点是防遗漏，不是冲突裁决。
- 触发条件：多个来源对同一事实给出不同值。
- 可能产物：
  - conflict detector；
  - confidence scoring；
  - review item merge。

### insufficient evidence 策略深化

- 优先级：P1
- 当前暂缓原因：当前烟测已有负例，但还未设计产品级交互。
- 触发条件：RAG/Chat/Wiki 生成使用证据层时。
- 可能策略：
  - 直接返回 insufficient evidence；
  - 触发补检索；
  - 降低置信度；
  - 加入 ReviewQueue；
  - 提醒用户补充材料。

### CoverageAudit 门禁

- 优先级：P0
- 当前暂缓原因：统一闭环已证明需要，但还未接入真实 Wiki 生成。
- 触发条件：下一步“第一批企业名单.xlsx”真实闭环。
- 可能产物：
  - declared anchor vs consumed anchor audit；
  - row/entity/fact coverage metrics；
  - missing field detector。

---

## DOCX-first Export / Draft

### evidence refs 写回 DOCX

- 优先级：P1
- 当前暂缓原因：当前工作重点是证据层，不是导出格式。
- 触发条件：DOCX-first 长文导出开始使用 EvidencePacket。
- 可能产物：
  - citation style；
  - hidden bookmark / comment / footnote refs；
  - export trace record。

### 长文 draft 与 EvidencePacket 对接

- 优先级：P1
- 当前暂缓原因：长文工程定位已经明确为混合路线，但还未生产化。
- 触发条件：开始实现 outline → section draft → merge → lint/review → DOCX export。
- 可能产物：
  - section evidence pack；
  - draft coverage lint；
  - unsupported claim detector。

---

## 格式扩展

### PPTX

- 优先级：P3
- 当前暂缓原因：用户已明确当前先不考虑 PPTX。
- 触发条件：PPTX 成为主要输入材料。
- 可能 selector：
  - slide；
  - shape；
  - text run；
  - speaker notes。

### Web page / HTML

- 优先级：P3
- 当前暂缓原因：当前重点是本地文件格式。
- 触发条件：网页材料进入 Wiki 主流程。
- 可能 selector：
  - URL；
  - DOM path；
  - text range；
  - captured timestamp。

---

## 当前最近可执行但暂缓的事项

以下事项有价值，但不应抢占下一步真实闭环：

1. PDF reading order / header-footer 清理。
2. DOCX 样式层级 resolver。
3. XLSX 合并单元格语义恢复。
4. TXT 自动章节发现。
5. insufficient evidence 产品交互策略。
6. DOCX export evidence refs。

下一步主目标仍建议是：

```text
第一批企业名单.xlsx
→ full row/cell SourceSidecar
→ EvidenceAnchorIndex
→ entity/fact candidates
→ omission audit
→ wiki candidate
→ 对比当前 wiki 缺失项
```
