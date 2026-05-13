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
  const paragraphs = countMatches(documentXml, /<w:p[\s>]/g);
  const tables = countMatches(documentXml, /<w:tbl[\s>]/g);
  const runs = countMatches(documentXml, /<w:r[\s>]/g);
  const headings = matchAll(documentXml, /<w:pStyle[^>]*w:val="([^"]+)"/g)
    .map((match) => match[1])
    .filter((value) => /heading|title|标题|Heading/i.test(value));
  const styleIds = unique(matchAll(stylesXml, /<w:style[^>]*w:styleId="([^"]+)"/g).map((match) => match[1]));
  const fonts = unique([
    ...matchAll(stylesXml, /w:(?:ascii|hAnsi|eastAsia)="([^"]+)"/g).map((match) => match[1]),
    ...matchAll(documentXml, /w:(?:ascii|hAnsi|eastAsia)="([^"]+)"/g).map((match) => match[1])
  ]).slice(0, 20);
  const texts = matchAll(documentXml, /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
    .map((match) => stripXmlTags(match[1]))
    .filter(Boolean);

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
      textSample: texts.slice(0, 12)
    },
    style: {
      hasStyles: Boolean(stylesXml),
      styleCount: styleIds.length,
      styleIds: styleIds.slice(0, 30),
      fonts,
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
