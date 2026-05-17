# Proposal: Project Structure Cleanup

## Why

经过 OMX→OpenSpec 迁移和 experiments/→openspec/ 合并后，项目根目录存在大量遗留物：

- **`experiments/`** — 已经空了的目录树
- **`.omx/`** — Codex/oh-my-codex 运行时状态（245 文件），计划已迁至 openspec/
- **根目录 `.docx`** — 4 个未跟踪的中文版式参考素材
- **`tsconfig.*.tmp.tsbuildinfo`** — 4 个过时构建临时产物
- **`openspec/archive/` 部分目录** — 实验文档与 `openspec/experiments/` 代码分离，应合并
- **空目录散落** — 多个 `outputs/` 子目录为空

## Scope

清理范围限于**源仓库的组织结构**，不涉及业务逻辑变更：

1. ✅ 删除遗留目录（`.omx/`, `experiments/`）
2. ✅ 清理构建残留（`*.tmp.tsbuildinfo`）
3. ✅ 合并实验文档（`openspec/archive/` 中与实验相关的 → `openspec/experiments/` 对应子目录）
4. ✅ 归置测试素材（根目录 4 个 .docx → 合理位置）
5. ✅ 清理空目录
6. ⬜ 不涉及 `.tools/`、`node_modules/`、`dist/`、`runtime/`、`.cache/`（均为 gitignored，按需留用）

## Acceptance Criteria

1. `git status` 显示无意外脏文件
2. 所有 `git mv` 操作保持 rename 历史（`git log --follow` 可追溯）
3. 构建命令 `npm run build` 仍可正常执行（如适用）
4. 所有清理项有明确理由，不盲目删除
