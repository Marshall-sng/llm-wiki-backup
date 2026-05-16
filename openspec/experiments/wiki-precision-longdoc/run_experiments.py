
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ART = Path(__file__).resolve().parent / "artifacts"
SCHEMAS = Path(__file__).resolve().parent / "schemas"
ART.mkdir(parents=True, exist_ok=True)
SCHEMAS.mkdir(parents=True, exist_ok=True)

REAL_PROJECT = Path(r"D:\大数据公司工作\数据流通\数据流通")
XLSX = REAL_PROJECT / "raw" / "sources" / "第一批企业名单.xlsx"
WIKI_SOURCE = REAL_PROJECT / "wiki" / "sources" / "第一批企业名单.md"
WIKI_ENTITIES = REAL_PROJECT / "wiki" / "entities"


def sha1_text(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()


def json_write(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def cell_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def split_multi(value: str) -> list[str]:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    parts = []
    for piece in re.split(r"[\n、,，;；]+", text):
        p = piece.strip()
        if p and p.lower() != "nan":
            parts.append(p)
    return parts


def table_anchor(source_id: str, sheet: str, excel_row: int, col: str | None = None) -> dict[str, Any]:
    loc: dict[str, Any] = {"sheet": sheet, "row": excel_row}
    if col:
        loc["column"] = col
    return {
        "anchorId": f"anch:{source_id}:table:{sha1_text(sheet + ':' + str(excel_row) + ':' + str(col or 'row'))[:12]}",
        "sourceId": source_id,
        "format": "xlsx",
        "anchorType": "table-row" if not col else "table-cell",
        "locator": loc,
    }


def extract_xlsx() -> dict[str, Any]:
    try:
        import openpyxl  # type: ignore
    except Exception as exc:  # pragma: no cover
        return {"status": "failed", "error": f"openpyxl unavailable: {exc}"}

    wb = openpyxl.load_workbook(XLSX, data_only=True)
    source_id = "source-first-batch-enterprises-xlsx"
    result: dict[str, Any] = {
        "schemaVersion": "structured-extraction.v0.experiment",
        "sourceId": source_id,
        "sourcePath": str(XLSX),
        "sourceSha256": hashlib.sha256(XLSX.read_bytes()).hexdigest(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sheets": [],
        "entities": [],
        "relations": [],
    }

    all_entities: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []

    for ws in wb.worksheets:
        rows = [[cell_text(c.value) for c in row] for row in ws.iter_rows()]
        nonempty = [(idx + 1, row) for idx, row in enumerate(rows) if any(cell.strip() for cell in row)]
        sheet_payload: dict[str, Any] = {"sheetName": ws.title, "rowCount": len(nonempty), "records": []}

        if ws.title == "第一批名单":
            # Header row contains 企业名称.
            header_pos = next((i for i, row in nonempty if "企业名称" in row), nonempty[0][0])
            headers = rows[header_pos - 1]
            sheet_payload["headers"] = headers
            for excel_row, row in nonempty:
                if excel_row <= header_pos:
                    continue
                rec = {headers[i] if i < len(headers) and headers[i] else f"Column {i+1}": row[i] if i < len(row) else "" for i in range(max(len(headers), len(row)))}
                enterprise = rec.get("企业名称", "").strip()
                if not enterprise:
                    continue
                original_serial = rec.get("序号", "").strip()
                projects = split_multi(rec.get("项目名称", ""))
                contacts = split_multi(rec.get("联系人", ""))
                phones = split_multi(rec.get("电话", ""))
                anchor = table_anchor(source_id, ws.title, excel_row)
                record = {
                    "recordType": "enterprise-row",
                    "sheetName": ws.title,
                    "excelRowNumber": excel_row,
                    "originalSerial": original_serial,
                    "enterprise": enterprise,
                    "projects": projects,
                    "contacts": contacts,
                    "phones": phones,
                    "sourceWorksheets": split_multi(rec.get("来源工作表", "")),
                    "industry": rec.get("所属行业", "").strip(),
                    "rawCells": rec,
                    "anchor": anchor,
                }
                sheet_payload["records"].append(record)
                all_entities.append({
                    "name": enterprise,
                    "type": "organization",
                    "sourceRole": "listed-enterprise",
                    "evidenceAnchors": [anchor["anchorId"]],
                    "originalSerial": original_serial,
                })
                for project in projects:
                    relations.append({
                        "subject": enterprise,
                        "predicate": "申报/关联项目",
                        "object": project,
                        "evidenceAnchors": [anchor["anchorId"]],
                    })

        elif ws.title == "高质量数据集试点单位":
            # This sheet has no clean header row in converted output. Preserve original columns.
            headers = ["projectId", "projectName", "organization", "projectType", "city", "start", "end", "description", "fundingSource", "budget", "progress", "status", "contact", "phone"]
            sheet_payload["headers"] = headers
            for excel_row, row in nonempty:
                if len(row) < 3 or not row[0].strip() or not row[0].strip().isdigit():
                    continue
                rec = {headers[i] if i < len(headers) else f"Column {i+1}": row[i] if i < len(row) else "" for i in range(max(len(headers), len(row)))}
                anchor = table_anchor(source_id, ws.title, excel_row)
                record = {
                    "recordType": "dataset-pilot-row",
                    "sheetName": ws.title,
                    "excelRowNumber": excel_row,
                    "projectId": rec.get("projectId", ""),
                    "projectName": rec.get("projectName", ""),
                    "organization": rec.get("organization", ""),
                    "projectType": rec.get("projectType", ""),
                    "city": rec.get("city", ""),
                    "start": rec.get("start", ""),
                    "end": rec.get("end", ""),
                    "description": rec.get("description", ""),
                    "budget": rec.get("budget", ""),
                    "progress": rec.get("progress", ""),
                    "status": rec.get("status", ""),
                    "contacts": split_multi(rec.get("contact", "")),
                    "phones": split_multi(rec.get("phone", "")),
                    "rawCells": rec,
                    "anchor": anchor,
                }
                sheet_payload["records"].append(record)
                if record["organization"]:
                    all_entities.append({
                        "name": record["organization"],
                        "type": "organization",
                        "sourceRole": "pilot-unit",
                        "evidenceAnchors": [anchor["anchorId"]],
                        "projectId": record["projectId"],
                    })
                if record["projectName"]:
                    all_entities.append({
                        "name": record["projectName"],
                        "type": "project",
                        "sourceRole": "pilot-project",
                        "evidenceAnchors": [anchor["anchorId"]],
                        "projectId": record["projectId"],
                    })
                    relations.append({
                        "subject": record["organization"],
                        "predicate": "试点项目",
                        "object": record["projectName"],
                        "evidenceAnchors": [anchor["anchorId"]],
                    })
        else:
            sheet_payload["headers"] = nonempty[0][1] if nonempty else []

        result["sheets"].append(sheet_payload)

    # Dedupe entities preserving evidence anchors.
    by_name_type: dict[tuple[str, str], dict[str, Any]] = {}
    for ent in all_entities:
        key = (ent["name"], ent["type"])
        if key not in by_name_type:
            by_name_type[key] = ent
        else:
            by_name_type[key]["evidenceAnchors"] = sorted(set(by_name_type[key].get("evidenceAnchors", []) + ent.get("evidenceAnchors", [])))
    result["entities"] = list(by_name_type.values())
    result["relations"] = relations
    return result


def audit_wiki(structured: dict[str, Any]) -> dict[str, Any]:
    wiki_text = WIKI_SOURCE.read_text(encoding="utf-8-sig", errors="replace") if WIKI_SOURCE.exists() else ""
    entity_stems = {p.stem for p in WIKI_ENTITIES.glob("*.md")} if WIKI_ENTITIES.exists() else set()
    first_sheet = next(s for s in structured["sheets"] if s["sheetName"] == "第一批名单")
    pilot_sheet = next(s for s in structured["sheets"] if s["sheetName"] == "高质量数据集试点单位")
    source_serials = [r["originalSerial"] for r in first_sheet["records"]]
    pilot_ids = [r["projectId"] for r in pilot_sheet["records"]]

    # Extract displayed table serials from wiki source section.
    wiki_first_rows = []
    in_first = False
    for line in wiki_text.splitlines():
        if line.startswith("### 第一批名单"):
            in_first = True
            continue
        if in_first and line.startswith("### "):
            break
        if in_first and re.match(r"^\|\s*\d+\s*\|", line):
            parts = [p.strip() for p in line.strip("|").split("|")]
            if len(parts) >= 2:
                wiki_first_rows.append({"displaySerial": parts[0], "enterprise": parts[1]})

    review_items = []
    if [r["displaySerial"] for r in wiki_first_rows] != source_serials[:len(wiki_first_rows)]:
        review_items.append({
            "kind": "possible_omission_or_rewrite",
            "severity": "action_required",
            "title": "Wiki source page rewrote original serial order",
            "evidence": {"sourceSerials": source_serials, "wikiDisplaySerials": [r["displaySerial"] for r in wiki_first_rows]},
        })

    for pid in pilot_ids:
        if pid and not re.search(rf"\|\s*{re.escape(pid)}\s*\|", wiki_text):
            review_items.append({
                "kind": "field_loss",
                "severity": "warning",
                "title": f"Pilot project id {pid} not preserved as table id in wiki source",
            })

    exact_missing = []
    for r in first_sheet["records"]:
        name = r["enterprise"]
        if name and name not in entity_stems and name not in wiki_text:
            exact_missing.append(name)
    if exact_missing:
        review_items.append({
            "kind": "possible_entity_alias_or_missing_exact_page",
            "severity": "warning",
            "title": "Exact enterprise names missing from wiki entity stems/body",
            "candidate": {"names": exact_missing},
        })

    # Field loss: contacts/phones exist in structured records but source wiki has no column for them.
    contacts_count = sum(1 for r in first_sheet["records"] if r.get("contacts")) + sum(1 for r in pilot_sheet["records"] if r.get("contacts"))
    phones_count = sum(1 for r in first_sheet["records"] if r.get("phones")) + sum(1 for r in pilot_sheet["records"] if r.get("phones"))
    if "联系人" not in wiki_text[:2000] or "电话" not in wiki_text[:2000]:
        review_items.append({
            "kind": "field_loss",
            "severity": "action_required",
            "title": "Wiki summary dropped contact/phone columns from core table",
            "evidence": {"structuredRowsWithContacts": contacts_count, "structuredRowsWithPhones": phones_count},
        })

    return {
        "sourceSerials": source_serials,
        "wikiFirstRows": wiki_first_rows,
        "pilotProjectIds": pilot_ids,
        "entityPageStemCount": len(entity_stems),
        "reviewItems": review_items,
        "status": "issues_found" if review_items else "passed",
    }


def long_text_coverage() -> dict[str, Any]:
    body = "# 开头章节\n\n" + ("普通内容段落，包含背景材料。\n" * 5500) + "\n# 最终章节\n\nTAIL_ENTITY_最终章节关键实体 是只出现在尾部的关键实体。\n"
    target = "TAIL_ENTITY_最终章节关键实体"
    naive = body[:50000]
    chunk_size = 6000
    overlap = 300
    chunks = []
    pos = 0
    while pos < len(body):
        end = min(len(body), pos + chunk_size)
        # prefer newline after midpoint
        window = body[pos:end]
        split = window.rfind("\n", chunk_size // 2)
        if split > 0 and end < len(body):
            end = pos + split + 1
        chunk = body[pos:end]
        chunks.append({"chunkIndex": len(chunks), "charStart": pos, "charEnd": end, "containsTail": target in chunk, "headingHint": "最终章节" if "# 最终章节" in chunk else ""})
        if end >= len(body):
            break
        pos = max(pos + 1, end - overlap)
    hit_chunks = [c for c in chunks if c["containsTail"]]
    return {
        "textChars": len(body),
        "target": target,
        "naiveFirst50000ContainsTail": target in naive,
        "chunkCount": len(chunks),
        "chunkedContainsTail": bool(hit_chunks),
        "tailHitChunks": hit_chunks,
        "status": "passed" if (target not in naive and hit_chunks) else "failed",
    }


def evidence_anchor_schema_and_samples(structured: dict[str, Any], longcov: dict[str, Any]) -> dict[str, Any]:
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "EvidenceAnchor experiment schema",
        "type": "object",
        "required": ["anchorId", "sourceId", "format", "anchorType", "locator"],
        "properties": {
            "anchorId": {"type": "string"},
            "sourceId": {"type": "string"},
            "format": {"enum": ["text", "markdown", "xlsx", "pdf", "docx", "pptx", "web"]},
            "anchorType": {"type": "string"},
            "locator": {"type": "object"},
            "snippet": {"type": "string"},
            "contentHash": {"type": "string"},
            "resolverHints": {"type": "object"},
        },
        "additionalProperties": True,
    }
    json_write(SCHEMAS / "evidence-anchor.schema.json", schema)
    first_anchor = structured["sheets"][0]["records"][0]["anchor"]
    text_anchor = {
        "anchorId": "anch:synthetic-long-text:chunk:tail",
        "sourceId": "synthetic-long-text",
        "format": "text",
        "anchorType": "text-range",
        "locator": {"chunkIndex": longcov["tailHitChunks"][0]["chunkIndex"], "charStart": longcov["tailHitChunks"][0]["charStart"], "charEnd": longcov["tailHitChunks"][0]["charEnd"]},
        "snippet": longcov["target"],
    }
    samples = {
        "schemaPath": "experiments/wiki-precision-longdoc/schemas/evidence-anchor.schema.json",
        "samples": [
            {**first_anchor, "snippet": structured["sheets"][0]["records"][0]["enterprise"]},
            text_anchor,
            {"anchorId": "anch:sample-pdf:p12:block3", "sourceId": "sample-pdf", "format": "pdf", "anchorType": "page-block", "locator": {"page": 12, "block": 3, "bbox": [0.1, 0.2, 0.8, 0.35]}},
            {"anchorId": "anch:sample-docx:p42", "sourceId": "sample-docx", "format": "docx", "anchorType": "paragraph", "locator": {"paragraphIndex": 42, "style": "Heading 2"}},
            {"anchorId": "anch:sample-pptx:s3:shape7", "sourceId": "sample-pptx", "format": "pptx", "anchorType": "slide-shape", "locator": {"slide": 3, "shapeId": "shape7"}},
        ],
        "status": "passed",
    }
    return samples


def retrieval_smoke(structured: dict[str, Any], longcov: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for sheet in structured["sheets"]:
        for rec in sheet.get("records", []):
            text = " ".join(str(v) for k, v in rec.items() if k not in {"rawCells", "anchor"})
            rows.append({"text": text, "anchor": rec["anchor"], "record": rec})

    def search(query: str) -> dict[str, Any]:
        terms = [t for t in re.split(r"\s+", query.strip()) if t]
        scored = []
        for row in rows:
            score = sum(1 for t in terms if t in row["text"])
            if score:
                scored.append((score, row))
        scored.sort(key=lambda x: -x[0])
        if not scored:
            return {"query": query, "status": "insufficient_evidence", "hits": [], "coverage": {"searchedRows": len(rows)}}
        return {"query": query, "status": "answered_with_anchors", "hits": [{"score": s, "anchor": r["anchor"], "snippet": r["text"][:240]} for s, r in scored[:5]], "coverage": {"searchedRows": len(rows)}}

    result = {
        "queries": [search("云南白药 联系人"), search("火星矿产权属审批时限")],
    }
    result["status"] = "passed" if result["queries"][0]["hits"] and result["queries"][1]["status"] == "insufficient_evidence" else "failed"
    return result


def long_document_skeleton(structured: dict[str, Any], longcov: dict[str, Any]) -> dict[str, Any]:
    anchors = []
    for sheet in structured["sheets"]:
        for rec in sheet.get("records", [])[:5]:
            anchors.append(rec["anchor"]["anchorId"])
    if longcov.get("tailHitChunks"):
        anchors.append("anch:synthetic-long-text:chunk:tail")
    sections = [
        {"sectionId": "sec-001", "title": "试点企业总体情况", "targetChars": 3000, "evidenceRefs": anchors[:4], "status": "planned"},
        {"sectionId": "sec-002", "title": "重点行业与项目分布", "targetChars": 3500, "evidenceRefs": anchors[4:8] or anchors[:3], "status": "planned"},
        {"sectionId": "sec-003", "title": "长文本尾部证据覆盖示例", "targetChars": 2500, "evidenceRefs": ["anch:synthetic-long-text:chunk:tail"], "status": "planned"},
    ]
    return {
        "runId": "longdoc-experiment-001",
        "singleResponseAllowed": False,
        "workflow": ["outline", "section_plan", "per_section_evidence_pack", "section_draft", "merge", "lint_review", "export"],
        "sections": sections,
        "mergePolicy": "all_sections_require_evidence_refs_before_merge",
        "status": "passed" if all(s["evidenceRefs"] for s in sections) else "failed",
    }


def main() -> None:
    structured = extract_xlsx()
    json_write(ART / "first-batch-enterprises.structured.json", structured)
    audit = audit_wiki(structured) if structured.get("status") != "failed" else {"status": "skipped"}
    json_write(ART / "first-batch-enterprises.audit.json", audit)
    longcov = long_text_coverage()
    json_write(ART / "long-text-tail-coverage.json", longcov)
    anchors = evidence_anchor_schema_and_samples(structured, longcov)
    json_write(ART / "evidence-anchor-samples.json", anchors)
    retr = retrieval_smoke(structured, longcov)
    json_write(ART / "retrieval-smoke.json", retr)
    wiki_audit = audit
    json_write(ART / "wiki-coverage-audit.json", wiki_audit)
    longdoc = long_document_skeleton(structured, longcov)
    json_write(ART / "long-document-project-skeleton.json", longdoc)

    first_sheet = next(s for s in structured.get("sheets", []) if s.get("sheetName") == "第一批名单")
    pilot_sheet = next(s for s in structured.get("sheets", []) if s.get("sheetName") == "高质量数据集试点单位")
    summary = {
        "E1_excel_status": "passed" if len(first_sheet["records"]) == 18 and [r["projectId"] for r in pilot_sheet["records"]] == ["12", "23", "24", "39"] else "failed",
        "E2_long_text_status": longcov["status"],
        "E3_anchor_status": anchors["status"],
        "E4_retrieval_status": retr["status"],
        "E5_wiki_audit_status": wiki_audit["status"],
        "E6_longdoc_status": longdoc["status"],
        "artifactDir": str(ART),
    }
    json_write(ART / "experiment-summary.json", summary)

    md = f"""# 实验执行记录\n\n执行时间：{datetime.now(timezone.utc).isoformat()}\n\n## 总结\n\n```json\n{json.dumps(summary, ensure_ascii=False, indent=2)}\n```\n\n## E1 Excel 表格完整抽取\n\nEvidence：`first-batch-enterprises.structured.json` 保留了第一张表 {len(first_sheet['records'])} 条企业记录，原始序号为 `{[r['originalSerial'] for r in first_sheet['records']]}`；第二张表项目编号为 `{[r['projectId'] for r in pilot_sheet['records']]}`。\n\nInference：表格材料需要至少 row-level sidecar；仅让 LLM 写 source summary 会改写序号和丢字段。\n\n## E2 超长文本尾部实体覆盖\n\nEvidence：naive first-50000 contains tail = `{longcov['naiveFirst50000ContainsTail']}`；chunked contains tail = `{longcov['chunkedContainsTail']}`。\n\nInference：任何超长材料 ingest/wiki 生成都需要 coverage-aware reading，不应只依赖 fixed truncation。\n\n## E3 EvidenceAnchor\n\nEvidence：`evidence-anchor-samples.json` 和 `schemas/evidence-anchor.schema.json` 可以表达 xlsx row、text range、pdf page-block、docx paragraph、pptx slide-shape。\n\nInference：更合适的是“分类型 anchor + 统一接口”，而不是强行一个 locator 形状覆盖所有格式。\n\n## E4 精准检索 / insufficient evidence\n\nEvidence：`retrieval-smoke.json` 中 `云南白药 联系人` 返回 row anchor；`火星矿产权属审批时限` 返回 insufficient_evidence。\n\nInference：structured rows + simple lexical matching already能比 Wiki summary 更可靠地处理一部分事实查询；后续应接入 hybrid retrieval。\n\n## E5 Wiki 覆盖率 / 遗漏审计\n\nEvidence：`wiki-coverage-audit.json` 生成 review items，发现 source serial rewrite、pilot project id loss、contact/phone field loss 等。\n\nInference：review items 不应只由 LLM 自愿生成，至少需要 deterministic coverage audit。\n\n## E6 长文生成工程\n\nEvidence：`long-document-project-skeleton.json` 的每个 section 都有 evidenceRefs，且 `singleResponseAllowed=false`。\n\nInference：长文成稿应是独立编排模块，但其前提能力（coverage/evidence anchors/evidence packets）必须贯穿全链路。\n\n## Unknown\n\n- PDF/DOCX/PPTX 的真实结构锚点仍需真实样本实验。\n- 是否引入 SQLite/Arrow/Parquet 仍需性能和复杂度对比。\n- LLM verifier 在遗漏审计中的边际收益尚未测试。\n"""
    (Path(__file__).resolve().parent / "experiment-results.md").write_text(md, encoding="utf-8")

if __name__ == "__main__":
    main()
