# Context Snapshot: Phase 1 Productization Design

## Task statement
Use `$ralplan` to create the first-phase productization design for wiki precision / evidence-sidecar work.

## Desired outcome
A consensus-approved productization design and test specification that covers the multi-format architecture while limiting P0 implementation to XLSX full SourceSidecar + CoverageAudit + WikiCandidate projection.

## Known facts/evidence
- Branch: `research/wiki-precision-longdoc`.
- Experiments have validated DOCX/TXT/XLSX/PDF anchors.
- PDF.js is the recommended PDF text anchor candidate.
- Unified SourceSidecar / EvidenceAnchor model and schema exist.
- First-batch company XLSX real closure proved current wiki source loses row/cell facts.
- Supplemental experiments proved XLSX merged context, PDF quality gate, and CoverageAudit rules should enter design.

## Constraints
- Do not implement production code in this planning step.
- Do not disturb other terminal's DOCX-first work or uncommitted files.
- Productization design should cover multi-format architecture but P0 should implement only XLSX.
- OCR, PDF table reconstruction, DOCX image semantics, PPTX/Web remain deferred.

## Unknowns/open questions
- Exact current production ingestion/wikigen code paths need a bounded repo map before file-level task breakdown.
- How sidecars should be persisted in current app storage needs architecture mapping.

## Likely codebase touchpoints
- `src/commands/file-sync.ts` or related ingest commands.
- `src/stores/file-sync-store.ts`, `src/stores/research-store.ts`, `src/stores/review-store.ts`.
- `src/types/wiki.ts`.
- `src/lib/context-budget.ts` and tests may inform budget/coverage handling.
- Tauri fs commands if sidecar files are persisted under `.llm-wiki`.

## Relevant artifacts
- `.omx/plans/experiments/wiki-precision-longdoc/evidence-sidecar-unified-model.md`
- `.omx/plans/experiments/wiki-precision-longdoc/first-batch-company-closure-results.md`
- `.omx/plans/experiments/wiki-precision-longdoc/production-readiness-supplemental-results.md`
- `experiments/wiki-precision-longdoc/schemas/source-sidecar.schema.json`
- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/`
