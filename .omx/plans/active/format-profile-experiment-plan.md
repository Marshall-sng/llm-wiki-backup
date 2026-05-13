# FormatProfile 后端实验计划

更新时间：2026-05-13  
分支：`experiment/format-profile-backend`  
状态：active

## 1. 目标

验证“上传成品文件自动学习格式”是否可以作为 `llm_wiki` 后续模板能力主线。

核心链路：

```text
成品文件
  ↓
FormatProfile
  ↓
FormatBinding
  ↓
generationInstruction
  ↓
draft-output
  ↓
diagnostics
```

## 2. 样本集

样本位于本地运行目录，不进入 Git：

```text
runtime/format-profile/samples/
```

当前样本规模：

| 格式 | 数量 |
| --- | ---: |
| DOCX | 15 |
| PDF | 6 |
| PPTX | 5 |
| XLSX | 9 |

样本清单：

```text
runtime/format-profile/manifests/sample-inventory.json
```

## 3. 本次实验范围

### 必须做

1. 定义统一 `FormatProfile` 协议。
2. 定义 `FormatBinding` 协议。
3. 定义 `Diagnostics` 协议。
4. 定义样本 case 输入格式。
5. 四类文件进入同一解析入口。
6. 每个样本生成：
   - `profile.json`
   - `generation-instruction.md`
   - `diagnostics.json`
7. 代表性样本验证两种底稿路径：
   - `generate_from_profile`
   - `adapt_draft_to_profile`
8. 支持 draft-level overrides。
9. 产出实验报告，说明成功率、失败原因和格式能力边界。

### 不做

1. 前端交互。
2. 正式导出。
3. 高保真还原。
4. 完整 diff guard。
5. 模板自动演化。
6. 用户可视化编辑 profile。
7. 大规模自动研究循环。

## 4. 格式能力边界

| 格式 | 实验目标 | 降级策略 |
| --- | --- | --- |
| DOCX | 标题、段落、样式、编号、表格、页面信息 | 样式无法提取时至少保留结构和文本 |
| XLSX | sheet、区域、表头、合并单元格、样式、公式/图表线索 | 不把表格强行转成长文模板 |
| PPTX | slide、placeholder、主题、版式、配色、汇报结构 | 输出汇报提纲/逐页内容，不承诺生成 PPTX |
| PDF | 文本块、页面、布局、字体/坐标线索、扫描诊断 | 扫描或低质量 PDF 标低置信度 |

## 5. 评分维度

1. 解析成功率。
2. profile JSON 合法性。
3. profile 完整度。
4. diagnostics 诚实度。
5. generation instruction 可用性。
6. 两种底稿路径可执行性。
7. 分格式能力边界是否被正确表达。

## 6. 停止条件

实验阶段停止于：

```text
35 个样本完成批量处理；
四类格式均有代表性输出；
两种底稿路径均有可审阅结果；
产生一份实验报告；
明确下一步是否产品化、如何产品化。
```

