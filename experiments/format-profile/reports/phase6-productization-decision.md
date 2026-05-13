# Phase 6：FormatProfile 实验总结与产品化决策

日期：2026-05-13  
分支：`experiment/format-profile-backend`  
状态：实验阶段结论

## 1. 实验问题

原先的模板能力以“用户手工填写模板”为主，但真实用户更可能提供已有成品文件，再让系统自动学习格式。

本实验验证的问题是：

```text
成品文件
  → FormatProfile
  → FormatBinding
  → generationInstruction
  → draft-output
  → diagnostics
```

能否在后端离线跑通，并同时覆盖：

- DOCX
- XLSX
- PPTX
- PDF
- 先选格式画像生成底稿
- 已有底稿适配格式画像

## 2. 已完成阶段

| 阶段 | 提交 | 结论 |
| --- | --- | --- |
| 计划治理 | `5b7a480` | 原始迁移需求已冻结为基线，当前进度改由追踪矩阵和 active plan 承接。 |
| Phase 0 | `b9d813b` | 协议、case、binding、diagnostics、输出路径已锁定。 |
| Phase 1 | `ddf58c3` | Office ZIP/XML 和 PDF 字节级基础探测跑通。 |
| Phase 2 | `ce69c13` | 35 个样本批量探测跑通，并形成风险队列。 |
| Phase 3 | `ce12eda` | DOCX 深化到候选标题、章节模式、段落样式、编号、字体字号、页面线索。 |
| Phase 4 | `f905ade` | FormatProfile 能转译为 generationInstruction 画像约束。 |
| Phase 5 | `b6e9556` | 离线 draft 模拟器验证两条底稿路径和四种格式的结构输出。 |

## 3. 样本与验证结果

样本来源：

- `C:\Users\Dante\Desktop\素材包`
- `https://github.com/hornhuang/ppt_themes`
- `https://sample-files.com/documents/docx/`
- `https://samplefile.com/samples/document/xlsx/`
- `https://github.com/datax-official/MS-Excel-Dashboards`

本地样本清单：

```text
runtime/format-profile/manifests/sample-inventory.json
```

批量结果：

| 格式 | 样本数 | ready | failed |
| --- | ---: | ---: | ---: |
| DOCX | 15 | 15 | 0 |
| XLSX | 9 | 9 | 0 |
| PPTX | 5 | 5 | 0 |
| PDF | 6 | 6 | 0 |
| 合计 | 35 | 35 | 0 |

验证命令：

```powershell
node experiments/format-profile/scripts/run-phase0.mjs
node experiments/format-profile/scripts/run-phase1.mjs
node experiments/format-profile/scripts/run-phase2.mjs
```

当前验证结果：

```text
Phase 0: 5/5 valid
Phase 1: 5/5 valid
Phase 2: 35/35 valid
```

## 4. 关键结论

### 4.1 产品方向成立

实验支持以下判断：

> 用户上传成品文件，系统自动提炼格式画像，再把格式画像绑定到底稿生成/适配流程，是比手工填写模板更合理的主线。

现有手工模板库不需要删除，但应降级为兼容能力。主线应改为：

```text
格式库 / 上传成品格式 / 格式画像
```

而不是让用户先理解“模板字段”。

### 4.2 两条路径都必须保留

实验已验证两种后端路径：

1. `generate_from_profile`：先选择格式画像，再生成底稿。
2. `adapt_draft_to_profile`：已有底稿，再适配格式画像。

产品主路径应是第一种，因为多数用户需要在格式框架下生成和加工文本。第二种作为已有文档/已有初稿的适配路径。

### 4.3 FormatBinding 是必要概念

模板不应只是最终导出样式，而应是持续写作上下文。

产品化时需要保留：

```text
Draft
  ├─ content
  ├─ activeFormatProfile
  ├─ profileSnapshot
  ├─ draft-level overrides
  └─ diagnostics
```

这样才能支持用户在加工底稿时继续受格式画像约束。

### 4.4 四种格式可以同管线，但不能同能力承诺

统一管线成立，但能力边界必须分格式说明：

| 格式 | 产品化定位 |
| --- | --- |
| DOCX | 正式文稿/制度/方案/报告类主力格式，应优先产品化。 |
| XLSX | 表格结构、指标口径和分析底稿参考，不应强行转成长文模板。 |
| PPTX | 汇报结构和逐页内容底稿参考，不承诺生成 PPTX。 |
| PDF | 成品参考和诊断，不承诺高保真还原；扫描/图片密集 PDF 需降级。 |

## 5. 风险队列

Phase 2 已识别出若干风险类型：

- 长 DOCX / 表格密集 DOCX。
- 样式定义稀疏的本地 DOCX。
- XLSX 公式语义。
- XLSX 共享字符串为空或样式证据稀疏。
- 大型 PPTX / 多 layout PPTX。
- 图片密集 PDF。
- PDF 字体线索不足。

这些风险不是阻塞项，但产品化时应转成 diagnostics，而不是隐藏。

## 6. 建议迁回主线的最小产品化范围

建议采用“最小可用格式画像”迁回主线，而不是一次性迁入整个实验目录。

### P0：格式画像导入后端

迁入：

- FormatProfile 协议。
- FormatBinding 协议。
- Diagnostics 协议。
- 文件探测入口。
- DOCX / XLSX / PPTX / PDF 基础探测。
- profileSnapshot。

不迁入：

- 实验 runner 的 runtime 输出机制。
- 全量批量 case 生成。
- 离线模拟 draft 的实验文案。

### P1：DOCX 优先产品化

优先支持：

- 上传 DOCX 成品。
- 生成格式画像。
- 展示结构/样式/诊断摘要。
- 将 DOCX profile 绑定到底稿处理。
- 生成/适配底稿时注入 profile-derived instruction。

### P2：四格式降级展示

支持 XLSX / PPTX / PDF 进入格式库，但明确显示：

- 可用于什么；
- 不能用于什么；
- 置信度；
- 诊断项。

### P3：真实 LLM 生成

在 profile/binding 稳定后，再接入真实 LLM：

- `generate_from_profile`
- `adapt_draft_to_profile`
- draft-level overrides
- diagnostics 回写

## 7. 不建议现在做的事

暂不做：

1. DOCX / PDF / PPTX / XLSX 正式导出。
2. 高保真样式复刻。
3. 自动更新模板。
4. 完整 diff guard。
5. 大规模 autoresearch 自动迭代。
6. 前端复杂模板编辑器。

## 8. 产品化验收建议

主线产品化第一阶段应满足：

1. 用户可上传一个成品文件。
2. 系统生成格式画像。
3. 系统显示可用性诊断。
4. 用户可将该画像绑定到底稿。
5. 生成/改写底稿时使用 profileSnapshot。
6. 不承诺导出和高保真还原。

验收样例优先使用：

- 一个本地制度类 DOCX。
- 一个报告类 DOCX。
- 一个 XLSX 仪表盘样本。
- 一个 PPTX 商务汇报样本。
- 一个 PDF 平台介绍样本。

## 9. 最终决策

建议将实验结论产品化，但采用渐进迁移：

```text
先迁协议和探测能力
再接底稿绑定和生成指令
最后才考虑导出和高保真
```

结论：

> FormatProfile 路线成立，应作为模板能力的下一代产品主线。

