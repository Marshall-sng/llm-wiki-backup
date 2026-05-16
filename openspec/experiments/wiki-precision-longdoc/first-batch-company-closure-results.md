# 第一批企业名单真实 Wiki 缺漏闭环实验结果

## 总结论

- evidence：已从原始 `第一批企业名单.xlsx` 生成 full row/cell SourceSidecar。
- evidence：已生成 entity candidates、fact candidates、EvidenceAnchorIndex、WikiCandidate 和 omission audit。
- evidence：当前 wiki source page 保留了 18 个第一批名单企业名称，但联系人、电话、来源工作表、原始序号等行级事实明显缺失或被改写。
- inference：问题不在 converted markdown 缺少这些字段；converted/cache 中可以找到联系人和电话。问题主要发生在 Wiki generation 将表格压缩成摘要型 source page 的阶段。
- inference：统一 SourceSidecar + CoverageAudit 可以直接发现这类遗漏，不应再依赖人工在 Wiki 实体中发现。

## 输入

- 原始 XLSX：`D:\大数据公司工作\数据流通\数据流通\raw\sources\第一批企业名单.xlsx`
- converted markdown：`D:\大数据公司工作\数据流通\数据流通\.llm-wiki\converted\第一批企业名单.xlsx.md`
- 当前 wiki source：`D:\大数据公司工作\数据流通\数据流通\wiki\sources\第一批企业名单.md`

## 产物

- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/source-sidecar.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/evidence-anchor-index.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/entity-candidates.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/fact-candidates.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/omission-audit.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/comparison-current-wiki.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/wiki-candidate.md`

## 覆盖数据

- row anchors：22
- cell anchors：204
- 第一批名单行数：18
- 高质量数据集试点单位行数：4
- entity candidates：18
- fact candidates：147

## 与当前 Wiki 对比

- 当前 wiki 企业表行数：18
- 原始第一批名单行数：18
- 企业名称 exact present：18
- 第一批名单联系人 present in wiki：0
- 第一批名单电话 present in wiki：0
- 第一批名单联系人 present in converted/cache：13
- 第一批名单电话 present in converted/cache：13

## 缺漏/改写类型统计

- missing_contact: 13
- missing_industry: 7
- missing_phone: 13
- missing_pilot_contact: 4
- missing_pilot_phone: 4
- missing_source_worksheet: 28
- project_detail_truncated_or_summarized: 13
- serial_rewritten: 4

## 关键发现

1. 当前 wiki 中企业名称基本存在，但 source page 不是完整事实层。
2. 当前 wiki 表格重写了部分原始序号，例如原始序号 6/7/8/5 的顺序被改成连续展示序号。
3. 联系人、电话在 converted/cache 中存在，但当前 wiki 中没有保留，说明 converted 不是唯一问题，Wiki 生成阶段也会丢事实。
4. SourceSidecar 能保留每行和每个单元格的 evidence anchor，CoverageAudit 能自动发现字段遗漏。

## 下一步建议

1. 生产化时先实现 full XLSX sidecar 持久化。
2. Wiki 生成前增加 CoverageAudit：企业名、原始序号、联系人、电话、项目名称、来源工作表、行业必须有消费记录或显式忽略理由。
3. WikiCandidate 生成应先基于 row facts 投影，再由 LLM 做组织和摘要，而不是让 LLM 直接摘要 converted markdown。
4. 将本实验作为“第一批企业名单.xlsx”回归测试基线。
