# FormatSpec：xlsx-metrics

- 文件类型：XLSX
- 文档定位：表格/指标分析
- 置信度：medium

## 全局边界
- 来源事实优先于格式约束；不得根据格式画像虚构组织、金额、条款、结论或引用。
- FormatSpec 只约束结构、表达、排版和诊断，不承诺导出文件。
- FormatSpec 不承诺视觉还原；证据不足的字段必须降级为建议或诊断。
- 默认数据范围为 evidence-only；draft prompt 不展示 raw evidence 正文或证据转储。

## 详细格式规则
### xlsx-workbook-1 / workbook
- 规则：以工作簿/工作表为最高组织单元。
- 细节：检测到工作表区域线索 A1:C29；输出应围绕表格结构和指标口径，而不是改写成长文。
- 来源：detected；置信度：medium
- 证据：raw.xlsx.sheet.0001, profile.structure.0001

### xlsx-sheet-1 / sheet
- 规则：工作表命名只作为定位线索。
- 细节：不根据工作表名推断不存在的业务主题；主题必须来自用户任务或底稿。
- 来源：detected；置信度：medium
- 证据：raw.xlsx.sheet.0001, profile.structure.0001

### xlsx-table-region-1 / table-region
- 规则：区分标题区、表头区、数据区和备注/合计区。
- 细节：当只有区域维度证据时，默认按首行/前若干行可能为标题或表头处理，并在诊断中提示需确认。
- 来源：inferred；置信度：medium
- 证据：raw.xlsx.sheet.0001, profile.structure.0001

### xlsx-header-1 / header
- 规则：表头应短、字段化、同列口径一致。
- 细节：生成表格说明时应优先解释字段关系、单位和统计口径，不擅自改列名。
- 来源：standard-default；置信度：medium

### xlsx-data-region-1 / data-region
- 规则：数据区保持行列关系。
- 细节：不得把单元格事实打散为无序段落；观察结论应能追溯到行/列维度。
- 来源：standard-default；置信度：high

### xlsx-style-1 / style
- 规则：单元格样式统计作为复杂度线索。
- 细节：检测到字体数 4、填充数 3、边框数 5。
- 来源：detected；置信度：medium
- 证据：profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004

### xlsx-style-2 / style
- 规则：样式差异不能自动解释为业务含义。
- 细节：颜色、边框、填充只能提示层级或强调可能性；不能自动推断风险等级、状态或结论。
- 来源：standard-default；置信度：high

### xlsx-formula-1 / formula
- 规则：公式和合计必须保持事实边界。
- 细节：若探测不到公式明细，只能提示“公式证据不足”；不得自动计算、补齐或重写指标。
- 来源：inferred；置信度：high
- 证据：profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004

### xlsx-number-format-1 / number-format
- 规则：金额、比例、日期、数量必须保留单位。
- 细节：生成说明时要显式保留用户给出的单位和口径；未知单位不得补造。
- 来源：standard-default；置信度：high

### xlsx-number-format-2 / number-format
- 规则：数字格式优先服务可读性。
- 细节：百分比、金额和日期的格式应在底稿中统一说明；不输出伪 Excel 公式。
- 来源：standard-default；置信度：medium

### xlsx-boundary-1 / boundary
- 规则：XLSX 画像只指导表格类底稿。
- 细节：可生成指标说明、口径解释、观察要点；不承诺生成或导出电子表格文件。
- 来源：standard-default；置信度：high

### xlsx-boundary-2 / boundary
- 规则：不把样式统计转成业务事实。
- 细节：共享字符串数量 65 只说明文本规模，不说明业务重要性。
- 来源：detected；置信度：medium
- 证据：profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004
