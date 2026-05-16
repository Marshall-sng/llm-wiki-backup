# 正式导出参考调研发现（DOCX / PPTX 合并版）

合并说明：正式导出下一阶段已收敛为 DOCX-first，但 DOCX 与 PPTX 参考调研均对后续 exporter / adapter / audit 设计有价值，故合并为一个引用资料文件。


---

## 原文件：`requirements/docx-skill-reference-findings.md`


# DOCX skill 参考调研发现

日期：2026-05-14  
状态：reference findings / DOCX-first research  
关联：`.omx/plans/requirements/docx-first-export-strategy-shift.md`

## 1. 调研对象

1. OpenAI `doc` skill  
   - URL: `https://github.com/openai/skills/tree/main/skills/.curated/doc`
   - 关注点：文档生成后的渲染检查闭环。
2. Anthropic `docx` skill  
   - URL: `https://github.com/anthropics/skills/tree/main/skills/docx`
   - 关注点：DOCX-as-ZIP/XML、`docx-js` 创建、XML 直接编辑和坑位规则。
3. MiniMax `minimax-docx` skill  
   - 本地路径：`C:\Users\Dante\.agents\skills\minimax-docx`
   - 关注点：OpenXML SDK、Create / Fill-Edit / Format-Apply 三管线、XSD/business validation。

## 2. 总体结论

对 `llm_wiki` DOCX-first 路线，三者最值得吸收的点不同：

```text
OpenAI     → render check / visual inspection loop
Anthropic  → DOCX ZIP/XML mental model + docx-js/OpenXML pitfalls
MiniMax    → OpenXML SDK pipelines + validation gate
```

建议不直接复制任一 skill，而是转化为 `llm_wiki` 自己的：

```text
DocxExportContract
DocxIntermediateDocument
DocxMatchReview
DocxExportRecord
DocxValidationPipeline
```

## 3. OpenAI doc skill 启发

OpenAI 的文档 skill 强调：

```text
生成 DOCX
→ 转 PDF
→ 转 PNG
→ 逐页视觉检查
→ 修复
→ 再检查
```

对当前路线的价值：

- 不能只以“文件写出成功”作为导出成功标准。
- DOCX-first 需要至少保留一个 render/preview validation 的扩展点。
- 如果本地没有 LibreOffice / Poppler，可先退化为 text extraction + XML/analyze 检查，并在 audit 中声明未做视觉检查。

不建议直接照搬：

- `python-docx` 更适合 agent 临时文档，不一定适合产品级复杂格式、section、页眉页脚、目录和模板继承。

## 4. Anthropic docx skill 启发

Anthropic 的核心 mental model：

```text
.docx = ZIP archive containing XML files
```

可吸收为：

- `DocxXmlGuard`：检查 OpenXML 包内关键 XML 文件、关系文件和内容类型。
- `DocxStyleGuard`：检查 heading、outline level、TOC、字体、字号、编号等。
- `DocxTableGuard`：检查表格宽度、单元格宽度、边框、跨行跨列。
- `DocxEditGuard`：未来编辑已有 DOCX 时处理 comments、tracked changes、relationships。

注意：

- Anthropic skill 带 proprietary license，不应复制其内容或代码。
- 只吸收公开可见的通用设计思想和工程关注点。

## 5. MiniMax docx skill 启发

MiniMax 的本地 `minimax-docx` skill 最贴近工程化 DOCX 导出：

```text
A. Create       从零创建 DOCX
B. Fill/Edit    填充或编辑已有 DOCX
C. Format-Apply 应用模板/格式
```

其中 C 又分：

```text
C-1 OVERLAY      纯样式模板，应用样式到源内容
C-2 BASE-REPLACE 模板带结构，用模板作为 base，替换示例内容
```

这和未来 DOCX-first 导出高度相关：

```text
FormatSpec 仅表达样式/排版规则 → OVERLAY-like
FormatSpec 带章节结构/示例结构 → BASE-REPLACE-like
```

最值得吸收的 validation gate：

```text
merge-runs
→ XSD validate
→ business rules validate
→ fix-order
→ analyze / preview
→ diff
```

本地实验确认：

- CLI 可通过 `DOTNET_ROLL_FORWARD=Major` 在当前 .NET 9 环境运行。
- 可生成最小 DOCX。
- `validate --business` 可通过，但会报告 orphaned relationship warning。
- `analyze --json` 可回读 sections、headings、headers、footers、paragraphs 等结构。
- `diff` 可报告文本、样式、结构变化。

## 6. 对 DOCX-first 的建议吸收方式

### 6.1 第一阶段：数据合同优先

先设计：

```text
DocxExportContract
DocxIntermediateDocument
DocxMatchReview
DocxExportRecord
DocxValidationPipeline
```

不要先锁死 adapter。

### 6.2 第二阶段：adapter 对比

用同一组 fixtures 对比：

```text
Option A: TypeScript docx adapter
Option B: OpenXML SDK sidecar
```

对比维度：

- heading / outline / TOC；
- CJK 字体、字号、段落间距；
- 表格；
- header/footer；
- section/page margins；
- validation warning/error；
- text extraction / audit；
- 跨平台打包成本。

### 6.3 第三阶段：render check 扩展

如果环境有 LibreOffice / Poppler，可加入：

```text
DOCX
→ PDF
→ page images
→ render smoke check
```

如果没有，则记录：

```text
renderCheckStatus: "not-run"
reason: "LibreOffice/Poppler unavailable"
```

## 7. 不变边界

1. LLM 不直接生成 `.docx`。
2. LLM 不修改 StyleFacts / FormatProfile / FormatSpec 事实层。
3. 默认 evidence-only。
4. 不承诺高保真视觉复刻。
5. 不恢复手工模板库。
6. 导出成功必须包含 validation/audit 证据，不只是文件存在。

## 8. 后续可落地问题

进入 PRD 前应回答：

1. 第一版是否接受新增 TS 依赖 `docx` / `mammoth`？
2. 是否允许引入 .NET sidecar，或仅作为开发/验证工具？
3. `DocxIntermediateDocument` 是否采用 JSON schema 还是 Markdown+frontmatter？
4. `DocxMatchReview` 的硬阻断项有哪些？
5. 如果 validation warning 非阻断，应如何呈现给用户？
6. 是否需要导出 sidecar audit JSON？


---

## 原文件：`requirements/export-pptx-reference-findings.md`


# 正式导出 / PPTX 参考项目调研发现

日期：2026-05-14  
状态：reference findings / no implementation decision yet  
关联主线：FormatProfile / StyleFacts / semantic overlay → ExportContract → MatchReview → ExportRecord

## 1. 调研对象

本记录用于沉淀以下两个外部项目对 `llm_wiki` 正式导出路线的可借鉴点、边界和风险：

1. MiniMax-AI `pptx-plugin`  
   URL: `https://github.com/MiniMax-AI/skills/tree/main/plugins/pptx-plugin`
2. `ppt-master`  
   URL: `https://github.com/hugohe3/ppt-master/tree/main`

本文只记录产品/架构启发，不代表引入依赖、复制代码或改变当前路线。

## 2. 总体判断

两个项目都有可取之处，但不应整体迁移。

- MiniMax-AI `pptx-plugin` 更像一套 PPTX 生成技能规范，适合借鉴 PptxGenJS 约束、单页模块、QA 检查和常见坑位。
- `ppt-master` 更像一个完整 PPT 生成流水线 / harness，适合借鉴中间表示、`spec_lock`、质量门禁、模板派生和可编辑 PPTX 导出链路。

它们不能取代当前主线：

```text
FormatProfile
→ StyleFacts
→ semantic overlay
→ ExportContract
→ MatchReview
→ ExportRecord / Audit
```

更合适的吸收方式是：把它们作为 **PPTX 正式导出 adapter** 和 **生成合同 / 质量门禁** 的参考。

## 3. MiniMax-AI pptx-plugin 可借鉴点

### 3.1 PptxGenJS 作为 PPTX 导出后端

可借鉴为：

```text
ExportIntermediateDocument
→ PPTXExportAdapter
→ PptxGenJS
→ .pptx
```

价值：

- 输出真正可编辑的 PPTX，而不是单纯图片。
- 适合作为 PPTX 分格式 adapter 的第一候选实现方向。

### 3.2 单页模块化生成

其按 slide 拆分生成逻辑可转化为：

```text
ExportIntermediateDocument.sections[]
→ slidePlan[]
→ slideRenderUnits[]
→ PPTX
```

价值：

- 便于逐页验证。
- 便于局部重试。
- 便于将 `MatchReview` 的错误定位到具体 slide。

### 3.3 技术约束和 QA 清单

可转化为 PPTX adapter 的规则约束，例如：

- 字体 fallback 策略；
- 颜色格式规范；
- 文本是否可抽取；
- slide 是否存在空页；
- 生成后用文本抽取工具做 QA。

这些约束应进入 `PPTXExportValidator`，而不是只写在 prompt 中。

### 3.4 不宜照搬点

- 它偏 agent 技能工作流，不是产品内稳定导出管线。
- subagent 并行写 slide 的模式可能削弱产品审计闭环。
- 主要覆盖 PPTX，不解决 DOCX / XLSX / PDF 的统一正式材料闭环。

## 4. ppt-master 可借鉴点

### 4.1 `design_spec` / `spec_lock` 思路

这是最重要的启发。

可映射为：

```text
design_spec.md  → ExportBrief / 人类可读导出说明
spec_lock.md    → ExportContract / 机器执行合同
```

价值：

- 把用户意图、格式约束、布局约束和生成边界固定下来。
- 降低长文档 / 多页生成时的风格漂移。
- 每页/每节生成前重读合同，可防止模型在后续页面偏离要求。

### 4.2 严格阶段化流水线

其阶段化思想可映射为 `llm_wiki` 的正式导出链路：

```text
Draft / Evidence
→ ExportBrief
→ ExportContract
→ ExportIntermediateDocument
→ MatchReview
→ Fix Loop
→ ExportAdapter
→ ExportRecord / Audit
```

价值：

- 不让 LLM 直接产出最终文件。
- 每个阶段都有可检查产物。
- 失败时可以定位到具体阶段，而不是只得到“生成失败”。

### 4.3 中间表示优先

`ppt-master` 的核心启发是：模型先生成可检查的中间表示，再由工具链转成 PPTX。

这支持当前判断：

```text
LLM 不直接写最终 DOCX/PPTX/PDF/XLSX
LLM 只生成 ExportIntermediateDocument
系统 validator 决定是否可导出
```

### 4.4 模板派生思想

其模板包概念可以被吸收，但需要改造为当前路线：

```text
参考成品文件
→ FormatProfile / StyleFacts
→ semantic overlay
→ ExportContract
```

不应恢复用户手工维护模板字段的旧路线。

### 4.5 不宜照搬点

- 它偏 PPT 专用生成 harness，不是跨 DOCX / PPTX / XLSX / PDF 的统一导出系统。
- 其视觉生成目标不能直接变成当前产品承诺。
- 不能因此承诺 pixel-perfect、高保真视觉复刻或原文件精确还原。

## 5. 与当前路线的兼容性

不冲突。两个项目的可取部分应作为当前路线的下游补充。

当前已有：

```text
FormatProfile
StyleFacts
semantic overlay
profileSnapshot
generationInstruction
```

下一步应新增：

```text
ExportBrief
ExportContract
ExportIntermediateDocument
MatchReview
ExportRecord
Format-specific ExportAdapter
```

其中 PPTX adapter 可以重点参考 MiniMax-AI `pptx-plugin` 和 `ppt-master`。

## 6. 必须守住的边界

1. 不恢复手工模板库路线。
2. 不让 LLM 修改 `StyleFacts` / `FormatProfileRecord` / evidence refs 等事实层。
3. 不默认发送 snippets/fulltext。
4. 不承诺视觉复刻、pixel-perfect 或高保真导出。
5. 不让 LLM 自己判定导出合格；最终合格性由 validator / evaluator / MatchReview 决定。
6. 不把 PPTX 专用 pipeline 直接上升为全格式统一架构。

## 7. 建议吸收顺序

### 第一阶段：通用导出合同

优先设计：

```text
ExportBrief
ExportContract
ExportIntermediateDocument
MatchReview
ExportRecord
```

重点借鉴 `ppt-master` 的 `spec_lock` 思想。

### 第二阶段：PPTX adapter

再设计：

```text
IntermediateDocument
→ SlidePlan
→ PptxGenJS 或 SVG-to-PPTX
→ text extraction / layout QA
→ PPTXExportRecord
```

重点借鉴 MiniMax-AI `pptx-plugin` 的 PptxGenJS 约束和 QA 清单。

### 第三阶段：格式画像与模板派生融合

将 FormatProfile 作为模板/格式画像来源，而不是恢复手工模板库：

```text
FormatProfile
+ StyleFacts
+ semantic overlay
+ ExportBrief
= ExportContract
```

## 8. 当前结论

两个项目都有参考价值，尤其是：

- `ppt-master` 的 `spec_lock` / 生成合同 / 阶段化质量门禁；
- MiniMax-AI `pptx-plugin` 的 PptxGenJS 导出约束、逐页模块化和 PPTX QA 经验。

但后续应把这些经验转化为 `llm_wiki` 自己的：

```text
ExportContract
MatchReview
PPTXExportAdapter
ExportRecord / Audit
```

而不是直接整体迁移或改变当前 FormatProfile 主线。
