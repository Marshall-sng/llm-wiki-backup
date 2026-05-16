import fs from 'node:fs';
import path from 'node:path';
import { clone, sha256 } from './stable-json.mjs';

const CONFIDENCE_BY_PRIORITY = {
  primary: 'high',
  baseline: 'medium'
};

function fileNameOnly(sourcePath) {
  return sourcePath ? path.basename(sourcePath) : null;
}

export function createEvidenceCatalog(caseDef, profile) {
  const evidence = [];
  const add = (idSuffix, kind, pointer, value, options = {}) => {
    const id = `style.${caseDef.format}.${idSuffix}`;
    evidence.push({
      id,
      kind,
      pointer,
      confidence: options.confidence ?? CONFIDENCE_BY_PRIORITY[caseDef.priority] ?? 'medium',
      value: clone(value),
      description: options.description ?? `${caseDef.format.toUpperCase()} deterministic style evidence: ${pointer}`,
      sha256: sha256({ pointer, value })
    });
    return id;
  };
  return { evidence, add };
}

export function fact(value, evidenceRefs, options = {}) {
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    throw new Error(`Fact requires at least one evidenceRef for value ${JSON.stringify(value).slice(0, 80)}`);
  }
  const out = {
    value: clone(value),
    confidence: options.confidence ?? 'medium',
    evidenceRefs: [...evidenceRefs]
  };
  if (options.unit) out.unit = options.unit;
  if (options.derived) out.derived = true;
  if (options.notes?.length) out.notes = options.notes;
  return out;
}

function halfPointUsageToPt(usage) {
  return (usage ?? []).map((entry) => ({ value: Number(entry.value) / 2, count: entry.count }));
}

function twipsToCm(value) {
  return Number(value) * 2.54 / 1440;
}

function docxFacts(caseDef, profile, catalog) {
  const raw = profile.rawProbeFacts;
  const style = raw.style ?? {};
  const structure = raw.structure ?? {};
  const confidence = 'high';
  const ev = {
    page: catalog.add('layout.0001', 'openxml-docx-page', 'rawProbeFacts.style.page', style.page ?? {}, { confidence }),
    fonts: catalog.add('fontUsage.0001', 'openxml-docx-font-usage', 'rawProbeFacts.style.fontUsage', style.fontUsage ?? [], { confidence }),
    fontSizes: catalog.add('fontSize.0001', 'openxml-docx-font-size-usage', 'rawProbeFacts.style.fontSizeUsageHalfPoints', style.fontSizeUsageHalfPoints ?? [], { confidence }),
    styles: catalog.add('styleDef.0001', 'openxml-docx-style-definitions', 'rawProbeFacts.style.styles', style.styles ?? [], { confidence }),
    paragraphStyles: catalog.add('paragraphStyleUsage.0001', 'openxml-docx-paragraph-style-usage', 'rawProbeFacts.structure.paragraphStyleUsage', structure.paragraphStyleUsage ?? [], { confidence }),
    counts: catalog.add('structureCounts.0001', 'openxml-docx-structure-counts', 'rawProbeFacts.structure.counts', { paragraphs: structure.paragraphs, runs: structure.runs, tables: structure.tables }, { confidence }),
    numbering: catalog.add('numbering.0001', 'openxml-docx-numbering-definitions', 'rawProbeFacts.style.numberingDefinitions', style.numberingDefinitions ?? 0, { confidence }),
    samples: catalog.add('paragraphSamples.0001', 'openxml-docx-paragraph-samples', 'rawProbeFacts.structure.paragraphSamples', (structure.paragraphSamples ?? []).slice(0, 12), { confidence: 'medium' })
  };
  const page = style.page ?? {};
  const pageSize = { widthTwips: page.widthTwips, heightTwips: page.heightTwips, orientation: page.orientation ?? null };
  return {
    layout: {
      pageSizeTwips: fact(pageSize, [ev.page], { unit: 'twip', confidence }),
      pageSizeCm: fact({
        widthCm: Number(twipsToCm(page.widthTwips).toFixed(2)),
        heightCm: Number(twipsToCm(page.heightTwips).toFixed(2))
      }, [ev.page], { unit: 'cm', confidence, derived: true, notes: ['Converted deterministically from twips using 1440 twips/inch.'] }),
      marginsTwips: fact(page.marginsTwips ?? {}, [ev.page], { unit: 'twip', confidence })
    },
    typography: {
      fonts: fact(style.fonts ?? [], [ev.fonts, ev.styles], { confidence }),
      fontUsage: fact(style.fontUsage ?? [], [ev.fonts], { confidence }),
      fontSizeUsageHalfPoints: fact(style.fontSizeUsageHalfPoints ?? [], [ev.fontSizes], { unit: 'halfPoint', confidence }),
      fontSizeUsagePt: fact(halfPointUsageToPt(style.fontSizeUsageHalfPoints), [ev.fontSizes], { unit: 'pt', confidence, derived: true, notes: ['Converted deterministically from Word half-point values.'] })
    },
    styles: {
      styleCount: fact(style.styleCount ?? 0, [ev.styles], { confidence }),
      styleIds: fact(style.styleIds ?? [], [ev.styles], { confidence }),
      definitions: fact(style.styles ?? [], [ev.styles], { confidence }),
      paragraphStyleUsage: fact(structure.paragraphStyleUsage ?? [], [ev.paragraphStyles], { confidence })
    },
    structure: {
      counts: fact({ paragraphs: structure.paragraphs, runs: structure.runs, tables: structure.tables }, [ev.counts], { confidence }),
      numberingDefinitions: fact(style.numberingDefinitions ?? 0, [ev.numbering], { confidence }),
      paragraphSamples: fact((structure.paragraphSamples ?? []).slice(0, 12), [ev.samples], { confidence: 'medium', notes: ['Samples are evidence for style context, not a full text transmission mode.'] })
    }
  };
}

function xlsxFacts(caseDef, profile, catalog) {
  const raw = profile.rawProbeFacts;
  const structure = raw.structure ?? {};
  const style = raw.style ?? {};
  const confidence = 'high';
  const ev = {
    sheets: catalog.add('sheets.0001', 'openxml-xlsx-sheets', 'rawProbeFacts.structure.sheets', structure.sheets ?? [], { confidence }),
    sheetStats: catalog.add('sheetStats.0001', 'openxml-xlsx-sheet-stats', 'rawProbeFacts.structure.sheetStats', structure.sheetStats ?? [], { confidence }),
    styles: catalog.add('styleCounts.0001', 'openxml-xlsx-style-counts', 'rawProbeFacts.style', style ?? {}, { confidence })
  };
  return {
    workbook: {
      sheetCount: fact(structure.sheetCount ?? 0, [ev.sheets], { confidence }),
      sheets: fact(structure.sheets ?? [], [ev.sheets], { confidence })
    },
    layout: {
      sheetStats: fact(structure.sheetStats ?? [], [ev.sheetStats], { confidence }),
      dimensions: fact((structure.sheetStats ?? []).map((s) => ({ path: s.path, dimension: s.dimension, rowCount: s.rowCount, cellCount: s.cellCount })), [ev.sheetStats], { confidence, derived: true })
    },
    styles: {
      cellStyleCount: fact(style.cellStyleCount ?? 0, [ev.styles], { confidence }),
      fontCount: fact(style.fontCount ?? 0, [ev.styles], { confidence }),
      fillCount: fact(style.fillCount ?? 0, [ev.styles], { confidence }),
      borderCount: fact(style.borderCount ?? 0, [ev.styles], { confidence }),
      sharedStringCount: fact(style.sharedStringCount ?? 0, [ev.styles], { confidence })
    },
    formulasAndMerges: {
      mergedCellCount: fact((structure.sheetStats ?? []).reduce((sum, s) => sum + (s.mergedCellCount ?? 0), 0), [ev.sheetStats], { confidence, derived: true }),
      formulaCount: fact((structure.sheetStats ?? []).reduce((sum, s) => sum + (s.formulaCount ?? 0), 0), [ev.sheetStats], { confidence, derived: true })
    }
  };
}

function pptxFacts(caseDef, profile, catalog) {
  const raw = profile.rawProbeFacts;
  const structure = raw.structure ?? {};
  const style = raw.style ?? {};
  const confidence = 'medium';
  const ev = {
    deck: catalog.add('deck.0001', 'openxml-pptx-deck-counts', 'rawProbeFacts.structure', {
      slideCount: structure.slideCount,
      layoutCount: structure.layoutCount,
      masterCount: structure.masterCount
    }, { confidence }),
    slideStats: catalog.add('slideStats.0001', 'openxml-pptx-slide-stats', 'rawProbeFacts.structure.slideStats', (structure.slideStats ?? []).slice(0, 10), { confidence }),
    theme: catalog.add('theme.0001', 'openxml-pptx-theme-counts', 'rawProbeFacts.style', style, { confidence })
  };
  return {
    deck: {
      slideCount: fact(structure.slideCount ?? 0, [ev.deck], { confidence }),
      layoutCount: fact(structure.layoutCount ?? 0, [ev.deck], { confidence }),
      masterCount: fact(structure.masterCount ?? 0, [ev.deck], { confidence })
    },
    layout: {
      slideStatsSample: fact((structure.slideStats ?? []).slice(0, 10), [ev.slideStats], { confidence, notes: ['Baseline sample for productization mapping; not renderer-grade layout.'] })
    },
    theme: {
      themeCount: fact(style.themeCount ?? 0, [ev.theme], { confidence }),
      themeName: fact(style.themeName ?? null, [ev.theme], { confidence }),
      colorSchemeCount: fact(style.colorSchemeCount ?? 0, [ev.theme], { confidence }),
      fontSchemeCount: fact(style.fontSchemeCount ?? 0, [ev.theme], { confidence })
    }
  };
}

function pdfFacts(caseDef, profile, catalog) {
  const raw = profile.rawProbeFacts;
  const structure = raw.structure ?? {};
  const style = raw.style ?? {};
  const confidence = 'medium';
  const ev = {
    page: catalog.add('page.0001', 'pdf-byte-probe-page-text-image-counts', 'rawProbeFacts.structure', structure, { confidence }),
    fonts: catalog.add('fontRefs.0001', 'pdf-byte-probe-font-refs', 'rawProbeFacts.style.fontRefs', style.fontRefs ?? [], { confidence })
  };
  return {
    layout: {
      pageCount: fact(structure.pageCount ?? 0, [ev.page], { confidence })
    },
    typography: {
      fontRefs: fact(style.fontRefs ?? [], [ev.fonts], { confidence, notes: ['PDF font refs are subset/resource names, not normalized authoring fonts.'] })
    },
    diagnostics: {
      textOperatorCount: fact(structure.textOperatorCount ?? 0, [ev.page], { confidence }),
      imageCount: fact(structure.imageCount ?? 0, [ev.page], { confidence }),
      hasTextLayerHint: fact(Boolean(structure.hasTextLayerHint), [ev.page], { confidence }),
      scanLikely: fact(Boolean(structure.scanLikely), [ev.page], { confidence })
    }
  };
}

function styleFactsFor(caseDef, profile, catalog) {
  if (caseDef.format === 'docx') return docxFacts(caseDef, profile, catalog);
  if (caseDef.format === 'xlsx') return xlsxFacts(caseDef, profile, catalog);
  if (caseDef.format === 'pptx') return pptxFacts(caseDef, profile, catalog);
  if (caseDef.format === 'pdf') return pdfFacts(caseDef, profile, catalog);
  throw new Error(`Unsupported format ${caseDef.format}`);
}

export function buildStyleFacts(caseDef) {
  if (!fs.existsSync(caseDef.sourceProfile)) {
    throw new Error(`Missing source profile for case ${caseDef.caseId}: ${caseDef.sourceProfile}`);
  }
  const profile = JSON.parse(fs.readFileSync(caseDef.sourceProfile, 'utf8'));
  if (profile.source?.fileType !== caseDef.format) {
    throw new Error(`Format mismatch for case ${caseDef.caseId}: expected ${caseDef.format}, got ${profile.source?.fileType}`);
  }
  const catalog = createEvidenceCatalog(caseDef, profile);
  const styleFacts = styleFactsFor(caseDef, profile, catalog);
  const diagnostics = [
    {
      severity: 'info',
      code: 'style.high_fidelity_boundary',
      message: 'High-fidelity means fixture-backed deterministic parser fidelity for covered fields, not visual/export reproduction.'
    },
    {
      severity: caseDef.priority === 'baseline' ? 'warning' : 'info',
      code: `${caseDef.format}.coverage.${caseDef.priority}`,
      message: caseDef.priority === 'baseline'
        ? `${caseDef.format.toUpperCase()} style extraction is baseline coverage and should remain diagnostic until richer fixtures exist.`
        : `${caseDef.format.toUpperCase()} style extraction has primary fixture-backed assertions.`
    }
  ];
  const deterministicPart = {
    schemaVersion: 'format-profile-style-facts.v0',
    caseId: caseDef.caseId,
    source: {
      fileType: profile.source.fileType,
      fileName: fileNameOnly(profile.source.fileName ?? profile.source.path),
      sha256: profile.source.sha256,
      byteSize: profile.source.byteSize
    },
    parser: {
      deterministic: true,
      authority: 'deterministic-parser',
      sourceProfile: caseDef.sourceProfile,
      evidenceAuthority: 'parser-generated'
    },
    capabilities: {
      canGuideGeneration: true,
      canGuideAdaptation: true,
      canGuideExport: false,
      highFidelityScope: 'fixture-backed deterministic style facts only',
      llmMayInterpret: true,
      llmMayCreateFacts: false
    },
    styleFacts,
    evidence: catalog.evidence,
    diagnostics
  };
  const styleFactsSha256 = sha256(deterministicPart);
  return {
    ...deterministicPart,
    metadata: { styleFactsSha256 }
  };
}
