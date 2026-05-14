# FormatProfile DataScope Comparison

| Mode | Case | Requested | Effective | Final | Verdict | Fallback | Quality | RawCov | SourceCov | Chunks |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| mock-error | docx-policy | evidence-only | evidence-only | fallback | not_run | llm_error | 0.000 |  |  | 0 |
| mock-hallucination | docx-policy | evidence-only | evidence-only | fallback | fail | evaluator_rejected | 0.984 | 0.800 | 0.000 | 0 |
| mock-invalid-json | docx-policy | evidence-only | evidence-only | fallback | not_run | invalid_json | 0.000 |  |  | 0 |
| mock-overreach-instruction | docx-policy | evidence-only | evidence-only | fallback | not_run | schema_invalid | 0.000 |  |  | 0 |
| mock-pass | docx-policy | evidence-only | evidence-only | refined | pass |  | 0.984 | 1.000 | 0.000 | 0 |
| mock-pass | docx-policy | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.984 | 1.000 | 0.000 | 60 |
| mock-pass | docx-policy | evidence-plus-fulltext | unauthorized | fallback | not_run | source_context_unauthorized |  |  |  |  |
| mock-pass | docx-policy | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.984 | 1.000 | 0.000 | 24 |
| mock-pass | docx-policy | evidence-plus-snippets | unauthorized | fallback | not_run | source_context_unauthorized |  |  |  |  |
| mock-pass | pdf-reference | evidence-only | evidence-only | refined | pass |  | 0.994 | 1.000 | 0.000 | 0 |
| mock-pass | pdf-reference | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.994 | 1.000 | 0.000 | 4 |
| mock-pass | pdf-reference | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.994 | 1.000 | 0.000 | 4 |
| mock-pass | pptx-briefing | evidence-only | evidence-only | refined | pass |  | 0.994 | 1.000 | 0.000 | 0 |
| mock-pass | pptx-briefing | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.994 | 1.000 | 0.000 | 20 |
| mock-pass | pptx-briefing | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.994 | 1.000 | 0.000 | 9 |
| mock-pass | xlsx-metrics | evidence-only | evidence-only | refined | pass |  | 0.994 | 1.000 | 0.000 | 0 |
| mock-pass | xlsx-metrics | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.994 | 1.000 | 0.000 | 2 |
| mock-pass | xlsx-metrics | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.994 | 1.000 | 0.000 | 2 |
| mock-schema-invalid | docx-policy | evidence-only | evidence-only | fallback | not_run | schema_invalid | 0.000 |  |  | 0 |
| real-llm | docx-policy | evidence-only | evidence-only | refined | pass |  | 0.984 | 1.000 | 0.000 | 0 |
| real-llm | docx-policy | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.984 | 0.800 | 0.600 | 60 |
| real-llm | docx-policy | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.984 | 0.600 | 0.600 | 24 |
| real-llm | pdf-reference | evidence-only | evidence-only | refined | pass |  | 0.956 | 1.000 | 0.000 | 0 |
| real-llm | pdf-reference | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.956 | 1.000 | 0.000 | 4 |
| real-llm | pdf-reference | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.956 | 1.000 | 0.200 | 4 |
| real-llm | pptx-briefing | evidence-only | evidence-only | refined | pass |  | 0.956 | 1.000 | 0.000 | 0 |
| real-llm | pptx-briefing | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.956 | 1.000 | 0.000 | 20 |
| real-llm | pptx-briefing | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.956 | 1.000 | 0.000 | 9 |
| real-llm | xlsx-metrics | evidence-only | evidence-only | refined | pass |  | 0.956 | 1.000 | 0.000 | 0 |
| real-llm | xlsx-metrics | evidence-plus-fulltext | evidence-plus-fulltext | refined | pass |  | 0.956 | 1.000 | 0.600 | 2 |
| real-llm | xlsx-metrics | evidence-plus-snippets | evidence-plus-snippets | refined | pass |  | 0.956 | 1.000 | 0.400 | 2 |
