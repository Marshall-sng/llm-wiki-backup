# Phase 1B 多格式 Evidence Anchor 实验执行记录

## 总结论

- evidence：DOCX、TXT、XLSX 已生成可复查的结构化 anchor sidecar 样例。
- evidence：PDF 已生成 page-anchor skeleton 与抽取质量诊断；OCR 暂按要求不处理。
- inference：当前最优路线仍是 `EvidenceAnchor-first + StructuredExtraction sidecar + CoverageAudit`，但 PDF 需要真实 text-span 抽取器才能进入与 DOCX/XLSX/TXT 同等级别的精准定位。
- unknown：PDF text block / char range 的稳定性尚未验证；扫描 PDF/OCR 暂不进入本轮判断。

## 产物

- `experiments/wiki-precision-longdoc/artifacts/multiformat/docx-anchor-samples.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/txt-anchor-samples.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/pdf-extraction-diagnostics.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/xlsx-anchor-samples.json`
- `experiments/wiki-precision-longdoc/artifacts/multiformat/multiformat-experiment-summary.json`

## 状态概览

| 实验 | 状态 | 关键证据 |
|---|---|---|
| DOCX paragraph/table/cell anchor | passed | S007 anchors=289; S011 anchors=2221; S033 anchors=6866 |
| TXT line/char/chunk coverage | passed | S002 chunks=234 tail=True |
| PDF page-anchor diagnostic | partial | S003 diagnostic-pass: text-like-pdf-but-no-page-text-extractor; S004 diagnostic-pass: text-like-pdf-but-no-page-text-extractor; S036 insufficient-extraction: encrypted-or-permission-limited; S001 insufficient-extraction: encrypted-or-permission-limited |
| XLSX row/cell anchor | passed | S040 cells=65; S020 cells=48982 |

## DOCX 实验

要验证的问题：DOCX 是否能以 paragraph/table/row/cell 形成稳定 evidence anchor。

- S007 `downloaded/docx/docx_web_02_table_rich.docx`：passed，paragraph=18，table=5，row=43，cell=229，anchor=289。
- S011 `downloaded/docx/docx_web_06_large_multisection.docx`：passed，paragraph=486，table=29，row=323，cell=1438，anchor=2221。
- S033 `local/docx/docx_local_08_tech_plan_公共数据治理运营项目实施技术方案[196页Word].docx`：passed，paragraph=1820，table=62，row=949，cell=4164，anchor=6866。

inference：DOCX 不应只转纯 Markdown；应保留 paragraph/table/cell 结构 sidecar，再让 Wiki 生成引用 anchor。

## TXT 实验

- S002 `2026-05-05-000658-516931-《唐人的餐桌》.txt`：passed，chars=4442676，lines=172820，chunks=234，tail_covered=True。

inference：TXT 长文需要 line/char/chunk 三层 anchor；仅靠一次 Chat 或开头摘要无法证明完整覆盖。

## PDF 实验

- S003 `2026-05-05-000659-170243-政务数据共享条例_电子政务_中国政府网.pdf`：passed-diagnostic，status=diagnostic-pass: text-like-pdf-but-no-page-text-extractor，pages=14，text_ops=15417，images=4。
- S004 `2026-05-05-000700-619047-政务数据目录治理工作Q&A20241213.pdf`：passed-diagnostic，status=diagnostic-pass: text-like-pdf-but-no-page-text-extractor，pages=20，text_ops=15632，images=0。
- S036 `local/pdf/pdf_local_03_data_flow_whitepaper_《数据要素流通标准化白皮书（2024版）》.pdf`：needs-review，status=insufficient-extraction: encrypted-or-permission-limited，pages=54，text_ops=153，images=6。
- S001 `2026-05-05-000635-871634-易经杂说.pdf`：needs-review，status=insufficient-extraction: encrypted-or-permission-limited，pages=113，text_ops=73，images=25。

inference：PDF 可以先建立 page anchor 与抽取质量门禁；但要达到精准定位，需要后续接入真实 PDF text-span/block 抽取器。OCR 暂不处理。

## XLSX 实验

- S040 `local/xlsx/xlsx_local_01_data_element_数据元定义标准.xlsx`：passed，sheets=1，grid_cells=87，nonempty_cells=65。
- S020 `downloaded/xlsx/xlsx_web_08_Sales_Performance_Dashboard.xlsx`：passed，sheets=6，grid_cells=88955，nonempty_cells=48982。

inference：XLSX 必须保留 sheet/row/cell anchor；这正是修复“第一批企业名单.xlsx”行级事实丢失的关键。

## 对目标架构的影响

1. EvidenceAnchor 应采用统一接口 + 分类型 selector：
   - DOCX：paragraph/table/row/cell。
   - TXT：line/char/chunk。
   - PDF：page，后续扩展 block/span/position。
   - XLSX：sheet/row/column/cell。
2. converted markdown 只能作为可读中间表达，不能作为唯一事实层。
3. Wiki 生成前应先有 sidecar coverage summary，再进入候选实体/事实生成和遗漏审计。
4. PDF 在未完成 text-span 抽取前，应进入 `partial / needs-review`，不能静默当作完整材料。

## 下一步最小闭环

1. 把 DOCX/TXT/XLSX sidecar 数据结构收敛成一个 TypeScript schema 草案。
2. 用“第一批企业名单.xlsx”补一个 row/cell anchor 到 WikiCandidate 的闭环实验。
3. 为 PDF 选择或实现 text-span 抽取器；OCR 后置。
4. 将 CoverageAudit 作为 Wiki 生成前置门禁，而不是事后人工发现遗漏。
