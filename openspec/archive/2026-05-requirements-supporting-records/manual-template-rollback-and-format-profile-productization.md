# 手动模板回滚与 FormatProfile 产品化执行清单

日期：2026-05-13  
决策依据：`.omx/plans/requirements/migration-decision-log.md` Decision 006

## 1. 回滚研判

当前版本完全放弃“手动输入模板”。依据代码证据，以下能力属于旧需求，应从主线入口回滚：

1. 模板库前端手动创建/编辑表单。
2. 当前模板绑定入口。
3. 模板持久化与自动保存。
4. 底稿加工中的手工模板快照注入。
5. 基于手工字段的静态模板匹配报告。
6. 聊天区“当前模板”提示。

不回滚的概念：

1. 底稿加工会话。
2. “格式约束需要以快照形式进入底稿加工”的机制。
3. 诊断信息、非阻塞提示和生成约束注入。

这些应由 FormatProfile / FormatBinding 承接，而不是由用户手写模板字段承接。

## 2. 产品化最小范围

本次产品化只迁入实验中已验证的最小产品路径：

1. 用户选择一个成品文件。
2. 系统从可提取文本中生成 FormatProfile。
3. 格式画像保存到项目级格式库。
4. 用户可设为当前格式画像。
5. 底稿加工时注入 profileSnapshot 与 generationInstruction。
6. UI 展示置信度、结构线索和诊断，不承诺导出或高保真复刻。

## 3. 验证要求

1. 新增 FormatProfile 纯函数测试。
2. 新增格式画像 store / persist 测试。
3. 更新底稿加工 prompt 测试，确保不再出现手工模板字段。
4. 运行 typecheck 与相关单测。


## 4. 产品化验收补充（2026-05-13）

四格式 FormatProfile 产品化已完成当前阶段验收：

- DOCX：结构、段落样式、编号、字体、字号、页面线索已进入画像。
- XLSX：工作表、维度、公式、合并单元格、单元格样式统计已进入画像。
- PPTX：slide、layout、master、theme、逐页文本线索已进入画像。
- PDF：页数、文本层、字体引用、图片/扫描风险诊断已进入画像。

验收判断：通过的是“确定性探测版 FormatProfile”。当前画像偏机械且不精准的问题成立，原因是尚未接入 LLM 语义精炼。

下一阶段不再继续扩展手动模板，也不把重点放在证明四格式是否能导入，而应转向：

```text
FormatProfile Semantic Refinement / LLM Enrichment
```

对应记录：`.omx/plans/requirements/format-profile-productization-acceptance-and-semantic-refinement.md`
