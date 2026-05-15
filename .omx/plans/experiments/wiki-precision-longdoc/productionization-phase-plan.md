# 第一阶段产品化实施拆分计划

本文件是 `productionization-design.md` 的执行拆分，不替代原设计。

```text
productionization-design.md = 共识产品化设计 / 架构与验收边界
productionization-phase-plan.md = 分阶段实施顺序 / delivery plan
```

## 总原则

1. 总体架构仍然覆盖多格式。
2. P0 实施只落 XLSX。
3. 先做低风险纯库，再做 extractor/persistence，最后接 ingest。
4. 每个阶段都必须能独立验证。
5. 任何阶段都不应覆盖另一个终端的未提交工作。

## 阶段总览

| 阶段 | 目标 | 风险 | 是否接 ingest | 是否改 Tauri | 是否改 UI |
|---|---|---:|---:|---:|---:|
| Phase A | 纯 TS 证据层核心 | 低 | 否 | 否 | 否 |
| Phase B | XLSX extractor / raw hash / sidecar persistence | 中 | 否 | 是 | 否 |
| Phase C | feature-flag 接入 ingest / Wiki generation | 高 | 是 | 可能 | 轻量或否 |

---

## Phase A：纯 TS 证据层核心

### 目标

先把核心产品语义做成可测试库：

```text
SourceSidecar types
EvidenceRef
WikiCandidate projection
CoverageAudit
Review metadata contract
```

### 范围

新增或修改候选文件：

```text
src/lib/source-sidecar-types.ts
src/lib/coverage-audit.ts
src/lib/wiki-candidate-projection.ts
src/lib/evidence-anchor-index.ts
src/test-helpers/first-batch-company-fixture.ts
src/lib/coverage-audit.test.ts
src/lib/wiki-candidate-projection.test.ts
src/lib/source-sidecar-types.test.ts
```

可能需要轻量修改：

```text
src/stores/review-store.ts
```

仅用于增加：

```ts
metadata?: Record<string, unknown>
```

如果修改 `ReviewItem` 会与其他终端冲突，则 Phase A 可以先定义独立类型：

```ts
CoverageAuditReviewMetadata
```

并在 Phase C 再接入 `ReviewItem`。

### 不做

```text
不改 ingest.ts
不改 source-conversion.ts
不改 Tauri command
不改 .llm-wiki 文件结构
不自动处理真实 XLSX
不写 UI
```

### 验收标准

1. 定义通用类型：
   - `SourceSidecar`
   - `EvidenceAnchor`
   - `EvidenceRef`
   - `FactCandidate`
   - `WikiCandidate`
   - `CoverageAuditReport`
2. 每个 `FactCandidate` 必须携带：

```ts
evidenceRefs: EvidenceRef[]
```

3. CoverageAudit 公式明确：

```text
coverage_ratio = consumed_required_field_checks / total_required_field_checks
```

4. 使用第一批企业名单 fixture，可验证：

```text
entity candidates >= 18
fact candidates >= 147
contacts covered = 13/13
phones covered = 13/13
full candidate coverage_ratio = 1.0 或 >= 0.95
summary-style candidate coverage_ratio < 0.75
```

5. `ignored_with_reason` 只有在同时具备：

```text
reason
anchor reference
```

时才可计入 consumed。

### 测试

建议测试：

```text
npm run test:mocks -- src/lib/coverage-audit.test.ts
npm run test:mocks -- src/lib/wiki-candidate-projection.test.ts
npm run typecheck
```

如果项目测试 runner 不支持单文件参数，则使用：

```text
npx vitest run src/lib/coverage-audit.test.ts src/lib/wiki-candidate-projection.test.ts
npm run typecheck
```

### 风险

| 风险 | 缓解 |
|---|---|
| 类型过度抽象 | 只覆盖已实验验证字段 |
| 变成 XLSX 特例 | selector 保持分格式，外层 EvidenceAnchor 通用 |
| ReviewItem 修改冲突 | Phase A 可暂不修改 review-store |

### 停止条件

Phase A 完成后应满足：

```text
纯 TS 单元测试通过
无 ingest 行为变化
无 Tauri 行为变化
第一批企业名单 fixture 可证明 audit 规则
```

---

## Phase B：XLSX extractor / raw hash / sidecar persistence

### 目标

让真实 XLSX 文件可以生成生产级 SourceSidecar，并能判断 freshness。

```text
raw XLSX bytes
→ sha256
→ structured workbook payload
→ SourceSidecar
→ .llm-wiki/sidecars persistence
```

### 范围

候选文件：

```text
src-tauri/src/commands/fs.rs
src-tauri/src/commands/mod.rs 或 src-tauri/src/lib.rs
src/commands/fs.ts
src/lib/xlsx-sidecar.ts
src/lib/source-sidecar-persist.ts
src/lib/xlsx-sidecar.test.ts
src/lib/source-sidecar-persist.test.ts
```

### 技术决策

优先：

```text
Rust/Tauri + calamine
```

不优先：

```text
前端引入 xlsx / SheetJS
```

原因：

- 当前项目已有 Tauri 文件能力；
- 避免新增大 JS dependency；
- raw binary hash 更适合在 Tauri/Rust 层做；
- TS 层负责规范化和产品语义。

### 必须输出

Tauri 或等价接口应能返回：

```ts
type StructuredXlsxPayload = {
  raw_sha256: string
  sheets: Array<{
    name: string
    rows: Array<{
      row: number
      cells: Array<{
        row: number
        column: string
        cell: string
        value: string | number | boolean | null
        formula?: string
      }>
    }>
    merged_ranges: Array<{
      range: string
      top_left_cell: string
      top_left_value: string | null
      affected_cells: string[]
    }>
  }>
}
```

### Sidecar persistence

路径：

```text
.llm-wiki/sidecars/<escaped-source-relative-path>.source-sidecar.json
.llm-wiki/sidecars/<escaped-source-relative-path>.coverage-audit.json
```

path escaping 要稳定，建议：

```text
safe slug + short hash
```

避免：

```text
嵌套路径冲突
特殊字符冲突
同名文件冲突
```

### Freshness

必须基于：

```text
raw source binary sha256
```

禁止基于：

```text
converted markdown
calamine text extraction
readFile(xlsx) markdown output
mtime-only
```

### 不做

```text
不自动接入 ingest
不生成 Wiki page
不改 UI
不接 PDF/DOCX/TXT
```

### 验收标准

1. 对第一批企业名单真实或 fixture XLSX：

```text
row anchors = 22
cell anchors = 204
first_sheet_rows = 18
pilot_sheet_rows = 4
```

2. 对含合并单元格样本 S040：

```text
merged_ranges = 5
merged_context 可回溯 top_left_cell
```

3. sidecar 写入 `.llm-wiki/sidecars`。
4. 相同文件重复生成：

```text
content_hash 一致
anchor_id 稳定
```

5. 修改源文件或替换 fixture 后：

```text
freshness 检测为 stale
```

### 测试

建议：

```text
npx vitest run src/lib/xlsx-sidecar.test.ts src/lib/source-sidecar-persist.test.ts
npm run typecheck
```

Rust/Tauri 层：

```text
cd src-tauri
cargo test
```

或至少运行相关 command 单元测试。

### 风险

| 风险 | 缓解 |
|---|---|
| calamine merged range 信息不足 | 先验证，必要时 narrow fallback |
| path escaping 不稳定 | 使用 slug + hash |
| raw hash 读错对象 | 只 hash raw bytes |
| Windows 中文路径问题 | fixture 覆盖中文文件名 |

### 停止条件

Phase B 完成后应满足：

```text
真实 XLSX 可生成 fresh sidecar
sidecar 可持久化
stale 可检测
仍未改变 ingest 行为
```

---

## Phase C：feature-flag 接入 ingest / Wiki generation

### 目标

把 XLSX sidecar 接入真实 ingest，但只在 feature flag 或 narrow path 下启用。

```text
raw .xlsx
→ ensureSidecarFresh
→ WikiCandidateProjection
→ CoverageAudit
→ ReviewItem
→ Wiki page
```

### 范围

候选文件：

```text
src/lib/ingest.ts
src/lib/source-conversion.ts
src/stores/review-store.ts
src/lib/ingest.converted-source.test.ts
src/lib/ingest.scenarios.test.ts
src/lib/project-file-sync.ts
```

如果需要配置：

```text
src/stores/wiki-store.ts
src/components/settings/*
```

但 P0 可以先不做 UI，使用内部默认或 feature flag。

### Feature flag

建议：

```ts
enableXlsxSourceSidecar
```

默认策略待定：

- 实验分支可默认 true；
- 合并主线前建议默认 false 或仅对 `.xlsx` narrow path 生效。

### Ingest 顺序

必须满足：

```text
raw source
→ ensureSourceSidecarFresh(xlsx only)
→ loadSourceForIngest / converted markdown
→ checkIngestCache
→ if cache hit: still verify sidecar + audit freshness
→ WikiCandidateProjection
→ CoverageAudit
→ write wiki or create ReviewItem
```

### Cache-hit 要求

以下场景必须测试：

```text
cache hit + sidecar exists/fresh → 可继续
cache hit + sidecar missing → regenerate sidecar
cache hit + sidecar stale → regenerate sidecar
cache hit + audit failed → 不静默发布
converted cache fresh + sidecar stale → sidecar stale 优先
```

### ReviewItem metadata

推荐扩展：

```ts
metadata?: Record<string, unknown>
```

CoverageAudit review metadata 至少包含：

```ts
{
  sourceId: string
  auditPath: string
  missingCount: number
  blockingCount: number
  fields: string[]
  anchorIds?: string[]
}
```

ReviewStore dedup 后不得丢：

```text
auditPath
fields
missingCount
blockingCount
```

### 不做

```text
不接 PDF/DOCX/TXT
不做 DOCX export evidence refs 实现
不做 UI 大改
不删除 converted markdown
不改变非 XLSX ingest 行为
```

### 验收标准

1. 第一批企业名单 ingest 后：

```text
18 个企业实体不丢
row anchors = 22
cell anchors = 204
contacts covered = 13/13
phones covered = 13/13
source worksheets 有消费或 review
serial rewrite 有 review
```

2. 当前摘要型 source page 缺漏能被 CoverageAudit 检出：

```text
coverage_ratio < 0.75
status = failed
ReviewItem generated
```

3. full candidate：

```text
coverage_ratio >= 0.95，优先 1.0
status = passed
```

4. 非 XLSX source ingest 行为不变。

### 测试

建议：

```text
npx vitest run src/lib/ingest.converted-source.test.ts src/lib/ingest.scenarios.test.ts
npx vitest run src/lib/coverage-audit.test.ts src/lib/wiki-candidate-projection.test.ts
npm run typecheck
```

如果触及 ReviewStore：

```text
npx vitest run src/stores/review-store.test.ts
```

### 风险

| 风险 | 缓解 |
|---|---|
| ingest 主链路回归 | feature flag + narrow .xlsx path |
| LLM 仍摘要丢事实 | deterministic candidate + CoverageAudit gate |
| ReviewItem 噪音过多 | severity / grouping / dedup |
| 与 DOCX-first 冲突 | 不改 docx export；只定义 EvidenceRef |

### 停止条件

Phase C 完成后应满足：

```text
XLSX P0 可以真实进入 ingest
第一批企业名单回归通过
非 XLSX 行为不变
CoverageAudit 阻止静默事实丢失
```

---

## 阶段间依赖

```text
Phase A
  ↓ 提供类型、审计、候选生成规则
Phase B
  ↓ 提供真实 XLSX sidecar 和 freshness
Phase C
  ↓ 接入 ingest 并改变产品行为
```

不能跳过：

```text
Phase C 不能在 Phase A/B 未完成时开始
```

可以并行的部分：

```text
Phase A 的 tests / fixture 准备
Phase B 的 Rust command spike
```

但合并时必须遵守顺序。

---

## 建议提交策略

### Commit A

```text
Define evidence sidecar core types and audit rules
```

### Commit B

```text
Extract XLSX source sidecars with raw freshness
```

### Commit C

```text
Gate XLSX wiki generation with coverage audit
```

每个 commit 都必须可独立解释、可测试。

---

## 与 deferred-improvements 的关系

以下仍保持 deferred，不进入 Phase A/B/C：

```text
OCR
PDF 表格恢复
PDF reading order/header-footer 生产接入
DOCX 图片/批注/修订/页眉页脚
TXT 自动章节发现
PPTX
Web/HTML
大表 SQLite/Parquet 优化
```

以下已吸收进入 Phase A/B/C：

```text
CoverageAudit 门禁
XLSX merged cell context
PDF quality gate 的设计边界
EvidenceRef contract
insufficient evidence / ReviewItem 策略
```

其中 PDF quality gate 只进入设计边界，不在 XLSX P0 中实现。

---

## 下一步建议

若开始实施，先执行：

```text
Phase A：纯 TS 证据层核心
```

执行前必须：

1. `git status`；
2. 确认另一个终端未改同一文件；
3. 不触碰 DOCX-first 相关未提交文件；
4. 只新增/修改 Phase A 范围文件。
