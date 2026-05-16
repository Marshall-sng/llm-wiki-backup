# DOCX-first 正式导出策略调整

日期：2026-05-14  
状态：coordination note / strategy override for next direction discussion  
目的：通知并约束后续工作：正式导出阶段从“多格式并行”收敛为 **DOCX 优先**。

## 1. 策略调整

当前正式导出阶段不再平均推进 DOCX / PPTX / XLSX / PDF。下一阶段应集中精力跑通：

```text
DOCX-first Formal Export
```

也就是先用 DOCX 验证完整闭环：

```text
Draft version
→ Evidence / references
→ FormatProfile / StyleFacts / FormatSpec
→ DocxExportContract
→ DocxIntermediateDocument
→ DocxMatchReview
→ DOCXExportAdapter
→ DocxExportRecord / Audit
```

PPTX / XLSX / PDF 暂时保留在“导入画像 / 格式理解 / 后续 adapter 候选”层面，不进入正式导出实现主线。

## 2. 对当前另一个终端工作的理解

从当前工作区痕迹看，另一个终端正在围绕以下主线推进：

- `FormatSpec` 产品化、审计可视化和 prompt contract 替换；
- LLM `formatRuleSynthesis` 进入 semantic overlay；
- `src/lib/format-spec.ts`、`src/lib/format-profile-semantic-overlay.ts`、`src/components/format-profiles/format-profiles-view.tsx` 等相关实现与测试；
- 最近计划记录集中在：
  - `.omx/plans/prd-format-rule-synthesis-productization.md`
  - `.omx/plans/test-spec-format-rule-synthesis-productization.md`
  - `.omx/plans/prd-format-spec-phaseD-visibility-audit.md`
  - `.omx/plans/active/format-profile-four-format-productization-plan.md`

该工作不需要中断。新的 DOCX-first 策略应作为它完成后的下一方向约束：**FormatSpec 仍是正式导出的上游合同来源，但导出 adapter 先只落 DOCX。**

## 3. 为什么 DOCX-first

1. 原始迁移基线中的正式材料主要落点是 DOCX：汇报稿、说明材料、政策材料、合同/报告类材料。
2. DOCX 最适合验证 Draft version、证据、格式画像、生成合同、匹配检查和导出审计的完整闭环。
3. 多格式同时做导出会把 adapter 差异提前放大，容易变成四个半成品。
4. DOCX 跑通后，`ExportContract / MatchReview / Audit` 可再抽象给 PPTX / XLSX / PDF。

## 4. 与当前路线的关系

不冲突。当前路线继续成立：

```text
FormatProfile
→ StyleFacts
→ SemanticOverlay
→ FormatSpec
```

DOCX-first 是它的下游：

```text
FormatSpec
→ DocxExportContract
→ DocxIntermediateDocument
→ DOCX adapter
→ ExportRecord / Audit
```

后续不要回到旧手工模板库路线。

## 5. 边界

1. 不恢复手工模板库。
2. 不让 LLM 修改 StyleFacts / FormatProfile / FormatSpec 的事实层。
3. 不默认发送 snippets/fulltext。
4. 不承诺 pixel-perfect、高保真视觉复刻或原文件精确还原。
5. 不让 LLM 直接判定导出合格；最终合格性由 MatchReview / validator / audit 判断。
6. 第一版只承诺 DOCX，不承诺 PPTX / XLSX / PDF 导出。

## 6. 前置研究方向

DOCX-first 研究建议优先比较：

- `dolanmiu/docx`：TS/JS DOCX 生成候选，适合 MVP adapter；
- `mammoth.js`：导出后回读 / 文本一致性 smoke check；
- OpenXML SDK：复杂样式、section、页眉页脚、目录、XSD/业务规则门禁参考；
- OpenAI DOCX skill：渲染成 PDF/PNG 后视觉检查闭环；
- MiniMax DOCX skill：Create / Fill-Edit / Format-Apply 三管线与 XSD/business validation；
- Anthropic DOCX skill：DOCX-as-zip/XML 与 docx-js/OpenXML 坑位清单；注意许可证限制，不复制内容或代码。

## 7. 给另一个终端的执行提示

如果你正在完成 FormatSpec / formatRuleSynthesis 相关工作，请继续把当前验证闭环收尾。收尾后不要继续扩展 PPTX/XLSX/PDF 导出；下一阶段请转入：

```text
DOCX-first Formal Export PRD / test spec
```

建议第一版只设计并验证：

```text
DocxExportContract
DocxIntermediateDocument
DocxMatchReview
DocxExportRecord
```

再决定 `docx.js` MVP adapter 或 OpenXML SDK sidecar 的实现路径。
