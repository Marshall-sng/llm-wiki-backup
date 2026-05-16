# Test Spec: Draft v1.3 基础 Diff Guard

Status: Draft for approval
PRD: `.omx/plans/prd-draft-v13-basic-diff-guard-20260512T143113Z.md`

## 1. Helper 单元测试

建议新增：`src/lib/draft-diff-guard.test.ts`

覆盖：

1. `detectDraftEditIntent`：
   - “只改标题” → `local-edit`
   - “只修改风险提醒，正文不要动” → `local-edit`
   - “不要缩短正文” → `local-edit`
   - “保留原结构” → `local-edit`
   - “改成正式汇报口吻” → `general-edit`
   - 空指令 → `general-edit`
2. `evaluateDraftDiffGuard`：
   - general-edit 即使变化比例高，也 `shouldWarn=false`。
   - local-edit + 小幅变化，`shouldWarn=false`。
   - local-edit + `changedRatio >= 0.35`，`shouldWarn=true`。
   - local-edit + 删除行明显多于新增行，`shouldWarn=true`。
   - local-edit + 结果明显缩短，`shouldWarn=true`。
   - tooLarge 时不跑详细 LCS，`shouldWarn=true` 且 reason 包含长文本人工确认语义。
3. 原始 `compareDraftText` 语义不回归。

## 2. Store/数据流测试

优先不改 store。若实现不改 store，则无需新增 store API 测试，只需确保现有 Draft store 测试仍通过。

必须回归：

- `src/stores/draft-store.test.ts`
  - AI 加工保存为新底稿 derivation 不变。
  - 原底稿不覆盖。
  - version history 不受影响。

## 3. Chat 组件交互测试

如果当前测试工具链不方便直接测 React confirm，可采用最小可测拆分：

- 把确认文案构造抽成纯函数，例如 `formatDraftDiffGuardWarning(result, instruction)`。
- 单测验证文案为简体中文，包含：
  - “本次 AI 加工结果可能改动过大”
  - “变化比例”
  - “新增行”
  - “删除行”
  - “未变行”
  - “仍然保存为新底稿吗”

若已有组件测试能力可用，则再覆盖：

1. 普通 assistant message 点击“设为底稿”不调用 confirm。
2. draft-processing assistant message + shouldWarn=false 直接保存。
3. shouldWarn=true + confirm=false 不保存。
4. shouldWarn=true + confirm=true 保存为新底稿。

## 4. i18n 测试

运行：`src/i18n/i18n-parity.test.ts`

要求：

- 新增 `chat.*` 或 `drafts.*` 文案键同时存在于 `zh.json` 和 `en.json`。
- 中文键值必须是简体中文，不允许英文 fallback。

## 5. 验证命令

```powershell
npx vitest run src/lib/draft-diff-guard.test.ts src/lib/draft-versioning.test.ts src/stores/draft-store.test.ts src/i18n/i18n-parity.test.ts
npm run typecheck
npm run test:mocks
npm run build
```

## 6. 手动测试

1. 启动桌面端。
2. 创建或选择一份底稿。
3. 发起 AI 加工，指令输入：“只改标题，正文不要动”。
4. 在加工会话里得到一条明显缩短的助手回复。
5. 点击“保存为新底稿”。
6. 确认弹出简体中文风险提示。
7. 点击取消，确认没有新底稿。
8. 再次点击并确认保存，确认创建新底稿且原底稿未覆盖。
9. 用普通 Chat 回复测试“设为底稿”，确认不弹 diff guard。
