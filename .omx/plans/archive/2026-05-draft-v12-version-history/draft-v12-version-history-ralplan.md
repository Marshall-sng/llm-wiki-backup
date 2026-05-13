# RALPLAN: Draft v1.2「底稿版本历史 + 基础对比」

Status: Final approved ralplan artifact  
Context snapshot: `.omx/context/draft-v12-version-history-20260512T125938Z.md`  
PRD: see `prd-draft-v12-version-history-*.md`  
Test spec: see `test-spec-draft-v12-version-history-*.md`

## Goal

在 Draft v1.1「底稿 AI 加工会话」之后，继续迁移最低风险、最高收益的底稿底座能力：为底稿增加**手动版本快照、基础对比、恢复为新底稿**。本阶段不做完整 diff guard、不做模板、不做导出。

## RALPLAN-DR Summary

### Principles

1. **非破坏式默认**：恢复历史版本必须创建新底稿，绝不覆盖当前底稿。
2. **显式用户动作**：只做手动快照，不在 textarea 每次编辑或 blur 时自动生成版本。
3. **持久化兼容**：旧 drafts JSON 可加载；运行时版本字段统一规范化。
4. **最小 UI 面**：只提供版本历史、基础对比、只读预览、恢复为新底稿，不进入完整 diff guard。
5. **来源语义清晰**：历史恢复来源独立于 AI 加工 derivation，也不伪装成新的 assistant 回复。

### Decision Drivers

1. 降低用户直接编辑底稿时误删/误改后无法回退的风险。
2. 为后续 diff guard、模板输出、导出前版本确认打基础。
3. 避免扩展到模板、导出、长文工程等高风险范围。

### Viable Options

#### Option A — 在 DraftRecord 内嵌可选 versions（推荐）

做法：给 DraftRecord 增加运行时 `versions: DraftVersion[]`，旧数据缺失时 normalize 为 `[]`。所有版本随 `.llm-wiki/drafts.json` 现有 envelope 保存。

优点：改动最小；无需新增持久化文件/自动保存订阅；最适合当前单用户桌面端。  
缺点：长文或大量快照会让 drafts.json 变大；后续可能需要迁移到独立版本文件。

#### Option B — 独立 `draft-versions.json`

优点：长期边界更清晰，方便 retention/export。  
缺点：需要新增加载/保存/生命周期/一致性处理，本阶段风险过高。

#### Option C — 编辑时自动快照

优点：用户无需记得手动保存版本。  
缺点：当前 DraftsView 用 textarea onChange 直接 updateDraft，自动快照会造成版本噪音、autosave 压力和不稳定 UX。

### Recommended Option

选择 **Option A**，并明确为 v1.2 的有界设计：手动快照、恢复为新底稿、基础对比、运行时 normalize。后续如果长文/导出导致文件膨胀，再迁移到独立版本存储。

## Data Model Plan

文件：`src/stores/draft-store.ts`

新增：

```ts
export type DraftVersionReason = "manual-snapshot" | "restore" | "ai-processing"

export interface DraftVersion {
  id: string
  title: string
  content: string
  references: MessageReference[]
  contentHash: string
  createdAt: number
  reason: DraftVersionReason
  parentDraftId?: string
  parentVersionId?: string
  note?: string
}

export interface DraftRestorationMeta {
  parentDraftId: string
  parentDraftTitle: string
  parentVersionId: string
  parentContentHash: string
  restoredAt: number
}
```

`DraftRecord` 增加：

```ts
versions: DraftVersion[]
restoration?: DraftRestorationMeta
```

兼容要求：原始持久化对象可缺少 `versions` / `restoration`；`normalizeDraft` 后运行时 draft 必须暴露 `versions: []`。

## Store/API Plan

新增方法：

```ts
createVersionSnapshot(
  draftId: string,
  options?: { reason?: DraftVersionReason; note?: string }
): DraftVersion | null

restoreVersionAsDraft(draftId: string, versionId: string): DraftRecord | null
```

语义：

- `createVersionSnapshot` 深拷贝当前 title/content/references/contentHash。
- 快照 newest-first 存入 `draft.versions`。
- 创建快照会更新父 draft `updatedAt`，并将 `lastChange.persist` 设为 `immediate`。
- `updateDraft` 不自动创建快照。
- `restoreVersionAsDraft` 必须直接构造新 DraftRecord，不调用 `createDraftFromMessage`。
- 恢复出的新 Draft：
  - 内容完全等于历史版本内容；
  - references 深拷贝；
  - source 复制父 draft source，但重新计算 restored contentHash；
  - 增加 `restoration` 元数据；
  - `versions: []`；
  - 自动选中新 Draft；
  - `lastChange.persist = "immediate"`。

## Helper / Compare Plan

新增：`src/lib/draft-versioning.ts`

必须保持纯函数，不能 import `draft-store.ts`，避免循环依赖。`buildDraftVersion` 由 store 传入 `contentHash`。

```ts
buildDraftVersion(input: {
  draftId: string
  title: string
  content: string
  references: MessageReference[]
  contentHash: string
  reason: DraftVersionReason
  note?: string
}): DraftVersion

compareDraftText(current: string, version: string, options?: { maxLines?: number }): DraftCompareResult
```

基础对比语义：

- 使用 exact-line LCS。
- `unchangedLines = LCS length`
- `addedLines = currentLines.length - unchangedLines`
- `removedLines = versionLines.length - unchangedLines`
- `changedRatio = (addedLines + removedLines) / Math.max(currentLines.length, versionLines.length, 1)`
- 如果 current + version 总行数超过阈值（建议 2000 行），跳过 LCS，返回 `tooLarge: true` 和总行数，用中文提示“内容过长，已跳过详细对比”。

## UI Plan

文件：`src/components/drafts/drafts-view.tsx`

右侧栏新增「版本历史」区：

- 按钮：「创建版本快照」
- 版本列表：newest-first，显示时间、reason、hash
- 点击版本后显示：
  - 基础对比统计：新增行、删除行、未变行、变化比例
  - 如果过大，显示跳过详细对比提示
  - 历史版本只读预览
- 操作：「恢复为新底稿」

来源区新增恢复来源优先显示：

- 如果 `draft.restoration` 存在，显示「由历史版本恢复生成」
- 显示父底稿标题、父版本 id/hash、恢复时间
- 不把恢复结果只显示为“来自助手回复”

保留现有 AI 加工区，不改变 Chat/Draft v1.1 流程。

## Acceptance Criteria

1. 旧 drafts JSON 可加载，运行时 draft 有 `versions: []`。
2. 点击「创建版本快照」后，当前底稿出现一个不可变版本快照。
3. 快照包含 title/content/references/contentHash/createdAt/reason。
4. 快照创建后父 draft `updatedAt` 更新，autosave 立即持久化。
5. 直接编辑 Draft 不会自动生成版本。
6. 选择历史版本可看到基础对比统计。
7. 超过阈值的大文本不会卡 UI，会显示跳过详细对比提示。
8. 点击「恢复为新底稿」会创建一份新 Draft，不覆盖当前 Draft。
9. 恢复出的 Draft 内容精确等于历史版本内容，不经过 clean/dedupe/message 伪造路径。
10. 恢复出的 Draft 显示「由历史版本恢复生成」及父版本信息。
11. AI 加工、保存为新底稿、普通 Chat 行为不变。
12. 不新增模板、导出、完整 diff guard、长文工程能力。

## Risks and Mitigations

- Risk: drafts.json 因内嵌 versions 变大。  
  Mitigation: v1.2 只手动快照；后续如果需要再迁移独立版本文件。

- Risk: LCS 对长文造成 UI 卡顿。  
  Mitigation: useMemo + line count threshold，超限跳过详细对比。

- Risk: 恢复来源被误显示为 Chat assistant。  
  Mitigation: 独立 `restoration` 元数据，UI 恢复来源优先。

- Risk: normalization 丢失新字段。  
  Mitigation: `normalizeDraft` 显式 normalize versions/restoration；增加 hydration tests。

- Risk: 循环依赖。  
  Mitigation: `draft-versioning.ts` 不 import store；hash 由 store 传入。

## Verification Steps

```powershell
npx vitest run src/lib/draft-versioning.test.ts src/stores/draft-store.test.ts src/i18n/i18n-parity.test.ts
npm run typecheck
npm run test:mocks
npm run build
```

建议桌面手动 smoke：创建底稿 → 创建快照 → 编辑底稿 → 查看对比 → 恢复为新底稿 → 确认原底稿未覆盖且来源显示正确。

## ADR

### Decision

为 Draft v1.2 实现内嵌版本历史与基础对比，采用手动快照 + 恢复为新底稿，不做自动快照、不做完整 diff guard。

### Drivers

- 直接编辑底稿仍可能破坏内容且无回退点。
- 版本历史是后续 diff guard、模板输出、导出前确认的基础。
- 当前阶段必须保持低风险和小范围。

### Alternatives considered

- 独立版本文件：长期更清晰，但本阶段新增生命周期复杂度。
- 自动快照：更省心，但 textarea onChange 下会产生版本噪音。
- 完整 diff guard：价值高，但需要章节/意图识别，风险过大。

### Why chosen

内嵌手动版本快照复用现有 store/persistence/autosave，能快速给用户回退点和基本对比，同时不污染 Chat、模板或导出边界。

### Consequences

- DraftRecord schema 增加 versions/restoration。
- drafts.json 可能随手动快照增大。
- UI 增加版本历史区。
- 后续如进入长文/导出，可迁移为独立版本存储。

### Follow-ups

- Draft v1.3：局部修改 diff guard。
- Template Library。
- Template-aware Generation。
- Export pipeline with draft version confirmation。

## Consensus Review Results

### Architect Review

Initial verdict: APPROVE WITH REQUIRED IMPROVEMENTS. Required: normalize versions, define restoration provenance, immediate persistence markers, lock LCS compare semantics, deep-copy references.

Second verdict: APPROVE WITH REQUIRED IMPROVEMENTS. Required: avoid helper/store dependency cycles, enforce runtime `versions: []`, memoize/cap UI compare.

All Architect requirements applied.

### Critic Review

Initial verdict: ITERATE. Required: explicit restored source semantics, direct restore construction, snapshot updatedAt behavior, tighter normalization, provenance UI/test acceptance.

Final verdict: APPROVE. No blocking issues. Plan is actionable and aligned with low-risk/high-benefit scope.

## Available-Agent-Types Roster

Available roles: `explore`, `planner`, `architect`, `critic`, `executor`, `debugger`, `test-engineer`, `verifier`, `code-reviewer`, `reviewer`, `build-engineer`, `writer`.

## Follow-up Staffing Guidance

### `$ralph` sequential lane（推荐）

- `executor`：实现 draft-versioning helper、draft-store model/API、DraftsView UI、i18n。
- `test-engineer`：补 helper/store/i18n tests。
- `verifier`：跑 targeted vitest、typecheck、test:mocks、build，并核验验收标准。

Launch hint:

```text
$ralph execute .omx/plans/draft-v12-version-history-ralplan.md
```

### `$team` parallel lane

仅当要加速时使用：

- Worker 1：draft-store model/API + normalization。
- Worker 2：draft-versioning helper + tests。
- Worker 3：DraftsView UI + i18n。
- Verifier：整体验收和回归。

Launch hint:

```text
$team implement .omx/plans/draft-v12-version-history-ralplan.md with 3 workers plus verifier
```

Team verification path:
1. 每个 worker 限定写入范围。
2. verifier 跑 targeted tests、typecheck、test:mocks、build。
3. leader 检查恢复来源、版本恢复不覆盖、普通 Chat 不变。

## Goal-Mode Follow-up Suggestions

- `$ultragoal`：适合把 Draft v1.2 → v1.3 diff guard → 模板库拆成连续目标。
- `$autoresearch-goal`：不适用，本任务不是外部研究。
- `$performance-goal`：不适用，本任务不是性能优化。
