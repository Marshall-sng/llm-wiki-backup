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
