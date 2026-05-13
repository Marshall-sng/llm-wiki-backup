# Test Spec: Draft v1.1「底稿 AI 加工会话」

## Unit tests

1. `src/lib/draft-processing.test.ts`
   - `buildDraftProcessingPrompt` 输出包含：修改要求、底稿标题、底稿内容、references、非覆盖约束、完整修订稿要求。
   - 空 references 时仍生成有效 prompt。
   - prompt 文案为中文。

2. `src/stores/chat-store.test.ts` 或新增测试
   - `createConversation()` 保持旧默认行为：kind 缺省为 normal 或 undefined，不破坏现有调用。
   - `createConversation({ title, kind: "draft-processing", draftContext })` 写入元数据并设为 active。
   - pending draft processing request 只能 consume 一次，避免重复自动发送。
   - 旧 conversations JSON 缺少 kind/draftContext 时可作为普通会话使用。

3. `src/stores/draft-store.test.ts`
   - `createDraftFromMessage(message, { derivation })` 创建的新 Draft 包含 parentDraftId、instruction、processingConversationId、parentContentHash。
   - `createDraftFromMessage(message, { derivation, forceNew: true })` 即使内容 hash 与父底稿或已有底稿相同，也必须创建新 Draft。
   - 原有 `createDraftFromMessage(message)` 行为不变，旧测试继续通过。
   - 相同 message/hash 去重逻辑不误删 derivation 场景的可追溯信息。

## Integration-ish tests

4. `src/lib/draft-processing-flow.test.ts`（如拆出 helper）
   - `startDraftProcessing(draft, instruction)` 创建加工会话、设置 pending request、切换 active conversation。
   - 对空 instruction 做 trim/禁用策略，不能创建空加工请求。
   - pending request 被 ChatPanel 消费一次后清除；重复 render/effect 不会重复发送。
   - pending request 不进入 `saveChatHistory` 保存数据。

5. i18n parity
   - `src/i18n/i18n-parity.test.ts` 通过。
   - 新增 keys 在 zh/en 中均存在；实际中文 UI 以 zh 文案为准。

## Manual smoke

1. 启动应用，打开项目。
2. 从 assistant reply 点击「设为底稿」。
3. 进入「底稿」，选择底稿，输入「只改风险提醒部分，正文不要缩短」。
4. 点击「新建加工会话」。
5. 验证 Chat 侧显示「底稿加工会话」提示条，且会话标题为「加工：...」。
6. 验证 AI 输出后原底稿内容未变化。
7. 点击「保存为新底稿」，返回底稿页，看到新底稿与来源/父底稿信息。
8. 新建普通 Chat，验证不显示底稿加工提示条，不携带底稿上下文。

## Verification commands

```powershell
npm run typecheck
npx vitest run src/stores/draft-store.test.ts src/lib/draft-persist.test.ts src/i18n/i18n-parity.test.ts
npx vitest run src/lib/draft-processing.test.ts
npm run test:mocks
npm run build
```
