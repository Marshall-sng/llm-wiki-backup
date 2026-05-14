# Wiki 精准生成与长文工程前置研究任务书

分支：`research/wiki-precision-longdoc`

## 任务性质

本任务是探索实验，不是执行既定方案。目标不是证明某一条已有路线正确，也不是立即重构生产代码，而是在不干扰当前主线开发的前提下，通过研究、对比、实验和验证，找出最优或当前最优的技术路线。

## 最终产品目标

1. 任意素材格式都能完整、精准生成 Wiki：xlsx、docx、pdf、pptx、md、txt、网页、长文本等。
2. 超长文本也能重复做到完整、精准 Wiki 生成，不只读开头，不依赖截断后摘要。
3. 能够工程化生成超长文本，不把长文生成降级为一次 Chat 回复。
4. 能够精准定位：普通文本定位到 chunk/char range，表格定位到 sheet/row/column/cell/original serial，PDF/DOCX/PPTX 定位到各自结构锚点。
5. 能够精准检索：结合结构化索引、全文索引、语义索引、实体图谱、证据引用、覆盖率和审计机制；证据不足时不编造。

## 非目标

- 本阶段不追求完整生产实现。
- 本阶段不大规模改造 UI、store 或生产 ingest pipeline。
- 本阶段不把 pkm-tool 整体迁移进 llm_wiki。
- 本阶段不把 DOCX 导出实现作为主研究对象；DOCX 只作为下游消费证据/草稿/结构的约束输入。

## 初始假设（可被实验推翻）

| 假设 | 起步判断 | 允许如何被推翻 |
| --- | --- | --- |
| H1 | 原始材料和可定位证据比 Wiki 更接近事实源 | 若实验表明某类 Wiki 中间层可稳定保持事实与定位，可升级其地位 |
| H2 | converted markdown 是中间表达，不应作为唯一事实结构 | 若增强 converted 足以表达结构与锚点，可减少 sidecar 复杂度 |
| H3 | 表格需要 row/cell 级结构化抽取 | 若 Markdown/HTML table + anchors 足够，可采用轻量方案 |
| H4 | 长文需要 chunk/section 覆盖率，不应只读开头 | 若 agentic reading 或其他方法更优，可替换固定 chunk 策略 |
| H5 | LLM 不应单独负责全量覆盖 | 若 LLM+verifier/gold audit 可稳定达标，可扩大 LLM 责任 |
| H6 | Wiki 生成应伴随 review items | review items 可在 ingest、后处理、检索时或周期审计中生成，需实验判断 |
| H7 | 长文工程可能既是独立功能也可能是底层能力 | 需通过架构分析和实验判断边界 |

## 成功标准

- 产出当前架构诊断、pkm-tool 经验提炼、候选方案集、推荐目标架构、实验计划、实验结果、长文工程定位分析和最终汇报。
- 至少执行一个真实 xlsx 完整结构化抽取实验，使用“第一批企业名单.xlsx”验证当前 Wiki 丢失/改写的事实。
- 至少执行一个超长文本尾部实体覆盖实验，证明或反驳基础 chunk/coverage 方案的必要性。
- 所有实验结果区分 evidence / inference / unknown。
