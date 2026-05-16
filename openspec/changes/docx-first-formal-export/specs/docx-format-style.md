# DOCX 格式样式

## 场景 1：样式策略解析

- Given: formatProfileSnapshot 含 FormatSpec rules
- When: 调用 `resolveDocxStylePolicy(snapshot)`
- Then: 返回 `DocxResolvedStylePolicy`
  - byDimension 包含 title.main / heading.level1-3 / paragraph.body 等维度的样式
  - pagePolicy 包含页边距信息

## 场景 2：adapter 应用样式

- Given: DocxIntermediateDocument 带 stylePolicy + formatDimensions
- When: TS adapter 渲染段落
- Then: 输出段落使用 stylePolicy 中对应维度的 fontFamily / fontSizeHalfPoints / lineSpacingTwips

## 场景 3：内联格式（粗体）保留

- Given: 底稿文本含 `**粗体标记**`
- When: adapter 渲染
- Then: DOCX 中对应文本为粗体
