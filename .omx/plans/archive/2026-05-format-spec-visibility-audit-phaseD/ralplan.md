# FormatSpec Phase D 可视化 / 审计 / 保护设计归档

归档说明：Phase D 审计可视化设计已完成并被后续 UI 审计能力吸收；原 RALPLAN 全文保存。


---

## 原文件：`prd-format-spec-phaseD-visibility-audit.md`


# RALPLAN: FormatSpec Phase D - 可视化、审计与严格排版保护设计

日期：2026-05-14  
状态：已实现并验证通过  
范围：设计计划，不实现代码

## Requirements Summary

Phase C 已完成 FormatSpec 产品化接入：

- `src/lib/format-spec.ts` 负责 `buildFormatSpec()`、`renderFormatSpecPromptBlock()`、`buildFormatSpecSnapshot()`，并产出 `sourceProfileHash` / `formatSpecHash` / `promptBlock`。
- `src/lib/format-profile.ts:440-454` 的 `buildFormatProfileSnapshot()` 已物化 FormatSpec snapshot。
- `src/lib/draft-processing.ts:50-62` 的 system prompt 注入 FormatSpec；`src/lib/draft-processing.ts:25-48` 的 user prompt 不注入画像块。
- `src/components/drafts/drafts-view.tsx:77-98` 在启动底稿加工时生成 snapshot 和 user prompt。
- `src/components/chat/chat-panel.tsx:197` 在 draft-processing 会话中生成 system prompt；`src/components/chat/chat-panel.tsx:544-547` 目前仅显示存在格式画像的会话标签。
- `src/components/format-profiles/format-profiles-view.tsx:301-368` 目前展示 StyleFacts、结构证据、诊断和旧 generationInstruction，但没有展示产品实际使用的 FormatSpec。

用户侧保存底稿冒烟基本通过，但暴露出下一步产品缺口：FormatSpec 仍是内部 prompt contract，用户无法审计“模型实际收到的格式约束”。另一个已记录但暂不实现的缺口是：严格“不修改正文/只排版”模式需要更强保护 wiki 双链、引用标记、表格、列表与段落顺序。

## RALPLAN-DR Summary

### Principles

1. **可见不泄露**：展示用户可理解的 FormatSpec 规则，但不展示 raw evidence、全文片段、hash dump 或 provider payload。
2. **审计优先于新能力**：先让用户看见当前系统如何约束模型，再扩展 snippets/fulltext、导出或更复杂格式保护。
3. **边界显性化**：所有 UI/审计文案必须持续显示 evidence-only、不承诺导出、不承诺视觉还原/高保真、不恢复手动模板。
4. **主链路稳定**：Phase D 不改变 Phase C prompt contract；预览必须读取同一个 `snapshot.formatSpec.promptBlock` 或同源 renderer 输出。
5. **严格排版保护先作为 backlog**：除非单独启动 D-2，不在 D-1 直接修改模型行为。

### Decision Drivers

1. 用户需要判断“系统到底按什么格式规则在写”。
2. 当前 UI 展示旧 `generationInstruction`，容易让用户误以为旧画像约束仍是主链路。
3. 后续任何质量调优都需要可复现审计对象：FormatSpec hash、source profile hash、renderer/policy/schema version、prompt block 摘要。

### Viable Options

#### Option A：FormatSpec Preview / Audit First（推荐）

**Approach**: 在格式画像详情页和 draft-processing 会话中展示 FormatSpec 预览/审计摘要，提供“本次实际格式约束”只读查看。

**Pros**:
- 直接解决“FormatSpec 目前看不到”的产品缺口。
- 不改变模型输出行为，风险低。
- 为后续严格排版保护、真实模型回归、导出前审计打基础。

**Cons**:
- 不会立即解决 wiki 双链被去掉等严格正文保护问题。
- 需要设计 UI 防止用户误以为预览等于导出复刻能力。

#### Option B：Strict No-Body-Change Protection First

**Approach**: 优先识别“不修改正文/只排版”意图，并在 draft-processing prompt 中保护 wiki 双链、引用、表格、列表和段落顺序。

**Pros**:
- 针对最近用户样例中的细节缺口。
- 有助于提高“只排版”任务的输出稳定性。

**Cons**:
- 会改变模型行为，需要更多样例和负例测试。
- 可能与“格式画像排版优化”发生张力：标题顺序、导语位置等哪些算排版，哪些算正文，需要先定义清楚。
- 用户刚明确“先不修改这个”，不应立刻实现。

#### Option C：Real-Model FormatSpec Regression Set First

**Approach**: 建立真实模型回归样例集，比较 FormatSpec 输出质量。

**Pros**:
- 能发现不同模型对 FormatSpec 的遵循差异。
- 支持后续 prompt tuning。

**Cons**:
- 当前更缺产品可见性；没有审计 UI 时回归结果难被用户理解。
- 会受模型配置/额度/网络影响，不适合作为下一步最小闭环。

### Recommendation

Phase D 拆为两个顺序阶段：

```text
D-1 FormatSpec Visibility / Audit / Preview（先做）
  ↓
D-2 Strict No-Body-Change Protection Mode（另起 ralplan，后做）
```

本次只规划并建议执行 D-1。D-2 作为 backlog 继续记录，不在本阶段实现。

## D-1 Source-of-Truth Decision

Critic review 指出：当前 `FormatSpecSnapshot` 只包含 `schemaVersion`、`rendererVersion`、`policyVersion`、`promptBlock`、`summaryLines`，不足以让 draft-processing UI 安全展示边界和规则分组。

D-1 采用以下明确方案：

```text
buildFormatSpec(profile)
  -> structured FormatSpec
  -> buildFormatSpecSnapshot(profile)
       stores promptBlock + summaryLines + audit fields
  -> profile detail UI and draft-processing UI consume snapshot/view helper
```

需要扩展 `FormatSpecSnapshot`，增加用于 UI 审计的结构化字段：

- `sourceFileType`
- `documentIntent`
- `confidence`
- `boundaries`
- `rules`
- `contentLeakagePolicy`

原则：

- UI 不解析 `promptBlock`。
- UI 不重新构造 FormatSpec 规则。
- profile detail 页可以从 profile 现场生成 snapshot/view；draft-processing 会话只消费会话 snapshot。
- 完整 `promptBlock` 仍只作为二级审计文本，不作为结构化 UI 数据源。

## D-1 Product Scope

### In Scope

1. **格式画像详情页增加 FormatSpec 预览区**
   - 来源：通过 `buildFormatProfileSnapshot()` / `buildFormatSpecSnapshot()` 得到结构化 `formatSpec` audit fields，不解析 promptBlock。
   - 展示：schemaVersion、rendererVersion、policyVersion、sourceProfileHash、formatSpecHash、summaryLines、结构化 boundaries、结构化 rules 分组。
   - 展开项：默认展示规则摘要；完整 `promptBlock` 作为“审计文本”默认折叠，并标注“这是发送给模型的约束文本，不代表导出或视觉复刻承诺”。

2. **draft-processing 会话增加“本次格式约束”入口**
   - 在 `chat-panel` 当前 draft-processing banner/context 中显示已绑定格式画像时，提供只读入口或折叠区。
   - 只消费该会话 `formatProfileSnapshot.formatSpec` 内的结构化 audit fields；不得解析 `promptBlock`，也不得根据 profile 重新生成规则。
   - 默认展示该会话 snapshot 的 `formatSpecHash`、版本、摘要、边界和规则分组；完整 `promptBlock` 仅作为“审计文本/复制调试信息”二级展开，不作为普通产品承诺文案。

3. **旧 generationInstruction 文案降级**
   - 在格式画像详情页旧 generationInstruction 区域加“兼容展示，不参与新加工主链路”提示；或把它折叠到兼容/调试区域。
   - 不删除字段，不做迁移破坏。

4. **审计边界文案**
   - 明示 evidence-only。
   - 明示“不承诺导出 DOCX/XLSX/PPTX/PDF”。
   - 明示“不承诺视觉还原/高保真复刻”。
   - 明示“不发送 snippets/fulltext/raw evidence”。

### Out of Scope

- 不实现严格不改正文保护模式。
- 不默认发送 snippets/fulltext。
- 不做正式导出、模板复刻、视觉高保真或像素级匹配。
- 不恢复手动输入模板。
- 不改变 LLM provider 或 semantic overlay evaluator 合同。

## Implementation Plan（D-1，待批准后执行）

### Step 1：扩展 FormatSpecSnapshot 并补展示模型 helper

候选文件：`src/lib/format-profile-types.ts`、`src/lib/format-spec.ts`，可新增 `src/lib/format-spec-view.ts`。

先扩展 `FormatSpecSnapshot`，让 snapshot 成为 draft-processing UI 的审计 source-of-truth：

```ts
interface FormatSpecSnapshot {
  schemaVersion: string
  rendererVersion: string
  policyVersion: string
  sourceFileType: FormatProfileFileType
  documentIntent: string
  confidence: FormatProfileConfidence
  contentLeakagePolicy: ...
  boundaries: string[]
  rules: FormatSpecRule[]
  promptBlock: string
  summaryLines: string[]
}
```

再输出一个只读 view model helper，例如：

```ts
buildFormatSpecAuditView(snapshot)
```

字段包括：

- schema/renderer/policy version
- sourceProfileHash / formatSpecHash（来自外层 snapshot）
- source file type / document intent / confidence
- summaryLines
- boundaryLines
- grouped rules：target -> rules
- promptBlock（仅用于二级审计展开，不作为默认主视图）
- compatibility flags：legacyGenerationInstruction present, not-main-path

注意：helper 不应返回 raw `styleFacts.evidence`、raw evidence、textSample、hash dump 列表或 snippets/fulltext。UI 不得解析 promptBlock。

### Step 2：格式画像详情页展示 FormatSpec Audit

候选文件：`src/components/format-profiles/format-profiles-view.tsx`。

新增区块位置建议在 StyleFacts/智能解释之后、旧 generationInstruction 之前：

- 标题：“本次格式约束 / FormatSpec”
- 摘要 chips：schema、renderer、policy、evidence-only、hash short
- 规则分组：page/title/heading/... 或 workbook/sheet/... 等
- 折叠 promptBlock：“查看审计文本/实际发送约束”，默认关闭，并带边界说明
- 旧 generationInstruction 改为“兼容约束（不参与新加工主链路）”

### Step 3：draft-processing 会话显示当前 FormatSpec

候选文件：`src/components/chat/chat-panel.tsx`。

当 `activeConversation.draftContext.formatProfileSnapshot` 存在时，在 draft-processing banner 或上下文卡片中增加：

- 格式画像标题
- `formatSpecHash` 短码
- “查看本次格式约束”折叠详情；完整 promptBlock 只在二级审计展开中显示
- 边界提示：只作用于本次底稿加工会话

不得把该 block 作为普通 chat 消息追加；只是 UI 只读审计。

### Step 4：i18n 文案

候选文件：`src/i18n/zh.json`、`src/i18n/en.json`。

新增文案需要避免：自动生成、复刻、高保真、导出保证等承诺。

### Step 5：测试

- `format-spec` view helper 单测：四格式规则分组、边界文案、无 raw evidence 泄漏。
- `format-profiles-view` 若已有组件测试基础则加 UI smoke；若无，则至少静态/单元验证 helper 和 i18n parity。
- `draft-processing.test.ts` 保持 system prompt only once/user prompt no block。
- 回归：`npm run typecheck`、`npm run test:mocks`、`npm run build`。

## Acceptance Criteria

1. 用户能在格式画像详情页看到来自结构化 snapshot/view 的 FormatSpec 摘要、规则分组、hash/version、边界。
2. 用户能在 draft-processing 会话看到“本次实际格式约束”的只读审计入口，且该入口只消费会话 snapshot 的结构化 audit fields，不解析 promptBlock。
3. UI 不展示 raw evidence、snippets/fulltext、textSample、styleFacts JSON、证据 hash 列表。
4. 旧 generationInstruction 被标注为兼容展示，不被描述为新加工主链路。
5. draft-processing prompt contract 不变化：system prompt 注入一次，user prompt 无画像块。
6. UI 文案不出现导出/视觉复刻/高保真承诺。
7. D-2 严格不改正文保护只作为 backlog 记录，不在 D-1 偷偷实现。
8. 验证通过：typecheck、test:mocks、build；如组件测试覆盖不足，必须说明测试空白并以 helper/i18n/contract tests 补足。

## Risks and Mitigations

- Risk: 用户误以为 FormatSpec 预览代表导出复刻能力。  
  Mitigation: 每个入口展示“不承诺导出/视觉还原”边界。

- Risk: 展开 promptBlock 后暴露过多内部实现。  
  Mitigation: promptBlock 已是产品 renderer 输出，不含 raw evidence；默认折叠，并标注“只读审计”。

- Risk: 旧 generationInstruction 与 FormatSpec 并存造成混淆。  
  Mitigation: 改名/标注兼容展示，不参与新加工主链路。

- Risk: 直接做 D-2 导致 scope creep。  
  Mitigation: D-1 明确 out-of-scope，D-2 另起 ralplan。

## Verification Steps

```powershell
npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose
npm run typecheck
npm run test:mocks
npm run build
```

若实现触及 i18n，增加/复跑 i18n parity 测试。

## ADR

### Decision

采用 Option A：先做 FormatSpec 可视化/审计/预览，不立即实现严格不改正文保护。

### Drivers

- 用户当前最大问题是看不到 FormatSpec。
- D-1 风险低，不改变模型行为。
- 审计 UI 是后续 D-2 和真实模型回归的基础。

### Alternatives Considered

- Option B：严格不改正文保护优先。暂缓，因为用户明确说先不改，且需要更多边界定义。
- Option C：真实模型回归优先。暂缓，因为缺少产品审计面板时，回归结果难以落地。

### Why Chosen

D-1 直接补齐 Phase C 最大产品可见性缺口，同时保持主链路稳定和边界安全。

### Consequences

- 用户能审计“模型实际收到的格式约束”。
- 仍不会立即解决 wiki 双链保护问题。
- 后续 D-2 需要基于 D-1 的审计视图设计单独保护模式。

### Follow-ups

1. D-1 实现后进行桌面端冒烟：选择格式画像 → 发起底稿加工 → 查看 FormatSpec 审计 → 保存底稿。
2. D-2 另起 ralplan：严格不改正文/只排版保护模式。
3. D-3：真实模型 FormatSpec 质量回归样例集。

## Available-Agent-Types Roster and Staffing Guidance

- `architect`：审查 UI/领域边界，确保不把 prompt/debug 与产品承诺混淆。
- `executor`：实现 view helper、UI 区块、i18n 文案。
- `test-automator`：补 helper/contract/i18n tests。
- `reviewer`：检查是否泄露 raw evidence、是否破坏 prompt contract。
- `verifier`：跑 typecheck/test/build 并做完成证据汇总。

### Ralph path

适合单人顺序实现：helper → UI → i18n → tests → verification。

### Team path

若并行：

- Lane 1 executor：`src/lib/format-spec-view.ts` + tests。
- Lane 2 executor/designer：`format-profiles-view.tsx` + i18n。
- Lane 3 executor：`chat-panel.tsx` draft-processing audit entry。
- Lane 4 test-automator：contract/i18n regression。

Team verification：先由各 lane 跑 targeted tests，再由 verifier 跑 `npm run typecheck && npm run test:mocks && npm run build`。

## Goal-Mode Follow-up Suggestions

- 默认：`$ultragoal` 若需要把 D-1 作为持久多步目标推进。
- 实现闭环：`$ralph` 更适合本阶段单 owner 实现。
- 并行 UI + tests：`$team` 可用，但本阶段规模中等，非必须。


## Architect Review Note（local fallback, 2026-05-14）

Verdict: APPROVE with incorporated adjustment.

Strongest antithesis: 如果直接把完整 `promptBlock` 作为 UI 主视图，用户可能把内部 prompt 文本误解为产品对导出、排版复刻或最终成文质量的承诺，也可能把内部规则文本当作可编辑模板入口。

Tradeoff tension: 可审计性需要展示“实际发送约束”，但产品清晰性要求默认只展示摘要、版本、hash、边界和规则分组。综合方案：默认摘要视图，完整 promptBlock 仅作为二级审计展开/复制调试信息。

Applied change: D-1 UI 默认显示摘要与规则分组；完整 promptBlock 默认折叠，并标注为审计文本，不代表导出或视觉复刻承诺。


## Critic Review Fix（2026-05-14）

Critic verdict was ITERATE due to missing source-of-truth clarity for draft-processing audit fields. Fix applied:

- D-1 explicitly extends `FormatSpecSnapshot` with structured audit fields (`sourceFileType`, `documentIntent`, `confidence`, `contentLeakagePolicy`, `boundaries`, `rules`).
- UI must consume structured snapshot/view data.
- UI must not parse `promptBlock` or recreate rules manually.
- Full `promptBlock` remains secondary audit text only.


## Implementation Result（2026-05-14）

Phase D-1 已完成实现：

- 扩展 `FormatSpecSnapshot` 为结构化审计 source-of-truth。
- 新增 `buildFormatSpecAuditView()`。
- 格式画像详情页和 draft-processing 会话都展示 FormatSpec 审计入口。
- 完整 promptBlock 仅作为默认折叠审计文本。
- legacy generationInstruction 标注为兼容展示，不参与新主链路。

验证通过：targeted tests 15/15、typecheck、test:mocks 86 files / 1153 tests、build。

## Compatibility Fix（2026-05-14）

User desktop smoke exposed `snapshot.rules is not iterable` when viewing a conversation/draft with an older persisted `formatSpec` snapshot.

Resolution:

- `buildFormatSpecAuditView()` now treats structured audit fields as migration-sensitive.
- Missing `rules`, `boundaries`, and `summaryLines` are normalized to empty arrays.
- Missing metadata (`sourceFileType`, `documentIntent`, `confidence`, `contentLeakagePolicy`, `promptBlock`) falls back to safe audit-only defaults.
- A regression test covers legacy snapshots without structured audit fields.

Verification:

```powershell
npm run typecheck
npx vitest run src/lib/format-spec.test.ts src/lib/draft-processing.test.ts --reporter=verbose
```

Result: typecheck PASS; targeted tests PASS（2 files / 16 tests）; build PASS。
