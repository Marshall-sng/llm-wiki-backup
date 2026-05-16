# FormatProfile 四格式产品化宏观计划

日期：2026-05-13
当前决策：手动输入模板在当前版本完全放弃；新主线为“成品文件 → 格式画像 → 底稿生成/适配约束 → 诊断边界”。

## 总目标

将 DOCX / XLSX / PPTX / PDF 四种格式纳入同一 FormatProfile 产品化管线，但不承诺同等高保真能力。

- DOCX：主力格式，提取结构、段落/文本样式、编号、页面线索，并进入底稿约束。
- XLSX：提取工作表、表格维度、合并单元格、公式、基础单元格样式统计，用于表格类分析/指标底稿约束。
- PPTX：提取幻灯片、版式、母版、主题、颜色/字体方案、逐页文本线索，用于汇报大纲/逐页内容约束。
- PDF：提取页数、字体线索、文本层/图片/扫描风险诊断，仅作为低保真成品参考。

## 阶段门禁

每一阶段必须满足以下顺序，未通过不得进入下一阶段：

1. 方案设计：明确能力边界、产品字段、UI 展示和验收标准。
2. 实现：只迁入已经被实验验证或能被当前阶段补实验验证的能力。
3. 测试：运行目标单测、类型检查、必要时 cargo check / build。
4. 记录：把阶段结果、测试证据、已知风险写回本计划。

## 当前阶段状态

| 阶段 | 范围 | 状态 | 测试证据 | 记录 |
| --- | --- | --- | --- | --- |
| 0 | 宏观计划与实验基线 | 已完成 | Phase 0: 5/5；Phase 1: 5/5；Phase 2: 35/35 | 2026-05-13 已复跑实验，四格式均 ready |
| 1 | DOCX 样式探测产品化 | 已完成 | cargo check；typecheck；format-profile/i18n/store/persist 单测 14/14 | 已接入 probe_format_profile；UI 显示文本样式/版式线索；generationInstruction 注入样式摘要 |
| 2 | XLSX 探测产品化 | 已完成 | format-profile 单测 5/5；typecheck | 工作表、sheetStats、单元格样式/字体/填充/边框统计已进入画像；约束明确不伪造电子表格 |
| 3 | PPTX 探测产品化 | 已完成 | format-profile 单测 6/6；typecheck | slideStats、slide/layout/master/theme 线索已进入画像；约束明确只用于汇报大纲/逐页内容 |
| 4 | PDF 探测产品化 | 已完成 | format-profile 单测 7/7；typecheck | 页数、文本操作符、图片数量、字体引用和扫描风险进入画像/诊断；保持低保真边界 |
| 5 | 统一 UI / 绑定 / 验收 | 已完成 | cargo check；目标单测 24/24；test:mocks 1127/1127；npm run build | 四格式同一导入入口、同一 profile store/persist/snapshot；UI 新增文本样式/版式线索；手动模板入口未恢复 |

## Stage 1 方案草案：DOCX

### 能力边界
- 迁入实验中的 DOCX ZIP/XML 探测，不做高保真导出。
- 提取 `word/document.xml`、`word/styles.xml`、`word/numbering.xml`。
- 输出候选标题、章节模式、段落样式使用、编号使用、字体、字号半磅值、页面尺寸和页边距。

### 验收标准
- 导入 DOCX 后，UI 能看到“文本样式/版式”而不是只有结构线索。
- generationInstruction 包含样式摘要和诊断边界。
- 样式证据不足时显示诊断，不虚报高保真。
- TypeScript 单测覆盖 probe 输入合并到 FormatProfile 的逻辑。
- Rust 命令通过 cargo check。

## Stage 2 方案草案：XLSX

### 能力边界
- 提取 workbook、worksheet、styles、sharedStrings 的统计线索。
- 不把 XLSX 强行转成长文模板，不承诺导出 xlsx。

### 验收标准
- UI 显示工作表数量、维度、行列/单元格、合并单元格、公式、样式统计。
- generationInstruction 把表格证据转译为指标/口径/观察/结论约束。

## Stage 3 方案草案：PPTX

### 能力边界
- 提取 slide、layout、master、theme、逐页文本样本。
- 不承诺直接生成 PPTX 文件。

### 验收标准
- UI 显示幻灯片数量、版式/母版/主题、逐页文本线索。
- generationInstruction 转译为汇报大纲、每页主题、讲述要点。

## Stage 4 方案草案：PDF

### 能力边界
- 提取页数、字体引用、文本操作符、图片数量、加密/XFA、扫描风险。
- 只作为低保真参考，不承诺还原版式。

### 验收标准
- UI 显示文本层/扫描风险诊断。
- generationInstruction 明确低保真边界和证据不足时的写作约束。

## Stage 5 统一验收

- 四格式均走同一个导入入口、同一个 profile persist/store、同一个底稿绑定 snapshot。
- UI 不因证据过多挤占布局。
- 手动输入模板入口不恢复。
- 通过 typecheck、目标单测、mock 测试和 build。






## 最终统一验收记录（2026-05-13）

- 实验基线：Phase 0 5/5，Phase 1 5/5，Phase 2 35/35。
- Rust：新增 probe_format_profile 命令，cargo check 通过；仅保留既有 warning。
- 前端：DOCX / XLSX / PPTX / PDF probe 证据均能合并为 FormatProfile。
- UI：格式画像详情显示结构线索、文本样式/版式线索、诊断、生成约束，内容区保持内滚动。
- 绑定：profileSnapshot 继续进入 draft-processing prompt。
- 边界：不承诺导出，不承诺高保真复刻，不恢复手动输入模板。
- 测试：目标单测 24/24；test:mocks 83 files / 1127 tests；npm run build 通过。
- 附带修复：real-FS 测试适配器改为临时文件 + rename 原子替换，消除 ingest queue JSON 读写竞态。

## 2026-05-14 全量计划复读后的产品化设计补充

本节用于修正“只把 StyleFacts 映射进 FormatProfile”的过窄理解。完整阅读 `.omx/plans` 后，下一阶段产品化设计必须同时承接以下历史约束和最新实验成果。

### A. 最新实验状态

- 四格式确定性 FormatProfile 产品化已经通过：统一导入入口、probe、profile、snapshot、generationInstruction、diagnostics 已进入主线。
- 语义精炼 harness 已通过 mock 与真实 LLM 验证，但仍是实验，不是桌面端产品能力。
- DataScope 对照实验已通过安全门槛：`evidence-only` 仍应是默认；`snippets/fulltext` 没有证明默认收益，只能作为显式授权的高级/补救候选。
- StyleFacts 实验已通过：DOCX/XLSX 为 primary golden，PPTX/PDF 为 baseline diagnostics；所有样式事实必须有 evidenceRefs，LLM 只能做解释 overlay。

### B. 设计遗漏修正

下一阶段不是单独新增一个“样式展示面板”，而是要设计完整链路：

```text
成品文件
  → deterministic probe
  → FormatProfile.raw / StyleFacts
  → FormatBinding
  → Draft / 既有底稿适配
  → generationInstruction / diagnostics
  → 后续 Match Report / Export / Audit 的可追踪输入
```

必须纳入但不得提前实现的上层需求：

1. **FormatBinding**：记录当前底稿/生成任务绑定了哪个格式画像、哪个 StyleFacts hash、哪个 profileSnapshot。
2. **两条用户路径**：
   - 先选择格式画像，再生成底稿；
   - 已有底稿，再适配格式画像。
3. **Draft / 版本约束**：正式输出和格式适配必须最终绑定到 Draft version；没有可靠 Draft，不进入导出/复刻承诺。
4. **匹配报告预留**：StyleFacts 和结构线索未来要服务 Template/Format Match Report，而不只是 UI 摘要。
5. **Audit / Provenance 预留**：必须保留 source profile、StyleFacts hash、evidence refs、LLM overlay status、data scope、model metadata 的记录入口。
6. **非程序员原则**：UI 不能暴露“chunk/index/evidence hash”等内部术语作为主要操作；证据可展开但默认应是人可读摘要。
7. **状态克制**：不要新增噪音任务中心；复杂处理只显示当前阶段、失败原因和可恢复动作。

### C. 下一阶段产品化设计门禁

在开始实现前，必须先形成设计方案，至少回答：

- `styleFacts -> FormatProfileRecord` 的字段映射和兼容策略是什么？
- `FormatBinding` 是否需要扩展，以记录 StyleFacts hash / overlay status / dataScope？
- UI 如何同时展示“样式事实、人类摘要、证据详情、边界诊断”，且不挤占布局？
- generationInstruction 使用 StyleFacts 的摘要规则是什么？如何控制 token 长度？
- LLM overlay 如果后续接入，如何保留 renderer owns final instruction、closed schema、evaluator、fallback？
- snippets/fulltext 的显式授权 UI 是否本阶段实现；如果不实现，如何明确默认 evidence-only？
- Match Report / Export / Audit 需要哪些预留字段，但本阶段不承诺实现？

### D. 本阶段明确不做

- 不恢复手动输入模板。
- 不让 LLM 生成或覆盖字体、字号、边距、颜色、排版事实。
- 不默认发送 snippets/fulltext。
- 不承诺 DOCX/PDF/PPTX/XLSX 导出或视觉复刻。
- 不实现完整 Template Match Report、Formal Export、Long Document Project；只做必要数据预留。

## Stage 6：确定性 StyleFacts 产品化闭环（2026-05-14）

| 阶段 | 范围 | 状态 | 测试证据 | 记录 |
| --- | --- | --- | --- | --- |
| 6 | StyleFacts 事实层产品化 | 已完成 | `npx tsc --noEmit --pretty false` PASS；`npm run typecheck` PASS；`npm run test:mocks` 84/84 files、1137/1137 tests；目标测试 5 files / 31 tests；`npm run build` PASS；边界关键词守卫 PASS | Decision 014；PRD/test-spec Phase A closure |

### Stage 6 完成内容

- 四格式确定性样式事实统一封装为 `StyleFactsEnvelope`，包含 schema、source、capabilities、facts、evidence、diagnostics、hash。
- `FormatProfileRecord` 保存 `styleFacts` 与 Phase A 限定的 refinement 状态。
- 旧样式摘要改为由 StyleFacts 派生；snapshot 与 draft prompt 携带 bounded metadata/summary。
- UI 默认展示人类摘要、边界说明；证据详情折叠显示，避免过多内容挤占其它栏。
- 手动输入模板未恢复；LLM 未接入；不承诺导出或视觉复刻。

### 下一阶段门禁

进入 Stage 7 前必须先通过 ralplan 设计 LLM 接入方案，并形成新的 PRD/test-spec。Stage 7 不得跳过 renderer/evaluator/fallback/audit/data-scope 设计。


## Stage 8：FormatSpec 四格式实验（2026-05-14）

| 阶段 | 范围 | 状态 | 测试证据 | 记录 |
| --- | --- | --- | --- | --- |
| 8 | FormatSpec 中间层实验 | 已完成 | `node experiments/format-spec/scripts/run-format-spec.mjs` PASS：DOCX 17 rules、XLSX 12 rules、PPTX 12 rules、PDF 8 rules，4/4 pass | PRD/test-spec 已落盘；实验产物位于 `experiments/format-spec/outputs/*` |

### Stage 8 设计结论

- 新增概念层 `FormatSpec`：位于 StyleFacts / SemanticOverlay 与 draft prompt 之间。
- `FormatSpec` 负责把“机械事实/证据解释”转译为详细格式规则：标题层级、编号符号、字体字号、缩进、对齐、行距、表格/工作簿/幻灯片/PDF 参考边界。
- `FormatSpec` 不包含来源文件正文，不把格式画像中的原文条款写入 prompt。
- 四格式使用统一外壳和类型专属分支：DOCX 正式文稿规则、XLSX 表格/指标规则、PPTX 汇报/逐页规则、PDF 低/中置信参考诊断。
- 产品接入时，新的 FormatSpec prompt 应替代当前冗余画像约束 prompt，而不是继续叠加原始结构线索。

### Stage 8 边界

- 本阶段是实验 harness，不接入产品 UI / Store / draft-processing 主链路。
- 不恢复手动输入模板。
- 不让 LLM 生成或覆盖样式事实。
- 不默认发送 snippets/fulltext。
- 不承诺导出或视觉还原。

### Stage 8 产物

- 设计：`.omx/plans/prd-format-spec-four-format-experiment.md`
- 测试规格：`.omx/plans/test-spec-format-spec-four-format-experiment.md`
- 实验：`experiments/format-spec/`
- 汇总：`experiments/format-spec/reports/latest-summary.json`

### Ralplan 补审 ITERATE 修订记录（2026-05-14）

- Critic 首轮 verdict：ITERATE。
- 修订项：补齐 `independent-evaluator-summary.json` 的 summary-level provenance，并更新 Decision 017 最终验收记录。
- 新增 provenance 字段：evaluatorSha256、generatorSha256、caseCount、cases[].input/case/spec/spec-md/prompt hash。
- 复验：`node experiments/format-spec/scripts/evaluate-format-spec.mjs` PASS；happy path 4/4，negative self-tests 5/5。

### Ralplan 最终复审结论（2026-05-14）

- Planner：REVISE_BEFORE_REVIEW。
- Architect round 1：APPROVE。
- Critic round 1：ITERATE。
- Architect round 2：APPROVE。
- Critic round 2：APPROVE。

最终状态：FormatSpec 四格式实验可行性与 evaluator/provenance 记录闭环通过。该结论不代表产品化接入、schema 冻结、导出能力或视觉还原能力。

后续进入产品化设计前置条件：

1. draft-processing replacement：消费 FormatSpec renderer 输出，而不是叠加旧画像约束 prompt。
2. 产品级 schema/version/migration 策略。
3. UI preview / audit / provenance 展示和失败态设计。
4. 主链路 unit/integration/e2e 回归测试。
5. 生产审计模型：source profile、StyleFacts hash、evidence refs、model/provider metadata、data scope。

## Stage 9：FormatSpec 产品化接入设计（2026-05-14）

| 阶段 | 范围 | 状态 | 测试证据 | 记录 |
| --- | --- | --- | --- | --- |
| 9 | FormatSpec 替代 draft-processing 旧画像 prompt 的产品化接入 | 已完成 | experiment parity 4/4 + negative 5/5；typecheck PASS；test:mocks 86 files / 1152 tests PASS；build PASS | PRD/test-spec Phase C；Decision 018/019 |

### Stage 9 设计结论

- 产品化采用 Option B：`FormatSpec core module + draft snapshot 消费 renderer 输出`。
- `format-spec.ts` 必须是唯一画像 prompt renderer。
- draft-processing system prompt 插入一次 `snapshot.formatSpec.promptBlock`；user prompt 不插入画像块。
- `sourceProfileHash` 与 `formatSpecHash` 分离。
- `DraftProcessingFormatProfileSnapshot` 等领域类型下移到 `src/lib/format-profile-types.ts`，消除 lib -> store 类型依赖。
- legacy `generationInstruction` 只做兼容展示/诊断，不进入新主链路。

### Stage 9 完成记录（2026-05-14）

- 已新增 `src/lib/format-spec.ts`，作为产品唯一 FormatSpec prompt renderer。
- 已新增 `src/lib/format-profile-types.ts` 与 `src/lib/draft-types.ts`，消除 `src/lib/format-profile.ts`、`src/lib/draft-processing.ts` 对 `@/stores/*` 的类型依赖。
- `buildFormatProfileSnapshot()` 现在物化 `sourceProfileHash`、`formatSpecHash` 与 `formatSpec.promptBlock/schemaVersion/rendererVersion/policyVersion/summaryLines`。
- `draft-processing` 改为 system prompt 插入一次 `snapshot.formatSpec.promptBlock`；user prompt 不再插入画像块、StyleFacts、智能解释或 legacy generationInstruction。
- legacy `generationInstruction` 保留为兼容 metadata，不参与新 draft-processing 主链路。
- 验证：`node experiments/format-spec/scripts/run-format-spec.mjs` PASS；`node experiments/format-spec/scripts/evaluate-format-spec.mjs` PASS（happy path 4/4，negative self-tests 5/5）；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1152 tests）；`npm run build` PASS。

### Stage 9 剩余边界

- 当前只完成 prompt contract 替换，不包含导出、视觉复刻、UI 重设计或 snippets/fulltext 授权流。
- 产品 FormatSpec 是实验成果的产品子集；仍保持 evidence-only 与“不承诺导出/视觉还原”边界。


## Stage 10 候选：严格不改正文/只排版保护模式（未启动）

记录日期：2026-05-14

用户侧保存底稿冒烟显示：FormatSpec 主链路已基本通过，能避免来源画像正文污染并保留 Markdown 表格/列表/标题结构。

暂不修改代码。后续若启动，需要先设计再实现，候选范围包括：

- 识别“不修改正文 / 只排版 / 按格式画像排版”的任务意图。
- 保护 wiki 双链 `[[...]]`、引用标记 `[1]`、Markdown 表格、列表编号、段落顺序和事实表达。
- 明确允许的排版动作：标题层级、空行、缩进、列表一致性、子标题层级整理。
- 明确禁止的动作：删除链接语法、改写事实文本、摊平表格、重排正文、把来源画像正文写入目标底稿。

当前状态：仅记录 backlog，不进入实现。


## Stage 10：FormatSpec 可视化/审计/预览设计（2026-05-14）

| 阶段 | 范围 | 状态 | 测试证据 | 记录 |
| --- | --- | --- | --- | --- |
| 10 | Phase D-1 FormatSpec Visibility / Audit / Preview | 已完成 | format-spec/draft-processing targeted 15 tests PASS；typecheck PASS；test:mocks 86 files / 1153 tests PASS；build PASS | `.omx/plans/prd-format-spec-phaseD-visibility-audit.md`；Decision 021/022 |

### Stage 10 设计结论

- 先做 FormatSpec 可视化/审计/预览，让用户看见“模型实际收到的格式约束”。
- 不在本阶段实现严格不改正文/只排版保护模式；该项继续作为 Stage 10 候选 backlog。
- D-1 必须扩展 `FormatSpecSnapshot`，把 `sourceFileType`、`documentIntent`、`confidence`、`contentLeakagePolicy`、`boundaries`、`rules` 作为结构化 audit fields。
- UI 必须消费结构化 snapshot/view，不得解析 `promptBlock`，不得手工重建规则。
- 完整 `promptBlock` 仅作为二级审计文本，默认折叠，并标注不代表导出或视觉复刻承诺。
- 旧 `generationInstruction` 如继续展示，必须标注“兼容展示，不参与新加工主链路”。

### Stage 10 待实现验证

- FormatSpec view helper / snapshot contract tests。
- format profile detail UI audit smoke。
- draft-processing conversation audit smoke。
- i18n parity。
- `npm run typecheck`、`npm run test:mocks`、`npm run build`。


### Stage 10 完成记录（2026-05-14）

- 已扩展 `FormatSpecSnapshot`，将 `sourceFileType`、`documentIntent`、`confidence`、`contentLeakagePolicy`、`boundaries`、`rules` 纳入结构化审计 source-of-truth。
- 已新增 `buildFormatSpecAuditView()`，按结构化 snapshot 生成 UI view；UI 不解析 `promptBlock`，也不手工重建规则。
- 格式画像详情页新增 FormatSpec 审计区：版本/hash、类型摘要、必守边界、规则分组、二级折叠审计文本。
- draft-processing 会话 banner 新增“本次格式约束”审计入口，消费会话 snapshot。
- 旧 generationInstruction 区域改为“兼容生成约束”，标注不参与新加工主链路。
- 验证：`npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（15 tests）；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1153 tests）；`npm run build` PASS。

### Stage 10 剩余边界

- 本阶段未实现严格不改正文/只排版保护模式。
- 本阶段未引入 snippets/fulltext、正式导出或视觉复刻能力。
- 完整 `promptBlock` 仅作为默认折叠审计文本，不作为产品承诺。

### Stage 10 兼容性修复记录（2026-05-14）

- 用户手动测试发现运行时错误：`snapshot.rules is not iterable`。
- 诊断结论：Phase D-1 扩展了 `FormatSpecSnapshot.rules` 等结构化审计字段，但历史会话/旧持久化草稿中仍可能保存旧版 `formatSpec` 快照；UI 审计入口读取旧快照时发生崩溃。
- 修复：`buildFormatSpecAuditView()` 对旧快照做运行时兼容兜底：`rules`、`boundaries`、`summaryLines` 缺失时按空数组处理，`sourceFileType/documentIntent/confidence/contentLeakagePolicy/promptBlock` 缺失时使用安全默认值。
- 新增回归：旧版最小 `formatSpec` 快照不再崩溃，审计视图显示 `unknown`/空规则而不是中断页面。
- 验证：`npm run typecheck` PASS；`npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（2 files / 16 tests）；`npm run build` PASS。

### Stage 10 手动复测与质量差距记录（2026-05-14）

- 用户复测结论：`snapshot.rules is not iterable` 兼容性问题已通过。
- 新质量判断：当前 FormatSpec 可见、可审计、可进入主链路，但规则粒度仍未达到 GB/T 9704—2012 式的细则化效果。
- 差距定义：当前规则更接近“格式约束摘要/排版倾向”，尚未系统表达标题层级、编号形态、字体/字号、缩进、对齐、行距、段前段后、页边距、表格/版心等逐层可执行规范。
- 后续方向：下一阶段应单独设计“GB/T-like FormatSpec Granularity Upgrade”，先做规则 schema 与四格式实验，再产品化；不应把该目标混入 D-1 审计 UI 修补。

## Stage 11：LLM FormatRuleSpec Synthesis 实验通过（2026-05-14）

- 目标：不再继续堆确定性死规则，而是让 LLM 基于已采集 evidence/material 推理出 GB/T-like 细粒度格式规则体系。
- 对照组：当前产品 FormatSpec；旧画像约束的泄漏风险；负对照 mock-uncited。
- 实验产物：`experiments/format-rule-synthesis/`。
- 关键设计修正：真实 LLM 倾向“少量规则 + 大量属性”，因此 evaluator 不奖励规则数量膨胀，改以 target coverage、attribute coverage、evidence coverage、granularity score 为主。
- 验证：`node experiments/format-rule-synthesis/scripts/evaluate-format-rule-synthesis.mjs` PASS（mock-llm 4/4，negative 4/4 fail）；`FORMAT_RULE_CODEX_MODEL=gpt-5.5 node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode real-llm --allow-external-llm` PASS（DOCX/XLSX/PPTX/PDF 4/4，granularityScore 100）。
- 结论：进入产品化设计；产品化必须保留 evaluator、证据绑定、provider 失败 fallback，不允许 LLM 写入 StyleFacts 事实层。

## Stage 12：LLM FormatRuleSpec Synthesis 产品化完成（2026-05-14）

- 设计产物：`.omx/plans/prd-format-rule-synthesis-productization.md`、`.omx/plans/test-spec-format-rule-synthesis-productization.md`。
- 实现：现有 semantic overlay schema 增加 `formatRuleSynthesis`；evaluator 校验证据引用、closed schema、禁越界字段与边界承诺；FormatSpec renderer 在存在 accepted synthesized rules 时优先使用 LLM 归纳规则，否则回退确定性规则。
- UI：FormatSpec 审计规则分组可展示 rule attributes；完整 promptBlock 仍为折叠审计文本。
- token 设置：semantic overlay 默认 max_tokens 从 2400 提升到 3600，以容纳细粒度规则输出。
- 验证：targeted tests 3 files / 26 tests PASS；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1156 tests）；`npm run build` PASS。
- 边界：LLM 仍不写 StyleFacts 事实层；未知 evidenceRef reject/fallback；不默认 snippets/fulltext；不承诺导出、视觉还原或高保真复刻。



### Stage 12 兼容性修复：FormatRule source 归一化（2026-05-14）

- 问题：真实模型输出 `formatRuleSynthesis.source = inferred` 时，evaluator 按内部枚举要求拒绝，提示 `format rule source is invalid`。
- 判断：模型输出的规则内容和证据绑定方向基本正确；失败点是枚举命名不兼容，不应改为任意字符串，也不应放松 evidence 校验。
- 修复：增加白名单归一化，将 `inferred` / `model-inferred` / `ai-inferred` 归一到 `llm-inferred`，将 `evidence-based` / `from-evidence` 归一到 `detected`，将 `default` / `fallback` 归一到 `standard-default`。未知值继续 reject/fallback。
- 验证：`npx vitest run src/lib/format-profile-semantic-overlay.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（3 files / 26 tests）；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1156 tests）；`npm run build` PASS。
- 边界：只做输入兼容；不改变 evidence-only、不允许 LLM 写 StyleFacts、不承诺导出或视觉复刻。


### Stage 12 诊断增强：FormatRule source 原值回显（2026-05-14）

- 背景：source alias 映射已存在，但用户真实测试仍出现 `format rule source is invalid`；需要确认是旧 bundle、未覆盖的新 source 形态，还是字段结构异常。
- 实现：在 evaluator violation 中追加 `received <原始值>`，便于下一轮从 UI 错误信息直接定位真实模型输出。
- 边界：只增强诊断，不新增映射，不改变通过/拒绝逻辑，不放松 evidence 校验。
- 验证：targeted tests 3 files / 26 tests PASS；`npm run typecheck` PASS；`npm run build` PASS。


## Stage 13：Editable Format Constraints 产品化完成（2026-05-14）

- 目标：将“LLM 基于 evidence 推理 GB/T-like 规则”与“用户可编辑最终格式约束”合并成产品闭环。
- 实验：`experiments/editable-format-constraints/` 验证 auto、missing-source、unknown-source、edited 和三个负例门禁；四格式 4/4 PASS。
- 设计产物：`.omx/plans/prd-editable-format-constraints-productization.md`、`.omx/plans/test-spec-editable-format-constraints-productization.md`。
- 实现：
  - overlay evaluator 对 `formatRuleSynthesis.source` 缺失/未知进行 warning + 默认 `llm-inferred`，不再硬拒绝。
  - `FormatProfileRecord.editableFormatSpec` 持久化用户编辑后的约束文本。
  - `buildFormatSpecSnapshot()` 在编辑覆盖与当前自动 FormatSpec hash 匹配时使用用户编辑 promptBlock。
  - 格式画像详情页支持编辑、保存、重置 FormatSpec 审计文本/实际发送约束。
- 验证：targeted tests 4 files / 33 tests PASS；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1159 tests）；`npm run build` PASS。
- 边界：当前为文本级可编辑 MVP；不默认 snippets/fulltext；不允许 LLM 改 StyleFacts；不承诺导出、视觉还原或高保真复刻。


## Trace Update：FormatSpec influence prompt strengthening（2026-05-14）

- Issue: 用户手动对比结果显示，格式约束虽然进入链路，但模型只做了轻微 Markdown 调整，未明显执行 GB/T-like 或用户编辑约束。
- Root cause: draft-processing system prompt 只说明“携带 FormatSpec”，没有明确要求模型主动应用格式合同；“不修改正文”容易被模型理解为不要调整结构/列表/标题。
- Fix:
  - system prompt 明确：FormatSpec 是本次修订的有效格式合同。
  - 明确要求主动应用到标题层级、编号体系、列表样式、段落组织和表格呈现。
  - 明确“不修改正文”指不改事实、引用和语义，仍应执行纯格式调整。
  - 新增显性用户编辑约束进入 system prompt 的回归测试。
- Verification:
  - targeted tests: 4 files / 34 tests PASS。
  - `npm run typecheck` PASS。
  - `npm run build` PASS。
- Boundary: 仍不承诺字体/字号等 Markdown 不可表达的视觉还原；本修复提升 prompt 权重，不改变 evidence-only 和事实边界。

### Stage 14 — FormatSpec multi-rule checklist enforcement (2026-05-14)

- Manual evidence: generated draft applied heading/numbering normalization but failed to convert one bullet-list block, proving editable FormatSpec reached the model but multi-rule adherence was partial.
- Product adjustment: strengthened draft-processing system prompt so FormatSpec is treated as an effective format contract; “do not modify正文” is clarified as preserving facts/references/semantics while still allowing pure formatting changes; multi-action constraints must be checked and applied item-by-item.
- Added regression coverage for checklist-style edited constraints, especially title/list/numbering combined rules.
- Verification: `npx vitest run src/lib/draft-processing.test.ts src/lib/format-spec.test.ts --reporter=verbose` PASS; `npm run typecheck` PASS; `npm run build` PASS.
- Boundary: this improves model instruction adherence only; it does not claim DOCX export fidelity or visual restoration.

### Stage 15 — Universal draft output contract (2026-05-14)

- Accepted the product-level conclusion that the failure mode is not “one missing dead rule” but ambiguity between chat reply and saveable draft body.
- Implemented a generic draft output contract: only revised draft body, no chat preface/suffix/analysis/revision explanation, output starts from document title or first body paragraph.
- Added structure-role constraints: Markdown markers are storage expressions; model must map document-title, section-title, subsection-title, paragraph, ordered-list, unordered-list, and table roles before choosing output markers.
- Clarified that “不修改正文” protects facts/references/semantics while allowing pure format changes.
- Verification: `npx vitest run src/lib/draft-processing.test.ts src/lib/format-spec.test.ts --reporter=verbose` PASS; `npm run typecheck` PASS; `npm run build` PASS.
- Stop condition for this stage: avoid further local prompt chasing; move to the next productization stage after committing current work.
