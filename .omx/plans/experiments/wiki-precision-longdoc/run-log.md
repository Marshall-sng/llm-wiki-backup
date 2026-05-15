# Wiki Precision + LongDoc 实验执行记录索引

## Run 001：研究基线与最小实验

Date: 2026-05-15

Commit: `13b0ee3 Establish evidence-anchored wiki research baseline`

Executed:

```powershell
python experiments\wiki-precision-longdoc\run_experiments.py
python -m json.tool experiments\wiki-precision-longdoc\artifacts\experiment-summary.json
python -m json.tool experiments\wiki-precision-longdoc\artifacts\first-batch-enterprises.structured.json
python -m json.tool experiments\wiki-precision-longdoc\schemas\evidence-anchor.schema.json
```

Summary:

```json
{
  "E1_excel_status": "passed",
  "E2_long_text_status": "passed",
  "E3_anchor_status": "passed",
  "E4_retrieval_status": "passed",
  "E5_wiki_audit_status": "issues_found",
  "E6_longdoc_status": "passed"
}
```

Detailed record:

- `experiments/wiki-precision-longdoc/experiment-results.md`
- `experiments/wiki-precision-longdoc/artifacts/experiment-summary.json`

## 2026-05-15：整理 format-profile samples 作为多格式实验素材

- evidence：执行 `experiments/wiki-precision-longdoc/inspect_samples.py` 全量扫描 `D:\llm_wiki\runtime\format-profile\samples`。
- evidence：输出 `experiments/wiki-precision-longdoc/artifacts/multiformat/sample-manifest.json`。
- evidence：输出 `.omx/plans/experiments/wiki-precision-longdoc/sample-inventory.md`。
- evidence：目录共有 40 个文件：PDF 10、TXT 1、DOCX 15、XLSX 9、PPTX 5。
- inference：样本满足 DOCX/PDF/TXT/XLSX 本轮 Evidence Anchor 实验基础需求；PPTX 暂不纳入。
- unknown：未确认存在真正扫描版 PDF；PDF 文本抽取能力还需要正式抽取器验证。
- next：按 `multiformat-evidence-anchor-experiment-plan.md` 执行 DOCX/TXT/PDF/XLSX sidecar 原型实验。

## 2026-05-15：执行 Phase 1B 多格式 Evidence Anchor 原型实验

- evidence：执行 `experiments/wiki-precision-longdoc/run_multiformat_anchor_experiments.py`。
- evidence：DOCX 生成 paragraph/table/row/cell anchor 样例：S007=289、S011=2221、S033=6866。
- evidence：TXT 生成 line/char/chunk anchor：S002 chunks=234，tail_covered=True。
- evidence：PDF 生成 page-anchor skeleton 与抽取诊断：S003/S004 为 text-like 但缺 text-span 抽取器；S036/S001 进入 insufficient-extraction。
- evidence：XLSX 生成 row/cell anchor：S040 nonempty_cells=65，S020 nonempty_cells=48982。
- inference：DOCX/TXT/XLSX 已足以支持 EvidenceAnchor-first sidecar 路线；PDF 需要 text-span/block 抽取器才能达到同级精准定位。
- unknown：PDF text-span 的稳定 anchor 模型尚未验证；OCR 按当前要求暂不处理。

## 2026-05-15：执行 Phase 1C PDF.js text anchor 方案实验

- evidence：在 `.tools/pdfjs-eval/` 隔离安装 `pdfjs-dist`，未修改根目录依赖。
- evidence：执行 `experiments/wiki-precision-longdoc/run_pdfjs_text_anchor_probe.mjs`。
- evidence：pdfjs-dist 版本 5.7.284。
- evidence：S003 passed：14 页、552 text items、7122 字符、292 line anchors。
- evidence：S004 passed：20 页、691 text items、9770 字符、442 line anchors。
- evidence：S036 passed：54 页、10359 text items、40665 字符、1959 line anchors。
- evidence：S001 passed：113 页、10800 text items、146833 字符、4220 line anchors。
- inference：PDF.js 适合作为当前 TypeScript/Tauri 主链路的 PDF text anchor 方案候选。
- inference：Phase 1B 的 PDF 启发式诊断需要被真实抽取器结果替代；S036/S001 可抽取。
- unknown：复杂表格、跨栏阅读顺序、页眉页脚过滤仍需下一轮质量实验；OCR 继续排除。

## 2026-05-15：执行 Phase 1D 统一 SourceSidecar / EvidenceAnchor 最小闭环

- evidence：新增统一模型文档 `evidence-sidecar-unified-model.md`。
- evidence：新增 schema `experiments/wiki-precision-longdoc/schemas/source-sidecar.schema.json`。
- evidence：执行 `experiments/wiki-precision-longdoc/run_unified_sidecar_closure.py`。
- evidence：聚合 10 个 source：DOCX=3、PDF=4、TXT=1、XLSX=2。
- evidence：declared anchors=18743；artifact anchors=227；差异来自前置实验 artifact 只保存代表性 anchors。
- evidence：检索烟测 passed=True；DOCX/PDF/TXT-tail/XLSX 均返回 anchor_id + selector；负例返回 insufficient_evidence。
- inference：统一 EvidenceAnchor 接口 + 分格式 selector 是当前最优设计；下一步可基于此做“第一批企业名单.xlsx”真实 Wiki 闭环。
- unknown：生产接入前仍需 full sidecar 持久化、PDF reading order、CoverageAudit 门禁策略。

