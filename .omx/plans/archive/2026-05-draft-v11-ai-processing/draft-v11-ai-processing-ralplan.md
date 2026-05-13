# RALPLAN: Draft v1.1「底稿 AI 加工会话」

Status: Final approved ralplan artifact  
Context snapshot: `.omx/context/draft-v11-ai-processing-20260512T074554Z.md`  
PRD: see generated `prd-draft-v11-ai-processing-*.md`  
Test spec: see generated `test-spec-draft-v11-ai-processing-*.md`

## Requirements Summary

为当前 Draft v1 增加最小高价值增强：用户可从 Draft 页面输入中文修改要求，默认新建专用 Chat 会话进行 AI 加工；该会话携带底稿内容、引用来源、保护约束与来源元数据，但不污染普通 Chat；AI 输出只作为 Chat assistant message 出现，用户确认后保存为新 Draft，原 Draft 不自动覆盖。

当前代码依据：

- `src/stores/draft-store.ts:4-20` 定义 `DraftSourceMeta`/`DraftRecord`；`38-43` 暴露 create/update/delete/select/set/clear；`115-150` 从 assistant message 创建 Draft；`153-176` 更新 Draft 与 contentHash；`179-190` 删除 Draft。
- `src/components/drafts/drafts-view.tsx:15-33` 读取/选择 Draft；`85-120` 编辑标题和内容；`123-155` 显示引用与来源信息。
- `src/stores/chat-store.ts:4-9` 当前 `Conversation` 仅有基础字段；`35-39` 为 conversation management；`79-93` `createConversation`；`118-152` `addMessage`；`165-194` `finalizeStream`；`223-227` `getActiveMessages`；`230-235` `chatMessagesToLLM`。
- `src/components/chat/chat-panel.tsx:156-425` `handleSend` 负责创建会话、添加 user message、构建 wiki retrieval/system prompt、组装 history、调用 `streamChat` 并 finalize；`477-543` 渲染会话列表、消息区和输入框。
- `src/components/chat/chat-message.tsx:107-111` assistant hover actions 包含 `SetAsDraftButton`；`129-150` 创建 Draft 并切到 Drafts view。
- `src/lib/persist.ts:27-62` 保存 conversations/messages；`64-112` 加载聊天历史。
- `src/lib/draft-persist.ts:5-20` 保存 `.llm-wiki/drafts.json`；`23-34` 加载 Drafts。
- `src/lib/auto-save.ts:30-39` 自动保存 Chat；`42-61` 自动保存 Drafts。
- `src/App.tsx:330-339` 加载 Chat；`343-347` 加载 Drafts。
- `src/i18n/zh.json:291-308` 已有 Draft 中文键；新增 UI 文本必须保持中文。

## RALPLAN-DR Summary

### Principles

1. **会话隔离优先**：底稿加工默认新建 `draft-processing` 专用会话，不把底稿内容塞进普通会话或全局系统提示。
2. **非破坏式默认**：AI 输出不自动覆盖原 Draft；只允许用户显式保存为新 Draft。
3. **复用现有链路**：不新增 Rust command，不重写 LLM provider；优先扩展 `chat-store`、`draft-store`、`ChatPanel`、`DraftsView`。
4. **中文交互一致**：新增前端可见 UI 文案必须为中文，并保持现有 UI 风格与布局密度。
5. **最小可验证闭环**：先完成 Draft → 专用 Chat → Assistant 输出 → 新 Draft，不提前进入模板/导出/完整 diff guard。

### Decision Drivers

1. **防污染**：普通 Chat 默认行为不能继承底稿加工上下文。
2. **低风险集成**：最少触碰现有 ingest/search/file-sync/source-lifecycle，避免与当前排错任务冲突。
3. **可追溯升级路径**：为后续 version history、diff guard、template-aware generation 保留 parent/derivation 元数据。

### Viable Options

#### Option A — 专用 Draft 加工会话 + 跳过普通 wiki retrieval（推荐）

Approach: DraftsView 创建 `kind: "draft-processing"` conversation，写入 `draftContext`，设置 pending request；ChatPanel 进入该会话后自动发送结构化中文 prompt，并使用 draft-focused system prompt，不跑普通 wiki retrieval。Assistant 输出可保存为新 Draft 并记录 parent/derivation。

Pros:
- 最强防污染；普通 Chat 与 Draft 加工上下文天然隔离。
- 不新增 Rust 后端，仍复用 streamChat 与现有持久化。
- references 可直接来自 Draft，而不是让搜索误召回无关 wiki pages。
- 最符合迁移文档“普通 Chat 默认行为不能被污染”的原则。

Cons:
- 需要给 Conversation 增加可选 metadata 与 pending request 机制。
- ChatPanel 需要识别 conversation kind，稍微拆分 send 逻辑。

#### Option B — 在原会话中插入 Draft 加工消息

Approach: DraftsView 回到当前 Chat，会在当前 conversation 中插入包含 Draft 内容的 user message。

Pros:
- 改动最少，不需要 conversation metadata。
- 用户可以在原上下文里继续讨论。

Cons:
- 高污染风险；底稿全文、局部修改约束会留在普通对话历史中。
- 后续普通问题可能继承“只改某部分”等约束。
- 不符合本轮用户明确担心的信息交叉污染。

#### Option C — Draft 页面直接调用 LLM 并把结果写回 Draft UI

Approach: DraftsView 内直接调用 `streamChat` 或抽象 runner，结果显示在 Draft 页面。

Pros:
- 用户停留在 Draft 工作页，交互集中。
- 不需要 Chat 会话列表承载加工任务。

Cons:
- 重复 ChatPanel 的 LLM/retrieval/streaming/error 逻辑。
- 容易滑向自动覆盖 Draft，风险高。
- 会形成第二套 Chat-like 后端逻辑，维护成本大。

### Recommended Option

选择 **Option A**。它以少量 store/UI 扩展换取最强的防污染和可追溯性，且不新增 Rust command、不改 ingest/source/file-sync，最符合“风险最小、收益最高”。

## Backend / Data Logic Integration Plan

本项目的“后端功能逻辑”主要由 Tauri commands、TS stores、lib orchestration 与项目目录 JSON 持久化共同承担。本功能不需要新增 Rust command；后端-like 逻辑放在 TypeScript 层。

### 1. Conversation metadata 扩展

文件：`src/stores/chat-store.ts`

新增类型：

```ts
export type ConversationKind = "normal" | "draft-processing"

export interface DraftProcessingContext {
  draftId: string
  draftTitle: string
  parentContentHash: string
  instruction: string
  references: MessageReference[]
  startedAt: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  kind?: ConversationKind
  draftContext?: DraftProcessingContext
}
```

保持 `kind` 可选，旧 conversations JSON 自动视为 normal。

### 2. Conversation creation options

将 `createConversation: () => string` 扩展为：

```ts
createConversation: (options?: CreateConversationOptions) => string
```

默认行为不变：标题仍是「New Conversation」或现有逻辑；新调用可以传入中文标题「加工：{draft.title}」、`kind: "draft-processing"`、`draftContext`。

`setConversations` 或加载侧应轻量规范化旧数据：缺少 `kind` 的历史会话视为 `"normal"`；缺少 `draftContext` 的会话不得显示底稿加工提示条。该规范化只在内存层补默认值，不需要迁移旧 JSON。

### 3. Pending request / one-shot auto send

新增 store 状态：

```ts
pendingDraftProcessingRequest: {
  id: string
  conversationId: string
  prompt: string
} | null
```

新增方法：

```ts
enqueueDraftProcessingRequest(request)
consumeDraftProcessingRequest(id)
```

目的：DraftsView 不直接调用 ChatPanel 内部 `handleSend`；ChatPanel 作为唯一发送执行面，看到 pending request 后 consume 一次并调用现有 send 链路，避免重复发送。

该 pending request 不进入 `saveChatHistory`，只存在于运行时 store。ChatPanel 消费前必须检查：

- request 的 `conversationId` 等于当前 active conversation；
- 当前不在 streaming；
- 先 consume 再发送，避免 React effect 重跑重复发送。

### 4. Prompt builder helper

新增 `src/lib/draft-processing.ts`：

- `buildDraftProcessingPrompt(draft, instruction)`：生成中文 user prompt。
- `buildDraftProcessingSystemPrompt(context)`：生成中文 system prompt。
- `buildDraftDerivation(context, assistantMessage)`：给保存为新 Draft 的 derivation 元数据。

Prompt 必须包含：

- 来源底稿标题；
- 修改要求；
- 原底稿内容；
- references 列表；
- 非覆盖约束；
- “输出完整修订稿”的要求。

### 5. Draft derivation metadata

文件：`src/stores/draft-store.ts`

为 `DraftRecord` 增加可选字段：

```ts
export interface DraftDerivationMeta {
  parentDraftId: string
  parentDraftTitle: string
  parentContentHash: string
  instruction: string
  processingConversationId: string
}

derivation?: DraftDerivationMeta
```

将 `createDraftFromMessage(message)` 扩展为 `createDraftFromMessage(message, options?)`，默认行为完全兼容。Draft-processing 会话中的「保存为新底稿」传入 derivation。

保存加工结果时必须支持 `forceNew: true` 或等价机制。原因：当前 `createDraftFromMessage` 会按 message/contentHash 去重（`src/stores/draft-store.ts:118-121`），若加工结果与父底稿或旧结果相同，普通去重会选中旧 Draft 并丢失本次加工链路。`forceNew` 只用于「保存为新底稿」，普通「设为底稿」继续保留去重行为。

### 6. Persistence compatibility

- `src/lib/persist.ts` 目前 JSON 保存 conversations/messages，不需要 schema migration；新增可选字段随 JSON 自然保存。
- `src/lib/draft-persist.ts` 保存整个 DraftRecord envelope；新增可选 `derivation` 自然持久化。
- `src/App.tsx` 加载旧数据时无需阻断；旧对象缺字段即按 normal/no derivation 处理。

## Frontend Chinese Interaction Logic

### 1. DraftsView 新增右侧中文加工区

文件：`src/components/drafts/drafts-view.tsx`

在现有 references/source 侧栏上方或下方新增卡片：

- 标题：「AI 加工底稿」
- Textarea label：「修改要求」
- Placeholder：「例如：只改风险提醒部分，正文不要缩短；改成正式汇报口吻。」
- 主按钮：「新建加工会话」
- 说明：「原底稿不会被自动覆盖。AI 结果会先出现在 Chat 中，你确认后再保存为新底稿。」

点击后：

1. trim instruction；空则禁用按钮或显示中文提示；
2. 调 `createConversation({ title: `加工：${draft.title}`, kind: "draft-processing", draftContext })`；
3. `enqueueDraftProcessingRequest({ conversationId, prompt })`；
4. `useWikiStore.getState().setActiveView("wiki")`，进入 ChatPanel。

### 2. ChatPanel 加工会话提示条

文件：`src/components/chat/chat-panel.tsx`

当 active conversation `kind === "draft-processing"` 时，在消息列表上方显示中文提示：

```text
底稿加工会话
来源底稿：{draftTitle}
原底稿不会被自动覆盖，满意后请点击「保存为新底稿」。
```

### 3. ChatPanel 发送逻辑分支

在 `handleSend` 构建 system prompt 时：

- normal conversation：保持现有 wiki retrieval 逻辑。
- draft-processing conversation：跳过普通 `searchWiki` / graph expansion；使用 draft-focused system prompt；`queryRefs = draftContext.references`，使引用面板仍能展示原底稿 references。

这样避免 Draft 内容作为搜索 query 触发无关 wiki pages 注入。

### 4. ChatMessage 保存按钮中文区分

文件：`src/components/chat/chat-message.tsx`

在 draft-processing conversation 中，assistant hover action 文案改为：

- 「保存为新底稿」

普通 assistant message 仍为：

- 「设为底稿」

保存新 Draft 后仍切到 Drafts view，并选中新 Draft。

### 5. DraftsView 显示来源链

若 `draft.derivation` 存在，在来源区显示：

- 「由底稿加工生成」
- 「父底稿：{parentDraftTitle}」
- 「加工要求：{instruction}」

## File-Level Implementation Steps

1. `src/lib/draft-processing.ts`
   - 新增 prompt builder、system prompt builder、derivation helper。
   - 单元测试优先，保证中文 prompt 与非覆盖约束。

2. `src/stores/chat-store.ts`
   - 扩展 Conversation metadata。
   - 扩展 `createConversation(options?)`，保持无参调用兼容。
   - 新增 pending request state/methods。
   - 增加 store tests。

3. `src/stores/draft-store.ts`
   - 增加 `DraftDerivationMeta` 可选字段。
   - 扩展 `createDraftFromMessage(message, options?)`。
   - normalizeDraft 保留/规整 derivation。
   - 扩展 tests。

4. `src/components/drafts/drafts-view.tsx`
   - 增加 `instruction` state。
   - 增加「AI 加工底稿」中文卡片。
   - 点击后创建加工会话、enqueue pending request、切到 Chat。
   - 显示 derivation 来源信息。

5. `src/components/chat/chat-panel.tsx`
   - 找到 active conversation。
   - useEffect 消费 pending request 并调用 `handleSend`。
   - 对 draft-processing conversation 使用 draft-focused prompt，跳过普通 retrieval。
   - 显示中文会话提示条。
   - 尽量把 prompt 分支封装为小 helper，避免继续扩大 `handleSend`；若本次不拆大函数，也必须把 normal vs draft-processing 的分支边界注释清楚。

6. `src/components/chat/chat-message.tsx`
   - 根据 active conversation kind 调整按钮文案与 derivation 传参。

7. `src/i18n/zh.json` / `src/i18n/en.json`
   - 增加新 keys；实际新增 UI 以中文文案为准，保持 i18n parity。

8. 计划外但可选：修复当前文件里已有 mojibake 文案时仅限触及行，避免大范围格式化。

## Acceptance Criteria

1. Draft 页面存在中文「AI 加工底稿」区域。
2. 点击「新建加工会话」会创建标题为「加工：{底稿标题}」的新 conversation。
3. 新 conversation 持久化后包含 `kind: "draft-processing"` 与 `draftContext`。
4. ChatPanel 自动发送一次加工请求，不重复发送。
5. 加工请求包含底稿内容、修改要求、references 和非覆盖约束。
6. Draft-processing 会话显示中文提示条。
7. Draft-processing 会话不运行普通 wiki retrieval，不注入无关 wiki pages。
8. Assistant 输出不会自动覆盖原 Draft。
9. 「保存为新底稿」强制创建新 Draft，并记录 parent/derivation；不得被 contentHash 去重合并回父底稿。
10. 新建普通 Chat 不显示加工提示条，不包含任何 draftContext。
11. 旧 `.llm-wiki/conversations.json` / `.llm-wiki/drafts.json` 仍可加载。
12. pending draft-processing request 不持久化，刷新后不会重复自动发送。
13. `npm run typecheck`、Draft/chat 相关单测、i18n parity、`npm run build` 通过。

## Risks and Mitigations

- Risk: pending request useEffect 重复触发，导致重复发送。  
  Mitigation: request 带唯一 id；ChatPanel 先 consume 再调用 handleSend；测试 consume-once。

- Risk: Draft 加工会话仍走普通 retrieval，污染加工上下文。  
  Mitigation: ChatPanel 依据 active conversation kind 分支，draft-processing 跳过 searchWiki/graph expansion。

- Risk: 扩展 Conversation 破坏旧持久化。  
  Mitigation: 所有新字段 optional；旧数据默认 normal；save/load 继续 JSON passthrough。

- Risk: 保存为新 Draft 时丢失父底稿关系。  
  Mitigation: Draft-processing conversation 的 draftContext 传入 `createDraftFromMessage` options；「保存为新底稿」使用 `forceNew`；新增 derivation tests。

- Risk: ChatPanel `handleSend` 已经承担 retrieval、history、streaming，继续加分支会加重耦合。  
  Mitigation: 本阶段只加一个明确的 draft-processing 分支；prompt 组装放入 `src/lib/draft-processing.ts`；后续若继续扩展模板/导出，再抽 `chat-runner`。

- Risk: UI 文案混入英文。  
  Mitigation: 新增可见文案全部中文；i18n keys 保持 parity。

- Risk: 范围膨胀到版本历史/diff/template/export。  
  Mitigation: 本计划仅记录 parent/derivation，不做完整版本树 UI、不做 diff guard、不做模板。

## Verification Steps

```powershell
npm run typecheck
npx vitest run src/stores/draft-store.test.ts src/lib/draft-persist.test.ts src/i18n/i18n-parity.test.ts
npx vitest run src/lib/draft-processing.test.ts
npm run test:mocks
npm run build
```

Manual smoke 按 test spec 执行。

## ADR

### Decision

实现 Draft v1.1「底稿 AI 加工会话」：从 Draft 页面发起 AI 加工时默认新建专用 Chat conversation，使用 draft-focused prompt，AI 输出不自动覆盖原 Draft，用户确认后保存为新 Draft。

### Drivers

- 防止普通 Chat 与 Draft 加工上下文交叉污染。
- 以最小改动补齐 Draft → AI → 新 Draft 闭环。
- 为后续 version history/diff guard/template/export 打基础。

### Alternatives considered

- 原会话中继续加工：改动小但污染风险高。
- Draft 页面直接调用 LLM：交互集中但复制 Chat 逻辑，维护风险高。
- 完整版本历史 + diff guard 一次到位：价值高但范围过大，不适合作为下一步最小闭环。

### Why chosen

专用会话方案复用现有 Chat/LLM/persistence 链路，同时通过 conversation kind 与 draftContext 明确隔离边界，满足用户对互不干扰的要求。

### Consequences

- Conversation schema 增加可选 metadata。
- ChatPanel 发送逻辑需要一个小分支处理 draft-processing。
- DraftStore 增加轻量 derivation 元数据。

### Follow-ups

- Draft version history UI。
- Diff guard：检测非目标区域大幅变化并警告。
- Template-aware generation 绑定 Draft。
- Export pipeline 从 Draft version 导出。

## Available-Agent-Types Roster

可用角色：`explore`, `planner`, `architect`, `critic`, `executor`, `debugger`, `test-engineer`, `verifier`, `code-reviewer`, `reviewer`, `build-engineer`, `writer`。

## Follow-up Staffing Guidance

### `$ralph` sequential lane（推荐）

- `executor`：实现 store/helper/UI 分支，medium reasoning。
- `test-engineer`：补 draft-processing/helper/store tests，medium reasoning。
- `verifier`：运行 typecheck/vitest/build 并核对验收，high reasoning。

Launch hint:

```text
$ralph execute .omx/plans/draft-v11-ai-processing-ralplan.md
```

### `$team` parallel lane

适合需要更快实现时：

- Worker 1（executor）：`chat-store` + `draft-processing` helper。
- Worker 2（executor）：`draft-store` + DraftsView 中文 UI。
- Worker 3（executor）：ChatPanel/ChatMessage 会话提示与保存新底稿。
- Worker 4（test-engineer）：单测与 i18n parity。
- Verifier：整体验收和防污染检查。

Launch hint:

```text
$team implement .omx/plans/draft-v11-ai-processing-ralplan.md with 4 workers plus verifier
```

Team verification path:

1. 每个 worker 只提交自己文件范围的改动说明。
2. verifier 运行指定 verification commands。
3. leader 检查普通 Chat 与 draft-processing 会话隔离是否满足 acceptance criteria。

## Goal-Mode Follow-up Suggestions

- `$ultragoal`：如果希望把 Draft v1.1 + version history + diff guard 拆成连续目标，作为默认 goal-mode 路径。
- `$autoresearch-goal`：不适用，本任务不是外部研究。
- `$performance-goal`：不适用，本任务不是性能优化。

## Consensus Review Results

### Architect Review

Verdict: **APPROVE WITH REQUIRED IMPROVEMENTS**.

Strongest steelman antithesis:
- 专用 `draft-processing` conversation 会让用户的工作流从 Draft 页面跳到 Chat，可能产生“为什么不是直接在底稿页生成”的认知成本；同时 ChatPanel 已经很重，在其中加入加工分支可能进一步集中复杂度。

Tradeoff tension:
- **隔离安全 vs 交互连续性**：在原会话继续加工交互更连续，但污染普通 Chat；专用会话防污染更强，但需要 conversation metadata、提示条和会话列表识别。
- **最小改动 vs 长期边界**：直接在 ChatPanel 中加分支最快，但如果未来模板/导出也进入 ChatPanel，会造成中心化膨胀。

Synthesis:
- 保持 Option A，但强制把 prompt/derivation 逻辑抽到 `src/lib/draft-processing.ts`，让 ChatPanel 只负责选择 normal/draft-processing 运行路径。
- 增加 `forceNew` 保存语义，避免当前 contentHash 去重破坏“保存为新底稿”的产品承诺。
- 对旧 conversation 做内存级 default normal 规范化，不做 JSON migration。

Architect-required improvements applied:
- Added `forceNew` requirement for derived drafts.
- Added non-persistent, consume-once pending request constraints.
- Added old conversation normalization requirement.
- Added ChatPanel coupling mitigation.

### Critic Review

Verdict: **APPROVE**.

Quality checks:
- Principle-option consistency: passes; recommended option directly supports session isolation and non-destructive default.
- Alternatives fairness: passes; original-session and Draft-page-direct alternatives include real benefits and concrete rejection reasons.
- Risk mitigation clarity: passes after adding `forceNew`, consume-once pending request, and ChatPanel coupling mitigations.
- Testability: passes; acceptance criteria are observable through store tests, prompt tests, i18n parity, typecheck, build, and manual smoke.
- Verification: passes; commands are concrete and scoped to changed behavior.

Critic notes for execution:
- Do not implement automatic “替换当前底稿” in this phase.
- Do not route draft-processing prompt through normal wiki retrieval.
- Keep all new visible UI copy Chinese even if i18n keys also include English fallback.
- If `handleSend` becomes hard to reason about, stop after extracting a minimal helper rather than adding more inline branching.

## Changelog

- 初版由本地 Planner 生成；等待 Architect/Critic 评审。
- Architect/Critic fallback review completed after external reviewers timed out.
- Applied review improvements: force-new derived Draft, pending request consume-once/non-persistent constraints, old conversation normalization, and ChatPanel coupling mitigation.
