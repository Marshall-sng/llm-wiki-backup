from __future__ import annotations

import json
import re
import warnings
from pathlib import Path
from statistics import mean
from typing import Any

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "experiments/wiki-precision-longdoc/artifacts/production-readiness"
RESULT_MD = ROOT / ".omx/plans/experiments/wiki-precision-longdoc/production-readiness-supplemental-results.md"

MANIFEST = ROOT / "experiments/wiki-precision-longdoc/artifacts/multiformat/sample-manifest.json"
PDF_PROBE = ROOT / "experiments/wiki-precision-longdoc/artifacts/pdf-text-anchor/pdfjs-text-anchor-probe.json"
FIRST_BATCH_SIDECAR = ROOT / "experiments/wiki-precision-longdoc/artifacts/first-batch-company/source-sidecar.json"
FIRST_BATCH_WIKI_CANDIDATE = ROOT / "experiments/wiki-precision-longdoc/artifacts/first-batch-company/wiki-candidate.md"
FIRST_BATCH_OMISSION = ROOT / "experiments/wiki-precision-longdoc/artifacts/first-batch-company/omission-audit.json"
CURRENT_WIKI = Path(r"D:\大数据公司工作\数据流通\数据流通\wiki\sources\第一批企业名单.md")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return re.sub(r"[ \t]+", " ", str(value).replace("\r\n", "\n").strip())


def xlsx_merged_cell_experiment() -> dict[str, Any]:
    manifest = read_json(MANIFEST)
    root = Path(manifest["root"])
    xlsx_samples = [s for s in manifest["samples"] if s["extension"] == "xlsx"]
    results = []
    for sample in xlsx_samples:
        path = root / sample["relative_path"]
        try:
            wb = load_workbook(path, data_only=False)
        except Exception as exc:  # pragma: no cover
            results.append({"sample_id": sample["id"], "status": "failed-load", "error": str(exc)})
            continue
        workbook_result = {
            "sample_id": sample["id"],
            "relative_path": sample["relative_path"],
            "sheets": [],
            "total_merged_ranges": 0,
            "status": "no_merged_ranges",
        }
        for ws in wb.worksheets:
            sheet_result = {
                "sheet": ws.title,
                "merged_ranges": [],
                "affected_cells": 0,
                "header_context_examples": [],
            }
            for merged in ws.merged_cells.ranges:
                min_col, min_row, max_col, max_row = merged.bounds
                top_left = clean(ws.cell(min_row, min_col).value)
                cells = []
                for r in range(min_row, max_row + 1):
                    for c in range(min_col, max_col + 1):
                        cells.append(f"{get_column_letter(c)}{r}")
                sheet_result["merged_ranges"].append(
                    {
                        "range": str(merged),
                        "top_left_cell": f"{get_column_letter(min_col)}{min_row}",
                        "top_left_value": top_left,
                        "rows": [min_row, max_row],
                        "columns": [get_column_letter(min_col), get_column_letter(max_col)],
                        "affected_cells": cells,
                    }
                )
                sheet_result["affected_cells"] += len(cells)
                if top_left:
                    sheet_result["header_context_examples"].append(
                        {
                            "merged_range": str(merged),
                            "propagated_value": top_left,
                            "applies_to_cells": cells[:12],
                        }
                    )
            workbook_result["total_merged_ranges"] += len(sheet_result["merged_ranges"])
            workbook_result["sheets"].append(sheet_result)
        if workbook_result["total_merged_ranges"] > 0:
            workbook_result["status"] = "merged_ranges_found"
        results.append(workbook_result)

    with_merged = [r for r in results if r.get("total_merged_ranges", 0) > 0]
    return {
        "experiment": "xlsx merged cell semantics",
        "sample_count": len(xlsx_samples),
        "samples_with_merged_ranges": len(with_merged),
        "total_merged_ranges": sum(r.get("total_merged_ranges", 0) for r in results),
        "results": results,
        "recommendation": {
            "schema_required": True,
            "fields": ["merged_ranges", "merged_context", "header_context", "context_source_cell"],
            "reason": "merged cells are present in real samples and affect row/cell interpretation; row facts need propagated context.",
        },
    }


def pdf_quality_gate_experiment() -> dict[str, Any]:
    probe = read_json(PDF_PROBE)
    results = []
    for sample in probe["samples"]:
        c = sample["coverage"]
        pages = c.get("pages", 0) or 0
        chars = c.get("chars", 0) or 0
        text_items = c.get("text_items", 0) or 0
        line_anchors = c.get("line_anchors", 0) or 0
        pages_processed_ratio = c.get("pages_processed", 0) / pages if pages else 0
        pages_with_text_ratio = c.get("pages_with_text", 0) / pages if pages else 0
        chars_per_page = chars / pages if pages else 0
        items_per_page = text_items / pages if pages else 0
        lines_per_page = line_anchors / pages if pages else 0
        page_metrics = []
        low_text_pages = []
        for page in sample.get("page_summaries", []):
            page_chars = page.get("chars", 0)
            page_lines = page.get("line_anchors", 0)
            status = "good"
            reasons = []
            if page_chars == 0:
                status = "failed"
                reasons.append("no_text")
            elif page_chars < 50:
                status = "low_confidence"
                reasons.append("very_low_chars")
            elif page_lines < 2:
                status = "low_confidence"
                reasons.append("very_low_lines")
            if status != "good":
                low_text_pages.append({"page": page["page"], "status": status, "reasons": reasons, "chars": page_chars, "line_anchors": page_lines})
            page_metrics.append({"page": page["page"], "chars": page_chars, "line_anchors": page_lines, "status": status, "reasons": reasons})
        status = "good"
        issues = []
        if sample["status"] != "passed":
            status = "failed"
            issues.append("pdfjs_probe_failed")
        if pages_processed_ratio < 1:
            status = "partial"
            issues.append("not_all_pages_processed")
        if pages_with_text_ratio < 0.95:
            status = "partial" if status == "good" else status
            issues.append("low_pages_with_text_ratio")
        if chars_per_page < 80:
            status = "low_confidence" if status == "good" else status
            issues.append("low_chars_per_page")
        if len(low_text_pages) > max(1, pages * 0.1):
            status = "partial" if status == "good" else status
            issues.append("many_low_text_pages")
        results.append(
            {
                "sample_id": sample["sample_id"],
                "relative_path": sample["relative_path"],
                "quality_status": status,
                "issues": issues,
                "metrics": {
                    "pages": pages,
                    "pages_processed_ratio": round(pages_processed_ratio, 4),
                    "pages_with_text_ratio": round(pages_with_text_ratio, 4),
                    "chars_per_page": round(chars_per_page, 2),
                    "text_items_per_page": round(items_per_page, 2),
                    "line_anchors_per_page": round(lines_per_page, 2),
                    "failed_pages": c.get("pages_failed", 0),
                    "low_text_page_count": len(low_text_pages),
                },
                "low_text_pages": low_text_pages[:20],
                "review_items": [
                    {
                        "review_id": f"review:{sample['sample_id']}:pdf-quality:{issue}",
                        "source_id": sample["sample_id"],
                        "severity": "warning" if status != "failed" else "error",
                        "reason": issue,
                    }
                    for issue in issues
                ],
            }
        )
    good = [r for r in results if r["quality_status"] == "good"]
    return {
        "experiment": "pdf extraction quality gate",
        "pdfjs_dist_version": probe.get("pdfjs_dist_version"),
        "sample_count": len(results),
        "status_counts": {status: sum(1 for r in results if r["quality_status"] == status) for status in sorted(set(r["quality_status"] for r in results))},
        "recommended_gate": {
            "fail_if_pages_processed_ratio_lt": 1.0,
            "review_if_pages_with_text_ratio_lt": 0.95,
            "review_if_chars_per_page_lt": 80,
            "review_if_low_text_pages_gt_10_percent": True,
            "note": "Thresholds are initial product-design baselines from current samples, not final universal constants.",
        },
        "baseline_distribution": {
            "chars_per_page_avg": round(mean(r["metrics"]["chars_per_page"] for r in results), 2),
            "line_anchors_per_page_avg": round(mean(r["metrics"]["line_anchors_per_page"] for r in results), 2),
            "good_samples": len(good),
        },
        "results": results,
    }


def text_contains(text: str, value: str) -> bool:
    value = clean(value)
    return bool(value) and value in text


def extract_required_rows(sidecar: dict[str, Any]) -> list[dict[str, Any]]:
    return sidecar["domain_rows"]["first_batch"]


def coverage_for_candidate(name: str, candidate_text: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    required_fields = ["enterprise_name", "original_serial", "project_name", "contacts", "phones", "source_worksheets", "industry"]
    missing = []
    consumed = []
    for row in rows:
        row_result = {"row_anchor_id": row["row_anchor_id"], "enterprise_name": row["enterprise_name"], "missing_fields": [], "consumed_fields": []}
        checks = {
            "enterprise_name": [row["enterprise_name"]],
            "original_serial": [row["original_serial"]],
            "project_name": [clean(row["project_name"])[:30]] if row["project_name"] else [],
            "contacts": row["contacts"],
            "phones": row["phones"],
            "source_worksheets": row["source_worksheets"],
            "industry": [row["industry"]] if row["industry"] else [],
        }
        for field in required_fields:
            values = [v for v in checks[field] if clean(v)]
            if not values:
                continue
            if all(text_contains(candidate_text, v) for v in values):
                row_result["consumed_fields"].append(field)
            else:
                row_result["missing_fields"].append({"field": field, "expected_values": values})
        if row_result["missing_fields"]:
            missing.append(row_result)
        consumed.append(row_result)
    total_required = sum(len(r["missing_fields"]) + len(r["consumed_fields"]) for r in consumed)
    missing_count = sum(len(r["missing_fields"]) for r in consumed)
    coverage_ratio = (total_required - missing_count) / total_required if total_required else 1
    status = "passed" if coverage_ratio >= 0.95 else "failed" if coverage_ratio < 0.75 else "needs_review"
    blockers = []
    if any(any(m["field"] in {"enterprise_name", "project_name"} for m in r["missing_fields"]) for r in missing):
        blockers.append("missing_core_identity_or_project")
    if any(any(m["field"] in {"contacts", "phones"} for m in r["missing_fields"]) for r in missing):
        blockers.append("missing_contact_or_phone")
    return {
        "candidate_name": name,
        "status": status,
        "coverage_ratio": round(coverage_ratio, 4),
        "total_required_field_checks": total_required,
        "missing_field_checks": missing_count,
        "blockers": sorted(set(blockers)),
        "missing_rows": missing[:50],
    }


def coverage_audit_rules_experiment() -> dict[str, Any]:
    sidecar = read_json(FIRST_BATCH_SIDECAR)
    rows = extract_required_rows(sidecar)
    full_candidate_text = FIRST_BATCH_WIKI_CANDIDATE.read_text(encoding="utf-8", errors="replace")
    current_wiki_text = CURRENT_WIKI.read_text(encoding="utf-8", errors="replace")
    omission = read_json(FIRST_BATCH_OMISSION)
    full = coverage_for_candidate("full_experiment_wiki_candidate", full_candidate_text, rows)
    current = coverage_for_candidate("current_wiki_source_page", current_wiki_text, rows)
    return {
        "experiment": "coverage audit rules",
        "required_fields": ["enterprise_name", "original_serial", "project_name", "contacts", "phones", "source_worksheets", "industry"],
        "candidate_results": [full, current],
        "omission_audit_summary_by_type": omission.get("summary_by_type", {}),
        "recommended_rules": {
            "block_if_missing": ["enterprise_name", "project_name"],
            "review_if_missing": ["contacts", "phones", "source_worksheets", "industry"],
            "review_if_serial_rewritten": True,
            "allow_ignore_with_reason": True,
            "store_consumed_anchor_ids": True,
        },
        "conclusion": "CoverageAudit can distinguish a full row/cell wiki candidate from the current summary-style wiki page and should be a productization P0 gate.",
    }


def render_results(xlsx: dict[str, Any], pdf: dict[str, Any], audit: dict[str, Any]) -> str:
    lines = [
        "# Phase 1F 产品化设计前补充实验结果",
        "",
        "## 总结论",
        "",
        "- evidence：XLSX 样本中确实存在合并单元格，需要在 sidecar schema 中保留 merged ranges / propagated context。",
        "- evidence：PDF.js 产物可以计算 page-level quality metrics，并可形成初始 quality gate。",
        "- evidence：CoverageAudit 能区分完整 row/cell WikiCandidate 与当前摘要型 wiki source page。",
        "- inference：这三项都应进入产品化设计，其中 CoverageAudit 是 P0，XLSX merged context 与 PDF quality gate 是 P1/设计预留。",
        "",
        "## 产物",
        "",
        "- `experiments/wiki-precision-longdoc/artifacts/production-readiness/xlsx-merged-cell-results.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/production-readiness/pdf-quality-gate-results.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/production-readiness/coverage-audit-rules-results.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/production-readiness/production-readiness-summary.json`",
        "",
        "## E1 XLSX 合并单元格",
        "",
        f"- xlsx sample count：{xlsx['sample_count']}",
        f"- samples with merged ranges：{xlsx['samples_with_merged_ranges']}",
        f"- total merged ranges：{xlsx['total_merged_ranges']}",
        f"- schema_required：{xlsx['recommendation']['schema_required']}",
        "",
        "结论：产品化设计应加入 `merged_ranges`、`merged_context`、`header_context`、`context_source_cell`。",
        "",
        "## E2 PDF extraction quality gate",
        "",
        f"- sample count：{pdf['sample_count']}",
        f"- status counts：`{json.dumps(pdf['status_counts'], ensure_ascii=False)}`",
        f"- chars/page avg：{pdf['baseline_distribution']['chars_per_page_avg']}",
        f"- line anchors/page avg：{pdf['baseline_distribution']['line_anchors_per_page_avg']}",
        "",
        "建议初始门禁：",
        "",
    ]
    for k, v in pdf["recommended_gate"].items():
        lines.append(f"- {k}: {v}")
    lines += [
        "",
        "## E3 CoverageAudit rules",
        "",
        "| candidate | status | coverage_ratio | missing_field_checks | blockers |",
        "|---|---|---:|---:|---|",
    ]
    for r in audit["candidate_results"]:
        lines.append(f"| {r['candidate_name']} | {r['status']} | {r['coverage_ratio']} | {r['missing_field_checks']} | {r['blockers']} |")
    lines += [
        "",
        "推荐规则：",
        "",
    ]
    for k, v in audit["recommended_rules"].items():
        lines.append(f"- {k}: {v}")
    lines += [
        "",
        "## 对产品化设计的影响",
        "",
        "1. `SourceSidecar` schema 要扩展 XLSX merged cell context。",
        "2. `PdfExtractionQuality` 要作为 PDF sidecar 必备输出。",
        "3. `CoverageAudit` 需要在 WikiCandidate 生成后成为 P0 门禁。",
        "4. 进入产品化设计时可以不实现 OCR、PDF 表格恢复、DOCX 图片语义，但不能省略上述三个接口边界。",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    xlsx = xlsx_merged_cell_experiment()
    pdf = pdf_quality_gate_experiment()
    audit = coverage_audit_rules_experiment()
    summary = {
        "experiment": "production readiness supplemental experiments",
        "xlsx_merged_cell": {
            "samples_with_merged_ranges": xlsx["samples_with_merged_ranges"],
            "total_merged_ranges": xlsx["total_merged_ranges"],
            "schema_required": xlsx["recommendation"]["schema_required"],
        },
        "pdf_quality_gate": {
            "status_counts": pdf["status_counts"],
            "recommended_gate": pdf["recommended_gate"],
        },
        "coverage_audit_rules": {
            "candidate_results": [
                {
                    "candidate_name": r["candidate_name"],
                    "status": r["status"],
                    "coverage_ratio": r["coverage_ratio"],
                    "missing_field_checks": r["missing_field_checks"],
                }
                for r in audit["candidate_results"]
            ],
            "recommended_rules": audit["recommended_rules"],
        },
    }
    write_json(OUT / "xlsx-merged-cell-results.json", xlsx)
    write_json(OUT / "pdf-quality-gate-results.json", pdf)
    write_json(OUT / "coverage-audit-rules-results.json", audit)
    write_json(OUT / "production-readiness-summary.json", summary)
    RESULT_MD.write_text(render_results(xlsx, pdf, audit), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
