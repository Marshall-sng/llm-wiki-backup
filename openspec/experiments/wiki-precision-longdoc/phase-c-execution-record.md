# Phase C 执行记录：默认关闭的 XLSX sidecar ingest gate

日期：2026-05-15
分支：`research/wiki-precision-longdoc`
阶段来源：`productionization-phase-plan.md` Phase C

## 目标

在不改变默认 ingest 行为的前提下，将 XLSX sidecar 通道挂到 ingest 的最小安全位置，为后续 CoverageAudit / WikiCandidate / ReviewItem 产品化闭环做准备。

本次 Phase C 采用“默认关闭 feature flag”的窄接入：

```text
loadSourceForIngest
→ ensureXlsxSourceSidecarFresh(enabled=false by default)
→ checkIngestCache
→ 原有 ingest 流程
```

## 实施内容

新增：

- `src/lib/source-sidecar-ingest.ts`
  - `isXlsxSourcePath(path)`
  - `readXlsxSourceSidecarFeatureFlag(storage)`
  - `ensureXlsxSourceSidecarFresh(input)`
  - 依赖注入接口，便于测试不触发真实 Tauri。
- `src/lib/source-sidecar-ingest.test.ts`
  - 验证默认关闭。
  - 验证非 XLSX 即使启用也不执行。
  - 验证启用后能执行 extract → build sidecar → persist。

修改：

- `src/lib/ingest.ts`
  - 在 `loadSourceForIngest` 后、`checkIngestCache` 前增加 feature-flag gate。
  - 默认 flag 读取 `localStorage["llm-wiki.enableXlsxSourceSidecar"] === "true"`。
  - 默认关闭，因此非实验用户和测试默认不改变行为。
- `src/lib/ingest.converted-source.test.ts`
  - 补充 mocked `extractXlsxSidecarPayload`，并断言它不应在默认关闭路径触发。
- `src/test-helpers/fs-temp.ts`
  - 补充 realFs mock 的 `extractXlsxSidecarPayload` 占位，避免老 ingest tests 因新增 command export 失败。

## 验证结果

### Phase C + ingest 回归测试

命令：

```powershell
npx vitest run src/lib/ingest.converted-source.test.ts src/lib/ingest.scenarios.test.ts src/lib/source-sidecar-ingest.test.ts
```

结果：

- 3 个测试文件通过。
- 10 个测试通过。

### Phase A/B/C 目标测试集合

命令：

```powershell
npx vitest run src/lib/source-sidecar-ingest.test.ts src/lib/xlsx-sidecar.test.ts src/lib/source-sidecar-persist.test.ts src/lib/source-sidecar-types.test.ts src/lib/wiki-candidate-projection.test.ts src/lib/coverage-audit.test.ts src/stores/review-store.test.ts src/lib/ingest.converted-source.test.ts src/lib/ingest.scenarios.test.ts
```

结果：

- 9 个测试文件通过。
- 47 个测试通过。

### 隔离 TypeScript typecheck

命令：临时生成 `tsconfig.phase-c.tmp.json`，include Phase A/B/C 相关 TS 文件及 `src/vite-env.d.ts` 后执行：

```powershell
npx tsc --build tsconfig.phase-c.tmp.json --pretty
```

结果：通过。

## 当前边界

已完成：

- XLSX sidecar 的 ingest 前置 gate。
- 默认关闭，保持非 XLSX 与普通 ingest 行为不变。
- cache-hit 前会先经过 gate；但默认关闭时不做 sidecar 检查。

尚未完成：

- 未自动从 sidecar 生成 WikiCandidate。
- 未把 CoverageAudit 结果转成 ReviewItem。
- 未在 cache-hit 时强制比较 sidecar stale/missing。
- 未改变 source summary 写入策略。
- 未接 DOCX/PDF/TXT。

## 结论

这是 Phase C 的安全最小接入，而不是完整 P0 闭环。它证明 sidecar 通道可以挂入 ingest 且默认不扰动现有行为。下一步如果继续产品化，应在 feature flag 打开时补齐：

1. sidecar freshness 判定（exists/hash/mtime）。
2. XLSX domain row extraction 或 first-batch detector。
3. WikiCandidateProjection → CoverageAudit。
4. audit failed → ReviewItem，不静默通过。
5. cache-hit + sidecar missing/stale 的回归测试。
