# Spec: Cleanup Scope

## Scenarios

### S1: Legacy `.omx/` removal
- **Given** `.omx/` 包含 245 个 Codex 运行时文件
- **When** 执行清理
- **Then** `.omx/` 整个目录被删除
- **And** `.gitignore` 中 `.omx/` 条目可以移除（或保留作为安全网）

### S2: Empty `experiments/` removal
- **Given** `experiments/` 下所有文件已迁移到 `openspec/experiments/`，仅剩空目录
- **When** 执行清理
- **Then** `experiments/` 目录树被删除

### S3: Stale tsbuildinfo cleanup
- **Given** 根目录存在 `*.tmp.tsbuildinfo` 文件（4 个）以及 `tsconfig.app.tsbuildinfo`、`tsconfig.node.tsbuildinfo`
- **When** 执行清理
- **Then** 这些文件被删除
- **And** `.gitignore` 中 `*.tsbuildinfo` 已覆盖（无需修改）

### S4: Root .docx relocation
- **Given** 根目录有 4 个未跟踪的 .docx 文件（版式参考素材）
- **When** 执行清理
- **Then** 它们被移动到 `fixtures/docx/` 目录
- **And** 被 `git add` 跟踪（保留为测试素材）

### S5: Experiment archive merge
- **Given** `openspec/archive/` 包含实验相关的文档目录
- **And** `openspec/experiments/` 包含对应实验的可执行代码
- **When** 合并
- **Then** 实验文档被 `git mv` 到对应 `openspec/experiments/<name>/` 下
- **And** `git log --follow` 可追溯原始路径

### S6: Empty directory cleanup
- **Given** 存在多个空目录（如 `runtime/format-profile/outputs/` 下的空子目录）
- **When** 执行清理
- **Then** 空目录被删除（git 不跟踪空目录，仅清理文件系统）

### S7: Archive integrity
- **Given** 清理完成后
- **When** 检查 `openspec/archive/` 和 `openspec/experiments/`
- **Then** `archive/` 仅保留非实验类的历史提案
- **And** `experiments/` 下每个子目录包含其完整文档+代码
