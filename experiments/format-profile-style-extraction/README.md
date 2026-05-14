# Format Profile Style Extraction Experiment (Phase 3)

This experiment validates high-fidelity **deterministic style fact extraction** for format profiles.

Boundary:

- Deterministic parser output (`style-facts.json`) is the source of truth.
- Optional LLM/mock interpretation can only add advisory summaries in `style-interpretation-overlay.json`.
- LLM output is rejected if it tries to write style facts, cites unknown evidence, or makes uncited claims.
- “High-fidelity” means fixture-backed parser fidelity for covered schema fields, not visual/export reproduction.
- The experiment is isolated from product code: no `src/` files should change.

## Commands

```powershell
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode deterministic
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-pass
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-hallucination --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-overwrite-facts --case xlsx-style-rich
node experiments/format-profile-style-extraction/scripts/run-style-extraction.mjs --mode mock-unknown-evidence --case docx-style-rich
node experiments/format-profile-style-extraction/scripts/verify-style-extraction.mjs
```

Outputs are written to `runtime/format-profile-style-extraction/`.
