# Phase 1F：产品化设计前补充实验计划

## 目标

在进入产品化设计前，对会直接影响 P0/P1 数据结构和门禁规则的 deferred 项做最小实验验证。

本轮只覆盖三项：

1. XLSX 合并单元格 / 多级表头语义恢复。
2. PDF extraction quality gate。
3. CoverageAudit rules。

## 非目标

- 不做 OCR。
- 不做 PDF 表格结构恢复。
- 不做 DOCX 图片/批注/页眉页脚。
- 不接入生产 pipeline。
- 不修改 UI。

---

## E1：XLSX 合并单元格 / 多级表头 sidecar 实验

### 要验证的问题

1. row/cell anchor 是否足以表达合并单元格？
2. 是否需要在 sidecar 中显式保存 merged ranges？
3. 能否通过 header propagation 生成更准确的 row facts？

### 输入材料

优先使用现有样本中含合并单元格的 XLSX：

- `experiments/wiki-precision-longdoc/artifacts/multiformat/sample-manifest.json`
- 特别关注 `merged_ranges > 0` 的样本。

### 实验步骤

1. 扫描样本 manifest，找出 XLSX 中存在 merged ranges 的样本。
2. 对选中样本读取：
   - sheet；
   - merged ranges；
   - top-left value；
   - affected cells；
   - row/cell anchors。
3. 尝试生成 propagated header context。
4. 输出 sidecar 增强建议。

### 成功标准

- 能列出 merged ranges。
- 能为受影响 cell 生成 `merged_context`。
- 能说明产品化 schema 是否需要 merged cell 模型。

### 失败判据

- 无法检测合并区域。
- 无法判断合并区域是否影响 row facts。

---

## E2：PDF extraction quality gate 实验

### 要验证的问题

1. PDF.js 输出哪些指标足以形成质量门禁？
2. 如何从 page-level 指标发现低质量页或异常 PDF？
3. 质量门禁应该输出 pass / partial / needs-review / failed 中的哪类状态？

### 输入材料

使用 Phase 1C 产物：

```text
experiments/wiki-precision-longdoc/artifacts/pdf-text-anchor/pdfjs-text-anchor-probe.json
```

### 实验步骤

1. 对每个 PDF 计算：
   - pages_processed / pages；
   - pages_with_text / pages；
   - chars_per_page；
   - text_items_per_page；
   - line_anchors_per_page；
   - failed_pages；
   - low_text_pages。
2. 根据启发式规则生成 quality status。
3. 生成 ReviewItem。
4. 输出推荐门禁阈值。

### 成功标准

- 每个 PDF 有 quality summary。
- 能输出低质量页或异常页。
- 能把质量规则转化为产品化设计字段。

### 失败判据

- 只能给样本整体成功/失败，不能定位问题页。

---

## E3：CoverageAudit rules 实验

### 要验证的问题

1. 对 WikiCandidate，如何判断 required row/cell facts 被消费？
2. required field 缺失时如何分类？
3. 哪些遗漏应阻断，哪些进入 ReviewItem？

### 输入材料

使用第一批企业名单闭环产物：

```text
experiments/wiki-precision-longdoc/artifacts/first-batch-company/source-sidecar.json
experiments/wiki-precision-longdoc/artifacts/first-batch-company/wiki-candidate.md
experiments/wiki-precision-longdoc/artifacts/first-batch-company/omission-audit.json
```

### 实验步骤

1. 定义 XLSX source page 的 required fields：
   - 企业名称；
   - 原始序号；
   - 项目名称；
   - 联系人；
   - 电话；
   - 来源工作表；
   - 所属行业。
2. 模拟两类 candidate：
   - full candidate：实验生成的 `wiki-candidate.md`；
   - current wiki：真实当前 wiki source page。
3. 对比 required fields 消费情况。
4. 输出 pass / fail / review rules。

### 成功标准

- full candidate 明显优于 current wiki。
- 能输出字段级缺失原因。
- 能形成产品化 CoverageAudit 规则。

### 失败判据

- 无法从 candidate 中判断 required field 是否被消费。

## 预期产物

```text
experiments/wiki-precision-longdoc/run_production_readiness_supplemental_experiments.py

experiments/wiki-precision-longdoc/artifacts/production-readiness/
  xlsx-merged-cell-results.json
  pdf-quality-gate-results.json
  coverage-audit-rules-results.json
  production-readiness-summary.json

.omx/plans/experiments/wiki-precision-longdoc/production-readiness-supplemental-results.md
```
