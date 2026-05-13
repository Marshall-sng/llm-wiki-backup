import { inflateRawSync } from "node:zlib";

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function decodeXml(buffer) {
  return TEXT_DECODER.decode(buffer);
}

function stripXmlTags(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAll(text, pattern) {
  return Array.from(text.matchAll(pattern));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function countMatches(text, pattern) {
  return matchAll(text, pattern).length;
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function getAttribute(fragment, name) {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return fragment.match(new RegExp(`${escaped}="([^"]+)"`))?.[1] ?? null;
}

function extractTagBlocks(xml, tagName) {
  const escaped = tagName.replace(":", "\\:");
  return matchAll(xml, new RegExp(`<${escaped}\\b[\\s\\S]*?<\\/${escaped}>`, "g")).map((match) => match[0]);
}

function extractParagraphText(paragraphXml) {
  return matchAll(paragraphXml, /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
    .map((match) => decodeXmlEntities(match[1]))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDocxParagraphs(documentXml) {
  return extractTagBlocks(documentXml, "w:p").map((paragraphXml, index) => {
    const text = extractParagraphText(paragraphXml);
    return {
      index: index + 1,
      text,
      styleId: paragraphXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] ?? null,
      numberingId: paragraphXml.match(/<w:numId[^>]*w:val="([^"]+)"/)?.[1] ?? null,
      numberingLevel: paragraphXml.match(/<w:ilvl[^>]*w:val="([^"]+)"/)?.[1] ?? null,
      runCount: countMatches(paragraphXml, /<w:r[\s>]/g),
      hasBold: /<w:b\b/.test(paragraphXml),
      hasItalic: /<w:i\b/.test(paragraphXml),
      hasUnderline: /<w:u\b/.test(paragraphXml),
      fontSizesHalfPoints: unique(matchAll(paragraphXml, /<w:sz[^>]*w:val="([^"]+)"/g).map((match) => match[1])),
      fonts: unique(matchAll(paragraphXml, /w:(?:ascii|hAnsi|eastAsia)="([^"]+)"/g).map((match) => match[1]))
    };
  });
}

function parseDocxStyles(stylesXml) {
  return extractTagBlocks(stylesXml, "w:style").map((styleXml) => {
    const header = styleXml.match(/<w:style\b[^>]*>/)?.[0] ?? "";
    const styleId = getAttribute(header, "w:styleId");
    return {
      styleId,
      type: getAttribute(header, "w:type"),
      name: styleXml.match(/<w:name[^>]*w:val="([^"]+)"/)?.[1] ?? styleId,
      basedOn: styleXml.match(/<w:basedOn[^>]*w:val="([^"]+)"/)?.[1] ?? null,
      next: styleXml.match(/<w:next[^>]*w:val="([^"]+)"/)?.[1] ?? null,
      outlineLevel: styleXml.match(/<w:outlineLvl[^>]*w:val="([^"]+)"/)?.[1] ?? null,
      fonts: unique(matchAll(styleXml, /w:(?:ascii|hAnsi|eastAsia)="([^"]+)"/g).map((match) => match[1])),
      fontSizesHalfPoints: unique(matchAll(styleXml, /<w:sz[^>]*w:val="([^"]+)"/g).map((match) => match[1])),
      hasBold: /<w:b\b/.test(styleXml),
      hasItalic: /<w:i\b/.test(styleXml)
    };
  }).filter((style) => style.styleId);
}

function summarizeTop(values, limit = 12) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function inferDocxHeadingCandidates(paragraphRecords, styleRecords) {
  const styleById = new Map(styleRecords.map((style) => [style.styleId, style]));
  return paragraphRecords
    .filter((paragraph) => paragraph.text)
    .filter((paragraph) => {
      const style = paragraph.styleId ? styleById.get(paragraph.styleId) : null;
      return Boolean(
        style?.outlineLevel != null
        || /heading|title|subtitle|标题|题目/i.test(paragraph.styleId ?? "")
        || /heading|title|subtitle|标题|题目/i.test(style?.name ?? "")
        || /^[一二三四五六七八九十]+[、.．]/.test(paragraph.text)
        || /^\d+(?:\.\d+){0,3}[、.．\s]/.test(paragraph.text)
      );
    })
    .slice(0, 80)
    .map((paragraph) => {
      const style = paragraph.styleId ? styleById.get(paragraph.styleId) : null;
      return {
        index: paragraph.index,
        text: paragraph.text.slice(0, 120),
        styleId: paragraph.styleId,
        styleName: style?.name ?? null,
        outlineLevel: style?.outlineLevel ?? paragraph.numberingLevel ?? null,
        numberingId: paragraph.numberingId,
        numberingLevel: paragraph.numberingLevel
      };
    });
}

function inferDocxSectionPattern(headingCandidates) {
  if (headingCandidates.length === 0) return "unknown";
  const chineseNumbered = headingCandidates.filter((item) => /^[一二三四五六七八九十]+[、.．]/.test(item.text)).length;
  const decimalNumbered = headingCandidates.filter((item) => /^\d+(?:\.\d+){0,3}[、.．\s]/.test(item.text)).length;
  const styleBased = headingCandidates.filter((item) => item.styleId && /heading|title|标题/i.test(item.styleId)).length;
  if (chineseNumbered >= Math.max(2, headingCandidates.length * 0.3)) return "chinese-numbered-sections";
  if (decimalNumbered >= Math.max(2, headingCandidates.length * 0.3)) return "decimal-numbered-sections";
  if (styleBased > 0) return "style-based-headings";
  return "mixed-or-implicit";
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

export function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw new Error("ZIP end-of-central-directory signature not found");
  }

  const totalEntries = readUInt16(buffer, eocd + 10);
  const centralDirectorySize = readUInt32(buffer, eocd + 12);
  const centralDirectoryOffset = readUInt32(buffer, eocd + 16);
  const entries = [];
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  for (let index = 0; index < totalEntries && offset < end; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central-directory header at ${offset}`);
    }

    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (readUInt32(buffer, localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${name}`);
    }

    const localFileNameLength = readUInt16(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      dataOffset,
      compressedData
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    entries,
    has(name) {
      return byName.has(name);
    },
    names() {
      return entries.map((entry) => entry.name);
    },
    read(name) {
      const entry = byName.get(name);
      if (!entry) return null;
      if (entry.compressionMethod === 0) return entry.compressedData;
      if (entry.compressionMethod === 8) return inflateRawSync(entry.compressedData);
      throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${name}`);
    },
    readText(name) {
      const content = this.read(name);
      return content ? decodeXml(content) : null;
    }
  };
}

function probeDocx(zip) {
  const documentXml = zip.readText("word/document.xml") ?? "";
  const stylesXml = zip.readText("word/styles.xml") ?? "";
  const numberingXml = zip.readText("word/numbering.xml") ?? "";
  const contentTypesXml = zip.readText("[Content_Types].xml") ?? "";
  const relationships = zip.names().filter((name) => name.endsWith(".rels")).length;
  const paragraphRecords = extractDocxParagraphs(documentXml);
  const styleRecords = parseDocxStyles(stylesXml);
  const headingCandidates = inferDocxHeadingCandidates(paragraphRecords, styleRecords);
  const paragraphs = paragraphRecords.length;
  const tables = countMatches(documentXml, /<w:tbl[\s>]/g);
  const runs = countMatches(documentXml, /<w:r[\s>]/g);
  const headings = matchAll(documentXml, /<w:pStyle[^>]*w:val="([^"]+)"/g)
    .map((match) => match[1])
    .filter((value) => /heading|title|标题|Heading/i.test(value));
  const styleIds = styleRecords.map((style) => style.styleId);
  const fonts = unique([
    ...matchAll(stylesXml, /w:(?:ascii|hAnsi|eastAsia)="([^"]+)"/g).map((match) => match[1]),
    ...matchAll(documentXml, /w:(?:ascii|hAnsi|eastAsia)="([^"]+)"/g).map((match) => match[1])
  ]).slice(0, 20);
  const texts = paragraphRecords.map((paragraph) => paragraph.text).filter(Boolean);
  const pageSize = documentXml.match(/<w:pgSz[^>]*>/)?.[0] ?? "";
  const pageMargins = documentXml.match(/<w:pgMar[^>]*>/)?.[0] ?? "";

  return {
    kind: "office_zip",
    officeKind: "docx",
    entryCount: zip.entries.length,
    hasMainDocument: Boolean(documentXml),
    relationships,
    contentTypesCount: countMatches(contentTypesXml, /<Override\b/g),
    structure: {
      paragraphs,
      runs,
      tables,
      headingStyleRefs: unique(headings).slice(0, 20),
      headingCandidates,
      sectionPattern: inferDocxSectionPattern(headingCandidates),
      paragraphStyleUsage: summarizeTop(paragraphRecords.map((paragraph) => paragraph.styleId), 20),
      numberingUsage: summarizeTop(paragraphRecords.map((paragraph) => paragraph.numberingId), 12),
      paragraphSamples: paragraphRecords.filter((paragraph) => paragraph.text).slice(0, 20),
      textSample: texts.slice(0, 12)
    },
    style: {
      hasStyles: Boolean(stylesXml),
      styleCount: styleIds.length,
      styleIds: styleIds.slice(0, 30),
      styles: styleRecords.slice(0, 60),
      fonts,
      fontUsage: summarizeTop(paragraphRecords.flatMap((paragraph) => paragraph.fonts), 20),
      fontSizeUsageHalfPoints: summarizeTop(paragraphRecords.flatMap((paragraph) => paragraph.fontSizesHalfPoints), 20),
      page: {
        widthTwips: pageSize ? getAttribute(pageSize, "w:w") : null,
        heightTwips: pageSize ? getAttribute(pageSize, "w:h") : null,
        orientation: pageSize ? getAttribute(pageSize, "w:orient") : null,
        marginsTwips: pageMargins
          ? {
              top: getAttribute(pageMargins, "w:top"),
              right: getAttribute(pageMargins, "w:right"),
              bottom: getAttribute(pageMargins, "w:bottom"),
              left: getAttribute(pageMargins, "w:left")
            }
          : null
      },
      numberingDefinitions: countMatches(numberingXml, /<w:num\b/g)
    }
  };
}

function probeXlsx(zip) {
  const workbookXml = zip.readText("xl/workbook.xml") ?? "";
  const stylesXml = zip.readText("xl/styles.xml") ?? "";
  const sharedStringsXml = zip.readText("xl/sharedStrings.xml") ?? "";
  const sheetEntries = zip.names().filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  const sheets = matchAll(workbookXml, /<sheet\b[^>]*name="([^"]+)"[^>]*(?:sheetId="([^"]+)")?[^>]*>/g)
    .map((match, index) => ({
      name: match[1],
      sheetId: match[2] ?? String(index + 1)
    }));
  const sheetStats = sheetEntries.map((name) => {
    const xml = zip.readText(name) ?? "";
    return {
      path: name,
      dimension: xml.match(/<dimension[^>]*ref="([^"]+)"/)?.[1] ?? null,
      rowCount: countMatches(xml, /<row\b/g),
      cellCount: countMatches(xml, /<c\b/g),
      mergedCellCount: countMatches(xml, /<mergeCell\b/g),
      formulaCount: countMatches(xml, /<f(?:\s|>)/g)
    };
  });
  return {
    kind: "office_zip",
    officeKind: "xlsx",
    entryCount: zip.entries.length,
    structure: {
      sheetCount: sheetEntries.length,
      sheets,
      sheetStats
    },
    style: {
      hasStyles: Boolean(stylesXml),
      cellStyleCount: countMatches(stylesXml, /<cellStyle\b/g),
      fontCount: Number(stylesXml.match(/<fonts[^>]*count="(\d+)"/)?.[1] ?? countMatches(stylesXml, /<font\b/g)),
      fillCount: Number(stylesXml.match(/<fills[^>]*count="(\d+)"/)?.[1] ?? countMatches(stylesXml, /<fill\b/g)),
      borderCount: Number(stylesXml.match(/<borders[^>]*count="(\d+)"/)?.[1] ?? countMatches(stylesXml, /<border\b/g)),
      sharedStringCount: countMatches(sharedStringsXml, /<si\b/g)
    }
  };
}

function probePptx(zip) {
  const presentationXml = zip.readText("ppt/presentation.xml") ?? "";
  const themeEntries = zip.names().filter((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name)).sort();
  const slideEntries = zip.names().filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  const layoutEntries = zip.names().filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).sort();
  const masterEntries = zip.names().filter((name) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)).sort();
  const slideStats = slideEntries.slice(0, 20).map((name) => {
    const xml = zip.readText(name) ?? "";
    const texts = matchAll(xml, /<a:t>([\s\S]*?)<\/a:t>/g)
      .map((match) => stripXmlTags(match[1]))
      .filter(Boolean);
    return {
      path: name,
      textCount: texts.length,
      shapeCount: countMatches(xml, /<p:sp\b/g),
      pictureCount: countMatches(xml, /<p:pic\b/g),
      tableCount: countMatches(xml, /<a:tbl\b/g),
      textSample: texts.slice(0, 8)
    };
  });
  const themeXml = themeEntries.map((name) => zip.readText(name) ?? "").join("\n");
  const themeName = themeXml.match(/<a:theme[^>]*name="([^"]+)"/)?.[1] ?? null;

  return {
    kind: "office_zip",
    officeKind: "pptx",
    entryCount: zip.entries.length,
    structure: {
      slideCount: slideEntries.length,
      layoutCount: layoutEntries.length,
      masterCount: masterEntries.length,
      presentationRelationshipCount: countMatches(presentationXml, /<p:sldId\b/g),
      slideStats
    },
    style: {
      themeCount: themeEntries.length,
      themeName,
      colorSchemeCount: countMatches(themeXml, /<a:clrScheme\b/g),
      fontSchemeCount: countMatches(themeXml, /<a:fontScheme\b/g)
    }
  };
}

function probeOffice(buffer, format) {
  const zip = readZipEntries(buffer);
  if (format === "docx") return probeDocx(zip);
  if (format === "xlsx") return probeXlsx(zip);
  if (format === "pptx") return probePptx(zip);
  throw new Error(`Unsupported Office format: ${format}`);
}

function probePdf(buffer) {
  const binary = buffer.toString("latin1");
  const header = binary.slice(0, 16);
  const pageCount = countMatches(binary, /\/Type\s*\/Page\b/g);
  const fontRefs = unique(matchAll(binary, /\/BaseFont\s*\/([A-Za-z0-9+_.-]+)/g).map((match) => match[1])).slice(0, 30);
  const textOperatorCount = countMatches(binary, /\b(?:Tj|TJ)\b/g);
  const imageCount = countMatches(binary, /\/Subtype\s*\/Image\b/g);
  const encrypted = /\/Encrypt\b/.test(binary);
  const hasXfa = /\/XFA\b/.test(binary);
  const hasTextLayerHint = textOperatorCount > 0 || fontRefs.length > 0;
  const scanLikely = imageCount > 0 && textOperatorCount === 0 && fontRefs.length === 0;

  return {
    kind: "pdf",
    header,
    structure: {
      pageCount,
      textOperatorCount,
      imageCount,
      encrypted,
      hasXfa,
      hasTextLayerHint,
      scanLikely
    },
    style: {
      fontRefs
    }
  };
}

export function probeDocument(buffer, format) {
  if (format === "pdf") return probePdf(buffer);
  return probeOffice(buffer, format);
}
