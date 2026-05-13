# RALPLAN: Draft v1.3「基础 Diff Guard / 保存前风险提示」

Status: Final draft ralplan for user approval
Context snapshot: `.omx/context/draft-v13-basic-diff-guard-20260512T143113Z.md`
PRD: `.omx/plans/prd-draft-v13-basic-diff-guard-20260512T143113Z.md`
Test spec: `.omx/plans/test-spec-draft-v13-basic-diff-guard-20260512T143113Z.md`

## Goal

在 Draft v1.2「版本历史 + 基础对比」之后，补齐 Draft 阶段的最低风险、高收益保护：为底稿 AI 加工结果增加基础 Diff Guard / 保存前风险提示。重点覆盖前端交互、store/lib 数据流、测试验收；所有新增前端用户可见文案必须为简体中文。

## RALPLAN-DR Summary

### Principles

1. **非破坏式默认**：Diff Guard 只发生在“保存为新底稿”前，绝不覆盖原底稿。
2. **只警告不阻断**：基础规则可能误报，所以用户确认后仍可强制保存。
3. **普通 Chat 零污染**：只有 draft-processing 会话的“保存为新底稿”触发 guard。
4. **确定性基础版**：使用规则和行级 compare，不引入 LLM 审查、不做语义 diff。
5. **简体中文优先**：所有新增前端文案、提示、风险原因均为简体中文。

### Decision Drivers

1. 当前迁移计划中 Draft 阶段尚缺“局部修改保护 / diff guard”。
2. `pkm-tool` 的真实失败集中在“局部修改指令导致非目标内容被破坏”。
3. 已有 `compareDraftText`、draft-processing context、save-as-new-draft 入口，适合做小范围增量。

### Viable Options

#### Option A — 保存前 confirm 风险提示（推荐）

做法：在 `chat-message.tsx` 的 draft-processing 保存入口前调用纯 helper；如高风险，弹出简体中文 `window.confirm`。确认后继续现有保存，取消则不保存。

优点：改动最小；不引入新 UI 状态；测试面清晰；不会影响普通 Chat。  
缺点：交互较朴素，不如自定义 Modal 美观。

#### Option B — 自定义风险提示 Modal

优点：信息展示更好，后续可扩展详细 diff。  
缺点：需要新增组件状态和交互测试，当前 v1.3 风险偏高。

#### Option C — LLM 语义审查

优点：更可能识别“是否真的只改局部”。  
缺点：成本、延迟、失败模式、prompt 复杂度都更高；不适合基础保护阶段。

### Recommended Option

选择 **Option A**：基础规则 + 行级 compare + 简体中文 confirm。它能直接阻止最危险的“无提示保存坏底稿”路径，同时保持实现小、可测试、可回退。

## Architecture / Data Flow Plan

### Helper layer

新增 `src/lib/draft-diff-guard.ts`：

- 纯函数；
- 复用 `compareDraftText`；
- 不 import store / React；
- 输出结构化 `DraftDiffGuardResult`；
- 独立格式化中文警告文案，便于测试。

建议导出：

```ts
detectDraftEditIntent(instruction: string): DraftDiffGuardIntent
evaluateDraftDiffGuard(input: {
  parentContent: string
  candidateContent: string
  instruction: string
}): DraftDiffGuardResult
formatDraftDiffGuardWarning(result: DraftDiffGuardResult, instruction: string): string
```

### Store / state layer

原则上 **不新增 store 状态**。

原因：

- guard 是保存动作前的一次性判断；
- 不需要持久化；
- 不需要影响 draft-store schema；
- 确认后继续走现有 `createDraftFromMessage(... { derivation, forceNew: true })`。

如实现发现需要读取父底稿：在 `SetAsDraftButton` 中用 `useDraftStore((s) => s.drafts)` 找到 `draftContext.draftId` 即可。

### Frontend interaction layer

修改 `src/components/chat/chat-message.tsx`：

1. 普通 assistant 回复：保持原“设为底稿”。
2. draft-processing assistant 回复：点击“保存为新底稿”时：
   - 找父底稿；
   - 若父底稿不存在，保持现有保存流程，避免阻塞旧会话；
   - 调用 `evaluateDraftDiffGuard`；
   - `shouldWarn=false`：直接保存；
   - `shouldWarn=true`：`window.confirm(formatDraftDiffGuardWarning(...))`；
   - 用户取消：return；
   - 用户确认：保存。

所有新增用户可见文案：

- 主文案写入 `zh.json` 或由 helper 返回简体中文；
- 如 helper 返回 reasons，reasons 必须是中文；
- `en.json` 仅为 parity，不作为中文 UI 的替代。

## Scope boundaries

本阶段做：

- 局部修改意图识别；
- 行级变化风险判断；
- 保存前简体中文风险提示；
- 强制保存确认；
- 相关单元/回归测试。

本阶段不做：

- 完整 diff viewer；
- LLM semantic guard；
- 自动重试/自动修复；
- 模板、模板报告、导出；
- 输出审计记录；
- 长文工程。

## Acceptance Criteria

1. 普通 Chat 的“设为底稿”无行为变化。
2. draft-processing “保存为新底稿”在保存前执行基础 guard。
3. “只改标题 / 正文不要动 / 不要缩短 / 保留结构”等指令识别为局部修改。
4. 局部修改 + 大幅删改时弹出简体中文确认提示。
5. 提示中展示变化比例、新增行、删除行、未变行、风险原因。
6. 用户取消时不创建新底稿。
7. 用户确认时创建新底稿，保留 derivation，原底稿不覆盖。
8. 非局部修改指令不弹 guard。
9. 大文本超过阈值时提示人工确认，不做昂贵 compare。
10. 新增 helper 无 store/React 依赖。
11. 新增前端可见文案全部为简体中文。

## Verification Steps

```powershell
npx vitest run src/lib/draft-diff-guard.test.ts src/lib/draft-versioning.test.ts src/stores/draft-store.test.ts src/i18n/i18n-parity.test.ts
npm run typecheck
npm run test:mocks
npm run build
```

手动 smoke：

1. 底稿页发起加工：“只改标题，正文不要动”。
2. 在加工会话中对明显缩短结果点击“保存为新底稿”。
3. 看到简体中文风险提示。
4. 取消后没有新底稿。
5. 再确认保存后创建新底稿，原底稿未覆盖。
6. 普通 Chat “设为底稿”不弹风险提示。

## ADR

### Decision

为 Draft v1.3 实现基础 Diff Guard：在 draft-processing 保存为新底稿前，用确定性意图识别和行级 compare 评估风险；高风险时弹出简体中文确认。

### Drivers

- Draft 阶段还缺局部修改保护。
- 当前已有版本 compare helper，适合复用。
- 必须先保护底稿，再进入模板和导出。

### Alternatives considered

- 自定义 Modal：体验更好，但本阶段增加状态和测试复杂度。
- LLM 审查：更智能，但成本、延迟和失败模式过高。
- 完整 diff viewer：价值高，但超出 v1.3 最小闭环。

### Why chosen

Option A 用最少代码覆盖最危险路径：用户把 AI 加工结果保存成新底稿之前，至少能看到“可能改坏了”的中文风险提示，并保留取消机会。

### Consequences

- 可能误报，但不阻断。
- 暂时没有漂亮 diff UI。
- 后续可在同一 helper 之上升级为 Modal、局部 diff viewer 或 LLM guard。

### Follow-ups

- Draft v1.4：导出前确认 draft version。
- Template Library / Current Template Binding。
- Template-aware Generation + Match Report。
- Formal Export Pipeline。

## Consensus Review Results

本轮未启动子代理；依据用户最新约束和既有迁移计划进行本地 RALPLAN-DR 自审。

### Architect self-review

Verdict: APPROVE.

理由：方案保持纯 helper 边界，不改变持久化 schema，不污染普通 Chat；触发点只在 draft-processing 保存路径，符合低风险原则。建议实现时避免在 helper 中读取 store，避免循环依赖。

### Critic self-review

Verdict: APPROVE WITH WATCHPOINTS.

Watchpoints:

- 阈值必须测试锁定，不要实现时随意扩大。
- 中文文案必须进测试，避免后续英文 fallback 泄漏到前端。
- 父底稿缺失时不要阻塞旧会话保存，但应不弹 guard。

## Available-Agent-Types Roster

Available roles: `explore`, `planner`, `architect`, `critic`, `executor`, `debugger`, `test-engineer`, `verifier`, `code-reviewer`, `reviewer`, `build-engineer`, `writer`.

## Follow-up Staffing Guidance

### `$ralph` sequential lane（推荐）

- `executor`：实现 `draft-diff-guard` helper、接入 `chat-message.tsx` 保存入口、补 i18n 文案。
- `test-engineer`：补 helper 单测、中文文案测试、保存取消/确认行为可测拆分。
- `verifier`：跑 targeted vitest、typecheck、test:mocks、build，并做桌面 smoke。

Launch hint:

```text
$ralph execute .omx/plans/draft-v13-basic-diff-guard-ralplan.md
```

### `$team` parallel lane

仅当要加速时使用：

- Worker 1：helper + helper tests。
- Worker 2：chat-message 保存入口 + i18n。
- Verifier：整体验收和回归。

Launch hint:

```text
$team implement .omx/plans/draft-v13-basic-diff-guard-ralplan.md with 2 workers plus verifier
```

Team verification path:

1. 每个 worker 限定写入范围。
2. verifier 跑 targeted tests、typecheck、test:mocks、build。
3. leader 手动检查中文提示、取消不保存、确认保存、普通 Chat 不弹窗。

## Goal-Mode Follow-up Suggestions

- `$ultragoal`：适合把 Draft v1.3 → 导出前版本确认 → 模板库拆为连续目标。
- `$autoresearch-goal`：不适用，本任务不是外部研究。
- `$performance-goal`：不适用，本任务不是性能优化。
