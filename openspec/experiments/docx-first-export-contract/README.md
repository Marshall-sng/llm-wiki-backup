# DOCX-first Export Contract Spike

Purpose: verify that DOCX-first formal export can be productized around a contract/intermediate/review boundary before choosing a final adapter.

Command:

```powershell
node experiments/docx-first-export-contract/scripts/run-docx-first-export-contract.mjs
```

This experiment intentionally does not add npm dependencies, does not integrate UI/store, and does not promise high-fidelity DOCX restoration.
