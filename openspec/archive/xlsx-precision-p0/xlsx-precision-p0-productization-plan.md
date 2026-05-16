# XLSX precision P0 产品化闭环计划草案

日期：2026-05-15  
分支：`research/wiki-precision-longdoc`  
目标读者：Architect 审查  
计划状态：Draft v5 / Architect APPROVE + Critic 三轮 ITERATE 后修订 / 仅设计，不实现

## 0. 证据基线与约束

### 已核对事实

- Phase A `ae58b43` 已引入证据层核心：`SourceSidecar`、`EvidenceAnchor`、`EvidenceRef`、`FactCandidate`、`WikiCandidate`、`CoverageAuditReport`、第一批企业名单 fixture、`CoverageAudit`、`ReviewItem.metadata`。
- Phase B `759690b` 已引入 XLSX payload 与 sidecar 最小闭环：Tauri `extract_xlsx_sidecar_payload`、`src/lib/xlsx-sidecar.ts`、`src/lib/source-sidecar-persist.ts`，并在 sidecar source 中记录 `sha256/content_hash`、`size_bytes`、`mtime_ms`。
- Phase C `5bac12d` 已把 `ensureXlsxSourceSidecarFresh` 以默认关闭 feature flag 接入 `src/lib/ingest.ts`：`loadSourceForIngest -> ensureXlsxSourceSidecarFresh -> checkIngestCache`。
- 当前 `ensureXlsxSourceSidecarFresh` 只支持：disabled/skipped/written；尚未区分 existing/fresh/stale/missing/audit failed。
- 当前 `buildXlsxSourceSidecar` 生成 row/cell anchors，但真实 payload 路径尚未自动填充 `domain_rows.first_batch`。
- 当前 `projectFirstBatchCompanyWikiCandidate`、`auditFirstBatchCompanyCoverage` 已存在测试级能力，但尚未接入真实 ingest/wiki 写入路径。

### 硬约束

1. 本阶段只做设计与小步产品化规划；不得实现代码。
2. 不触碰另一个终端的 DOCX-first 未提交改动；本计划的执行边界限定在 XLSX precision P0。
3. 默认保护现有 ingest 行为：feature flag 关闭时，所有 XLSX/非 XLSX 行为与 Phase C 前后一致。
4. 非 XLSX 行为不变：DOCX/PDF/TXT/MD/HTML 不走 XLSX sidecar freshness/audit/wiki candidate gate。
5. 从下一步开始会改变真实产品行为，因此所有产品行为必须先有测试规格与 failure-mode 决策。

---

## 1. RALPLAN-DR Summary

### Principles

1. **证据优先，不静默丢事实**：XLSX P0 的核心不是“生成更多 Wiki”，而是保证关键 row/cell facts 要么被消费、要么被 ReviewItem 明确暴露。
2. **默认安全、显式启用**：P0 行为改变只在 XLSX sidecar feature flag 开启时生效；默认关闭继续保护现有 ingest/cache 体验。
3. **cache hit 也必须验证 freshness**：因 Phase C gate 位于 `checkIngestCache` 前，开启后 cache-hit 不能绕过 missing/stale/audit failed 检查。
4. **先 domain-specific，再抽象通用表格**：P0 聚焦“第一批企业名单.xlsx”可验证闭环；通用 schema detector 放入后续阶段，避免 P0 扩散。
5. **Wiki 写入以 audit pass 为门槛**：自动写 Wiki page 前必须证明关键字段覆盖；失败时进入 review，不把缺失事实写成看似完整的 Wiki。

### Decision Drivers Top 3

1. **避免事实遗漏的可证明性**：必须能用测试证明企业名、项目名、联系人、电话、原始序号、来源工作表、行业等关键字段没有静默丢失。
2. **现有 ingest/cache 兼容性**：不得破坏当前 cache-hit、converted markdown、image cascade 与非 XLSX ingestion 行为。
3. **小提交可回滚**：下一阶段改变真实行为，必须拆成 freshness、domain_rows、projection/audit、ReviewItem/cache、Wiki write gate 等可独立审查提交。

### Viable Options

#### Option A：阻断式质量门禁（推荐）

**行为**：feature flag 开启且 source 为目标 XLSX 时，执行 freshness -> domain_rows -> WikiCandidateProjection -> CoverageAudit。若 audit failed，不自动写 Wiki page；创建 ReviewItem 并保留 source summary/cache 原有安全行为。

**优点**
- 最大化避免静默事实丢失。
- 与 CoverageAudit 的设计意图一致，可把 P0 风险前置暴露。
- cache-hit 时也能收敛到“sidecar fresh + audit pass 才能自动写”的一致模型。

**缺点**
- 用户可能看到“导入成功但未自动生成目标 Wiki”的 review 状态，需要清晰 UI/metadata。
- 首次启用时对问题 XLSX 更严格，可能暴露历史数据质量问题。
- 需要新增 audit failure 的产品文案与 ReviewItem 分类/metadata 约定。

#### Option B：非阻断式审计旁路

**行为**：feature flag 开启时仍生成/更新 Wiki；CoverageAudit failed 只创建 ReviewItem 或日志，不阻断写入。

**优点**
- 对现有自动 ingest 体验影响最小。
- 更适合灰度收集 audit 结果，降低短期产品阻力。
- 实现路径较短。

**缺点**
- 仍可能写入“看似成功但漏事实”的 Wiki，违背 P0 初衷。
- 用户容易忽略 ReviewItem，静默事实丢失风险未真正关闭。
- cache-hit + stale sidecar 的失败模式更难解释。

#### Option C：仅刷新 sidecar，不进入 Wiki/Audit

**行为**：只补齐 freshness 与 domain_rows persistence，不接 WikiCandidate/CoverageAudit/ReviewItem。

**优点**
- 风险最低，最容易回滚。
- 可先稳定 sidecar freshness 与 domain_rows 抽取质量。

**缺点**
- 不能形成 P0 产品闭环。
- 无法解决“何时写 Wiki page”和“如何避免静默事实丢失”。
- 容易拖成技术铺垫而非用户可感知修复。


#### Option D：通用 XLSX schema detector 一次性产品化

**行为**：不只识别 first-batch，而是一次性建立通用表格 schema inference / domain detector registry，再把所有 XLSX 都纳入统一 audit/wiki 生成。

**优点**
- 长期架构更漂亮，能服务更多 Excel 场景。
- 可减少 first-batch 特例后续迁移成本。

**缺点**
- P0 过大，测试矩阵膨胀，难以证明“第一批企业名单”真实问题已关闭。
- 通用 detector 的误判风险会直接影响更多 XLSX。
- 与当前目标“先解决已发现事实丢失”不匹配。

**结论**：不是 P0 viable option；作为 D7+ 后续方向保留，不进入当前产品化闭环。

### 推荐决策

采用 **Option A：阻断式质量门禁**，但以 feature flag、first-batch detector、小提交边界和 review fallback 控制风险。若 Architect 认为产品阻断过强，可在第一轮灰度临时降级为 Option B，但必须保留测试规格，明确这是过渡模式而非最终 P0。

---

## 2. PRD

### 2.1 目标

1. 对启用 XLSX sidecar feature flag 的目标 XLSX，建立从 raw XLSX -> fresh sidecar -> domain_rows -> WikiCandidate -> CoverageAudit -> Wiki write / ReviewItem 的产品闭环。
2. 在 cache miss 与 cache hit 中都能检测 sidecar missing/stale/audit failed。
3. 对“第一批企业名单.xlsx”类数据，保证关键字段不会因 Markdown 转换或 LLM 摘要而静默丢失。
4. 在 audit failed 时不伪装成成功写入，而是产生可追踪 ReviewItem，附带 sourceId、auditPath、missingCount、blockingCount、fields、anchorIds。

### 2.2 非目标

1. 不实现 DOCX-first sidecar、DOCX export、DOCX precision 或 DOCX 未提交改动整合。
2. 不做通用 XLSX schema inference 全量产品化；P0 只做 first-batch detector / projector。
3. 不重写主 ingest 架构，不替换现有 converted markdown、summary page、image cascade。
4. 不改变 feature flag 关闭时的默认行为。
5. 不承诺所有 XLSX 都自动生成 domain_rows；无法识别的 XLSX 只保留 row/cell anchors 与 review/skip 语义。

### 2.3 用户价值

- 用户导入关键 Excel 名单时，系统能保留每行、每单元格证据位置，避免联系人、电话、项目名等事实丢失。
- 用户能知道“为什么没有自动写 Wiki”或“哪些字段缺失”，而不是事后人工发现页面不完整。
- 复导入/cache-hit 场景下，系统能发现 raw XLSX 与 sidecar 不一致，避免使用旧 sidecar 生成错误 Wiki。

### 2.4 范围

#### In scope

- `src/lib/source-sidecar-ingest.ts` freshness 状态模型设计。
- `src/lib/xlsx-sidecar.ts` 或相邻 selector 中 first-batch domain_rows extraction 设计。
- `src/lib/wiki-candidate-projection.ts` 与 `src/lib/coverage-audit.ts` 的产品化接入位置。
- `src/stores/review-store.ts` / persist 兼容的 ReviewItem metadata 使用约定。
- `src/lib/ingest.ts` 中 cache-hit 前 gate 的决策行为。
- 测试：unit、integration、regression、cache-hit、非 XLSX 不变。

#### Out of scope

- DOCX-first adapter、OpenXML sidecar、DOCX export pipeline。
- PDF/TXT/PPTX sidecar 产品化。
- UI 大改；P0 可先复用 ReviewItem metadata 和现有 activity/log，必要 UI copy 另开小步。
- 新依赖。

### 2.5 产品行为

#### Rollout mode

P0 需要把“是否启用 sidecar”和“启用后是否阻断写入”拆开，避免把灰度观测与最终产品门禁混为一谈：

- `disabled`：默认模式；不抽取 sidecar，不 audit，不创建 precision ReviewItem。
- `observe`：只生成 sidecar/audit metadata 与 ReviewItem，不阻断现有写入；仅用于灰度采样，不算 P0 最终通过形态。
- `block`：P0 推荐目标模式；audit 未通过时阻断该 XLSX 自动派生的目标 Wiki 写入，只保留 source summary/cache 安全路径与 ReviewItem/activity。

主线合并前默认必须是 `disabled`；实验分支可以显式设置 `observe` 或 `block`。验收 P0 时必须以 `block` 模式通过测试。

配置合同：

- 新增配置 key：`llm-wiki.xlsxPrecisionRolloutMode`，合法值为 `disabled | observe | block`。
- 保留兼容 key：`llm-wiki.enableXlsxSourceSidecar`，仅作为旧布尔开关。
- 必须先解析为唯一 resolved mode，再由 resolved mode 决定行为：
  1. 若 `llm-wiki.xlsxPrecisionRolloutMode` 存在且合法，resolved mode = 该值；此时不再读取 legacy boolean。
  2. 若新 key 缺失或非法，才读取 legacy boolean：`llm-wiki.enableXlsxSourceSidecar === "true"` -> resolved mode = `observe`。
  3. 其他情况 resolved mode = `disabled`。
- `disabled` 只由 resolved mode 决定；不得再用 `enableXlsxSourceSidecar !== "true"` 覆盖 `block/observe`。
- 读取函数建议签名：`resolveXlsxPrecisionRolloutMode(storage): XlsxPrecisionRolloutMode`，返回类型为 `"disabled" | "observe" | "block"`。
- 测试矩阵：无 key、非法 mode、legacy false、legacy true、mode observe、mode block、mode disabled、mode block + legacy false、mode observe + legacy false，覆盖 precedence。

#### Feature flag 关闭

- resolved rollout mode 为 `disabled`：`ensureXlsxSourceSidecarFresh` 返回 disabled。
- 所有 ingest/cache/wiki 行为与当前主线一致。
- 不抽取 XLSX sidecar，不做 audit，不创建 XLSX precision ReviewItem。

#### Feature flag 开启，非 XLSX source

- 返回 skipped。
- 不抽取 sidecar，不 audit，不影响非 XLSX cache-hit/cache-miss。

#### Feature flag 开启，XLSX source

1. **Freshness 判定**
   - 读取 raw XLSX payload 的 `content_hash/sha256`、`size_bytes`、`mtime_ms`。
   - 查找 `.llm-wiki/sidecars` 中同 sourceId/source path 对应 sidecar。
   - 若 sidecar schema 不兼容、hash 不同、size 不同，判为 stale。
   - mtime 只作为辅助诊断：hash 相同但 mtime 不同不应强制 stale；hash 缺失时可用 size+mtime 降级判断，并记录 warning。

2. **Sidecar missing/stale**
   - missing/stale 时重新 extract -> build -> persist。
   - persist 后返回 fresh/written 结果，并把 sidecar 路径带到后续 audit。
   - extract/persist 失败时不继续自动 Wiki write；创建 ReviewItem 或 activity error，避免静默绕过。

3. **domain_rows extraction**
   - P0 只识别 first-batch 结构，但 detector 不得以文件名为主要判定条件。
   - detector 必须基于结构化信号：sheet/table header、字段别名、行形态、企业/联系人/电话/项目列组合、有效数据行密度。
   - 成功识别时填充 `domain_rows.first_batch`，每行必须包含 row_anchor_id 与关键 cell_anchor_ids。
   - detector 必须输出 `confidence` 与 `reason`；低置信度进入 `unsupported_xlsx_schema` / `needs_review`，不得伪造 domain_rows。
   - 未识别时不伪造 domain_rows：保留 row/cell anchors，返回 `domain_rows_missing/unsupported_xlsx_schema` 状态，可进入 review，但不阻断普通 source summary。
   - 测试至少包含两个正例变体与两个负例普通 XLSX，防止把 fixture 文件名产品化。

4. **WikiCandidateProjection**
   - 仅在 `domain_rows.first_batch` 存在且非空时运行 `projectFirstBatchCompanyWikiCandidate`。
   - Projection 输出 entity/fact/evidenceRefs，作为 audit 的 consumed evidence 来源。
   - LLM 可以参与组织/摘要，但不得成为关键字段是否存在的唯一证据来源。

5. **CoverageAudit**
   - 对 first-batch 必填字段执行 audit；P0 gate 不能只依赖字符串包含，必须验证 candidate facts 与 evidenceRefs 对必填字段的消费关系。
   - Severity matrix：
     - `blocking`：enterprise_name、project_name、row_anchor_id 缺失、关键 evidenceRefs 缺失、domain row 与 source row 对不上。
     - `review`：contact、phone、industry、original_serial、source_worksheet 缺失或被改写。
   - `passed`：blocking 缺失为 0 且覆盖率达到阈值，允许进入自动 Wiki page 写入候选流程。
   - `needs_review`：在 `block` 模式下不自动写目标/实体/precision Wiki；在 `observe` 模式下不阻断，只记录 wouldBlockPaths、ReviewItem 与 audit artifact。若后续产品想在 block 模式允许写入，必须显式标注 partial/incomplete，并作为独立 ADR。
   - `failed`：在 `block` 模式下阻断目标/实体/precision Wiki 自动写入并创建 blocking ReviewItem；在 `observe` 模式下不阻断，只记录 wouldBlockPaths、ReviewItem 与 audit artifact。

   Audit 输入合同：
   - 新增或扩展 `CoverageAuditInput`，明确签名为：`rows + Pick<WikiCandidate, "entityCandidates" | "factCandidates"> + sidecar.anchors/anchorsById + optional candidateText`；`candidateText` 只能作为辅助诊断或 legacy test helper。
   - 字段映射必须显式：`enterprise_name -> entityCandidates.name + entityCandidates.evidenceRefs`，不得只用 fact subject 或字符串包含；`project_name -> predicate project_name/project_component`，`contact -> predicate contact`，`phone -> predicate phone`，`industry -> predicate industry`，`original_serial -> predicate original_serial`，`source_worksheet -> predicate source_worksheet`。
   - 每个 consumed check 必须满足：fact/entity 存在、expected value 匹配、至少一个 EvidenceRef 的 `anchor_id` 存在于 sidecar anchors。
   - 字段级值优先要求 cell anchor；若只有 row anchor，可计为 consumed_with_row_anchor，但进入 review metadata，不能掩盖字段级定位缺失。
   - `ignored_with_reason` 仍需 reason + anchor ref，且 anchor 必须存在于 sidecar anchors。

6. **何时写 Wiki page（按 resolved mode 定义）**
   - `disabled`：不执行 precision gate，不改变任何写入行为。
   - `observe`：即使 audit `failed` / `needs_review` / `unsupported`，也不阻断 existing LLM FILE-block pipeline，不过滤 `writtenPaths`，不改变 ingest cache save/return 行为；只记录 `wouldBlockPaths`、audit artifact、ReviewItem 与 activity metadata。observe 是灰度采样模式，不算 P0 验收通过模式。
   - `block`：只有满足 XLSX、sidecar fresh、domain_rows recognized、WikiCandidate projected、CoverageAudit passed，才允许写由该 XLSX 自动派生的目标 Wiki 内容。
   - “source summary 安全路径”定义为：`wiki/sources/<sourceBaseName>.md` 的原始材料摘要、embedded images safety-net、activity/cache 记录。
   - “target/entity/precision page”定义为：`wiki/entities/*`、`wiki/concepts/*`、以及任何根据该 XLSX 行级/单元格事实自动生成的业务实体页、事实页、precision-derived source detail page。
   - 仅在 `block` 模式下，audit `failed` / `needs_review` / `unsupported` 时，不仅不写 precision-derived Wiki page，也不得让该 XLSX 继续通过现有 LLM FILE-block full pipeline 写入目标实体/事实页面；只允许保留/更新 source summary 与 ReviewItem/activity。
   - 仅在 `block` 模式下，cache miss + audit failed 时，不得保存会 replay 不完整目标/entity pages 的 ingest cache；可保存 source summary 安全结果或使用独立 precision gate cache metadata。
   - 写入应可追踪到 auditPath/source sidecar path，便于后续 debug。

   audit 未通过时的写入 allowlist/blocklist（按 resolved mode 定界）：
   - `block`：执行 allowlist/blocklist，过滤 writtenPaths/cache；这是 P0 验收模式。
   - `observe`：不阻断现有写入；只记录 `wouldBlockPaths`、ReviewItem、audit artifact、activity diagnostic，不过滤 writtenPaths/cache；observe 不能作为 P0 通过条件。
   - `disabled`：不执行 precision audit/write gate。
   - block 模式 allowlist：`wiki/sources/<sourceBaseName>.md` 可以写入/更新原始 source summary；`activity` 可以显示状态；`.llm-wiki/sidecars/*` 与 audit artifact 可以写入；ReviewItem 可以创建/合并。
   - block 模式 conditional allowlist：`wiki/log.md` 只允许写“导入/审计进入 review”的状态日志，不得写成事实已完成；`wiki/index.md`、`wiki/overview.md` 默认不允许因该 XLSX 更新，除非更新内容明确是 review/待处理状态且有单独测试。P0 建议直接禁止。
   - block 模式 blocklist：`wiki/entities/*`、`wiki/concepts/*`、业务事实页、precision-derived detail page、以及任何 LLM FILE-block 生成的 target/entity 内容。
   - block 模式 cache-hit 返回值：若 cachedFiles 中包含 blocklist 路径且当前 audit failed/needs_review/unsupported，activity 可显示历史缓存命中，但返回/保存的 precision gate result 必须标注 blocked；不得把这些 blocklist 路径作为本次成功产物再次保存到 ingest cache。
   - observe 模式测试必须断言：同样计算 `wouldBlockPaths`，但不实际阻断；block 模式测试必须断言这些路径被过滤/阻断。

7. **ReviewItem/cache-hit 行为**
   - cache miss：运行 freshness/audit gate 后再决定是否允许目标/entity/precision 写入。
   - cache hit：仍运行 freshness/audit gate；若 sidecar missing/stale/audit failed，不能因 cachedFiles 存在而跳过 ReviewItem。
   - ReviewItem 去重必须与现有 store 合同对齐：P0 优先采用稳定 title 编码 audit key（例如 `Coverage audit failed: <sourceId>#<auditKey>`），保证现有 `type + normalized title` 去重可生效；若改为 metadata.auditKey 去重，必须另列 store 兼容测试。
   - 对同一 source + audit failure 应去重/合并 ReviewItem metadata，避免每次 cache-hit 重复刷屏。

---

## 3. Test Spec

### 3.1 单元测试

#### `src/lib/source-sidecar-ingest.test.ts`

- feature flag disabled：返回 disabled，不调用 extract/persist/audit。
- 非 XLSX：enabled 下返回 skipped，不调用 extract/persist/audit。
- XLSX missing sidecar：调用 extract/build/persist，返回 written/fresh sidecar path。
- XLSX stale by hash：旧 sidecar hash != raw hash 时重建。
- XLSX fresh by hash：hash 一致时不重建，返回 existing/fresh。
- hash 一致 mtime 不同：不判 stale，但记录 warning/diagnostic。
- schema version 不兼容：判 stale 或 unsupported，按设计重建/ReviewItem。

#### `src/lib/xlsx-sidecar.test.ts`

- first-batch detector 能从 payload 生成 `domain_rows.first_batch`。
- detector 不能依赖文件名；必须通过表头/字段/行形态识别。
- 至少两个正例变体与两个负例普通 XLSX。
- 每条 domain row 都有 row_anchor_id 与 enterprise/project/contact/phone/source worksheet/industry/original serial 的 cell_anchor_ids。
- 无法识别的普通 XLSX 不生成 first_batch domain_rows，不抛异常，并返回 confidence/reason。
- merged/header/空行边界按 fixture 规则稳定处理。

#### `src/lib/wiki-candidate-projection.test.ts`

- first-batch domain_rows -> entityCandidates/factCandidates/evidenceRefs 完整。
- 每个关键 fact 都带 EvidenceRef，且 anchor_id 存在于 sidecar anchors。
- 空 domain_rows 返回明确空/unsupported，不生成误导性 candidate。

#### `src/lib/coverage-audit.test.ts`

- full candidate coverage -> passed。
- 缺 enterprise_name/project_name/evidenceRefs/row_anchor 等 blocking field -> failed；缺 contact/phone/industry/original_serial/source_worksheet -> needs_review 或 review missing，不得与 blocking 混淆。
- 可解释忽略项 -> ignored_with_reason，不计 blocking。
- `toCoverageAuditReviewMetadata` 包含 sourceId/auditPath/auditKey/missingCount/blockingCount/fields/anchorIds。

#### `src/stores/review-store.test.ts`

- audit failed ReviewItem metadata 可保存、合并、持久化恢复。
- 同一 sourceId + auditPath 或 stable audit key 的 ReviewItem 去重/合并。
- 非 audit ReviewItem 行为不变。

### 3.2 集成测试

#### `src/lib/ingest*.test.ts`

- block + target XLSX + cache miss + audit passed：sidecar fresh，projection/audit 被调用，允许 precision Wiki write hook。
- observe + target XLSX + cache miss + audit failed：不阻断 existing LLM FILE-block pipeline，不过滤 writtenPaths/cache，只记录 wouldBlockPaths、ReviewItem、audit artifact。
- block + target XLSX + cache miss + audit failed：不写 precision Wiki page，也不允许现有 LLM FILE-block pipeline 写入 entity/concept/target fact pages；创建 ReviewItem。
- block + target XLSX + extract failure：不写 precision Wiki page，错误进入 review/activity，原有 ingest 失败策略按既有约定处理。
- observe + unsupported XLSX schema：不阻断，只记录 wouldBlockPaths/review metadata。
- block + unsupported XLSX schema：不写 target/entity/precision pages，保留原有 source summary 行为，创建 needs_review 或 skip metadata。
- block + cache miss + audit failed：不得保存会 replay 不完整 target/entity pages 的 ingest cache。

### 3.3 回归测试

- Phase C 既有默认关闭测试继续通过。
- `src/lib/ingest.converted-source.test.ts`：默认关闭时不调用 `extractXlsxSidecarPayload`。
- `src/lib/ingest.scenarios.test.ts`：非 XLSX scenario 输出不变。
- `src/lib/source-sidecar-persist.test.ts`：sidecar path/file naming 稳定，不破坏已写 sidecar。
- `src/lib/source-sidecar-types.test.ts`：schema/type helper 兼容已有 fixture。

### 3.4 cache-hit 场景

必须单独覆盖：

1. cache hit + sidecar fresh + audit passed：不重跑 full LLM ingest，但 precision gate 通过，不创建新 ReviewItem。
2. cache hit + sidecar missing：重建 sidecar；若 audit passed，不创建 failure ReviewItem。
3. cache hit + sidecar stale：重建 sidecar；不得直接信任 cachedFiles。
4. observe + cache hit + audit failed：即使 cachedFiles 非空，也只记录 wouldBlockPaths / ReviewItem / audit artifact，不过滤 cachedFiles，不改变 cache return 行为。
5. block + cache hit + audit failed：即使 cachedFiles 非空，也创建/更新 blocking ReviewItem；不写 precision-derived Wiki page，也不得 replay 已知不完整的 target/entity pages。
6. observe + cache hit + unsupported XLSX schema：不影响原有 cachedFiles 返回路径，但创建 needs_review/unsupported metadata 与 wouldBlockPaths。
7. block + cache hit + unsupported XLSX schema：过滤/阻断 blocklist paths，不影响 source summary 安全路径。
8. 多次 cache hit + 同一 audit failed：ReviewItem 去重，不重复堆积。

### 3.5 非 XLSX 行为不变

- DOCX/PDF/TXT/MD/HTML 在 feature flag enabled/disabled 两种情况下都不调用 XLSX sidecar extract。
- DOCX-first 未提交改动涉及的文件不应被本阶段修改。
- 非 XLSX cache-hit 仍只走既有 image cascade/summary/cache 行为。
- 非 XLSX tests 的 snapshots/outputs 不因 XLSX P0 改动变化。

### 3.6 建议验证命令

```powershell
npx vitest run src/lib/source-sidecar-ingest.test.ts src/lib/xlsx-sidecar.test.ts src/lib/wiki-candidate-projection.test.ts src/lib/coverage-audit.test.ts src/stores/review-store.test.ts
npx vitest run src/lib/ingest.converted-source.test.ts src/lib/ingest.scenarios.test.ts
npx tsc --noEmit --pretty
```

若全量 typecheck 受仓库既有问题影响，执行者应记录隔离 tsconfig 或已知外部失败，不得把未验证声明为通过。

执行前/提交前 diff gate：

```powershell
git status --short
git diff --name-only
git diff --cached --name-only
```

执行者必须确认 DOCX-first 未提交文件未被本阶段修改；若 `src/lib/ingest.ts` 与其他终端冲突，应停止并重新切分。

---

## 4. ADR 初稿

### ADR：XLSX precision P0 采用 SourceSidecar-first + 阻断式 CoverageAudit gate

**状态**：Proposed  
**日期**：2026-05-15

#### Context

Phase A/B/C 已证明 XLSX row/cell sidecar 可以在 ingest 的 `loadSourceForIngest` 后、`checkIngestCache` 前生成并持久化。当前缺口是：sidecar freshness 未产品化、真实 XLSX 未自动抽取 `domain_rows`、WikiCandidate/CoverageAudit 未接入写 Wiki 行为、cache-hit 可能掩盖 missing/stale/audit failed。已知目标是关闭“第一批企业名单.xlsx”类表格事实静默丢失问题，同时不影响 DOCX-first 与非 XLSX 行为。

#### Decision

在 feature flag 开启且 source 为 XLSX 时，采用 SourceSidecar-first 流程：freshness 检查/重建 -> first-batch domain_rows extraction -> WikiCandidateProjection -> CoverageAudit。只有 audit passed 才允许自动写由该 XLSX 派生的 target/entity/precision Wiki page；missing/stale/extract failed/domain_rows unsupported/audit failed 均不得静默通过，必须通过 ReviewItem/activity metadata 暴露。在 `block` 模式下，audit 未通过时只允许 source summary 安全路径继续，不能让现有 LLM FILE-block pipeline 绕过 gate 写入目标实体/事实页面；在 `observe` 模式下仅记录 wouldBlockPaths，不阻断现有写入。

#### Drivers

1. 避免关键 row/cell facts 静默丢失。
2. cache-hit 不能绕过 sidecar freshness 与 audit。
3. 本阶段必须与 DOCX-first 隔离，并保持默认行为不变。

#### Alternatives considered

- **非阻断式 audit**：实现更轻，但仍可能写入缺失事实的 Wiki，不满足 P0。
- **只刷新 sidecar**：风险低，但不形成用户可感知闭环。
- **一次性通用表格 schema detector**：长期方向正确，但 P0 过大、测试边界不清。

#### Consequences

- 产品在 flag 开启时会更严格：部分 XLSX 不再自动写 precision Wiki，而是产生 ReviewItem。
- 需要新增/扩展 freshness 状态、ReviewItem metadata、cache-hit integration tests。
- 后续可把 first-batch detector 抽象为 domain detector registry，但 P0 不先做通用化。

#### Follow-ups

1. Architect 审查阻断策略是否符合产品预期。
2. Executor 按小提交边界实现并验证。
3. Reviewer 专门检查非 XLSX 与 DOCX-first diff 隔离。
4. 后续另开 ADR 讨论 DOCX sidecar 与 DOCX-first export 的对接方式。

---

## 5. 分阶段执行建议与小提交边界

### Phase D1：Freshness 状态模型与读取现有 sidecar

**目标**：把 `ensureXlsxSourceSidecarFresh` 从 written-only 扩展为 missing/fresh/stale/unsupported/error 可区分状态。  
**建议文件**：`src/lib/source-sidecar-ingest.ts`、`src/lib/source-sidecar-persist.ts`、测试。  
**提交边界**：只做 freshness，不接 audit/wiki write。

验收：cache-hit 前可判断 sidecar fresh/stale/missing；默认关闭/非 XLSX 不变。

### Phase D2：first-batch domain_rows extraction

**目标**：从真实 XLSX payload 生成 `domain_rows.first_batch`。  
**建议文件**：`src/lib/xlsx-sidecar.ts` 或新增 `src/lib/xlsx-domain-rows.ts`、fixture tests。  
**提交边界**：只增强 sidecar 内容，不改变 ingest 写 Wiki 行为。

验收：第一批企业名单 fixture 的关键字段与 cell anchors 完整；普通 XLSX 不误识别。

### Phase D3：Projection + CoverageAudit 产品 gate

**目标**：在 sidecar fresh 且 domain_rows recognized 后运行 projection/audit，产出 pass/needs_review/failed 决策。  
**建议文件**：`src/lib/source-sidecar-ingest.ts` 或新增 orchestration helper、`wiki-candidate-projection`/`coverage-audit` tests。  
**提交边界**：只返回决策与 metadata，不写真实 Wiki page。

验收：audit failed 可形成完整 ReviewItem metadata；audit passed 有明确 candidate/audit evidence。

### Phase D4：ReviewItem 与 cache-hit 行为接入

**目标**：cache miss/hit 都不绕过 missing/stale/audit failed；失败创建/合并 ReviewItem，并阻止 target/entity pages 通过普通 LLM 写入路径绕过 gate。  
**建议文件**：`src/lib/ingest.ts`、`src/stores/review-store.ts` tests。  
**提交边界**：只接 ReviewItem/cache-hit，不新增 precision Wiki write。

验收：cache-hit + sidecar missing/stale/audit failed 场景全部有测试；ReviewItem 使用 stable title/auditKey 去重；observe 模式只记录 wouldBlockPaths 不过滤 cache；block 模式 audit failed 不保存可 replay 不完整 target/entity pages 的 cache。

### Phase D5：precision-derived Wiki write gate

**目标**：仅 audit passed 时写入或更新 precision-derived Wiki page。  
**建议文件**：`src/lib/ingest.ts` 附近最小接入，或新增 `xlsx-precision-wiki-write.ts`。  
**提交边界**：只写目标 XLSX precision page，不改普通 source summary。

验收：audit passed 写入；audit failed/unsupported 不写；写入内容可追踪 sidecar/audit/evidenceRefs。

### Phase D6：回归收口与文档

**目标**：固化命令、风险说明、feature flag 文档、架构记录。  
**建议文件**：`.omx/plans/...` 执行记录、必要 README/内部 docs。  
**提交边界**：文档与测试补强，不混入行为改动。

验收：目标测试集通过；非 XLSX 行为不变证据明确；DOCX-first 文件未被本阶段修改。

---

## 6. 与 DOCX-first 的边界

1. **代码边界**：本计划不修改 DOCX-first 相关未提交文件；执行前后应运行 `git status`，确认只触碰 XLSX/sidecar/audit/review/ingest 测试相关文件。
2. **产品边界**：DOCX-first 是导出/文档优先路线；XLSX precision P0 是导入侧事实保真路线。两者共享未来 EvidenceAnchor 概念，但本阶段不做共享抽象重构。
3. **架构边界**：不把 first-batch domain detector 抽象成 DOCX/PDF/TXT 通用 registry；如需 registry，另开 ADR。
4. **测试边界**：DOCX 行为只验证“不变”；不新增 DOCX precision expected output。
5. **协作边界**：若发现必须改动 DOCX-first 文件才能完成 XLSX P0，应停止该提交并请求 Architect 重新切分，而不是在本分支混改。

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| audit failed 是否阻断写入存在产品争议 | 可能影响自动 ingest 体验 | 默认推荐阻断 precision-derived Wiki，仅保留原 source summary；Architect 可批准灰度旁路 |
| cache-hit 逻辑复杂 | 容易漏掉 stale/missing | 单独建立 cache-hit 测试矩阵，先测再接行为 |
| first-batch detector 过拟合 | 普通 XLSX 误判 | 不以文件名为主判定；结构化识别表头/字段/行形态；至少两个正例变体和两个负例 fixture；低置信度 unsupported |
| ReviewItem 重复 | 用户噪声 | stable audit key 去重/合并 metadata |
| DOCX-first 冲突 | 并行工作互相污染 | 执行前后 `git status`，小提交，Reviewer 检查 diff scope |

---

## 8. Architect 审查问题

1. 是否接受推荐的 **audit failed 阻断 precision-derived Wiki write** 策略？
2. `needs_review` 是否也应默认阻断，还是允许写 partial page 并显式标注？本草案建议默认阻断。
3. ReviewItem 是否足够承载 P0 用户反馈，还是需要同步增加最小 UI 文案？本草案建议 P0 先 metadata + existing review queue，UI 文案另开小提交。
4. first-batch detector 是否作为 P0 唯一 domain detector？本草案建议是，通用表格 schema detector 延后。

---

## 9. 执行分工表与后续模式

| 角色/模式 | 职责 | Write scope | 建议 reasoning | 验证责任 |
| --- | --- | --- | --- | --- |
| Architect | 审 ADR、阻断边界、allowlist/blocklist、rollout config | 只读或计划文档 | high | 确认不绕过 LLM FILE-block/cache save gate |
| Executor | 按 D1-D6 实现，每次只改一个行为层 | D1: `source-sidecar-ingest/persist`；D2: `xlsx-sidecar/xlsx-domain-rows`；D3: `coverage-audit/wiki-candidate`；D4-D5: `ingest/review-store` 最小改动 | medium/high | 每提交跑对应 targeted tests |
| Reviewer | PR-style review，检查 diff scope、默认关闭、非 XLSX 不变、DOCX-first 隔离 | 只读 | high | 审查 staged files 与测试证据 |
| Verifier | 专门验证 cache-hit、audit failed 不落 target/entity pages、非 XLSX regression | 只读或测试补充 | high | 跑 9-file target tests + cache-hit 新测试 |
| Writer | 更新执行记录、ADR、handoff docs | `.omx/plans/experiments/wiki-precision-longdoc/` | medium | 文档与实际 commit/test 一致 |

推荐执行模式：

- 默认用 `$ralph`：单 owner 顺序完成 D1-D6，适合避免共享 `ingest.ts` 冲突。
- 仅当 DOCX-first 并行压力很大且能严格分离文件时用 `$team`：一个 lane 做 D1-D3 纯库层，另一个 lane 只读准备 D4/D5 测试；不要多人同时写 `src/lib/ingest.ts`。
- goal-mode follow-up：若需要 durable 多阶段目标跟踪，使用 `$ultragoal`；本任务不是外部研究，不建议 `$autoresearch-goal`；不是性能优化，不建议 `$performance-goal`。

## 10. Handoff 建议

- Architect：优先审查 ADR decision、cache-hit failure behavior、Wiki write gate。
- Executor：按 D1-D6 小提交执行；每个提交只改变一个行为层。
- Reviewer：重点验证 feature flag 默认关闭、非 XLSX 不变、DOCX-first 未触碰、cache-hit 测试是否覆盖 missing/stale/audit failed。
- 推荐后续执行模式：若进入实现，使用 `$ralph` 单 owner 完成 D1-D6；若 DOCX-first 同时推进，使用 `$team`/明确文件边界避免冲突。对于产品化闭环，默认可用 `$ultragoal` 管理多阶段目标。

---

## 11. Architect ITERATE 修订摘要

本 v2 版本吸收 Architect 审查意见，新增或修正以下设计合同：

1. audit 未通过时，阻断对象从“precision-derived Wiki page”扩大为“该 XLSX 自动派生的 target/entity/precision pages”，防止现有 LLM FILE-block full pipeline 绕过 gate。
2. 明确 source summary 安全路径与 target/entity/precision page 边界。
3. 新增 rollout mode：`disabled` / `observe` / `block`；P0 验收以 `block` 为准，`observe` 只用于灰度采样。
4. 明确 CoverageAudit severity matrix：enterprise/project/evidence/row 对齐为 blocking；contact/phone/industry/serial/source worksheet 为 review。
5. P0 gate 不能只靠字符串包含，必须验证 candidate facts/evidenceRefs 对必填字段的消费关系。
6. ReviewItem 去重优先采用 stable title 编码 audit key，以兼容当前 `type + normalized title` 去重机制。
7. first-batch detector 不得文件名硬编码，必须基于表头/字段/行形态，并覆盖至少两个正例变体、两个负例。

---

## 12. Critic ITERATE 修订摘要

本 v3 版本吸收 Critic 审查意见，补齐执行合同：

1. Rollout config：新增 `llm-wiki.xlsxPrecisionRolloutMode`，定义与 legacy boolean flag 的 precedence 和返回类型。
2. Audit API：明确 P0 CoverageAudit 以 `rows + Pick<WikiCandidate, "entityCandidates" | "factCandidates"> + sidecar.anchors/anchorsById` 为输入，`candidateText` 只作为 legacy/diagnostic。
3. Anchor 校验：consumed check 必须有存在于 sidecar anchors 的 EvidenceRef；cell anchor 优先，row anchor 降级为 review metadata。
4. 写入 allowlist/blocklist：audit 未通过时只允许 source summary、sidecar/audit artifact、ReviewItem/activity；禁止 entity/concept/target fact pages 和普通 LLM FILE-block 绕行。
5. D5 输出合同：P0 写 `wiki/sources/<sourceBaseName>-precision.md` 单页 deterministic renderer，不直接拆写实体页。
6. 执行分工表：补齐 Architect/Executor/Reviewer/Verifier/Writer owner、write scope、验证责任，以及 `$ralph` / `$team` / `$ultragoal` 建议。

---

## 13. Critic 二轮 ITERATE 修订摘要

本 v4 版本消除 Critic 第二轮指出的 3 个执行歧义：

1. Rollout precedence：必须先解析唯一 resolved mode；新 key 合法时完全优先，legacy boolean 只作为 fallback；`disabled` 只由 resolved mode 决定。
2. Audit input signature：明确包含 `entityCandidates` 与 `factCandidates`，企业名覆盖必须消费 entity candidate evidenceRefs，不能退化为 subject/string。
3. Observe vs block：allowlist/blocklist 只在 `block` 模式实际阻断；`observe` 只记录 `wouldBlockPaths` / ReviewItem / audit artifact，不过滤 writtenPaths/cache，且不算 P0 验收通过模式。

---

## 14. Critic 三轮 ITERATE 修订摘要

本 v5 版本把 observe/block 写入策略从摘要上移到正文，并消除无 mode 限定的强阻断描述：

1. `observe` 合同：不过滤 `writtenPaths`，不阻断 existing LLM FILE-block pipeline，不改变 ingest cache save/return；只记录 `wouldBlockPaths`、audit artifact、ReviewItem、activity metadata。
2. `block` 合同：才执行 allowlist/blocklist，过滤/阻断 target/entity/precision pages，并防止保存可 replay 不完整 target/entity pages 的 cache。
3. 集成测试和 cache-hit 场景均拆成 observe 与 block 两组，避免灰度行为和 P0 验收行为混淆。
