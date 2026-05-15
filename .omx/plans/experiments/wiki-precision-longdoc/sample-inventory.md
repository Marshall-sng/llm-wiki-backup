# 多格式实验样本清单与适配性确认

- 样本根目录：`D:\llm_wiki\runtime\format-profile\samples`
- 全量文件数：40
- 格式分布：`{'pdf': 10, 'txt': 1, 'docx': 15, 'xlsx': 9, 'pptx': 5}`
- 分组分布：`{'top-level': 5, 'downloaded/docx': 7, 'downloaded/xlsx': 8, 'github/pptx': 5, 'local/docx': 8, 'local/pdf': 6, 'local/xlsx': 1}`

## 结论

- **满足本轮 DOCX / PDF / TXT / XLSX 多格式 Evidence Anchor 实验的基础样本需求。**
- DOCX 覆盖：普通制度文档、表格文档、多章节长 DOCX、含图片 DOCX。
- PDF 覆盖：政策/规范/Q&A/白皮书/平台介绍等真实材料；当前用启发式确认页数、图片对象和文本操作符，仍需在正式 PDF 抽取实验中接入真实文本抽取器复核。
- TXT 覆盖：存在超长 TXT，可用于尾部实体覆盖、章节/滑窗/遗漏审计实验。
- XLSX 覆盖：存在本地领域表格和公开结构样本，可用于 row/cell anchor、宽表、多 sheet、公式/样式保真相关实验。
- PPTX 已登记但按当前路线暂不纳入本轮实验。
- **缺口**：未确认存在真正扫描版/图片型 PDF；若后续要验证 OCR，应补充 1 个扫描 PDF。

## 推荐优先实验素材

### S001 `2026-05-05-000635-871634-易经杂说.pdf`
- 角色：pdf-anchor, long-pdf, pdf-images, pdf-extractability-unknown
- 大小：1086988 bytes
- 指标：`{"estimated_pages": 113, "stream_count": 1, "image_xobjects": 25, "text_operator_hits": 73, "compressed_stream_bytes_sampled": 200000, "non_ascii_runs_in_streams": 135378, "encrypted": true}`
- 备注：未安装 PDF 文本抽取库，当前只做页面/流/文本操作符启发式检查；需在实验中用真实抽取器复核。

### S002 `2026-05-05-000658-516931-《唐人的餐桌》.txt`
- 角色：txt-anchor, long-txt
- 大小：11929196 bytes
- 指标：`{"text_chars": 4442676, "lines": 172820, "estimated_headings": 0, "replacement_chars": 0, "tail_chars_available": 5000}`

### S003 `2026-05-05-000659-170243-政务数据共享条例_电子政务_中国政府网.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：211987 bytes
- 指标：`{"estimated_pages": 14, "stream_count": 25, "image_xobjects": 4, "text_operator_hits": 15417, "compressed_stream_bytes_sampled": 1067515, "non_ascii_runs_in_streams": 27044, "encrypted": false}`

### S004 `2026-05-05-000700-619047-政务数据目录治理工作Q&A20241213.pdf`
- 角色：pdf-anchor, pdf-text-like
- 大小：402108 bytes
- 指标：`{"estimated_pages": 20, "stream_count": 36, "image_xobjects": 0, "text_operator_hits": 15632, "compressed_stream_bytes_sampled": 1790805, "non_ascii_runs_in_streams": 57694, "encrypted": false}`

### S005 `2026-05-05-000702-449629-（试行）政务数据目录治理流程工作规范20241213.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：4020607 bytes
- 指标：`{"estimated_pages": 26, "stream_count": 70, "image_xobjects": 32, "text_operator_hits": 2891, "compressed_stream_bytes_sampled": 59031681, "non_ascii_runs_in_streams": 170953, "encrypted": false}`

### S006 `downloaded/docx/docx_web_01_formatted_report.docx`
- 角色：docx-anchor, docx-table, docx-structure
- 大小：22134 bytes
- 指标：`{"text_chars": 2295, "paragraphs": 91, "tables": 1, "table_rows": 4, "table_cells": 16, "heading_paragraphs": 16, "numbered_paragraphs": 30, "media_files": 0}`

### S007 `downloaded/docx/docx_web_02_table_rich.docx`
- 角色：docx-anchor, docx-table, docx-structure
- 大小：39301 bytes
- 指标：`{"text_chars": 2139, "paragraphs": 247, "tables": 5, "table_rows": 43, "table_cells": 229, "heading_paragraphs": 5, "numbered_paragraphs": 0, "media_files": 0}`

### S008 `downloaded/docx/docx_web_03_template_form_fields.docx`
- 角色：docx-anchor, docx-table, docx-structure
- 大小：38293 bytes
- 指标：`{"text_chars": 1433, "paragraphs": 76, "tables": 4, "table_rows": 16, "table_cells": 64, "heading_paragraphs": 4, "numbered_paragraphs": 0, "media_files": 0}`

### S010 `downloaded/docx/docx_web_05_multi_column.docx`
- 角色：docx-anchor, docx-table, docx-structure
- 大小：39955 bytes
- 指标：`{"text_chars": 4723, "paragraphs": 68, "tables": 1, "table_rows": 8, "table_cells": 32, "heading_paragraphs": 8, "numbered_paragraphs": 0, "media_files": 0}`

### S011 `downloaded/docx/docx_web_06_large_multisection.docx`
- 角色：docx-anchor, long-docx, docx-table, docx-structure
- 大小：67970 bytes
- 指标：`{"text_chars": 60820, "paragraphs": 1924, "tables": 29, "table_rows": 323, "table_cells": 1438, "heading_paragraphs": 108, "numbered_paragraphs": 0, "media_files": 0}`

### S012 `downloaded/docx/docx_web_07_image_document.docx`
- 角色：docx-anchor, docx-table, docx-media, docx-structure
- 大小：11317142 bytes
- 指标：`{"text_chars": 6265, "paragraphs": 99, "tables": 1, "table_rows": 7, "table_cells": 28, "heading_paragraphs": 7, "numbered_paragraphs": 0, "media_files": 6}`

### S017 `downloaded/xlsx/xlsx_web_05_HR_Sample_Dash.xlsx`
- 角色：xlsx-anchor, row-cell-anchor, wide-table, large-table, formula, multi-sheet
- 大小：78591 bytes
- 指标：`{"sheets": 2, "max_rows": 170, "max_columns": 53, "nonempty_cells": 116, "formula_cells": 7, "merged_ranges": 0}`

### S019 `downloaded/xlsx/xlsx_web_07_Page_Layout_Guide.xlsx`
- 角色：xlsx-anchor, row-cell-anchor, wide-table
- 大小：236293 bytes
- 指标：`{"sheets": 1, "max_rows": 51, "max_columns": 36, "nonempty_cells": 25, "formula_cells": 0, "merged_ranges": 0}`

### S020 `downloaded/xlsx/xlsx_web_08_Sales_Performance_Dashboard.xlsx`
- 角色：xlsx-anchor, row-cell-anchor, wide-table, large-table, formula, multi-sheet
- 大小：585325 bytes
- 指标：`{"sheets": 6, "max_rows": 1002, "max_columns": 41, "nonempty_cells": 48982, "formula_cells": 9008, "merged_ranges": 0}`

### S027 `local/docx/docx_local_02_org_notice_云数人 〔2023〕 4 号关于印发《云南省大数据有限公司组织架构及岗位编制设置方案》的通知.docx`
- 角色：docx-anchor, docx-table, docx-media
- 大小：190176 bytes
- 指标：`{"text_chars": 4773, "paragraphs": 374, "tables": 1, "table_rows": 14, "table_cells": 117, "heading_paragraphs": 0, "numbered_paragraphs": 0, "media_files": 5}`

### S029 `local/docx/docx_local_04_project_mgmt_云数综办〔2024〕4号关于印发《云南省大数据有限公司项目管理办法（暂行）》的通知.docx`
- 角色：docx-anchor, docx-table, docx-media
- 大小：135500 bytes
- 指标：`{"text_chars": 6608, "paragraphs": 680, "tables": 12, "table_rows": 78, "table_cells": 258, "heading_paragraphs": 0, "numbered_paragraphs": 0, "media_files": 3}`

### S030 `local/docx/docx_local_05_procurement_云数综办 〔2023〕 13 号关于印发《云南省大数据有限公司采购管理制度（暂行）》的通知.docx`
- 角色：docx-anchor, long-docx, docx-table, docx-media
- 大小：295529 bytes
- 指标：`{"text_chars": 12968, "paragraphs": 927, "tables": 15, "table_rows": 113, "table_cells": 404, "heading_paragraphs": 0, "numbered_paragraphs": 0, "media_files": 3}`

### S031 `local/docx/docx_local_06_finance_云数综办〔2023〕6号关于印发《云南省大数据有限公司财务管理制度（暂行）》等四个制度的通知.docx`
- 角色：docx-anchor, long-docx, docx-table, docx-media
- 大小：196722 bytes
- 指标：`{"text_chars": 23715, "paragraphs": 892, "tables": 3, "table_rows": 26, "table_cells": 115, "heading_paragraphs": 0, "numbered_paragraphs": 0, "media_files": 3}`

### S032 `local/docx/docx_local_07_assessment_云数发〔2024〕47号关于印发《云南省大数据有限公司经营业绩考核实施办法（试行）》的通知 (1).docx`
- 角色：docx-anchor, docx-table, docx-media
- 大小：114313 bytes
- 指标：`{"text_chars": 3912, "paragraphs": 287, "tables": 1, "table_rows": 5, "table_cells": 40, "heading_paragraphs": 0, "numbered_paragraphs": 0, "media_files": 3}`

### S033 `local/docx/docx_local_08_tech_plan_公共数据治理运营项目实施技术方案[196页Word].docx`
- 角色：docx-anchor, long-docx, docx-table, docx-media, docx-structure
- 大小：9121992 bytes
- 指标：`{"text_chars": 92273, "paragraphs": 6287, "tables": 62, "table_rows": 949, "table_cells": 4164, "heading_paragraphs": 0, "numbered_paragraphs": 449, "media_files": 78}`

### S034 `local/pdf/pdf_local_01_platform_intro_云南省数据流通利用基础设施平台介绍-0312.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：5209651 bytes
- 指标：`{"estimated_pages": 15, "stream_count": 141, "image_xobjects": 108, "text_operator_hits": 99, "compressed_stream_bytes_sampled": 40833397, "non_ascii_runs_in_streams": 137342, "encrypted": false}`

### S035 `local/pdf/pdf_local_02_national_report_《全国数据资源调查报告（2023年）》.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：1487803 bytes
- 指标：`{"estimated_pages": 32, "stream_count": 0, "image_xobjects": 2, "text_operator_hits": 34, "compressed_stream_bytes_sampled": 0, "non_ascii_runs_in_streams": 63482, "encrypted": false}`

### S036 `local/pdf/pdf_local_03_data_flow_whitepaper_《数据要素流通标准化白皮书（2024版）》.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：2116433 bytes
- 指标：`{"estimated_pages": 54, "stream_count": 67, "image_xobjects": 6, "text_operator_hits": 153, "compressed_stream_bytes_sampled": 1489884, "non_ascii_runs_in_streams": 308696, "encrypted": true}`

### S037 `local/pdf/pdf_local_04_regulation_政务数据共享条例_电子政务_中国政府网.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：211987 bytes
- 指标：`{"estimated_pages": 14, "stream_count": 25, "image_xobjects": 4, "text_operator_hits": 15417, "compressed_stream_bytes_sampled": 1067515, "non_ascii_runs_in_streams": 27044, "encrypted": false}`

### S038 `local/pdf/pdf_local_05_standard_GB T 18391.1 信息技术 数据元的规范和标准化.pdf`
- 角色：pdf-anchor, pdf-images, pdf-text-like
- 大小：1098658 bytes
- 指标：`{"estimated_pages": 11, "stream_count": 53, "image_xobjects": 11, "text_operator_hits": 75, "compressed_stream_bytes_sampled": 12377401, "non_ascii_runs_in_streams": 190902, "encrypted": false}`

### S039 `local/pdf/pdf_local_06_qa_政务数据目录治理工作Q&A20241213.pdf`
- 角色：pdf-anchor, pdf-text-like
- 大小：402108 bytes
- 指标：`{"estimated_pages": 20, "stream_count": 36, "image_xobjects": 0, "text_operator_hits": 15632, "compressed_stream_bytes_sampled": 1790805, "non_ascii_runs_in_streams": 57694, "encrypted": false}`

### S040 `local/xlsx/xlsx_local_01_data_element_数据元定义标准.xlsx`
- 角色：xlsx-anchor, row-cell-anchor
- 大小：11209 bytes
- 指标：`{"sheets": 1, "max_rows": 29, "max_columns": 3, "nonempty_cells": 65, "formula_cells": 0, "merged_ranges": 5}`

## 全量清单

| ID | 格式 | 分组 | 文件 | 状态 | 角色 | 关键指标 |
|---|---|---|---|---|---|---|
| S001 | pdf | top-level | `2026-05-05-000635-871634-易经杂说.pdf` | candidate | pdf-anchor, long-pdf, pdf-images, pdf-extractability-unknown | `{"estimated_pages": 113, "text_operator_hits": 73}` |
| S002 | txt | top-level | `2026-05-05-000658-516931-《唐人的餐桌》.txt` | candidate | txt-anchor, long-txt | `{"text_chars": 4442676, "lines": 172820}` |
| S003 | pdf | top-level | `2026-05-05-000659-170243-政务数据共享条例_电子政务_中国政府网.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 14, "text_operator_hits": 15417}` |
| S004 | pdf | top-level | `2026-05-05-000700-619047-政务数据目录治理工作Q&A20241213.pdf` | candidate | pdf-anchor, pdf-text-like | `{"estimated_pages": 20, "text_operator_hits": 15632}` |
| S005 | pdf | top-level | `2026-05-05-000702-449629-（试行）政务数据目录治理流程工作规范20241213.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 26, "text_operator_hits": 2891}` |
| S006 | docx | downloaded/docx | `docx_web_01_formatted_report.docx` | candidate | docx-anchor, docx-table, docx-structure | `{"text_chars": 2295, "paragraphs": 91, "tables": 1, "table_rows": 4, "media_files": 0}` |
| S007 | docx | downloaded/docx | `docx_web_02_table_rich.docx` | candidate | docx-anchor, docx-table, docx-structure | `{"text_chars": 2139, "paragraphs": 247, "tables": 5, "table_rows": 43, "media_files": 0}` |
| S008 | docx | downloaded/docx | `docx_web_03_template_form_fields.docx` | candidate | docx-anchor, docx-table, docx-structure | `{"text_chars": 1433, "paragraphs": 76, "tables": 4, "table_rows": 16, "media_files": 0}` |
| S009 | docx | downloaded/docx | `docx_web_04_bullets_lists.docx` | candidate | docx-anchor, docx-structure | `{"text_chars": 4951, "paragraphs": 87, "tables": 0, "table_rows": 0, "media_files": 0}` |
| S010 | docx | downloaded/docx | `docx_web_05_multi_column.docx` | candidate | docx-anchor, docx-table, docx-structure | `{"text_chars": 4723, "paragraphs": 68, "tables": 1, "table_rows": 8, "media_files": 0}` |
| S011 | docx | downloaded/docx | `docx_web_06_large_multisection.docx` | candidate | docx-anchor, long-docx, docx-table, docx-structure | `{"text_chars": 60820, "paragraphs": 1924, "tables": 29, "table_rows": 323, "media_files": 0}` |
| S012 | docx | downloaded/docx | `docx_web_07_image_document.docx` | candidate | docx-anchor, docx-table, docx-media, docx-structure | `{"text_chars": 6265, "paragraphs": 99, "tables": 1, "table_rows": 7, "media_files": 6}` |
| S013 | xlsx | downloaded/xlsx | `xlsx_web_01_formula_recalc_sample.xlsx` | candidate | xlsx-anchor, row-cell-anchor, formula | `{"sheets": 1, "max_rows": 4, "max_columns": 4}` |
| S014 | xlsx | downloaded/xlsx | `xlsx_web_02_inventory_two_sheet_sample.xlsx` | candidate | xlsx-anchor, row-cell-anchor, multi-sheet | `{"sheets": 2, "max_rows": 4, "max_columns": 3}` |
| S015 | xlsx | downloaded/xlsx | `xlsx_web_03_monthly_budget_sample.xlsx` | candidate | xlsx-anchor, row-cell-anchor, formula | `{"sheets": 1, "max_rows": 5, "max_columns": 3}` |
| S016 | xlsx | downloaded/xlsx | `xlsx_web_04_wide_table_sample.xlsx` | candidate | xlsx-anchor, row-cell-anchor | `{"sheets": 1, "max_rows": 6, "max_columns": 14}` |
| S017 | xlsx | downloaded/xlsx | `xlsx_web_05_HR_Sample_Dash.xlsx` | candidate | xlsx-anchor, row-cell-anchor, wide-table, large-table, formula, multi-sheet | `{"sheets": 2, "max_rows": 170, "max_columns": 53}` |
| S018 | xlsx | downloaded/xlsx | `xlsx_web_06_Table_Style_Guide.xlsx` | candidate | xlsx-anchor, row-cell-anchor | `{"sheets": 1, "max_rows": 47, "max_columns": 14}` |
| S019 | xlsx | downloaded/xlsx | `xlsx_web_07_Page_Layout_Guide.xlsx` | candidate | xlsx-anchor, row-cell-anchor, wide-table | `{"sheets": 1, "max_rows": 51, "max_columns": 36}` |
| S020 | xlsx | downloaded/xlsx | `xlsx_web_08_Sales_Performance_Dashboard.xlsx` | candidate | xlsx-anchor, row-cell-anchor, wide-table, large-table, formula, multi-sheet | `{"sheets": 6, "max_rows": 1002, "max_columns": 41}` |
| S021 | pptx | github/pptx | `pptx_github_01_手绘风通用模板.pptx` | excluded-current-round | pptx-inventory-only | `{"text_chars": 0, "slides": 0, "media_files": 13}` |
| S022 | pptx | github/pptx | `pptx_github_02_南京信息工程大学-李想-答辩通用PPT模板.pptx` | excluded-current-round | pptx-inventory-only | `{"text_chars": 0, "slides": 0, "media_files": 28}` |
| S023 | pptx | github/pptx | `pptx_github_03_武汉船舶职业技术学院-袁治民-答辩通用PPT模板.pptx` | excluded-current-round | pptx-inventory-only | `{"text_chars": 0, "slides": 0, "media_files": 14}` |
| S024 | pptx | github/pptx | `pptx_github_04_品牌宣传商务风通用模板.pptx` | excluded-current-round | pptx-inventory-only | `{"text_chars": 0, "slides": 0, "media_files": 28}` |
| S025 | pptx | github/pptx | `pptx_github_05_公司介绍高端实用商务通用模板.pptx` | excluded-current-round | pptx-inventory-only | `{"text_chars": 0, "slides": 0, "media_files": 19}` |
| S026 | docx | local/docx | `docx_local_01_talktrack_云南省数据流通基础设施平台沟通话术.docx` | candidate | docx-anchor, docx-structure | `{"text_chars": 4870, "paragraphs": 69, "tables": 0, "table_rows": 0, "media_files": 0}` |
| S027 | docx | local/docx | `docx_local_02_org_notice_云数人 〔2023〕 4 号关于印发《云南省大数据有限公司组织架构及岗位编制设置方案》的通知.docx` | candidate | docx-anchor, docx-table, docx-media | `{"text_chars": 4773, "paragraphs": 374, "tables": 1, "table_rows": 14, "media_files": 5}` |
| S028 | docx | local/docx | `docx_local_03_strategy_云数发〔2024〕1号关于印发《云南省大数据有限公司战略规划管理制度》的通知.docx` | candidate | docx-anchor, docx-media | `{"text_chars": 4902, "paragraphs": 247, "tables": 0, "table_rows": 0, "media_files": 3}` |
| S029 | docx | local/docx | `docx_local_04_project_mgmt_云数综办〔2024〕4号关于印发《云南省大数据有限公司项目管理办法（暂行）》的通知.docx` | candidate | docx-anchor, docx-table, docx-media | `{"text_chars": 6608, "paragraphs": 680, "tables": 12, "table_rows": 78, "media_files": 3}` |
| S030 | docx | local/docx | `docx_local_05_procurement_云数综办 〔2023〕 13 号关于印发《云南省大数据有限公司采购管理制度（暂行）》的通知.docx` | candidate | docx-anchor, long-docx, docx-table, docx-media | `{"text_chars": 12968, "paragraphs": 927, "tables": 15, "table_rows": 113, "media_files": 3}` |
| S031 | docx | local/docx | `docx_local_06_finance_云数综办〔2023〕6号关于印发《云南省大数据有限公司财务管理制度（暂行）》等四个制度的通知.docx` | candidate | docx-anchor, long-docx, docx-table, docx-media | `{"text_chars": 23715, "paragraphs": 892, "tables": 3, "table_rows": 26, "media_files": 3}` |
| S032 | docx | local/docx | `docx_local_07_assessment_云数发〔2024〕47号关于印发《云南省大数据有限公司经营业绩考核实施办法（试行）》的通知 (1).docx` | candidate | docx-anchor, docx-table, docx-media | `{"text_chars": 3912, "paragraphs": 287, "tables": 1, "table_rows": 5, "media_files": 3}` |
| S033 | docx | local/docx | `docx_local_08_tech_plan_公共数据治理运营项目实施技术方案[196页Word].docx` | candidate | docx-anchor, long-docx, docx-table, docx-media, docx-structure | `{"text_chars": 92273, "paragraphs": 6287, "tables": 62, "table_rows": 949, "media_files": 78}` |
| S034 | pdf | local/pdf | `pdf_local_01_platform_intro_云南省数据流通利用基础设施平台介绍-0312.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 15, "text_operator_hits": 99}` |
| S035 | pdf | local/pdf | `pdf_local_02_national_report_《全国数据资源调查报告（2023年）》.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 32, "text_operator_hits": 34}` |
| S036 | pdf | local/pdf | `pdf_local_03_data_flow_whitepaper_《数据要素流通标准化白皮书（2024版）》.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 54, "text_operator_hits": 153}` |
| S037 | pdf | local/pdf | `pdf_local_04_regulation_政务数据共享条例_电子政务_中国政府网.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 14, "text_operator_hits": 15417}` |
| S038 | pdf | local/pdf | `pdf_local_05_standard_GB T 18391.1 信息技术 数据元的规范和标准化.pdf` | candidate | pdf-anchor, pdf-images, pdf-text-like | `{"estimated_pages": 11, "text_operator_hits": 75}` |
| S039 | pdf | local/pdf | `pdf_local_06_qa_政务数据目录治理工作Q&A20241213.pdf` | candidate | pdf-anchor, pdf-text-like | `{"estimated_pages": 20, "text_operator_hits": 15632}` |
| S040 | xlsx | local/xlsx | `xlsx_local_01_data_element_数据元定义标准.xlsx` | candidate | xlsx-anchor, row-cell-anchor | `{"sheets": 1, "max_rows": 29, "max_columns": 3}` |

## 使用约定

- 本清单只整理实验素材，不代表生产 pipeline 已支持这些格式。
- 实验记录需引用样本 ID，避免路径变动造成记录不可追踪。
- PDF 文本可抽取性目前为启发式判断；正式实验需记录抽取器、版本、失败样本和 fallback。
