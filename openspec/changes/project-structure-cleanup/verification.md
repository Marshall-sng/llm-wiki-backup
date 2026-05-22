# 验证清单：Project Structure Cleanup

- [x] BUILD: `npx tsc --noEmit` 通过
- [x] SPEC: `fixtures/docx/` 已包含 4 个 .docx 素材（原根目录 4 个未跟踪文件）
- [x] SPEC: `.omx/` 已从文件系统和 git 索引中完全删除
- [x] SPEC: `experiments/` 空目录树已删除
- [x] SPEC: 所有 tsbuildinfo 文件已删除（6 个）
- [x] SPEC: 10 个实验 archive 目录已从 `openspec/archive/` 合并到 `openspec/experiments/*/archive/`
- [x] SPEC: `openspec/archive/` 仅保留 11 个独立提案（无对应实验代码）
- [x] SPEC: 73 个空目录已清理
- [x] REVIEW: Oracle 审核通过（CONDITIONAL GO，6 项改进全部落实）
- [x] TODO: 所有 tasks.md checkbox 已完成
- [x] COMMIT: `c984d0d` 已推送到 origin + backup
