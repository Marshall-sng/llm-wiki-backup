# Tasks: Project Structure Cleanup

## Phase 1 — Safety Check & Preparation

- [x] 1.1 检查 `.omx/` 内容，确认无活跃依赖（仅 `metrics.json`, `notepad.md`, `tmux-hook.json` 等 Codex 运行时文件）
- [x] 1.2 确认所有实验计划已存在于 `openspec/`（通过 `git log -- .omx` 和 `git log -- openspec` 核对）
- [x] 1.3 确认 `experiments/` 无跟踪文件残留
- [x] 1.4 创建 `fixtures/docx/` 目录
- [x] 1.5 扫描 archive 合并冲突（发现 2 个同名文件，已重命名）：检查同一目标目录下多个 archive 子目录间是否存在同名文件（如 `prd-test.md`），如有则先重命名

## Phase 2 — Delete Legacy Dirs

- [x] 2.1 删除 `.omx/`（`Remove-Item -Recurse -Force .omx`）
- [x] 2.2 删除 `experiments/` 空目录树
- [x] 2.3 考虑是否从 `.gitignore` 移除 `.omx/` 条目（保留作为安全网）

## Phase 3 — Clean Build Artifacts

- [x] 3.1 删除 `tsconfig.*.tmp.tsbuildinfo`（实际 4 个 + 2 个常规 tsbuildinfo）
- [x] 3.2 删除 `tsconfig.app.tsbuildinfo`
- [x] 3.3 删除 `tsconfig.node.tsbuildinfo`

## Phase 4 — Relocate Test Fixtures

- [x] 4.1 `Move-Item` 根目录 4 个 .docx → `fixtures/docx/`
- [x] 4.2 `git add fixtures/docx/` 跟踪这些素材
- [x] 4.3 无外部引用需更新

## Phase 5 — Merge Experiment Archives

- [x] 5.1 创建 `openspec/experiments/format-profile/archive/` ← 合并 6 个 archive 目录
- [x] 5.2 创建 `openspec/experiments/format-spec/archive/` ← 合并 3 个 archive 目录
- [x] 5.3 创建 `openspec/experiments/editable-format-constraints/archive/` ← 合并 1 个 archive 目录
- [x] 5.4 每个合并使用 `git mv` 保持 rename 历史

## Phase 6 — Clean Empty Output Dirs

- [x] 6.1 清理 `openspec/experiments/format-profile/outputs/` 下空子目录
- [x] 6.2 清理 `openspec/experiments/format-profile-semantic-refinement/outputs/` 下空子目录
- [x] 6.3 清理 `runtime/format-profile/` 下空子目录（共清理 73 个空目录）

## Phase 7 — Verify & Commit

- [x] 7.1 运行 `git status` 确认无意外改动（仅计划内变更，已提交 c984d0d）
- [x] 7.2 运行 `git log --follow` 确认 mv 路径历史可追溯（提交后生效）
- [x] 7.3 `npx tsc --noEmit` 通过
- [x] 7.4 更新 `openspec/README.md` 和 `openspec/archive/README.md`
- [x] 7.5 提交并推送 origin + backup
