# FormatRuleSpec Independent Evaluation

Generated: 2026-05-14T09:15:54.182Z

Verdict: pass

| Mode | Expected | Total | Passed | Failed |
| --- | --- | ---: | ---: | --- |
| mock-llm | all-pass | 4 | 4 | - |
| mock-uncited | all-fail | 4 | 0 | docx-policy, pdf-reference, pptx-briefing, xlsx-metrics |

## Metrics
### mock-llm
- docx-policy: verdict=pass; rules=18; attrs=43; score=100
- pdf-reference: verdict=pass; rules=10; attrs=20; score=100
- pptx-briefing: verdict=pass; rules=14; attrs=31; score=100
- xlsx-metrics: verdict=pass; rules=14; attrs=32; score=100
### mock-uncited
- docx-policy: verdict=fail; rules=18; attrs=40; score=100
- pdf-reference: verdict=fail; rules=10; attrs=18; score=97
- pptx-briefing: verdict=fail; rules=14; attrs=28; score=100
- xlsx-metrics: verdict=fail; rules=14; attrs=30; score=100
