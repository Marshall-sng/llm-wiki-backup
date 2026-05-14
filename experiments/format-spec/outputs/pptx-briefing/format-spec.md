# FormatSpec：pptx-briefing

- 文件类型：PPTX
- 文档定位：汇报演示
- 置信度：medium

## 全局边界
- 来源事实优先于格式约束；不得根据格式画像虚构组织、金额、条款、结论或引用。
- FormatSpec 只约束结构、表达、排版和诊断，不承诺导出文件。
- FormatSpec 不承诺视觉还原；证据不足的字段必须降级为建议或诊断。
- 默认数据范围为 evidence-only；draft prompt 不展示 raw evidence 正文或证据转储。

## 详细格式规则
### pptx-deck-1 / deck
- 规则：以演示文稿页序组织内容。
- 细节：检测到约 31 页、62 个版式、1 个母版。
- 来源：detected；置信度：medium
- 证据：raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004

### pptx-theme-1 / theme
- 规则：主题只作为视觉风格线索。
- 细节：主题线索：Office 主题​​；颜色方案 3、字体方案 3。
- 来源：detected；置信度：medium
- 证据：profile.style.0001, profile.style.0002, profile.style.0003, profile.style.0004

### pptx-layout-1 / layout
- 规则：按封面、目录/过渡、内容、总结组织。
- 细节：无法稳定识别每页版式时，输出逐页大纲而非承诺复刻具体占位符。
- 来源：inferred；置信度：medium
- 证据：raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004

### pptx-cover-1 / cover-slide
- 规则：封面应包含主题、汇报对象或时间等必要字段。
- 细节：封面内容必须来自用户任务；不复用来源模板中的占位文本或示例署名。
- 来源：standard-default；置信度：high

### pptx-content-1 / content-slide
- 规则：每页聚焦一个主题。
- 细节：内容页标题保持短句；正文使用 3-5 个要点或一个图表/表格解释。
- 来源：standard-default；置信度：medium

### pptx-content-2 / content-slide
- 规则：避免把长文直接铺进幻灯片。
- 细节：若底稿是报告文字，应拆为页标题、核心观点、支撑事实、备注。
- 来源：standard-default；置信度：medium

### pptx-bullet-1 / bullet
- 规则：正文 bullet 保持并列和短句。
- 细节：每条要点建议一行表达一个判断；不要混用多个编号体系。
- 来源：standard-default；置信度：medium

### pptx-bullet-2 / bullet
- 规则：项目符号不生成新事实。
- 细节：bullet 只重组用户事实；不得补造数据、案例或结论。
- 来源：standard-default；置信度：high

### pptx-visual-density-1 / visual-density
- 规则：控制页面信息密度。
- 细节：图片/形状较多的模板线索意味着内容应更摘要化；文字页避免超过页面可读密度。
- 来源：inferred；置信度：medium
- 证据：raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004

### pptx-visual-density-2 / visual-density
- 规则：图表页需要标题、图示对象和结论句。
- 细节：没有图表数据时，只给图表占位建议，不生成伪图表数据。
- 来源：standard-default；置信度：high

### pptx-boundary-1 / boundary
- 规则：PPTX 画像用于汇报大纲和逐页草稿。
- 细节：不承诺生成 PPTX 文件，不承诺还原主题、动画、母版或图片位置。
- 来源：standard-default；置信度：high

### pptx-boundary-2 / boundary
- 规则：模板占位文本不得进入业务内容。
- 细节：来源中的示例占位词、人名、标题样例只作为模板诊断，不进入最终 prompt。
- 来源：inferred；置信度：high
- 证据：raw.pptx.slide.0001, raw.pptx.slide.0002, raw.pptx.slide.0003, raw.pptx.slide.0004
