# pkm-tool → llm_wiki 迁移追踪矩阵

更新时间：2026-05-13  
状态：当前进度锚点  
原始需求基线：`.omx/plans/requirements/pkm-migration-original.md`

## 1. 用途

本文不是重写原始需求，而是记录原始迁移需求在当前 `llm_wiki` 路线中的承接状态。

- 原始迁移文档：需求来源，不随实现路线轻易改写。
- 本追踪矩阵：进度锚点，说明每项需求当前是已完成、替代、延后还是重定义。
- 决策账本：解释为什么发生路线偏移。
- Active plan：指导下一步具体执行。

## 2. 当前路线总述

原始路线曾按“底稿 → 手工模板库 → 模板感知生成 → 匹配报告 → 正式导出”推进。

当前判断：手工模板库可以作为兼容基础，但不符合多数真实用户习惯。新的高价值路径是：

```text
成品文件
  ↓
格式画像 FormatProfile
  ↓
格式绑定 FormatBinding
  ↓
两种底稿路径
  A. 先选格式画像生成底稿
  B. 已有底稿适配格式画像
```

## 3. 原始需求追踪

| 原始需求项 | 当前状态 | 当前理解 | 路线偏移 | 新承接方式 | 验收锚点 |
| --- | --- | --- | --- | --- | --- |
| 6.1 Draft / 底稿 / 版本 / Diff Guard | 部分完成 | 底稿、版本历史、基础提示已完成；完整 diff guard 不继续加深 | 轻微 | 保留现有能力作为底稿工作区基础 | 历史计划 v11/v12/v13 归档 |
| 6.2 Template Library / 当前模板绑定 | 基础完成但产品方向重定义 | 手工模板库已实现，但真实用户更需要上传成品文件自动学习 | 明显 | 升级为 FormatProfile / Format Library，手工模板作为兼容层 | v14 归档；FormatProfile 实验接管 |
| 6.3 Template-aware Generation | 部分完成但需重做抽象 | 当前是手工模板文字约束；不够代表真实格式 | 明显 | 改为 profileSnapshot + generationInstruction + FormatBinding | 实验需验证两种生成路径 |
| 6.4 Template Match Report | 基础完成但不作为继续加深重点 | 静态匹配报告价值有限，必须基于真实 profile 才有意义 | 明显 | 后续改为 profile-driven diagnostics / match review | v16 归档；实验只做基础诊断 |
| 6.5 Formal Output Export Pipeline | 延后 | 导出依赖稳定 profile，不应先做 | 无实质偏移 | DOCX 导出后置；PPTX/XLSX/PDF 分格式评估 | 本次实验不做导出 |
| 6.6 Output Audit / Provenance | 延后并轻量保留 | 审计应先体现在 diagnostics 和 profileSnapshot | 轻微 | 本次实验生成 diagnostics；完整 provenance 后置 | 每个样本有诊断产物 |
| 6.7 Long Document Project | 延后 | 长文能力仍重要，但不是当前最高收益 | 无 | 等格式画像和底稿生成稳定后再规划 | 暂不进入实验边界 |
| 6.8 Model / Agent Monitor | 低优先级 | 不是当前产品核心 | 无 | 暂不迁移 | 无 |

## 4. 当前实验要解决的问题

本轮实验必须解决到后端协议层：

1. 四类文件 DOCX / XLSX / PPTX / PDF 进入统一解析入口。
2. 每个样本生成统一 `FormatProfile`。
3. `FormatProfile` 能转成 `generation-instruction.md`。
4. 支持两条底稿路径：
   - `generate_from_profile`：先选格式画像，再生成底稿。
   - `adapt_draft_to_profile`：已有底稿，再适配格式画像。
5. 支持 `profileSnapshot`。
6. 支持 draft-level overrides。
7. 产出 diagnostics，明确置信度、冲突和不可支持项。

## 5. 当前实验不解决的问题

1. 前端交互。
2. 完整模板库管理。
3. 用户可视化编辑 FormatProfile。
4. DOCX / PPTX / XLSX / PDF 正式导出。
5. 高保真 PDF 还原。
6. 完整 diff guard。
7. 自动反向更新模板。
8. 大规模 autoresearch 自动迭代。

## 6. 成功判断

实验成功不等于产品完成。实验成功仅表示：

```text
35 个样本中的四类文件能够稳定进入管线；
每个样本均能产出 profile / instruction / diagnostics；
至少代表性样本能跑通两种底稿生成路径；
诊断信息诚实地说明适用范围和失败原因。
```

