# Design: Project Structure Cleanup

## Current State

```
llm_wiki/
├── .omx/                          ← 245 files, legacy Codex runtime ❌
├── experiments/                   ← entirely empty ❌
├── openspec/
│   ├── archive/                   ← 21 subdirs (10 experiment docs + 11 standalone)
│   ├── changes/                   ← 1 active change
│   ├── experiments/               ← 10 subdirs (code)
│   └── requirements/              ← 11 md files
├── *.docx (x4)                    ← untracked reference docs ❌
├── *.tmp.tsbuildinfo (x5)         ← stale build artifacts ❌
└── ...
```

## Target State

```
llm_wiki/
├── openspec/
│   ├── archive/                   ← 11 standalone archives (no experiment code exists)
│   ├── changes/
│   ├── experiments/               ← 10 subdirs, each self-contained (docs + code)
│   │   ├── format-profile/archive/    ← 6 merged archive dirs
│   │   ├── format-spec/archive/       ← 3 merged archive dirs  
│   │   └── editable-format-constraints/archive/ ← 1 merged archive dir
│   └── requirements/
├── fixtures/docx/                 ← reference .docx素材（tracked）
└── ... (clean root)
```

## Merge Mapping

| Archive dir | Merge target | Type |
|---|---|---|
| `2026-05-format-profile-backend-experiment/` | → `experiments/format-profile/archive/` | git mv |
| `2026-05-format-profile-four-format-productization/` | → `experiments/format-profile/archive/` | git mv |
| `2026-05-format-profile-semantic-refinement-phaseB/` | → `experiments/format-profile/archive/` | git mv |
| `2026-05-format-profile-style-extraction-phase3/` | → `experiments/format-profile/archive/` | git mv |
| `2026-05-format-profile-stylefacts-phaseA/` | → `experiments/format-profile/archive/` | git mv |
| `2026-05-format-rule-synthesis/` | → `experiments/format-profile/archive/` | git mv（注：format-rule-synthesis 是 format-profile 实验的一个子阶段，非独立实验线） |
| `2026-05-format-spec-four-format-experiment/` | → `experiments/format-spec/archive/` | git mv |
| `2026-05-format-spec-productization-phaseC/` | → `experiments/format-spec/archive/` | git mv |
| `2026-05-format-spec-visibility-audit-phaseD/` | → `experiments/format-spec/archive/` | git mv |
| `2026-05-editable-format-constraints/` | → `experiments/editable-format-constraints/archive/` | git mv |

## Deletion Plan

| Target | Reason | Method |
|---|---|---|
| `.omx/` | Legacy Codex runtime, plans migrated | `Remove-Item -Recurse` |
| `experiments/` (empty tree) | All files migrated to openspec/experiments/ | `Remove-Item -Recurse` |
| `*.tmp.tsbuildinfo` (5 files) | Stale build artifacts | `Remove-Item` |
| Root 4 .docx | Move to fixtures/docx/ first, then track | `Move-Item` + `git add` |

## Merge Conflict Check
在 Phase 1 安全检查中增加：对 10 个待合并 archive 目录做文件名冲突扫描。如果同一目标目录下多个 archive 有同名文件（如 `prd-test.md`），需先重命名或确认可覆盖。

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `.omx/` has active deps (hooks, scripts) | Very low — all plans migrated, gitignore confirms | Check .omx/ contents before delete |
| Archive→experiment merge breaks git history | None — `git mv` preserves history | Verify with `git log --follow` |
| Archive merge filename collisions | Low — each archive has unique content | Phase 1 pre-scan; renaming before merge if needed |
| Missing some opencode/ config deps | Low — `.opencode/` is separate | Spot-check after cleanup |
| 4 .docx files contain test-critical data | Low — they're untracked reference docs | Move to fixtures/, not delete |
| user needs .tool/ later | Low — keep .tools/ unchanged | Not in scope |
