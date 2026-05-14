# Editable Format Constraints Experiment Summary

Generated: 2026-05-14T11:19:15.091Z

Verdict: pass

| Case | Verdict | Baseline rules | Auto rules | Edited rules | Warnings | Edits |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| docx-policy | pass | 17 | 21 | 21 | 42 | 1 |
| xlsx-metrics | pass | 12 | 17 | 17 | 34 | 1 |
| pptx-briefing | pass | 12 | 17 | 17 | 34 | 1 |
| pdf-reference | pass | 8 | 12 | 12 | 24 | 1 |

## Gates
- Soft fields: missing/unknown source accepted with warnings and normalized to inferred.
- Hard gates: unknown evidence, forbidden raw fields, and fidelity promises rejected.
- User edits: edited rules take precedence over auto draft in prompt block.
