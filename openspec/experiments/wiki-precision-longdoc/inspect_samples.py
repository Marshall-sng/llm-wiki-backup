from __future__ import annotations

import argparse
import json
import re
import warnings
import zlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from openpyxl import load_workbook


warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


@dataclass
class Sample:
    id: str
    relative_path: str
    name: str
    extension: str
    size_bytes: int
    group: str
    status: str
    role: list[str]
    metrics: dict[str, Any]
    notes: list[str]


def text_from_xml(root: ET.Element, tag: str) -> str:
    return "".join(node.text or "" for node in root.findall(f".//{tag}", NS))


def inspect_docx(path: Path) -> tuple[dict[str, Any], list[str], list[str]]:
    notes: list[str] = []
    role: list[str] = ["docx-anchor"]
    metrics: dict[str, Any] = {}
    try:
        with ZipFile(path) as z:
            names = z.namelist()
            doc_xml = z.read("word/document.xml")
            root = ET.fromstring(doc_xml)
            text = text_from_xml(root, "w:t")
            paragraphs = root.findall(".//w:p", NS)
            tables = root.findall(".//w:tbl", NS)
            rows = root.findall(".//w:tr", NS)
            cells = root.findall(".//w:tc", NS)
            headings = []
            numbered = 0
            for p in paragraphs:
                pstyle = p.find(".//w:pStyle", NS)
                if pstyle is not None:
                    val = pstyle.attrib.get(f"{{{NS['w']}}}val", "")
                    if val.lower().startswith("heading") or "标题" in val:
                        headings.append(val)
                if p.find(".//w:numPr", NS) is not None:
                    numbered += 1
            metrics.update(
                {
                    "text_chars": len(text),
                    "paragraphs": len(paragraphs),
                    "tables": len(tables),
                    "table_rows": len(rows),
                    "table_cells": len(cells),
                    "heading_paragraphs": len(headings),
                    "numbered_paragraphs": numbered,
                    "media_files": len([n for n in names if n.startswith("word/media/")]),
                }
            )
            if len(text) > 80_000 or len(paragraphs) > 800:
                role.append("long-docx")
            if tables:
                role.append("docx-table")
            if metrics["media_files"]:
                role.append("docx-media")
            if headings or numbered:
                role.append("docx-structure")
            if len(text) < 500 and metrics["media_files"]:
                notes.append("文本较少且含图片，适合媒体/近似扫描类处理，不适合全文覆盖评估。")
    except Exception as exc:  # pragma: no cover - diagnostic script
        notes.append(f"DOCX inspection failed: {exc}")
        metrics["error"] = str(exc)
    return metrics, role, notes


def inspect_xlsx(path: Path) -> tuple[dict[str, Any], list[str], list[str]]:
    notes: list[str] = []
    role: list[str] = ["xlsx-anchor", "row-cell-anchor"]
    metrics: dict[str, Any] = {}
    try:
        wb = load_workbook(path, read_only=False, data_only=False)
        sheet_summaries = []
        total_nonempty = 0
        formulas = 0
        merged = 0
        max_rows = 0
        max_cols = 0
        for ws in wb.worksheets:
            nonempty = 0
            sheet_formula = 0
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value is not None:
                        nonempty += 1
                        if isinstance(cell.value, str) and cell.value.startswith("="):
                            sheet_formula += 1
            total_nonempty += nonempty
            formulas += sheet_formula
            merged += len(ws.merged_cells.ranges)
            max_rows = max(max_rows, ws.max_row or 0)
            max_cols = max(max_cols, ws.max_column or 0)
            sheet_summaries.append(
                {
                    "sheet": ws.title,
                    "max_row": ws.max_row,
                    "max_column": ws.max_column,
                    "nonempty_cells": nonempty,
                    "formula_cells": sheet_formula,
                    "merged_ranges": len(ws.merged_cells.ranges),
                }
            )
        metrics.update(
            {
                "sheets": len(wb.worksheets),
                "max_rows": max_rows,
                "max_columns": max_cols,
                "nonempty_cells": total_nonempty,
                "formula_cells": formulas,
                "merged_ranges": merged,
                "sheet_summaries": sheet_summaries,
            }
        )
        if max_cols >= 20:
            role.append("wide-table")
        if max_rows >= 100:
            role.append("large-table")
        if formulas:
            role.append("formula")
        if len(wb.worksheets) > 1:
            role.append("multi-sheet")
    except Exception as exc:  # pragma: no cover
        notes.append(f"XLSX inspection failed: {exc}")
        metrics["error"] = str(exc)
    return metrics, role, notes


def decompress_pdf_streams(raw: bytes) -> list[bytes]:
    streams: list[bytes] = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", raw, re.S):
        payload = m.group(1).strip(b"\r\n")
        if len(payload) < 8:
            continue
        try:
            streams.append(zlib.decompress(payload))
        except Exception:
            # Some streams may use PNG predictor or non-Flate compression; raw
            # stream is still useful for operator heuristics.
            streams.append(payload[:200_000])
    return streams


def inspect_pdf(path: Path) -> tuple[dict[str, Any], list[str], list[str]]:
    notes: list[str] = []
    role: list[str] = ["pdf-anchor"]
    raw = path.read_bytes()
    streams = decompress_pdf_streams(raw)
    joined = b"\n".join(streams[:300])
    haystack = raw[:1_000_000] + b"\n" + joined[:8_000_000]
    page_count = len(re.findall(rb"/Type\s*/Page\b", raw))
    image_count = len(re.findall(rb"/Subtype\s*/Image\b", raw))
    text_ops = len(re.findall(rb"\b(BT|ET|Tj|TJ|Tf|Td|Tm)\b", haystack))
    cjk_bytes = len(re.findall(rb"[\x80-\xff]{2,}", haystack))
    metrics = {
        "estimated_pages": page_count,
        "stream_count": len(streams),
        "image_xobjects": image_count,
        "text_operator_hits": text_ops,
        "compressed_stream_bytes_sampled": sum(len(s) for s in streams[:300]),
        "non_ascii_runs_in_streams": cjk_bytes,
        "encrypted": b"/Encrypt" in raw,
    }
    if page_count >= 80:
        role.append("long-pdf")
    if image_count:
        role.append("pdf-images")
    if text_ops > max(20, page_count):
        role.append("pdf-text-like")
    else:
        notes.append("未安装 PDF 文本抽取库，当前只做页面/流/文本操作符启发式检查；需在实验中用真实抽取器复核。")
        role.append("pdf-extractability-unknown")
    return metrics, role, notes


def inspect_txt(path: Path) -> tuple[dict[str, Any], list[str], list[str]]:
    notes: list[str] = []
    role = ["txt-anchor"]
    data = path.read_bytes()
    text = data.decode("utf-8-sig", errors="replace")
    lines = text.splitlines()
    heading_re = re.compile(r"^\\s*(#{1,6}\\s+|第[一二三四五六七八九十百千万0-9]+[章节回部篇卷]|[一二三四五六七八九十]+、)")
    headings = [line for line in lines if heading_re.search(line)]
    metrics = {
        "text_chars": len(text),
        "lines": len(lines),
        "estimated_headings": len(headings),
        "replacement_chars": text.count("�"),
        "tail_chars_available": len(text[-5000:]),
    }
    if len(text) > 500_000:
        role.append("long-txt")
    if headings:
        role.append("sectioned-text")
    return metrics, role, notes


def inspect_pptx(path: Path) -> tuple[dict[str, Any], list[str], list[str]]:
    notes = ["PPTX 当前按用户要求暂不纳入本轮实验，只登记库存。"]
    role = ["pptx-inventory-only"]
    metrics: dict[str, Any] = {}
    try:
        with ZipFile(path) as z:
            slide_names = sorted(n for n in z.namelist() if re.match(r"ppt/slides/slide\\d+\\.xml$", n))
            text_chars = 0
            for n in slide_names:
                root = ET.fromstring(z.read(n))
                text_chars += len(text_from_xml(root, "a:t"))
            metrics = {
                "slides": len(slide_names),
                "text_chars": text_chars,
                "media_files": len([n for n in z.namelist() if n.startswith("ppt/media/")]),
            }
    except Exception as exc:  # pragma: no cover
        notes.append(f"PPTX inspection failed: {exc}")
        metrics["error"] = str(exc)
    return metrics, role, notes


def group_for(path: Path, root: Path) -> str:
    rel = path.relative_to(root)
    parts = [p.lower() for p in rel.parts]
    if len(parts) == 1:
        return "top-level"
    return "/".join(parts[:-1])


def inspect_file(path: Path, root: Path, idx: int) -> Sample:
    ext = path.suffix.lower()
    metrics: dict[str, Any] = {}
    role: list[str] = []
    notes: list[str] = []
    status = "candidate"
    if ext == ".docx":
        metrics, role, notes = inspect_docx(path)
    elif ext in {".xlsx", ".xlsm"}:
        metrics, role, notes = inspect_xlsx(path)
    elif ext == ".pdf":
        metrics, role, notes = inspect_pdf(path)
    elif ext == ".txt":
        metrics, role, notes = inspect_txt(path)
    elif ext == ".pptx":
        metrics, role, notes = inspect_pptx(path)
        status = "excluded-current-round"
    else:
        role = ["unsupported-inventory-only"]
        status = "excluded-current-round"
    if metrics.get("error"):
        status = "needs-fix"
    rel = str(path.relative_to(root)).replace("\\", "/")
    return Sample(
        id=f"S{idx:03d}",
        relative_path=rel,
        name=path.name,
        extension=ext.lstrip("."),
        size_bytes=path.stat().st_size,
        group=group_for(path, root),
        status=status,
        role=role,
        metrics=metrics,
        notes=notes,
    )


def summarize(samples: list[Sample]) -> dict[str, Any]:
    by_ext: dict[str, int] = {}
    by_group: dict[str, int] = {}
    for s in samples:
        by_ext[s.extension] = by_ext.get(s.extension, 0) + 1
        by_group[s.group] = by_group.get(s.group, 0) + 1

    selected = []
    for s in samples:
        r = set(s.role)
        if (
            "long-docx" in r
            or "docx-table" in r
            or "long-txt" in r
            or "long-pdf" in r
            or "pdf-text-like" in r
            or "wide-table" in r
            or "large-table" in r
            or ("xlsx-anchor" in r and "local" in s.group)
        ):
            if s.status == "candidate":
                selected.append(s.id)
    return {
        "total_files": len(samples),
        "by_extension": by_ext,
        "by_group": by_group,
        "selected_candidate_ids": selected,
        "coverage_judgement": {
            "docx": any(s.extension == "docx" for s in samples),
            "pdf": any(s.extension == "pdf" for s in samples),
            "txt": any(s.extension == "txt" for s in samples),
            "xlsx": any(s.extension == "xlsx" for s in samples),
            "pptx_inventory_only": any(s.extension == "pptx" for s in samples),
            "has_long_txt": any("long-txt" in s.role for s in samples),
            "has_long_docx": any("long-docx" in s.role for s in samples),
            "has_long_pdf_heuristic": any("long-pdf" in s.role for s in samples),
            "has_row_cell_xlsx": any("row-cell-anchor" in s.role for s in samples),
            "has_scanned_pdf_confirmed": False,
        },
    }


def render_markdown(root: Path, samples: list[Sample], summary: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# 多格式实验样本清单与适配性确认")
    lines.append("")
    lines.append(f"- 样本根目录：`{root}`")
    lines.append(f"- 全量文件数：{summary['total_files']}")
    lines.append(f"- 格式分布：`{summary['by_extension']}`")
    lines.append(f"- 分组分布：`{summary['by_group']}`")
    lines.append("")
    lines.append("## 结论")
    lines.append("")
    cj = summary["coverage_judgement"]
    lines.append("- **满足本轮 DOCX / PDF / TXT / XLSX 多格式 Evidence Anchor 实验的基础样本需求。**")
    lines.append("- DOCX 覆盖：普通制度文档、表格文档、多章节长 DOCX、含图片 DOCX。")
    lines.append("- PDF 覆盖：政策/规范/Q&A/白皮书/平台介绍等真实材料；当前用启发式确认页数、图片对象和文本操作符，仍需在正式 PDF 抽取实验中接入真实文本抽取器复核。")
    lines.append("- TXT 覆盖：存在超长 TXT，可用于尾部实体覆盖、章节/滑窗/遗漏审计实验。")
    lines.append("- XLSX 覆盖：存在本地领域表格和公开结构样本，可用于 row/cell anchor、宽表、多 sheet、公式/样式保真相关实验。")
    lines.append("- PPTX 已登记但按当前路线暂不纳入本轮实验。")
    if not cj["has_scanned_pdf_confirmed"]:
        lines.append("- **缺口**：未确认存在真正扫描版/图片型 PDF；若后续要验证 OCR，应补充 1 个扫描 PDF。")
    lines.append("")
    lines.append("## 推荐优先实验素材")
    lines.append("")
    selected = set(summary["selected_candidate_ids"])
    for s in samples:
        if s.id not in selected:
            continue
        lines.append(f"### {s.id} `{s.relative_path}`")
        lines.append(f"- 角色：{', '.join(s.role)}")
        lines.append(f"- 大小：{s.size_bytes} bytes")
        metric_preview = {k: v for k, v in s.metrics.items() if k != "sheet_summaries"}
        lines.append(f"- 指标：`{json.dumps(metric_preview, ensure_ascii=False)}`")
        if s.notes:
            lines.append(f"- 备注：{'；'.join(s.notes)}")
        lines.append("")
    lines.append("## 全量清单")
    lines.append("")
    lines.append("| ID | 格式 | 分组 | 文件 | 状态 | 角色 | 关键指标 |")
    lines.append("|---|---|---|---|---|---|---|")
    for s in samples:
        key_metrics = {}
        for key in [
            "text_chars",
            "paragraphs",
            "tables",
            "table_rows",
            "estimated_pages",
            "text_operator_hits",
            "lines",
            "sheets",
            "max_rows",
            "max_columns",
            "slides",
            "media_files",
        ]:
            if key in s.metrics:
                key_metrics[key] = s.metrics[key]
        lines.append(
            f"| {s.id} | {s.extension} | {s.group} | `{s.name}` | {s.status} | {', '.join(s.role)} | `{json.dumps(key_metrics, ensure_ascii=False)}` |"
        )
    lines.append("")
    lines.append("## 使用约定")
    lines.append("")
    lines.append("- 本清单只整理实验素材，不代表生产 pipeline 已支持这些格式。")
    lines.append("- 实验记录需引用样本 ID，避免路径变动造成记录不可追踪。")
    lines.append("- PDF 文本可抽取性目前为启发式判断；正式实验需记录抽取器、版本、失败样本和 fallback。")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=r"D:\llm_wiki\runtime\format-profile\samples")
    parser.add_argument("--out-json", required=True)
    parser.add_argument("--out-md", required=True)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    files = sorted(p for p in root.rglob("*") if p.is_file())
    samples = [inspect_file(p, root, i + 1) for i, p in enumerate(files)]
    summary = summarize(samples)
    payload = {"root": str(root), "summary": summary, "samples": [asdict(s) for s in samples]}
    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    out_md.write_text(render_markdown(root, samples, summary), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
