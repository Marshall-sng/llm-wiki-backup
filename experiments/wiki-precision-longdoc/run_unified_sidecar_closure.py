from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "experiments/wiki-precision-longdoc/artifacts"
MULTI = ARTIFACT_ROOT / "multiformat"
PDF = ARTIFACT_ROOT / "pdf-text-anchor"
OUT = ARTIFACT_ROOT / "unified-sidecar"
RESULT_MD = ROOT / ".omx/plans/experiments/wiki-precision-longdoc/unified-sidecar-closure-results.md"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def title_from_path(relative_path: str) -> str:
    name = Path(relative_path).name
    return re.sub(r"\.[^.]+$", "", name)


def normalize_anchor(source_id: str, fmt: str, anchor: dict[str, Any], *, confidence: float = 0.9) -> dict[str, Any]:
    text_len = anchor.get("text_len", 0)
    preview = anchor.get("preview") or anchor.get("head_preview") or ""
    if anchor.get("tail_preview") and anchor.get("head_preview"):
        preview = f"{anchor.get('head_preview')} ... {anchor.get('tail_preview')}"
    return {
        "anchor_id": anchor["anchor_id"],
        "source_id": source_id,
        "format": fmt,
        "kind": anchor["kind"],
        "selector": anchor.get("selector", {}),
        "text": {
            "preview": preview,
            "text_len": text_len,
            "text_hash": anchor.get("text_hash"),
        },
        "confidence": confidence,
        "metadata": {
            k: v
            for k, v in anchor.items()
            if k not in {"anchor_id", "kind", "selector", "preview", "head_preview", "tail_preview", "text_len", "text_hash"}
        },
    }


def quality(status: str, score: float, issues: list[str] | None = None) -> dict[str, Any]:
    return {"status": status, "quality_score": score, "issues": issues or []}


def review(source_id: str, severity: str, reason: str, anchor_id: str | None = None) -> dict[str, Any]:
    return {
        "review_id": f"review:{source_id}:{re.sub(r'[^a-zA-Z0-9]+', '-', reason).strip('-')[:40]}",
        "source_id": source_id,
        "anchor_id": anchor_id,
        "severity": severity,
        "reason": reason,
    }


def build_docx_sidecars(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sidecars = []
    for sample in payload["samples"]:
        anchors = [normalize_anchor(sample["sample_id"], "docx", a, confidence=0.92) for a in sample["anchor_samples"]]
        issues = []
        if sample["anchor_count"] > len(anchors):
            issues.append("artifact contains anchor samples only; full DOCX anchor extraction must be persisted in production")
        sidecars.append(
            {
                "schema_version": "0.1.0",
                "source": {
                    "source_id": sample["sample_id"],
                    "format": "docx",
                    "uri": sample["relative_path"],
                    "title": title_from_path(sample["relative_path"]),
                    "origin": "phase-1b-docx-anchor-samples",
                },
                "anchors": anchors,
                "coverage": {
                    "status": "passed" if sample["status"] == "passed" else "partial",
                    "anchor_count": sample["anchor_count"],
                    "text_units": sample["coverage"].get("paragraph", 0) + sample["coverage"].get("cell", 0),
                    "native": sample["coverage"],
                },
                "quality": quality("partial" if issues else "good", 0.78 if issues else 0.95, issues),
                "review_items": [review(sample["sample_id"], "info", issue) for issue in issues],
            }
        )
    return sidecars


def build_txt_sidecars(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sidecars = []
    for sample in payload["samples"]:
        anchors = [normalize_anchor(sample["sample_id"], "txt", a, confidence=0.95) for a in sample["anchor_samples"]]
        issues = []
        if sample["coverage"].get("chunks", 0) > len(anchors):
            issues.append("artifact contains representative TXT chunk anchors only; full chunk index should be persisted")
        if not sample["coverage"].get("tail_covered"):
            issues.append("tail coverage is false")
        sidecars.append(
            {
                "schema_version": "0.1.0",
                "source": {
                    "source_id": sample["sample_id"],
                    "format": "txt",
                    "uri": sample["relative_path"],
                    "title": title_from_path(sample["relative_path"]),
                    "origin": "phase-1b-txt-anchor-samples",
                },
                "anchors": anchors,
                "coverage": {
                    "status": "passed" if sample["status"] == "passed" else "partial",
                    "anchor_count": sample["coverage"].get("chunks", len(anchors)),
                    "text_units": sample["coverage"].get("text_chars", 0),
                    "native": sample["coverage"],
                },
                "quality": quality("partial" if issues else "good", 0.8 if issues else 0.98, issues),
                "review_items": [review(sample["sample_id"], "info", issue) for issue in issues],
            }
        )
    return sidecars


def normalize_xlsx_row_anchor(source_id: str, row: dict[str, Any]) -> dict[str, Any]:
    cells = row.get("cells", {})
    preview = " | ".join(v.get("preview", "") for v in cells.values() if v.get("preview"))
    return {
        "anchor_id": row["anchor_id"],
        "source_id": source_id,
        "format": "xlsx",
        "kind": row["kind"],
        "selector": row.get("selector", {}),
        "text": {
            "preview": preview[:500],
            "text_len": len(preview),
            "text_hash": row.get("row_hash"),
        },
        "confidence": 0.96,
        "metadata": {
            "nonempty_cell_count": row.get("nonempty_cell_count"),
            "cell_anchors": cells,
        },
    }


def build_xlsx_sidecars(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sidecars = []
    for sample in payload["samples"]:
        anchors = []
        for sheet in sample["sheets"]:
            for row in sheet.get("row_anchor_samples", []):
                anchors.append(normalize_xlsx_row_anchor(sample["sample_id"], row))
        issues = []
        total_rows = sum(sheet.get("row_anchor_count", 0) for sheet in sample["sheets"])
        if total_rows > len(anchors):
            issues.append("artifact contains representative XLSX row anchors only; full row/cell sidecar should be persisted")
        sidecars.append(
            {
                "schema_version": "0.1.0",
                "source": {
                    "source_id": sample["sample_id"],
                    "format": "xlsx",
                    "uri": sample["relative_path"],
                    "title": title_from_path(sample["relative_path"]),
                    "origin": "phase-1b-xlsx-anchor-samples",
                },
                "anchors": anchors,
                "coverage": {
                    "status": "passed" if sample["status"] == "passed" else "partial",
                    "anchor_count": total_rows,
                    "text_units": sample["coverage"].get("total_nonempty_cells", 0),
                    "native": sample["coverage"],
                },
                "quality": quality("partial" if issues else "good", 0.82 if issues else 0.97, issues),
                "review_items": [review(sample["sample_id"], "info", issue) for issue in issues],
            }
        )
    return sidecars


def build_pdf_sidecars(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sidecars = []
    for sample in payload["samples"]:
        anchors = [normalize_anchor(sample["sample_id"], "pdf", a, confidence=0.91) for a in sample.get("line_anchor_samples", [])]
        issues = []
        if sample["coverage"].get("line_anchors", 0) > len(anchors):
            issues.append("artifact contains representative PDF line anchors only; full line index should be persisted")
        if sample["coverage"].get("pages_failed", 0) > 0:
            issues.append("some PDF pages failed extraction")
        sidecars.append(
            {
                "schema_version": "0.1.0",
                "source": {
                    "source_id": sample["sample_id"],
                    "format": "pdf",
                    "uri": sample["relative_path"],
                    "title": title_from_path(sample["relative_path"]),
                    "origin": f"phase-1c-pdfjs-{payload.get('pdfjs_dist_version')}",
                },
                "anchors": anchors,
                "coverage": {
                    "status": "passed" if sample["status"] == "passed" else "partial",
                    "anchor_count": sample["coverage"].get("line_anchors", len(anchors)),
                    "text_units": sample["coverage"].get("chars", 0),
                    "native": sample["coverage"],
                },
                "quality": quality("partial" if issues else "good", 0.84 if issues else 0.94, issues),
                "review_items": [review(sample["sample_id"], "info", issue) for issue in issues],
            }
        )
    return sidecars


def build_index(sidecars: list[dict[str, Any]]) -> dict[str, Any]:
    entries = []
    for sidecar in sidecars:
        source = sidecar["source"]
        for anchor in sidecar["anchors"]:
            text = anchor["text"]["preview"]
            tokens = sorted(set(re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]{2,}", text.lower())))
            entries.append(
                {
                    "anchor_id": anchor["anchor_id"],
                    "source_id": source["source_id"],
                    "format": source["format"],
                    "kind": anchor["kind"],
                    "selector": anchor["selector"],
                    "preview": text,
                    "tokens": tokens[:80],
                }
            )
    return {"index_version": "0.1.0", "entry_count": len(entries), "entries": entries}


@dataclass
class Query:
    query_id: str
    text: str
    required_format: str | None = None
    required_source: str | None = None
    must_contain_any: tuple[str, ...] = ()


def score(query: Query, entry: dict[str, Any]) -> int:
    if query.required_format and entry["format"] != query.required_format:
        return -999
    if query.required_source and entry["source_id"] != query.required_source:
        return -999
    hay = entry["preview"].lower()
    score_value = 0
    for term in query.must_contain_any:
        if term.lower() in hay:
            score_value += 10
    for token in re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]{2,}", query.text.lower()):
        if token in hay:
            score_value += 3
    return score_value


def retrieval_smoke(index: dict[str, Any]) -> dict[str, Any]:
    queries = [
        Query("Q-docx-table", "document processing table parsing workflows", "docx", "S007", ("table", "processing")),
        Query("Q-pdf-regulation", "政务数据共享条例 国务院令", "pdf", "S003", ("政务数据共享条例", "国务院令")),
        Query("Q-txt-tail", "唐人的餐桌 尾部 厌胜之术 肥三 包子", "txt", "S002", ("厌胜之术", "肥三", "包子")),
        Query("Q-xlsx-data-element", "数据元 类别 名称", "xlsx", "S040", ("数据元", "类别", "名称")),
        Query("Q-insufficient", "不存在的测试实体XYZ-INSUFFICIENT", None, None, ("XYZ-INSUFFICIENT",)),
    ]
    results = []
    for q in queries:
        ranked = sorted(((score(q, e), e) for e in index["entries"]), key=lambda x: x[0], reverse=True)
        hits = [{"score": s, **e} for s, e in ranked if s > 0][:5]
        status = "hit" if hits else "insufficient_evidence"
        results.append(
            {
                "query_id": q.query_id,
                "query": q.text,
                "status": status,
                "top_hits": hits,
            }
        )
    return {
        "retrieval_mode": "keyword-smoke-test",
        "note": "This is not final RAG; it only verifies query can return source_id + anchor_id + selector.",
        "results": results,
        "passed": all(r["status"] == "hit" for r in results if r["query_id"] != "Q-insufficient")
        and any(r["status"] == "insufficient_evidence" for r in results if r["query_id"] == "Q-insufficient"),
    }


def wiki_candidate_skeleton(sidecars: list[dict[str, Any]], index: dict[str, Any]) -> dict[str, Any]:
    candidates = []
    for sidecar in sidecars:
        source = sidecar["source"]
        source_entries = [e for e in index["entries"] if e["source_id"] == source["source_id"]]
        candidates.append(
            {
                "candidate_id": f"wiki-candidate:{source['source_id']}",
                "source_id": source["source_id"],
                "title": source.get("title", source["source_id"]),
                "format": source["format"],
                "evidence_anchor_count_available_in_artifact": len(source_entries),
                "coverage_anchor_count_declared": sidecar["coverage"]["anchor_count"],
                "quality": sidecar["quality"],
                "seed_facts": [
                    {
                        "anchor_id": e["anchor_id"],
                        "kind": e["kind"],
                        "selector": e["selector"],
                        "preview": e["preview"],
                    }
                    for e in source_entries[:8]
                ],
                "review_items": sidecar.get("review_items", []),
            }
        )
    return {
        "note": "Skeleton only; final Wiki generation should use full sidecars plus LLM candidate generation and coverage audit.",
        "candidates": candidates,
    }


def coverage_summary(sidecars: list[dict[str, Any]]) -> dict[str, Any]:
    by_format: dict[str, Any] = {}
    for sidecar in sidecars:
        fmt = sidecar["source"]["format"]
        bucket = by_format.setdefault(
            fmt,
            {"sources": 0, "declared_anchor_count": 0, "artifact_anchor_count": 0, "text_units": 0, "quality_statuses": {}},
        )
        bucket["sources"] += 1
        bucket["declared_anchor_count"] += sidecar["coverage"]["anchor_count"]
        bucket["artifact_anchor_count"] += len(sidecar["anchors"])
        bucket["text_units"] += sidecar["coverage"].get("text_units", 0)
        qs = sidecar["quality"]["status"]
        bucket["quality_statuses"][qs] = bucket["quality_statuses"].get(qs, 0) + 1
    return {
        "summary_version": "0.1.0",
        "source_count": len(sidecars),
        "by_format": by_format,
        "known_limitations": [
            "Some Phase 1B/1C artifacts store representative anchors only; production must persist full sidecars.",
            "PDF line anchors are layout-derived and not yet semantic paragraphs.",
            "OCR remains out of scope.",
        ],
    }


def render_results(summary: dict[str, Any], smoke: dict[str, Any], candidates: dict[str, Any]) -> str:
    lines = [
        "# 统一 SourceSidecar / EvidenceAnchor 最小闭环实验结果",
        "",
        "## 总结论",
        "",
        "- evidence：已把 DOCX / PDF / TXT / XLSX 的实验产物归一为 SourceSidecar 结构。",
        "- evidence：已生成 EvidenceAnchorIndex，并完成 query → anchor → selector 的最小检索定位烟测。",
        "- evidence：烟测包含 positive hits 与 insufficient evidence 负例。",
        "- inference：统一接口 + 分格式 selector 是当前最优路线；不应把所有格式强行压成 Markdown 或单一 selector。",
        "- unknown：本轮聚合使用的是代表性 anchor artifact；生产接入必须持久化完整 sidecar。",
        "",
        "## 产物",
        "",
        "- `experiments/wiki-precision-longdoc/schemas/source-sidecar.schema.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/source-sidecar-examples.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/evidence-anchor-index.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/coverage-summary.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/retrieval-smoke-results.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/unified-sidecar/wiki-candidate-skeleton.json`",
        "",
        "## 覆盖汇总",
        "",
        "| 格式 | sources | declared anchors | artifact anchors | text units | quality |",
        "|---|---:|---:|---:|---:|---|",
    ]
    for fmt, data in summary["by_format"].items():
        lines.append(
            f"| {fmt} | {data['sources']} | {data['declared_anchor_count']} | {data['artifact_anchor_count']} | {data['text_units']} | {data['quality_statuses']} |"
        )
    lines += [
        "",
        "## 检索定位烟测",
        "",
        f"- passed：{smoke['passed']}",
        "",
        "| query_id | status | top anchor | selector |",
        "|---|---|---|---|",
    ]
    for result in smoke["results"]:
        if result["top_hits"]:
            top = result["top_hits"][0]
            lines.append(
                f"| {result['query_id']} | {result['status']} | `{top['anchor_id']}` | `{json.dumps(top['selector'], ensure_ascii=False)}` |"
            )
        else:
            lines.append(f"| {result['query_id']} | {result['status']} | - | - |")
    lines += [
        "",
        "## WikiCandidate 骨架",
        "",
        f"- candidate_count：{len(candidates['candidates'])}",
        "- 每个 candidate 已包含 source_id、format、coverage、quality、seed_facts、review_items。",
        "",
        "## 对下一步的影响",
        "",
        "1. 可以进入“第一批企业名单.xlsx”真实闭环，但应基于统一 SourceSidecar，而不是写 XLSX 特例。",
        "2. 生产设计需要先实现 full sidecar 持久化，再让 Wiki/RAG/长文/DOCX 导出消费 anchor index。",
        "3. CoverageAudit 应成为 Wiki 生成前置门禁：当 declared anchors 与可用 anchors 不一致，必须产生 ReviewItem。",
        "4. PDF.js 路线可进入 schema 化，但仍需 reading order / header footer / quality gate 后续实验。",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sidecars: list[dict[str, Any]] = []
    sidecars += build_docx_sidecars(read_json(MULTI / "docx-anchor-samples.json"))
    sidecars += build_txt_sidecars(read_json(MULTI / "txt-anchor-samples.json"))
    sidecars += build_xlsx_sidecars(read_json(MULTI / "xlsx-anchor-samples.json"))
    sidecars += build_pdf_sidecars(read_json(PDF / "pdfjs-text-anchor-probe.json"))

    index = build_index(sidecars)
    summary = coverage_summary(sidecars)
    smoke = retrieval_smoke(index)
    candidates = wiki_candidate_skeleton(sidecars, index)

    write_json(OUT / "source-sidecar-examples.json", {"schema_version": "0.1.0", "sidecars": sidecars})
    write_json(OUT / "evidence-anchor-index.json", index)
    write_json(OUT / "coverage-summary.json", summary)
    write_json(OUT / "retrieval-smoke-results.json", smoke)
    write_json(OUT / "wiki-candidate-skeleton.json", candidates)
    RESULT_MD.write_text(render_results(summary, smoke, candidates), encoding="utf-8")
    print(json.dumps({"summary": summary, "retrieval_passed": smoke["passed"], "candidate_count": len(candidates["candidates"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
