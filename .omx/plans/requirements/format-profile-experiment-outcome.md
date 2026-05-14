# FormatProfile 实验成果记录

日期：2026-05-13  
分支：`experiment/format-profile-backend`  
结论状态：实验成功，建议渐进产品化

## 1. 一句话结论

`FormatProfile` 路线成立：

```text
成品文件
  → FormatProfile
  → FormatBinding
  → generationInstruction
  → draft-output
  → diagnostics
```

这条链路已经在后端实验中跑通，覆盖 DOCX / XLSX / PPTX / PDF 四类样本，并验证了两种用户路径：

1. 先选格式画像，再生成底稿。
2. 已有底稿，再适配格式画像。

## 2. 实验提交

| 提交 | 阶段 | 成果 |
| --- | --- | --- |
| `5b7a480` | 计划治理 | 冻结原始迁移需求，建立 active / archive / requirements 结构。 |
| `b9d813b` | Phase 0 | 锁定协议、case、binding、diagnostics 和输出路径。 |
| `ddf58c3` | Phase 1 | 实现 Office ZIP/XML 与 PDF 字节级基础探测。 |
| `ce69c13` | Phase 2 | 将探测扩展到 35 个样本，生成批量报告与风险队列。 |
| `ce12eda` | Phase 3 | 深化 DOCX 证据：候选标题、章节模式、样式、编号、字体字号、页面线索。 |
| `f905ade` | Phase 4 | 将 FormatProfile 转译为 generationInstruction 画像约束。 |
| `b6e9556` | Phase 5 | 离线模拟两条底稿路径与四种格式的结构输出。 |
| `41699d9` | Phase 6 | 形成产品化决策报告。 |

## 3. 验证证据

验证命令：

```powershell
node experiments/format-profile/scripts/run-phase0.mjs
node experiments/format-profile/scripts/run-phase1.mjs
node experiments/format-profile/scripts/run-phase2.mjs
```

验证结果：

```text
Phase 0: 5/5 valid
Phase 1: 5/5 valid
Phase 2: 35/35 valid
```

分格式结果：

| 格式 | 样本数 | ready | failed |
| --- | ---: | ---: | ---: |
| DOCX | 15 | 15 | 0 |
| XLSX | 9 | 9 | 0 |
| PPTX | 5 | 5 | 0 |
| PDF | 6 | 6 | 0 |
| 合计 | 35 | 35 | 0 |

关键报告：

```text
experiments/format-profile/reports/phase6-productization-decision.md
runtime/format-profile/reports/phase2-report.md
runtime/format-profile/reports/phase2-report.json
```

其中 `runtime/` 报告为本地运行产物，不进入 Git。

## 4. 实验成功代表什么

实验成功代表：

1. “上传成品文件自动学习格式”比“用户手工填写模板”更适合作为下一代主线。
2. 四种格式可以进入统一后端管线。
3. `FormatProfile` 和 `FormatBinding` 可以承接模板作为持续写作上下文。
4. `generationInstruction` 能从确定性证据生成可消费的写作约束。
5. 离线 draft 模拟证明两条路径可以被同一协议驱动。
6. 风险可以被 diagnostics 显式记录，而不是隐藏。

## 5. 实验成功不代表什么

实验成功不代表：

1. 功能已经产品化。
2. 前端已经可用。
3. 用户已经可以正式上传文件。
4. LLM 已经真正按画像生成高质量正文。
5. 可以导出 DOCX / XLSX / PPTX / PDF。
6. 可以高保真复刻样式。
7. 可以替代人工验收。

## 6. 产品化建议

建议迁回主线的最小范围：

1. `FormatProfile` 协议。
2. `FormatBinding` 协议。
3. `Diagnostics` 协议。
4. 文件探测入口。
5. DOCX / XLSX / PPTX / PDF 基础探测。
6. `profileSnapshot`。
7. profile-derived generation instruction。

优先产品化顺序：

```text
P0：协议 + 探测 + 诊断
P1：DOCX 上传成品 → 格式画像 → 底稿绑定
P2：XLSX/PPTX/PDF 降级接入格式库
P3：接入真实 LLM 生成/适配底稿
P4：再评估导出和高保真
```

暂不产品化：

1. 导出。
2. 高保真还原。
3. 自动更新模板。
4. 完整 diff guard。
5. 大规模 autoresearch 自动迭代。

## 7. 后续工作锚点

后续不应继续强化旧的手工模板主线，而应围绕：

```text
格式库 / 上传成品格式 / 格式画像 / 底稿绑定
```

进行产品化迁移。

下一条推荐任务：

```text
制定 FormatProfile 最小产品化 ralplan：
把实验分支中的协议、探测、绑定、诊断迁回主线；
前端只做最小入口和诊断展示；
不做导出、不做高保真、不做模板自动演化。
```


## 2026-05-14 Update：FormatSpec 实验补充

在原 FormatProfile / StyleFacts / SemanticOverlay 成果之上，新增 `experiments/format-spec/` 实验，用于验证“格式画像约束层”是否可以从机械摘要升级为详细规则。

验证命令：

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
```

结果：

```text
docx-policy: pass rules=17
xlsx-metrics: pass rules=12
pptx-briefing: pass rules=12
pdf-reference: pass rules=8
4/4 passed
```

该实验说明：四格式可以共享同一个 `FormatSpec` 外壳，同时各自保留专属规则分支。下一步产品化重点应从“把画像摘要塞进 prompt”转为“让 draft prompt 消费 FormatSpec”。
