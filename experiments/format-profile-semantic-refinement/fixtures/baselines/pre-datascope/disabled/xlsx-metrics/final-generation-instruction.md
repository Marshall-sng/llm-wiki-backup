# Generation Instruction: batch_35_xlsx_local_01_data_element

## 任务

根据该表格成品提炼表格结构、指标表达和可用于底稿生成的约束。

## 模式

先选择格式画像，再按画像生成底稿。

## 探测摘要

- Profile: profile_batch_35_xlsx_local_01_data_element
- 文件类型: xlsx
- 文档类型推断: 表格/指标分析
- 画像置信度: medium
- Snapshot: 4465418fc84c1dba50060c6b6c9caf1517896f63316339559a7ef0e7e42b1582
- 探测摘要: 工作表 1、共享字符串 65、字体 4、填充 3

## 临时调整

- experiment: phase2-batch
- formatBoundary: XLSX 用于表格结构和指标表达，不生成 Excel 成品。

## 写作约束

1. 优先满足用户目标，不把格式说明混入正文。
2. 持续遵守当前 FormatBinding；后续补写、改写和续写均默认继承该绑定。
3. 如果格式画像与用户材料冲突，保留用户事实，并在 diagnostics 中说明冲突。
4. 对 DOCX，优先生成正式文稿结构；对 XLSX，优先生成表格化分析；对 PPTX，优先生成逐页汇报底稿；对 PDF，仅作为参考成品。

## 画像约束

- 将该格式视为表格/指标表达参考，而不是普通长文皮肤。
- 工作表线索：Sheet1
- 输出底稿时优先组织为指标分组、字段口径、结论摘要和补充说明。

## 能力边界

- [info] probe.completed: Phase 2 已完成 XLSX 基础探测：工作表 1、共享字符串 65、字体 4、填充 3。
- [info] format.xlsx.boundary: XLSX 用作表格结构和指标表达参考，不在本阶段生成 Excel 成品。
