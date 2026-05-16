# FormatSpec：docx-policy

- 文件类型：DOCX
- 文档定位：制度/正式文稿
- 置信度：medium

## 全局边界
- 来源事实优先于格式约束；不得根据格式画像虚构组织、金额、条款、结论或引用。
- FormatSpec 只约束结构、表达、排版和诊断，不承诺导出文件。
- FormatSpec 不承诺视觉还原；证据不足的字段必须降级为建议或诊断。
- 默认数据范围为 evidence-only；draft prompt 不展示 raw evidence 正文或证据转储。

## 详细格式规则
### docx-page-1 / page
- 规则：采用纵向成文页面规则。
- 细节：检测页尺寸约 21cm × 29.69cm；接近 A4 纵向时按正式文稿页面组织。
- 来源：detected；置信度：medium
- 证据：raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003

### docx-page-2 / page
- 规则：页边距只作为诊断线索。
- 细节：当前页边距探测值存在极端 twips 值时，不把它作为正式排版承诺；产品化时应显示为“边距证据不足/需人工确认”。
- 来源：inferred；置信度：medium
- 证据：raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003

### docx-title-1 / title
- 规则：主标题独立成行，表达文种和主题。
- 细节：标题不复用来源文件题名；生成或适配时由用户底稿事实决定标题内容。建议居中或显著区分于正文。
- 来源：standard-default；置信度：medium

### docx-title-2 / title
- 规则：标题层级与正文条款分离。
- 细节：候选标题过长或像正文条款时，应降级为条款/正文线索，不进入标题主线。
- 来源：inferred；置信度：high
- 证据：raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005

### docx-heading-1 / heading
- 规则：一级标题使用章/大节层级。
- 细节：制度/正式文稿可使用“第一章”“一、”等一级编号；一级标题应短，不承载完整条款正文。
- 来源：standard-default；置信度：medium

### docx-heading-2 / heading
- 规则：二级标题使用节/条款组层级。
- 细节：可使用“第一节”“（一）”等二级编号；二级标题用于组织事项类别，不写成完整业务说明。
- 来源：standard-default；置信度：medium

### docx-heading-3 / heading
- 规则：三级标题用于具体事项或条目。
- 细节：可使用“1.”“（1）”等序号；同一层级编号符号保持一致。
- 来源：standard-default；置信度：medium

### docx-numbering-1 / numbering
- 规则：条款编号必须连续且同层同形。
- 细节：当来源编号定义不足时，按文本语义保持章、条、款、项的顺序，不强行复制来源编号元数据。
- 来源：inferred；置信度：medium
- 证据：raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005

### docx-numbering-2 / numbering
- 规则：条款正文不被提升为标题。
- 细节：长句、金额阈值、适用范围和审批权限等内容应保留在正文条款内，不进入格式约束本身。
- 来源：inferred；置信度：high
- 证据：raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005

### docx-typography-1 / typography
- 规则：正文中文主字体优先采用检测到的正文样式字体。
- 细节：正文样式检测到 FangSong；全局字体统计如 Arial（377次） 只作兼容线索。
- 来源：detected；置信度：medium
- 证据：raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005

### docx-typography-2 / typography
- 规则：正文字号按检测到的正文样式换算为 pt。
- 细节：正文样式字号约 15.5pt；字号统计只作为辅助，不覆盖正文样式定义。
- 来源：detected；置信度：medium
- 证据：raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005

### docx-typography-3 / typography
- 规则：表格文字可小于正文。
- 细节：检测到表格文本样式字号约 10pt；表内文字应保证可读，不扩写为正文段落。
- 来源：detected；置信度：medium
- 证据：raw.docx.style.0001, raw.docx.style.0002, raw.docx.style.0003, raw.docx.style.0004, raw.docx.style.0005

### docx-paragraph-1 / paragraph
- 规则：正文段落按正式文稿段落组织。
- 细节：建议使用首行缩进、左对齐或两端对齐、稳定行距；不得因为来源候选标题多而把正文压成清单。
- 来源：standard-default；置信度：medium

### docx-paragraph-2 / paragraph
- 规则：段前段后保持克制。
- 细节：同一层级段落的间距应一致；标题前后可有区分，但不制造额外内容。
- 来源：standard-default；置信度：medium

### docx-table-1 / table
- 规则：表格承载清单、阈值、对照或审批矩阵。
- 细节：表格内容应保持短语化、字段化；表格事实来自用户底稿，不由格式画像补造。
- 来源：inferred；置信度：medium
- 证据：raw.docx.paragraph.0001, raw.docx.paragraph.0002, raw.docx.paragraph.0003, raw.docx.paragraph.0004, raw.docx.paragraph.0005

### docx-table-2 / table
- 规则：表格标题和表头需要与正文层级分离。
- 细节：表格标题可在表前单独说明；表头用于字段名，不混入正文条款编号。
- 来源：standard-default；置信度：medium

### docx-boundary-1 / boundary
- 规则：格式只约束写法，不提供来源正文内容。
- 细节：生成 prompt 不展示来源条款原文；只给标题层级、编号、字体字号、段落和表格规则。
- 来源：standard-default；置信度：high
