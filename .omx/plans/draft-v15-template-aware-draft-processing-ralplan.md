# RALPLAN: Draft v1.5 当前模板参与底稿加工

Status: Autonomous execution plan
Date: 2026-05-13

## Goal

在 v1.4 已有项目级模板库与当前模板绑定后，新增最小可用的模板参与生成路径：仅在用户进入“底稿 AI 加工”时，把当前模板作为显式约束注入该专用加工会话。普通 Chat 仍保持原样，不做模板匹配报告、不做导出、不做长文工程。

## Scope

做：
- 为底稿加工上下文保存 `templateSnapshot`，捕获当前模板的关键字段，避免模板后续编辑影响已创建会话。
- `buildDraftProcessingPrompt` / `buildDraftProcessingSystemPrompt` 在存在模板快照时追加模板约束。
- 底稿页面 AI 加工区显示当前模板状态：有模板时说明本次加工会使用模板；无模板时说明将按普通底稿加工。
- Chat 的底稿加工横幅显示“使用模板：xxx”。
- 从加工结果保存为新底稿时，在 derivation 中记录使用的模板 id/title。
- 新增/更新单元测试与 i18n parity。

不做：
- 不改变普通 Chat 检索或系统提示词。
- 不做模板匹配报告。
- 不做 DOCX/PDF/Markdown 导出。
- 不做完整模板 guard 或阻断式检查。
- 不把模板自动应用到未进入底稿加工的会话。

## Acceptance Criteria

1. 未选择当前模板时，底稿加工 prompt 与 v1.4 行为兼容。
2. 已选择当前模板时，新建底稿加工会话携带模板快照。
3. 模板快照包含标题、目标、必备章节、章节顺序、语气、长度、引用规则等字段。
4. prompt 明确要求遵循模板，但仍保留“不覆盖原底稿、输出完整修订稿”的保护规则。
5. Chat 横幅能显示本次加工使用的模板。
6. 普通 Chat 发送路径不引用模板 store，不把模板注入普通 system prompt。
7. 前端新增文案均为简体中文，并保持英文 i18n parity。

## Verification

- `npx vitest run src/lib/draft-processing.test.ts src/stores/chat-store.test.ts src/stores/draft-store.test.ts src/i18n/i18n-parity.test.ts`
- `npm run typecheck`
- `npm run build`
- `npm run test:mocks`
- 桌面 smoke：启动 Tauri，确认模板库可设置当前模板；进入底稿页发起 AI 加工，Chat 横幅显示使用模板；不选模板时仍能普通加工。

## Risk Controls

- 只改 draft-processing 专用路径，不动普通 Chat generation 分支。
- 使用模板快照而非运行时读取，保证会话可审计、可复现。
- 无新依赖。
- 一个阶段一个 commit。

## Execution Evidence

Completed: 2026-05-13

Automated verification:
- `npx vitest run src/lib/draft-processing.test.ts src/stores/chat-store.test.ts src/stores/draft-store.test.ts src/i18n/i18n-parity.test.ts` → 4 files / 29 tests passed.
- `npm run typecheck` → passed.
- `npm run build` → passed; only existing Vite/Rust warnings.
- `npm run test:mocks` → 82 files / 1123 tests passed.
- Post-copy adjustment: `npx vitest run src/i18n/i18n-parity.test.ts` → passed.

Desktop / UI smoke:
- Clean Tauri dev launch: one `LLM Wiki` window; Vite ports 1420/1421 and clip server 19827 listening.
- Log: `runtime/logs/tauri-dev-v15-smoke-20260513-010349.log`.
- Browser automation against the same Tauri dev frontend verified: active template `烟测模板` appears in Drafts AI processing; clicking `按模板新建加工会话` creates a draft-processing conversation; Chat banner displays `使用模板：烟测模板`; generated user prompt contains `## 当前模板约束` with required sections, section order, tone, and citation rule.
- UI evidence screenshot: `runtime/logs/browser-v15-template-processing-banner.png`.

Known verification boundary:
- LLM call intentionally failed in smoke because no real API key/network configuration was used; the tested contract is prompt/context construction and visible template binding, not model quality.
