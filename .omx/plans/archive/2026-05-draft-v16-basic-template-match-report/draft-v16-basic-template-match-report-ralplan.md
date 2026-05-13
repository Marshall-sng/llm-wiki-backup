# RALPLAN: Draft v1.6 基础模板匹配报告

Status: Autonomous execution plan
Date: 2026-05-13

## Goal

在 v1.4 模板库与 v1.5 当前模板参与底稿加工之后，新增低风险、高收益的只读模板匹配报告：对当前底稿和当前模板做基础静态检查，让用户知道必备章节、章节顺序、引用线索、长度/语气人工确认项是否满足。该阶段不阻断保存、不调用 LLM、不导出文件。

## Scope

做：
- 新增 `src/lib/template-match.ts`：确定性、无副作用的基础匹配报告。
- 检查：必备章节是否出现、章节顺序是否基本符合、引用规则是否有引用线索、长度/语气是否需人工确认。
- 底稿页面在存在当前模板时展示“基础模板匹配报告”。
- 新增单元测试和 i18n parity。

不做：
- 不做 LLM 语义评分。
- 不做阻断式 guard。
- 不做导出。
- 不做模板自动修复。
- 不改变 Chat 或底稿加工 prompt。

## Acceptance Criteria

1. 当前底稿存在且选择当前模板时，底稿侧栏显示基础模板匹配报告。
2. 缺失必备章节会显示缺失项。
3. 章节顺序错误会显示提醒。
4. 有引用规则但缺少引用线索会显示提醒。
5. 长度/语气规则显示为需人工确认，不假装已自动判定。
6. 未选择模板时不显示误导性报告。
7. 所有新增前端文案为简体中文，英文 parity 通过。

## Verification

- `npx vitest run src/lib/template-match.test.ts src/i18n/i18n-parity.test.ts`
- `npm run typecheck`
- `npm run build`
- `npm run test:mocks`
- 桌面 smoke：启动 Tauri，注入/创建底稿与模板，确认底稿页显示基础模板匹配报告，并能看到缺失/通过/人工确认项。

## Risk Controls

- 纯函数静态检查；不读写文件、不调用模型。
- 只读展示，不阻断保存或加工。
- 一个阶段一个 commit。

## Execution Evidence

Completed: 2026-05-13

Automated verification:
- `npx vitest run src/lib/template-match.test.ts src/i18n/i18n-parity.test.ts` → 2 files / 7 tests passed.
- `npm run typecheck` → passed.
- `npm run build` → passed; only existing Vite/Rust warnings.
- `npm run test:mocks` → encountered the known ingest-queue integration race twice; targeted failing case passed; final full rerun passed 83 files / 1126 tests.

Desktop / UI smoke:
- Clean Tauri dev launch: one `LLM Wiki` window; Vite ports 1420/1421 and clip server 19827 listening.
- Log: `runtime/logs/tauri-dev-v16-smoke-20260513-011432.log`.
- Browser automation against the same Tauri dev frontend verified: Drafts page displays `基础模板匹配报告`; report shows current template, summary counts, missing/warning/manual items, and non-blocking hint.
- UI evidence screenshots: `runtime/logs/browser-v16-template-match-report.png`, `runtime/logs/browser-v16-template-match-report-fixed.png`.

Known verification boundary:
- Report is intentionally static and conservative; it does not judge semantic tone/length compliance or block export/save.
