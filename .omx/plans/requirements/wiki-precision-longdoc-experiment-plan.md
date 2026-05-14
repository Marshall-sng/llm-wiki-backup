# Wiki 精准生成与长文工程实验计划（先计划后执行）

本文件先于实验执行创建。所有实验产物写入 `experiments/wiki-precision-longdoc/artifacts/`。

## E1：Excel 表格完整抽取实验

- 架构问题：Excel 是否必须有 row/cell 级 structured extraction sidecar？
- 输入：`D:/大数据公司工作/数据流通/数据流通/raw/sources/第一批企业名单.xlsx`
- 步骤：
  1. 读取 workbook、sheet、row、cell。
  2. 保留 sheetName、excelRowNumber、originalSerial/projectId、headers、cell values。
  3. 提取企业、项目、联系人、电话、行业、来源工作表。
  4. 与现有 `wiki/sources/第一批企业名单.md` 对比。
- 预期输出：`first-batch-enterprises.structured.json` 与 `first-batch-enterprises.audit.json`。
- 验证方式：
  - 第一张表应保留 18 条企业记录。
  - 原始序号顺序应保留 `1,2,3,4,6,7,8,5,...,18,15,16,17`。
  - 第二张表应保留项目编号 `12,23,24,39`。
  - 审计应能发现 wiki summary 重排序、字段缺失或项目编号改写。
- 失败判据：不能读取真实 xlsx；无法保留原始行号/序号；无法生成 anchors。
- 若失败：退回 converted markdown 解析，但标记 fidelity 降级。

## E2：超长文本尾部实体覆盖实验

- 架构问题：固定 50k 截断是否会漏尾部实体？chunk coverage 是否必要？
- 输入：合成 160k+ 字符文本，尾部放置唯一实体 `TAIL_ENTITY_最终章节关键实体`。
- 步骤：比较 naive first-50000 与 chunked full coverage。
- 预期输出：`long-text-tail-coverage.json`。
- 验证方式：naive 不命中尾部实体；chunked 命中并给出 char range。
- 失败判据：chunked 不能覆盖尾部。

## E3：EvidenceAnchor 模型实验

- 架构问题：统一 evidence anchor 是否可行，还是需要分类型 anchor + 统一接口？
- 输入：E1 表格结果、E2 文本结果、模拟 PDF/DOCX/PPTX anchors。
- 预期输出：`evidence-anchor-samples.json` 与 `schemas/evidence-anchor.schema.json`。
- 验证方式：每个 anchor 都能表达 sourceId、format、locator、snippet/hash、resolver hints。
- 失败判据：表格或 Office/PDF 定位无法表达。

## E4：精准检索 / insufficient-evidence 实验

- 架构问题：structured + lexical 检索能否返回 row anchor，并在无证据时显式不足？
- 输入：E1 structured rows、E2 long chunks。
- 查询：
  - `云南白药 联系人`
  - `火星矿产权属审批时限`
- 预期输出：`retrieval-smoke.json`。
- 验证方式：第一个查询返回云南白药相关 row anchors；第二个返回 insufficient_evidence。
- 失败判据：无证据查询仍返回伪匹配。

## E5：Wiki 覆盖率 / 遗漏审计实验

- 架构问题：能否从 source facts 自动生成 review items？
- 输入：E1 structured rows + 当前 wiki source page/entity file names。
- 预期输出：`wiki-coverage-audit.json`。
- 验证方式：发现 serial rewrite、project id rewrite、field loss、exact entity name mismatch 等。
- 失败判据：审计无法发现已知问题。

## E6：长文生成工程实验

- 架构问题：长文工程应依赖底层 evidence packets 还是独立读取材料？
- 输入：E1/E2 evidence anchors。
- 步骤：生成一个模拟 LongDocumentProject plan：outline、section plan、per-section evidence refs、merge policy。
- 预期输出：`long-document-project-skeleton.json`。
- 验证方式：每个 section 都有 evidence refs；不允许 single_response_only。
- 失败判据：section 无证据或无法回溯。

## 实验记录要求

每个实验执行后，必须在 `experiment-results.md` 中记录：实际步骤、产物路径、验证结果、支持/削弱/推翻的假设、evidence/inference/unknown。
