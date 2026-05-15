# pkm-tool → llm_wiki 迁移追踪矩阵

更新时间：2026-05-13  
状态：当前进度锚点  
原始需求基线：`.omx/plans/requirements/pkm-migration-original.md`
实验成果记录：`.omx/plans/requirements/format-profile-experiment-outcome.md`

## 1. 用途

本文不是重写原始需求，而是记录原始迁移需求在当前 `llm_wiki` 路线中的承接状态。

- 原始迁移文档：需求来源，不随实现路线轻易改写。
- 本追踪矩阵：进度锚点，说明每项需求当前是已完成、替代、延后还是重定义。
- 决策账本：解释为什么发生路线偏移。
- Active plan：指导下一步具体执行。

## 2. 当前路线总述

原始路线曾按“底稿 → 手工模板库 → 模板感知生成 → 匹配报告 → 正式导出”推进。

当前判断：当前版本完全放弃手动输入模板，不再把手工模板库作为兼容基础、入口或待完善能力。新的高价值路径是：

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
| 6.2 Template Library / 当前模板绑定 | 当前版本放弃 | 手动输入模板会误导用户自行描述结构、语气、约束和版式；真实用户更需要上传成品文件自动学习 | 明显 | 改为 FormatProfile / Format Library；手工模板不再作为兼容层 | v14 归档；FormatProfile 实验接管；Decision 006 |
| 6.3 Template-aware Generation | 实验验证完成，待产品化 | 当前是手工模板文字约束；不够代表真实格式 | 明显 | 改为 profileSnapshot + generationInstruction + FormatBinding | FormatProfile 实验 35/35 通过；待迁回主线 |
| 6.4 Template Match Report | 实验验证完成，待产品化 | 静态匹配报告价值有限，必须基于真实 profile 才有意义 | 明显 | 后续改为 profile-driven diagnostics / match review | Phase 2 风险队列与 diagnostics 已验证 |
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
2. 手动输入模板与完整模板库管理。
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

## 7. 实验完成记录

截至 2026-05-13，FormatProfile 后端实验已完成：

```text
Phase 0: 5/5 valid
Phase 1: 5/5 valid
Phase 2: 35/35 valid
```

完整成果记录：

```text
.omx/plans/requirements/format-profile-experiment-outcome.md
experiments/format-profile/reports/phase6-productization-decision.md
```

后续锚点从“证明路线是否成立”切换为“如何安全产品化”。


## 8. 产品化验收与下一阶段边界（2026-05-13）

四格式 FormatProfile 产品化已经从实验返回主线，并通过当前版本验收：

```text
DOCX / XLSX / PPTX / PDF
  → 确定性 probe
  → FormatProfile
  → profileSnapshot
  → generationInstruction
  → diagnostics
```

当前状态不再是“待产品化”，而是：

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 四格式统一导入 | 已产品化 | DOCX / XLSX / PPTX / PDF 共用格式画像入口。 |
| 确定性探测 | 已产品化 | 后端 probe 能提取结构、样式和诊断线索。 |
| 底稿绑定 | 已产品化 | profileSnapshot 可进入底稿加工提示。 |
| 画像可读性 / 精准度 | 待提升 | 当前结果偏机械，尚未接入 LLM 语义精炼。 |
| 正式导出 / 高保真复刻 | 延后 | 当前版本仍不承诺。 |
| 手动输入模板 | 放弃 | 当前版本不恢复入口。 |

后续路线从“证明 FormatProfile 能否成立”调整为“提升 FormatProfile 的语义质量”：

```text
raw probe
  → deterministic profile
  → non-LLM cleanup
  → optional LLM enrichment
  → refined generationInstruction
```

新的追踪锚点：

```text
.omx/plans/requirements/format-profile-productization-acceptance-and-semantic-refinement.md
```


## Trace Update：Phase 3 StyleFacts Experiment（2026-05-13）

- Requirement: 高保真提取样式（字体、字号、排版等）必须有确定性证据边界。
- Artifact: `experiments/format-profile-style-extraction/`
- Runtime evidence: `runtime/format-profile-style-extraction/reports/verification.report.json`
- Decision: `.omx/plans/requirements/migration-decision-log.md` Decision 012
- Verification: `verify-style-extraction.mjs` PASS；`npm run typecheck` PASS；`npm run test:mocks` PASS。
- Product boundary: experiment-only; product `src/` integration deferred to a separate design step.

## Trace Update：Full Plans Review for StyleFacts Productization（2026-05-14）

- Trigger: 用户指出上一版产品化设计可能遗漏内容，要求完整阅读 `.omx/plans` 后更新记录。
- Reviewed scope: `.omx/plans` 全部 Markdown，包括 active、requirements、archive、semantic refinement、DataScope、StyleFacts phase3。
- Missing constraints found:
  - StyleFacts 不能只做 UI，必须进入 FormatBinding/ProfileSnapshot。
  - 必须保留两条路径：画像先行生成底稿、既有底稿适配画像。
  - Draft/version、Match Report、Export、Audit 是正式材料闭环的后置约束，需预留但不伪完成。
  - DataScope 默认 evidence-only；snippets/fulltext 仅显式授权候选。
  - LLM overlay 不能写事实；renderer/evaluator/fallback 合同必须保留。
  - UI 必须服务非程序员，默认人类摘要，证据详情折叠。
- New artifact: `.omx/plans/active/format-profile-stylefacts-productization-design-intake.md`
- Decision: `.omx/plans/requirements/migration-decision-log.md` Decision 013
- Next discussion: 是否以 deterministic StyleFacts 最小闭环创建 PRD/test spec，再进入实现。

## Trace Update：Phase A StyleFacts Productization Closure（2026-05-14）

- Requirement: 将 DOCX / XLSX / PPTX / PDF 的样式事实从实验迁回产品主链路，并直接替代旧的机械样式摘要。
- Product artifacts:
  - `src/lib/style-facts.ts`
  - `src/lib/format-profile.ts`
  - `src/lib/draft-processing.ts`
  - `src/stores/chat-store.ts`
  - `src/components/format-profiles/format-profiles-view.tsx`
  - `src/i18n/zh.json`
  - `src/i18n/en.json`
- Plan artifacts:
  - `.omx/plans/prd-format-profile-stylefacts-productization-phaseA.md`
  - `.omx/plans/test-spec-format-profile-stylefacts-productization-phaseA.md`
- Status: Phase A closed / PASS.
- Verification:
  - `npx tsc --noEmit --pretty false` PASS.
  - `npm run typecheck` PASS.
  - `npm run test:mocks` PASS（84 files / 1137 tests）。
  - Targeted tests PASS（5 files / 31 tests）。
  - `npm run build` PASS。
  - Boundary keyword guard PASS（no accidental LLM/rich-scope/export promise in `src/`）。
- Boundary: product LLM integration is still not implemented; next step is Phase B ralplan design.

## Trace Update：Phase B LLM Integration Design Approval（2026-05-14）

- Requirement: 在 StyleFacts 产品化之后接入模型，以提升格式画像解释质量，但保持事实层确定性和 evidence-only 默认边界。
- Plan artifacts:
  - `.omx/plans/prd-format-profile-llm-integration-phaseB.md`
  - `.omx/plans/test-spec-format-profile-llm-integration-phaseB.md`
- Review result: Architect REVISE -> revised contracts -> Architect APPROVE -> Critic APPROVE.
- Implementation boundary:
  - LLM overlay stored separately from StyleFacts.
  - Renderer owns final generation instruction.
  - Evaluator rejects fact creation/overwrite, renderer bypass, unknown evidence refs, unsafe data scopes, and boundary promises.
  - Default dataScope remains `evidence-only`.
- Status: design approved; implementation/testing pending.

## Trace Update：Phase B LLM Semantic Overlay Implementation Closure（2026-05-14）

- Requirement: 接入模型提升 FormatProfile/StyleFacts 的人类可读解释和底稿约束质量，同时保持事实层确定性。
- Product artifacts:
  - `src/lib/format-profile-semantic-overlay.ts`
  - `src/lib/format-profile-semantic-overlay.test.ts`
  - `src/lib/format-profile.ts`
  - `src/lib/draft-processing.ts`
  - `src/stores/chat-store.ts`
  - `src/stores/format-profile-store.ts`
  - `src/stores/format-profile-store.test.ts`
  - `src/components/format-profiles/format-profiles-view.tsx`
  - `src/i18n/zh.json`
  - `src/i18n/en.json`
- Status: implemented / mock-verified / build PASS.
- Verification:
  - Targeted tests PASS（5 files / 30 tests）。
  - `npm run typecheck` PASS。
  - `npm run test:mocks` PASS（85 files / 1143 tests）。
  - `npm run build` PASS。
- Boundary: real provider desktop smoke test remains recommended; no snippets/fulltext default; no LLM fact creation/overwrite; no export/visual reproduction promise.


## Trace Update：FormatSpec Four-Format Experiment（2026-05-14）

- Requirement: 将格式画像约束从“机械摘要/来源原文混入”升级为详细、可执行、非内容污染的格式规范层。
- Design artifacts:
  - `.omx/plans/prd-format-spec-four-format-experiment.md`
  - `.omx/plans/test-spec-format-spec-four-format-experiment.md`
- Experiment artifact: `experiments/format-spec/`
- Inputs: existing evidence-only mock-pass cases from `experiments/format-profile-semantic-refinement/outputs/mock-pass/evidence-only/evidence-only/*/input.json`.
- Output artifacts:
  - `experiments/format-spec/outputs/docx-policy/`
  - `experiments/format-spec/outputs/xlsx-metrics/`
  - `experiments/format-spec/outputs/pptx-briefing/`
  - `experiments/format-spec/outputs/pdf-reference/`
  - `experiments/format-spec/reports/latest-summary.json`
- Verification: `node experiments/format-spec/scripts/run-format-spec.mjs` PASS，4/4 cases passed。
- Decision: `.omx/plans/requirements/migration-decision-log.md` Decision 017。
- Product boundary: experiment-only; product integration should be a separate design step replacing current draft prompt constraints, not layering more raw profile text.

## Trace Update：FormatSpec Ralplan Review Iteration（2026-05-14）

- Planner: REVISE_BEFORE_REVIEW，要求补独立 evaluator、负例、泄漏检测、schema/enum 和 provenance。
- Architect: APPROVE，要求 Critic 关注 summary-level provenance 与“实验可行不等于产品合同冻结”。
- Critic round 1: ITERATE，要求补 `independent-evaluator-summary.json` summary-level provenance，并更新 Decision 017 最终验收记录。
- Fix: summary now includes top-level provenance and per-case input/case/spec/spec-md/prompt hashes; per-case evaluation includes `formatSpecMarkdownSha256`.
- Verification: `node experiments/format-spec/scripts/evaluate-format-spec.mjs` PASS，happy path 4/4，negative self-tests 5/5。

## Trace Update：FormatSpec Ralplan Final Approval（2026-05-14）

- Final critic verdict: APPROVE。
- Approved scope: experiment feasibility + independent evaluator + provenance closure only。
- Not approved: product integration, schema freeze, export promise, visual restoration, UI mainline replacement。
- Verification:
  - `node experiments/format-spec/scripts/run-format-spec.mjs` PASS，4/4。
  - `node experiments/format-spec/scripts/evaluate-format-spec.mjs` PASS，happy path 4/4，negative self-tests 5/5。
  - `npm run typecheck` PASS。
- Next required design: productization plan for draft-processing replacement with FormatSpec renderer, UI/audit/provenance, and regression tests。

## Trace Update：FormatSpec Productization Design Approval（2026-05-14）

- Requirement: 将 draft-processing 主链路从旧画像拼接替换为 FormatSpec renderer 输出。
- Plan artifacts:
  - `.omx/plans/prd-format-spec-productization-phaseC.md`
  - `.omx/plans/test-spec-format-spec-productization-phaseC.md`
- Review path:
  - Planner: APPROVE_FOR_REVIEW。
  - Architect round 1: REVISE，要求补唯一 renderer、sourceProfileHash/formatSpecHash 分离、lib/store 类型边界。
  - Planner revision: APPROVE_FOR_REVIEW。
  - Architect round 2: APPROVE。
  - Critic: APPROVE。
- Approved design: Option B，新增产品 `format-spec.ts`；snapshot 物化 `formatSpec.promptBlock/hash/schema/rendererVersion/policyVersion`；draft-processing system prompt 插入一次；user prompt 不插入画像块。
- Boundary: design approved only; implementation/testing pending。

## Trace Update：FormatSpec Productization Implementation Complete（2026-05-14）

- Requirement: 将 draft-processing 主链路从旧画像拼接替换为 FormatSpec renderer 输出。
- Implemented:
  - `src/lib/format-spec.ts`：产品 FormatSpec builder/renderer/hash/snapshot helper。
  - `src/lib/format-profile-types.ts`：FormatProfile / DraftProcessing snapshot 类型下移到 lib。
  - `src/lib/draft-types.ts`：Draft 类型下移到 lib，避免 `draft-processing` 反向依赖 store。
  - `src/lib/format-profile.ts`：snapshot 同时携带 `sourceProfileHash` 与 `formatSpecHash`，并保留 legacy generationInstruction 兼容字段。
  - `src/lib/draft-processing.ts`：system prompt 插入一次 FormatSpec；user prompt 不再包含画像块。
- Tests:
  - `npx vitest run src/lib/draft-processing.test.ts src/lib/format-spec.test.ts src/lib/format-profile.test.ts --reporter=verbose` PASS，23 tests。
  - `node experiments/format-spec/scripts/run-format-spec.mjs` PASS，4/4。
  - `node experiments/format-spec/scripts/evaluate-format-spec.mjs` PASS，happy path 4/4，negative self-tests 5/5。
  - `npm run typecheck` PASS。
  - `npm run test:mocks` PASS，86 files / 1152 tests。
  - `npm run build` PASS。
- Boundary: 完成的是产品主链路 prompt contract 替换；未承诺导出 DOCX/XLSX/PPTX/PDF、视觉还原、高保真复刻、UI 重设计或 snippets/fulltext 默认发送。


## Trace Update：FormatSpec Saved Draft Smoke Result（2026-05-14）

- User validation: Chat 中的文本展示不等于保存后的 Markdown 结构；以保存为底稿后的 Markdown 判断，本轮 FormatSpec 产品化接入基本通过。
- Positive evidence:
  - 主标题、一级标题、行程子标题形成清晰 Markdown 层级。
  - Markdown 表格保留，没有退化为普通段落。
  - 编号列表和项目符号列表保留。
  - 未出现来源格式画像正文污染。
  - 未外露 StyleFacts、SemanticOverlay、diagnostics 或 FormatSpec 内部约束。
- Known nuance:
  - “不修改正文/只排版”场景下，wiki 双链 `[[...]]` 被转为普通文本，导语与标题顺序也可能被排版优化。
- Current action: 仅记录，不修改代码。
- Backlog candidate: Phase D 可设计“严格不改正文/只排版保护模式”，但需先通过 ralplan 明确范围与测试。


## Trace Update：Phase D FormatSpec Visibility Plan Approval（2026-05-14）

- Requirement: FormatSpec 已进入主链路但用户不可见；需要可视化/审计/预览能力。
- Plan artifact: `.omx/plans/prd-format-spec-phaseD-visibility-audit.md`。
- Decision: 先做 D-1 FormatSpec Visibility / Audit / Preview；D-2 严格不改正文保护暂不实现。
- Review result:
  - Architect fallback: APPROVE with adjustment，要求完整 promptBlock 不作为默认 UI 主视图。
  - Critic round 1: ITERATE，要求明确 draft-processing audit fields 的 source-of-truth。
  - Revision: 扩展 `FormatSpecSnapshot` 为结构化 audit source-of-truth。
  - Critic round 2: APPROVE。
- Boundary: no implementation yet; no manual templates; evidence-only; no default snippets/fulltext; no export/visual fidelity promise.


## Trace Update：Phase D-1 FormatSpec Visibility Implementation Complete（2026-05-14）

- Requirement: 用户需要看见并审计“模型实际收到的格式约束”。
- Implemented:
  - `FormatSpecSnapshot` 增加结构化 audit fields。
  - `buildFormatSpecAuditView()` 提供 UI view model。
  - 格式画像详情页展示 FormatSpec 摘要、版本/hash、边界、规则分组和二级审计文本。
  - draft-processing 会话 banner 展示本次格式约束审计入口。
  - legacy generationInstruction 标注为兼容展示，不参与新主链路。
- Verification:
  - Targeted tests: 2 files / 15 tests PASS。
  - `npm run typecheck` PASS。
  - `npm run test:mocks` PASS，86 files / 1153 tests。
  - `npm run build` PASS。
- Boundary: no strict no-body-change mode yet; no snippets/fulltext default; no export/visual fidelity promise.

## Trace Update：Phase D-1 Legacy Snapshot Compatibility Fix（2026-05-14）

- Issue: 用户手动测试出现 `snapshot.rules is not iterable`。
- Root cause: Phase D-1 新增结构化审计字段后，旧持久化会话/草稿中的 `formatSpec` 快照缺少 `rules` 字段；UI 审计视图直接迭代导致崩溃。
- Fix:
  - `buildFormatSpecAuditView()` 对 `rules`、`boundaries`、`summaryLines` 做 `Array.isArray` 兜底。
  - 缺失的 `sourceFileType`、`documentIntent`、`confidence`、`contentLeakagePolicy`、`promptBlock` 使用安全默认值。
  - 新增旧快照回归测试，确保旧数据只降级显示，不中断 UI。
- Verification:
  - `npm run typecheck` PASS。
  - `npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose` PASS（2 files / 16 tests）。
  - `npm run build` PASS。
- Boundary: 该修复只处理历史快照兼容；不改变 evidence-only 边界，不引入 snippets/fulltext，不承诺导出或视觉复刻。

## Trace Update：FormatSpec Manual Retest and Granularity Gap（2026-05-14）

- Manual retest: legacy snapshot compatibility fix passed; desktop no longer crashes on old `formatSpec` snapshots.
- Remaining gap: current FormatSpec is visible/auditable but not yet detailed enough to approximate GB/T 9704—2012-style normative formatting rules.
- Product implication: visibility/audit is complete for D-1, but rule-generation quality must move to a new design/experiment phase focused on rule granularity.
- Required next design topics:
  - DOCX: heading/body/list/table/page rules with explicit font, size, indent, alignment, spacing, numbering and page layout semantics.
  - XLSX: worksheet/table region/header/body/number-format/width/freeze/print-layout rules.
  - PPTX: slide master/layout/title/body/table/chart/spacing/typography rules.
  - PDF: observable layout zones, reading order, typography, margins, table/list signatures, with evidence-only limits.
- Boundary: this is not an export/visual-replica promise; it is a richer formatting constraint layer for draft generation and audit.

## Trace Update：LLM FormatRuleSpec Synthesis Experiment（2026-05-14）

- Requirement: 将 FormatSpec 细粒度升级从“继续堆死规则”转向“LLM 基于 evidence/material 归纳 GB/T-like 规则体系”。
- Plan artifacts:
  - `.omx/plans/prd-format-rule-synthesis-experiment.md`
  - `.omx/plans/test-spec-format-rule-synthesis-experiment.md`
- Experiment artifact: `experiments/format-rule-synthesis/`。
- Controls:
  - current product FormatSpec outputs under `experiments/format-spec/outputs/*`。
  - negative mock output with missing evidence / forbidden promises。
- Key evaluator redesign: rule count is no longer the main quality proxy; compact rules with rich attributes pass if target coverage, required attributes, evidence coverage and granularity score are high.
- Verification:
  - mock happy path: 4/4 pass。
  - negative control: 4/4 fail。
  - real Codex CLI smoke with `gpt-5.5`: 4/4 pass。
- Boundary: no export/visual-replica promise; no snippets/fulltext default; no LLM fact overwrite.

## Trace Update：LLM FormatRuleSpec Productization Complete（2026-05-14）

- Requirement: 实验通过后，将 LLM 归纳出的 GB/T-like 细粒度格式规则产品化到 draft-processing 主链路。
- Product artifacts:
  - `src/lib/format-profile-semantic-overlay.ts`
  - `src/lib/format-profile-types.ts`
  - `src/lib/format-spec.ts`
  - `src/components/format-profiles/format-profiles-view.tsx`
  - `src/lib/format-profile-semantic-overlay.test.ts`
  - `src/lib/format-spec.test.ts`
- Implemented:
  - overlay schema supports `formatRuleSynthesis`。
  - evaluator validates rule/attribute schema and evidence refs。
  - attributes inherit parent rule evidence when omitted。
  - FormatSpec prefers accepted synthesized rules and renders attributes into promptBlock。
  - UI audit shows rule attributes。
- Verification:
  - targeted tests: 3 files / 26 tests PASS。
  - `npm run typecheck` PASS。
  - `npm run test:mocks` PASS（86 files / 1156 tests）。
  - `npm run build` PASS。
- Boundary: no export/visual-replica promise; no snippets/fulltext default; no LLM fact overwrite.



## Trace Update：FormatRule source compatibility fix（2026-05-14）

- Issue: 用户真实模型输出的 `formatRuleSynthesis` 规则使用 `source: inferred`，被 evaluator 判为 `format rule source is invalid`，导致智能解释降级为确定性画像。
- Root cause: 产品内部 schema 使用规范枚举 `llm-inferred`，但模型常用自然枚举 `inferred` / `model-inferred` / `ai-inferred`。这属于输入兼容性问题，不应通过放松证据校验解决。
- Fix:
  - 新增 `formatRuleSourceAliases` 白名单映射。
  - `normalizeFormatRuleSource()` 将已知同义词归一为内部规范枚举。
  - 未知 source 仍 rejected/fallback。
  - evidenceRefs、closed schema、禁越界承诺和 StyleFacts 事实边界保持不变。
- Product artifacts:
  - `src/lib/format-profile-semantic-overlay.ts`
  - `src/lib/format-profile-semantic-overlay.test.ts`
- Verification:
  - targeted tests: 3 files / 26 tests PASS。
  - `npm run typecheck` PASS。
  - `npm run test:mocks` PASS（86 files / 1156 tests）。
  - `npm run build` PASS。
- Boundary: compatibility mapping only; no snippets/fulltext default, no export/visual-replica promise, no LLM fact overwrite.


## Trace Update：FormatRule source diagnostic enhancement（2026-05-14）

- Issue: 用户再次遇到 `format rule source is invalid`，但现有 bundle 已包含常见 source alias 映射；需要先看见模型真实输出值，再决定是否补映射或调整 schema/prompt。
- Fix: evaluator 的 source violation message 现在包含原始值，例如 `format rule source is invalid; received "parser"`。
- Boundary: diagnostic-only; 不新增 source 映射，不改变 accepted/rejected 逻辑，不放松 evidenceRefs、closed schema、禁词或 StyleFacts 事实边界。
- Verification: targeted tests 3 files / 26 tests PASS；`npm run typecheck` PASS；`npm run build` PASS。


## Trace Update：Editable Format Constraints Experiment and Productization（2026-05-14）

- Requirement: 允许 LLM 基于 evidence 合理推理 GB/T-like 格式规则，并让用户可编辑最终格式约束。
- Experiment artifacts:
  - `experiments/editable-format-constraints/`
  - `.omx/plans/prd-editable-format-constraints-experiment.md`
  - `.omx/plans/test-spec-editable-format-constraints-experiment.md`
- Product design artifacts:
  - `.omx/plans/prd-editable-format-constraints-productization.md`
  - `.omx/plans/test-spec-editable-format-constraints-productization.md`
- Product artifacts:
  - `src/lib/format-profile-semantic-overlay.ts`
  - `src/lib/format-profile-types.ts`
  - `src/lib/format-spec.ts`
  - `src/stores/format-profile-store.ts`
  - `src/components/format-profiles/format-profiles-view.tsx`
  - corresponding tests
- Implemented:
  - `formatRuleSynthesis.source` missing/unknown is accepted with evaluator warnings and normalized to `llm-inferred`。
  - `EditableFormatSpecOverride` stores user-edited promptBlock with source auto spec hash.
  - `buildFormatSpecSnapshot()` uses edited promptBlock when override matches the current auto FormatSpec hash; stale overrides are ignored.
  - UI exposes edit/save/reset controls for actual FormatSpec promptBlock.
- Verification:
  - editable experiment PASS（4/4 cases; soft source fields accepted; negative gates rejected）。
  - targeted tests PASS（4 files / 33 tests）。
  - `npm run typecheck` PASS。
  - `npm run test:mocks` PASS（86 files / 1159 tests）。
  - `npm run build` PASS。
- Boundary: no snippets/fulltext default; no StyleFacts fact overwrite; no export/visual-replica promise; user edit is text-level MVP, not rich structured rule editor yet.


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

### Trace Update: FormatSpec multi-rule checklist enforcement (2026-05-14)

- Issue: manual test showed heading rules applied but list rule missed.
- Fix: draft-processing system prompt now treats FormatSpec as effective format contract, clarifies no-body-change still allows pure format changes, and requires multi-action FormatSpec/user edits to be checked/executed item-by-item; heading/list/numbering cannot be partially applied.
- Verification: targeted tests 2 files / 20 tests PASS; `npm run typecheck` PASS; `npm run build` PASS.
- Boundary: prompt influence only; no export/visual fidelity promise; Markdown still cannot express fonts/page metrics.

### Trace Update: Universal draft output contract (2026-05-14)

- Issue: format-constrained rewrite could still include chat-style preface and could assign the document title an incorrect Markdown role.
- Fix: draft-processing system prompt now has a general “底稿输出契约” and “结构角色约束” before FormatSpec-specific instructions.
- Scope: applies to all draft-processing conversations, with or without a selected FormatSpec.
- Verification: targeted tests 2 files / 20 tests PASS; `npm run typecheck` PASS; `npm run build` PASS.
- Boundary: does not hard-code one phrase or ban one Markdown marker globally; it separates chat answers from saveable draft bodies and requires structure-role mapping.

### Trace Update: Plans cleanup and DOCX-first next-stage anchor (2026-05-14)

- Current state: FormatProfile / StyleFacts / SemanticOverlay / FormatSpec / Editable Format Constraints / Draft Output Contract are considered closed for the current stage.
- Active next stage: `active/docx-first-formal-export-next-stage.md`.
- Requirements folder policy: `requirements/` keeps only three core tracking documents: original baseline, decision log, and traceability matrix.
- Archived supporting records: former supporting requirement notes moved to `archive/2026-05-requirements-supporting-records/`.
- Archived phase plans: completed FormatProfile / FormatSpec / FormatRule / Editable Format Constraints PRD + test-spec + ralplan records moved or merged into dated `archive/2026-05-*` directories.
- Next product trace target: DOCX-first Formal Export with `DocxExportContract → DocxIntermediateDocument → DocxMatchReview → DOCXExportAdapter → DocxExportRecord / Audit`.
- Boundary: this is a planning/records reorganization and stage handoff; it does not add new runtime behavior and does not change the evidence-only / no high-fidelity export promise boundary.

### Trace Update: DOCX-first Formal Export planning started (2026-05-14)

- Active detailed plan: `active/docx-first-formal-export-plan.md`.
- Active reference research: `active/formal-export-reference-findings.md`.
- Stage goal: move from Markdown/draft rewrite quality to a formal DOCX export loop that is openable, structurally correct, basically formatted, reviewable, and auditable.
- Proposed chain: `DraftRecord → DocxExportContract → DocxIntermediateDocument → DocxMatchReview → DOCXExportAdapter → DocxExportRecord / Audit`.
- MVP supports: document title, section headings, paragraphs, ordered/unordered lists, simple Markdown tables, references, basic font/size/page margin, MatchReview, and ExportRecord.
- MVP excludes: high-fidelity replica, external template files, multi-format export, LLM-authored DOCX, LLM-only success judgment, TOC, headers/footers, footnotes, comments, tracked changes, images, and complex table merge.
- FormatSpec role: read and apply MVP-expressible rules; unsupported/skipped rules must be visible in diagnostics instead of silently pretending success.
- Next required artifacts: DOCX-first Formal Export PRD and Test Spec before implementation.

### Trace Update: DOCX-first Export Contract Spike passed (2026-05-14)

- Experiment: `experiments/docx-first-export-contract/`.
- Command: `node experiments/docx-first-export-contract/scripts/run-docx-first-export-contract.mjs`.
- Result: PASS.
- Outputs: `export-contract.json`, `docx-intermediate.json`, `match-review.json`, `summary.json`, `summary.md`.
- Evidence: 10/10 checks passed, including contract required fields, no source leakage, intermediate blocks, FormatSpec ruleRefs, DOCX preflight readability, positive nonblocking review, missing-section fail, format-coverage visibility, source-leakage fail, and validation-error fail.
- DOCX preflight evidence: existing `docx-first-structured.docx` exists, 3494 bytes, 7 zip entries, 13 paragraphs, heading style refs include TOCHeading / Heading1 / Heading2.
- Product implication: proceed to DOCX-first Formal Export PRD/Test Spec with contract/intermediate/review as the boundary.
- Boundary: experiment does not choose final adapter, add npm dependencies, implement UI/store, or promise high-fidelity export.

### Trace Update: DOCX-first Formal Export productization design created (2026-05-14)

- PRD: `active/prd-docx-first-formal-export-productization.md`.
- Test Spec: `active/test-spec-docx-first-formal-export-productization.md`.
- Implementation sequence: Slice A contract/intermediate/review/record library → Slice B adapter comparison → Slice C MVP adapter integration → Slice D UI entry.
- Immediate next code target: Slice A only.
- Gate: no UI/export button before MatchReview and ExportRecord tests exist.
- Adapter status: undecided; TS adapter and OpenXML sidecar require shared-fixture comparison before product integration.

### Trace Update: Slice A RALPLAN approved (2026-05-14)

- Plan: `active/ralplan-docx-export-sliceA-contract-library.md`.
- Next implementation target: `src/lib/docx-export-contract.ts`, `src/lib/docx-intermediate.ts`, `src/lib/docx-match-review.ts`, `src/lib/docx-export-record.ts` and tests.
- Explicit exclusions: adapter, UI, store, Tauri, package dependency, real DOCX writing.
- Stop condition: Slice A tests and typecheck pass; do not automatically enter adapter comparison.


### Trace Update: Slice A DOCX export product library implemented (2026-05-14)

- Scope implemented: `DocxExportContract`, `DocxIntermediateDocument`, `DocxMatchReview`, `DocxExportRecord` under `src/lib`, plus focused tests and reusable fixtures.
- Contract coverage: draft id/title/content hash, reference count, FormatProfile/FormatSpec hashes, user instruction, required sections, allowed blocks, format rules, content leakage policy, export boundaries, validation policy, and contract hash.
- Intermediate coverage: document title, Chinese section headings, Chinese subsection headings, paragraphs, ordered lists, unordered lists, Markdown tables, diagnostics, source line ranges, ruleRefs, and stable intermediate hash.
- Review coverage: missing required sections fail; uncovered must rules fail; uncovered should rules warn; forbidden source leakage fails; validation errors fail; known warnings warn; audit refs are emitted.
- Record coverage: export id, draft lineage, format profile/spec hashes, contract/intermediate hashes, adapter metadata placeholder, verdict/status, diagnostics, and JSON serializability.
- Architect finding fixed: broad rule matching could cross-cover title/section/subsection/list rules; exact category mapping and negative regression tests now prevent cross-role coverage.
- Verification: targeted tests 4 files / 12 tests PASS; `npm run typecheck` PASS; `npm run build` PASS; architect verification APPROVED.
- Boundary: no adapter selection, no DOCX writing, no UI/store/Tauri/package changes, no high-fidelity export claim.
- Next trace target: Slice B adapter comparison using the product boundary, not experiment-only shapes.


### Trace Update: Slice B DOCX adapter comparison RALPLAN approved (2026-05-14)

- Plan: `active/ralplan-docx-export-sliceB-adapter-comparison.md`.
- Purpose: compare TS/JS `docx` adapter and OpenXML SDK sidecar using the same Slice A product boundary.
- Boundary chain: `DocxExportContract → DocxIntermediateDocument → adapter candidate → DocxMatchReview → DocxExportRecord → redacted comparison report`.
- Allowed execution scope: `experiments/docx-adapter-comparison/**` only.
- Forbidden product changes: root package/lock files, UI, store, Tauri, and product `src/**` implementation files.
- Validation gates: boundary gate, DOCX package gate, structural XML gate, review/record gate, redacted risk/report gate.
- Architect revision: separate internal generated DOCX/XML artifacts from shareable reports; reports must use assertion IDs, booleans, counts, hashes, issue codes, verdicts, and status summaries.
- Critic verdict: APPROVE.
- Next trace target: Slice B experiment implementation and comparison report generation.


### Trace Update: Slice B DOCX adapter comparison executed (2026-05-15)

- Experiment: `experiments/docx-adapter-comparison/`.
- Candidates: `ts-docx` and `openxml-sidecar`.
- Shared boundary: both candidates consume Slice A `DocxExportContract` and `DocxIntermediateDocument`, then pass through `DocxMatchReview` and `DocxExportRecord`.
- Commands: `npm --prefix experiments/docx-adapter-comparison run compare:ts-docx`, `compare:openxml`, and `compare`.
- Result: both candidates completed with `warn` verdict, `warning` record status, 0 validation errors, and 1 known warning.
- Reports: `reports/ts-docx.*`, `reports/openxml-sidecar.*`, `reports/summary.*`.
- Redaction: reports contain assertion IDs/counts/hashes/codes/statuses, not raw XML/source/evidence dumps.
- Product boundary: no final adapter selected; no UI/store/Tauri/product `src/**` changes; root `package.json` unchanged; dependencies are experiment-local.
- Verification: compare PASS; Slice A targeted tests 4 files / 12 tests PASS; `npm run typecheck` PASS; `npm run build` PASS; architect verification APPROVED.
- Next trace target: Slice C adapter selection and MVP DOCX writing plan.

## Trace Update - Slice C MVP DOCX writer (2026-05-15)

| Requirement / Constraint | Slice C Evidence | Status |
| --- | --- | --- |
| Do not restore manual template route | `DocxExportContract` keeps `no-template-file`; writer has no template input | Met |
| Do not promise high-fidelity replica | adapter/probe warnings include `high-fidelity-style-replica-not-supported` | Met |
| Browser-safe DOCX generation | `src/lib/docx-ts-adapter.ts` uses `Packer.toArrayBuffer` and returns `Uint8Array` | Met |
| Runtime structural validation | `src/lib/docx-package-probe.ts` checks DOCX package parts and structural assertions | Met |
| Validation errors must block | `src/lib/docx-writer.ts` merges probe errors before `reviewDocxExport`; tests cover review/record path | Met |
| Keep Slice C library-only | no UI/store/Tauri/save-flow files changed for Slice C | Met |
| Product dependency decision is explicit | `package.json`/`package-lock.json` add `docx` and `jszip`; Decision 037 records rationale | Met |

## Trace Update - Slice D DOCX export save flow (2026-05-15)

| Requirement / Constraint | Slice D Evidence | Status |
| --- | --- | --- |
| User must choose output path | `DraftsView` uses Tauri `save()` before write | Met |
| Cancel writes nothing | `runDocxExportSaveFlow` returns `cancelled`; tests verify writer/write not called | Met |
| Do not auto-overwrite or mutate path | non-`.docx` returned path fails; no silent extension append | Met |
| Binary-safe DOCX write | `writeBinaryFileBase64` Tauri command writes decoded bytes | Met |
| Invalid base64 no side effect | Rust tests cover missing and existing path no modification | Met |
| Avoid file-sync ingest confusion | binary write calls `mark_app_write_path` before/after writing; Rust test verifies marker | Met |
| Failed review blocks write | save-flow tests verify fail does not call binary write | Met |
| Warnings remain visible | warning outcome writes file and reports diagnostics | Met |
| No high-fidelity promise | UI hint says no high-fidelity visual reproduction promise | Met |
| No manual template route | no template input/path in export flow | Met |
