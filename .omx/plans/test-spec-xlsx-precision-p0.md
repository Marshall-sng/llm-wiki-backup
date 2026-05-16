# Test Spec: XLSX Precision P0

来源计划：`.omx/plans/xlsx-precision-p0-productization-plan.md`
状态：Architect APPROVE + Critic APPROVE
日期：2026-05-15

## 必测矩阵

### Rollout mode

- no key -> disabled。
- invalid mode -> fallback legacy。
- legacy true -> observe。
- mode observe + legacy false -> observe。
- mode block + legacy false -> block。

### Audit input

- `CoverageAuditInput` 使用：
  - rows
  - `Pick<WikiCandidate, "entityCandidates" | "factCandidates">`
  - sidecar anchors / anchorsById
  - optional candidateText only as diagnostic
- enterprise_name 必须消费 entity candidate evidenceRefs。
- consumed check 的 EvidenceRef.anchor_id 必须存在于 sidecar anchors。

### Observe mode

- audit failed + cache miss：不阻断 FILE blocks，不过滤 writtenPaths/cache，只记录 wouldBlockPaths / ReviewItem / audit artifact。
- audit failed + cache hit：不改变 cachedFiles return。

### Block mode

- audit failed + cache miss：不写 target/entity/precision pages，不保存可 replay 不完整 target/entity pages 的 cache。
- audit failed + cache hit：先 gate 再 return，过滤/阻断 blocklist paths。
- audit passed：允许写 `wiki/sources/<sourceBaseName>-precision.md`。

### Detector

- first-batch detector 不得以文件名为主判定。
- 至少两个正例变体、两个负例普通 XLSX。

### Regression

- feature disabled 时不调用 XLSX sidecar extract。
- 非 XLSX 行为不变。
- DOCX-first 文件不被本阶段修改。

## 建议命令

```powershell
npx vitest run src/lib/source-sidecar-ingest.test.ts src/lib/xlsx-sidecar.test.ts src/lib/wiki-candidate-projection.test.ts src/lib/coverage-audit.test.ts src/stores/review-store.test.ts
npx vitest run src/lib/ingest.converted-source.test.ts src/lib/ingest.scenarios.test.ts
git status --short
git diff --name-only
git diff --cached --name-only
```
