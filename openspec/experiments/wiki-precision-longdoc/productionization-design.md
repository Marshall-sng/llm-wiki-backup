# 第一阶段产品化设计（RALPLAN 草案）：Evidence Sidecar → XLSX P0 Wiki 精准生成

## 0. 状态

- Workflow：`$ralplan` / consensus planning。
- 当前版本：Consensus-approved v3。
- 执行边界：只做产品化设计，不实现生产代码。
- 设计原则：总体架构覆盖多格式；P0 落地只做 XLSX。

## 1. Evidence / Inference / Unknown

### Evidence

1. 多格式实验已经验证 anchor 可行：DOCX paragraph/table/cell、TXT line/char/chunk、XLSX sheet/row/cell、PDF.js page/text_item/line。
2. `experiments/wiki-precision-longdoc/schemas/source-sidecar.schema.json` 已定义 SourceSidecar v0.1.0。
3. `first-batch-company` 真实闭环显示：当前 wiki source page 保留 18/18 企业名，但联系人 0/13、电话 0/13；converted/cache 中联系人/电话为 13/13。
4. 补充实验显示：XLSX 样本中存在 merged ranges，PDF.js 可形成 page-level quality metrics，CoverageAudit 能区分 full candidate 与 current wiki source page。
5. 当前代码路径候选：`src/lib/source-conversion.ts` 负责 converted cache；`src/lib/ingest.ts` 负责 LLM ingest / wiki source 写入 / review blocks；`src/lib/search.ts` 负责 wiki 搜索；`src/stores/review-store.ts` 管理 review items；`src/types/wiki.ts` 是 wiki 类型入口。

### Inference

1. 当前精度问题主要来自 Wiki generation 把结构化材料压缩成摘要型 source page，而不是 converted markdown 绝对缺字段。
2. SourceSidecar 应成为事实层，converted markdown 继续作为可读中间层。
3. P0 若只修 XLSX，能以“第一批企业名单.xlsx”建立清晰回归闭环，同时避免与 DOCX-first 并行工作冲突。

### Unknown

1. 当前主线是否已有未提交 DOCX/export 改动会改变具体文件落点；执行前必须重查 git status。
2. sidecar 存储目录已决策为 `.llm-wiki/sidecars`；仍需在实现阶段确认 path escaping 细节与 raw binary hash command 的具体 API。
3. LLM WikiCandidate projection 的最终 prompt 形态仍需实现阶段小样验证。

## 2. RALPLAN-DR Summary

### Principles

1. Evidence-first：原始结构化证据优先于摘要文本。
2. Minimal P0：第一阶段只落 XLSX，避免多格式同时产品化导致失控。
3. Audit before publish：WikiCandidate 进入 Wiki page 前必须经过 CoverageAudit。
4. Compatible by design：总体接口必须为 PDF/DOCX/TXT 和 DOCX-first export 留出口。
5. Non-destructive integration：不覆盖现有 converted/wiki 文件，先以 sidecar 和 review item 增量接入。

### Decision Drivers

1. 真实缺漏修复能力：能否修复“第一批企业名单.xlsx”行级事实丢失。
2. 接入风险：是否能小范围接入当前 ingest/wiki pipeline，避免大重构。
3. 可验证性：是否有自动回归测试证明联系人、电话、原始序号等不再静默丢失。

### Viable Options

#### Option A：P0 只做 XLSX full SourceSidecar + CoverageAudit（推荐）

优点：
- 直接解决已验证真实痛点。
- 验收标准清晰。
- 对 PDF/DOCX/TXT 只做接口预留，风险可控。
- 避免与 DOCX-first 并行工作冲突。

缺点：
- 短期内 PDF/DOCX/TXT 仍不会产品化接入。
- 需要解释“多格式实验成果为何暂不全部落地”。

#### Option B：同时产品化 XLSX + PDF + DOCX + TXT 抽取

优点：
- 看起来更完整，能展示统一架构的全部价值。
- PDF.js 与 DOCX/TXT 实验已有基础。

缺点：
- 范围过大，reading order、DOCX heading/media、长文 chunk 审计都会进入关键路径。
- 验收标准变模糊。
- 与 DOCX-first 工作冲突风险高。

#### Option C：只写抽象层，不落任何格式

优点：
- 架构最干净，短期改动少。

缺点：
- 不能证明解决真实 Wiki 缺漏。
- 容易形成空架构。


#### Option D：强化 converted markdown / prompt + CoverageAudit，不引入 full SourceSidecar

优点：
- 改动最小，可能短期缓解表格摘要丢字段。
- 不需要新增持久化事实层。

缺点：
- 无法提供稳定 row/cell anchor。
- 无法用 raw binary hash 判断结构化事实层 freshness。
- 无法为 DOCX-first / RAG 提供可靠 EvidenceRef provenance。
- ingest cache hit 后仍缺可审计结构化事实闭环。
- 对“联系人/电话被 LLM 摘要丢弃”只能靠 prompt 约束，不能形成 deterministic audit。

结论：拒绝作为 P0 主方案；可作为 WikiCandidate prompt 的辅助约束，但不能替代 SourceSidecar。

### Recommendation

选择 Option A：总体设计覆盖多格式；P0 只做 XLSX full sidecar、WikiCandidate projection、CoverageAudit、第一批企业名单回归测试。

## 3. Requirements Summary

### Product Goal

让表格型材料进入 Wiki 时不再丢失行级事实，尤其是企业/机构、项目、联系人、电话、来源工作表、行业、原始序号等字段。

### P0 Scope

1. 定义生产用 `SourceSidecar` / `EvidenceAnchor` TypeScript 类型。
2. 实现 XLSX extractor：full row/cell anchors、merged ranges、header/merged context。
3. 持久化 XLSX sidecar。
4. 从 XLSX sidecar 生成 WikiCandidate 输入，而不是只让 LLM 摘要 converted markdown。
5. 实现 CoverageAudit v0：required field coverage、serial rewrite、missing contact/phone/source worksheet、ignored-with-reason。
6. 为“第一批企业名单.xlsx”加入回归测试。

### P1 Scope

1. PDF.js extractor + quality gate 接入设计。
2. DOCX paragraph/table/cell extractor + heading resolver 设计。
3. TXT chunk/line/char + tail coverage audit 设计。
4. Entity merge / alias resolution 的 ReviewQueue 设计。
5. DOCX-first export evidenceRefs 接口对齐。

### Out of Scope for P0

- OCR。
- PDF 表格恢复。
- DOCX 图片、批注、修订、页眉页脚。
- PPTX/Web。
- 大规模 UI 改造。
- 全格式生产接入。

## 4. Target Architecture

```text
raw/sources/*
  → FormatExtractor
  → SourceSidecar
  → EvidenceAnchorIndex
  → WikiCandidateProjection
  → CoverageAudit
  → ReviewItem
  → Wiki Page
```

### Data Objects

- `SourceIdentity`：source_id、format、uri、title、content_hash。
- `SourceSidecar`：source、anchors、coverage、quality、review_items、format_native。
- `EvidenceAnchor`：anchor_id、source_id、format、kind、selector、text preview/hash、confidence、metadata。
- `XlsxSelector`：sheet、row、column、cell。
- `XlsxMergedContext`：merged_range、source_cell、propagated_value、applies_to_cells。
- `CoverageAuditReport`：status、required_fields、missing_items、consumed_anchor_ids、ignored_with_reason。
- `WikiCandidate`：source_id、entity_candidates、fact_candidates、evidence_refs、draft_markdown。


## 4.1 Storage / Freshness / Cache Contract

### Sidecar location

P0 采用 app-managed sidecar cache：

```text
.llm-wiki/sidecars/<raw-source-relative-path>.source-sidecar.json
.llm-wiki/sidecars/<raw-source-relative-path>.coverage-audit.json
```

示例：

```text
raw/sources/第一批企业名单.xlsx
→ .llm-wiki/sidecars/第一批企业名单.xlsx.source-sidecar.json
→ .llm-wiki/sidecars/第一批企业名单.xlsx.coverage-audit.json
```

### Why `.llm-wiki/sidecars`

- `.llm-wiki` 已承载 converted/cache/page-history 等 app-managed artifacts。
- sidecar 是派生产物，不应由用户直接编辑。
- 当前 file-sync 忽略 `.llm-wiki`，这是期望行为；sidecar freshness 由 ingest 显式检查，不依赖 file watcher。

### Freshness contract

每个 sidecar 必须包含：

```ts
schema_version: string
extractor_version: string
generated_at: string
source: {
  source_id: string
  uri: string
  relative_path: string
  content_hash: string
  mtime_ms?: number
  size_bytes?: number
}
```

Fresh iff：

```text
sidecar.schema_version supported
AND sidecar.extractor_version current
AND sidecar.source.content_hash == current raw source binary hash
```

mtime 只能作为快速预检，不能替代 content_hash。

Raw hash rule：

```text
content_hash MUST be computed from raw source bytes.
Do not compute it from converted markdown, calamine text extraction, or `readFile(xlsx)` markdown output.
```

Preferred implementation：新增窄 Tauri command，例如 `file_sha256(path)` 或 structured XLSX command 同时返回 raw sha256。

### Cache-hit rule

现有 ingest cache hit 不能跳过 sidecar：

```text
raw source
→ ensureSourceSidecarFresh(xlsx only in P0)
→ loadSourceForIngest / converted markdown
→ checkIngestCache
→ if cache hit: still verify sidecar + audit artifacts exist and are fresh
→ WikiCandidateProjection
→ CoverageAudit
→ write / review
```

如果 cache hit 但 sidecar missing/stale：

```text
regenerate sidecar
regenerate audit if candidate exists
or mark needs_review before publishing stale summary
```

### Converted vs Sidecar boundary

```text
converted markdown = human-readable / LLM fallback / text preview
SourceSidecar = source of truth for structured facts, anchors, coverage, audit
```

Converted freshness does not imply sidecar freshness; sidecar freshness tracks raw source hash.

## 4.2 Extractor technical decision

P0 XLSX extraction should prefer Tauri/Rust using existing spreadsheet capability rather than adding a JS spreadsheet dependency.

Recommended split:

```text
Rust/Tauri command:
  read xlsx via calamine
  return workbook/sheet/row/cell/merged-ranges structured payload

TypeScript layer:
  normalize to SourceSidecar
  build EvidenceAnchor ids
  project WikiCandidate
  run CoverageAudit
```

Rationale:

- Avoid adding `xlsx` / SheetJS dependency in frontend.
- Keep binary file parsing near existing Tauri file capabilities.
- TS remains responsible for product semantics, audit, and tests.

Open implementation question:

- If calamine cannot expose enough style/merge information for required P0 merged_context, add a narrow Rust helper or fallback parser, but do not introduce broad new dependencies without review.

## 4.3 Review / Audit boundary

CoverageAuditReport is persisted as an artifact, not squeezed entirely into `ReviewItem`.

```text
.llm-wiki/sidecars/<source>.coverage-audit.json
```

ReviewItem carries summary + pointer:

```ts
type CoverageAuditReviewMetadata = {
  sourceId: string
  auditPath: string
  missingCount: number
  blockingCount: number
  anchorIds?: string[]
  fields?: string[]
}
```

P0 recommendation：extend `ReviewItem` with optional typed metadata. Description fallback is rejected for productized P0 because it is not stable enough for tests, dedup, or UI routing.

## 4.4 EvidenceRef contract for DOCX-first compatibility

P0 must define a generic evidence reference even though DOCX export is not implemented here:

```ts
type EvidenceRef = {
  source_id: string
  anchor_id: string
  selector: Record<string, unknown>
  quote_preview?: string
}

type FactCandidate = {
  fact_id: string
  subject: string
  predicate: string
  object: unknown
  evidenceRefs: EvidenceRef[]
}
```

Rules:

- Anchor IDs must be stable across regeneration when the same source row/cell remains unchanged.
- XLSX selectors must not encode assumptions that prevent PDF/DOCX/TXT selectors.
- WikiCandidate facts should carry `evidenceRefs`, enabling future DOCX-first export to preserve provenance.

## 5. Candidate Code Touchpoints

> 这些是产品化设计候选落点，执行前需要二次确认现有未提交改动。

### Likely new files

- `src/lib/source-sidecar-types.ts`
- `src/lib/xlsx-sidecar.ts` / `src-tauri/src/commands/*` structured XLSX command
- `src/lib/evidence-anchor-index.ts`
- `src/lib/wiki-candidate-projection.ts`
- `src/lib/coverage-audit.ts`
- `src/lib/__tests__/xlsx-sidecar.test.ts`
- `src/lib/__tests__/coverage-audit.test.ts`
- `src/test-helpers/first-batch-company-fixture.ts`

### Likely existing integration points

- `src/lib/source-conversion.ts`：converted cache 仍保留，不替代 sidecar。
- `src/lib/ingest.ts`：在 wiki generation 前读取/生成 sidecar，并把 CoverageAudit review blocks 写入 review store。
- `src/stores/review-store.ts`：复用 review item 模型或扩展 metadata。
- `src/lib/search.ts`：P0 不改；P1 再把 EvidenceAnchorIndex 纳入检索。
- `src/types/wiki.ts`：若需要暴露类型，可只做轻量扩展。
- `src-tauri/src/commands/fs.rs` / `src/commands/fs.ts`：若 sidecar 文件读写需要新命令，优先复用现有 read/write 文件能力。

## 6. P0 Implementation Plan（后续执行用，不在本 ralplan 中实现）

1. **Types first**
   - 定义 `SourceSidecar`, `EvidenceAnchor`, `CoverageAuditReport`, `WikiCandidate`。
   - 与现有 JSON schema 对齐。

2. **XLSX sidecar extractor**
   - 读取 workbook/sheet/row/cell。
   - 保留 full row/cell anchors。
   - 记录 merged ranges 与 propagated context。
   - 输出 coverage summary。

3. **First-batch fixture**
   - 将“第一批企业名单.xlsx”测试输入做成稳定 fixture 或测试 helper。
   - 避免依赖用户本机绝对路径作为 CI 前提。

4. **WikiCandidate projection**
   - 从 row facts 生成 entity/fact candidates。
   - 联系人、电话、来源工作表、行业不得静默丢弃。

5. **CoverageAudit v0**
   - Required fields: enterprise_name, original_serial, project_name, contacts, phones, source_worksheets, industry。
   - `block_if_missing`: enterprise_name, project_name。
   - `review_if_missing`: contacts, phones, source_worksheets, industry。
   - serial rewrite 进入 review。

6. **Ingest integration design gate**
   - 初期可通过 feature flag 或 narrow path 只对 `.xlsx` 生效。
   - 不删除 converted markdown。
   - 若 audit failed，不静默发布摘要型 source page。
   - cache hit + sidecar missing/stale 必须 regenerate sidecar 或 block/review，不能提前 return。

7. **Regression tests**
   - 断言 18 企业、22 row anchors、204 cell anchors。
   - 断言联系人/电话可追踪。
   - 断言 current summary-style candidate 会 fail audit。
   - 断言 full candidate passes audit。

## 7. Acceptance Criteria

1. 对第一批企业名单 fixture，XLSX sidecar 生成：
   - row anchors = 22；
   - cell anchors = 204；
   - first_sheet_rows = 18；
   - pilot_sheet_rows = 4。
2. WikiCandidate projection 生成：
   - entity candidates >= 18；
   - fact candidates >= 147 for fixture baseline；
   - first-batch contacts covered = 13/13；
   - first-batch phones covered = 13/13；
   - each fact candidate has `evidenceRefs[]` with `source_id`, `anchor_id`, and selector.
3. CoverageAudit：
   - `coverage_ratio = consumed_required_field_checks / total_required_field_checks`；
   - `ignored_with_reason` counts as consumed only when the ignored field has an explicit reason and anchor reference；
   - full candidate coverage_ratio = 1.0 或 >= 0.95；
   - current summary-style candidate coverage_ratio < 0.75 并 failed；
   - missing contacts/phones/source worksheets produce ReviewItem metadata with sourceId, auditPath, missingCount/blockingCount, fields.
4. Freshness/cache：
   - sidecar missing → regenerate；
   - stale `content_hash` → regenerate；
   - ingest cache hit + sidecar/audit stale → does not silently return；
   - converted cache fresh does not imply sidecar fresh.
5. EvidenceRef stability：
   - rerunning the same fixture yields stable anchor ids for unchanged rows/cells；
   - XLSX selector remains format-specific and does not pollute PDF/DOCX/TXT selector abstractions.
6. P0 不改变 PDF/DOCX/TXT 生产行为。
7. Existing ingest tests 不因 sidecar 类型新增而回退。

## 8. Verification Plan

### Unit

- `xlsx-sidecar.test.ts`：row/cell/merged context、raw binary hash passthrough、anchor id stability。
- `coverage-audit.test.ts`：coverage_ratio formula、required fields、ignored-with-reason、serial rewrite。
- `wiki-candidate-projection.test.ts`：entity/fact candidates、13/13 contacts、13/13 phones、all fact candidates carry evidenceRefs。
- `review-audit-metadata.test.ts`：ReviewItem metadata contains sourceId/auditPath/missingCount/blockingCount/fields。

### Integration

- “第一批企业名单.xlsx” fixture 端到端：extract → candidate → audit。
- converted markdown 与 sidecar 并存，不互相覆盖。
- cache-hit path：ingest cache hit but sidecar missing/stale still regenerates or blocks/reviews.
- stale sidecar path：raw source hash changed invalidates sidecar even if converted cache appears fresh。

### Regression

- Existing ingest/source-conversion/search tests。
- ReviewStore dedup tests（如果新增 review item 类型/metadata）。

### Manual smoke

- 在本地项目中导入/处理第一批企业名单，确认 wiki source 不再静默丢联系人/电话。

## 9. Risks and Mitigations

1. **Risk：prompt-only fix appears cheaper and undermines sidecar scope.**
   - Mitigation：Option D is explicitly rejected as main path; prompts may assist expression but not replace row/cell provenance or audit.
2. **Risk：P0 变成 XLSX 特例。**
   - Mitigation：类型和数据流使用通用 SourceSidecar/EvidenceAnchor；XLSX 只是第一个 extractor。
3. **Risk：LLM 仍摘要丢字段。**
   - Mitigation：CoverageAudit 在发布前阻断或生成 ReviewItem；candidate 先由 deterministic row facts 投影。
4. **Risk：合并单元格语义误传。**
   - Mitigation：merged_context 标记 source_cell，不覆盖原 cell 值；低置信进入 review。
5. **Risk：与 DOCX-first 工作冲突。**
   - Mitigation：P0 不改 docx export 文件；只预留 evidenceRefs 接口。
6. **Risk：本机绝对路径 fixture 不适合测试。**
   - Mitigation：把最小 XLSX fixture 或 JSON fixture 放入 `src/test-helpers` 或 `experiments` 后再迁移。


7. **Risk：cache-hit 分支绕过 sidecar。**
   - Mitigation：explicit ensureSidecarFresh before/inside cache hit; add regression tests.
8. **Risk：raw hash 来源错误。**
   - Mitigation：hash raw bytes only via Tauri command; never hash converted markdown.
9. **Risk：ReviewItem dedup loses audit pointer。**
   - Mitigation：typed metadata plus auditPath; tests assert metadata survives add/merge.
10. **Risk：CoverageAudit 阈值误判。**
   - Mitigation：required-field checks are explicit counts; ignored_with_reason requires anchor reference.

## 10. ADR

### Decision

采用“多格式统一架构 + XLSX-only P0”的第一阶段产品化路线。

### Drivers

- 修复已验证真实 Wiki 缺漏。
- 最小可验收范围。
- 避免与 DOCX-first 并行工作冲突。

### Alternatives considered

- 全格式同时产品化：范围和质量风险过大。
- 只做抽象层：无法证明解决真实问题。
- 继续实验：边际收益低，P0/P1 风险已经通过补充实验验证。

### Why chosen

XLSX P0 能直接用第一批企业名单证明价值，同时保留 PDF/DOCX/TXT 接口边界。

### Consequences

- 产品化设计将包含 PDF/DOCX/TXT 作为 P1/P2，但 P0 只验收 XLSX。
- converted markdown 定位降级为可读中间层。
- CoverageAudit 成为 Wiki 生成门禁。

### Follow-ups

- P1：PDF.js quality gate 接入。
- P1：DOCX heading/table sidecar。
- P1：TXT tail coverage audit。
- P1：DOCX export evidenceRefs 对齐。

## 11. Available-Agent-Types Roster and Staffing Guidance

可用角色建议：

- `architect`：生产化边界、数据流和 storage contract 复核。
- `critic`：验收标准、风险、范围控制评审。
- `executor`：后续 P0 实现。
- `test-automator` / `test-engineer`：fixture 和回归测试。
- `reviewer`：PR 级正确性、安全与回归风险。
- `explore`：实现前二次代码路径映射。

### Ralph path

适合单负责人顺序实现 P0：types → extractor → projection → audit → tests。

### Team path

适合并行：

- Worker A：types + XLSX sidecar extractor。
- Worker B：CoverageAudit + WikiCandidate projection。
- Worker C：fixtures + tests。
- Reviewer：最终 review 与回归验证。

### Goal-mode suggestions

- `$ultragoal`：若要把 P0 产品化作为 durable multi-step goal。
- `$autoresearch-goal`：不推荐；研究阶段已完成。
- `$performance-goal`：不适用，除非后续处理大表性能。

## 12. Critic Approval Notes

Critic final verdict: APPROVE. Non-blocking execution notes:

1. 同步检查 / 更新 `source-sidecar.schema.json`，确保 freshness 字段不只存在于 TS 类型。
2. CoverageAudit 对 fixture 优先追求 `coverage_ratio = 1.0`；若使用 `>=0.95`，必须写清合法 `ignored_with_reason`。
3. ReviewItem metadata merge/dedup 必须测试 `auditPath / fields / counts` 不丢失。
4. sidecar path escaping 使用稳定编码或 hash 辅助，避免嵌套路径、特殊字符、同名冲突。

## 13. Changelog

- v1：根据已有实验成果生成 Planner 草案。
- v2：吸收 Architect ITERATE 反馈，补充 sidecar storage/freshness、cache-hit、converted boundary、Tauri/calamine extractor、Review/Audit metadata、EvidenceRef contract。
- v3：吸收 Critic ITERATE 反馈，补 Option D，明确 raw binary hash，收紧 ReviewItem metadata、EvidenceRef、CoverageAudit 公式和 cache-hit/stale sidecar 验收。
- v3-approved：Critic APPROVE；补充执行阶段非阻塞建议。
