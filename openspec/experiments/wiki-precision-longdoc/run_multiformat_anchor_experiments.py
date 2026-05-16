from __future__ import annotations

import hashlib
import json
import re
import warnings
import zlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "experiments/wiki-precision-longdoc/artifacts/multiformat"
MANIFEST = ARTIFACT_DIR / "sample-manifest.json"
RESULT_MD = ROOT / ".omx/plans/experiments/wiki-precision-longdoc/multiformat-experiment-results.md"

DOCX_IDS = ["S007", "S011", "S033"]
TXT_IDS = ["S002"]
PDF_IDS = ["S003", "S004", "S036", "S001"]
XLSX_IDS = ["S040", "S020"]

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}


def sha(text: str | bytes) -> str:
    if isinstance(text, str):
        text = text.encode("utf-8", errors="replace")
    return hashlib.sha256(text).hexdigest()[:16]


def preview(text: str, n: int = 240) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text[:n]


def read_manifest() -> tuple[Path, dict[str, dict[str, Any]]]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sample_root = Path(data["root"])
    samples = {s["id"]: s for s in data["samples"]}
    return sample_root, samples


def xml_text(node: ET.Element) -> str:
    return "".join(t.text or "" for t in node.findall(".//w:t", NS))


def docx_anchor_experiment(sample_root: Path, samples: dict[str, dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {"experiment": "DOCX paragraph/table/cell anchors", "samples": []}
    for sid in DOCX_IDS:
        sample = samples[sid]
        path = sample_root / sample["relative_path"]
        with ZipFile(path) as z:
            root = ET.fromstring(z.read("word/document.xml"))
            body = root.find("w:body", NS)
            anchors: list[dict[str, Any]] = []
            counters = {"paragraph": 0, "table": 0, "row": 0, "cell": 0, "nonempty_cell": 0}
            if body is not None:
                block_index = 0
                for child in list(body):
                    local = child.tag.rsplit("}", 1)[-1]
                    if local == "p":
                        counters["paragraph"] += 1
                        block_index += 1
                        text = xml_text(child)
                        style_node = child.find(".//w:pStyle", NS)
                        style = None
                        if style_node is not None:
                            style = style_node.attrib.get(f"{{{NS['w']}}}val")
                        if text.strip():
                            anchors.append(
                                {
                                    "anchor_id": f"{sid}:docx:p:{counters['paragraph']:05d}",
                                    "kind": "docx.paragraph",
                                    "selector": {"paragraph_index": counters["paragraph"], "block_index": block_index, "style": style},
                                    "text_len": len(text),
                                    "text_hash": sha(text),
                                    "preview": preview(text),
                                }
                            )
                    elif local == "tbl":
                        counters["table"] += 1
                        block_index += 1
                        table_idx = counters["table"]
                        rows = child.findall(".//w:tr", NS)
                        anchors.append(
                            {
                                "anchor_id": f"{sid}:docx:tbl:{table_idx:04d}",
                                "kind": "docx.table",
                                "selector": {"table_index": table_idx, "block_index": block_index, "row_count": len(rows)},
                            }
                        )
                        for r_idx, row in enumerate(rows, start=1):
                            counters["row"] += 1
                            cells = row.findall("./w:tc", NS)
                            row_text_parts = []
                            for c_idx, cell in enumerate(cells, start=1):
                                counters["cell"] += 1
                                ctext = xml_text(cell)
                                if ctext.strip():
                                    counters["nonempty_cell"] += 1
                                row_text_parts.append(ctext)
                                anchors.append(
                                    {
                                        "anchor_id": f"{sid}:docx:tbl:{table_idx:04d}:r:{r_idx:04d}:c:{c_idx:04d}",
                                        "kind": "docx.table_cell",
                                        "selector": {
                                            "table_index": table_idx,
                                            "row_index": r_idx,
                                            "cell_index": c_idx,
                                            "block_index": block_index,
                                        },
                                        "text_len": len(ctext),
                                        "text_hash": sha(ctext),
                                        "preview": preview(ctext),
                                    }
                                )
                            row_text = " | ".join(row_text_parts)
                            anchors.append(
                                {
                                    "anchor_id": f"{sid}:docx:tbl:{table_idx:04d}:r:{r_idx:04d}",
                                    "kind": "docx.table_row",
                                    "selector": {"table_index": table_idx, "row_index": r_idx, "cell_count": len(cells)},
                                    "text_len": len(row_text),
                                    "text_hash": sha(row_text),
                                    "preview": preview(row_text),
                                }
                            )
            out["samples"].append(
                {
                    "sample_id": sid,
                    "relative_path": sample["relative_path"],
                    "status": "passed" if counters["paragraph"] and anchors else "failed",
                    "coverage": counters,
                    "anchor_count": len(anchors),
                    "anchor_samples": anchors[:12] + anchors[-8:],
                }
            )
    return out


def build_line_starts(text: str) -> list[int]:
    starts = [0]
    for m in re.finditer("\n", text):
        starts.append(m.end())
    return starts


def line_for_char(starts: list[int], pos: int) -> int:
    # Small dependency-free bisect.
    lo, hi = 0, len(starts)
    while lo < hi:
        mid = (lo + hi) // 2
        if starts[mid] <= pos:
            lo = mid + 1
        else:
            hi = mid
    return max(1, lo)


def txt_anchor_experiment(sample_root: Path, samples: dict[str, dict[str, Any]]) -> dict[str, Any]:
    out = {"experiment": "TXT line/char/chunk anchors", "samples": []}
    chunk_chars = 20_000
    overlap = 1_000
    for sid in TXT_IDS:
        sample = samples[sid]
        path = sample_root / sample["relative_path"]
        # Use bytes.decode rather than Path.read_text so Python does not apply
        # universal-newline translation; char offsets should match decoded
        # source bytes as closely as possible.
        text = path.read_bytes().decode("utf-8-sig", errors="replace")
        starts = build_line_starts(text)
        anchors: list[dict[str, Any]] = []
        pos = 0
        chunk_idx = 0
        while pos < len(text):
            chunk_idx += 1
            end = min(len(text), pos + chunk_chars)
            chunk = text[pos:end]
            anchors.append(
                {
                    "anchor_id": f"{sid}:txt:chunk:{chunk_idx:05d}",
                    "kind": "txt.chunk",
                    "selector": {
                        "chunk_index": chunk_idx,
                        "char_start": pos,
                        "char_end": end,
                        "line_start": line_for_char(starts, pos),
                        "line_end": line_for_char(starts, max(pos, end - 1)),
                    },
                    "text_len": len(chunk),
                    "text_hash": sha(chunk),
                    "head_preview": preview(chunk[:300]),
                    "tail_preview": preview(chunk[-300:]),
                }
            )
            if end >= len(text):
                break
            pos = max(end - overlap, pos + 1)
        out["samples"].append(
            {
                "sample_id": sid,
                "relative_path": sample["relative_path"],
                "status": "passed" if anchors and anchors[-1]["selector"]["char_end"] == len(text) else "failed",
                "coverage": {
                    "text_chars": len(text),
                    "lines": len(starts),
                    "chunk_chars": chunk_chars,
                    "overlap_chars": overlap,
                    "chunks": len(anchors),
                    "first_char": anchors[0]["selector"]["char_start"],
                    "last_char": anchors[-1]["selector"]["char_end"],
                    "tail_covered": anchors[-1]["selector"]["char_end"] == len(text),
                },
                "anchor_samples": anchors[:3] + anchors[len(anchors) // 2 : len(anchors) // 2 + 2] + anchors[-3:],
            }
        )
    return out


def decompress_pdf_streams(raw: bytes) -> list[bytes]:
    streams: list[bytes] = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", raw, re.S):
        payload = m.group(1).strip(b"\r\n")
        if len(payload) < 8:
            continue
        try:
            streams.append(zlib.decompress(payload))
        except Exception:
            streams.append(payload[:200_000])
    return streams


def pdf_diagnostic_experiment(sample_root: Path, samples: dict[str, dict[str, Any]]) -> dict[str, Any]:
    out = {"experiment": "PDF extraction diagnostics and page-anchor skeletons", "samples": []}
    for sid in PDF_IDS:
        sample = samples[sid]
        path = sample_root / sample["relative_path"]
        raw = path.read_bytes()
        streams = decompress_pdf_streams(raw)
        haystack = raw[:1_000_000] + b"\n" + b"\n".join(streams[:200])[:6_000_000]
        page_count = len(re.findall(rb"/Type\s*/Page\b", raw))
        text_ops = len(re.findall(rb"\b(BT|ET|Tj|TJ|Tf|Td|Tm)\b", haystack))
        image_count = len(re.findall(rb"/Subtype\s*/Image\b", raw))
        encrypted = b"/Encrypt" in raw
        if encrypted:
            extraction_status = "insufficient-extraction: encrypted-or-permission-limited"
        elif text_ops > max(20, page_count):
            extraction_status = "diagnostic-pass: text-like-pdf-but-no-page-text-extractor"
        else:
            extraction_status = "insufficient-extraction: low-text-operator-signal"
        page_anchors = [
            {"anchor_id": f"{sid}:pdf:page:{i:04d}", "kind": "pdf.page", "selector": {"page": i}}
            for i in range(1, min(page_count, 5) + 1)
        ]
        out["samples"].append(
            {
                "sample_id": sid,
                "relative_path": sample["relative_path"],
                "status": "passed-diagnostic" if extraction_status.startswith("diagnostic-pass") else "needs-review",
                "extraction_status": extraction_status,
                "coverage": {
                    "estimated_pages": page_count,
                    "stream_count": len(streams),
                    "text_operator_hits": text_ops,
                    "image_xobjects": image_count,
                    "encrypted": encrypted,
                    "page_anchor_skeleton_count": page_count,
                },
                "anchor_samples": page_anchors,
                "unknown": [
                    "未接入真实 PDF 文本抽取器，因此未生成 text-span anchor。",
                    "OCR 已按当前要求暂不处理。",
                ],
            }
        )
    return out


def cell_value_summary(value: Any) -> dict[str, Any]:
    if value is None:
        return {"empty": True}
    if isinstance(value, str) and value.startswith("="):
        vtype = "formula"
    elif isinstance(value, (int, float)):
        vtype = "number"
    else:
        vtype = type(value).__name__
    text = str(value)
    return {"empty": False, "type": vtype, "text_len": len(text), "text_hash": sha(text), "preview": preview(text, 120)}


def xlsx_anchor_experiment(sample_root: Path, samples: dict[str, dict[str, Any]]) -> dict[str, Any]:
    out = {"experiment": "XLSX sheet/row/cell anchors", "samples": []}
    for sid in XLSX_IDS:
        sample = samples[sid]
        path = sample_root / sample["relative_path"]
        wb = load_workbook(path, read_only=False, data_only=False)
        sheet_results = []
        total_rows = 0
        total_cells = 0
        total_nonempty = 0
        for ws in wb.worksheets:
            rows = []
            nonempty_rows = 0
            nonempty_cells = 0
            for r_idx in range(1, ws.max_row + 1):
                cells: dict[str, Any] = {}
                row_has_value = False
                for c_idx in range(1, ws.max_column + 1):
                    value = ws.cell(r_idx, c_idx).value
                    if value is not None:
                        row_has_value = True
                        nonempty_cells += 1
                        col = get_column_letter(c_idx)
                        cells[col] = {
                            "anchor_id": f"{sid}:xlsx:{ws.title}:r:{r_idx}:c:{col}",
                            "selector": {"sheet": ws.title, "row": r_idx, "column": col, "cell": f"{col}{r_idx}"},
                            **cell_value_summary(value),
                        }
                if row_has_value:
                    nonempty_rows += 1
                    row_text = " | ".join(v.get("preview", "") for v in cells.values())
                    rows.append(
                        {
                            "anchor_id": f"{sid}:xlsx:{ws.title}:r:{r_idx}",
                            "kind": "xlsx.row",
                            "selector": {"sheet": ws.title, "row": r_idx},
                            "nonempty_cell_count": len(cells),
                            "row_hash": sha(row_text),
                            "cells": cells,
                        }
                    )
            total_rows += ws.max_row
            total_cells += (ws.max_row or 0) * (ws.max_column or 0)
            total_nonempty += nonempty_cells
            sheet_results.append(
                {
                    "sheet": ws.title,
                    "coverage": {
                        "max_row": ws.max_row,
                        "max_column": ws.max_column,
                        "nonempty_rows": nonempty_rows,
                        "nonempty_cells": nonempty_cells,
                        "merged_ranges": len(ws.merged_cells.ranges),
                    },
                    "row_anchor_count": len(rows),
                    "row_anchor_samples": rows[:5] + rows[-5:],
                }
            )
        out["samples"].append(
            {
                "sample_id": sid,
                "relative_path": sample["relative_path"],
                "status": "passed" if total_nonempty > 0 else "failed",
                "coverage": {
                    "sheets": len(wb.worksheets),
                    "total_grid_rows": total_rows,
                    "total_grid_cells": total_cells,
                    "total_nonempty_cells": total_nonempty,
                },
                "sheets": sheet_results,
            }
        )
    return out


def write_json(name: str, payload: dict[str, Any]) -> Path:
    path = ARTIFACT_DIR / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def render_results(docx: dict[str, Any], txt: dict[str, Any], pdf: dict[str, Any], xlsx: dict[str, Any], summary: dict[str, Any]) -> str:
    lines = [
        "# Phase 1B 多格式 Evidence Anchor 实验执行记录",
        "",
        "## 总结论",
        "",
        "- evidence：DOCX、TXT、XLSX 已生成可复查的结构化 anchor sidecar 样例。",
        "- evidence：PDF 已生成 page-anchor skeleton 与抽取质量诊断；OCR 暂按要求不处理。",
        "- inference：当前最优路线仍是 `EvidenceAnchor-first + StructuredExtraction sidecar + CoverageAudit`，但 PDF 需要真实 text-span 抽取器才能进入与 DOCX/XLSX/TXT 同等级别的精准定位。",
        "- unknown：PDF text block / char range 的稳定性尚未验证；扫描 PDF/OCR 暂不进入本轮判断。",
        "",
        "## 产物",
        "",
        "- `experiments/wiki-precision-longdoc/artifacts/multiformat/docx-anchor-samples.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/multiformat/txt-anchor-samples.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/multiformat/pdf-extraction-diagnostics.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/multiformat/xlsx-anchor-samples.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/multiformat/multiformat-experiment-summary.json`",
        "",
        "## 状态概览",
        "",
        "| 实验 | 状态 | 关键证据 |",
        "|---|---|---|",
    ]
    for item in summary["results"]:
        lines.append(f"| {item['name']} | {item['status']} | {item['evidence']} |")
    lines += [
        "",
        "## DOCX 实验",
        "",
        "要验证的问题：DOCX 是否能以 paragraph/table/row/cell 形成稳定 evidence anchor。",
        "",
    ]
    for s in docx["samples"]:
        c = s["coverage"]
        lines.append(
            f"- {s['sample_id']} `{s['relative_path']}`：{s['status']}，paragraph={c['paragraph']}，table={c['table']}，row={c['row']}，cell={c['cell']}，anchor={s['anchor_count']}。"
        )
    lines += [
        "",
        "inference：DOCX 不应只转纯 Markdown；应保留 paragraph/table/cell 结构 sidecar，再让 Wiki 生成引用 anchor。",
        "",
        "## TXT 实验",
        "",
    ]
    for s in txt["samples"]:
        c = s["coverage"]
        lines.append(
            f"- {s['sample_id']} `{s['relative_path']}`：{s['status']}，chars={c['text_chars']}，lines={c['lines']}，chunks={c['chunks']}，tail_covered={c['tail_covered']}。"
        )
    lines += [
        "",
        "inference：TXT 长文需要 line/char/chunk 三层 anchor；仅靠一次 Chat 或开头摘要无法证明完整覆盖。",
        "",
        "## PDF 实验",
        "",
    ]
    for s in pdf["samples"]:
        c = s["coverage"]
        lines.append(
            f"- {s['sample_id']} `{s['relative_path']}`：{s['status']}，status={s['extraction_status']}，pages={c['estimated_pages']}，text_ops={c['text_operator_hits']}，images={c['image_xobjects']}。"
        )
    lines += [
        "",
        "inference：PDF 可以先建立 page anchor 与抽取质量门禁；但要达到精准定位，需要后续接入真实 PDF text-span/block 抽取器。OCR 暂不处理。",
        "",
        "## XLSX 实验",
        "",
    ]
    for s in xlsx["samples"]:
        c = s["coverage"]
        lines.append(
            f"- {s['sample_id']} `{s['relative_path']}`：{s['status']}，sheets={c['sheets']}，grid_cells={c['total_grid_cells']}，nonempty_cells={c['total_nonempty_cells']}。"
        )
    lines += [
        "",
        "inference：XLSX 必须保留 sheet/row/cell anchor；这正是修复“第一批企业名单.xlsx”行级事实丢失的关键。",
        "",
        "## 对目标架构的影响",
        "",
        "1. EvidenceAnchor 应采用统一接口 + 分类型 selector：",
        "   - DOCX：paragraph/table/row/cell。",
        "   - TXT：line/char/chunk。",
        "   - PDF：page，后续扩展 block/span/position。",
        "   - XLSX：sheet/row/column/cell。",
        "2. converted markdown 只能作为可读中间表达，不能作为唯一事实层。",
        "3. Wiki 生成前应先有 sidecar coverage summary，再进入候选实体/事实生成和遗漏审计。",
        "4. PDF 在未完成 text-span 抽取前，应进入 `partial / needs-review`，不能静默当作完整材料。",
        "",
        "## 下一步最小闭环",
        "",
        "1. 把 DOCX/TXT/XLSX sidecar 数据结构收敛成一个 TypeScript schema 草案。",
        "2. 用“第一批企业名单.xlsx”补一个 row/cell anchor 到 WikiCandidate 的闭环实验。",
        "3. 为 PDF 选择或实现 text-span 抽取器；OCR 后置。",
        "4. 将 CoverageAudit 作为 Wiki 生成前置门禁，而不是事后人工发现遗漏。",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sample_root, samples = read_manifest()
    docx = docx_anchor_experiment(sample_root, samples)
    txt = txt_anchor_experiment(sample_root, samples)
    pdf = pdf_diagnostic_experiment(sample_root, samples)
    xlsx = xlsx_anchor_experiment(sample_root, samples)

    write_json("docx-anchor-samples.json", docx)
    write_json("txt-anchor-samples.json", txt)
    write_json("pdf-extraction-diagnostics.json", pdf)
    write_json("xlsx-anchor-samples.json", xlsx)

    summary = {
        "results": [
            {
                "name": "DOCX paragraph/table/cell anchor",
                "status": "passed" if all(s["status"] == "passed" for s in docx["samples"]) else "issues_found",
                "evidence": "; ".join(f"{s['sample_id']} anchors={s['anchor_count']}" for s in docx["samples"]),
            },
            {
                "name": "TXT line/char/chunk coverage",
                "status": "passed" if all(s["status"] == "passed" for s in txt["samples"]) else "issues_found",
                "evidence": "; ".join(f"{s['sample_id']} chunks={s['coverage']['chunks']} tail={s['coverage']['tail_covered']}" for s in txt["samples"]),
            },
            {
                "name": "PDF page-anchor diagnostic",
                "status": "partial",
                "evidence": "; ".join(f"{s['sample_id']} {s['extraction_status']}" for s in pdf["samples"]),
            },
            {
                "name": "XLSX row/cell anchor",
                "status": "passed" if all(s["status"] == "passed" for s in xlsx["samples"]) else "issues_found",
                "evidence": "; ".join(f"{s['sample_id']} cells={s['coverage']['total_nonempty_cells']}" for s in xlsx["samples"]),
            },
        ]
    }
    write_json("multiformat-experiment-summary.json", summary)
    RESULT_MD.parent.mkdir(parents=True, exist_ok=True)
    RESULT_MD.write_text(render_results(docx, txt, pdf, xlsx, summary), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
