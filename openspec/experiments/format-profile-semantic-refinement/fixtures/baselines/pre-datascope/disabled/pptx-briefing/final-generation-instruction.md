# Generation Instruction: batch_16_pptx_github_01

## 任务

根据该演示成品提炼汇报结构、页面组织和可用于逐页底稿生成的约束。

## 模式

先选择格式画像，再按画像生成底稿。

## 探测摘要

- Profile: profile_batch_16_pptx_github_01
- 文件类型: pptx
- 文档类型推断: 汇报演示
- 画像置信度: medium
- Snapshot: 0642a1d0f9a2483567fb5e4e9799c18c38fd0f5be7e8d406be4fd97b81ecb3cf
- 探测摘要: 幻灯片 31、版式 62、母版 1、主题 3

## 临时调整

- experiment: phase2-batch
- formatBoundary: PPTX 用于汇报结构和逐页底稿，不生成 PPTX 成品。

## 写作约束

1. 优先满足用户目标，不把格式说明混入正文。
2. 持续遵守当前 FormatBinding；后续补写、改写和续写均默认继承该绑定。
3. 如果格式画像与用户材料冲突，保留用户事实，并在 diagnostics 中说明冲突。
4. 对 DOCX，优先生成正式文稿结构；对 XLSX，优先生成表格化分析；对 PPTX，优先生成逐页汇报底稿；对 PDF，仅作为参考成品。

## 画像约束

- 将该格式视为逐页汇报结构参考，而不是普通长文皮肤。
- 页数线索：31 页；版式线索：62 个。
- 输出底稿时优先按“页标题—核心观点—讲述要点”组织。

## 能力边界

- [info] probe.completed: Phase 2 已完成 PPTX 基础探测：幻灯片 31、版式 62、母版 1、主题 3。
- [info] format.pptx.boundary: PPTX 用作汇报结构和逐页内容参考，不在本阶段生成 PPTX 成品。
