# Phase A 执行记录：Evidence Layer Core

日期：2026-05-15
分支：`research/wiki-precision-longdoc`
阶段来源：`productionization-phase-plan.md` Phase A

## 目标

在不接入 ingest/Tauri/UI/DOCX 导出主线的前提下，先落地可测试的证据层最小闭环：

- 统一 sidecar/evidence anchor/evidence ref/fact/wiki candidate/coverage audit 类型。
- 以“第一批企业名单”问题为回归样本，验证行级与单元格级事实不会被 summary-style Wiki 吞掉。
- 为后续产品化接入提供可复用 CoverageAudit 与 ReviewItem metadata 载体。

## 实施内容

Evidence / projection / audit：

- `src/lib/source-sidecar-types.ts`
- `src/lib/evidence-anchor-index.ts`
- `src/lib/wiki-candidate-projection.ts`
- `src/lib/coverage-audit.ts`

Fixture / tests：

- `src/test-helpers/first-batch-company-fixture.ts`
- `src/lib/source-sidecar-types.test.ts`
- `src/lib/wiki-candidate-projection.test.ts`
- `src/lib/coverage-audit.test.ts`

Review queue 轻量接入点：

- `src/stores/review-store.ts`
- `src/stores/review-store.test.ts`

## 验证结果

### 目标测试

命令：

```powershell
npx vitest run src/lib/source-sidecar-types.test.ts src/lib/wiki-candidate-projection.test.ts src/lib/coverage-audit.test.ts src/stores/review-store.test.ts
```

结果：

- 4 个测试文件通过。
- 32 个测试通过。

覆盖的关键断言：

- “第一批企业名单” fixture 具备 226 个 anchor：22 个 row anchor + 204 个 cell anchor。
- WikiCandidate entity candidates >= 18。
- Fact candidates >= 147。
- contact facts = 13/13。
- phone facts = 13/13。
- 完整候选文本 coverage_ratio = 1.0。
- summary-style Wiki coverage_ratio < 0.75。
- `ignored_with_reason` 只有同时具备 reason 与 anchor evidence ref 时才计为 consumed。
- ReviewItem metadata 可保留并合并 `sourceId`、`auditPath`、`missingCount`、`blockingCount`、`fields`、`anchorIds`。

### 隔离 typecheck

命令：临时生成 `tsconfig.phase-a.tmp.json`，只 include Phase A 相关文件后执行：

```powershell
npx tsc --build tsconfig.phase-a.tmp.json --pretty
```

结果：通过。

### 全量 typecheck 状态

命令：

```powershell
npm run typecheck
```

结果：未通过，但阻断来自当前主线/另一个终端的新 DOCX fidelity 文件，不属于 Phase A 本次变更：

- `src/lib/docx-fidelity-diagnostics.ts:240`：`DocxIntermediateBlock` 上访问 `ordered`。
- `src/lib/docx-fidelity-diagnostics.ts:249`：同类问题。

处理决定：本阶段不修改 DOCX fidelity 相关文件，避免覆盖另一个终端工作；以隔离 typecheck 作为 Phase A 变更的类型验证证据。

## 结论

Phase A 已形成产品化设计的第一层可执行依据：

1. 证据锚点和候选事实可以先以纯 TS 数据结构落地，不需要先改 ingest/UI。
2. “第一批企业名单”的问题可以被自动化测试稳定复现：summary-style Wiki 会显著低覆盖，而结构化候选可以完整覆盖联系人、电话、原始序号、来源 sheet 等事实。
3. CoverageAudit 可作为进入 review queue 的桥梁，但当前只实现了 metadata 载体与合并逻辑，尚未接入实际 ingest/wiki generation。

## 后续建议

进入 Phase B 前，建议保持本阶段边界：

- 不直接把 projection 接入生产 ingest。
- 下一步先实现 xlsx/text/docx/pdf 的 sidecar adapter 接口与最小接入点。
- 将 CoverageAudit 输出转换为真实 ReviewItem 的产品化位置放到 Phase B/B2 细化。
