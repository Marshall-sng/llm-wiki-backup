# RALPLAN: Slice E2-prep — DOCX FormatSpec 最低基线覆盖

Status: revised-for-critic-r2
Date: 2026-05-15
Scope: DOCX-first / high-fidelity / FormatSpec rule floor before writer tuning

## 1. 目标结果

从当前 Slice E1 的 fidelity diagnostics 结果出发，在进入 DOCX writer 样式映射优化前，先把 `行文格式（通用）20210625(1).docx` 固化为 DOCX FormatSpec 的“最低格式约束基线”。

目标不是继续堆死规则，而是让系统具备稳定的规则生成契约：

- 对正式 DOCX，FormatSpec 至少覆盖 `行文格式` 已表达的版式颗粒度。
- LLM overlay / source-specific facts 可以补充、细化、覆盖具体取值，但不能让最低约束维度消失。
- 生成的约束应服务于后续 writer 和 fidelity diagnostics，而不是直接承诺 Word/WPS 高保真结果。

## 2. 当前证据

### 2.1 `行文格式（通用）20210625(1).docx` 作为最低基线

解析结论摘要：

- 页面：A4，约 21.0cm × 29.7cm。
- 页边距存在双来源：Word XML `sectPr` 实际页面边距约上/下 2.54cm、左/右 3.17cm；文档正文规范文字写有“页边距：上3.9CM，下2.5CM，左右2.7CM”。本 Slice 将二者都记录，不能混为一个无来源值。
- 主标题：方正小标宋简体，22pt，居中，固定行距约 30pt。
- 副标题/日期/讲话人行：楷体，16pt，居中，固定行距约 30pt。
- 一级标题：`一、`，黑体，16pt，首行/段落缩进约 2 字符，固定行距约 30pt。
- 二级标题：`（一）`，楷体，16pt，缩进约 2 字符，固定行距约 30pt。
- 三级标题：`1.`，仿宋，16pt，加粗，缩进约 2 字符，固定行距约 30pt。
- 正文：仿宋，16pt，首行缩进约 2 字符，固定行距约 30pt，正式文稿对齐。
- 标题排布：多行标题存在梯形/菱形排布；多个发文机关之间用空格分隔，不使用顿号。

### 2.2 `基准素材.docx` 作为输出高保真目标样本

解析结论摘要：

- 页面：A4，约 21.0cm × 29.7cm。
- 页边距：上约 3.90cm，右约 2.70cm，下约 3.33cm，左约 2.70cm。
- 主标题：方正小标宋简体，22pt，居中，精确行距约 28.5pt。
- 日期/讲话人行：楷体_GB2312，16pt，居中。
- 一级标题：黑体，16pt，首行/段落缩进约 2 字符，精确行距约 28.5pt。
- 正文：仿宋_GB2312，16pt，首行缩进约 2 字符，精确行距约 28.5pt。

解释：`行文格式` 是最低约束覆盖面；`基准素材` 是当前视觉/样式逼近目标。两者冲突时，不以基线固定值压倒当前来源事实，而以“维度必须覆盖、值允许被来源事实特化”为原则。

## 3. RALPLAN-DR 摘要

### 3.1 原则

1. **DOCX-first 高保真**：DOCX 是当前核心闭环；后续改动必须提高或度量 DOCX fidelity。
2. **基线是地板，不是模板**：`行文格式` 定义最低规则颗粒度；来源文件可添加或特化，不应被抹平。
3. **证据优先 + 合理推理**：LLM 可在 evidence base 上推理出规则体系，但 FormatSpec 必须保持可审计、可编辑。
4. **不混淆输出承诺**：可以追求高保真，不可在未验证前承诺 Word/WPS 视觉一致。
5. **先规则闭环，后 writer 调优**：先保证 FormatSpec 足够细且不丢基线，再进入样式写入映射。

### 3.2 决策驱动

1. **覆盖度**：FormatSpec 是否至少覆盖 GB/T-like 的标题、层级、字体、字号、行距、缩进、页边距等可执行维度。
2. **稳定性**：accepted LLM overlay 是否不会把 deterministic baseline rules 整体替换掉。
3. **可验证性**：是否能通过单元测试/审计函数证明缺失维度会被发现，覆盖维度会进入 promptBlock。

### 3.3 可选方案

#### Option A：直接扩写 `buildDocxRules()`

- 做法：把 `行文格式` 的细节直接写入现有 `buildDocxRules()`。
- 优点：改动小、见效快。
- 缺点：无法防止 LLM overlay 替换全部 rules；缺少独立覆盖审计；后续容易继续演化为散乱死规则。
- 结论：不推荐作为主方案。

#### Option B：新增 DOCX FormatSpec baseline catalog + coverage audit，并接入规则合并（推荐）

- 做法：
  - 新增 DOCX baseline catalog，按“维度”而不是文字表象组织规则。
  - 新增 coverage audit，判断 spec 是否覆盖最低维度。
  - 修改 DOCX FormatSpec 生成：deterministic rules + accepted overlay + source-specific rules 合并时必须保留 baseline floor。
  - promptBlock 渲染 attributes，让 LLM 底稿生成阶段能看到明确字体、字号、行距、缩进、页边距等属性。
- 优点：
  - 解决 overlay 替换 baseline 的根因。
  - 形成可测试、可审计、可编辑的规则体系。
  - 后续 E2 writer 可直接消费更细的 attributes。
- 缺点：
  - 比直接扩写多一个 catalog/audit 模块。
  - 需要定义冲突优先级，避免 source facts 与 baseline defaults 混淆。
- 结论：推荐。

#### Option C：跳过 FormatSpec，直接改 DOCX writer 样式

- 做法：在 `docx-writer.ts` / adapter 中直接映射字体字号缩进行距。
- 优点：能更快看到导出样式变化。
- 缺点：writer 不知道哪些规则来自最低基线、哪些来自当前来源；fidelity diagnostics 无法解释缺失；可能做出不可迁移的一次性修补。
- 结论：暂不采用。

#### Option D：只把基准写入文档，不进产品代码

- 做法：追踪文件记录 `行文格式`，但不建立代码层规则。
- 优点：零实现风险。
- 缺点：无法改善生成和导出；用户每次仍需人工纠偏。
- 结论：不采用。

## 4. 推荐设计：Option B

### 4.1 新增模块

建议新增：`src/lib/docx-formatspec-baseline.ts`

职责：

1. 定义 DOCX formal writing baseline 版本：`docx-formal-writing-baseline.20210625.v0`。
2. 输出 baseline dimensions/rules。
3. 提供合并函数，确保 DOCX spec 不低于 baseline floor。
4. 提供 coverage audit，用于测试和后续 UI 展示。

建议公开接口：

```ts
export type DocxBaselineDimension =
  | "page.size"
  | "page.margin"
  | "title.main"
  | "title.subtitle"
  | "title.multiline"
  | "heading.level1"
  | "heading.level2"
  | "heading.level3"
  | "paragraph.body"
  | "list.numbering"
  | "table.readability"
  | "boundary.no-source-copy"

export interface DocxFormatSpecBaselineAudit {
  schemaVersion: "docx-formatspec-baseline-audit.v0"
  baselineVersion: string
  verdict: "pass" | "gap"
  coveredDimensions: DocxBaselineDimension[]
  missingDimensions: DocxBaselineDimension[]
  baselineFilledDimensions: DocxBaselineDimension[]
  warnings: string[]
}

export function buildDocxFormalBaselineRules(confidence?: FormatProfileConfidence): FormatSpecRule[]
export function ensureDocxFormatSpecBaseline(rules: FormatSpecRule[], options?: { confidence?: FormatProfileConfidence }): { rules: FormatSpecRule[]; audit: DocxFormatSpecBaselineAudit }
export function auditDocxFormatSpecBaseline(rules: FormatSpecRule[]): DocxFormatSpecBaselineAudit
```

### 4.2 Canonical dimension 契约（Architect R1 修订）

必须让“维度”成为一等结构化契约，而不是靠 rule 文案猜。

建议修改 `FormatSpecRule` 类型：

```ts
export interface FormatSpecRule {
  id: string
  target: string
  normType?: string
  /** Canonical coverage dimension for audit/merge. Not user-facing prose. */
  dimension?: string
  rule: string
  detail: string
  source: FormatSpecRuleSource
  confidence: FormatProfileConfidence
  evidenceRefs?: string[]
  attributes?: FormatSpecRuleAttribute[]
}
```

约束：

- DOCX baseline rules 必须填写 `dimension`。
- DOCX deterministic rules 应尽量填写 `dimension`。
- LLM overlay 若没有 dimension，进入 merge 时可按 `target/normType/id` 做兼容映射；无法映射的不参与 baseline 覆盖，只作为补充规则保留。
- 旧快照无 dimension 时，audit 可 fallback 到 `id/target/normType/attributes`，但新测试不得依赖文案匹配。

### 4.3 Baseline 维度

最低需要覆盖以下维度，维度名用于审计，不依赖 rule 文案：

1. `page.size`：A4 / 21.0cm × 29.7cm。
2. `page.margin`：上/下/左/右页边距。source-of-truth 必须区分 `detected-layout`（Word XML sectPr 实际值）与 `instructional-format-text`（文档正文规范文字值）；若两者冲突，attributes 同时保留并记录 warning，不由本 Slice 判定谁覆盖谁。
3. `title.main`：主标题字体、字号、居中、行距。
4. `title.subtitle`：副标题/日期/讲话人行字体、字号、居中、行距。
5. `title.multiline`：多行标题排布和发文机关分隔规则。
6. `heading.level1`：`一、`，黑体，16pt，缩进，行距。
7. `heading.level2`：`（一）`，楷体，16pt，缩进，行距。
8. `heading.level3`：`1.`，仿宋，16pt，加粗，缩进，行距。
9. `paragraph.body`：仿宋，16pt，首行缩进 2 字符，行距，对齐。
10. `list.numbering`：同层同形、编号连续，不混用层级。
11. `table.readability`：若目标底稿含表格，表格承载清单/对照/矩阵，表头字段化，证据不足不强制造表。
12. `boundary.no-source-copy`：格式规则不允许把来源格式文件正文/候选标题直接塞进目标底稿。

### 4.4 规则属性表达

每条 baseline rule 尽量携带 `attributes`，例如：

- `fontFamily: 方正小标宋简体`
- `fontSizePt: 22`
- `alignment: center`
- `lineSpacingPt: 30`
- `firstLineIndentChars: 2`
- `numberingPattern: 一、`
- `pageWidthCm: 21`
- `pageHeightCm: 29.7`
- `marginTopCm.detectedLayout: 2.54`
- `marginTopCm.instructionalText: 3.9`
- `marginConflict: detected-layout-vs-instructional-format-text`

属性 source 应为 `standard-default`，confidence 通常为 `high` 或 `medium`。其中页边距属性必须显式标注来源语义：`detected-layout` 表示 DOCX XML 实际值，`instructional-format-text` 表示格式说明正文写明的规范值；冲突只能以 warning 暴露，不能悄悄选边。

### 4.5 合并优先级与伪代码（Architect R1 修订）

FormatSpec 合并时采用以下优先级：

1. 用户编辑后的 FormatSpec promptBlock 作为最终文本约束，但不改变 canonical `spec.rules`。
2. 当前来源/画像的 detected facts，可特化具体值。
3. accepted LLM overlay 的 inferred/detected format rules，可补充解释和细化维度。
4. `行文格式` baseline floor，补齐缺失维度。
5. 通用安全边界。

核心原则：baseline audit 检查的是“维度覆盖”，不是强制所有值等于 `行文格式`。例如 `基准素材` 的页边距不同于 `行文格式`，只要当前来源事实已经提供 `page.margin` 维度，就视为覆盖；baseline 不应覆盖该 detected 值。

建议伪代码：

```ts
function mergeDocxRulesWithBaseline(detectedRules, synthesizedRules, confidence) {
  const baselineRules = buildDocxFormalBaselineRules(confidence)
  const merged = []
  const covered = new Set()

  for (const rule of [...detectedRules, ...synthesizedRules]) {
    const dimension = normalizeDocxRuleDimension(rule)
    merged.push(dimension ? { ...rule, dimension } : rule)
    if (dimension && isBaselineDimension(dimension)) covered.add(dimension)
  }

  for (const baselineRule of baselineRules) {
    if (!covered.has(baselineRule.dimension)) {
      merged.push(baselineRule)
    }
  }

  const deduped = dedupeByIdPreservingOrder(merged)
  return { rules: deduped, audit: auditDocxFormatSpecBaseline(deduped) }
}
```

冲突策略：

- detected source facts 优先保留具体 attributes。
- synthesized overlay 可补充同一 dimension 的解释，但不得删除 baseline dimension。
- baseline 只补缺失 dimension；不覆盖已检测到的来源值。
- coverage 以 `dimension` 判断；返回 rules 以稳定 `id` 去重并保持顺序。安全边界不参与取值覆盖；同一 dimension 的 detected 与 overlay 可以共存，baseline 只在该 dimension 完全缺失时补入。


### 4.5.1 Canonical dimension normalization 映射表（Critic R1 修订）

overlay 或旧 deterministic rule 没有 `dimension` 时，只允许按下表做保守映射：

| 输入线索 | 映射 dimension | 规则 |
|---|---|---|
| `target=page` 且 attributes 含 `pageWidthCm/pageHeightCm` 或 id 含 `page-size` | `page.size` | 可算 covered |
| `target=page` 且 attributes 含 `margin*` 或 id 含 `margin` | `page.margin` | 可算 covered；页边距冲突需 warning |
| `target=page` 但无 size/margin 可区分属性 | 无 | 仅保留补充规则，不算 baseline covered |
| `target=title` 且 normType/id 指向 `main/title` | `title.main` | 可算 covered |
| `target=title` 且 normType/id 指向 `subtitle/date/speaker` | `title.subtitle` | 可算 covered |
| `target=title` 且 id/detail 指向 multiline/issuing-org spacing | `title.multiline` | 可算 covered |
| `target=title` 但无法区分 main/subtitle/multiline | 无 | 仅保留补充规则，不算 baseline covered |
| `target=heading` 且 normType/id 为 level1/h1/heading-1 | `heading.level1` | 可算 covered |
| `target=heading` 且 normType/id 为 level2/h2/heading-2 | `heading.level2` | 可算 covered |
| `target=heading` 且 normType/id 为 level3/h3/heading-3 | `heading.level3` | 可算 covered |
| `target=heading` 但无法区分层级 | 无 | 仅保留补充规则，不算 baseline covered |
| `target=paragraph/body` 或 normType/id 指向 body | `paragraph.body` | 可算 covered |
| `target=numbering/list` 或 id 含 numbering | `list.numbering` | 可算 covered |
| `target=table` 且 id/normType 指向 readability | `table.readability` | 可算 covered |
| `target=boundary` 且 id 指向 source-copy/source-boundary | `boundary.no-source-copy` | 可算 covered |
| 其他无法确定映射 | 无 | 保留，但不计入 baseline coverage |

禁止用 rule/detail 的大段自然语言模糊猜测 dimension；只能使用 `dimension`、`target`、`normType`、`id` 和结构化 attributes。

### 4.6 Editable FormatSpec promptBlock 边界（Architect R1 修订）

当前已有“用户编辑 FormatSpec promptBlock”机制。本 Slice 不改变其最高优先级，但明确边界：

- baseline coverage audit 的对象是 canonical `spec.rules`，不是用户编辑后的纯文本 promptBlock。
- 用户编辑 promptBlock 是最终给 LLM 的文本约束；如果用户删掉 baseline-derived 文本，系统不阻止，但应在 summary/warnings 中记录“用户编辑文本可能弱化 baseline 表达”。
- 本 Slice 只需要在计划/测试中确保 canonical rules 不因 editable prompt 消失；UI 展示该 warning 放入后续 E3。

### 4.7 接入点

修改 `src/lib/format-profile-types.ts`：

- 给 `FormatSpecRule` 增加可选 `dimension?: string`，保持旧数据兼容。

修改 `src/lib/format-spec.ts`：

- `buildDocxRules(profile)` 继续生成 source-aware deterministic DOCX rules，但应增加/保留 attributes 和 dimension。
- `buildFormatSpec(profile)` 对 DOCX 不再用 `synthesizedRules.length ? synthesizedRules : rulesFor(profile)`。
- 改为：
  - 非 DOCX 保持现有逻辑。
  - DOCX 使用 `ensureDocxFormatSpecBaseline([...rulesFor(profile), ...synthesizedRules])` 或等价 merge。
- `summaryLines` 可提示“DOCX FormatSpec 已应用正式文稿最低基线覆盖”。

修改 `src/lib/docx-fidelity-diagnostics.ts`：

- source inventory / expectation dimension 应优先使用 `rule.dimension ?? inferDimension(rule)`。
- 保留当前 `inferDimension()` 作为旧规则和旧快照兼容 fallback。

### 4.8 Writer/export 边界（Architect R1 修订）

本 Slice 不承诺 writer/export 已消费 attributes。

- 本 Slice 验收只承诺：`rules`、`promptBlock`、E1 diagnostics source inventory 能读到 dimension/attributes。
- `docx-export-contract.ts` 当前会丢弃 attributes；这不是本 Slice 必修项。
- 下一 Slice E2 writer tuning 再决定是否把 attributes 传入 `DocxExportRule` / intermediate / writer。

### 4.9 测试设计

新增/扩展测试：

1. `src/lib/docx-formatspec-baseline.test.ts`
   - baseline catalog 至少包含上述 12 个维度。
   - 每个核心维度含关键 attributes。
   - audit 能识别缺失维度。
   - ensure 函数能补齐缺失维度。
   - source-specific rule 已覆盖某 dimension 时，baseline 不覆盖其 attributes。

2. `src/lib/format-spec.test.ts`
   - DOCX no-overlay：`buildFormatSpecSnapshot()` 输出包含 baseline dimensions 和 attributes。
   - DOCX accepted overlay 只有 1 条 rule：最终 spec 仍保留 baseline dimensions，验证 overlay 不再整体替换 baseline。
   - source-specific detected rule 覆盖 baseline dimension 时，audit 通过且不强制替换 detected value。
   - promptBlock 中出现关键属性，例如字体、字号、行距、缩进、页边距。
   - editable promptBlock 启用时，canonical `formatSpec.rules` 仍保留 baseline dimensions；可记录 summary/warning，但不阻止用户编辑。
   - `docx-fidelity-diagnostics.test.ts` 增加 canonical dimension 覆盖：当 rule 含 `dimension` 时，source inventory 优先采用该字段，而不是字符串启发式。

3. 回归测试：
   - `src/lib/draft-processing.test.ts`
   - `src/lib/docx-fidelity-diagnostics.test.ts`
   - `src/lib/docx-export-contract.test.ts`
   - `src/lib/docx-writer.test.ts`

4. 全局验证：
   - `npm run typecheck`
   - `npm run build`

### 4.10 验收标准

本 Slice 通过的定义：

- DOCX FormatSpec 的最低维度覆盖不低于 `行文格式（通用）20210625(1).docx`。
- `FormatSpecRule.dimension` 成为 baseline audit/merge 的主要结构化契约。
- accepted LLM overlay 不再导致 baseline rules 消失。
- promptBlock 能显示可执行 attributes，而不是只有笼统描述。
- fidelity diagnostics 后续可从 FormatSpec rules/attributes 读到更细的 source expectations。
- 没有恢复手动模板路线。
- 没有自动覆盖用户文件。
- 没有新增 Word/WPS 高保真承诺；只记录可验证的规则覆盖和导出行为。

## 5. 非目标

本 Slice 不做：

- 不调整 writer 的实际 OpenXML 样式写入映射；那是后续 E2 writer tuning。
- 不新增 `DocxExportRule.attributes` 传递；`docx-export-contract.test.ts` / `docx-writer.test.ts` 只作为回归，不因本 Slice 目标改变 export/writer 行为。
- 不接 UI 展示；那是 E3。
- 不扩展 XLSX/PPTX。
- 不把 `行文格式` 作为唯一模板强套所有来源。
- 不在 repo 中保存用户提供的解密密码。

## 6. 风险与缓解

1. **风险：baseline 变成新的死规则。**
   - 缓解：以 dimension + attributes 组织，允许 source facts 和用户编辑覆盖具体值。

2. **风险：source facts 与 baseline defaults 冲突。**
   - 缓解：audit 检查维度覆盖；detected source facts 优先，baseline 只补缺。

3. **风险：rules 重复或 prompt 过长。**
   - 缓解：coverage 按 dimension 判断，但返回 rules 按稳定 id 去重；promptBlock attributes 限制当前已有 slice 行为，最多展示关键属性。

4. **风险：规则覆盖通过但视觉仍不相似。**
   - 缓解：本 Slice 只声明规则/约束覆盖；writer 高保真效果必须由后续 E2/E3 的导出与人工/自动验证证明。

5. **风险：用户编辑 promptBlock 弱化 baseline。**
   - 缓解：canonical rules 保留 baseline；文本编辑只影响最终 prompt，后续 UI 用 warning 告知用户。

## 7. 执行路径建议

### Ralph 单人执行

适合本 Slice，因为主要是 lib 层小范围架构修复 + 测试。

建议顺序：

1. 给 `FormatSpecRule` 增加可选 `dimension`。
2. 新增 baseline catalog/audit 模块与测试。
3. 接入 `format-spec.ts` 的 DOCX merge。
4. 增加 overlay 不替换 baseline 的回归测试。
5. 跑 targeted tests。
6. 跑 typecheck/build。
7. 更新 `docx-fidelity-diagnostics.ts` 让 source inventory 优先读取 `rule.dimension`，并补测试。
8. 更新核心追踪文件和 active plan：
   - `.omx/plans/active/docx-first-formal-export-plan.md`
   - `.omx/plans/requirements/migration-decision-log.md`
   - `.omx/plans/requirements/migration-traceability-matrix.md`
   - 如执行中新增/调整切片计划，补充 `.omx/plans/active/` 下对应计划文件。

### Team 执行

不推荐本 Slice 用 team；并行收益有限，容易在 `format-spec.ts` 产生冲突。

如必须 team：

- Lane A：baseline catalog/audit。
- Lane B：format-spec integration。
- Lane C：tests/review。

## 8. ADR

Decision: 采用 Option B，新增 DOCX FormatSpec baseline catalog + coverage audit，并接入 DOCX FormatSpec 规则合并；同时把 canonical `dimension` 加入 `FormatSpecRule` 作为覆盖审计契约。

Drivers: 覆盖度、稳定性、可验证性。

Alternatives considered:

- Option A 直接扩写 `buildDocxRules()`：见效快但不解决 overlay 替换问题。
- Option C 直接改 writer：可能快，但缺少可审计规则基础。
- Option D 只记录不产品化：不能改善用户结果。

Why chosen: Option B 最小化实现范围，同时解决当前根因：规则颗粒度不足与 overlay 替换 baseline。`dimension` 让覆盖判断从文本启发式变成结构化契约。

Consequences:

- E2 writer tuning 将有明确 rules/attributes 输入。
- 后续 UI 可展示 baseline coverage audit。
- 需要维护 baseline version 和覆盖维度。
- 增加一个向后兼容的可选字段 `FormatSpecRule.dimension`。

Follow-ups:

1. Slice E2：DOCX writer style mapping 优先消费 title/heading/body/page attributes。
2. Slice E3：UI 展示 fidelity gaps 与 baseline coverage，并允许用户编辑 FormatSpec。
3. 后续：在有足够 DOCX 样本后扩展 baseline catalog，但不得低于 `行文格式` 覆盖面。


## 9. Consensus Review Record

- Architect Round 1: ITERATE — required canonical dimension, merge semantics, editable prompt boundary, writer/export follow-up boundary.
- Architect Round 2: ITERATE — required dedupe/audit order fix and diagnostics `rule.dimension` intake.
- Architect Round 3: APPROVE.
- Critic Round 1: ITERATE — required page margin dual-source boundary, hard export/writer scope, normalization mapping table, explicit tracking paths.
- Architect Re-review: APPROVE.
- Critic Final: APPROVE.

Terminal decision: APPROVED FOR EXECUTION. Stop planning here; next lane should be implementation via Ralph/solo execution using this artifact as the source of truth.
