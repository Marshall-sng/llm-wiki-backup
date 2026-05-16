# Phase 1F 产品化设计前补充实验结果

## 总结论

- evidence：XLSX 样本中确实存在合并单元格，需要在 sidecar schema 中保留 merged ranges / propagated context。
- evidence：PDF.js 产物可以计算 page-level quality metrics，并可形成初始 quality gate。
- evidence：CoverageAudit 能区分完整 row/cell WikiCandidate 与当前摘要型 wiki source page。
- inference：这三项都应进入产品化设计，其中 CoverageAudit 是 P0，XLSX merged context 与 PDF quality gate 是 P1/设计预留。

## 产物

- `experiments/wiki-precision-longdoc/artifacts/production-readiness/xlsx-merged-cell-results.json`
- `experiments/wiki-precision-longdoc/artifacts/production-readiness/pdf-quality-gate-results.json`
- `experiments/wiki-precision-longdoc/artifacts/production-readiness/coverage-audit-rules-results.json`
- `experiments/wiki-precision-longdoc/artifacts/production-readiness/production-readiness-summary.json`

## E1 XLSX 合并单元格

- xlsx sample count：9
- samples with merged ranges：1
- total merged ranges：5
- schema_required：True

结论：产品化设计应加入 `merged_ranges`、`merged_context`、`header_context`、`context_source_cell`。

## E2 PDF extraction quality gate

- sample count：4
- status counts：`{"good": 4}`
- chars/page avg：762.42
- line anchors/page avg：29.15

建议初始门禁：

- fail_if_pages_processed_ratio_lt: 1.0
- review_if_pages_with_text_ratio_lt: 0.95
- review_if_chars_per_page_lt: 80
- review_if_low_text_pages_gt_10_percent: True
- note: Thresholds are initial product-design baselines from current samples, not final universal constants.

## E3 CoverageAudit rules

| candidate | status | coverage_ratio | missing_field_checks | blockers |
|---|---|---:|---:|---|
| full_experiment_wiki_candidate | passed | 1.0 | 0 | [] |
| current_wiki_source_page | failed | 0.47 | 53 | ['missing_contact_or_phone', 'missing_core_identity_or_project'] |

推荐规则：

- block_if_missing: ['enterprise_name', 'project_name']
- review_if_missing: ['contacts', 'phones', 'source_worksheets', 'industry']
- review_if_serial_rewritten: True
- allow_ignore_with_reason: True
- store_consumed_anchor_ids: True

## 对产品化设计的影响

1. `SourceSidecar` schema 要扩展 XLSX merged cell context。
2. `PdfExtractionQuality` 要作为 PDF sidecar 必备输出。
3. `CoverageAudit` 需要在 WikiCandidate 生成后成为 P0 门禁。
4. 进入产品化设计时可以不实现 OCR、PDF 表格恢复、DOCX 图片语义，但不能省略上述三个接口边界。
