# RALPLAN Planner Draft: Slice E3b — DOCX-first 高保真闭环第一轮收敛

## 0. 任务边界

目标：基于用户提供的 DOCX OpenXML 对比结果，设计一个先可测试、再实施的 Slice E3b 收敛计划，修复四类差异：
1. 全文主标题与“一、二、三”一级标题样式混淆。
2. 普通清单/可见编号被过度转换为 Word 自动编号。
3. 行距输出 600 twips 与基准 570 twips 差距。
4. header/footer 距离 StyleFacts 已有但 writer 未消费。

硬约束：
- 不恢复手动模板路线。
- 不自动覆盖用户文件。
- 不承诺像素级 Word/WPS 等价。
- 不扩展 XLSX/PPTX。
- 先形成可测试计划；本草案不实现。

已核对代码触点：
- `src/lib/docx-intermediate.ts`：将 draft 映射为 `documentTitle` / `heading` / `paragraph` / `list` / `table`，当前中文“一、”直接为 level 1 heading；连续数字行会生成 ordered list；冒号后的 bare-list 会保守恢复为 ordered list。
- `src/lib/docx-format-style.ts`：解析 FormatSpec 到 writer style policy；默认各文本维度 `lineSpacingTwips: 600`；page policy 目前只有 size/margin。
- `src/lib/docx-ts-adapter.ts`：用 `docx` npm 包输出 styles/document/numbering；list block 总是写 `numbering`；section 只写 `page.size` 与 `page.margin`。
- `src/lib/docx-stylefacts-format-attributes.ts`：从 StyleFacts 生成可执行 FormatSpec；当前 page 只导出 size/margin，heading level1 选择逻辑可能把 Heading1/Title 候选混淆；body rule 固定追加 `lineSpacingPt: 30`。
- `src/lib/docx-fidelity-diagnostics.ts`：诊断目前只粗略计数 spacing/list/page margins，缺少 line value、header/footer distance、list conversion intent 的属性级判断。
- `src/lib/format-spec.ts`：仅 DOCX 分支接入 StyleFacts executable rules；边界文案已强调非模板回放/非像素级等价。

## 1. RALPLAN-DR

### 原则
1. DOCX-first：只沿 StyleFacts → FormatSpec → intermediate → writer → diagnostics 闭环收敛，不回退到手工模板复制。
2. 结构语义优先于外观猜测：标题、章节标题、普通可见编号、自动编号必须由明确结构意图区分。
3. 属性级可验证：每个修复点都要能从 OpenXML XML 断言中观察到，不依赖 Word/WPS 渲染截图承诺。
4. 安全非覆盖：导出仍产生新 bytes/记录，不自动覆盖用户源文件或目标文件。
5. 限定 DOCX：不得把本切片外溢到 XLSX/PPTX/PDF 规则或 UI 大改。

### 决策驱动（Top 3）
1. 对用户对比差异的直接收敛度：四个问题必须各有可观察验收指标。
2. 回归风险控制：标题/编号启发式是高误伤区，优先增加中间层意图与测试夹具，再改 writer。
3. 实现切片可落地：限制在列出的 DOCX 库文件和现有 vitest/JSZip OpenXML 检查内完成。

### 可行方案及取舍

#### 方案 A：最小 writer patch
只在 writer/formatter 层调默认行距、加 header/footer margin、减少 list numbering 输出；标题样式用现有 block 类型。
- 优点：代码改动少，见效快。
- 缺点：不能根治“可见编号 vs 自动编号”和“主标题 vs 一级标题”的语义混淆；诊断仍无法解释为什么差异收敛；容易把正文编号都降级或把章节标题误伤。
- 适用：临时热修，不适合作为 E3b 闭环第一轮。

#### 方案 B：中间表示引入结构意图 + 属性级 StyleFacts 闭环（推荐）
在 `docx-intermediate.ts` 明确记录标题/列表来源与 `autoNumberingIntent`；在 StyleFacts/FormatSpec 增补 title/heading 候选去冲突、lineSpacing/header/footer page attrs；writer 按 intent 决定 Word 自动编号或普通段落文本；diagnostics 提取段落级 OpenXML facts 并做属性级断言。
- 优点：四个问题都有源头、消费、验证闭环；保留 DOCX-first 边界；回归测试可以覆盖误判。
- 缺点：涉及 5-6 个文件，需谨慎迁移 block schema 或保持兼容可选字段。
- 适用：本 Slice E3b 的第一轮可测试收敛。

#### 方案 C：OpenXML sidecar/后处理器
继续用当前 adapter 生成，再用 OpenXML XML 后处理修正样式、编号、sectPr。
- 优点：可直接操作 XML，容易精确写 `w:header`/`w:footer`/`w:spacing`。
- 缺点：引入额外管线复杂度，接近模板/后处理路线；与现有 `docx` adapter abstraction 张力较大；调试和浏览器安全性风险更高。
- 适用：仅当本轮已通过 `docx` writer 设置 header/footer 等属性但输出 XML 仍缺失，或编号控制无法由现有 adapter 表达时，作为后续受限 fallback；E3b 第一轮不首选。

## 2. 推荐方案

采用方案 B：在不改执行路线、不覆盖用户文件、不追求像素级等价的前提下，做“语义意图 + 属性级 StyleFacts + OpenXML 诊断”的 DOCX-first 收敛。

ADR 摘要：
- Decision：为 E3b 增加 DOCX 中间层结构意图字段、StyleFacts page/spacing executable attrs、writer 消费逻辑和诊断断言。
- Drivers：四个差异均需可测试；标题/编号误判风险高；保持 DOCX-only 与非模板回放边界。
- Alternatives considered：A 最小 writer patch（太脆弱）；C OpenXML 后处理（管线复杂且偏离当前路线）。
- Why chosen：方案 B 在现有文件触点内形成闭环，最符合“先可测试计划”和产品边界。
- Consequences：会增加中间层 schema 可选字段和测试夹具；诊断会从粗粒度计数升级到部分属性匹配。
- Follow-ups：`docx` 包类型已支持 section margin 的 header/footer 字段；本轮直接计划写入与 XML 断言。只有类型可写但输出 XML 缺失时，才记录 blocker 并评估受限 XML patch。

## 3. 实施切片

### Slice 1 — 回归夹具与当前差异锁定
文件：`src/lib/docx-intermediate.test.ts`, `src/lib/docx-ts-adapter.test.ts`, `src/lib/docx-format-style.test.ts`, `src/lib/docx-stylefacts-format-attributes.test.ts`, `src/lib/docx-fidelity-diagnostics.test.ts`, `src/test-helpers/docx-stylefacts-profile-fixtures.ts`
- 增加一个 E3b fixture：包含文档主标题、`一、...`/`二、...`一级标题、普通“1.”可见编号段落、真正连续有序清单、body line spacing 28.5pt/570twips、page margins + header/footer distances。
- 先写 failing/expectation tests，锁定：主标题使用 Title；`一、`使用 Heading1；普通可见编号不出现 `w:numPr`；真正 list 才出现 `w:numPr`；spacing line=570；`w:pgMar` 含 header/footer。

### Slice 2 — 标题分类与 StyleFacts title/heading selector 去冲突
文件：`src/lib/docx-intermediate.ts`, `src/lib/docx-stylefacts-format-attributes.ts`, tests
- 保持 `documentTitle` 与 `heading.level1` 分离：plain first title / markdown H1 title 仍为 `documentTitle`；裸 `一、`仅为 heading level1。
- 给 block 增加兼容可选 provenance，例如 `roleSource?: "markdown-heading" | "plain-title" | "chinese-section" | ...`，用于诊断，不改变既有 block type。
- StyleFacts selector 必须去冲突：`title.main` 与 `heading.level1` 不得选择同一个 style candidate；若最高分候选相同，按更强证据分配给 title 或 heading，另一个必须选择次优且仍满足阈值，否则回退 baseline。
- 明确规则：源样式名/ID 为 `Heading1` 不能自动等同全文主标题；`Heading1` 默认更偏向 `heading.level1`，只有同时具备 title 语义证据（例如 name/title token、显示标题字体/字号显著、usage/outline 与标题匹配）时才可作为 `title.main` 候选。
- `selectTitleCandidate` 与 `selectHeading1Candidate` 需要共享 candidate ownership/排他决策，而不是独立排序后可能返回同一对象。
- 增加测试覆盖：`# 一、背景` 不能变成 documentTitle；首行普通标题 + 后续 `一、背景` 样式不混淆；StyleFacts 中 `Heading1` 与 `Level1` 并存时 title/heading 选择不同 candidate；只有 `Heading1` 时不得把其同时用于 title.main 和 heading.level1。

### Slice 3 — 编号/清单意图收敛
文件：`src/lib/docx-intermediate.ts`, `src/lib/docx-ts-adapter.ts`, diagnostics/tests
- 定义兼容可选 schema：
  - `DocxAutoNumberingIntent = "none" | "visible-number-text" | "auto-list" | "recovered-bare-list"`。
  - paragraph block 可带 `autoNumberingIntent?: "none" | "visible-number-text"`。
  - list block 可带 `autoNumberingIntent?: "auto-list" | "recovered-bare-list"`，并保留 `ordered`。
  - 默认值为 `"none"`；旧记录缺失字段按旧结构读取，但 writer 不应因缺失字段推断强自动编号意图。
- 移除“连续同模式即可自动编号”的充分条件：连续同模式只能作为弱信号，不足以单独输出 `w:numPr`。
- 默认策略：没有强证据时，`1. xxx` 保留为普通 paragraph 可见文本，不写 `w:numPr`。
- 强证据限定为：显式 Markdown ordered list 语法且产品约定允许；FormatSpec/StyleFacts 中存在可执行 list.numbering/numbering rule 并且内容形态明确为 list；或 bare-list recovery 已满足冒号引导等保守条件。具体实现时必须在测试中固定这些门槛。

编号意图决策表（默认：无强证据 => `visible-number-text` 或普通 paragraph，不写 `w:numPr`）：

| 输入形态/证据 | 判定 | 输出 intent | Writer 行为 |
| --- | --- | --- | --- |
| 单行 `1. xxx`，无 FormatSpec/StyleFacts 强证据 | 普通可见编号文本 | `visible-number-text` | paragraph 保留 `1. xxx`，不写 `w:numPr` |
| 多行连续 `1.`, `2.`, `3.`，无其他强证据 | 连续性仅为弱信号，不足以自动编号 | `visible-number-text` | 每行或合并后的 paragraph 保留可见编号文本，不写 `w:numPr` |
| 多行非连续 `1.`, `3.` 或混合 `1.`/`一、` | 非自动列表 | `visible-number-text` | 保留原文本，不写 `w:numPr` |
| 冒号引导 bare-list（如“包括：”后多条短项）且通过现有 conservative recovery | 恢复型列表 | `recovered-bare-list` | 可写 decimal `w:numPr`，并保留 diagnostics `bare-list-recovered` |
| 明确 FormatSpec `list.numbering` / numbering rule + 内容形态明确为 list | 强证据自动列表 | `auto-list` | 写 `numbering` / `w:numPr` |
| StyleFacts numbering rule/numberingDefinitions 仅证明来源有编号定义，但当前内容不是明确 list | 证据不足，不能单独触发 | `visible-number-text` | 保留文本，不写 `w:numPr` |
| StyleFacts numbering rule + 当前 block 已由显式 list 语法或 conservative recovery 识别为 list | 强证据增强 | `auto-list` 或 `recovered-bare-list` | 写 `w:numPr`，诊断记录来源证据 |
- `docx-ts-adapter.ts` 仅对 `autoNumberingIntent` 为 `"auto-list"` 或经确认的 `"recovered-bare-list"` block 写 `numbering`；`visible-number-text` 段落原样输出文本，不写 `w:numPr`。
- diagnostics 增加 “unexpected auto numbering” gap：若 source/intermediate 没有自动编号 intent 但段落 XML 出现 `w:numPr`，标记 unverified/partial gap 并指出具体段落 text/pStyle/numPr。

### Slice 4 — 行距 570 属性消费
文件：`src/lib/style-facts.ts`, `src/lib/style-facts.test.ts`, `src/lib/docx-stylefacts-format-attributes.ts`, `src/lib/docx-stylefacts-format-attributes.test.ts`, `src/lib/docx-format-style.ts`, `src/lib/docx-format-style.test.ts`, `src/lib/docx-ts-adapter.ts`, `src/lib/docx-ts-adapter.test.ts`, diagnostics/tests
- 明确 source/priority：优先消费 StyleFacts 中确定性 spacing line value（twips 优先，例如 `lineSpacingTwips=570`）；若只有 point 值则换算为 twips；若两者皆无才回退 formal baseline/default。
- 明确 applicable dimensions：`title.main`、`heading.level1`、`heading.level2`、`heading.level3`、`paragraph.body` 均可有 `lineSpacingTwips`；本轮至少覆盖用户差异中的 body/heading/title 相关维度，不能只修正文。
- StyleFacts parser path：在 `src/lib/style-facts.ts` 的 DOCX `styles.definitions.value[]` 中保留 style definition spacing 字段，优先路径为 `styles.definitions.value[].spacing.lineTwips`（兼容 `lineSpacingTwips` / raw OpenXML `spacing.line` 字段），并在 `src/lib/style-facts.test.ts` 断言该字段进入 sanitized StyleFacts 且不泄漏正文样本。
- StyleFacts fixture path：`src/test-helpers/docx-stylefacts-profile-fixtures.ts` 支持各维度 spacing：例如 `titleLineSpacingTwips`, `headingLineSpacingTwips`, `bodyLineSpacingTwips`，落到对应 style definition candidate 的 spacing 字段。
- FormatSpec executable attrs 使用统一属性名 `lineSpacingTwips`，必要时保留 `lineSpacingPt` 作为低优先级兼容输入。
- `docx-stylefacts-format-attributes.ts` 不再无条件固定 body `lineSpacingPt: 30`；如果来源给出 570，则输出 `lineSpacingTwips: 570`。
- `docx-format-style.ts` resolver 支持 `lineSpacingTwips` 与 `lineSpacingPt` 两种属性，优先 twips，避免 570→28.5→rounding 漂移。
- writer 继续用 `LineRuleType.EXACTLY`，但测试断言具体 XML 值：对应 style/paragraph 的 `<w:spacing ... w:line="570" ...>`；不接受只断言 spacing count。
- diagnostics 从 spacingCount 升级到提取每段/每 style spacing line values，能报告 expected 570 vs observed 600，并关联到 title/heading/body 维度。

### Slice 5 — header/footer distance 消费
文件：`src/lib/style-facts.ts`, `src/lib/style-facts.test.ts`, `src/lib/docx-stylefacts-format-attributes.ts`, `src/lib/docx-stylefacts-format-attributes.test.ts`, `src/lib/docx-format-style.ts`, `src/lib/docx-format-style.test.ts`, `src/lib/docx-ts-adapter.ts`, `src/lib/docx-ts-adapter.test.ts`, diagnostics/tests
- StyleFacts parser path：使用现有 `layout.marginsTwips.value` 承载 header/footer，扩展为 `{ top, right, bottom, left, header, footer }`；不新增独立 `layout.headerFooterTwips` fact，避免 page 维度扩散。
- 文件触点：`src/lib/style-facts.ts` 读取 probe `style.page.marginsTwips.header/footer` 并保留到 `layout.marginsTwips.value.header/footer`；`src/lib/style-facts.test.ts` 增加 DOCX page margins fixture，断言 header/footer 被保留且 evidence refs 指向 page evidence。
- 扩展 StyleFacts fixture/input：`src/test-helpers/docx-stylefacts-profile-fixtures.ts` 的 `marginsTwips` 支持 `header` / `footer`，并携带 evidence refs。
- FormatSpec attrs：挂在 `page.margin` 规则中，新增 `headerDistanceTwips`、`footerDistanceTwips`，来源分别为 `layout.marginsTwips.value.header` / `layout.marginsTwips.value.footer`，与 `marginTopTwips` 等同一 page margin policy 读取，减少维度扩散。
- 扩展 `DocxResolvedPagePolicy`：`headerTwips?: number`, `footerTwips?: number`；resolver 从 page margin attrs 直接读取并保留到 policy。
- writer 直接在 section page margin 写入 header/footer 距离，因为 `docx` package 类型支持 margin `header` / `footer` 字段；本轮不把“不支持类型”作为默认 blocker。
- XML 断言必须具体：`word/document.xml` 的 `w:pgMar` 同时包含来源值 `w:header="..."` 与 `w:footer="..."`，并保留 top/right/bottom/left。
- 只有当 resolver policy 已有 header/footer 且 writer 调用已设置，但输出 XML 仍缺失 `w:header`/`w:footer` 时，才记录 blocker 并评估后续受限 XML patch；不得提前转向后处理路线。
- diagnostics 提取 `w:pgMar` 的 top/right/bottom/left/header/footer 全字段，支持 expected-vs-observed 报告。

### Slice 6 — 闭环诊断与段落级事实提取
文件：`src/lib/docx-fidelity-diagnostics.ts`, `src/lib/docx-fidelity-diagnostics.test.ts`, `src/lib/format-spec.ts`, tests
- diagnostics 必须从 `word/document.xml` 提取 paragraph-level facts，而不是只计数：每个段落至少包含 `text`, `pStyle`, `hasNumPr`/`numPr`, paragraph-level `spacing`（含 `line`/`lineRule`，若存在）。
- diagnostics 同时提取 style-level spacing facts，用于样式继承场景下判断 title/heading/body 的实际 line value。
- diagnostics 必须提取 section page facts：`pgMar.top/right/bottom/left/header/footer`。
- 对四个 E3b 维度生成具体 reason/evidence：title vs heading pStyle、unexpected numbering paragraph facts、spacing expected-vs-observed values、header/footer expected-vs-observed values。
- 最小 diagnostics 输出 schema（可作为 `DocxFidelityExportedFacts` 的扩展字段）：
  ```ts
  paragraphFacts: Array<{
    index: number
    text: string
    pStyle?: string
    hasNumPr: boolean
    numId?: string
    ilvl?: string
    spacing?: { line?: string; lineRule?: string; before?: string; after?: string }
  }>
  styleSpacingFacts: Array<{
    styleId: string
    name?: string
    spacing?: { line?: string; lineRule?: string; before?: string; after?: string }
  }>
  pgMarFacts?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
    header?: string
    footer?: string
  }
  bucketInputs: Array<{
    dimension: string
    expected?: unknown
    observed?: unknown
    evidenceRefs: string[]
  }>
  ```
- bucket 策略：属性值匹配才可 restored；仅存在节点/count 但值不匹配为 partial；没有来源属性但观察到输出为 unverified；来源期望存在但 XML 缺失为 missing。`bucketInputs` 必须记录用于判定的 expected/observed，避免隐藏启发式。
- 保留 `format-spec.ts` 现有边界：DOCX writer 规则、非模板回放、非视觉等价；不加入“像素级一致”承诺。

## 4. 验收标准

1. 标题样式：E3b fixture 导出的 `document.xml` 中主标题段落引用 `Title`，`一、/二、`段落引用 `Heading1`；二者文本各只进入对应结构角色；StyleFacts selector 不得让 `title.main` 与 `heading.level1` 共享同一 candidate，且 `Heading1` 不自动等同主标题。
2. 编号控制：普通可见编号段落保留 `1. xxx` 文本且不含 `w:numPr`；没有强证据时默认 paragraph visible text；只有带明确 `autoNumberingIntent` 的真正 ordered list 才含 `w:numPr` 和 decimal numbering。
3. 行距：适用维度（至少 body/heading/title fixture 覆盖项）XML 输出具体 `w:spacing w:line="570"`（或等价 XML 表达），断言具体值而非 count，不再回落到 600。
4. Header/footer：section `w:pgMar` 输出来源 StyleFacts 的 `w:header` 与 `w:footer` 距离；缺失来源时保留默认且 diagnostics 不误报 restored。
5. 诊断：`buildDocxFidelityDiagnostics` 能提取 paragraph facts（text+pStyle+numPr+spacing）与 pgMar header/footer，并对上述四项给出 restored/partial/missing/unverified 与具体 reason，不依赖粗粒度 count。
6. 安全边界：没有测试或代码路径自动覆盖用户文件；adapter warnings 仍包含非像素级声明；不改 XLSX/PPTX 分支。
7. 边界回归门禁：`npm run test:mocks` 为必跑 hard gate；若时间不足，至少必须显式跑 DOCX 边界测试 `src/lib/docx-export-save.test.ts`, `src/lib/docx-export-contract.test.ts`, `src/lib/format-spec.test.ts` 加本切片 targeted tests，且在交付中标明未跑完整 mocks 的风险。

## 5. 验证命令

优先 targeted：
```powershell
npm run test:mocks -- src/lib/docx-intermediate.test.ts src/lib/docx-format-style.test.ts src/lib/docx-stylefacts-format-attributes.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-fidelity-diagnostics.test.ts
```

类型检查：
```powershell
npm run typecheck
```

硬性边界回归门禁（required）：
```powershell
npm run test:mocks
```

若完整 mocks 因环境阻塞，最低边界替代集（必须说明阻塞原因）：
```powershell
npm run test:mocks -- src/lib/docx-export-save.test.ts src/lib/docx-export-contract.test.ts src/lib/format-spec.test.ts src/lib/docx-intermediate.test.ts src/lib/docx-format-style.test.ts src/lib/docx-stylefacts-format-attributes.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-fidelity-diagnostics.test.ts src/lib/style-facts.test.ts
```

构建门禁（如时间允许）：
```powershell
npm run build
```

## 6. 非目标

- 不恢复或新增手动模板复制/模板回放路线。
- 不做 Word/WPS 像素级或分页级等价承诺。
- 不自动覆盖源 DOCX 或用户指定文件。
- 不扩展 XLSX/PPTX/PDF 高保真策略。
- 不引入新的外部依赖，除非实施时证明 `docx` 包无法表达必需 OpenXML 且另开决策。
- 不重写整个 DOCX writer 或替换导出架构。

## 7. 风险与缓解

- 风险：标题/清单启发式误杀真实自动编号。缓解：用 provenance/intent 字段和 fixture 覆盖单行编号、连续清单、中文章节三类路径。
- 风险：`docx` npm 类型支持 margin header/footer，但实际输出 XML 可能缺失。缓解：以 XML 断言为准；只有 resolver+writer 已设置而 XML 缺失时，记录 blocker 并另开受限 XML patch ADR。
- 风险：StyleFacts 源数据没有 line/header/footer 字段。缓解：fixture 与 parser 输入先支持可选字段；缺失时保持 baseline，不伪造来源属性。
- 风险：diagnostics bucket 过度乐观。缓解：从 count 改为 expected-vs-observed 值比较；无法比对时标 partial/unverified，不标 restored。
- 风险：schema 字段扩展影响旧记录。缓解：新增字段全部可选；旧 fixture 保持通过。

## 8. 执行/评审建议

可单人 Ralph 顺序执行，也可小团队并行：
- Ralph：适合本切片，因为改动跨链路但强依赖顺序；建议 high reasoning verifier 复核 XML 断言。
- Team：若并行，A 负责 intermediate + tests，B 负责 stylefacts/resolver/writer，C 负责 diagnostics；共享 `docx-ts-adapter.test.ts` 需由 leader 合并。
- Goal-mode：如需耐久跟踪，默认 `$ultragoal`；本任务不是外部研究项目，也不是性能优化项目，不优先 `$autoresearch-goal` / `$performance-goal`。

可用 agent types：`explore`, `planner`, `architect`, `critic`, `executor`, `test-engineer`, `verifier`, `code-reviewer`。

停止规则：四个 E3b 差异均有 targeted tests，通过 targeted test + typecheck；header/footer 必须先尝试直接 writer 支持并验证 XML，只有设置后 XML 仍缺失才以 blocker ADR 结束，不扩大到后处理实现。



