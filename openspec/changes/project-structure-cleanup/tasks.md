# Tasks: Project Structure Cleanup

## Phase 1 — Safety Check & Preparation

- [ ] 1.1 检查 `.omx/` 内容，确认无活跃依赖（仅 `metrics.json`, `notepad.md`, `tmux-hook.json` 等 Codex 运行时文件）
- [ ] 1.2 确认所有实验计划已存在于 `openspec/`（通过 `git log -- .omx` 和 `git log -- openspec` 核对）
- [ ] 1.3 确认 `experiments/` 无跟踪文件残留
- [ ] 1.4 创建 `fixtures/docx/` 目录
- [ ] 1.5 扫描 archive 合并冲突：检查同一目标目录下多个 archive 子目录间是否存在同名文件（如 `prd-test.md`），如有则先重命名

## Phase 2 — Delete Legacy Dirs

- [ ] 2.1 删除 `.omx/`（`Remove-Item -Recurse -Force .omx`）
- [ ] 2.2 删除 `experiments/` 空目录树
- [ ] 2.3 考虑是否从 `.gitignore` 移除 `.omx/` 条目（保留无妨，作为安全网也可）

## Phase 3 — Clean Build Artifacts

- [ ] 3.1 删除 `tsconfig.*.tmp.tsbuildinfo`（4-5 个文件）
- [ ] 3.2 删除 `tsconfig.app.tsbuildinfo`（可被构建重新生成）
- [ ] 3.3 删除 `tsconfig.node.tsbuildinfo`

## Phase 4 — Relocate Test Fixtures

- [ ] 4.1 `Move-Item` 根目录 4 个 .docx → `fixtures/docx/`
- [ ] 4.2 `git add fixtures/docx/` 跟踪这些素材
- [ ] 4.3 更新相关引用（如有）

## Phase 5 — Merge Experiment Archives

- [ ] 5.1 创建 `openspec/experiments/format-profile/archive/` ← 合并 6 个 archive 目录
- [ ] 5.2 创建 `openspec/experiments/format-spec/archive/` ← 合并 3 个 archive 目录
- [ ] 5.3 创建 `openspec/experiments/editable-format-constraints/archive/` ← 合并 1 个 archive 目录
- [ ] 5.4 每个合并使用 `git mv <archive-dir> <experiments-dir>/archive/` 保持 rename 历史
      - 例如：`git mv openspec/archive/2026-05-format-profile-backend-experiment/ openspec/experiments/format-profile/archive/`
      - 如果目标目录已存在同名文件，先重命名源文件再 mv

## Phase 6 — Clean Empty Output Dirs

- [ ] 6.1 清理 `openspec/experiments/format-profile/outputs/` 下空子目录
- [ ] 6.2 清理 `openspec/experiments/format-profile-semantic-refinement/outputs/` 下空子目录
- [ ] 6.3 清理 `runtime/format-profile/` 下空子目录（如无用途）

## Phase 7 — Verify & Commit

- [ ] 7.1 运行 `git status` 确认无意外改动
- [ ] 7.2 运行 `git log --follow` 抽查几个 mv 路径的历史完整性
- [ ] 7.3 `npm run build`（如适用）确认构建正常
- [ ] 7.4 更新 `openspec/README.md` 中"已收口主线"章节（原指向 `archive/2026-05-format-*`，改为指向 `experiments/*/archive/`）
- [ ] 7.5 提交并推送 origin + backup
