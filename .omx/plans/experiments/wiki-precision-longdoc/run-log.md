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

