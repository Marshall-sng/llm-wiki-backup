# 迁移决策账本

本文记录从原始迁移路线到当前实验路线的关键决策。它用于解释偏移，不替代原始需求。

## Decision 001：原始迁移文档冻结为需求基线

日期：2026-05-13

原方案：持续直接编辑 `PKM_TOOL_TO_LLM_WIKI_MIGRATION_REQUIREMENTS.md` 作为进度锚点。  
问题：当前实现路线已经发生产品层偏移，继续直接修改会混淆“原始需求”和“当前执行计划”。  
决策：将原始文档移动到 `.omx/plans/requirements/pkm-migration-original.md`，作为不可随意改写的需求基线。  
影响：后续进度通过追踪矩阵和 active plan 衡量。  
不做：不重写原始需求表达。

## Decision 002：手工模板库降级为兼容基础

日期：2026-05-13

原方案：用户手工创建模板，填写用途、结构、语气、约束，再绑定到底稿。  
问题：多数真实用户并不知道如何描述模板；正式材料场景中，用户更可能提供已有成品文件。  
决策：手工模板库保留为已完成基础能力，但不再作为下一阶段主线。  
新方向：上传成品文件，系统自动提炼 `FormatProfile`。  
影响：v1.7 之后主线从 Template Library 转为 FormatProfile 后端实验。  
不做：不立即删除现有模板库。

## Decision 003：模板不是最终样式，而是持续写作上下文

日期：2026-05-13

原方案：先生成底稿，最后套模板。  
新判断：这条路径需要支持，但更合理的主路径是先选择模板/格式画像，再在该框架下生成和加工底稿。  
决策：引入 `FormatBinding` 概念，表示底稿与格式画像的绑定关系。  
影响：实验需要同时验证：

1. `generate_from_profile`
2. `adapt_draft_to_profile`

不做：本次不设计前端交互。

## Decision 004：四种格式同时进入实验，但允许能力降级

日期：2026-05-13

原方案：先单独做 DOCX。  
新要求：DOCX / XLSX / PPTX / PDF 同时进入实验。  
决策：采用统一协议、分格式降级：

- DOCX：正式文稿结构和样式优先。
- XLSX：工作表、区域、表头、样式和表格表达优先。
- PPTX：slide、placeholder、theme、layout 和汇报表达优先。
- PDF：可解析文本、页面布局和诊断优先；扫描 PDF 不承诺高置信度。

不做：不承诺四种格式达到同等深度。

## Decision 005：暂不引入 karpathy/autoresearch 代码

日期：2026-05-13

参考：`https://github.com/karpathy/autoresearch`。  
判断：其固定样本、固定指标、自动迭代思想有价值，但原项目面向 LLM 训练，不适合直接作为本实验依赖。  
决策：先建立本项目自己的实验台、样本集、输出协议和评分方式。  
后续：评分器稳定后，可以引入轻量 autoresearch 式循环。  
不做：当前不引入外部 autoresearch 代码。

## Decision 006：当前版本完全放弃手动输入模板

日期：2026-05-13

原方案：手工模板库降级为兼容基础，作为已完成能力保留，但不作为下一阶段主线。  
新判断：继续保留“手动输入模板”会让产品路线产生误导，使用户以为需要自己描述结构、语气、约束和版式；这与当前更高价值的“上传成品文件 → 自动提炼 FormatProfile”路线冲突。  
决策：当前版本中完全放弃手动输入模板功能，不再作为兼容层、入口或待完善能力推进。  
影响：后续产品化围绕 FormatProfile / FormatBinding / 成品文件学习展开；已有手工模板相关实现若仍存在，应视为历史遗留或可删除对象，而不是产品承诺。  
取代：本决策取代 Decision 002 中“手工模板库保留为已完成基础能力”的表述。  
不做：当前版本不设计、不维护、不暴露手动输入模板流程。


## Decision 007：四格式 FormatProfile 产品化通过，下一阶段转向语义精炼

日期：2026-05-13

背景：DOCX / XLSX / PPTX / PDF 已经通过统一导入入口、后端确定性 probe、FormatProfile、profileSnapshot、generationInstruction 和 diagnostics 链路接回主线。用户实测 DOCX 已出现段落、候选标题、表格、样式、字体、字号和页面线索。

判断：当前版本已经满足“四格式进入统一产品化管线”的目标，但生成的画像属于确定性探测结果，结构线索和样式线索仍偏机械。例如正文条款可能被当作标题，章/条可能粘连，字体列表中存在默认西文字体或语言属性噪声。

决策：本轮四格式确定性探测产品化判定通过。后续重点不再是证明四格式能否进入管线，而是增加 FormatProfile Semantic Refinement / LLM Enrichment：在 raw probe 之后进行结构筛选、样式语义化、画像压缩和 generationInstruction 精炼。

影响：后续验收标准从“是否能导入并生成画像”升级为“画像是否可读、可控、可用于写作”。置信度需要区分 probe evidence confidence 与 semantic refinement confidence。

不做：不因当前机械画像而回退四格式产品化；不恢复手动输入模板；不提前承诺导出或高保真复刻。

参考记录：`.omx/plans/requirements/format-profile-productization-acceptance-and-semantic-refinement.md`

## Decision 008（2026-05-13）: LLM 语义精炼先以实验 harness 验证，不直接接入产品链路

**Decision**: 建立 `experiments/format-profile-semantic-refinement/`，以 closed schema + evidence catalog + evaluator + fallback 验证语义精炼可行性；当前版本不把 LLM 接入桌面端 FormatProfile 产品链路。

**Constraint**: 用户已确认四格式确定性探测通过，但 LLM 未接入导致画像机械；为避免 LLM 幻觉和越权生成，必须先证明可拒绝、可回退、可审计。

**Rejected**: 直接在 UI/Store 中调用 LLM 生成 generationInstruction。原因：会绕过 evidence refs、hash parity、fallback 和禁词边界，风险过高。

**Confidence**: high

**Tested**: `disabled` 4/4 fallback；`mock-pass` 4/4 refined；5 个失败模式均 fallback；13 项 hash/overlay 断言通过。

**Directive**: 后续产品接入必须通过 feature flag 和 adapter 层引入真实 LLM；不得复用 mock refiner 作为产品逻辑。

## Decision 009（2026-05-13）: 真实 LLM 先通过 harness provider 验证，产品接入仍延后

**Decision**: 在实验 harness 中新增真实 LLM provider，并使用 `codex-cli` 通道完成四格式真实测试；产品 UI/Store 仍不接入 LLM。

**Constraint**: MiniMax HTTP 通道当前 429 usage limit，DeepSeek key invalid，StepFun quota exceeded，本地 Ollama 不可用；需要一个可审计且不写产品链路的真实模型通道。

**Rejected**: 因 HTTP provider 额度失败而直接跳过真实测试。原因：本机 `codex-cli` 已可作为真实 LLM 通道验证 overlay/evaluator/fallback 合同。

**Confidence**: high

**Tested**: `real-llm` via `codex-cli:gpt-5.3-codex-spark`，DOCX/XLSX/PPTX/PDF 4/4 refined，evaluator pass；`real_llm_refined=4/4 failed=[]`。

**Directive**: 后续产品化只能复用 harness 的合同与测试，不得把 `codex-cli` 实验 provider 作为默认产品 provider。

## Decision 010（2026-05-13）: snippets/fulltext 进入产品化前必须先做 DataScope 对照实验

**Decision**: 在 `experiments/format-profile-semantic-refinement` 继续做 DataScope Comparison Experiment，比较 `evidence-only`、`evidence-plus-snippets`、`evidence-plus-fulltext`；暂不进入产品开发。

**Constraint**: Evidence 可能机械或不准确，但发送片段/全文涉及隐私、token 成本、泄漏风险和 evaluator 合同变化，必须先用实验验证收益与边界。

**Rejected**: 直接把“允许发送全文”做成产品选项。原因：尚未验证 snippets/fulltext 相比 evidence-only 的真实收益，也未验证授权、redaction、leak scan、sourceContext evidenceRefs 和 fallback 的完整安全闭环。

**Confidence**: high

**Tested**: 计划已完成 ralplan consensus：Architect 先 REVISE，修订后 Critic APPROVE。计划文件：`.omx/plans/format-profile-datascope-comparison.md`。

**Directive**: 执行前必须保留/fixture 旧 `outputs/mock-pass` baseline；实现仅限实验 harness；不得修改桌面端产品链路。

## Decision 011（2026-05-13）: DataScope 对照实验通过安全门槛，但 snippets/fulltext 暂不应作为默认产品能力

**Decision**: DataScope 实验实现并验证通过；后续产品化默认仍应采用 `evidence-only`，`snippets/fulltext` 只可作为显式授权的高级/补救模式候选。

**Constraint**: 当前四个 golden cases 上，`evidence-plus-snippets` 和 `evidence-plus-fulltext` 没有提升 qualityScore；虽然 sourceContextCoverage 在部分格式上提高，但不足以证明默认发送片段/全文的收益大于隐私/成本风险。

**Rejected**: 在下一阶段产品接入中默认启用 snippets/fulltext。原因：实验未证明质量收益；更高数据范围应继续由用户显式授权并保留安全提示。

**Confidence**: high

**Tested**: mock gates、regression、leak scan、failure modes、real-LLM 3 scopes × 4 cases；`real_llm_datascope_refined=12/12`。

**Directive**: 若产品接入，第一版默认 evidence-only；rich scopes 必须有独立授权、可见数据范围、leak/redaction、fallback 和审计记录。


## Decision 012：2026-05-13：样式高保真提取先以确定性 StyleFacts 实验通过，LLM 只能做证据绑定的解释层

**Decision**: 新增并通过 `experiments/format-profile-style-extraction/` 实验；DOCX/XLSX 进入 primary golden，PPTX/PDF 进入 baseline diagnostics。后续产品化应把确定性 `styleFacts` 作为事实源，LLM 只允许生成引用 evidence 的解释/诊断 overlay，不能生成或覆盖样式事实。

**Constraint**: 用户最关心字体、字号、排版等高保真样式解析；但“高保真”必须限定为 fixture-backed deterministic parser fidelity，不承诺视觉复刻、导出还原或 LLM 推断事实。

**Rejected**: 让 LLM 直接参与解析并写入字体、排版、颜色、边距等事实字段。原因：会破坏 evidence 可审计性，且 evidence 若机械/不准时，LLM 更容易放大错误；正确路径是 deterministic parser 产出事实，LLM 只解释并引用 evidence。

**Confidence**: high

**Tested**: deterministic 4 cases；mock-pass 4 cases；mock-hallucination / mock-overwrite-facts / mock-unknown-evidence 均 fail-closed；`verify-style-extraction.mjs` PASS（11 outputs）；`npm run typecheck` PASS；`npm run test:mocks` PASS（83 files / 1127 tests）。

**Directive**: 下一阶段如产品化，不得把 overlay 合并进事实层；必须先设计 `styleFacts -> FormatProfile` 映射、UI 展示边界和失败降级策略。

## Decision 013（2026-05-14）：StyleFacts 产品化设计必须回到 FormatBinding / Draft / Audit 闭环，而不是只做样式 UI

**Decision**: 下一阶段产品化设计以 `deterministic StyleFacts → FormatProfileRecord → FormatBinding/ProfileSnapshot → UI 摘要/证据折叠 → generationInstruction` 为最小闭环；同时为 Match Report、Formal Export、Output Audit、LLM overlay 和 rich data scopes 预留字段与边界，但不在本阶段伪完成这些后置能力。

**Constraint**: 完整复读 `.omx/plans` 后确认，原始迁移需求的核心不是样式美化，而是正式材料闭环：Draft/版本、格式/模板约束、匹配报告、导出、审计和来源追踪。StyleFacts 实验只解决了“样式事实可审计提取”，不能替代这些上层闭环。

**Rejected**: 仅新增一个 StyleFacts UI 面板并宣称完成产品化。原因：会漏掉 FormatBinding、两条用户路径、Draft version、未来 Match Report/Audit、DataScope 授权和 LLM renderer/evaluator 合同。

**Confidence**: high

**Tested**: 本决策为计划/需求修正，已基于 `.omx/plans` 全量 Markdown 复读和现有实验记录；尚未进入实现测试。

**Directive**: 进入代码前必须先对齐 PRD/test spec；第一版默认 evidence-only、deterministic facts-only；不得默认发送 snippets/fulltext，不得让 LLM 写事实，不得恢复手动输入模板，不得承诺导出或视觉复刻。

## Decision 014（2026-05-14）：确定性 StyleFacts 产品化闭环通过，LLM 接入进入下一阶段设计

**Decision**: Phase A 已将实验验证过的确定性 StyleFacts 产品化到桌面端主链路：`probe -> StyleFactsEnvelope -> FormatProfileRecord -> profileSnapshot -> draft-processing prompt -> UI/evidence diagnostics`。旧的松散样式摘要路径由 StyleFacts 派生结果替代；本阶段关闭后，下一阶段才能通过 ralplan 设计 LLM 语义 overlay。

**Constraint**: 当前版本已经完全放弃手动输入模板；样式事实必须来自确定性 parser evidence，LLM 不能生成或覆盖字体、字号、页边距、颜色、排版等事实；默认数据范围必须保持 `evidence-only`。

**Rejected**: 在 Phase A 中一并接入真实 LLM、snippets/fulltext、导出复刻或高保真视觉承诺。原因：这些都属于 Phase B/后续授权链路，需要 renderer/evaluator/fallback/audit 合同后才能进入产品。

**Confidence**: high

**Tested**: `npx tsc --noEmit --pretty false` PASS；`npm run typecheck` PASS；`npm run test:mocks` PASS（84 files / 1137 tests）；目标 StyleFacts/Profile/Draft/i18n 测试 PASS（5 files / 31 tests）；`npm run build` PASS；边界关键词守卫 PASS（无 Phase B/rich scope/高保真承诺泄漏）。

**Directive**: 后续 LLM 产品接入必须以 StyleFacts 为事实源，只能生成证据绑定的 semantic overlay；不得把 overlay 合并进事实层；不得默认发送 snippets/fulltext；不得恢复手动输入模板；不得承诺导出或视觉复刻。

## Decision 015（2026-05-14）：Phase B LLM 接入方案通过，进入 evidence-only semantic overlay 实现

**Decision**: LLM 接入采用 evidence-only semantic overlay 产品方案：LLM 只能解释 deterministic StyleFacts/evidence，输出 closed-schema overlay；产品 renderer/evaluator/fallback/audit 负责最终 instruction、验收、降级和可追踪记录。方案已通过 Architect 与 Critic 审查，可以进入实现。

**Constraint**: 不恢复手动输入模板；不让 LLM 创建/覆盖 StyleFacts；不默认发送 snippets/fulltext；不承诺导出、视觉复刻或高保真还原；Phase B 不引入通用 `profileVersion`，stale key 使用 `profileId + updatedAt + profileSnapshotHash + styleFactsSha256`。

**Rejected**: 直接让 LLM 改写 `FormatProfileRecord` 或 `generationInstruction`；默认启用 snippets/fulltext；只做前端 UI 解释层。原因：这些路径会破坏事实边界、隐私默认值、renderer ownership 或主链路复用。

**Confidence**: high

**Tested**: 本决策为设计审查结果；Architect REVISE 后 APPROVE，Critic APPROVE。实现测试尚未执行。

**Directive**: 实现必须先构建 allowlisted `EvidenceOnlyOverlayInput` 和 overlay evaluator/renderer/provider wrapper；provider payload 不得接收完整 `FormatProfileRecord`；任何 rejected/failed/stale/running-recovery 都必须 deterministic fallback。

## Decision 016（2026-05-14）：Phase B evidence-only LLM semantic overlay 已产品化，默认仍保持确定性降级

**Decision**: LLM 接入已以产品 semantic overlay 方式实现：模型调用通过现有 LLM provider 配置触发，输入为 allowlisted `EvidenceOnlyOverlayInput`，输出必须通过 closed schema 与 evaluator，最终由 renderer 合成摘要和 generationInstruction。StyleFacts 事实层不被 LLM 写入或覆盖。

**Constraint**: 默认数据范围保持 `evidence-only`；snippets/fulltext 未进入默认产品流；provider payload 不接收完整 `FormatProfileRecord`；失败、拒绝、过期、重启中断都回退到 Phase A deterministic profile。

**Rejected**: 将真实 LLM 输出直接作为最终 `generationInstruction`；持久化 raw overlay JSON 为主指令；把 snippets/fulltext 默认发送给 provider；恢复手动输入模板。

**Confidence**: high for mock/product-contract validation; medium for real-provider runtime until desktop smoke test with configured model is executed.

**Tested**: Targeted tests PASS（5 files / 30 tests）；`npm run typecheck` PASS；`npm run test:mocks` PASS（85 files / 1143 tests）；`npm run build` PASS。

**Directive**: 后续若开启 snippets/fulltext，必须另起授权/脱敏/泄漏扫描/审计方案；不得绕过 `EvidenceOnlyOverlayInput`、evaluator 或 renderer；真实 provider 问题只允许影响 overlay 状态，不得阻塞确定性格式画像使用。


## Decision 017（2026-05-14）：新增 FormatSpec 中间层实验，替代冗余原文型画像约束

**Decision**: 在 StyleFacts / SemanticOverlay 与 draft prompt 之间引入 `FormatSpec` 概念层，并先通过实验验证四格式可行性。`FormatSpec` 只输出详细格式规则，不输出来源正文内容；后续产品化时应直接替代当前冗余画像约束 prompt。

**Constraint**: 用户指出当前画像约束过于机械、冗余，且包含来源格式画像中的原文内容，导致底稿加工被来源主题污染；格式约束应像 GB/T 9704-2012 式规范一样细到标题层级、编号、字体、字号、缩进、对齐、行距等，同时扩展到 XLSX/PPTX/PDF。

**Rejected**: 继续把 raw structure lines、候选标题原文、StyleFacts 摘要、diagnostics 和 semantic overlay 全量拼接进 draft prompt。原因：这会让 prompt 变长但不更清晰，并把“来源文件写了什么”误当成“目标底稿怎么排”。

**Confidence**: high for experiment feasibility; medium for product integration until draft-processing replacement and UI/audit design完成。

**Tested**: `node experiments/format-spec/scripts/run-format-spec.mjs` PASS；DOCX 17 rules、XLSX 12 rules、PPTX 12 rules、PDF 8 rules；4/4 evaluator pass；产物包含 `format-spec.json`、`format-spec.md`、`draft-prompt.md`、`evaluation.json`。

**Directive**: 后续产品接入必须让 draft-processing 消费 `FormatSpec` renderer 输出，不得继续默认注入来源正文/候选标题长文本；默认仍为 evidence-only；不得恢复手动输入模板；不得承诺导出或视觉还原。

### Ralplan 补审最终验收补充（2026-05-14）

Critic 首轮结论为 ITERATE，阻断点为 summary-level provenance 和 Decision 017 记录不完整。现已补齐：

- `experiments/format-spec/reports/independent-evaluator-summary.json` 增加 top-level `provenance`。
- 每个 summary case 记录 inputPath、inputSha256、caseSha256、formatSpecSha256、formatSpecMarkdownSha256、draftPromptSha256。
- 每个 `outputs/*/evaluation.json` 记录 per-case provenance，且补充 `formatSpecMarkdownSha256`。
- 独立 evaluator happy path：4/4 pass。
- negative self-tests：5/5 pass。

本结论仍限定为：`FormatSpec` 四格式实验可行性通过，不代表产品化完成，不代表 schema 冻结；产品接入必须另行设计 draft-processing replacement、UI preview/audit 和回归测试。

### Ralplan 最终复审结论（2026-05-14）

补做 ralplan 共识流程已完成：

- Planner：REVISE_BEFORE_REVIEW，要求补独立 evaluator、负例、泄漏检测、schema/enum、provenance。
- Architect round 1：APPROVE，要求 Critic 关注 summary-level provenance 与实验/产品边界。
- Critic round 1：ITERATE，要求补 summary-level provenance 和 Decision 017 最终验收记录。
- Architect round 2：APPROVE。
- Critic round 2：APPROVE。

最终批准边界：

- 只批准 `FormatSpec` 四格式实验可行性与 evaluator/provenance 记录闭环。
- 不批准直接产品化接入。
- 不视为 `format-spec.v0` schema 冻结。
- 不承诺导出、视觉还原、UI 主链路接入或 draft-processing 已替换。
- 默认仍为 evidence-only；不恢复手动模板；不默认发送 snippets/fulltext；不注入来源正文或 raw evidence dump。

最终验证证据：

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
node experiments/format-spec/scripts/evaluate-format-spec.mjs
npm run typecheck
```

结果：happy path 4/4 pass；negative self-tests 5/5 pass；typecheck PASS。

## Decision 018（2026-05-14）：FormatSpec 产品化接入必须替代旧画像 prompt，并先落 PRD/test-spec

**Decision**: 下一阶段产品化接入采用 `FormatSpec core module + draft snapshot renderer output` 方案。`src/lib/format-spec.ts` 将成为唯一画像 prompt renderer；draft-processing 只消费 `snapshot.formatSpec.promptBlock`，且只在 system prompt 插入一次。旧 `generationInstruction` 保留为 legacy metadata，但不参与新 draft-processing 主链路。

**Constraint**: Decision 017 只批准实验可行性，不批准直接产品化接入；当前产品代码仍存在 user/system 双画像注入、StyleFacts/semanticOverlay/generationInstruction 冗余拼接，以及 `src/lib/format-profile.ts` 依赖 store 类型的问题。

**Rejected**: 直接把实验脚本输出叠加到现有 `generationInstruction` 或当前 `formatProfileSnapshot()` 拼接逻辑。原因：会把旧冗余搬家，不能解决来源内容污染和双注入问题。

**Confidence**: high for design direction after Planner -> Architect REVISE -> Planner revision -> Architect APPROVE -> Critic APPROVE; medium for implementation until tests pass.

**Tested**: 本决策为产品化设计审查记录，尚未实现；已落 PRD/test-spec：`.omx/plans/prd-format-spec-productization-phaseC.md`、`.omx/plans/test-spec-format-spec-productization-phaseC.md`。

**Directive**: 实现前必须遵守 PRD/test-spec：类型边界下移到 `src/lib/format-profile-types.ts`；区分 `sourceProfileHash` 与 `formatSpecHash`；FormatSpec block 只能 system prompt 注入一次；user prompt 不得包含画像块；不得恢复手动模板、不得默认 snippets/fulltext、不得承诺导出或视觉还原。


## Decision 019（2026-05-14）：FormatSpec 产品化接入完成，旧画像约束 prompt 被替代

**Decision**: Phase C 已将 FormatSpec 产品化接入 draft-processing 主链路。`src/lib/format-spec.ts` 成为唯一画像 prompt renderer；`buildFormatProfileSnapshot()` 物化 `sourceProfileHash`、`formatSpecHash` 与 `formatSpec.promptBlock`；draft-processing 只在 system prompt 注入一次 FormatSpec，user prompt 不再携带画像块或 legacy generationInstruction。

**Constraint**: 该变更必须满足 Decision 017/018 的边界：不注入来源格式文件正文、不恢复手动输入模板、不默认 snippets/fulltext、不承诺导出、不承诺视觉还原/高保真复刻；LLM/semantic overlay 只能作为解释层，不能创建或覆盖 StyleFacts。

**Rejected**: 继续在旧 `generationInstruction` 上追加实验输出，或在 user prompt 中继续拼接 StyleFacts、semanticOverlay、诊断和来源结构线索。原因：这会保留冗余和来源内容污染，不能解决用户指出的“画像约束过于机械且包含原文内容”的核心问题。

**Confidence**: high for prompt-contract/product integration after full mock/build verification; medium for future real-model behavior because不同模型仍可能需要额外 prompt tuning。

**Tested**: `node experiments/format-spec/scripts/run-format-spec.mjs` PASS（4/4）；`node experiments/format-spec/scripts/evaluate-format-spec.mjs` PASS（happy path 4/4，negative self-tests 5/5）；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1152 tests）；`npm run build` PASS。

**Directive**: 后续若继续优化，应围绕 FormatSpec renderer 迭代规则粒度和 UI/audit 展示；不得重新启用旧画像拼接路径，不得让 draft-processing 直接消费 raw structure/source text/StyleFacts dump，不得绕过 evidence-only 边界。


## Decision 020（2026-05-14）：FormatSpec 用户侧冒烟基本通过，严格不改正文保护先记录不实现

**Decision**: 用户通过桌面端将一次“按照新的格式画像排版生成”的结果保存为底稿后确认，Chat 展示形态与存为底稿后的 Markdown 形态不同；以保存后的 Markdown 结果判断，本轮 FormatSpec 主链路基本通过用户侧冒烟：标题、一级标题、子标题、表格和列表结构保留良好，且未再出现来源格式画像正文污染或内部 StyleFacts/智能解释/诊断约束外露。

**Constraint**: 当前仍存在一个后续可优化点：当用户明确要求“不修改正文/只排版”时，模型可能去掉 wiki 双链 `[[...]]` 或调整导语与标题顺序。用户明确要求：可以记录，但先不修改代码。

**Rejected**: 立即修改 draft-processing 或 FormatSpec 以加入“严格不改正文”模式。原因：当前主目标已经基本达成，且需要先观察更多样例，避免过早把局部现象固化成复杂规则。

**Confidence**: high for current FormatSpec prompt-contract replacement and saved-draft smoke result; medium for strict no-body-change behavior until a dedicated protected-formatting mode is designed and tested.

**Tested**: 用户提供保存为底稿后的 Markdown 结果；结果显示表格、列表、标题层级均保留，且无来源画像正文污染。此前自动验证仍保持：FormatSpec experiment 4/4、independent evaluator 4/4 + negative 5/5、typecheck、test:mocks、build PASS。

**Directive**: 近期不要为此直接改代码；后续若进入 Phase D，可把“严格不改正文/只排版”作为独立任务意图或保护模式设计，重点保护 wiki 双链、引用标记、表格、列表、段落顺序和事实表达。


## Decision 021（2026-05-14）：Phase D 先做 FormatSpec 可视化/审计/预览

**Decision**: Phase D 下一步采用 Option A：先做 FormatSpec Visibility / Audit / Preview，而不是立即实现“严格不改正文/只排版保护模式”或真实模型回归样例集。计划文件为 `.omx/plans/prd-format-spec-phaseD-visibility-audit.md`。

**Constraint**: FormatSpec 当前已进入 prompt 主链路但用户不可见；下一步必须让用户能审计“模型实际收到的格式约束”。同时继续保持 evidence-only、不默认发送 snippets/fulltext、不恢复手动输入模板、不承诺导出或视觉高保真、不让 LLM 创建/覆盖 StyleFacts。

**Rejected**: 立即实现严格不改正文保护。原因：用户明确要求该点先记录不修改；且该模式涉及 wiki 双链、表格、列表、段落顺序和排版优化边界，需要另起 ralplan。也暂不优先做真实模型回归，因为缺少可视化审计层时回归结果难以产品化落地。

**Confidence**: high after ralplan review. Architect fallback review approved with adjustment：完整 promptBlock 不作为默认 UI 主视图，只作为二级审计文本。Critic 首轮 ITERATE 要求澄清审计字段 source-of-truth；已修订为扩展 `FormatSpecSnapshot` 结构化 audit fields，Critic 复审 APPROVE。

**Tested**: 本决策为计划审查结果，未改代码。代码事实通过只读检索确认：`format-spec.ts` 生成 snapshot；`draft-processing.ts` system prompt 消费；`drafts-view.tsx` 生成 snapshot/user prompt；`chat-panel.tsx` 生成 system prompt并显示格式画像标签；`format-profiles-view.tsx` 目前展示 StyleFacts/旧 generationInstruction 但未展示 FormatSpec。

**Directive**: D-1 实现时必须扩展 `FormatSpecSnapshot` 为 UI 审计 source-of-truth，UI 不得解析 `promptBlock` 或手工重建规则。完整 `promptBlock` 仅可作为默认折叠的审计文本，不代表导出或视觉复刻承诺。D-2 严格不改正文保护仍不得混入 D-1。


## Decision 022（2026-05-14）：Phase D-1 FormatSpec 可视化/审计/预览已产品化

**Decision**: Phase D-1 已实现。FormatSpec 不再只是内部 prompt contract；格式画像详情页与 draft-processing 会话现在都能展示结构化 FormatSpec 审计信息。`FormatSpecSnapshot` 被扩展为审计 source-of-truth，UI 消费结构化字段而不是解析 `promptBlock`。

**Constraint**: 继续保持 evidence-only；不默认发送 snippets/fulltext；不恢复手动输入模板；不承诺导出 DOCX/XLSX/PPTX/PDF；不承诺视觉还原或高保真复刻；不允许 LLM 创建/覆盖 StyleFacts。完整 `promptBlock` 只作为默认折叠的审计文本。

**Rejected**: 让 UI 解析 `promptBlock` 或手工重建规则。原因：这会造成 UI 与 renderer/source-of-truth 分叉，破坏 Critic 要求的审计一致性。

**Confidence**: high after targeted tests, full mock suite, typecheck, and build.

**Tested**: `npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（15 tests）；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1153 tests）；`npm run build` PASS。

**Directive**: 后续 D-2 严格不改正文/只排版保护必须另起 ralplan，不得混入当前审计 UI；任何后续 UI 都必须继续消费结构化 FormatSpec snapshot/view，不得解析 promptBlock 作为数据源。

## Decision 023（2026-05-14）：FormatSpec 审计视图必须兼容旧持久化快照

**Decision**: Phase D-1 的 `buildFormatSpecAuditView()` 必须把结构化审计字段视为可迁移字段，而不是假定所有历史会话/草稿都已拥有 `rules`、`boundaries`、`summaryLines` 等新字段。旧快照缺字段时，审计视图使用安全默认值降级显示，不能让页面崩溃。

**Constraint**: 用户手动测试触发 `snapshot.rules is not iterable`，说明桌面端可能读取到 Phase D-1 前保存的旧 `formatSpec` 快照。该问题不应要求用户清空历史数据或重建画像。

**Rejected**: 强制迁移/删除旧会话或要求用户重新生成格式画像。原因：这会破坏已有草稿上下文，并把产品兼容责任转嫁给用户。

**Confidence**: high。

**Tested**: `npm run typecheck` PASS；`npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（2 files / 16 tests），包含旧快照缺少结构化审计字段的回归用例；`npm run build` PASS。

**Directive**: 后续扩展 `FormatSpecSnapshot` 时，UI view helper 必须对历史持久化字段做兼容兜底；新增结构化字段不能直接假定存在。

## Decision 024（2026-05-14）：FormatSpec 细粒度升级转向 LLM 规则归纳，而不是继续堆确定性采集规则

**Decision**: 下一阶段产品化采用 `LLM FormatRuleSpec Synthesis`：确定性解析继续负责事实/evidence，LLM 负责把 evidence 推理成 GB/T-like 的细粒度、可执行格式规则；最终仍由 evaluator/renderer 控制进入 FormatSpec。

**Constraint**: 用户明确指出继续增加死规则存在边际效用递减；当前已采集足够 StyleFacts/StructureFacts，需要把证据交给 LLM 做规范归纳。

**Rejected**: 继续通过更多硬编码采集器追逐一级标题、二级标题、缩进、字号等所有变体。原因：规则越堆越脆弱，仍不能形成可执行规范体系。

**Confidence**: high after experiment and real Codex CLI smoke.

**Tested**: `node experiments/format-rule-synthesis/scripts/evaluate-format-rule-synthesis.mjs` PASS（mock-llm 4/4，negative 4/4 fail）；`FORMAT_RULE_CODEX_MODEL=gpt-5.5 node experiments/format-rule-synthesis/scripts/run-format-rule-synthesis.mjs --mode real-llm --allow-external-llm` PASS（4/4）。

**Directive**: 产品化时 LLM 输出只能作为规则归纳层；不得创建/覆盖 StyleFacts；未知 evidenceRef 必须 fail/fallback；不得承诺导出、视觉还原或高保真复刻。

## Decision 025（2026-05-14）：产品化复用 semantic overlay 承载 FormatRuleSpec，不新建事实层

**Decision**: 将 `formatRuleSynthesis` 并入现有 LLM semantic overlay schema。FormatSpec renderer 只消费 evaluator accepted 的规则；若 overlay 缺失、失败、拒绝或过期，继续使用确定性 FormatSpec fallback。

**Constraint**: 必须保持 StyleFacts 事实层确定性，避免新开一条 provider/state 链路造成重复 UI、重复 fallback 和重复审计。

**Rejected**: 新建独立 FormatRule provider/store 状态。原因：会重复已有 semantic overlay 的 provider、audit、fallback 机制，并增加用户理解成本。

**Confidence**: high。

**Tested**: targeted tests 3 files / 26 tests PASS；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1156 tests）；`npm run build` PASS。

**Directive**: 后续优化应围绕 overlay prompt/evaluator 和 FormatSpec audit 展示推进；不得让 LLM 修改 StyleFacts，不得绕过 accepted overlay 直接进入 draft-processing。



## Decision 026（2026-05-14）：FormatRule source 采用输入兼容、输出规范化

**Decision**: `formatRuleSynthesis.source` 对模型常见同义输出做白名单归一化：`inferred` / `model-inferred` / `ai-inferred` 归一为 `llm-inferred`，`evidence-based` / `from-evidence` 归一为 `detected`，`default` / `fallback` 归一为 `standard-default`；归一后进入产品内部的值仍只允许 `llm-inferred`、`detected`、`standard-default`。

**Constraint**: 用户真实模型测试显示，模型已经生成了可用的格式规则，但使用了 `source: inferred` 这类自然命名，导致 evaluator 以“format rule source is invalid”拒绝。该问题属于 schema 输入兼容性，不属于 evidence 校验失败或模型无能力。

**Rejected**: 直接放宽为任意字符串。原因：会削弱 closed schema 和审计一致性；未知 source 仍应 rejected/fallback。

**Confidence**: high。

**Tested**: `npx vitest run src/lib/format-profile-semantic-overlay.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（3 files / 26 tests）；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1156 tests）；`npm run build` PASS。

**Directive**: 后续只能补充明确映射的同义词；不得把 `source` 改成自由文本，不得放松 evidenceRefs、禁词、未知字段或 StyleFacts 事实边界校验。


## Decision 027（2026-05-14）：格式约束进入 evidence-based 可编辑草案模式

**Decision**: FormatRuleSpec 从 strict overlay 阻断式校验调整为“硬门禁 + 软字段归一 + 用户可编辑采用”。LLM 可以基于 deterministic evidence 合理推理 GB/T-like 细粒度规则；`source` 等内部 provenance 字段缺失或未知时由系统补齐/归一，不再导致整份 overlay rejected。用户编辑后的 FormatSpec promptBlock 优先进入 draft-processing。

**Constraint**: 用户明确指出根本需求是更快获得可执行格式规范，而不是更严格 JSON；允许 LLM 在 evidence base 上做合理推理，但必须提供用户可编辑机制来纠偏。

**Rejected**: 继续把 `source` 当模型必填硬字段。原因：`source` 是系统管线 provenance，不是文档事实，也不是用户关心的格式规则内容。

**Confidence**: high after experiment and product validation.

**Tested**: `node experiments/editable-format-constraints/scripts/run-editable-format-constraints.mjs` PASS（4/4）；targeted tests 4 files / 33 tests PASS；`npm run typecheck` PASS；`npm run test:mocks` PASS（86 files / 1159 tests）；`npm run build` PASS。

**Directive**: 后续可改进为结构化规则编辑器，但不得回退到 source/id 等软元数据硬拒绝；硬门禁仍必须覆盖 unknown evidenceRef、forbidden raw fields、StyleFacts overwrite 和导出/复刻/高保真承诺。

## Decision 028 — Draft output contract for format-constrained rewrites (2026-05-14)

Status: accepted

Decision: Treat draft-processing output as a saveable document body, not a chat answer. Add a general draft output contract and structure-role constraints before FormatSpec-specific rules.

Rationale:
- Manual testing showed the model could apply FormatSpec rules but still prepend chat-style explanation text or downgrade the document title role.
- The root cause is not a missing phrase blacklist; it is ambiguity between chat response and saveable draft content.
- A generic contract is reusable across DOCX-style drafts, Markdown wiki drafts, PPT/XLSX explanatory text, reports, plans, notices, and formal documents.

Rules captured:
- Output only the complete revised draft body; no confirmation, greeting, explanation, analysis, revision notes, preface, or closing remarks.
- Output starts at the document title or first body paragraph.
- Markdown is only a storage expression; the model must map document-title, section-title, subsection-title, paragraph, ordered-list, unordered-list, and table roles before choosing markers.
- “Do not modify正文” means do not alter facts, references, or semantics; pure formatting changes remain allowed.

Verification:
- `npx vitest run src/lib/draft-processing.test.ts src/lib/format-spec.test.ts --reporter=verbose` PASS, 20 tests.
- `npm run typecheck` PASS.
- `npm run build` PASS.

Boundary:
- This is prompt-contract/product behavior, not a guarantee of DOCX export fidelity or visual restoration.

## Decision 029 — Close FormatSpec stage and switch active planning to DOCX-first export (2026-05-14)

Status: accepted

Decision: Treat FormatProfile / StyleFacts / SemanticOverlay / FormatSpec / Editable Format Constraints / Draft Output Contract as a completed productization stage for now, archive its supporting plans, and make DOCX-first Formal Export the next active planning anchor.

Rationale:
- The FormatSpec prompt stage now has evidence-bound facts, LLM rule synthesis, editable constraints, and a generic draft output contract.
- Continuing to tune local prompt behavior in this stage has diminishing returns compared with validating an end-to-end formal export loop.
- Original formal-material use cases are primarily DOCX reports, notices, rules, plans, and briefing drafts.
- DOCX is the narrowest format for validating export contract, intermediate document, match review, adapter, export record, and audit before generalizing to PPTX / XLSX / PDF.

Records organization:
- `requirements/` now keeps only three core tracking files: `pkm-migration-original.md`, `migration-decision-log.md`, and `migration-traceability-matrix.md`.
- Supporting requirement notes and reference findings moved to `archive/2026-05-requirements-supporting-records/`.
- Completed FormatProfile / FormatSpec PRD, test spec, ralplan, and experiment plans moved or merged under `archive/2026-05-*` phase directories.
- Current active anchor is `active/docx-first-formal-export-next-stage.md`.

Rejected: keep all phase PRDs and test specs in the plans root | it obscures the current active direction and duplicates what the decision log / traceability matrix already summarize.

Rejected: start multi-format export immediately | adapter differences would split effort before the DOCX contract, match review, and audit loop are proven.

Confidence: high

Scope-risk: moderate

Directive: Next planning should start from DOCX-first Formal Export and should not reopen manual-template or FormatSpec prompt-chasing as the main line unless new evidence shows the export contract cannot use current FormatSpec outputs.

Tested: inspected `.omx/plans`; verified `requirements/` contains only the three core files; verified archived merged files retain original file markers; previous code verification for the closed stage remains `npx vitest run src/lib/draft-processing.test.ts src/lib/format-spec.test.ts --reporter=verbose`, `npm run typecheck`, and `npm run build`.

Not-tested: no new product code was changed by the plans cleanup; DOCX-first export design and implementation remain next-stage work.

## Decision 030 — DOCX-first Formal Export MVP architecture (2026-05-14)

Status: accepted as planning baseline

Decision: Start the next stage with a DOCX-first Formal Export MVP built around `DocxExportContract`, `DocxIntermediateDocument`, `DOCXExportAdapter`, `DocxMatchReview`, and `DocxExportRecord / Audit`.

Rationale:
- The user’s goal is not a prettier FormatSpec prompt but a saveable, reviewable, formally deliverable DOCX output.
- DOCX is the dominant formal-material target in the original migration needs: reports, notices, rules, plans, and briefing drafts.
- A deterministic export adapter plus review/audit loop is safer than letting an LLM directly generate or certify the final DOCX.
- An intermediate document layer keeps Markdown parsing, DOCX generation, and match review testable and reusable.
- ExportContract records what the export promises, what it only attempts, and what it does not support, preventing hidden state or false high-fidelity claims.

MVP scope:
- Export an existing `DraftRecord` to an openable DOCX.
- Preserve document title, section headings, paragraphs, ordered/unordered lists, simple Markdown tables, and references.
- Apply basic formal formatting such as font/size/page margin where supported.
- Read FormatSpec and apply only MVP-expressible rules.
- Record unsupported/skipped rules in diagnostics.
- Produce MatchReview and ExportRecord/Audit.

Non-goals:
- No high-fidelity replica or pixel-perfect promise.
- No external template-file application in v1.
- No PPTX / XLSX / PDF export in this stage.
- No LLM-authored final DOCX or LLM-only success judgment.
- No complex table merge, TOC, footnotes/endnotes, comments, tracked changes, images, header/footer in the first slice.

Rejected: direct Markdown-to-DOCX button without ExportContract / MatchReview / Audit | it would recreate the earlier “fake export button” risk and provide no trustworthy completion evidence.

Rejected: use external template files as the first implementation path | it risks reintroducing the abandoned manual-template route before the export contract is proven.

Rejected: start with multi-format export | it would split adapter complexity before the DOCX contract and audit loop are stable.

Confidence: medium-high

Scope-risk: moderate

Directive: Design PRD and Test Spec next. Implementation should begin only after schema boundaries for ExportContract, IntermediateDocument, MatchReview, ExportRecord, and FormatSpec rule mapping are explicit.

Tested: planning record only; no product code changed for this decision.

Not-tested: DOCX adapter feasibility, generated DOCX round-trip checks, and UI export flow remain next-stage validation work.

## Decision 031 — DOCX-first export contract boundary is productizable (2026-05-14)

Status: accepted after spike

Decision: Proceed to DOCX-first Formal Export productization design using `DocxExportContract + DocxIntermediateDocument + DocxMatchReview` as the product boundary. Adapter choice remains a next-stage comparison between TS adapter and OpenXML sidecar.

Rationale:
- The spike converted a DraftRecord fixture and FormatSpec fixture into an export contract and intermediate document without adding dependencies or using LLM-authored DOCX.
- MatchReview produced actionable pass/warn/fail diagnostics and caught missing required sections, source leakage, format coverage gaps, and DOCX validation errors.
- Existing OpenXML preflight DOCX evidence could be reused as adapter capability evidence without forcing the product to choose OpenXML sidecar yet.

Tested: `node experiments/docx-first-export-contract/scripts/run-docx-first-export-contract.mjs` PASS; checks passed for contract fields, no source leakage, intermediate block coverage, FormatSpec ruleRefs, DOCX preflight readability, positive nonblocking review, missing-section fail, format-coverage visibility, source-leakage fail, and validation-error fail.

Rejected: start UI/store implementation immediately | the product PRD/Test Spec and adapter comparison are still needed.

Rejected: treat existing OpenXML preflight as final adapter decision | it proves feasibility but not packaging/runtime/product ownership.

Confidence: medium-high

Scope-risk: moderate

Directive: Next artifact should be DOCX-first Formal Export PRD/Test Spec, not more prompt tuning and not direct UI implementation.

Not-tested: actual product adapter generation from DraftRecord, Tauri save flow, persistence of ExportRecord, and desktop manual export.

## Decision 032 — Productize DOCX export in contract-first slices (2026-05-14)

Status: accepted as implementation sequence

Decision: Productize DOCX-first Formal Export in slices: first contract/intermediate/review/record library, then adapter comparison, then MVP adapter integration, and only then UI.

Rationale:
- The spike proved the product boundary but not the final adapter or desktop save flow.
- Contract and MatchReview are safety gates; UI-first implementation would recreate the fake-export-button risk.
- Adapter selection still needs evidence on TS dependency cost versus OpenXML sidecar packaging/runtime complexity.

Implementation order:
1. Slice A: `DocxExportContract`, `DocxIntermediateDocument`, `DocxMatchReview`, `DocxExportRecord` product libraries and tests.
2. Slice B: adapter comparison gate with shared fixture and capability report.
3. Slice C: MVP adapter integration.
4. Slice D: UI entry and manual smoke.

Rejected: implement a visible export button before contract/review/record tests | it can create apparent success without auditability.

Rejected: choose OpenXML sidecar solely because the preflight worked | preflight proves feasibility, not distribution or product ownership.

Rejected: choose TS adapter without a comparison gate | current package has no `docx`/`mammoth`, and dependency/license/bundle costs must be explicit.

Confidence: high for sequencing, medium for final adapter choice

Scope-risk: moderate

Directive: Next code work should implement Slice A only unless a later plan explicitly opens adapter comparison.

Tested: planning artifacts created; no product code changed in this step.

Not-tested: product library tests, adapter output, UI save flow.

## Decision 033 — Approve Slice A implementation plan before DOCX adapter work (2026-05-14)

Status: accepted

Decision: Execute Slice A according to `active/ralplan-docx-export-sliceA-contract-library.md` before any adapter or UI work.

Rationale:
- Product design is complete, but adapter comparison has not been run and no adapter has been selected.
- Slice A establishes reusable product contracts and tests that both TS adapter and OpenXML sidecar must satisfy later.
- This prevents fake export completion and keeps UI work blocked until review/record boundaries exist.

Scope: add only docx export contract/intermediate/review/record libraries and tests under `src/lib`.

Rejected: start adapter comparison before Slice A | comparison should consume stable product contracts instead of experiment-only JSON shapes.

Rejected: start UI/export button now | no selected adapter and no product MatchReview/ExportRecord yet.

Tested: planning-only update; implementation tests are defined in the Slice A ralplan.

Directive: After Slice A passes, stop and ask/record before moving to Slice B adapter comparison.


## Decision 034 — Accept Slice A DOCX export product boundary implementation (2026-05-14)

Status: accepted after implementation and architect verification

Decision: Keep the DOCX-first export product boundary as four library modules: `DocxExportContract`, `DocxIntermediateDocument`, `DocxMatchReview`, and `DocxExportRecord`. Proceed no further than this boundary until Slice B adapter comparison is explicitly planned.

Rationale:
- The contract records draft/profile hashes, FormatSpec lineage, export boundaries, and validation policy without storing raw source body text or raw evidence dumps.
- The intermediate document turns draft markdown into auditable structural roles before any adapter sees content.
- The match review detects missing required sections, uncovered must/should format rules, forbidden source leakage, validation errors, and known warnings.
- The export record captures audit metadata and status without pretending that DOCX writing exists yet.

Rejected: broad substring matching for FormatSpec rule coverage | architect review found it could falsely mark wrong structural roles as covered; replaced with exact category-style matching and regression tests.

Rejected: begin adapter or UI work in the same slice | adapter choice and desktop save flow remain unproven and require Slice B/C planning.

Confidence: high

Scope-risk: narrow

Directive: Slice B must reuse this product contract/review boundary and compare adapter outputs against it; do not bypass MatchReview or ExportRecord.

Tested: targeted Vitest 4 files / 12 tests PASS; `npm run typecheck` PASS; `npm run build` PASS; architect verification APPROVED.

Not-tested: real DOCX adapter output, desktop save flow, persisted export history, and manual UI smoke remain future slices.


## Decision 035 — Approve Slice B DOCX adapter comparison plan (2026-05-14)

Status: accepted after ralplan consensus

Decision: Run Slice B as an experiment-only adapter comparison under `experiments/docx-adapter-comparison/**`, comparing a TS/JS `docx` candidate with an OpenXML SDK sidecar candidate. Do not choose the final adapter in Slice B.

Rationale:
- Slice A product boundary is complete and verified, but no adapter has been selected.
- A fair comparison must feed both candidates the same `DocxExportContract` and `DocxIntermediateDocument` and reduce results through `DocxMatchReview` and `DocxExportRecord`.
- Experiment containment prevents premature root dependency, UI, store, Tauri, or product `src/**` changes.
- Architect review identified that comparison reports must not become raw XML/source/evidence dumps; the plan now separates internal artifacts from redacted reports.

Rejected: choose TS/JS `docx` immediately | faster MVP fit is plausible but needs structural/package evidence and dependency risk assessment.

Rejected: choose OpenXML SDK sidecar immediately | stronger low-level control is plausible but packaging/runtime cost must be measured.

Rejected: put raw XML or source-derived text in comparison reports | it violates the evidence boundary and can leak content through allowed keys.

Confidence: high for comparison design, medium for eventual adapter choice

Scope-risk: moderate

Directive: Slice B execution must stay under `experiments/docx-adapter-comparison/**` and produce non-binding, redacted reports. Slice C may choose an adapter only after consuming those reports.

Tested: RALPLAN consensus review; Architect requested revisions; Critic approved revised plan. Referenced docs: `docx` API/Packer docs and Microsoft Open XML SDK WordprocessingDocument docs.

Not-tested: adapter generation, package XML probes, sidecar runtime, desktop save flow, UI integration.


## Decision 036 — Complete Slice B adapter comparison without final adapter selection (2026-05-15)

Status: accepted after experiment and architect verification

Decision: Treat Slice B as complete. The comparison produced comparable, redacted evidence for both `ts-docx` and `openxml-sidecar`, but deliberately does not choose a final adapter. Slice C must make a separate adapter-selection and MVP writing decision.

Rationale:
- Both candidates consumed the same Slice A `DocxExportContract` and `DocxIntermediateDocument` boundary.
- Both candidates generated DOCX artifacts that passed package and structural probes with zero validation errors.
- Both candidates reduced results through `DocxMatchReview` and `DocxExportRecord`.
- Both candidates produced only redacted comparison reports with assertion IDs, counts, hashes, issue codes, verdicts, and status summaries.
- The comparison shows a real tradeoff: TS/JS `docx` is lower runtime cost and closer to the TS product, while OpenXML sidecar has stronger low-level control but high packaging/runtime cost.

Rejected: select `ts-docx` directly inside Slice B | the approved Slice B plan required non-binding comparison only.

Rejected: select OpenXML sidecar directly inside Slice B | sidecar packaging/runtime cost needs a Slice C product decision.

Rejected: expose raw XML/source text in reports | redacted report boundary passed and remains required.

Confidence: high for comparison evidence, medium for final adapter choice.

Scope-risk: moderate.

Directive: Slice C should consume `experiments/docx-adapter-comparison/reports/summary.*` and candidate reports, then explicitly decide adapter and MVP DOCX writing integration. Do not bypass MatchReview/ExportRecord.

Tested: `npm --prefix experiments/docx-adapter-comparison run compare` PASS; Slice A targeted Vitest 4 files / 12 tests PASS; `npm run typecheck` PASS; `npm run build` PASS; architect verification APPROVED; deslop scan/post-regression PASS.

Not-tested: manual Word/LibreOffice openability, desktop save flow, product dependency integration, UI entry, persistent export history.

## Decision 037 - Select docx npm adapter for MVP DOCX writer (2026-05-15)

Decision: choose `docx` npm as the product MVP DOCX adapter with stable adapter id `docx-npm.v1`, and add a product `jszip` structural probe before review/record creation.

Why: Slice B showed `ts-docx` and `openxml-sidecar` both reached warning status with zero validation errors, while `docx` npm has lower runtime and packaging cost. Slice C needed a library-only writer, not sidecar distribution or UI save integration.

Rejected: OpenXML sidecar for MVP | higher runtime/packaging cost and no better Slice B validation outcome.
Rejected: manual template route | explicitly abandoned and violates current export boundary.
Rejected: high-fidelity/Word-openability promise | not proven by product tests; represented only as warnings.

Verification: targeted Vitest 7 files / 18 tests PASS; `npm run typecheck` PASS; `npm run build` PASS with pre-existing Vite warnings only; architect review APPROVED.

## Decision 038 - Add explicit DOCX export save flow for drafts (2026-05-15)

Decision: expose DOCX export from the Drafts view using an OS save dialog, binary-safe Tauri base64 write command, and the Slice C `writeDocxExport` writer.

Why: Slice C proved the library writer path; Slice D needed a user-testable desktop flow without auto-overwriting user files or implying high-fidelity output.

Rejected: using text `write_file` for DOCX bytes | would corrupt ZIP/binary content.
Rejected: silently appending `.docx` after dialog returns | could bypass OS overwrite confirmation for the actual written path.
Rejected: saving without file-sync app-write marking | could confuse app-created exports with watched source ingest events.

Constraint: no manual template route, no high-fidelity/Word-openability guarantee, no auto-overwrite.

Verification: 9 Vitest files / 30 tests PASS; Rust binary write tests 3 PASS; `cargo check` PASS with existing warnings; `npm run build` PASS with existing Vite warnings; architect review APPROVED.

## Decision 039 - Treat remaining DOCX export warnings as intentional MVP boundary notes (2026-05-15)

Decision: accept the desktop DOCX export result when the file is written and only the two boundary reminders remain: `manual-word-openability-not-tested` and `high-fidelity-style-replica-not-supported`.

Why: The user-reported desktop result confirms the export path writes a DOCX and the warning list is no longer duplicated. These two messages are not functional errors; they preserve honesty about untested manual Word/WPS openability and the current non-high-fidelity MVP scope.

Rejected: hide the remaining warnings as success | this would blur the current product boundary and imply guarantees we have not tested.
Rejected: treat the remaining warnings as blockers | this would incorrectly fail the MVP despite the export succeeding under the accepted scope.
Rejected: continue format-polishing in Slice D | the agreed stop condition was implementation, testing, architecture review, record update, and then waiting for human desktop testing before moving stages.

Constraint: no high-fidelity replica promise, no manual Word-openability promise, no automatic overwrite, no manual template route.

Verification: user desktop smoke result shows DOCX exported to `C:\Users\Dante\Desktop\云南省数据流通利用基础设施平台介绍.docx` with only the two accepted boundary reminders; targeted Vitest 2 files / 11 tests PASS; `npm run typecheck` PASS; `npm run build` PASS with pre-existing Vite warnings only.

## Decision 040 - Reframe DOCX-first around high-fidelity as the core objective (2026-05-15)

Decision: DOCX-first must treat high-fidelity format restoration as the core product objective, not as an out-of-scope/non-goal. Prior reminders such as `high-fidelity-style-replica-not-supported` are only temporary honesty boundaries for what has not yet been verified; they must not be interpreted as abandoning high-fidelity.

Why: For DOCX-like formal documents, format fidelity is not decoration. It is the central user value: title hierarchy, fonts, font sizes, paragraph spacing, indentation, numbering, tables, page setup, and Word/WPS rendering behavior determine whether the exported document is actually useful. A merely exportable DOCX is only an MVP transport layer, not the end state.

Reframing:
- Previous Slice C/D boundary: do not falsely claim high-fidelity before it is measured.
- New DOCX-first direction: build measurable high-fidelity restoration as the next core loop.
- Product copy should move from negative boundary codes toward fidelity diagnostics: restored, partially restored, not restored, and not yet verifiable.

Rejected: continue treating high-fidelity as unsupported/out-of-scope | this contradicts the core value of DOCX export.
Rejected: claim 100% high-fidelity immediately | current implementation has not yet measured Word/WPS rendering parity or full style-rule coverage.
Rejected: expand horizontally to XLSX/PPTX before closing DOCX fidelity | this risks producing several half-complete exporters instead of one strong DOCX-first workflow.

Constraint: high-fidelity is the objective, but claims must remain evidence-backed; no manual template route, no automatic overwrite, no unsupported Word/WPS guarantee.

Directive: The next DOCX stage should be a fidelity loop: source DOCX style facts -> editable FormatSpec/rules -> writer mapping -> exported DOCX reverse probe -> fidelity coverage report -> user-readable diagnostics. Replace/soften `high-fidelity-style-replica-not-supported` in product UX once fidelity coverage reporting exists.

Confidence: high.

Scope-risk: moderate.

Tested: decision-only record based on user correction after Slice D desktop smoke test.

Not-tested: fidelity coverage engine, reverse style probe, Word/WPS visual parity, enhanced writer style mapping.

## Decision 041 - Split DOCX high-fidelity work into staged E1/E2/E3 slices (2026-05-15)

Decision: Do not attempt source style enhancement, writer fidelity enhancement, and UI fidelity productization in one large step. Split the DOCX-first high-fidelity loop into staged slices and start with E1: baseline diagnostics and measurement.

Why: High-fidelity DOCX export has three separable risks: whether source style facts are known, whether the writer can apply them, and whether exported output can be verified and explained. Doing all three at once would make failures hard to attribute and rollback hard. E1 should build the measurement baseline before writer changes, so later fidelity improvements are evidence-guided instead of blind tuning.

Staged plan:
- E1: DOCX high-fidelity baseline diagnostics. Measure source style facts, exported DOCX facts, rule coverage, and gaps. Minimize writer changes.
- E2: DOCX writer style mapping enhancements. Use E1 coverage to target the highest-value gaps such as title, headings, body paragraphs, numbering, margins, and tables.
- E3: DOCX fidelity UX/productization. Replace raw boundary codes with user-readable fidelity coverage diagnostics and export records.

Rejected: solve all fidelity problems in one slice | too large, high regression risk, unclear attribution.
Rejected: start with writer changes before measurement | risks blind changes without a way to prove improvement.
Rejected: expand to XLSX/PPTX before DOCX fidelity baseline | contradicts DOCX-first.

Constraint: E1 must preserve current DOCX export behavior, avoid restoring manual templates, and avoid unsupported claims of 100% fidelity.

Directive: Begin with RALPLAN for Slice E1 only. Acceptance must include a concrete verification shape for fidelity baseline diagnostics and a stop condition before E2.

Confidence: high.

Scope-risk: moderate.

Tested: decision-only planning record.

Not-tested: E1 implementation, reverse probe coverage, UI diagnostic changes.

## Decision 042 - Add non-blocking DOCX fidelity diagnostics as the E1 baseline (2026-05-15)

Decision: implement Slice E1 as a standalone DOCX fidelity diagnostics module and expose its report from `writeDocxExport` without changing adapter validation, review verdicts, save failures, or writer style mapping.

Why: DOCX-first high-fidelity work needs measurement before tuning. The report establishes source expectations, exported observations, coverage buckets, and E2 priority gaps while preserving the already-working DOCX export path.

Rejected: treat exported structure as restored when no source rule exists | this creates false fidelity confidence; absent source expectations must be `unverified`.
Rejected: merge fidelity gaps into validation/review/save blockers | E1 is diagnostic only and must not regress export success.
Rejected: store raw DOCX XML or source text in reports | violates leakage boundaries and makes records unsafe.

Constraint: high-fidelity is the product objective, but E1 still cannot claim Word/WPS parity or 100% fidelity. No manual template route, no auto-overwrite, no XLSX/PPTX expansion.

Verification: targeted Vitest 5 files / 21 tests PASS; `npm run typecheck` PASS; `npm run build` PASS with pre-existing Vite warnings; architect review APPROVE after fixing no-source and missing-bucket issues.

Next: Slice E2 should consume the E1 report and improve selected writer style mappings with measurable coverage gains.

## Decision 043 - Treat `行文格式（通用）20210625(1).docx` as the minimum DOCX FormatSpec baseline (2026-05-15)

Decision: The file `D:\llm_wiki\行文格式（通用）20210625(1).docx` is the minimum standard and boundary for future DOCX format-constraint generation. Generated DOCX FormatSpec/format constraints may be richer than this baseline, but must not be less detailed than it for covered formal-document dimensions.

Why: DOCX-first fidelity depends on explicit, executable formatting constraints. The generic writing-format sample defines the required floor for title, subtitle, heading hierarchy, body text, indentation, line spacing, page setup, and related formal-document rules. It should act like a local project standard comparable to a GB/T-style rule floor, not merely a reference example.

Baseline implication:
- Future DOCX FormatSpec output must include explicit rules for document title, subtitle when present, level-1/level-2/level-3 headings, body paragraph typography, indentation, line spacing, and page setup when the document type is formal text.
- Additional source-specific facts from `基准素材.docx` or other finished files can override/add details, but cannot reduce the baseline coverage.
- Missing source evidence should be marked `unverified`; missing baseline rule dimensions in generated constraints are a generation-quality problem.

Rejected: use the generic writing-format file as only a loose style hint | this would allow future constraints to remain too vague.
Rejected: use it as a rigid full visual template for every document | source-specific finished material can add or specialize constraints.
Rejected: proceed to writer tuning without encoding this baseline in the FormatSpec generation target | writer improvements would lack a stable rule floor.

Constraint: This baseline does not restore the abandoned manual-template route and does not itself prove Word/WPS parity. It defines the minimum rule coverage expected from DOCX FormatSpec generation.

Directive: Slice E2/E2-prep should ensure DOCX FormatSpec generation and fidelity diagnostics can evaluate whether generated constraints meet this minimum baseline before measuring writer fidelity gains.

Confidence: high.

Scope-risk: moderate.

Tested: baseline DOCX parsed successfully; extracted page, title, subtitle, heading, body, indentation, and line-spacing facts.

Not-tested: product enforcement of the baseline in FormatSpec generation; writer application of all baseline rules.



## Decision 044 - Enforce DOCX FormatSpec baseline through canonical dimensions (2026-05-15)

Decision: Implement Slice E2-prep by adding a DOCX formal-writing baseline catalog, a coverage audit, and a backward-compatible `FormatSpecRule.dimension` contract. DOCX FormatSpec generation must merge deterministic rules with accepted LLM overlay rules and then fill missing baseline dimensions instead of letting overlay rules replace the deterministic baseline.

Why: The approved DOCX-first high-fidelity path needs a stable, executable rule floor before writer tuning. Without canonical dimensions, coverage audit would remain dependent on prose/id heuristics; without merge-and-fill, accepted LLM overlay can collapse the constraint set and produce weaker-than-baseline prompts.

Rejected: directly tune the DOCX writer first | faster visible output but lacks a stable rule/audit basis and makes source-vs-baseline conflicts hard to explain.
Rejected: only expand `buildDocxRules()` prose | does not prevent overlay replacement and keeps audit tied to text wording.
Rejected: treat `行文格式（通用）20210625(1).docx` as a rigid template | it is a minimum rule floor; current source facts may specialize values.

Constraint: `page.margin` has two baseline sources: actual DOCX XML `sectPr` values and instructional body-text values. The implementation preserves both source semantics as attributes and warnings instead of silently choosing one. No manual template route, no XLSX/PPTX expansion, no `DocxExportRule.attributes` propagation, and no Word/WPS parity claim in this slice.

Verification: targeted Vitest 3 files / 23 tests PASS; DOCX/draft regression Vitest 5 files / 25 tests PASS; `npm run typecheck` PASS; `npm run build` PASS with pre-existing Vite warnings.

Next: Slice E2 writer tuning may consume stable FormatSpec dimensions/attributes to improve title, heading, body, page, and table style mapping with measurable fidelity gains.

Confidence: high.

Scope-risk: moderate.

Tested: baseline catalog/audit, conservative normalization including ambiguous negatives, overlay merge preserving baseline, editable promptBlock rules preservation, diagnostics dimension intake, DOCX export/draft regressions, typecheck, build.

Not-tested: writer consumption of attributes, Word/WPS visual parity, UI baseline audit display.

## 2026-05-15 Slice E2 implementation — DOCX structure roles + writer style mapping

Status: implemented / verified / architect-approved

Scope completed:
- Added DOCX FormatSpec style resolver (`src/lib/docx-format-style.ts`) that maps canonical dimensions such as `title.main`, `heading.level1`, `heading.level2`, `paragraph.body`, and `list.numbering` into writer style policy.
- Extended DOCX intermediate blocks with `formatDimensions` and `stylePolicy`, and normalized visual full-width/ideographic indentation at DOCX export boundary only. Stored drafts are not mutated.
- Added conservative bare-list recovery only after colon introductions, with `bare-list-recovered` diagnostics and negative tests for narrative paragraphs.
- Updated DOCX writer to consume style policy for title, heading, paragraph, and list output. XML tests verify spacing, indentation, fonts, numbering, and that different FormatSpec attributes change generated styles XML.
- Extended fidelity diagnostics to evaluate canonical dimensions directly, including title/heading/body/list/table coverage.

Verification evidence:
- `npx vitest run src/lib/docx-intermediate.test.ts src/lib/docx-format-style.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-save.test.ts src/lib/docx-fidelity-diagnostics.test.ts src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` => 8 files / 55 tests PASS.
- `npm run typecheck` => PASS.
- `npm run build` => PASS; only pre-existing Vite chunk/dynamic-import warnings observed.
- Architect review after implementation => APPROVE; no blocking issues.

Boundaries preserved:
- DOCX-first only; no XLSX/PPTX expansion.
- No manual template route restored.
- No UI/store/Tauri changes in this slice.
- No auto-overwrite behavior added.
- No Word/WPS parity claim; diagnostics still report limitations.

Remaining follow-ups:
- Manual desktop Word/WPS visual inspection remains required for user-facing high-fidelity judgment.
- Later slice should address page margin/source-priority conflict and richer visual fidelity diagnostics.

### Decision 2026-05-15 — Normalize Markdown/wiki inline markers at DOCX export boundary

Decision: DOCX export must treat common draft-storage inline markers as document semantics, not literal Word text.

Rationale:
- User-provided exported DOCX showed high-level style improvements, but raw markers such as `**...**` and `[[...]]` leaked into the saved Word document.
- These markers are acceptable in draft storage and chat/workspace contexts, but they are not acceptable in final formal DOCX output.
- The fix belongs in the deterministic DOCX adapter boundary so stored drafts remain unchanged and the behavior is testable.

Implemented behavior:
- `**文本**` -> bold DOCX run.
- `[[实体]]` -> plain text `实体`.
- `[[target|label]]` -> plain text `label`.

Rejected:
- Mutating the stored draft before export | would mix storage syntax normalization with output rendering.
- Adding a user-facing manual cleanup step | would not be a reliable DOCX-first export loop.
- Restoring manual template routing | remains outside the product direction.

Verification:
- Targeted adapter/save tests passed: 3 files / 16 tests.
- DOCX-first regression suite passed: 8 files / 56 tests.
- `npm run typecheck` and `npm run build` passed.

Remaining boundary:
- This improves DOCX cleanliness and inline semantics, but does not by itself prove Word/WPS visual parity.

### Decision 2026-05-15 — Align DOCX structural probe with exported visible inline text

Decision: after DOCX inline marker normalization, package-probe expectations must be derived from the same exported visible text semantics as the writer, not from raw draft-storage Markdown/wiki syntax.

Why: user desktop export failed with `missing-paragraph-content` even though the paragraph existed. The root cause was a validation mismatch: the writer removed/rendered `**...**` and `[[...]]`, while the structural probe still searched for raw paragraph snippets containing those markers. This created a false blocking validation error.

Implemented behavior:
- Shared inline normalization helpers are exported from the DOCX adapter.
- Writer probe expectations normalize title/headings/paragraph snippets before validation.
- Paragraph probe snippets use the first visible exported run so bold-run boundaries do not break XML substring checks.

Verification:
- Targeted adapter/writer/save tests passed: 3 files / 17 tests.
- DOCX-first regression suite passed: 8 files / 57 tests.
- `npm run typecheck` and `npm run build` passed.

Remaining boundary:
- This removes a false `missing-paragraph-content` blocker; it does not claim full Word/WPS visual fidelity.


### Decision 2026-05-15 — Allow limited DOCX executable StyleFacts attributes

Decision: deterministic DOCX StyleFacts may generate limited executable FormatSpec attributes for `title.main`, `heading.level1`, and `paragraph.body`.

Rationale:
- Previous profiles with different StyleFacts still exported almost identical DOCX styles because the writer only consumed generic baseline/default rules.
- DOCX-first high fidelity requires using already-parsed style evidence, not only adding more passive summaries.
- The safe middle ground is a narrow bridge: source facts become writer hints for covered dimensions, while the DOCX formal baseline still covers missing dimensions.

Implemented behavior:
- New bridge builds sanitized DOCX-only input and emits StyleFacts-backed rules before baseline merge.
- Source font strings are preserved in FormatSpec; writer-family normalization happens only in the DOCX style resolver.
- Fact-level evidenceRefs are filtered against registered sanitized evidence IDs before entering rules, prompt blocks, snapshots, or export contracts.

Rejected:
- Full template replay | conflicts with abandoned manual-template route and auto-overwrite boundaries.
- Broad StyleFacts-to-export conversion | too risky before dimensions are explicitly covered and tested.
- Treating StyleFacts as a visual parity promise | would overstate current evidence and Word/WPS guarantees.

Verification:
- Targeted E3a tests passed: 4 files / 26 tests.
- `npm run typecheck`, `npm run test:mocks`, and `npm run build` passed.
- Architect review approved after evidenceRefs hardening.

Remaining boundary:
- This improves executable DOCX style differentiation; it does not prove full Word/WPS visual parity.

### Fix 2026-05-15 — DOCX probe validates visible Word text across run boundaries

Decision: DOCX package probe must validate exported visible text reconstructed from `<w:t>` runs, not only raw `word/document.xml` substrings.

Why: manual export failed with `missing-paragraph-content` even though content can be present. DOCX writers may split one visible paragraph across multiple runs because of bold/wiki normalization or style boundaries; raw XML substring search can miss text spanning tags or XML entities.

Implemented behavior:
- `probeDocxPackage` now extracts visible Word text from `<w:t>` nodes and decodes XML entities.
- Content assertions search both raw XML and reconstructed visible text.
- Added regression where `**云南省大数据有限公司**是...` is split into DOCX runs but expected visible paragraph text still validates.

Verification:
- `npx vitest run src/lib/docx-package-probe.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/lib/docx-export-save.test.ts` => PASS, 4 files / 21 tests.
- `npm run typecheck` => PASS.
- `npm run test:mocks` => PASS, 104 files / 1245 tests.
- `npm run build` => PASS with pre-existing Vite warnings only.

## 2026-05-15 DOCX-first 高保真约束分层修复

- 决策：将旧的“格式画像约束”降级为兼容字段，实际底稿加工与可见约束统一使用 FormatSpec promptBlock。
- 根因：旧画像文本混合了证据摘要、来源正文片段、写作提示和导出目标，导致源格式文件正文污染 prompt，且 writer 无法稳定消费细粒度格式属性。
- 实施：StyleFacts 继续作为证据层；FormatSpec 作为角色化可执行规则层；LLM 写作层只接收最小底稿输出契约；DOCX writer 消费 page/title/heading/body 属性。
- 高保真方向：DOCX-first 阶段以可观测 DOCX 属性为高保真收敛目标；不再使用“高保真不支持”作为常规降级话术，仅保留“不承诺像素级/Word 渲染完全等价”的真实边界。
- 本轮覆盖：中文正文主字体优先于 Times New Roman/zh-CN 等拉丁或语言标记；StyleFacts 页边距/页面尺寸进入 writer；Markdown ## 一、... 按正式中文一级标题识别；旧 generationInstruction 不再输出来源结构原文。
- 验证：targeted vitest 9 files / 69 tests passed；npm run typecheck passed；npm run test:mocks 105 files / 1253 tests passed；npm run build passed（仅保留既有 Vite chunk/dynamic-import warnings）。

### Fix 2026-05-15 — Accept Markdown-fenced JSON from semantic overlay providers

Decision: semantic overlay parsing now accepts provider output when the only extra wrapper is a Markdown JSON code fence, while keeping the same evidence/schema evaluator.

Why: some model endpoints return valid JSON inside ```json fences despite being instructed to output JSON only. Treating that wrapper as `invalid-json` caused unnecessary fallback to deterministic profiles.

Implemented behavior:
- Added a conservative parser candidate step that strips only full Markdown code-fence decoration or a code-fence prefix around one JSON object.
- Did not parse arbitrary chat prose or relax evidenceRefs/schema/quality checks.
- Strengthened the prompt to explicitly avoid Markdown code fences.

Verification:
- `npx vitest run src/lib/format-profile-semantic-overlay.test.ts` => PASS, 10 tests.
- `npm run typecheck` => PASS.
- `npm run build` => PASS with pre-existing Vite warnings only.

## 2026-05-15 Slice E3b RALPLAN approved — DOCX fidelity first convergence

Status: plan approved / not implemented.

Context:
- Compared `c:\Users\Dante\Desktop\云南省大数据有限公司3.docx` with `d:\llm_wiki\基准素材_复制.docx` using OpenXML inspection.
- Confirmed partial alignment: A4 page size, core page margins, body font/size direction.
- Confirmed gaps: main-title vs Chinese level-1 heading style confusion, over-conversion to Word numbering, 600 vs 570 line spacing, missing header/footer distance consumption.

Approved plan:
- `.omx/plans/ralplan-slice-e3b-docx-first-fidelity.md`

Decision:
- Use the DOCX-first high-fidelity loop: StyleFacts -> FormatSpec -> intermediate roles/intents -> writer mapping -> OpenXML diagnostics.
- Do not use a minimal writer-only patch as the primary approach.
- Do not add template replay, automatic overwrite, XLSX/PPTX expansion, or pixel-perfect Word/WPS claims.

Consensus evidence:
- Planner draft created and revised twice.
- Architect review returned ITERATE; required StyleFacts title/heading deconfliction and conservative numbering intent were added.
- Critic review returned ITERATE; required numbering decision table, StyleFacts field paths, hard boundary gates, and diagnostics schema were added.
- Critic re-review returned APPROVE; no blocker.

Execution stop condition for next phase:
- Implement Slice E3b only after starting an execution lane.
- Must pass targeted E3b tests, `npm run typecheck`, required `npm run test:mocks`, and build if feasible.
- If full mocks are blocked, run the documented minimum boundary test set and report the gap.

## Decision 045 - First DOCX fidelity convergence consumes executable StyleFacts instead of adding dead rules (2026-05-15)

Decision: Slice E3b implements the DOCX-first fidelity loop by carrying parsed style facts into executable writer attributes and diagnostics: title/heading role separation, conservative numbering intent, exact line spacing, header/footer distances, and source-vs-export bucket inputs.

Why: The previous output was closer but still missed high-value baseline traits: main title confused with Chinese section heading style, visible numbering was over-converted, line spacing stayed at writer defaults, and header/footer distances were not consumed. Adding more prose constraints would have diminishing returns unless the writer and diagnostics could consume the already-parsed evidence.

Rejected: add more dead FormatSpec prose only | does not change exported DOCX and repeats the earlier mechanical constraint problem.
Rejected: convert every numeric line into Word auto-numbering | corrupts formal numbered prose when the source profile only has baseline/default numbering rules.
Rejected: template replay or manual-template restoration | conflicts with the abandoned manual template route and auto-overwrite safety boundary.

Constraint: high fidelity is the DOCX-first target, but this slice still does not claim pixel-perfect Word/WPS parity; it only improves covered, observable OpenXML attributes.

Verification: targeted DOCX Vitest 5 files / 39 tests PASS; style-facts Vitest 1 file / 6 tests PASS; `npm run typecheck` PASS; `npm run test:mocks` PASS (106 files / 1262 tests); `cargo check` PASS with pre-existing warnings; `npm run build` PASS; architect review APPROVED.

Directive: Next DOCX fidelity work should begin from manual baseline comparison evidence and the new diagnostics bucketInputs. Do not regress to generic prose-rule accumulation or horizontal XLSX/PPTX work before the DOCX loop is judged acceptable.

Confidence: high.

Scope-risk: moderate.

Not-tested: manual Word/WPS visual parity and user desktop comparison after E3b.
