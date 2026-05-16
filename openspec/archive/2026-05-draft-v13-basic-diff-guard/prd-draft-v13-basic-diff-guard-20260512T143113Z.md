# PRD: Draft v1.3 基础 Diff Guard / 保存前风险提示

Status: Draft for approval
Context snapshot: `.omx/context/draft-v13-basic-diff-guard-20260512T143113Z.md`

## 1. 背景

Draft v1.0 已支持将助手回复设为底稿；Draft v1.1 已将底稿 AI 加工隔离到专用 Chat 会话；Draft v1.2 已加入手动版本历史、基础对比和恢复为新底稿。迁移计划中 Draft 阶段仍缺“局部修改保护 / diff guard”。

`pkm-tool` 的关键失败之一是：用户要求“只改标题”“只改风险提醒”“正文不要动”时，AI 结果可能悄悄缩短、删除或大范围改写原底稿。若没有保存前风险提示，后续模板和导出会把坏底稿正式化。

## 2. 目标

为底稿 AI 加工结果增加一个低风险、可解释、非阻断的基础 Diff Guard：当用户在 draft-processing 会话中点击“保存为新底稿”时，系统对比父底稿与助手回复；如果加工指令表达了局部修改/保留正文/不要缩短等约束，而结果变化过大，则用简体中文提示风险，并允许用户确认后继续保存为新底稿。

## 3. 非目标

- 不做完整 diff viewer。
- 不做逐段高亮。
- 不做 LLM 语义审查。
- 不做自动修复或自动重写。
- 不做模板库、模板匹配、导出、DOCX/PDF。
- 不改变普通 Chat 默认行为。
- 不覆盖原底稿。
- 不新增复杂任务中心或持久化审计记录。

## 4. 用户故事

1. 作为用户，我在底稿页输入“只修改风险提醒，正文不要缩短”，系统生成一个加工会话。
2. AI 返回新稿后，我点击“保存为新底稿”。
3. 如果新稿比原稿删改很多，系统用简体中文提示：“本次结果可能改动过大”。
4. 我能看到变化比例、新增/删除/未变行数，以及原始加工要求。
5. 我可以取消保存，回到 Chat 继续要求 AI 修改。
6. 我也可以确认“仍然保存为新底稿”。确认后仍走现有 createDraftFromMessage non-destructive 路径。

## 5. 功能范围

### 5.1 后端/数据层逻辑（前端本地 store/lib 层）

新增纯 helper，建议文件：`src/lib/draft-diff-guard.ts`。

建议类型：

```ts
export type DraftDiffGuardIntent = "local-edit" | "general-edit"
export type DraftDiffGuardSeverity = "none" | "warning"

export interface DraftDiffGuardResult {
  intent: DraftDiffGuardIntent
  severity: DraftDiffGuardSeverity
  shouldWarn: boolean
  reasons: string[]
  comparison: DraftCompareResult
}
```

职责：

- `detectDraftEditIntent(instruction: string): DraftDiffGuardIntent`
  - 用确定性关键词识别“局部修改/保留/不要缩短”类指令。
  - 中文为主，兼容少量英文关键词即可；但前端文案必须简体中文。
- `evaluateDraftDiffGuard(input): DraftDiffGuardResult`
  - 输入：父底稿内容、助手结果内容、加工指令。
  - 内部复用 `compareDraftText`。
  - 对 `tooLarge` 返回 warning，但不做详细 LCS。
  - 不访问 store，不访问 DOM，不调用 LLM。

建议初始阈值：

- 只有 `intent === "local-edit"` 才启用风险提示。
- 若 `comparison.tooLarge === true`：提示“内容较长，已跳过详细对比，请人工确认”。
- 若 `changedRatio >= 0.35`：提示“变化比例较高”。
- 若 `removedLines >= 5 && removedLines > addedLines * 2`：提示“删除行明显多于新增行”。
- 若原稿 `totalVersionLines >= 8` 且结果行数低于原稿 70%：提示“结果可能明显缩短”。

注意：这里的父底稿应作为 version/baseline，助手结果作为 current。复用公式：新增行 = assistant lines - LCS，删除行 = parent lines - LCS。

### 5.2 前端交互逻辑

触发点：`src/components/chat/chat-message.tsx` 的 draft-processing assistant message “保存为新底稿”。

流程：

```text
用户点击“保存为新底稿”
→ 如果不是 draft-processing 会话：保持现有“设为底稿”逻辑
→ 如果是 draft-processing 会话：读取 conversation.draftContext
→ 找到父底稿当前记录（useDraftStore drafts）
→ evaluateDraftDiffGuard(parent.content, assistant.content, instruction)
→ shouldWarn=false：直接保存为新底稿
→ shouldWarn=true：显示简体中文确认 UI
→ 用户取消：不保存
→ 用户确认：保存为新底稿
```

最小 UI 方案（推荐）：使用 `window.confirm`，因为风险最小、无需引入新 dialog 组件状态。

确认文案必须为简体中文，建议包含：

```text
本次 AI 加工结果可能改动过大。

加工要求：{{instruction}}
变化比例：{{ratio}}%
新增行：{{added}}
删除行：{{removed}}
未变行：{{unchanged}}
风险原因：{{reasons}}

如果你只想局部修改，建议取消后让 AI 重新加工。
仍然保存为新底稿吗？
```

后续可升级为自定义 Modal，但 v1.3 不做。

### 5.3 简体中文前端约束

- 新增按钮、提示、风险原因、confirm 文案全部使用简体中文。
- 若项目 i18n parity 要求必须同步 `en.json`，可以添加英文键，但 `zh.json` 是产品验收主文案。
- 不允许新增仅英文 fallback。
- 测试应校验中文关键文案存在，例如“本次 AI 加工结果可能改动过大”“仍然保存为新底稿吗”。

## 6. 验收标准

1. 普通 Chat 的“设为底稿”行为不变。
2. draft-processing 会话的“保存为新底稿”会在保存前执行 guard。
3. 非局部修改指令不会因为变化大而弹警告。
4. 局部修改指令且变化明显过大时，会弹出简体中文风险确认。
5. 用户取消确认时，不创建新底稿。
6. 用户确认后，创建新底稿，且仍保留 derivation 元数据。
7. 原底稿永不被覆盖。
8. 大文本超过 compare 阈值时不做昂贵对比，但会提示人工确认。
9. 新增 helper 不 import React/store，不产生循环依赖。
10. 所有新增前端可见文案为简体中文。

## 7. 风险与缓解

- 误报：基础行级比较可能把合理重组判为风险。缓解：只警告不阻断，用户可确认保存。
- 漏报：关键词规则无法理解所有局部修改表达。缓解：v1.3 只做确定性基础版，后续再扩展。
- 交互打断：confirm 可能打断流程。缓解：只对局部修改意图且高风险时触发。
- UI 文案不一致：必须把新增前端文案放入 i18n 并保持中文主验收。
