# Phase B 执行记录：XLSX sidecar payload / persistence 最小闭环

日期：2026-05-15
分支：`research/wiki-precision-longdoc`
阶段来源：`productionization-phase-plan.md` Phase B

## 目标

在不接入 ingest / Wiki generation / UI 的前提下，让真实 XLSX 文件具备可进入 SourceSidecar 的最小产品化通道：

```text
raw XLSX file
→ sha256 / size / mtime
→ workbook sheets / non-empty cells
→ row/cell EvidenceAnchor SourceSidecar
→ .llm-wiki/sidecars 持久化路径与序列化
```

## 实施内容

Rust/Tauri：

- `src-tauri/src/commands/fs.rs`
  - 新增 `extract_xlsx_sidecar_payload` command。
  - 读取原始 bytes 计算 sha256。
  - 读取 size / modified_ms。
  - 使用 calamine 提取 workbook sheet/cell payload。
  - 只输出非空单元格；行/单元格证据锚点由 TS builder 统一生成。
- `src-tauri/src/lib.rs`
  - 注册 `extract_xlsx_sidecar_payload`。

TypeScript bridge / product library：

- `src/commands/fs.ts`
  - 新增 `XlsxSidecarPayload` 类型和 `extractXlsxSidecarPayload(path)`。
- `src/lib/xlsx-sidecar.ts`
  - 将 workbook payload 映射为 `SourceSidecar`。
  - 生成 `xlsx.row` 与 `xlsx.cell` anchors。
- `src/lib/source-sidecar-persist.ts`
  - 生成 `.llm-wiki/sidecars` 路径。
  - 提供稳定文件名、JSON 序列化与写入函数。

Tests：

- `src/lib/xlsx-sidecar.test.ts`
- `src/lib/source-sidecar-persist.test.ts`

## 验证结果

### 目标 Vitest

命令：

```powershell
npx vitest run src/lib/xlsx-sidecar.test.ts src/lib/source-sidecar-persist.test.ts src/lib/source-sidecar-types.test.ts src/lib/wiki-candidate-projection.test.ts src/lib/coverage-audit.test.ts src/stores/review-store.test.ts
```

结果：

- 6 个测试文件通过。
- 37 个测试通过。

### 隔离 TypeScript typecheck

命令：临时生成 `tsconfig.phase-b.tmp.json`，只 include Phase A/B 相关 TS 文件后执行：

```powershell
npx tsc --build tsconfig.phase-b.tmp.json --pretty
```

结果：通过。

### Rust/Tauri 编译检查

命令：

```powershell
cargo check
```

结果：通过。

说明：存在既有 warning（clip_server、fs.rs 中旧的 unused/irrefutable/dead_code warning），本次新增命令未引入编译错误。

## 当前边界

已完成：

- XLSX raw freshness：`sha256` / `sizeBytes` / `modifiedMs`。
- workbook payload：sheet + non-empty cells。
- SourceSidecar builder：row/cell anchors。
- sidecar persistence helper：路径、文件名、序列化、写入。

尚未做：

- 不接入 ingest。
- 不自动写 `.llm-wiki/sidecars`。
- 不做 domain_rows 自动识别。
- 不做 CoverageAudit 到 ReviewItem 的真实产品流转。
- 不处理 DOCX/PDF/TXT adapter。

## 风险与后续

1. 当前 Rust payload 只输出非空 cell；如果后续需要保留空白单元格用于表格形状恢复，应在 adapter 层加可选模式，不应直接改变默认行为。
2. 当前 row/cell anchor id 基于 sheet 名 slug + row/column；如果同名 sheet 或 sheet 重命名需要跨版本稳定性，应在 Phase C 前增加 source-specific anchor namespace 或 sheet index。
3. 下一步可以进入 Phase C 的前置细化：先设计 feature flag 与 ingest 接入点，再接入 XLSX P0，避免直接改变非 XLSX 行为。
