# Phase 1B：DOCX / PDF / TXT / XLSX 多格式 Evidence Anchor 实验计划

## 目标

验证“EvidenceAnchor-first + StructuredExtraction sidecar + CoverageAudit”路线是否能从 Excel 扩展到 DOCX、PDF、TXT 等主要素材格式，并为后续 Wiki 精准生成、精准定位、精准检索和 DOCX-first 导出提供充分依据。

## 输入样本

样本根目录：

```text
D:\llm_wiki\runtime\format-profile\samples
```

全量样本登记：

- 清单文档：`.omx/plans/experiments/wiki-precision-longdoc/sample-inventory.md`
- 机器清单：`experiments/wiki-precision-longdoc/artifacts/multiformat/sample-manifest.json`

样本覆盖结论：

- DOCX：15 个，覆盖普通制度文档、表格文档、长文档、含图片文档。
- PDF：10 个，覆盖政策、规范、Q&A、白皮书、平台介绍；缺少已确认的扫描版 PDF。
- TXT：1 个，超长文本，适合尾部覆盖和长文阅读策略实验。
- XLSX：9 个，覆盖本地领域表格、宽表、多 sheet、公式样本。
- PPTX：5 个，仅登记库存，本轮暂不纳入。

## 实验前置约束

1. 先做只读抽取与 sidecar 输出，不改主线生产代码。
2. 所有实验记录引用样本 ID，避免直接依赖易变文件名。
3. 证据记录必须区分：
   - evidence：脚本/抽取器直接产出；
   - inference：基于 evidence 的判断；
   - unknown：当前无法确认的部分。
4. PDF 文本可抽取性当前仅做启发式检测；正式实验需要记录实际抽取器与失败样本。

## 样本分层

### A. DOCX Anchor 实验

优先样本：

- S007 `downloaded/docx/docx_web_02_table_rich.docx`
  - 验证 paragraph/table/row/cell anchor。
- S011 `downloaded/docx/docx_web_06_large_multisection.docx`
  - 验证多章节、长文覆盖、结构化分块。
- S033 `local/docx/docx_local_08_tech_plan_公共数据治理运营项目实施技术方案[196页Word].docx`
  - 验证真实领域长 DOCX、图片、表格、编号段落、大规模证据锚点。
- S030 / S031
  - 验证制度类文档表格与条款定位。

验证问题：

1. DOCX 是否应以 paragraph/table/cell 为基础 evidence anchor？
2. 对长 DOCX，heading/numbering/table 是否足以形成稳定章节索引？
3. 图片或嵌入媒体是否必须进入 sidecar，还是先只记录 media anchor？
4. DOCX anchor 能否支撑未来 DOCX-first export 的反向引用？

成功标准：

- 能生成段落、表格、行、单元格级 anchor。
- 能输出 coverage summary：段落数、表格数、单元格数、已抽取事实数、未处理对象数。
- 对指定实体/条款能回溯到 DOCX anchor。

失败判据：

- 只能得到纯文本，无法定位到 paragraph/table/cell。
- 长 DOCX 只处理开头，无法覆盖尾部。
- 表格单元格与文本事实混淆，无法保留行列上下文。

### B. PDF Anchor 实验

优先样本：

- S003 / S037 `政务数据共享条例`
  - 验证同内容多路径样本的一致性。
- S004 / S039 `政务数据目录治理工作Q&A`
  - 验证 Q&A 结构、问答定位和检索。
- S036 `数据要素流通标准化白皮书`
  - 验证中长 PDF、图文混排、章节覆盖。
- S001 `易经杂说.pdf`
  - 验证长 PDF / 加密或抽取不确定样本的失败处理。

验证问题：

1. PDF 最小 anchor 应采用 page/text-block/char-range，还是 page + extracted-span 即可？
2. 图文混排 PDF 是否需要 block/position 信息才可满足精准定位？
3. 遇到加密、扫描或低文本可抽取性 PDF，应如何进入 review queue？
4. PDF 文本抽取结果是否能与 Wiki 证据引用稳定绑定？

成功标准：

- 能记录 page-level anchor。
- 对文本型 PDF，能输出 page + text span。
- 对抽取失败或不确定 PDF，能输出 insufficient extraction / needs OCR / needs review，而不是静默丢失。

失败判据：

- 抽取失败被当作空文档或摘要成功。
- 无法说明事实来自哪一页。
- 无法发现 PDF 抽取质量不足。

### C. TXT 长文覆盖实验

优先样本：

- S002 `2026-05-05-000658-516931-《唐人的餐桌》.txt`
  - 约 444 万字符、172820 行。

验证问题：

1. 对无显式 Markdown 标题的超长 TXT，chunk/sliding window/章节发现策略哪种更可靠？
2. 是否能稳定覆盖尾部实体，而不是只读开头？
3. coverage summary 应记录哪些指标：字符区间、行区间、chunk 序号、实体发现分布、尾部覆盖率？
4. 长文 Wiki 生成是否需要先产出 EvidencePacket，再由 WikiCompiler 合并？

成功标准：

- 能形成 line/char/chunk anchor。
- 能证明首部、中部、尾部均被处理。
- 能输出遗漏审计输入，如每个 chunk 的实体候选、低置信片段、未合并实体。

失败判据：

- 生成过程只覆盖开头或随机片段。
- 无法证明尾部是否处理。
- 无法把实体定位回行号或字符区间。

### D. XLSX Row/Cell Anchor 复核实验

优先样本：

- S040 `local/xlsx/xlsx_local_01_data_element_数据元定义标准.xlsx`
  - 验证领域表格 row/cell anchor。
- S020 `downloaded/xlsx/xlsx_web_08_Sales_Performance_Dashboard.xlsx`
  - 验证多 sheet、宽表、公式和大表。
- S017 `downloaded/xlsx/xlsx_web_05_HR_Sample_Dash.xlsx`
  - 验证 dashboard/公式/宽表混合。

验证问题：

1. row/cell anchor 是否能覆盖“第一批企业名单.xlsx”暴露的问题类型？
2. 大表/宽表是否需要 schema-on-read、SQLite/Parquet sidecar 或 DataFrame JSON？
3. 公式、样式、合并单元格对事实抽取和定位有什么影响？

成功标准：

- 每行事实都可回溯 sheet/row/column/cell。
- 能输出未抽取列、空值列、疑似主键列、重复实体。
- 能保留原始序号或稳定行号。

失败判据：

- 只能生成摘要型 source page。
- 表格行级事实丢失。
- 联系人、电话、项目编号等列无法进入 Wiki 候选。

## 第一轮最小执行顺序

1. 读取 `sample-manifest.json`，建立样本 ID 到路径映射。
2. 对 S007 / S011 / S033 做 DOCX anchor sidecar 原型。
3. 对 S002 做 TXT chunk/line/char anchor 原型。
4. 对 S003 / S004 / S036 / S001 做 PDF 抽取质量诊断。
5. 对 S040 / S020 做 XLSX row/cell anchor 复核。
6. 汇总为统一或分类型 EvidenceAnchor 模型建议。
7. 更新实验执行记录，标注 evidence / inference / unknown。

## 预期产物

- `experiments/wiki-precision-longdoc/artifacts/multiformat/docx-anchor-samples.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/txt-anchor-samples.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/pdf-extraction-diagnostics.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/xlsx-anchor-samples.json`
- `.omx/plans/experiments/wiki-precision-longdoc/multiformat-experiment-results.md`

## 当前判断

这批样本已经足以启动 DOCX / PDF / TXT / XLSX 多格式前置实验。唯一明确缺口是扫描 PDF / OCR 场景；该缺口不阻塞当前 evidence-anchor-first 路线验证，但应在后续 OCR 研究时补样。
