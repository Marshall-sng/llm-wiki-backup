# FormatSpec 产品化 Phase C — PRD / 测试合并归档

归档说明：FormatSpec 已接入 draft-processing replacement；产品化 PRD 与测试规格合并保存。


---

## 原文件：`prd-format-spec-productization-phaseC.md`


# PRD: FormatSpec 产品化接入 / Draft Processing Replacement

日期：2026-05-14  
状态：已实现并验证通过  
范围：产品主链路 prompt contract 替换；不包含导出或视觉还原

## 1. 背景

FormatSpec 四格式实验已经通过 ralplan：

- happy path：4/4 pass；
- negative self-tests：5/5 pass；
- independent evaluator 与 provenance 闭环完成。

当前产品主链路仍存在问题：`draft-processing` 会拼接“当前格式画像 / StyleFacts / 智能解释 / 画像生成约束 / 诊断”，且 system prompt 与 user prompt 均可能携带画像块。这会导致：

- prompt 冗余；
- 来源格式画像原文/候选标题污染目标底稿；
- StyleFacts、semanticOverlay、generationInstruction 多条路径并行；
- `src/lib/format-profile.ts` 反向依赖 store snapshot 类型，领域边界不清。

## 2. 目标

将产品主链路调整为：

```text
FormatProfileRecord / StyleFacts / accepted SemanticOverlay
  -> buildFormatSpec(profile)
  -> renderFormatSpecPromptBlock(spec)
  -> DraftProcessingFormatProfileSnapshot.formatSpec.promptBlock
  -> draft-processing system prompt 插入一次
```

核心目标：**FormatSpec 替代旧画像约束 prompt，而不是叠加。**

## 3. 原则

1. `src/lib/format-spec.ts` 是唯一画像 prompt renderer。
2. draft-processing 只能消费 `snapshot.formatSpec.promptBlock`，不得自行拼接 StyleFacts、semanticOverlay、generationInstruction 或 raw structure。
3. system prompt 插入一次 FormatSpec；user prompt 只放底稿标题、修改要求、引用资料和原底稿内容。
4. 默认 evidence-only，不发送 snippets/fulltext/raw evidence 给模型。
5. legacy `generationInstruction` 可兼容保留，但不参与新 draft-processing 主链路。
6. 不恢复手动输入模板。
7. 不承诺 DOCX/XLSX/PPTX/PDF 导出、视觉还原或高保真复刻。

## 4. 产品范围

### In scope

- 新增 `src/lib/format-profile-types.ts`，承载领域类型和 snapshot 类型，消除 `src/lib` -> `src/stores` 类型依赖。
- 新增 `src/lib/format-spec.ts`：
  - `FORMAT_SPEC_SCHEMA_VERSION`
  - `FORMAT_SPEC_RENDERER_VERSION`
  - `FORMAT_SPEC_POLICY_VERSION`
  - `buildFormatSpec(profile)`
  - `renderFormatSpecPromptBlock(spec)`
  - `buildFormatSpecHash(spec)`
  - `buildSourceProfileHash(profile)`
- 修改 `buildFormatProfileSnapshot()`：物化 `sourceProfileHash`、`formatSpecHash`、`formatSpec`。
- 修改 `draft-processing.ts`：仅从 snapshot 读取 `formatSpec.promptBlock`，且仅 system prompt 插入一次。
- 保留旧 `writingProfile.generationInstruction`，但仅作为 legacy display/fallback metadata。
- 更新相关测试和持久化兼容。

### Out of scope

- 不实现正式导出。
- 不实现视觉还原、像素级匹配、高保真复刻。
- 不实现 snippets/fulltext 授权模式。
- 不恢复手动模板输入。
- 不冻结长期 `format-spec.v0` schema。
- 不改变普通 Chat 的行为；范围仅限 draft-processing 主链路。

## 5. 数据结构合同

### 5.1 Snapshot

```ts
interface DraftProcessingFormatProfileSnapshot {
  id: string
  title: string
  fileType: FormatProfileFileType
  confidence: FormatProfileConfidence
  capturedAt: number

  sourceProfileHash: string
  formatSpecHash: string

  styleFactsSha256?: string
  styleFactsSchemaVersion?: string
  semanticStatus?: SemanticOverlayStatus
  dataScope?: "evidence-only"

  diagnostics: FormatProfileDiagnostic[]

  formatSpec: {
    schemaVersion: string
    rendererVersion: string
    policyVersion: string
    promptBlock: string
    summaryLines: string[]
  }

  legacyGenerationInstruction?: string
}
```

### 5.2 Hash 语义

- `sourceProfileHash`：来源画像身份。输入包含 `profile.id`、`profile.updatedAt`、`styleFactsSha256`、semantic overlay status/key 等事实层变化。
- `formatSpecHash`：渲染行为身份。输入包含 `schemaVersion`、`rendererVersion`、`policyVersion`、FormatSpec canonical payload、`promptBlock`。
- `formatSpecHash` 不得包含 `capturedAt` 等时间噪声。
- renderer/policy/schema 变化必须改变 `formatSpecHash`。
- profile `updatedAt` 变化但 FormatSpec 输出不变时，`sourceProfileHash` 可变，`formatSpecHash` 可稳定。

## 6. Prompt 分工

### System prompt

包含：

- 底稿加工助手角色；
- 保存/覆盖边界；
- 不扩散到普通 Chat；
- 如果存在格式画像，插入一次 `snapshot.formatSpec.promptBlock`。

### User prompt

包含：

- 来源底稿标题；
- 修改要求；
- 引用资料；
- 原底稿内容。

不得包含：

- `formatSpec.promptBlock`；
- `legacyGenerationInstruction`；
- `StyleFacts`；
- `智能解释`；
- `画像生成约束`；
- raw evidence / source body text / evidence hash dump。

## 7. Legacy 兼容

- 旧 profile 的 `writingProfile.generationInstruction` 可以继续存在。
- snapshot 可以记录 `legacyGenerationInstruction` 供 UI 展示、迁移诊断或回滚说明。
- draft-processing 主路径禁止读取或拼接 legacy generationInstruction。
- 旧持久化 conversation / snapshot 应 round-trip 不崩溃。

## 8. 四格式要求

- DOCX：正式文稿规则；覆盖页面、标题、标题层级、编号、字体字号、段落、表格、边界。
- XLSX：工作簿/指标规则；覆盖工作表、表区域、表头、数据区、样式、公式、数字格式、边界。
- PPTX：汇报规则；覆盖 deck、theme、layout、封面、内容页、bullet、页面密度、边界。
- PDF：低/中置信参考；覆盖页数、文本层、图片密度、字体引用、扫描风险、参考边界。

## 9. 验收标准

1. `src/lib/format-spec.ts` 是唯一 prompt renderer。
2. `src/lib/format-profile.ts`、`src/lib/draft-processing.ts` 不再 import `@/stores/*`。
3. 新 snapshot 同时包含 `sourceProfileHash` 和 `formatSpecHash`。
4. system prompt 中 FormatSpec block 出现一次且仅一次。
5. user prompt 不包含 FormatSpec block、legacy generationInstruction、StyleFacts、智能解释、画像生成约束。
6. legacy generationInstruction 不参与新 draft-processing 主链路。
7. promptBlock 不包含 textSample、paragraph samples、slide samples、snippets/fulltext、raw evidence dump、raw styleFacts JSON、source body text、证据 hash 列表。
8. promptBlock 必须包含边界：不根据格式画像虚构事实、来源事实优先、不承诺导出、不承诺视觉还原/高保真复刻。
9. 四格式均有类型专属 summaryLines 和 promptBlock。
10. 实验 parity 保持：FormatSpec experiment happy path 4/4，negative self-tests 5/5。

## 10. 后续实现顺序建议

1. 新增 lib 类型边界：`format-profile-types.ts`。
2. 新增产品 `format-spec.ts`，迁入实验 builder/renderer 的产品子集。
3. 修改 `buildFormatProfileSnapshot()`。
4. 修改 `draft-processing.ts` 的 system/user prompt 分工。
5. 更新 tests。
6. 运行 experiment parity、typecheck、test:mocks、build。


## Implementation Result（2026-05-14）

Phase C 已完成实现与验证：

- 新增产品 FormatSpec renderer，并由 draft-processing system prompt 单点消费。
- user prompt 不再注入画像块或 legacy generationInstruction。
- source profile hash 与 format spec hash 已分离。
- lib/store 类型边界已调整，`format-profile.ts` 与 `draft-processing.ts` 不再 import `@/stores/*`。
- 验证通过：FormatSpec experiment 4/4、independent evaluator 4/4 + negative 5/5、typecheck、test:mocks、build。


---

## 原文件：`test-spec-format-spec-productization-phaseC.md`


# Test Spec: FormatSpec 产品化接入 / Draft Processing Replacement

日期：2026-05-14  
状态：已实现并验证通过

## 1. 测试目标

验证产品主链路从旧画像拼接切换为 FormatSpec renderer 输出，且不会恢复来源正文污染、双注入、legacy generationInstruction 主链路消费或 lib/store 反向依赖。

## 2. 单元测试：FormatSpec

目标文件建议：`src/lib/format-spec.test.ts`

### 2.1 合同字段

- `buildFormatSpec(profile)` 输出 schemaVersion、rendererVersion、policyVersion。
- `renderFormatSpecPromptBlock(spec)` 输出 `## 格式约束（FormatSpec）`。
- `buildFormatSpecHash(spec)` 稳定且非空。

### 2.2 Hash 语义

- rendererVersion / policyVersion / schemaVersion 改变时，`formatSpecHash` 改变。
- profile `updatedAt` 改变但 FormatSpec canonical payload 与 promptBlock 不变时，`sourceProfileHash` 改变，`formatSpecHash` 可稳定。
- `formatSpecHash` 不包含 `capturedAt`。

### 2.3 内容边界

renderer 输出必须包含：

- `不根据格式画像虚构事实`
- `来源事实优先`
- `不承诺导出`
- `不承诺视觉还原`

renderer 输出不得包含：

- `textSample`
- `rawEvidence`
- `styleFacts":`
- `raw.docx.paragraph`
- `raw.xlsx.sheet`
- `raw.pptx.slide`
- `sha256`
- snippets/fulltext/source body text。

### 2.4 四格式覆盖

- DOCX 包含 page/title/heading/numbering/typography/paragraph/table/boundary 类规则。
- XLSX 包含 workbook/sheet/table-region/header/data-region/style/formula/number-format/boundary 类规则。
- PPTX 包含 deck/theme/layout/cover/content/bullet/visual-density/boundary 类规则。
- PDF 包含 page/text-layer/image-density/font-ref/scan-risk/reference-use/boundary 类规则。

## 3. 单元/集成测试：draft-processing

目标文件建议：`src/lib/draft-processing.test.ts`

### 3.1 System-only 注入

- `buildDraftProcessingSystemPrompt(context)` 有 profile 时包含一次且仅一次 `## 格式约束（FormatSpec）`。
- `buildDraftProcessingPrompt(draft, instruction, snapshot)` 不包含 `## 格式约束（FormatSpec）`。
- 完整首轮请求中 FormatSpec block 总出现次数为 1。

### 3.2 禁止旧画像块

新 prompt 不得包含：

- `## 当前格式画像`
- `### StyleFacts`
- `### 智能解释`
- `### 画像生成约束`
- legacy `generationInstruction` 文案。

### 3.3 User prompt 只保留用户上下文

user prompt 必须仍包含：

- 来源底稿标题；
- 修改要求；
- 引用资料；
- 原底稿内容。

### 3.4 Legacy 兼容

- 给 snapshot 同时设置 `formatSpec.promptBlock` 与 `legacyGenerationInstruction`。
- 断言 system/user prompt 只使用 `formatSpec.promptBlock`，不包含 legacy 文案。
- 旧 snapshot 缺少 `formatSpec` 时，不崩溃；可降级为无画像或明确 legacy fallback，但不得重新拼接旧冗余画像块。

## 4. 类型/依赖边界测试

可用脚本或 vitest 静态检查：

- `src/lib/format-profile.ts` 不得 import `@/stores/*`。
- `src/lib/draft-processing.ts` 不得 import `@/stores/*`。
- `src/stores/chat-store.ts` 可以 import `@/lib/format-profile-types`。
- `DraftProcessingFormatProfileSnapshot` 来源于 `src/lib/format-profile-types.ts`。

## 5. Store / persist 回归

- 新 snapshot round-trip 后保留：
  - `sourceProfileHash`
  - `formatSpecHash`
  - `formatSpec.schemaVersion`
  - `formatSpec.rendererVersion`
  - `formatSpec.policyVersion`
  - `formatSpec.promptBlock`
  - `formatSpec.summaryLines`
- 旧 conversation / snapshot 数据不崩溃。
- semantic overlay failed/stale/running/rejected 时仍能生成 deterministic FormatSpec。

## 6. 产品边界 / UI 文案

- UI 不出现“自动生成 DOCX/XLSX/PPTX/PDF 成品”。
- UI 不出现“高保真复刻”“像素级还原”“精确还原模板”等承诺。
- 如展示 legacy generationInstruction，必须标注“兼容展示，不参与新加工主链路”。

## 7. 实验 parity

实现完成后必须运行：

```powershell
node experiments/format-spec/scripts/run-format-spec.mjs
node experiments/format-spec/scripts/evaluate-format-spec.mjs
```

通过标准：

```text
happy path: 4/4 pass
negative self-tests: 5/5 pass
```

## 8. 仓库验证

实现完成后至少运行：

```powershell
npm run typecheck
npm run test:mocks
npm run build
```

如 build 受环境阻塞，必须记录原因并提供已通过的替代验证。

## 9. 阻断失败条件

任一出现即不得宣称完成：

- FormatSpec block 在 system+user 首轮请求中出现超过 1 次。
- user prompt 包含画像块。
- draft-processing 主路径消费 legacy generationInstruction。
- `src/lib` 继续依赖 `src/stores` 类型。
- promptBlock 泄漏 raw evidence/source text/hash dump。
- UI 或 prompt 出现导出/视觉复刻/高保真承诺。
- 实验 parity 失败。


## Implementation Result（2026-05-14）

Phase C 已完成实现与验证：

- 新增产品 FormatSpec renderer，并由 draft-processing system prompt 单点消费。
- user prompt 不再注入画像块或 legacy generationInstruction。
- source profile hash 与 format spec hash 已分离。
- lib/store 类型边界已调整，`format-profile.ts` 与 `draft-processing.ts` 不再 import `@/stores/*`。
- 验证通过：FormatSpec experiment 4/4、independent evaluator 4/4 + negative 5/5、typecheck、test:mocks、build。
