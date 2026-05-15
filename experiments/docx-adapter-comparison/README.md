# DOCX Adapter Comparison Experiment

Slice B experiment for comparing DOCX adapter candidates without selecting a final adapter.

## Commands

```powershell
npm --prefix experiments/docx-adapter-comparison run compare:ts-docx
npm --prefix experiments/docx-adapter-comparison run compare:openxml
npm --prefix experiments/docx-adapter-comparison run compare
```

## Boundaries

- Uses Slice A product boundary as shared input: `DocxExportContract` and `DocxIntermediateDocument`.
- Produces `DocxAdapterResultLike`, `DocxMatchReview`, `DocxExportRecord`, and redacted comparison reports.
- Does not modify product dependencies, UI, stores, Tauri, or product `src/**` implementation files.
- Does not select the final adapter.

## Report policy

Full DOCX/XML artifacts may exist under `artifacts/` for reproducibility. JSON/Markdown reports under `reports/` are redacted and only include assertion IDs, booleans, counts, hashes, issue codes, verdicts, and status summaries.
