# FormatRuleSpec Synthesis Summary

Generated: 2026-05-14T08:59:44.951Z

| Mode | Case | Type | Verdict | Rules | Attrs | Score | Output |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| mock-uncited | docx-policy | docx | fail | 18 | 40 | 100 | experiments/format-rule-synthesis/outputs/mock-uncited/docx-policy |
| mock-uncited | pdf-reference | pdf | fail | 10 | 18 | 97 | experiments/format-rule-synthesis/outputs/mock-uncited/pdf-reference |
| mock-uncited | pptx-briefing | pptx | fail | 14 | 28 | 100 | experiments/format-rule-synthesis/outputs/mock-uncited/pptx-briefing |
| mock-uncited | xlsx-metrics | xlsx | fail | 14 | 30 | 100 | experiments/format-rule-synthesis/outputs/mock-uncited/xlsx-metrics |

Result: 0/4 passed.

## Failures
### docx-policy
- boundary: globalBoundaries must include at least 3 items
- forbidden-promise: forbidden promise: exact visual recreation
- forbidden-promise: forbidden promise: high-fidelity export
- unknown-evidence: rule docx-page-size cites missing.evidence.0001
### pdf-reference
- boundary: globalBoundaries must include at least 3 items
- forbidden-promise: forbidden promise: exact visual recreation
- forbidden-promise: forbidden promise: high-fidelity export
- unknown-evidence: rule pdf-page-1 cites missing.evidence.0001
- attribute-coverage: missing attribute textLayer
### pptx-briefing
- boundary: globalBoundaries must include at least 3 items
- forbidden-promise: forbidden promise: exact visual recreation
- forbidden-promise: forbidden promise: high-fidelity export
- unknown-evidence: rule pptx-deck-1 cites missing.evidence.0001
### xlsx-metrics
- boundary: globalBoundaries must include at least 3 items
- forbidden-promise: forbidden promise: exact visual recreation
- forbidden-promise: forbidden promise: high-fidelity export
- unknown-evidence: rule xlsx-workbook-1 cites missing.evidence.0001
