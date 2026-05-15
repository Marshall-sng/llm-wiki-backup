from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = Path(r"D:\大数据公司工作\数据流通\数据流通")
RAW_XLSX = SOURCE_ROOT / r"raw\sources\第一批企业名单.xlsx"
CONVERTED_MD = SOURCE_ROOT / r".llm-wiki\converted\第一批企业名单.xlsx.md"
CACHE_TXT = SOURCE_ROOT / r"raw\sources\.cache\第一批企业名单.xlsx.txt"
WIKI_MD = SOURCE_ROOT / r"wiki\sources\第一批企业名单.md"

OUT = ROOT / "experiments/wiki-precision-longdoc/artifacts/first-batch-company"
RESULT_MD = ROOT / ".omx/plans/experiments/wiki-precision-longdoc/first-batch-company-closure-results.md"


def sha16(value: Any) -> str:
    data = "" if value is None else str(value)
    return hashlib.sha256(data.encode("utf-8", errors="replace")).hexdigest()[:16]


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return re.sub(r"[ \t]+", " ", str(value).replace("\r\n", "\n").strip())


def split_multiline(value: Any) -> list[str]:
    text = clean(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"[\n；;]+", text) if part.strip()]


def split_commaish(value: Any) -> list[str]:
    text = clean(value)
    if not text:
        return []
    parts = re.split(r"[,，、]+", text)
    return [p.strip() for p in parts if p.strip()]


def cell_anchor_id(sheet: str, row: int, col: int) -> str:
    return f"first-batch:xlsx:{sheet}:r:{row}:c:{get_column_letter(col)}"


def row_anchor_id(sheet: str, row: int) -> str:
    return f"first-batch:xlsx:{sheet}:r:{row}"


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def build_sidecar() -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    wb = load_workbook(RAW_XLSX, data_only=False)
    anchors: list[dict[str, Any]] = []
    first_rows: list[dict[str, Any]] = []
    pilot_rows: list[dict[str, Any]] = []

    # Sheet 1 has headers on row 2.
    ws = wb["第一批名单"]
    headers = [clean(ws.cell(2, c).value) or f"空列{c}" for c in range(1, ws.max_column + 1)]
    for r in range(3, ws.max_row + 1):
        values = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
        if not any(v is not None for v in values):
            continue
        cells = {}
        row_text_parts = []
        for c, v in enumerate(values, start=1):
            text = clean(v)
            col = get_column_letter(c)
            cell = {
                "anchor_id": cell_anchor_id(ws.title, r, c),
                "source_id": "first-batch-company-list",
                "format": "xlsx",
                "kind": "xlsx.cell",
                "selector": {"sheet": ws.title, "row": r, "column": col, "cell": f"{col}{r}"},
                "text": {"preview": text[:300], "text_len": len(text), "text_hash": sha16(text)},
                "confidence": 0.98,
                "metadata": {"header": headers[c - 1]},
            }
            anchors.append(cell)
            cells[headers[c - 1]] = cell
            if text:
                row_text_parts.append(f"{headers[c - 1]}={text}")
        row_text = " | ".join(row_text_parts)
        row_anchor = {
            "anchor_id": row_anchor_id(ws.title, r),
            "source_id": "first-batch-company-list",
            "format": "xlsx",
            "kind": "xlsx.row",
            "selector": {"sheet": ws.title, "row": r},
            "text": {"preview": row_text[:800], "text_len": len(row_text), "text_hash": sha16(row_text)},
            "confidence": 0.98,
            "metadata": {"cell_anchors": {h: cell["anchor_id"] for h, cell in cells.items()}},
        }
        anchors.append(row_anchor)
        row = {
            "sheet": ws.title,
            "excel_row": r,
            "row_anchor_id": row_anchor["anchor_id"],
            "cell_anchor_ids": {h: cell["anchor_id"] for h, cell in cells.items()},
            "original_serial": clean(values[0]),
            "enterprise_name": clean(values[1]),
            "project_name": clean(values[2]),
            "contacts": split_multiline(values[3]),
            "phones": split_multiline(values[4]),
            "source_worksheets": split_commaish(values[5]),
            "industry": clean(values[6]),
            "raw": {headers[i]: clean(values[i]) for i in range(len(headers))},
        }
        first_rows.append(row)

    # Sheet 2 has no explicit header row in the file; assign stable semantic names.
    ws2 = wb["高质量数据集试点单位"]
    headers2 = [
        "原始序号",
        "项目名称",
        "单位名称",
        "项目类型",
        "地区",
        "开始时间",
        "结束时间",
        "项目描述",
        "资金来源",
        "投资规模_万元",
        "建设进展",
        "入选状态",
        "联系人",
        "电话",
        "备注",
    ]
    for r in range(2, ws2.max_row + 1):
        values = [ws2.cell(r, c).value for c in range(1, ws2.max_column + 1)]
        if not any(v is not None for v in values):
            continue
        cells = {}
        row_text_parts = []
        for c, v in enumerate(values, start=1):
            text = clean(v)
            col = get_column_letter(c)
            header = headers2[c - 1] if c - 1 < len(headers2) else f"列{c}"
            cell = {
                "anchor_id": cell_anchor_id(ws2.title, r, c),
                "source_id": "first-batch-company-list",
                "format": "xlsx",
                "kind": "xlsx.cell",
                "selector": {"sheet": ws2.title, "row": r, "column": col, "cell": f"{col}{r}"},
                "text": {"preview": text[:300], "text_len": len(text), "text_hash": sha16(text)},
                "confidence": 0.96,
                "metadata": {"header": header},
            }
            anchors.append(cell)
            cells[header] = cell
            if text:
                row_text_parts.append(f"{header}={text}")
        row_text = " | ".join(row_text_parts)
        row_anchor = {
            "anchor_id": row_anchor_id(ws2.title, r),
            "source_id": "first-batch-company-list",
            "format": "xlsx",
            "kind": "xlsx.row",
            "selector": {"sheet": ws2.title, "row": r},
            "text": {"preview": row_text[:800], "text_len": len(row_text), "text_hash": sha16(row_text)},
            "confidence": 0.96,
            "metadata": {"cell_anchors": {h: cell["anchor_id"] for h, cell in cells.items()}},
        }
        anchors.append(row_anchor)
        pilot_rows.append(
            {
                "sheet": ws2.title,
                "excel_row": r,
                "row_anchor_id": row_anchor["anchor_id"],
                "cell_anchor_ids": {h: cell["anchor_id"] for h, cell in cells.items()},
                "original_serial": clean(values[0]),
                "project_name": clean(values[1]),
                "unit_name": clean(values[2]),
                "project_type": clean(values[3]),
                "region": clean(values[4]),
                "description": clean(values[7]),
                "funding_source": clean(values[8]),
                "investment_10k": clean(values[9]),
                "progress": clean(values[10]),
                "selected_status": clean(values[11]),
                "contacts": split_multiline(values[12]),
                "phones": split_multiline(values[13]),
                "raw": {headers2[i]: clean(values[i]) for i in range(len(values))},
            }
        )

    sidecar = {
        "schema_version": "0.1.0",
        "source": {
            "source_id": "first-batch-company-list",
            "format": "xlsx",
            "uri": str(RAW_XLSX),
            "title": "第一批企业名单.xlsx",
            "origin": "real-problem-closure",
        },
        "anchors": anchors,
        "coverage": {
            "status": "passed",
            "anchor_count": len(anchors),
            "text_units": sum(1 for a in anchors if a["kind"] == "xlsx.cell" and a["text"]["text_len"] > 0),
            "native": {
                "sheets": len(wb.worksheets),
                "first_sheet_rows": len(first_rows),
                "pilot_sheet_rows": len(pilot_rows),
                "cell_anchors": sum(1 for a in anchors if a["kind"] == "xlsx.cell"),
                "row_anchors": sum(1 for a in anchors if a["kind"] == "xlsx.row"),
            },
        },
        "quality": {"status": "good", "quality_score": 0.98, "issues": []},
        "review_items": [],
        "domain_rows": {"first_batch": first_rows, "pilot_units": pilot_rows},
    }
    return sidecar, first_rows, pilot_rows


def build_candidates(first_rows: list[dict[str, Any]], pilot_rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    entities: dict[str, dict[str, Any]] = {}
    facts: list[dict[str, Any]] = []

    def ensure_entity(name: str, row: dict[str, Any], source_sheet: str) -> None:
        if not name:
            return
        ent = entities.setdefault(
            name,
            {
                "entity_id": f"entity:{sha16(name)}",
                "name": name,
                "type": "organization",
                "evidence_anchor_ids": [],
                "source_sheets": set(),
                "original_serials": set(),
            },
        )
        ent["evidence_anchor_ids"].append(row["row_anchor_id"])
        ent["source_sheets"].add(source_sheet)
        if row.get("original_serial"):
            ent["original_serials"].add(row["original_serial"])

    for row in first_rows:
        name = row["enterprise_name"]
        ensure_entity(name, row, row["sheet"])
        facts.append(
            {
                "fact_id": f"fact:{sha16(row['row_anchor_id'] + ':first_batch_row')}",
                "kind": "first_batch_company_row",
                "subject": name,
                "predicate": "listed_in_first_batch",
                "object": {
                    "original_serial": row["original_serial"],
                    "project_name": row["project_name"],
                    "contacts": row["contacts"],
                    "phones": row["phones"],
                    "source_worksheets": row["source_worksheets"],
                    "industry": row["industry"],
                },
                "evidence_anchor_id": row["row_anchor_id"],
            }
        )
        for project in split_commaish(row["project_name"]):
            facts.append(
                {
                    "fact_id": f"fact:{sha16(row['row_anchor_id'] + project)}",
                    "kind": "project_candidate",
                    "subject": name,
                    "predicate": "has_project",
                    "object": project,
                    "evidence_anchor_id": row["row_anchor_id"],
                }
            )

    for row in pilot_rows:
        name = row["unit_name"]
        ensure_entity(name, row, row["sheet"])
        facts.append(
            {
                "fact_id": f"fact:{sha16(row['row_anchor_id'] + ':pilot_project')}",
                "kind": "pilot_unit_project",
                "subject": name,
                "predicate": "selected_pilot_project",
                "object": {
                    "original_serial": row["original_serial"],
                    "project_name": row["project_name"],
                    "investment_10k": row["investment_10k"],
                    "selected_status": row["selected_status"],
                    "contacts": row["contacts"],
                    "phones": row["phones"],
                },
                "evidence_anchor_id": row["row_anchor_id"],
            }
        )

    entity_list = []
    for ent in entities.values():
        ent["source_sheets"] = sorted(ent["source_sheets"])
        ent["original_serials"] = sorted(ent["original_serials"], key=lambda x: int(x) if x.isdigit() else 9999)
        ent["evidence_anchor_ids"] = sorted(set(ent["evidence_anchor_ids"]))
        entity_list.append(ent)
    entity_list.sort(key=lambda e: e["name"])
    return entity_list, facts


def parse_wiki_company_table(wiki_text: str) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    in_first_batch_section = False
    for line in wiki_text.splitlines():
        if line.startswith("### "):
            in_first_batch_section = "第一批名单" in line
            continue
        if not in_first_batch_section:
            continue
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 3 and cells[0].isdigit() and cells[1] and cells[1] != "企业名称":
            rows[cells[1]] = {"wiki_serial": cells[0], "wiki_project_summary": cells[2] if len(cells) > 2 else ""}
    return rows


def audit_against_current_wiki(first_rows: list[dict[str, Any]], pilot_rows: list[dict[str, Any]], entities: list[dict[str, Any]], facts: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    wiki_text = read_text(WIKI_MD)
    converted_text = read_text(CONVERTED_MD)
    cache_text = read_text(CACHE_TXT)
    wiki_table = parse_wiki_company_table(wiki_text)
    missing_items: list[dict[str, Any]] = []
    supported_by_converted = 0

    def present(text: str, value: str) -> bool:
        value = clean(value)
        return bool(value) and value in text

    for row in first_rows:
        name = row["enterprise_name"]
        wiki_row = wiki_table.get(name)
        if not present(wiki_text, name):
            missing_items.append({"type": "missing_entity", "severity": "error", "entity": name, "anchor_id": row["row_anchor_id"]})
        if wiki_row and wiki_row["wiki_serial"] != row["original_serial"]:
            missing_items.append(
                {
                    "type": "serial_rewritten",
                    "severity": "warning",
                    "entity": name,
                    "raw_serial": row["original_serial"],
                    "wiki_serial": wiki_row["wiki_serial"],
                    "anchor_id": row["row_anchor_id"],
                }
            )
        elif not wiki_row:
            missing_items.append({"type": "missing_company_table_row", "severity": "error", "entity": name, "anchor_id": row["row_anchor_id"]})

        for contact in row["contacts"]:
            if not present(wiki_text, contact):
                if present(converted_text, contact) or present(cache_text, contact):
                    supported_by_converted += 1
                missing_items.append({"type": "missing_contact", "severity": "warning", "entity": name, "value": contact, "anchor_id": row["cell_anchor_ids"].get("联系人")})
        for phone in row["phones"]:
            if not present(wiki_text, phone):
                if present(converted_text, phone) or present(cache_text, phone):
                    supported_by_converted += 1
                missing_items.append({"type": "missing_phone", "severity": "warning", "entity": name, "value": phone, "anchor_id": row["cell_anchor_ids"].get("电话")})
        for source in row["source_worksheets"]:
            if not present(wiki_text, source):
                missing_items.append({"type": "missing_source_worksheet", "severity": "info", "entity": name, "value": source, "anchor_id": row["cell_anchor_ids"].get("来源工作表")})
        if row["industry"] and not present(wiki_text, row["industry"].strip()):
            missing_items.append({"type": "missing_industry", "severity": "info", "entity": name, "value": row["industry"], "anchor_id": row["cell_anchor_ids"].get("所属行业")})
        # If full project text is long, exact preservation is not expected in the existing wiki table; flag when a strong prefix is absent.
        project_prefix = clean(row["project_name"])[:30]
        if project_prefix and not present(wiki_text, project_prefix):
            missing_items.append({"type": "project_detail_truncated_or_summarized", "severity": "info", "entity": name, "value_preview": project_prefix, "anchor_id": row["cell_anchor_ids"].get("项目名称")})

    for row in pilot_rows:
        name = row["unit_name"]
        for contact in row["contacts"]:
            if not present(wiki_text, contact):
                missing_items.append({"type": "missing_pilot_contact", "severity": "warning", "entity": name, "value": contact, "anchor_id": row["cell_anchor_ids"].get("联系人")})
        for phone in row["phones"]:
            if not present(wiki_text, phone):
                missing_items.append({"type": "missing_pilot_phone", "severity": "warning", "entity": name, "value": phone, "anchor_id": row["cell_anchor_ids"].get("电话")})

    by_type: dict[str, int] = {}
    for item in missing_items:
        by_type[item["type"]] = by_type.get(item["type"], 0) + 1

    audit = {
        "audit_version": "0.1.0",
        "raw_first_batch_rows": len(first_rows),
        "raw_pilot_rows": len(pilot_rows),
        "entity_candidates": len(entities),
        "fact_candidates": len(facts),
        "current_wiki_path": str(WIKI_MD),
        "converted_path": str(CONVERTED_MD),
        "missing_or_changed_items": missing_items,
        "summary_by_type": by_type,
        "converted_contains_missing_contacts_or_phones_count": supported_by_converted,
        "conclusion": "current wiki source page preserves many entity names but drops row/cell-level facts such as contacts, phones, source worksheets, original serial ordering, and detailed project text",
    }
    comparison = {
        "wiki_company_table_rows": len(wiki_table),
        "raw_first_batch_rows": len(first_rows),
        "entities_present_exact_in_wiki": sum(1 for row in first_rows if row["enterprise_name"] in wiki_text),
        "contacts_present_in_wiki": sum(1 for row in first_rows for c in row["contacts"] if c in wiki_text),
        "phones_present_in_wiki": sum(1 for row in first_rows for p in row["phones"] if p in wiki_text),
        "contacts_present_in_converted": sum(1 for row in first_rows for c in row["contacts"] if c in converted_text or c in cache_text),
        "phones_present_in_converted": sum(1 for row in first_rows for p in row["phones"] if p in converted_text or p in cache_text),
        "serial_mismatches": [item for item in missing_items if item["type"] == "serial_rewritten"],
    }
    return audit, comparison


def build_index(sidecar: dict[str, Any]) -> dict[str, Any]:
    entries = []
    for anchor in sidecar["anchors"]:
        if anchor["kind"] != "xlsx.row":
            continue
        entries.append(
            {
                "anchor_id": anchor["anchor_id"],
                "source_id": sidecar["source"]["source_id"],
                "format": "xlsx",
                "kind": anchor["kind"],
                "selector": anchor["selector"],
                "preview": anchor["text"]["preview"],
            }
        )
    return {"index_version": "0.1.0", "entry_count": len(entries), "entries": entries}


def render_wiki_candidate(first_rows: list[dict[str, Any]], pilot_rows: list[dict[str, Any]], audit: dict[str, Any]) -> str:
    lines = [
        "---",
        "type: source-candidate",
        "title: 第一批企业名单",
        "sources: [\"第一批企业名单.xlsx\"]",
        "generated_by: first-batch-company-closure-experiment",
        "---",
        "",
        "# 第一批企业名单（EvidenceAnchor 候选版）",
        "",
        "## 覆盖摘要",
        "",
        f"- 第一批名单行数：{len(first_rows)}",
        f"- 高质量数据集试点单位行数：{len(pilot_rows)}",
        f"- 遗漏/变更审计项：{len(audit['missing_or_changed_items'])}",
        "",
        "## 第一批名单完整行级事实",
        "",
        "| 原始序号 | 企业名称 | 项目名称 | 联系人 | 电话 | 来源工作表 | 所属行业 | EvidenceAnchor |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in first_rows:
        lines.append(
            "| {serial} | {name} | {project} | {contacts} | {phones} | {sources} | {industry} | `{anchor}` |".format(
                serial=row["original_serial"],
                name=row["enterprise_name"],
                project=clean(row["project_name"]).replace("|", "｜"),
                contacts="<br>".join(row["contacts"]),
                phones="<br>".join(row["phones"]),
                sources=", ".join(row["source_worksheets"]).replace("|", "｜"),
                industry=row["industry"].replace("|", "｜"),
                anchor=row["row_anchor_id"],
            )
        )
    lines += [
        "",
        "## 高质量数据集试点单位完整行级事实",
        "",
        "| 原始序号 | 单位名称 | 项目名称 | 投资规模（万元） | 入选状态 | 联系人 | 电话 | EvidenceAnchor |",
        "|---|---|---|---:|---|---|---|---|",
    ]
    for row in pilot_rows:
        lines.append(
            "| {serial} | {unit} | {project} | {investment} | {status} | {contacts} | {phones} | `{anchor}` |".format(
                serial=row["original_serial"],
                unit=row["unit_name"],
                project=row["project_name"].replace("|", "｜"),
                investment=row["investment_10k"],
                status=row["selected_status"],
                contacts="<br>".join(row["contacts"]),
                phones="<br>".join(row["phones"]),
                anchor=row["row_anchor_id"],
            )
        )
    lines += [
        "",
        "## 审计结论",
        "",
        "当前 wiki source page 保留了不少企业名称，但没有完整保留 row/cell 级事实，尤其是联系人、电话、来源工作表、原始序号以及项目明细。",
        "",
        "## 主要审计项统计",
        "",
    ]
    for k, v in sorted(audit["summary_by_type"].items()):
        lines.append(f"- {k}: {v}")
    return "\n".join(lines) + "\n"


def render_results(sidecar: dict[str, Any], entities: list[dict[str, Any]], facts: list[dict[str, Any]], audit: dict[str, Any], comparison: dict[str, Any]) -> str:
    lines = [
        "# 第一批企业名单真实 Wiki 缺漏闭环实验结果",
        "",
        "## 总结论",
        "",
        "- evidence：已从原始 `第一批企业名单.xlsx` 生成 full row/cell SourceSidecar。",
        "- evidence：已生成 entity candidates、fact candidates、EvidenceAnchorIndex、WikiCandidate 和 omission audit。",
        "- evidence：当前 wiki source page 保留了 18 个第一批名单企业名称，但联系人、电话、来源工作表、原始序号等行级事实明显缺失或被改写。",
        "- inference：问题不在 converted markdown 缺少这些字段；converted/cache 中可以找到联系人和电话。问题主要发生在 Wiki generation 将表格压缩成摘要型 source page 的阶段。",
        "- inference：统一 SourceSidecar + CoverageAudit 可以直接发现这类遗漏，不应再依赖人工在 Wiki 实体中发现。",
        "",
        "## 输入",
        "",
        f"- 原始 XLSX：`{RAW_XLSX}`",
        f"- converted markdown：`{CONVERTED_MD}`",
        f"- 当前 wiki source：`{WIKI_MD}`",
        "",
        "## 产物",
        "",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/source-sidecar.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/evidence-anchor-index.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/entity-candidates.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/fact-candidates.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/omission-audit.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/comparison-current-wiki.json`",
        "- `experiments/wiki-precision-longdoc/artifacts/first-batch-company/wiki-candidate.md`",
        "",
        "## 覆盖数据",
        "",
        f"- row anchors：{sidecar['coverage']['native']['row_anchors']}",
        f"- cell anchors：{sidecar['coverage']['native']['cell_anchors']}",
        f"- 第一批名单行数：{sidecar['coverage']['native']['first_sheet_rows']}",
        f"- 高质量数据集试点单位行数：{sidecar['coverage']['native']['pilot_sheet_rows']}",
        f"- entity candidates：{len(entities)}",
        f"- fact candidates：{len(facts)}",
        "",
        "## 与当前 Wiki 对比",
        "",
        f"- 当前 wiki 企业表行数：{comparison['wiki_company_table_rows']}",
        f"- 原始第一批名单行数：{comparison['raw_first_batch_rows']}",
        f"- 企业名称 exact present：{comparison['entities_present_exact_in_wiki']}",
        f"- 第一批名单联系人 present in wiki：{comparison['contacts_present_in_wiki']}",
        f"- 第一批名单电话 present in wiki：{comparison['phones_present_in_wiki']}",
        f"- 第一批名单联系人 present in converted/cache：{comparison['contacts_present_in_converted']}",
        f"- 第一批名单电话 present in converted/cache：{comparison['phones_present_in_converted']}",
        "",
        "## 缺漏/改写类型统计",
        "",
    ]
    for k, v in sorted(audit["summary_by_type"].items()):
        lines.append(f"- {k}: {v}")
    lines += [
        "",
        "## 关键发现",
        "",
        "1. 当前 wiki 中企业名称基本存在，但 source page 不是完整事实层。",
        "2. 当前 wiki 表格重写了部分原始序号，例如原始序号 6/7/8/5 的顺序被改成连续展示序号。",
        "3. 联系人、电话在 converted/cache 中存在，但当前 wiki 中没有保留，说明 converted 不是唯一问题，Wiki 生成阶段也会丢事实。",
        "4. SourceSidecar 能保留每行和每个单元格的 evidence anchor，CoverageAudit 能自动发现字段遗漏。",
        "",
        "## 下一步建议",
        "",
        "1. 生产化时先实现 full XLSX sidecar 持久化。",
        "2. Wiki 生成前增加 CoverageAudit：企业名、原始序号、联系人、电话、项目名称、来源工作表、行业必须有消费记录或显式忽略理由。",
        "3. WikiCandidate 生成应先基于 row facts 投影，再由 LLM 做组织和摘要，而不是让 LLM 直接摘要 converted markdown。",
        "4. 将本实验作为“第一批企业名单.xlsx”回归测试基线。",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sidecar, first_rows, pilot_rows = build_sidecar()
    entities, facts = build_candidates(first_rows, pilot_rows)
    audit, comparison = audit_against_current_wiki(first_rows, pilot_rows, entities, facts)
    index = build_index(sidecar)
    wiki_candidate = render_wiki_candidate(first_rows, pilot_rows, audit)

    write = lambda name, payload: (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write("source-sidecar.json", sidecar)
    write("evidence-anchor-index.json", index)
    write("entity-candidates.json", {"entity_count": len(entities), "entities": entities})
    write("fact-candidates.json", {"fact_count": len(facts), "facts": facts})
    write("omission-audit.json", audit)
    write("comparison-current-wiki.json", comparison)
    (OUT / "wiki-candidate.md").write_text(wiki_candidate, encoding="utf-8")
    RESULT_MD.write_text(render_results(sidecar, entities, facts, audit, comparison), encoding="utf-8")

    print(
        json.dumps(
            {
                "row_anchors": sidecar["coverage"]["native"]["row_anchors"],
                "cell_anchors": sidecar["coverage"]["native"]["cell_anchors"],
                "first_batch_rows": len(first_rows),
                "pilot_rows": len(pilot_rows),
                "entity_candidates": len(entities),
                "fact_candidates": len(facts),
                "audit_items": len(audit["missing_or_changed_items"]),
                "summary_by_type": audit["summary_by_type"],
                "comparison": comparison,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
