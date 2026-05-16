# FormatProfile 四格式产品化验收与下一阶段边界

日期：2026-05-13  
记录目的：记录当前四格式 FormatProfile 产品化验收结论、能力边界变化，以及下一阶段应从“格式探测”转向“LLM 语义精炼”。

## 1. 本轮验收结论

本轮可以判定为：**通过**。

通过的含义是：

```text
DOCX / XLSX / PPTX / PDF
  → 统一导入入口
  → 后端确定性 probe
  → FormatProfile
  → profileSnapshot
  → generationInstruction
  → diagnostics
```

这条产品化链路已经接回主线，并且四种格式都进入同一管线。

## 2. 已满足的能力

### DOCX

已能从成品 DOCX 中提取：

- 段落数量；
- 候选标题；
- 表格数量；
- 段落样式；
- 编号线索；
- 字体线索；
- 字号线索；
- 页面尺寸 / 页边距线索；
- 诊断信息。

用户实测样例中已经出现：

```text
已完成 DOCX 探测：段落 315、候选标题 42、表格 3、样式 3。
```

并且 generationInstruction 中已经出现“样式/版式线索”。

### XLSX

已能进入统一画像管线，用于：

- 工作表结构；
- sheet 维度；
- 行 / 单元格统计；
- 合并单元格；
- 公式数量；
- 单元格样式、字体、填充、边框统计。

边界：XLSX 画像用于指标、口径、观察和结论，不直接伪造电子表格，不承诺导出 XLSX。

### PPTX

已能进入统一画像管线，用于：

- slide 数量；
- layout 数量；
- master 数量；
- theme 名称；
- 配色 / 字体方案数量；
- 逐页文本样本。

边界：PPTX 画像用于汇报大纲、每页主题和讲述要点，不承诺直接生成 PPTX 文件。

### PDF

已能进入统一画像管线，用于：

- 页数；
- 文本操作符数量；
- 图片数量；
- 字体引用；
- 加密 / XFA 线索；
- 文本层 / 扫描风险诊断。

边界：PDF 仅作为低保真成品参考，不承诺高保真还原。

## 3. 当前版本真实能力定位

当前版本应被命名为：

```text
确定性探测版 FormatProfile
```

而不是：

```text
智能理解版 FormatProfile
```

它已经能证明文件被解析、证据被收集、约束被注入，但尚未具备对证据进行高质量语义归纳的能力。

## 4. 用户验收观察

用户认为本轮通过，但指出：

> 由于没有接入 LLM，所以采集的内容十分机械且不精准。

该观察成立。

典型表现包括：

1. **结构线索过长**  
   正文条款被当作标题，并整段进入结构线索。

2. **章 / 条粘连**  
   例如“第二章……第四条……”可能被识别为一个结构项，而不是两个层级。

3. **字体线索有噪声**  
   `Arial`、`Times New Roman`、`en-US` 等可能是默认西文字体或语言属性，不一定代表正式中文样式。

4. **置信度语义不清**  
   当前 `high` 更多表示“原始探测证据充分”，不表示“语义归纳准确”。

## 5. 重要边界调整

下一阶段不应继续把重点放在“再补四格式探测是否存在”上。四格式探测已经通过。

下一阶段重点应调整为：

```text
raw probe
  → deterministic profile
  → semantic refinement / LLM enrichment
  → concise final profile
  → final generationInstruction
```

也就是说，后续核心任务是：

- 对结构线索进行筛选、截断、拆分和层级归纳；
- 对字体 / 字号 / 页面线索做语义化解释；
- 对文档类型做智能判断；
- 对 generationInstruction 做压缩和可执行化；
- 明确“原始探测置信度”和“语义归纳置信度”的区别。

## 6. 可立即做的非 LLM 改进

即使不接 LLM，也可以先改善机械程度：

1. 候选标题最大长度限制；
2. `第X章` / `第X条` 专门解析；
3. 拆分“章 + 条”粘连文本；
4. 过滤明显正文段落；
5. 过滤 `en-US` 等非字体值；
6. twips 页面尺寸转换为 A4 / mm / cm；
7. 将置信度拆为：
   - probeConfidence；
   - structureConfidence；
   - styleConfidence；
   - semanticConfidence。

## 7. LLM 精炼层建议

当 LLM 可用时，在 deterministic profile 之后增加精炼步骤：

```text
FormatProfile raw evidence
  → LLM summarize / normalize / rank
  → refined FormatProfile
```

LLM 负责：

- 判断真正章节层级；
- 压缩过长结构线索；
- 识别制度、公文、通知、报告等文档类型；
- 将机械字体列表转成用户可理解的格式规则；
- 生成更像人写、可执行的写作约束；
- 标注哪些结论来自证据，哪些只是推断。

如果未配置 LLM，UI / diagnostics 应明确显示：

```text
当前为原始探测画像，未进行智能精炼。
```

## 8. 后续验收标准建议

下一阶段验收不再以“四格式是否能导入”为主，而应以“画像是否可读、可控、可用于写作”为主。

建议验收标准：

1. DOCX 制度类文件中，结构线索应优先显示章、节、条标题，不应把长正文段落作为标题主线。
2. generationInstruction 中结构线索应压缩到可消费长度。
3. 样式线索应区分中文主字体、西文字体、默认字体、语言属性。
4. 页面线索应以 A4 / 纵向 / 页边距等可读信息呈现，而不是只显示 twips。
5. 置信度应能说明是“探测充分”还是“语义理解充分”。
6. 未接 LLM 时应明确标注为原始探测画像。
7. 接入 LLM 后，应保留 raw evidence，避免 LLM 误改事实。

## 9. 当前状态结论

当前状态：

```text
四格式确定性探测产品化：通过
LLM 语义精炼：未开始
正式导出 / 高保真复刻：仍不承诺
手动输入模板：仍完全放弃
```

下一条推荐任务：

```text
制定并执行 FormatProfile Semantic Refinement / LLM Enrichment 方案：
先做非 LLM 结构清洗，再接入可选 LLM 精炼层，最终输出更短、更准、更可执行的画像约束。
```

## 10. 2026-05-13 追加状态：语义精炼 harness 已落地

当前变更：

```text
LLM 语义精炼产品接入：仍未开始
LLM 语义精炼实验 harness：已完成第一版
真实 LLM 调用：仍未接线，必须显式 --allow-external-llm 且当前分支会安全失败
```

已新增 `experiments/format-profile-semantic-refinement/`，完成：

- 四格式 golden cases：DOCX / XLSX / PPTX / PDF。
- 不可变 evidence catalog 与 sha256 hash。
- LLMOverlayOutput closed schema：LLM 只产出语义 overlay，不产出最终 instruction。
- Harness renderer：根据确定性画像 + accepted overlay 渲染最终 instruction。
- Evaluator：检查 evidence refs、禁词/越权、边界安全、四格式质量分。
- Fallback：disabled、invalid JSON、schema invalid、LLM error、evaluator rejected 均回退到确定性 instruction，且 hash parity 通过。

验证结果：

```text
mock-pass：4/4 refined
failure modes：5/5 fallback
fallback hash parity / no acceptedOverlay：13/13 assertions passed
```

新的下一条推荐任务：

```text
若继续推进产品化，先做 LLM adapter + feature flag 的集成方案；不得直接把 harness mock 逻辑接入产品 UI。
```

## 11. 2026-05-13 追加状态：真实 LLM harness 测试已完成

实验 harness 已完成真实 LLM 测试，但产品链路仍未接入 LLM。

结果：

```text
real-llm via codex-cli：4/4 refined
DOCX / XLSX / PPTX / PDF：evaluator pass
HTTP MiniMax：已尝试，429 usage limit，安全 fallback
```

重要边界：

- 当前通过的是实验 harness，不是桌面端产品功能。
- 真实 LLM 输出仍必须经过 closed schema、evidenceRefs、evaluator 和 fallback。
- 后续产品接入必须增加 feature flag、provider adapter、UI 状态和失败回退，不得直接调用实验脚本。

## 12. 2026-05-14 追加状态：StyleFacts / DataScope / 原始迁移约束合并为下一阶段设计输入

完整复读 `.omx/plans` 后，下一阶段产品化设计必须同时合并四组事实：

1. **确定性四格式产品化已通过**：现有主线已经能展示结构、样式摘要、诊断并注入 generationInstruction。
2. **语义精炼 harness 已验证但未产品化**：真实 LLM 可提升可读性，但必须走 overlay、closed schema、evidenceRefs、evaluator、fallback，不得直接重写 profile 或 instruction。
3. **DataScope 结论**：默认 evidence-only；snippets/fulltext 只可作为显式授权的高级/补救模式，且需要 redaction、leak scan、sourceContext evidenceRefs、审计记录。
4. **StyleFacts 结论**：样式高保真应定义为“fixture-backed deterministic parser fidelity”；DOCX/XLSX 可进入 primary，PPTX/PDF 保持 baseline diagnostics；LLM 不能生成样式事实。

因此，我方此前“只做 `styleFacts` 字段 + UI 展示”的设计不完整。完整产品化设计还必须包含：

- `FormatBinding` 扩展：将 profile、StyleFacts hash、dataScope、overlay status 与 Draft/生成任务绑定。
- Draft/version 前置边界：正式输出或格式适配最终必须落到可版本化 Draft；不能直接从 profile 承诺正式输出。
- Match Report 预留：未来检查 required sections、section order、字数、引用、样式偏离、阻断项。
- Audit / Provenance 预留：记录 draft version、profile id、StyleFacts hash、evidence refs、overlay/evaluator 状态、model/provider、warnings。
- 非程序员 UI：默认展示人话摘要和边界；证据详情可展开；不要要求用户理解内部 evidence/chunk/hash 才能继续。

### 下一步讨论建议

下一步不应直接进入代码，而应先对齐一份产品化 PRD / test spec，范围建议是：

```text
StyleFacts 产品化最小闭环：
  deterministic StyleFacts → FormatProfileRecord → FormatBinding snapshot → UI 人类摘要/证据折叠 → generationInstruction 摘要 → tests
```

同时在 PRD 中明确后置项：LLM overlay、rich data scopes、Match Report、Export、Audit、Long Document Project。

## Update：StyleFacts Phase A 产品化完成（2026-05-14）

Phase A 已完成确定性 StyleFacts 的产品化闭环：四格式 probe 输出的样式/版式事实进入 `FormatProfileRecord.styleFacts`，并派生 `styleProfile`、`profileSnapshot`、`generationInstruction` 与 UI 摘要/证据详情。该实现是当前格式画像样式摘要的替代路径，而不是并行的新功能。

当前边界保持不变：

- 默认 `dataScope = evidence-only`。
- `semanticStatus = not-configured`。
- 不接入产品 LLM。
- 不发送 snippets/fulltext。
- 不允许 LLM 生成或覆盖 StyleFacts。
- 不承诺正式导出、视觉复刻或高保真还原。

验证证据：`typecheck`、全量 mock、目标测试、build、边界关键词守卫均通过。下一步只能进入 LLM 接入的 Phase B ralplan 设计，不能直接编码接入模型。

## Update：LLM Semantic Overlay 产品接入完成（2026-05-14）

在 Phase A StyleFacts 产品化之后，Phase B 已将 LLM 以 evidence-only semantic overlay 形式接入产品主链路。该能力不是事实解析器，而是证据绑定的解释层：

```text
StyleFacts / profile summaries / diagnostics / evidence catalog
  -> EvidenceOnlyOverlayInput
  -> existing product LLM provider
  -> closed-schema overlay
  -> evaluator
  -> renderer-owned summary + generationInstruction
  -> UI / draft-processing
```

默认仍使用确定性画像；只有 accepted overlay 才会增强主要摘要与底稿约束。任何 provider failure、invalid JSON、schema violation、unknown evidence ref、fact creation attempt、stale key 或 restart-interrupted running 状态都会回退到 deterministic Phase A 输出。

验证已通过：目标测试、typecheck、全量 mock、build。真实模型桌面烟测是下一步建议验证，但不影响当前 mock-verified 产品合同闭环。


## Update：FormatSpec 四格式实验完成（2026-05-14）

用户指出当前画像约束过于机械、冗余，并且混入来源格式画像的正文内容。为修正这一方向，本轮新增 `FormatSpec` 实验层：

```text
StyleFacts / SemanticOverlay
  -> FormatSpec（详细格式规范）
  -> draft-prompt
```

实验结论：

- DOCX：生成正式文稿规则，覆盖页面、主标题、标题层级、编号、字体字号、段落缩进/对齐/行距、表格和边界。
- XLSX：生成工作簿/工作表、表区域、表头、数据区、样式复杂度、公式和数字格式边界规则。
- PPTX：生成演示文稿页序、主题、版式、封面、内容页、bullet、页面密度和边界规则。
- PDF：生成页数、文本层、图片密度、字体引用、扫描风险和低/中置信参考边界。

验证结果：`node experiments/format-spec/scripts/run-format-spec.mjs` PASS，4/4 cases passed。

重要产品化含义：下一步如接入产品，draft-processing 不应继续直接消费 raw structure lines / 来源候选标题原文；应改为消费 `FormatSpec` renderer 输出。该接入需要另行设计和测试。


## Update：FormatSpec 产品化接入完成（2026-05-14）

在 FormatSpec 四格式实验和 ralplan Phase C 设计通过后，产品主链路已完成替换：

```text
FormatProfileRecord / StyleFacts / accepted SemanticOverlay
  -> FormatSpec
  -> DraftProcessingFormatProfileSnapshot.formatSpec
  -> draft-processing system prompt
```

关键变化：

- 不再把 raw structure lines、来源候选标题长文本、StyleFacts 摘要、semantic overlay 摘要和 legacy generationInstruction 全量拼接进 user prompt。
- user prompt 仅包含底稿标题、修改要求、引用资料和原底稿内容。
- FormatSpec block 仅在 system prompt 中插入一次。
- `sourceProfileHash` 与 `formatSpecHash` 分离，便于区分来源画像变化和 renderer/policy 输出变化。
- legacy `generationInstruction` 仅保留为兼容字段，不参与新加工主链路。

验证结果：

- FormatSpec experiment：4/4 pass。
- Independent evaluator：happy path 4/4，negative self-tests 5/5。
- Typecheck：PASS。
- Mock tests：86 files / 1152 tests PASS。
- Build：PASS。

当前边界不变：仍不承诺导出文件、视觉还原或高保真复刻；仍默认 evidence-only；仍不恢复手动输入模板；snippets/fulltext 仍需另行授权与安全方案。
