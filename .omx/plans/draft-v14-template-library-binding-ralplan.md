# RALPLAN: Draft v1.4 模板库与当前模板绑定

Status: Autonomous execution plan
Date: 2026-05-13

## Goal

在 Draft v1.1-v1.3 已形成底稿、加工、版本、基础 Diff Guard 后，新增风险最低的模板基础设施：项目级模板库与当前模板绑定。该阶段只建立模板资产和可见状态，不让模板自动影响普通 Chat 生成。

## Scope

做：
- 项目级模板库持久化：`{project}/.llm-wiki/templates.json`。
- 新增模板 store：创建、编辑、删除、选择当前模板、清除当前模板。
- 新增模板页面：模板列表 + 表单编辑，前端文案为简体中文。
- 左侧导航新增“模板”。
- Chat 顶部显示当前模板状态，并可清除。
- 项目切换时 silent 清空/加载模板，避免串项目。
- 自动保存：创建/删除/选择立即保存；编辑 debounce 保存。
- 单元测试、i18n parity、typecheck、build、桌面 smoke。

不做：
- 不做模板感知生成。
- 不做模板匹配报告。
- 不做 DOCX/PDF/Markdown 导出。
- 不做长文工程。
- 不让普通 Chat 默认行为被模板污染。

## Data Model

`TemplateRecord`：
- `id`
- `title`
- `description`
- `intent`
- `requiredSections: string[]`
- `sectionOrder: string[]`
- `tone`
- `lengthLimit`
- `citationPolicy`
- `createdAt`
- `updatedAt`

Envelope：
```json
{ "version": 1, "templates": [], "activeTemplateId": null }
```

## Acceptance Criteria

1. 可以创建模板。
2. 可以编辑模板字段。
3. 可以删除模板；删除当前模板会自动清除当前模板。
4. 可以选择当前模板。
5. 可以清除当前模板。
6. 模板和当前模板状态保存到项目 `.llm-wiki/templates.json`。
7. 重启/重新打开项目后模板仍在。
8. 切换项目不会显示上一项目模板。
9. Chat 区能显示当前模板状态，但不修改发送 prompt。
10. 所有新增前端文案为简体中文。

## Verification

- `npx vitest run src/stores/template-store.test.ts src/lib/template-persist.test.ts src/i18n/i18n-parity.test.ts`
- `npm run typecheck`
- `npm run build`
- 桌面 smoke：启动 Tauri，创建模板、选择当前模板、在 Chat 顶部看到状态、清除模板、刷新/重启后状态持久。

## Risk Controls

- 只新增 project-scoped store，不改 Chat send system prompt。
- reset project state silent clear；autosave timer 捕获 project path。
- 无新依赖。
- 一个阶段一个 commit。

## Execution Evidence

Completed: 2026-05-13

Automated verification:
- `npx vitest run src/stores/template-store.test.ts src/lib/template-persist.test.ts src/i18n/i18n-parity.test.ts` → 3 files / 13 tests passed.
- `npm run typecheck` → passed.
- `npm run build` → passed; only existing Vite/Rust warnings.
- `npm run test:mocks` → first run hit a known flaky ingest-queue JSON read; targeted rerun passed; full rerun passed 82 files / 1120 tests.

Desktop / UI smoke:
- Clean Tauri dev launch: one `LLM Wiki` window; Vite ports 1420/1421 and clip server 19827 listening.
- Log: `runtime/logs/tauri-dev-v14-smoke-20260513-003926.log`.
- Window screenshot: `runtime/logs/tauri-v14-smoke-before.png`.
- Browser automation against the same Tauri dev frontend verified: Templates view renders in Simplified Chinese, new template can be created, title/sections can be edited, current template can be set, and Chat shows `当前模板：测试模板` with `清除模板` action.
- UI evidence screenshot: `runtime/logs/browser-v14-template-chat-banner.png`.

Known verification boundary:
- Direct coordinate clicking inside the Tauri WebView was unreliable under Windows DPI scaling, so the interaction path used `agent-browser` against the same dev frontend after confirming the Tauri desktop shell and local services were running.
