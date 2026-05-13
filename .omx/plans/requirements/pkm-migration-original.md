# pkm-tool → llm_wiki 需求迁移说明

文件目的：给后续进入 `D:\llm_wiki` 进行下游开发的 Codex / 开发者提供需求锚点。

重要约束：本文档不是实现计划，不要求立即修改 `llm_wiki` 源码；它用于复原 `pkm-tool` 项目的完整产品诉求、失败教训，并判断哪些需求应迁移到 `llm_wiki` 作为下游增强。

本地路径索引（后续查看优先从这里进入）：

- `pkm-tool` 需求来源项目目录：`D:\数据流通\pkm-tool`
- `llm_wiki` 当前下游开发仓库：`D:\llm_wiki`
- 本迁移需求说明文件：`D:\llm_wiki\PKM_TOOL_TO_LLM_WIKI_MIGRATION_REQUIREMENTS.md`

---

## 1. 背景与当前决策

`pkm-tool` 最初目标不是单纯做 Chat，也不是单纯做模板导出，而是构建一个面向非程序员个人使用的“材料智能工作台 / LLM Wiki”：

```text
导入材料
→ 系统理解材料
→ 编译成可持续维护的 Wiki
→ Chat 基于材料和 Wiki 回答
→ 证据可追溯
→ 生成草稿
→ 多轮修改不破坏底稿
→ 长文任务工程化
→ 按模板输出正式材料
→ 导出 DOCX/PDF
→ 保留审计和来源记录
```

经过多轮实现和人工试用后，`pkm-tool` 暴露出一个核心问题：我们在自建 Wiki / Chat / 任务队列 / 前端工作台底座时投入过多，但真实人类使用闭环仍不稳定。尤其是材料摄入、长文处理、底稿版本、模板输出、任务噪音等方面，出现了“测试能过但产品不可用”的情况。

因此当前决策是：

> 将 `llm_wiki` 作为新的底座，在其已有 LLM Wiki、桌面端、摄入队列、查询、图谱、审核、Chat 能力上做下游增强，而不是在 `pkm-tool` 中继续重复造轮子。

`pkm-tool` 后续应作为需求来源、失败复盘、交互原型和迁移参考，而不是主开发线。

---

## 2. 完整历史需求复原

### 2.1 产品定位

历史主线可以概括为：

```text
Evidence-grounded LLM Wiki-first Material Intelligence Workbench
```

中文表达：

```text
证据驱动、LLM Wiki 优先的材料智能工作台
```

核心含义：

1. 原始材料和可定位证据片段是最终依据。
2. Wiki 是 LLM 编译出来的知识层，不是真相本身。
3. Chat 是主要入口，但复杂工作应进入专门工作流。
4. 正式输出必须可追溯、可复核、可版本化。
5. 用户不是程序员，不能要求用户理解文件路径、索引状态、任务队列内部细节。

### 2.2 用户真实场景

用户希望完成的真实任务包括：

- 导入大量本地材料、网页、PDF、DOCX、长文本；
- 让系统说明当前项目里有什么材料；
- 点名某份材料，例如《唐人的餐桌》，系统自动识别并使用；
- 基于项目材料生成摘要、汇报稿、说明材料、政策依据、风险提醒；
- 对 AI 回复继续修改，例如“只改风险提醒”“只改标题，正文不要动”；
- 将某条 AI 回复设为底稿；
- 生成长文、压缩长文、分章节处理长文；
- 选择一个模板，按模板严格组织内容；
- 查看模板匹配报告；
- 导出正式 DOCX/PDF；
- 看到任务进度、失败原因、证据来源和审计记录。

### 2.3 非程序员使用原则

必须满足：

- 用户不应手动粘贴已经导入的全文材料；
- 用户不应理解“索引为空”“chunk 覆盖不足”等内部概念才能继续；
- 用户不应在任务中心里被大量历史任务淹没；
- 用户不应猜当前 Chat 是否受模板影响；
- 用户不应在导出前不清楚使用的是哪一版底稿；
- 系统不能伪造已完成能力，尤其是 DOCX 导出、长文完成、证据充分性。

---

## 3. pkm-tool 已验证的真实需求

以下不是“想象需求”，而是在 `pkm-tool` 人工测试、失败复盘和闭环修复中被验证为真实痛点的需求。

### 3.1 项目材料必须是一等公民

问题表现：

- 用户要求压缩《唐人的餐桌》，系统一度要求用户粘贴全文；
- 用户指出材料就在项目中后，系统仍没有真正继续处理；
- 材料概览曾出现“均已索引”与“有文档未索引”的矛盾描述。

需求结论：

- 系统必须知道当前项目有哪些材料；
- Chat 必须能使用已导入材料；
- 标题、文件名、书名号、别名、路径都应可解析；
- 材料状态必须用人能理解的话表达。

### 3.2 Chat 是入口，但不是普通闲聊机器人

需求结论：

- Chat 应能触发材料查询、长文处理、草稿修改、模板输出；
- 普通 Chat 默认行为不能被模板、导出、任务系统污染；
- Chat 回复应带可操作按钮，例如继续修改、设为底稿、查看引用、导出。

### 3.3 多轮编辑和底稿控制是核心能力

失败证据：

- “只修改风险提醒”后输出可能与上一版完全相同；
- “只改标题，正文不要改”后正文被缩短或丢失；
- 草稿功能即使保存成功，也可能保存的是已损坏版本。

需求结论：

- 必须有明确 Draft / 底稿 / 版本模型；
- 必须支持从某条回复继续；
- 必须支持局部修改保护；
- 必须支持 diff guard；
- 导出前必须确认导出的是哪个版本。

### 3.4 长文不是一次 Chat 回复

需求结论：

- 50,000 字以上材料不能靠单次 Chat 处理；
- 长文压缩、长文生成、长文汇报稿应有工程化流程；
- 应先生成目录、章节计划、证据计划；
- 每章应有 evidence packet；
- 最终合并前应 lint / review。

`pkm-tool` 当前只做到“长文 handoff / 创建计划”，这解决了“不冻结、不要求粘贴”，但没有解决“真正产出最终 15000 字成稿”。

### 3.5 模板驱动输出是正式材料能力，不是样式美化

需求结论：

模板功能的本质是：

```text
根据指定模板准确输出成需要的格式
```

它要求：

- 必填章节；
- 章节顺序；
- 字数限制；
- 文风；
- 证据引用；
- 格式/样式；
- 匹配报告；
- 导出；
- 审计。

这不是“套一个好看的格式”，也不是“Prompt 里弱提醒一下”。

### 3.6 任务状态必须克制、清晰、当前优先

失败表现：

- 任务中心堆积大量历史 awaiting_user_confirmation；
- 当前任务被历史任务淹没；
- 用户不知道慢在哪里。

需求结论：

- 任务状态要面向人类；
- 当前任务优先；
- 历史任务折叠；
- 复杂任务显示阶段和失败原因；
- 不要为了观测而制造噪音。

---

## 4. pkm-tool 失败教训

### 4.1 不应继续自建 LLM Wiki 底座

`pkm-tool` 曾规划并部分实现：

- DocumentCatalog；
- TitleResolver；
- ChunkIndex；
- Evidence Board；
- Wiki Compiler；
- Review Queue；
- Graph / Model Lab；
- Long Document Runtime；
- Desktop shell。

但真实使用说明：这些底座能力尚未足够成熟，继续在当前架构上堆功能会继续扩大复杂度。

### 4.2 “测试通过”不等于“产品可用”

`pkm-tool` 一度达到：

- 后端全量测试通过；
- 前端 typecheck/build 通过；
- 浏览器 smoke 通过；
- issue 状态关闭。

但桌面端真实使用后仍被判定为“目前失败”。

教训：

- 自动测试只能证明合同没有破坏；
- 人类闭环需要看是否真正产出用户要的结果；
- 长文 handoff 不是长文完成；
- DOCX 按钮不是 DOCX 能力；
- 任务状态可见不是任务完成。

### 4.3 不应把 pkm-tool 搬进 llm_wiki

禁止迁移：

- `.pkm` 目录结构；
- Python 后端；
- 自制 API server；
- 当前复杂任务中心；
- pkm-tool 的前端布局；
- 未闭环的长文工程实现；
- 伪闭环的模板导出实现。

应迁移的是：

- 需求；
- 失败教训；
- 交互原则；
- 模板匹配报告概念；
- 底稿/版本/diff guard 需求；
- 长文工程化需求；
- 正式材料 audit/provenance 需求。

---

## 5. llm_wiki 现有能力对照

`llm_wiki` 已经具备很多 `pkm-tool` 试图自建的底座能力。

### 5.1 已有能力

根据 `D:\llm_wiki\README_CN.md`、`README.md` 和源码结构，`llm_wiki` 已有：

- 跨平台 Tauri 桌面端；
- 三栏布局；
- Sources / Wiki / Search / Graph / Lint / Review / Deep Research / Settings；
- Raw Sources → Wiki → Schema 三层架构；
- `purpose.md`；
- `index.md`；
- `overview.md` 自动更新；
- wikilink；
- YAML frontmatter；
- sources[] 来源追踪；
- 两步摄入：分析 → 生成；
- 持久化摄入队列；
- 文件夹导入；
- 多格式文档支持；
- 可选 embedding / vector search；
- tokenized search；
- graph expansion；
- context budget；
- 多会话 Chat 持久化；
- Chat references panel；
- Save to Wiki；
- Review system；
- Lint；
- Deep Research；
- Chrome Web Clipper；
- 多 LLM provider；
- reasoning display；
- 设置持久化。

### 5.2 与 pkm-tool 需求的对应关系

| pkm-tool 需求 | llm_wiki 已有对应 | 是否需要重建 |
|---|---|---|
| 材料导入 | Sources / folder import / multi-format | 否 |
| 材料摄入队列 | persistent ingest queue | 否 |
| Wiki 编译 | two-step ingest / wiki pages | 否 |
| 来源追踪 | frontmatter sources[] | 否 |
| 查询 | search pipeline / graph expansion | 否 |
| Chat | multi-conversation chat | 否 |
| 引用面板 | references panel | 否 |
| Review | review system | 否 |
| Lint | lint view | 否 |
| 图谱 | graph view / graph relevance | 否 |
| 桌面端 | Tauri v2 | 否 |
| 模板驱动输出 | 不完整 | 是，下游增强 |
| 底稿版本 / diff guard | 不完整 | 是，下游增强 |
| 正式文档导出 | 不完整 | 是，下游增强 |
| 输出 audit/provenance | 不完整 | 是，下游增强 |
| 长文成稿工程 | 不完整 | 是，但后置 |

---

## 6. 适合迁移为 llm_wiki 下游增强的需求

### 6.1 第一优先级：Draft / 底稿 / 版本 / Diff Guard

原因：

`pkm-tool` 真实失败最严重的问题不是模板，而是“多轮修改和底稿控制不可靠”。如果没有可靠底稿，模板输出会把坏版本正式导出，反而放大风险。

应新增能力：

- 从 Chat 回复设为 Draft；
- Draft version history；
- 从指定 Draft 继续修改；
- 局部编辑指令识别；
- diff 对比；
- 非目标区域误改警告；
- 导出前确认 draft version；
- 可选保存到 Wiki 或输出中心。

建议不要重做 Chat store，而是在 `llm_wiki` 现有 Chat persistence 上扩展正式草稿模型。

### 6.2 第二优先级：Template Library / 当前模板绑定

应新增能力：

- 模板库；
- 模板元数据；
- 当前模板状态；
- 清除当前模板；
- 模板只影响用户明确选择后的生成；
- 普通 Chat 默认不带模板。

模板字段至少包括：

- template_id；
- title；
- intent；
- output_format；
- required_sections；
- section_order；
- length_limits；
- tone/style；
- citation_policy；
- example_text；
- style hints；
- export capability。

### 6.3 第三优先级：Template-aware Generation

应基于 `llm_wiki` 的现有 query context，而不是重新读文件。

流程应为：

```text
用户选择模板
→ Chat 中提出生成需求
→ 系统检索 Wiki / raw sources / references
→ 生成结构化草稿
→ 标记使用的 Wiki 页面和来源
→ 产生模板匹配报告
```

重要约束：

- 不选模板时，Chat 行为保持原样；
- 不自动导出文件；
- 模板生成应先产出 Chat/Draft 结果，再由用户显式导出。

### 6.4 第四优先级：Template Match Report

匹配报告是 `pkm-tool` 中最值得迁移的概念之一。

报告应检查：

- required sections 是否存在；
- section order 是否正确；
- 字数是否超限；
- 是否缺少必要字段；
- 是否缺证据；
- 是否存在未引用结论；
- 风格是否偏离模板；
- 导出前是否存在阻断项。

匹配报告应显示在：

- Chat 回复下方；
- Draft 详情；
- Export 前确认；
- 可选 Review 队列。

### 6.5 第五优先级：Formal Output Export Pipeline

应新增：

- 从 Draft 导出；
- 从 Chat assistant message 导出；
- Markdown 初版导出；
- DOCX；
- PDF；
- sidecar audit report；
- output record；
- source/reference bundle。

导出必须显式触发，不能在 Chat send 时自动生成。

### 6.6 第六优先级：Output Audit / Provenance

正式材料输出必须带审计记录：

- 使用的 draft version；
- 使用的 template；
- 使用的 Wiki pages；
- 使用的 raw sources；
- 关键段落引用；
- 模板匹配结果；
- 模型/provider；
- 时间；
- warnings；
- 人工修改记录。

这应扩展 `llm_wiki` 的 source traceability，而不是另造一套 provenance 系统。

### 6.7 第七优先级：Long Document Project

长文工程应后置。

建议目标：

```text
Long Output Project
→ outline
→ section plan
→ per-section evidence pack
→ per-section draft
→ merge
→ lint
→ export
```

适用场景：

- 15,000 字压缩；
- 50,000 字报告；
- 长篇材料梳理；
- 章节式汇编。

不建议第一阶段就做，因为没有 Draft/Export 底座时，长文会再次变成假闭环。

### 6.8 低优先级：Model / Agent Monitor

`pkm-tool` 的 Model Lab / Agent Monitor 不应整体迁移。

可先做轻量增强：

- 模板生成阶段；
- 导出阶段；
- 长文阶段；
- 失败原因；
- 当前 provider/model；
- 是否 fallback。

不要先做复杂模型评测平台。

---

## 7. 不适合迁移的内容

以下内容不应迁移到 `llm_wiki`：

1. `pkm-tool` 的 Python backend；
2. `.pkm` canonical directory contract；
3. 自制 Local API server；
4. 自制 Tauri sidecar；
5. 自制 DocumentCatalog / ChunkIndex / WikiCompiler 实现；
6. 当前 pkm-tool 前端 Tabs 布局；
7. 噪音较大的任务中心；
8. 未完成的长文 handoff 实现；
9. 伪完成的 DOCX 导出按钮逻辑；
10. 过早暴露的 Model Lab 复杂 UI。

理由：

`llm_wiki` 已经有更成熟的底座，迁移上述内容会造成重复、冲突和复杂度膨胀。

---

## 8. 下游开发优先级建议

建议顺序：

### Phase A：原生 llm_wiki 跑通与基线确认

目标：确认 `D:\llm_wiki` 能作为新主线。

验收：

- 桌面端可启动；
- 能创建项目；
- 能导入材料；
- 能生成 Wiki；
- Chat 能基于 Wiki 回答；
- references panel 可用；
- review/lint 不阻塞主流程。

### Phase B：Draft / 底稿 / 版本增强

目标：解决 `pkm-tool` 真实失败的核心问题。

验收：

- assistant message 可设为 Draft；
- Draft 可继续修改；
- Draft 有版本历史；
- 局部修改有 diff guard；
- 导出前能确认版本。

### Phase C：Template Library + Current Template Binding

目标：引入模板，但不破坏普通 Chat。

验收：

- 侧边或设置中可管理模板；
- Chat 输入区可显示当前模板；
- 可清除模板；
- 未选模板时 Chat 行为与原 llm_wiki 一致。

### Phase D：Template-aware Generation + Match Report

目标：让模板真正约束内容。

验收：

- 输出包含模板必填章节；
- 字数/结构/引用要求可检查；
- Chat 回复下方可查看匹配报告；
- 不符合时明确指出原因。

### Phase E：Formal Export Pipeline

目标：从 Draft/Chat 导出正式材料。

验收：

- 明确从哪个 Draft 版本导出；
- 支持 Markdown 初版；
- 支持 DOCX；
- 支持 PDF；
- 生成 output record 和 audit report。

### Phase F：Long Document Project

目标：工程化长文输出。

验收：

- 先有 outline 和 section plan；
- 每节有 evidence pack；
- 分节生成 draft；
- 最终合并导出；
- 可恢复、可重试、可审查。

### Phase G：Lightweight Observability

目标：让复杂任务不黑箱。

验收：

- 显示模板分析/生成/审查/导出阶段；
- 显示失败原因；
- 显示当前 provider/model；
- 不制造历史任务噪音。

---

## 9. 后续 Codex 工作约束

当后续 Codex 进入 `D:\llm_wiki` 开发时，应遵守：

1. 先理解 `llm_wiki` 原架构，不要先写代码；
2. 不要把 `pkm-tool` 目录结构搬过去；
3. 不要重做已有 ingest/search/chat/review/graph；
4. 优先扩展现有 stores/components/lib；
5. 普通 Chat 默认行为必须保持；
6. 模板输出必须是 opt-in；
7. 文件导出必须显式触发；
8. 正式输出必须绑定 Draft/Message/Template/References；
9. 任何“导出成功”都必须有真实文件和审计记录；
10. 长文任务不得只返回 handoff 就宣称完成；
11. 所有新增功能必须有测试；
12. 如果直接复制 `pkm-tool` 或其他 GPL 代码，必须记录许可证来源。

---

## 10. 推荐给后续 Codex 的第一条任务提示

建议后续在 `D:\llm_wiki` 中这样开始：

```text
请先阅读当前项目 README_CN.md、README.md、llm-wiki.md，以及 pkm-tool 中的 PKM_TOOL_TO_LLM_WIKI_MIGRATION_REQUIREMENTS.md。

目标不是重做 pkm-tool，而是在 llm_wiki 现有 LLM Wiki 桌面端基础上，评估如何增加 Draft/底稿版本、模板驱动输出、匹配报告和正式文档导出能力。

请先只做只读架构分析和迁移实施计划，不要改代码。
重点回答：
1. llm_wiki 现有哪些 store/lib/component 可以承接这些需求；
2. 第一阶段应先做 Draft/底稿版本，还是模板库；
3. 如何保证普通 Chat 默认行为不被破坏；
4. 如何把模板输出绑定到现有 references/source traceability；
5. 最小可验收闭环是什么。
```

---

## 11. 当前结论

`pkm-tool` 不应继续作为主开发线。它的价值在于：

- 需求探索；
- 失败复盘；
- 人工测试记录；
- 模板输出原型；
- 草稿/长文/导出痛点证明。

`llm_wiki` 应成为新底座。

真正应迁移的是：

1. Draft / 底稿 / 版本 / diff guard；
2. Template Library；
3. Template-aware Generation；
4. Template Match Report；
5. Formal Export Pipeline；
6. Output Audit / Provenance；
7. Long Document Project；
8. Lightweight task observability。

其中最优先的不是模板，而是 **Draft / 底稿 / 版本控制**。因为没有可靠底稿，模板输出和正式导出都会放大错误。
