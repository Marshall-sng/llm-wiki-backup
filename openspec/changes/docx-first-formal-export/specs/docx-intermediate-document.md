# DocxIntermediateDocument

## 场景 1：底稿 markdown 转中间文档

- Given: 一个 DraftRecord 的 markdown 正文
- When: 调用 `buildDocxIntermediateDocument({ draft, formatProfileSnapshot })`
- Then: 返回 `DocxIntermediateDocument`，包含：
  - blocks: 按顺序为 documentTitle / heading / paragraph / list / table
  - 每个 block 携带 ruleRefs、sourceLineRange
  - intermediateHash 非空
  - stylePolicy（从 formatProfileSnapshot 解析）

## 场景 2：heading 层级识别

- Given: 底稿包含 `# title`、`## section`、`### subsection` 等 heading
- When: 解析中间文档
- Then: heading block 的 level 字段正确分配（1 / 2 / 3），
  `roleSource` 标记为 `"markdown-heading"` 或 `"chinese-section"` 等

## 场景 3：列表识别

- Given: 底稿包含有序列表（1. 2. 3.）和无序列表（- *）
- When: 解析中间文档
- Then: 正确产出 DocxListBlock，ordered 字段正确，
  `autoNumberingIntent` 标记可见数字与纯列表的区别
