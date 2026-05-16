# PRD: Draft v1.1「底稿 AI 加工会话」

## 目标

在当前 Draft v1 基础上补齐最小高价值闭环：用户可以从某份底稿发起 AI 加工，系统默认新建专用 Chat 会话，自动携带底稿内容、修改要求和引用信息；AI 输出不会自动覆盖原底稿，用户确认后保存为新底稿。

## 用户价值

- 用户不需要手动复制底稿全文到 Chat。
- 普通 Chat 不会被底稿加工上下文污染。
- 原底稿不会被 AI 自动覆盖，降低多轮修改损坏风险。
- 形成后续版本历史、diff guard、模板输出的安全基础。

## 范围内

1. Draft 页面新增中文「AI 加工底稿」交互区。
2. 新建专用 Chat 会话，标题形如「加工：{底稿标题}」。
3. Conversation 增加可选 `kind: "normal" | "draft-processing"` 与 `draftContext` 元数据。
4. ChatPanel 对 `draft-processing` 会话显示中文提示条。
5. Draft 加工会话跳过普通 wiki 检索，优先使用底稿内容 + 底稿 references，避免引入无关项目上下文。
6. Assistant 输出在 Draft 加工会话中显示「保存为新底稿」；保存时记录 parent/derivation 元数据。
7. 保持旧 conversations/drafts JSON 向后兼容。
8. 「保存为新底稿」必须强制创建新 Draft，不能被当前 contentHash 去重合并到父底稿或旧底稿。

## 范围外

- 不新增 Rust/Tauri command。
- 不做模板库、DOCX/PDF 导出。
- 不做完整 diff guard/自动局部保护判定。
- 不改 file sync/source lifecycle/ingest/web search。
- 不自动替换当前 Draft。

## 关键中文 UI 文案

- 「AI 加工底稿」
- 「修改要求」
- 「例如：只改风险提醒部分，正文不要缩短；改成正式汇报口吻。」
- 「新建加工会话」
- 「原底稿不会被自动覆盖。AI 结果会先出现在 Chat 中，你确认后再保存为新底稿。」
- 「底稿加工会话」
- 「来源底稿：{title}」
- 「原底稿不会被自动覆盖」
- 「保存为新底稿」

## 主要验收

- 从 Draft 页面点击「新建加工会话」后，active view 切到 Chat/主对话区，并进入新建的 draft-processing conversation。
- 第一条用户消息包含底稿内容、修改要求、保护约束和 references 列表。
- 普通 conversation 不包含 `draftContext`，不显示加工提示条。
- Draft-processing conversation 的 LLM system prompt 不运行普通 wiki retrieval，不把无关 wiki pages 注入加工上下文。
- AI 输出后原 Draft 内容保持不变。
- 点击「保存为新底稿」会创建新 Draft，且新 Draft 可记录 parentDraftId/source hash/instruction/conversationId。
- pending 加工请求只在运行时存在，消费一次后清除，刷新页面不会重复自动发送。
