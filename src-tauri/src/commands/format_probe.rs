use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use std::path::Path;

#[derive(Clone, Debug)]
struct ParagraphRecord {
    index: usize,
    text: String,
    style_id: Option<String>,
    numbering_id: Option<String>,
    numbering_level: Option<String>,
    run_count: usize,
    has_bold: bool,
    has_italic: bool,
    has_underline: bool,
    font_sizes_half_points: Vec<String>,
    fonts: Vec<String>,
}

#[derive(Clone, Debug)]
struct StyleRecord {
    style_id: String,
    style_type: Option<String>,
    name: Option<String>,
    based_on: Option<String>,
    next: Option<String>,
    outline_level: Option<String>,
    fonts: Vec<String>,
    font_sizes_half_points: Vec<String>,
    spacing: Option<Value>,
    has_bold: bool,
    has_italic: bool,
}

#[tauri::command]
pub async fn probe_format_profile(path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || probe_format_profile_sync(&path))
        .await
        .map_err(|e| format!("probe_format_profile blocking task join error: {e}"))?
}

fn probe_format_profile_sync(path: &str) -> Result<Value, String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mut file = File::open(path).map_err(|e| format!("Failed to open '{}': {}", path, e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read '{}': {}", path, e))?;

    match ext.as_str() {
        "docx" | "xlsx" | "pptx" => probe_office(&buffer, &ext),
        "pdf" => Ok(probe_pdf(&buffer)),
        _ => Err(format!("Unsupported format for profile probing: {ext}")),
    }
}

fn probe_office(buffer: &[u8], format: &str) -> Result<Value, String> {
    let cursor = std::io::Cursor::new(buffer);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to read ZIP archive for {format}: {e}"))?;
    let names = zip_names(&mut archive);
    match format {
        "docx" => probe_docx(&mut archive, &names),
        "xlsx" => probe_xlsx(&mut archive, &names),
        "pptx" => probe_pptx(&mut archive, &names),
        _ => Err(format!("Unsupported Office format: {format}")),
    }
}

fn zip_names<R: std::io::Read + std::io::Seek>(archive: &mut zip::ZipArchive<R>) -> Vec<String> {
    let mut names = Vec::new();
    for index in 0..archive.len() {
        if let Ok(file) = archive.by_index(index) {
            names.push(file.name().to_string());
        }
    }
    names
}

fn read_zip_text<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
) -> Option<String> {
    let mut file = archive.by_name(name).ok()?;
    let mut text = String::new();
    file.read_to_string(&mut text).ok()?;
    Some(text)
}

fn count_substring(text: &str, pattern: &str) -> usize {
    text.matches(pattern).count()
}

fn count_tag(text: &str, tag_prefix: &str) -> usize {
    count_substring(text, &format!("<{tag_prefix} ")) + count_substring(text, &format!("<{tag_prefix}>"))
}

fn decode_xml_entities(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

fn strip_xml_tags(value: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => {
                in_tag = true;
                out.push(' ');
            }
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    normalize_ws(&decode_xml_entities(&out))
}

fn normalize_ws(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn get_attr(fragment: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=\"");
    let start = fragment.find(&needle)? + needle.len();
    let rest = &fragment[start..];
    let end = rest.find('"')?;
    Some(decode_xml_entities(&rest[..end]))
}

fn collect_attr_values(fragment: &str, names: &[&str], limit: usize) -> Vec<String> {
    let mut values = Vec::new();
    let mut seen = HashSet::new();
    for name in names {
        let needle = format!("{name}=\"");
        let mut cursor = 0;
        while let Some(relative) = fragment[cursor..].find(&needle) {
            let start = cursor + relative + needle.len();
            let rest = &fragment[start..];
            let Some(end) = rest.find('"') else { break };
            let value = decode_xml_entities(&rest[..end]);
            if !value.is_empty() && seen.insert(value.clone()) {
                values.push(value);
                if values.len() >= limit {
                    return values;
                }
            }
            cursor = start + end + 1;
        }
    }
    values
}

fn extract_tag_blocks(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut blocks = Vec::new();
    let mut cursor = 0;
    while let Some(relative_start) = xml[cursor..].find(&open) {
        let start = cursor + relative_start;
        let Some(relative_end) = xml[start..].find(&close) else { break };
        let end = start + relative_end + close.len();
        blocks.push(xml[start..end].to_string());
        cursor = end;
    }
    blocks
}

fn extract_tag_snippets(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{tag}");
    let mut snippets = Vec::new();
    let mut cursor = 0;
    while let Some(relative_start) = xml[cursor..].find(&open) {
        let start = cursor + relative_start;
        let Some(relative_end) = xml[start..].find('>') else { break };
        let end = start + relative_end + 1;
        snippets.push(xml[start..end].to_string());
        cursor = end;
    }
    snippets
}

fn extract_text_tag_values(xml: &str, tag: &str, limit: usize) -> Vec<String> {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut values = Vec::new();
    let mut cursor = 0;
    while values.len() < limit {
        let Some(relative_start) = xml[cursor..].find(&open) else { break };
        let start = cursor + relative_start;
        let Some(gt_relative) = xml[start..].find('>') else { break };
        let content_start = start + gt_relative + 1;
        let Some(close_relative) = xml[content_start..].find(&close) else { break };
        let content_end = content_start + close_relative;
        let value = strip_xml_tags(&xml[content_start..content_end]);
        if !value.is_empty() {
            values.push(value);
        }
        cursor = content_end + close.len();
    }
    values
}

fn extract_docx_paragraph_text(paragraph_xml: &str) -> String {
    extract_text_tag_values(paragraph_xml, "w:t", usize::MAX).join("")
}

fn extract_docx_paragraphs(document_xml: &str) -> Vec<ParagraphRecord> {
    extract_tag_blocks(document_xml, "w:p")
        .into_iter()
        .enumerate()
        .map(|(index, paragraph_xml)| ParagraphRecord {
            index: index + 1,
            text: normalize_ws(&extract_docx_paragraph_text(&paragraph_xml)),
            style_id: find_tag_attr(&paragraph_xml, "w:pStyle", "w:val"),
            numbering_id: find_tag_attr(&paragraph_xml, "w:numId", "w:val"),
            numbering_level: find_tag_attr(&paragraph_xml, "w:ilvl", "w:val"),
            run_count: count_tag(&paragraph_xml, "w:r"),
            has_bold: paragraph_xml.contains("<w:b") || paragraph_xml.contains("<w:bCs"),
            has_italic: paragraph_xml.contains("<w:i") || paragraph_xml.contains("<w:iCs"),
            has_underline: paragraph_xml.contains("<w:u"),
            font_sizes_half_points: collect_tag_attr_values(&paragraph_xml, "w:sz", "w:val", 24),
            fonts: collect_attr_values(
                &paragraph_xml,
                &["w:ascii", "w:hAnsi", "w:eastAsia", "ascii", "hAnsi", "eastAsia"],
                24,
            ),
        })
        .collect()
}

fn find_tag_attr(xml: &str, tag: &str, attr: &str) -> Option<String> {
    extract_tag_snippets(xml, tag)
        .into_iter()
        .find_map(|snippet| get_attr(&snippet, attr))
}

fn collect_tag_attr_values(xml: &str, tag: &str, attr: &str, limit: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for snippet in extract_tag_snippets(xml, tag) {
        if let Some(value) = get_attr(&snippet, attr) {
            if !value.is_empty() && seen.insert(value.clone()) {
                out.push(value);
                if out.len() >= limit {
                    break;
                }
            }
        }
    }
    out
}

fn parse_docx_styles(styles_xml: &str) -> Vec<StyleRecord> {
    extract_tag_blocks(styles_xml, "w:style")
        .into_iter()
        .filter_map(|style_xml| {
            let header = extract_tag_snippets(&style_xml, "w:style").into_iter().next()?;
            let style_id = get_attr(&header, "w:styleId")?;
            Some(StyleRecord {
                style_id: style_id.clone(),
                style_type: get_attr(&header, "w:type"),
                name: find_tag_attr(&style_xml, "w:name", "w:val").or(Some(style_id)),
                based_on: find_tag_attr(&style_xml, "w:basedOn", "w:val"),
                next: find_tag_attr(&style_xml, "w:next", "w:val"),
                outline_level: find_tag_attr(&style_xml, "w:outlineLvl", "w:val"),
                fonts: collect_attr_values(
                    &style_xml,
                    &["w:ascii", "w:hAnsi", "w:eastAsia", "ascii", "hAnsi", "eastAsia"],
                    24,
                ),
                font_sizes_half_points: collect_tag_attr_values(&style_xml, "w:sz", "w:val", 24),
                spacing: extract_tag_snippets(&style_xml, "w:spacing").into_iter().next().map(|spacing| json!({
                    "lineTwips": get_attr(&spacing, "w:line"),
                    "lineRule": get_attr(&spacing, "w:lineRule"),
                    "before": get_attr(&spacing, "w:before"),
                    "after": get_attr(&spacing, "w:after"),
                })),
                has_bold: style_xml.contains("<w:b") || style_xml.contains("<w:bCs"),
                has_italic: style_xml.contains("<w:i") || style_xml.contains("<w:iCs"),
            })
        })
        .collect()
}

fn summarize_top(values: Vec<String>, limit: usize) -> Vec<Value> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for value in values.into_iter().filter(|value| !value.is_empty()) {
        *counts.entry(value).or_insert(0) += 1;
    }
    let mut items = counts.into_iter().collect::<Vec<_>>();
    items.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    items
        .into_iter()
        .take(limit)
        .map(|(value, count)| json!({ "value": value, "count": count }))
        .collect()
}

fn unique_strings(values: impl IntoIterator<Item = String>, limit: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for value in values.into_iter().filter(|value| !value.is_empty()) {
        if seen.insert(value.clone()) {
            out.push(value);
            if out.len() >= limit {
                break;
            }
        }
    }
    out
}

fn starts_with_numbering(text: &str) -> bool {
    let trimmed = text.trim_start();
    let first = trimmed.chars().next();
    matches!(first, Some('一' | '二' | '三' | '四' | '五' | '六' | '七' | '八' | '九' | '十' | '第'))
        || first.map(|ch| ch.is_ascii_digit()).unwrap_or(false)
}

fn infer_docx_heading_candidates(
    paragraph_records: &[ParagraphRecord],
    style_records: &[StyleRecord],
) -> Vec<Value> {
    let style_by_id = style_records
        .iter()
        .map(|style| (style.style_id.clone(), style.clone()))
        .collect::<HashMap<_, _>>();

    paragraph_records
        .iter()
        .filter(|paragraph| !paragraph.text.is_empty())
        .filter_map(|paragraph| {
            let style = paragraph
                .style_id
                .as_ref()
                .and_then(|style_id| style_by_id.get(style_id));
            let style_id = paragraph.style_id.clone().unwrap_or_default();
            let style_name = style.and_then(|s| s.name.clone()).unwrap_or_default();
            let style_text = format!("{} {}", style_id.to_lowercase(), style_name.to_lowercase());
            let is_heading = style.and_then(|s| s.outline_level.clone()).is_some()
                || style_text.contains("heading")
                || style_text.contains("title")
                || style_text.contains("标题")
                || paragraph.numbering_id.is_some()
                || starts_with_numbering(&paragraph.text);
            if !is_heading {
                return None;
            }
            Some(json!({
                "index": paragraph.index,
                "text": paragraph.text.chars().take(120).collect::<String>(),
                "styleId": paragraph.style_id,
                "styleName": style.and_then(|s| s.name.clone()),
                "outlineLevel": style.and_then(|s| s.outline_level.clone()).or_else(|| paragraph.numbering_level.clone()),
                "numberingId": paragraph.numbering_id,
                "numberingLevel": paragraph.numbering_level,
            }))
        })
        .take(80)
        .collect()
}

fn infer_docx_section_pattern(heading_candidates: &[Value]) -> &'static str {
    if heading_candidates.is_empty() {
        return "unknown";
    }
    let mut chinese_numbered = 0usize;
    let mut decimal_numbered = 0usize;
    let mut style_based = 0usize;
    for item in heading_candidates {
        let text = item.get("text").and_then(Value::as_str).unwrap_or("");
        let style_id = item.get("styleId").and_then(Value::as_str).unwrap_or("");
        if text.trim_start().chars().next().map(|ch| matches!(ch, '一'|'二'|'三'|'四'|'五'|'六'|'七'|'八'|'九'|'十'|'第')).unwrap_or(false) {
            chinese_numbered += 1;
        }
        if text.trim_start().chars().next().map(|ch| ch.is_ascii_digit()).unwrap_or(false) {
            decimal_numbered += 1;
        }
        if style_id.to_lowercase().contains("heading") || style_id.contains("标题") {
            style_based += 1;
        }
    }
    if chinese_numbered >= 2 && chinese_numbered * 3 >= heading_candidates.len() {
        "chinese-numbered-sections"
    } else if decimal_numbered >= 2 && decimal_numbered * 3 >= heading_candidates.len() {
        "decimal-numbered-sections"
    } else if style_based > 0 {
        "style-based-headings"
    } else {
        "mixed-or-implicit"
    }
}

fn paragraph_to_json(paragraph: &ParagraphRecord) -> Value {
    json!({
        "index": paragraph.index,
        "text": paragraph.text,
        "styleId": paragraph.style_id,
        "numberingId": paragraph.numbering_id,
        "numberingLevel": paragraph.numbering_level,
        "runCount": paragraph.run_count,
        "hasBold": paragraph.has_bold,
        "hasItalic": paragraph.has_italic,
        "hasUnderline": paragraph.has_underline,
        "fontSizesHalfPoints": paragraph.font_sizes_half_points,
        "fonts": paragraph.fonts,
    })
}

fn style_to_json(style: &StyleRecord) -> Value {
    json!({
        "styleId": style.style_id,
        "type": style.style_type,
        "name": style.name,
        "basedOn": style.based_on,
        "next": style.next,
        "outlineLevel": style.outline_level,
        "fonts": style.fonts,
        "fontSizesHalfPoints": style.font_sizes_half_points,
        "spacing": style.spacing,
        "hasBold": style.has_bold,
        "hasItalic": style.has_italic,
    })
}

fn probe_docx<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    names: &[String],
) -> Result<Value, String> {
    let document_xml = read_zip_text(archive, "word/document.xml").unwrap_or_default();
    let styles_xml = read_zip_text(archive, "word/styles.xml").unwrap_or_default();
    let numbering_xml = read_zip_text(archive, "word/numbering.xml").unwrap_or_default();
    let content_types_xml = read_zip_text(archive, "[Content_Types].xml").unwrap_or_default();

    let paragraph_records = extract_docx_paragraphs(&document_xml);
    let style_records = parse_docx_styles(&styles_xml);
    let heading_candidates = infer_docx_heading_candidates(&paragraph_records, &style_records);
    let section_pattern = infer_docx_section_pattern(&heading_candidates);
    let page_size = extract_tag_snippets(&document_xml, "w:pgSz").into_iter().next().unwrap_or_default();
    let page_margins = extract_tag_snippets(&document_xml, "w:pgMar").into_iter().next().unwrap_or_default();
    let font_values = unique_strings(
        collect_attr_values(
            &format!("{}\n{}", styles_xml, document_xml),
            &["w:ascii", "w:hAnsi", "w:eastAsia", "ascii", "hAnsi", "eastAsia"],
            200,
        ),
        20,
    );
    let heading_style_refs = unique_strings(
        paragraph_records
            .iter()
            .filter_map(|p| p.style_id.clone())
            .filter(|style| {
                let lower = style.to_lowercase();
                lower.contains("heading") || lower.contains("title") || lower.contains("标题")
            }),
        20,
    );

    Ok(json!({
        "kind": "office_zip",
        "officeKind": "docx",
        "entryCount": names.len(),
        "hasMainDocument": !document_xml.is_empty(),
        "relationships": names.iter().filter(|name| name.ends_with(".rels")).count(),
        "contentTypesCount": count_substring(&content_types_xml, "<Override"),
        "structure": {
            "paragraphs": paragraph_records.len(),
            "runs": count_tag(&document_xml, "w:r"),
            "tables": count_tag(&document_xml, "w:tbl"),
            "headingStyleRefs": heading_style_refs,
            "headingCandidates": heading_candidates,
            "sectionPattern": section_pattern,
            "paragraphStyleUsage": summarize_top(paragraph_records.iter().filter_map(|p| p.style_id.clone()).collect(), 20),
            "numberingUsage": summarize_top(paragraph_records.iter().filter_map(|p| p.numbering_id.clone()).collect(), 12),
            "paragraphSamples": paragraph_records.iter().filter(|p| !p.text.is_empty()).take(20).map(paragraph_to_json).collect::<Vec<_>>(),
            "textSample": paragraph_records.iter().filter(|p| !p.text.is_empty()).take(12).map(|p| p.text.clone()).collect::<Vec<_>>(),
        },
        "style": {
            "hasStyles": !styles_xml.is_empty(),
            "styleCount": style_records.len(),
            "styleIds": style_records.iter().take(30).map(|s| s.style_id.clone()).collect::<Vec<_>>(),
            "styles": style_records.iter().take(60).map(style_to_json).collect::<Vec<_>>(),
            "fonts": font_values,
            "fontUsage": summarize_top(paragraph_records.iter().flat_map(|p| p.fonts.clone()).collect(), 20),
            "fontSizeUsageHalfPoints": summarize_top(paragraph_records.iter().flat_map(|p| p.font_sizes_half_points.clone()).collect(), 20),
            "emphasis": {
                "boldParagraphs": paragraph_records.iter().filter(|p| p.has_bold).count(),
                "italicParagraphs": paragraph_records.iter().filter(|p| p.has_italic).count(),
                "underlineParagraphs": paragraph_records.iter().filter(|p| p.has_underline).count(),
            },
            "page": {
                "widthTwips": get_attr(&page_size, "w:w"),
                "heightTwips": get_attr(&page_size, "w:h"),
                "orientation": get_attr(&page_size, "w:orient"),
                "marginsTwips": if page_margins.is_empty() { Value::Null } else { json!({
                    "top": get_attr(&page_margins, "w:top"),
                    "right": get_attr(&page_margins, "w:right"),
                    "bottom": get_attr(&page_margins, "w:bottom"),
                    "left": get_attr(&page_margins, "w:left"),
                    "header": get_attr(&page_margins, "w:header"),
                    "footer": get_attr(&page_margins, "w:footer"),
                }) },
            },
            "numberingDefinitions": count_tag(&numbering_xml, "w:num"),
        }
    }))
}

fn probe_xlsx<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    names: &[String],
) -> Result<Value, String> {
    let workbook_xml = read_zip_text(archive, "xl/workbook.xml").unwrap_or_default();
    let styles_xml = read_zip_text(archive, "xl/styles.xml").unwrap_or_default();
    let shared_strings_xml = read_zip_text(archive, "xl/sharedStrings.xml").unwrap_or_default();
    let mut sheet_entries = names
        .iter()
        .filter(|name| name.starts_with("xl/worksheets/sheet") && name.ends_with(".xml"))
        .cloned()
        .collect::<Vec<_>>();
    sheet_entries.sort();

    let sheets = extract_tag_snippets(&workbook_xml, "sheet")
        .into_iter()
        .enumerate()
        .map(|(index, sheet)| json!({
            "name": get_attr(&sheet, "name").unwrap_or_else(|| format!("Sheet {}", index + 1)),
            "sheetId": get_attr(&sheet, "sheetId").unwrap_or_else(|| format!("{}", index + 1)),
        }))
        .collect::<Vec<_>>();

    let mut sheet_stats = Vec::new();
    for name in &sheet_entries {
        let xml = read_zip_text(archive, name).unwrap_or_default();
        let dimension = extract_tag_snippets(&xml, "dimension")
            .into_iter()
            .find_map(|snippet| get_attr(&snippet, "ref"));
        sheet_stats.push(json!({
            "path": name,
            "dimension": dimension,
            "rowCount": count_tag(&xml, "row"),
            "cellCount": count_tag(&xml, "c"),
            "mergedCellCount": count_tag(&xml, "mergeCell"),
            "formulaCount": count_tag(&xml, "f"),
        }));
    }

    Ok(json!({
        "kind": "office_zip",
        "officeKind": "xlsx",
        "entryCount": names.len(),
        "structure": {
            "sheetCount": sheet_entries.len(),
            "sheets": sheets,
            "sheetStats": sheet_stats,
        },
        "style": {
            "hasStyles": !styles_xml.is_empty(),
            "cellStyleCount": count_tag(&styles_xml, "cellStyle"),
            "fontCount": extract_tag_snippets(&styles_xml, "fonts").into_iter().find_map(|snippet| get_attr(&snippet, "count")).and_then(|v| v.parse::<usize>().ok()).unwrap_or_else(|| count_tag(&styles_xml, "font")),
            "fillCount": extract_tag_snippets(&styles_xml, "fills").into_iter().find_map(|snippet| get_attr(&snippet, "count")).and_then(|v| v.parse::<usize>().ok()).unwrap_or_else(|| count_tag(&styles_xml, "fill")),
            "borderCount": extract_tag_snippets(&styles_xml, "borders").into_iter().find_map(|snippet| get_attr(&snippet, "count")).and_then(|v| v.parse::<usize>().ok()).unwrap_or_else(|| count_tag(&styles_xml, "border")),
            "sharedStringCount": count_tag(&shared_strings_xml, "si"),
        }
    }))
}

fn probe_pptx<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    names: &[String],
) -> Result<Value, String> {
    let presentation_xml = read_zip_text(archive, "ppt/presentation.xml").unwrap_or_default();
    let mut theme_entries = names.iter().filter(|n| n.starts_with("ppt/theme/theme") && n.ends_with(".xml")).cloned().collect::<Vec<_>>();
    let mut slide_entries = names.iter().filter(|n| n.starts_with("ppt/slides/slide") && n.ends_with(".xml")).cloned().collect::<Vec<_>>();
    let mut layout_entries = names.iter().filter(|n| n.starts_with("ppt/slideLayouts/slideLayout") && n.ends_with(".xml")).cloned().collect::<Vec<_>>();
    let mut master_entries = names.iter().filter(|n| n.starts_with("ppt/slideMasters/slideMaster") && n.ends_with(".xml")).cloned().collect::<Vec<_>>();
    theme_entries.sort();
    slide_entries.sort();
    layout_entries.sort();
    master_entries.sort();

    let mut slide_stats = Vec::new();
    for name in slide_entries.iter().take(20) {
        let xml = read_zip_text(archive, name).unwrap_or_default();
        slide_stats.push(json!({
            "path": name,
            "textCount": extract_text_tag_values(&xml, "a:t", usize::MAX).len(),
            "shapeCount": count_tag(&xml, "p:sp"),
            "pictureCount": count_tag(&xml, "p:pic"),
            "tableCount": count_tag(&xml, "a:tbl"),
            "textSample": extract_text_tag_values(&xml, "a:t", 8),
        }));
    }

    let theme_xml = theme_entries
        .iter()
        .filter_map(|name| read_zip_text(archive, name))
        .collect::<Vec<_>>()
        .join("\n");
    let theme_name = extract_tag_snippets(&theme_xml, "a:theme")
        .into_iter()
        .find_map(|snippet| get_attr(&snippet, "name"));

    Ok(json!({
        "kind": "office_zip",
        "officeKind": "pptx",
        "entryCount": names.len(),
        "structure": {
            "slideCount": slide_entries.len(),
            "layoutCount": layout_entries.len(),
            "masterCount": master_entries.len(),
            "presentationRelationshipCount": count_tag(&presentation_xml, "p:sldId"),
            "slideStats": slide_stats,
        },
        "style": {
            "themeCount": theme_entries.len(),
            "themeName": theme_name,
            "colorSchemeCount": count_tag(&theme_xml, "a:clrScheme"),
            "fontSchemeCount": count_tag(&theme_xml, "a:fontScheme"),
        }
    }))
}

fn collect_pdf_base_fonts(binary: &str, limit: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let needle = "/BaseFont";
    let mut cursor = 0;
    while out.len() < limit {
        let Some(relative) = binary[cursor..].find(needle) else { break };
        let start = cursor + relative + needle.len();
        let rest = binary[start..].trim_start();
        let rest = rest.strip_prefix('/').unwrap_or(rest);
        let value = rest
            .chars()
            .take_while(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '_' | '.' | '-'))
            .collect::<String>();
        if !value.is_empty() && seen.insert(value.clone()) {
            out.push(value);
        }
        cursor = start + 1;
    }
    out
}

fn probe_pdf(buffer: &[u8]) -> Value {
    let binary = String::from_utf8_lossy(buffer);
    let font_refs = collect_pdf_base_fonts(&binary, 30);
    let text_operator_count = count_substring(&binary, " Tj") + count_substring(&binary, " TJ") + count_substring(&binary, ")Tj") + count_substring(&binary, "]TJ");
    let image_count = count_substring(&binary, "/Subtype /Image") + count_substring(&binary, "/Subtype/Image");
    let has_text_layer_hint = text_operator_count > 0 || !font_refs.is_empty();
    let scan_likely = image_count > 0 && text_operator_count == 0 && font_refs.is_empty();

    json!({
        "kind": "pdf",
        "header": String::from_utf8_lossy(&buffer[..buffer.len().min(16)]).to_string(),
        "structure": {
            "pageCount": count_substring(&binary, "/Type /Page") + count_substring(&binary, "/Type/Page"),
            "textOperatorCount": text_operator_count,
            "imageCount": image_count,
            "encrypted": binary.contains("/Encrypt"),
            "hasXfa": binary.contains("/XFA"),
            "hasTextLayerHint": has_text_layer_hint,
            "scanLikely": scan_likely,
        },
        "style": {
            "fontRefs": font_refs,
        }
    })
}
