#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(harnessRoot, '..', '..');

const TYPE_TARGETS = {
  docx: ['page', 'title', 'heading', 'numbering', 'typography', 'paragraph', 'table', 'boundary'],
  xlsx: ['workbook', 'sheet', 'table-region', 'header', 'data-region', 'style', 'formula', 'number-format', 'boundary'],
  pptx: ['deck', 'theme', 'layout', 'cover-slide', 'content-slide', 'bullet', 'visual-density', 'boundary'],
  pdf: ['page', 'text-layer', 'image-density', 'font-ref', 'scan-risk', 'reference-use', 'boundary'],
};

const MIN_RULES = { docx: 16, xlsx: 12, pptx: 12, pdf: 8 };

function parseArgs(argv) {
  const args = { caseId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--case') args.caseId = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return 'Usage: node experiments/format-spec/scripts/run-format-spec.mjs [--case CASE_ID]';
}

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(sortStable(value), null, 2)}\n`, 'utf8');
}

async function writeText(file, value) {
  await writeFile(file, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(file) {
  return sha256Text(await readFile(file));
}

function sortStable(value) {
  if (Array.isArray(value)) return value.map(sortStable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortStable(value[key])]));
  }
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function halfPointToPt(value) {
  const parsed = numberValue(value);
  return parsed === undefined ? undefined : Number((parsed / 2).toFixed(1));
}

function twipsToCm(value) {
  const parsed = numberValue(value);
  return parsed === undefined ? undefined : Number((parsed * 2.54 / 1440).toFixed(2));
}

function topUsage(items, fallback = '未探测') {
  const arr = asArray(items);
  if (!arr.length) return fallback;
  const first = arr[0];
  if (typeof first === 'string') return first;
  return first?.value ? `${first.value}${first.count ? `（${first.count}次）` : ''}` : fallback;
}

function evidenceRefs(input, predicate, limit = 4) {
  return asArray(input.rawEvidence).filter(predicate).map((item) => item.id).filter(Boolean).slice(0, limit);
}

function rawTextSamples(input) {
  return asArray(input.rawEvidence)
    .map((item) => typeof item.text === 'string' ? item.text.trim() : '')
    .filter((text) => text.length > 20);
}

function rule(id, target, ruleText, detail, source, confidence, evidenceRefsValue = []) {
  return {
    id,
    target,
    rule: ruleText,
    detail,
    source,
    confidence,
    ...(evidenceRefsValue.length ? { evidenceRefs: evidenceRefsValue } : {}),
  };
}

function baseBoundaries() {
  return [
    '来源事实优先于格式约束；不得根据格式画像虚构组织、金额、条款、结论或引用。',
    'FormatSpec 只约束结构、表达、排版和诊断，不承诺导出文件。',
    'FormatSpec 不承诺视觉还原；证据不足的字段必须降级为建议或诊断。',
    '默认数据范围为 evidence-only；draft prompt 不展示 raw evidence 正文或证据转储。',
  ];
}

function buildDocxSpec(caseConfig, input) {
  const profile = input.deterministicProfile || {};
  const style = asObject(profile.styleProfile);
  const typography = asObject(style.typography);
  const layout = asObject(style.layout);
  const page = asObject(layout.page);
  const bodyStyle = asArray(typography.styles).find((item) => item?.styleId === 'BodyText') || {};
  const tableStyle = asArray(typography.styles).find((item) => item?.styleId === 'TableText') || {};
  const bodyFont = asArray(bodyStyle.fonts).find((font) => font !== 'en-US') || topUsage(typography.fontUsage);
  const bodyPt = halfPointToPt(asArray(bodyStyle.fontSizesHalfPoints)[0]) || halfPointToPt(asArray(typography.fontSizeUsageHalfPoints)[0]?.value);
  const tablePt = halfPointToPt(asArray(tableStyle.fontSizesHalfPoints)[0]);
  const widthCm = twipsToCm(page.widthTwips);
  const heightCm = twipsToCm(page.heightTwips);
  const pageEvidence = evidenceRefs(input, (e) => e.kind?.includes('style') || e.pointer?.includes('layout'), 3);
  const styleEvidence = evidenceRefs(input, (e) => e.kind?.includes('style'), 5);
  const structureEvidence = evidenceRefs(input, (e) => e.kind?.includes('paragraph') || e.kind?.includes('structure'), 5);
  const rules = [
    rule('docx-page-1', 'page', '采用纵向成文页面规则。', `检测页尺寸约 ${widthCm ?? '未知'}cm × ${heightCm ?? '未知'}cm；接近 A4 纵向时按正式文稿页面组织。`, 'detected', 'medium', pageEvidence),
    rule('docx-page-2', 'page', '页边距只作为诊断线索。', '当前页边距探测值存在极端 twips 值时，不把它作为正式排版承诺；产品化时应显示为“边距证据不足/需人工确认”。', 'inferred', 'medium', pageEvidence),
    rule('docx-title-1', 'title', '主标题独立成行，表达文种和主题。', '标题不复用来源文件题名；生成或适配时由用户底稿事实决定标题内容。建议居中或显著区分于正文。', 'standard-default', 'medium'),
    rule('docx-title-2', 'title', '标题层级与正文条款分离。', '候选标题过长或像正文条款时，应降级为条款/正文线索，不进入标题主线。', 'inferred', 'high', structureEvidence),
    rule('docx-heading-1', 'heading', '一级标题使用章/大节层级。', '制度/正式文稿可使用“第一章”“一、”等一级编号；一级标题应短，不承载完整条款正文。', 'standard-default', 'medium'),
    rule('docx-heading-2', 'heading', '二级标题使用节/条款组层级。', '可使用“第一节”“（一）”等二级编号；二级标题用于组织事项类别，不写成完整业务说明。', 'standard-default', 'medium'),
    rule('docx-heading-3', 'heading', '三级标题用于具体事项或条目。', '可使用“1.”“（1）”等序号；同一层级编号符号保持一致。', 'standard-default', 'medium'),
    rule('docx-numbering-1', 'numbering', '条款编号必须连续且同层同形。', '当来源编号定义不足时，按文本语义保持章、条、款、项的顺序，不强行复制来源编号元数据。', 'inferred', 'medium', structureEvidence),
    rule('docx-numbering-2', 'numbering', '条款正文不被提升为标题。', '长句、金额阈值、适用范围和审批权限等内容应保留在正文条款内，不进入格式约束本身。', 'inferred', 'high', structureEvidence),
    rule('docx-typography-1', 'typography', '正文中文主字体优先采用检测到的正文样式字体。', `正文样式检测到 ${bodyFont || '未知字体'}；全局字体统计如 ${topUsage(typography.fontUsage)} 只作兼容线索。`, 'detected', 'medium', styleEvidence),
    rule('docx-typography-2', 'typography', '正文字号按检测到的正文样式换算为 pt。', `正文样式字号约 ${bodyPt ?? '未知'}pt；字号统计只作为辅助，不覆盖正文样式定义。`, 'detected', 'medium', styleEvidence),
    rule('docx-typography-3', 'typography', '表格文字可小于正文。', `检测到表格文本样式字号约 ${tablePt ?? '未知'}pt；表内文字应保证可读，不扩写为正文段落。`, 'detected', 'medium', styleEvidence),
    rule('docx-paragraph-1', 'paragraph', '正文段落按正式文稿段落组织。', '建议使用首行缩进、左对齐或两端对齐、稳定行距；不得因为来源候选标题多而把正文压成清单。', 'standard-default', 'medium'),
    rule('docx-paragraph-2', 'paragraph', '段前段后保持克制。', '同一层级段落的间距应一致；标题前后可有区分，但不制造额外内容。', 'standard-default', 'medium'),
    rule('docx-table-1', 'table', '表格承载清单、阈值、对照或审批矩阵。', '表格内容应保持短语化、字段化；表格事实来自用户底稿，不由格式画像补造。', 'inferred', 'medium', structureEvidence),
    rule('docx-table-2', 'table', '表格标题和表头需要与正文层级分离。', '表格标题可在表前单独说明；表头用于字段名，不混入正文条款编号。', 'standard-default', 'medium'),
    rule('docx-boundary-1', 'boundary', '格式只约束写法，不提供来源正文内容。', '生成 prompt 不展示来源条款原文；只给标题层级、编号、字体字号、段落和表格规则。', 'standard-default', 'high'),
  ];
  return {
    spec: {
      page: { widthCm, heightCm, orientation: page.orientation || 'portrait-or-unspecified' },
      typography: { bodyFont, bodyFontSizePt: bodyPt, tableFontSizePt: tablePt, detectedFontUsageTop: topUsage(typography.fontUsage) },
      hierarchy: ['主标题', '一级标题/章', '二级标题/节或组', '条', '款/项'],
      tablePolicy: '表格作为结构化清单/矩阵，不作为正文扩写来源。',
    },
    rules,
  };
}

function buildXlsxSpec(caseConfig, input) {
  const profile = input.deterministicProfile || {};
  const style = asObject(profile.styleProfile);
  const layout = asObject(style.layout);
  const formatSpecific = asObject(style.formatSpecific);
  const typography = asObject(style.typography);
  const colors = asObject(style.colors);
  const sheet = asArray(layout.sheets)[0] || {};
  const sheetEvidence = evidenceRefs(input, (e) => e.kind?.includes('sheet') || e.kind?.includes('structure'), 4);
  const styleEvidence = evidenceRefs(input, (e) => e.kind?.includes('style'), 4);
  const rules = [
    rule('xlsx-workbook-1', 'workbook', '以工作簿/工作表为最高组织单元。', `检测到工作表区域线索 ${sheet.dimension || '未知'}；输出应围绕表格结构和指标口径，而不是改写成长文。`, 'detected', 'medium', sheetEvidence),
    rule('xlsx-sheet-1', 'sheet', '工作表命名只作为定位线索。', '不根据工作表名推断不存在的业务主题；主题必须来自用户任务或底稿。', 'detected', 'medium', sheetEvidence),
    rule('xlsx-table-region-1', 'table-region', '区分标题区、表头区、数据区和备注/合计区。', '当只有区域维度证据时，默认按首行/前若干行可能为标题或表头处理，并在诊断中提示需确认。', 'inferred', 'medium', sheetEvidence),
    rule('xlsx-header-1', 'header', '表头应短、字段化、同列口径一致。', '生成表格说明时应优先解释字段关系、单位和统计口径，不擅自改列名。', 'standard-default', 'medium'),
    rule('xlsx-data-region-1', 'data-region', '数据区保持行列关系。', '不得把单元格事实打散为无序段落；观察结论应能追溯到行/列维度。', 'standard-default', 'high'),
    rule('xlsx-style-1', 'style', '单元格样式统计作为复杂度线索。', `检测到字体数 ${typography.fontCount ?? 0}、填充数 ${colors.fillCount ?? 0}、边框数 ${colors.borderCount ?? 0}。`, 'detected', 'medium', styleEvidence),
    rule('xlsx-style-2', 'style', '样式差异不能自动解释为业务含义。', '颜色、边框、填充只能提示层级或强调可能性；不能自动推断风险等级、状态或结论。', 'standard-default', 'high'),
    rule('xlsx-formula-1', 'formula', '公式和合计必须保持事实边界。', '若探测不到公式明细，只能提示“公式证据不足”；不得自动计算、补齐或重写指标。', 'inferred', 'high', styleEvidence),
    rule('xlsx-number-format-1', 'number-format', '金额、比例、日期、数量必须保留单位。', '生成说明时要显式保留用户给出的单位和口径；未知单位不得补造。', 'standard-default', 'high'),
    rule('xlsx-number-format-2', 'number-format', '数字格式优先服务可读性。', '百分比、金额和日期的格式应在底稿中统一说明；不输出伪 Excel 公式。', 'standard-default', 'medium'),
    rule('xlsx-boundary-1', 'boundary', 'XLSX 画像只指导表格类底稿。', '可生成指标说明、口径解释、观察要点；不承诺生成或导出电子表格文件。', 'standard-default', 'high'),
    rule('xlsx-boundary-2', 'boundary', '不把样式统计转成业务事实。', `共享字符串数量 ${formatSpecific.sharedStringCount ?? '未知'} 只说明文本规模，不说明业务重要性。`, 'detected', 'medium', styleEvidence),
  ];
  return {
    spec: {
      workbook: { sheetDimension: sheet.dimension || null, sharedStringCount: formatSpecific.sharedStringCount ?? null },
      styleComplexity: { fontCount: typography.fontCount ?? 0, fillCount: colors.fillCount ?? 0, borderCount: colors.borderCount ?? 0 },
      outputMode: 'table-interpretation-and-metric-notes',
    },
    rules,
  };
}

function buildPptxSpec(caseConfig, input) {
  const profile = input.deterministicProfile || {};
  const style = asObject(profile.styleProfile);
  const layout = asObject(style.layout);
  const formatSpecific = asObject(style.formatSpecific);
  const typography = asObject(style.typography);
  const colors = asObject(style.colors);
  const deckEvidence = evidenceRefs(input, (e) => e.kind?.includes('slide') || e.kind?.includes('structure'), 4);
  const styleEvidence = evidenceRefs(input, (e) => e.kind?.includes('style'), 4);
  const rules = [
    rule('pptx-deck-1', 'deck', '以演示文稿页序组织内容。', `检测到约 ${layout.slideCount ?? 0} 页、${layout.layoutCount ?? 0} 个版式、${layout.masterCount ?? 0} 个母版。`, 'detected', 'medium', deckEvidence),
    rule('pptx-theme-1', 'theme', '主题只作为视觉风格线索。', `主题线索：${formatSpecific.themeName || '未命名主题'}；颜色方案 ${colors.colorSchemeCount ?? 0}、字体方案 ${typography.fontSchemeCount ?? 0}。`, 'detected', 'medium', styleEvidence),
    rule('pptx-layout-1', 'layout', '按封面、目录/过渡、内容、总结组织。', '无法稳定识别每页版式时，输出逐页大纲而非承诺复刻具体占位符。', 'inferred', 'medium', deckEvidence),
    rule('pptx-cover-1', 'cover-slide', '封面应包含主题、汇报对象或时间等必要字段。', '封面内容必须来自用户任务；不复用来源模板中的占位文本或示例署名。', 'standard-default', 'high'),
    rule('pptx-content-1', 'content-slide', '每页聚焦一个主题。', '内容页标题保持短句；正文使用 3-5 个要点或一个图表/表格解释。', 'standard-default', 'medium'),
    rule('pptx-content-2', 'content-slide', '避免把长文直接铺进幻灯片。', '若底稿是报告文字，应拆为页标题、核心观点、支撑事实、备注。', 'standard-default', 'medium'),
    rule('pptx-bullet-1', 'bullet', '正文 bullet 保持并列和短句。', '每条要点建议一行表达一个判断；不要混用多个编号体系。', 'standard-default', 'medium'),
    rule('pptx-bullet-2', 'bullet', '项目符号不生成新事实。', 'bullet 只重组用户事实；不得补造数据、案例或结论。', 'standard-default', 'high'),
    rule('pptx-visual-density-1', 'visual-density', '控制页面信息密度。', '图片/形状较多的模板线索意味着内容应更摘要化；文字页避免超过页面可读密度。', 'inferred', 'medium', deckEvidence),
    rule('pptx-visual-density-2', 'visual-density', '图表页需要标题、图示对象和结论句。', '没有图表数据时，只给图表占位建议，不生成伪图表数据。', 'standard-default', 'high'),
    rule('pptx-boundary-1', 'boundary', 'PPTX 画像用于汇报大纲和逐页草稿。', '不承诺生成 PPTX 文件，不承诺还原主题、动画、母版或图片位置。', 'standard-default', 'high'),
    rule('pptx-boundary-2', 'boundary', '模板占位文本不得进入业务内容。', '来源中的示例占位词、人名、标题样例只作为模板诊断，不进入最终 prompt。', 'inferred', 'high', deckEvidence),
  ];
  return {
    spec: {
      deck: { slideCount: layout.slideCount ?? 0, layoutCount: layout.layoutCount ?? 0, masterCount: layout.masterCount ?? 0 },
      theme: { name: formatSpecific.themeName || null, colorSchemeCount: colors.colorSchemeCount ?? 0, fontSchemeCount: typography.fontSchemeCount ?? 0 },
      outputMode: 'slide-outline-and-page-by-page-draft',
    },
    rules,
  };
}

function buildPdfSpec(caseConfig, input) {
  const profile = input.deterministicProfile || {};
  const style = asObject(profile.styleProfile);
  const layout = asObject(style.layout);
  const typography = asObject(style.typography);
  const formatSpecific = asObject(style.formatSpecific);
  const pageEvidence = evidenceRefs(input, (e) => e.kind?.includes('pdf') || e.kind?.includes('style'), 5);
  const fontRefs = asArray(typography.fontRefs).slice(0, 5).join('、') || '未探测';
  const rules = [
    rule('pdf-page-1', 'page', 'PDF 以页为参考单位。', `检测到页数 ${layout.pageCount ?? 0}；可参考篇幅和页面密度，但不反推完整可编辑模板。`, 'detected', 'medium', pageEvidence),
    rule('pdf-text-layer-1', 'text-layer', '文本层线索决定可参考程度。', `文本层提示：${formatSpecific.hasTextLayerHint ? '存在' : '不足'}；文本层不足时只做低置信参考。`, 'detected', 'medium', pageEvidence),
    rule('pdf-image-density-1', 'image-density', '图片密度只作为版面复杂度诊断。', '图片较多时，生成底稿应保持图文分区建议，不补造图片内容或位置。', 'inferred', 'medium', pageEvidence),
    rule('pdf-font-ref-1', 'font-ref', '字体引用不是可编辑字体承诺。', `字体引用线索：${fontRefs}；这些是 PDF 资源名，只能用于诊断。`, 'detected', 'medium', pageEvidence),
    rule('pdf-scan-risk-1', 'scan-risk', '扫描风险影响置信度。', `扫描风险：${formatSpecific.scanLikely ? '较高' : '未明显触发'}；扫描风险高时不得输出细排版规则。`, 'detected', 'medium', pageEvidence),
    rule('pdf-reference-1', 'reference-use', 'PDF 适合作为成品参考。', '可参考页数、栏目密度、图文比例、正式程度；不把 PDF 当作可直接套用模板。', 'standard-default', 'medium'),
    rule('pdf-boundary-1', 'boundary', 'PDF 画像不承诺视觉还原。', '不能承诺跨页布局、图像位置、页眉页脚、印章、水印或装订效果。', 'standard-default', 'high'),
    rule('pdf-boundary-2', 'boundary', 'PDF 不产生来源事实。', '任何正文、数据、引用和结论必须来自用户底稿或授权资料，不从字体/页面线索推断。', 'standard-default', 'high'),
  ];
  return {
    spec: {
      page: { pageCount: layout.pageCount ?? 0, hasTextLayerHint: formatSpecific.hasTextLayerHint === true, scanLikely: formatSpecific.scanLikely === true },
      typography: { fontRefs: asArray(typography.fontRefs).slice(0, 8) },
      outputMode: 'finished-reference-diagnostics',
    },
    rules,
  };
}

function buildFormatSpec(caseConfig, input) {
  const type = caseConfig.formatType;
  const builders = { docx: buildDocxSpec, xlsx: buildXlsxSpec, pptx: buildPptxSpec, pdf: buildPdfSpec };
  const built = builders[type](caseConfig, input);
  return {
    schemaVersion: 'format-spec.v0',
    caseId: caseConfig.caseId,
    sourceFileType: type,
    documentIntent: input.deterministicProfile?.documentKind?.label || `${type.toUpperCase()} format reference`,
    confidence: input.deterministicProfile?.styleProfile?.confidence || 'medium',
    globalBoundaries: baseBoundaries(),
    contentLeakagePolicy: {
      includeSourceBodyText: false,
      includeRawEvidenceDump: false,
      promptMayIncludeEvidenceIds: false,
    },
    rules: built.rules,
    typeSpecific: { [type]: built.spec },
  };
}

function renderFormatSpec(spec) {
  const lines = [];
  lines.push(`# FormatSpec：${spec.caseId}`);
  lines.push('');
  lines.push(`- 文件类型：${spec.sourceFileType.toUpperCase()}`);
  lines.push(`- 文档定位：${spec.documentIntent}`);
  lines.push(`- 置信度：${spec.confidence}`);
  lines.push('');
  lines.push('## 全局边界');
  for (const item of spec.globalBoundaries) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## 详细格式规则');
  for (const item of spec.rules) {
    lines.push(`### ${item.id} / ${item.target}`);
    lines.push(`- 规则：${item.rule}`);
    lines.push(`- 细节：${item.detail}`);
    lines.push(`- 来源：${item.source}；置信度：${item.confidence}`);
    if (item.evidenceRefs?.length) lines.push(`- 证据：${item.evidenceRefs.join(', ')}`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

function renderDraftPrompt(spec) {
  const lines = [];
  lines.push('## 格式约束（FormatSpec）');
  lines.push('');
  lines.push(`本次选择的格式画像类型为 ${spec.sourceFileType.toUpperCase()}，定位为“${spec.documentIntent}”。请只使用以下格式规则约束结构、表达和诊断，不要复制或补造来源文件正文内容。`);
  lines.push('');
  lines.push('### 必守边界');
  lines.push('- 来源事实优先于格式约束。');
  lines.push('- 不根据格式画像虚构事实、金额、条款、结论或引用。');
  lines.push('- 不承诺导出或视觉还原。');
  lines.push('- 如底稿事实与格式规则冲突，以底稿事实为准，并在诊断中说明。');
  lines.push('');
  lines.push('### 详细格式规则');
  for (const item of spec.rules) {
    lines.push(`- 【${item.target}】${item.rule}${item.detail ? ` ${item.detail}` : ''}`);
  }
  lines.push('');
  lines.push('### 输出要求');
  if (spec.sourceFileType === 'pptx') lines.push('- 输出汇报大纲或逐页草稿，而不是 PPTX 文件。');
  else if (spec.sourceFileType === 'xlsx') lines.push('- 输出表格说明、指标口径、观察结论或表格化草稿，而不是电子表格文件。');
  else if (spec.sourceFileType === 'pdf') lines.push('- 输出低/中置信参考下的底稿或诊断，不反推 PDF 版式。');
  else lines.push('- 输出正式文稿/制度/报告类底稿，保持层级、编号、段落和表格规则清晰。');
  return `${lines.join('\n').trim()}\n`;
}

function containsRawText(rendered, samples) {
  const hits = [];
  for (const sample of samples) {
    if (sample.length > 20 && rendered.includes(sample)) hits.push(sample.slice(0, 80));
  }
  return hits;
}

function normalizeLeakText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。；：、“”‘’（）《》【】()\\[\\]{}:;,.!?！？\\-—_]/g, '')
    .toLowerCase();
}

function containsNormalizedRawText(rendered, samples) {
  const normalizedRendered = normalizeLeakText(rendered);
  const hits = [];
  for (const sample of samples) {
    const normalizedSample = normalizeLeakText(sample);
    if (normalizedSample.length >= 16 && normalizedRendered.includes(normalizedSample)) hits.push(sample.slice(0, 80));
  }
  return hits;
}

function evaluate(caseConfig, input, spec, renderedMd, promptMd) {
  const diagnostics = [];
  const type = caseConfig.formatType;
  const minRules = caseConfig.expected?.minRules || MIN_RULES[type];
  const targets = new Set(spec.rules.map((item) => item.target));
  const allText = `${renderedMd}\n${promptMd}`;

  function fail(code, message) { diagnostics.push({ severity: 'error', code, message }); }
  function warn(code, message) { diagnostics.push({ severity: 'warning', code, message }); }

  if (spec.schemaVersion !== 'format-spec.v0') fail('schema-version', 'schemaVersion must be format-spec.v0');
  for (const key of ['caseId', 'sourceFileType', 'documentIntent', 'confidence']) if (!spec[key]) fail('schema-field', `missing ${key}`);
  if (spec.sourceFileType !== type) fail('type-mismatch', `sourceFileType ${spec.sourceFileType} does not match case ${type}`);
  if (!spec.typeSpecific || Object.keys(spec.typeSpecific).length !== 1 || !spec.typeSpecific[type]) fail('type-specific', 'typeSpecific must contain only current file type branch');
  if (!Array.isArray(spec.globalBoundaries) || spec.globalBoundaries.length < 3) fail('boundaries', 'globalBoundaries must include at least 3 items');
  if (spec.contentLeakagePolicy?.includeSourceBodyText !== false) fail('content-policy', 'includeSourceBodyText must be false');
  if (spec.contentLeakagePolicy?.includeRawEvidenceDump !== false) fail('content-policy', 'includeRawEvidenceDump must be false');
  if (spec.contentLeakagePolicy?.promptMayIncludeEvidenceIds !== false) fail('content-policy', 'promptMayIncludeEvidenceIds must be false');
  if (!Array.isArray(spec.rules) || spec.rules.length < minRules) fail('rule-count', `rules must be >= ${minRules}`);
  for (const target of TYPE_TARGETS[type]) if (!targets.has(target)) fail('coverage', `missing target ${target}`);
  for (const item of spec.rules) {
    for (const key of ['id', 'target', 'rule', 'detail', 'source', 'confidence']) if (!item[key]) fail('rule-field', `rule ${item.id || '<unknown>'} missing ${key}`);
  }

  const rawHits = containsRawText(allText, rawTextSamples(input));
  if (rawHits.length) fail('content-leak', `rendered artifacts contain raw evidence text: ${rawHits.slice(0, 3).join(' | ')}`);
  const normalizedRawHits = containsNormalizedRawText(allText, rawTextSamples(input));
  if (normalizedRawHits.length) fail('content-leak-normalized', `rendered artifacts contain normalized raw evidence text: ${normalizedRawHits.slice(0, 3).join(' | ')}`);
  const allowedTargets = new Set(TYPE_TARGETS[type]);
  for (const item of spec.rules) if (!allowedTargets.has(item.target)) fail('target-enum', `rule ${item.id || '<unknown>'} uses target outside ${type}: ${item.target}`);
  for (const item of spec.rules) {
    if (!['detected', 'inferred', 'standard-default'].includes(item.source)) fail('source-enum', `rule ${item.id || '<unknown>'} has invalid source: ${item.source}`);
    if (!['high', 'medium', 'low'].includes(item.confidence)) fail('confidence-enum', `rule ${item.id || '<unknown>'} has invalid confidence: ${item.confidence}`);
  }
  for (const forbidden of ['rawEvidence', 'sha256', 'raw.docx.paragraph', 'raw.pptx.slide', 'raw.xlsx.sheet']) {
    if (promptMd.includes(forbidden)) fail('prompt-evidence-dump', `draft prompt contains evidence dump marker: ${forbidden}`);
  }
  for (const forbidden of ['完全还原', '像素级', '高保真复刻', '保证导出', '自动生成 DOCX', '自动生成 XLSX', '自动生成 PPTX', '自动生成 PDF']) {
    if (allText.includes(forbidden)) fail('boundary-forbidden', `forbidden promise phrase: ${forbidden}`);
  }
  for (const required of ['不根据格式画像虚构事实', '不承诺导出']) {
    if (!allText.includes(required)) fail('boundary-required', `missing required boundary: ${required}`);
  }
  if (!allText.includes('不承诺视觉')) warn('boundary-wording', 'visual reproduction boundary should be explicit');
  if (type === 'docx' && !/(字体|字号)/.test(allText)) fail('detail', 'DOCX must mention typography detail');
  if (type === 'docx' && !/(缩进|对齐|行距)/.test(allText)) fail('detail', 'DOCX must mention indentation/alignment/line spacing detail');
  if (type === 'xlsx' && !/(表头|数据区|单位|数字格式)/.test(allText)) fail('detail', 'XLSX must mention table header/data region/unit or number format');
  if (type === 'pptx' && !/(封面|内容页|bullet|要点)/i.test(allText)) fail('detail', 'PPTX must mention slide type or bullet density');
  if (type === 'pdf' && !/(文本层|扫描风险)/.test(allText)) fail('detail', 'PDF must mention text layer or scan risk');

  return {
    schemaVersion: 'format-spec-evaluation.v0',
    caseId: caseConfig.caseId,
    verdict: diagnostics.some((item) => item.severity === 'error') ? 'fail' : 'pass',
    metrics: {
      ruleCount: spec.rules.length,
      targetCount: targets.size,
      diagnosticCount: diagnostics.length,
    },
    diagnostics,
  };
}

async function loadCases(args) {
  const caseDir = path.join(harnessRoot, 'cases');
  const files = (await readdir(caseDir)).filter((file) => file.endsWith('.case.json')).sort();
  const cases = [];
  for (const file of files) {
    const config = await readJson(path.join(caseDir, file));
    if (!args.caseId || config.caseId === args.caseId) cases.push(config);
  }
  if (!cases.length) throw new Error(`No cases matched${args.caseId ? `: ${args.caseId}` : ''}`);
  return cases;
}

async function runCase(caseConfig) {
  const inputPath = path.resolve(repoRoot, caseConfig.inputPath);
  const casePath = path.join(harnessRoot, 'cases', `${caseConfig.caseId}.case.json`);
  const input = await readJson(inputPath);
  const outputDir = path.join(harnessRoot, 'outputs', caseConfig.caseId);
  await mkdir(outputDir, { recursive: true });
  const spec = buildFormatSpec(caseConfig, input);
  const rendered = renderFormatSpec(spec);
  const prompt = renderDraftPrompt(spec);
  const evaluation = evaluate(caseConfig, input, spec, rendered, prompt);
  await writeJson(path.join(outputDir, 'format-spec.json'), spec);
  await writeText(path.join(outputDir, 'format-spec.md'), rendered);
  await writeText(path.join(outputDir, 'draft-prompt.md'), prompt);
  await writeJson(path.join(outputDir, 'evaluation.json'), evaluation);
  return {
    caseId: caseConfig.caseId,
    formatType: caseConfig.formatType,
    verdict: evaluation.verdict,
    ruleCount: evaluation.metrics.ruleCount,
    diagnostics: evaluation.diagnostics,
    provenance: {
      inputPath: caseConfig.inputPath,
      inputSha256: await sha256File(inputPath),
      caseSha256: await sha256File(casePath),
      scriptSha256: await sha256File(__filename),
    },
    outputDir: path.relative(repoRoot, outputDir).replaceAll('\\', '/'),
  };
}

function renderSummary(results) {
  const lines = [];
  lines.push('# FormatSpec Experiment Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Case | Type | Verdict | Rules | Output |');
  lines.push('| --- | --- | --- | ---: | --- |');
  for (const result of results) lines.push(`| ${result.caseId} | ${result.formatType} | ${result.verdict} | ${result.ruleCount} | ${result.outputDir} |`);
  lines.push('');
  const failed = results.filter((item) => item.verdict !== 'pass');
  lines.push(`Result: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length) {
    lines.push('');
    lines.push('## Failures');
    for (const result of failed) {
      lines.push(`### ${result.caseId}`);
      for (const diagnostic of result.diagnostics) lines.push(`- [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const cases = await loadCases(args);
  const results = [];
  for (const item of cases) results.push(await runCase(item));
  await mkdir(path.join(harnessRoot, 'reports'), { recursive: true });
  const summary = {
    schemaVersion: 'format-spec-summary.v0',
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((item) => item.verdict === 'pass').length,
    failed: results.filter((item) => item.verdict !== 'pass').map((item) => item.caseId),
    results,
  };
  await writeJson(path.join(harnessRoot, 'reports', 'latest-summary.json'), summary);
  await writeText(path.join(harnessRoot, 'reports', 'latest-summary.md'), renderSummary(results));
  for (const result of results) console.log(`${result.caseId}: ${result.verdict} rules=${result.ruleCount} output=${result.outputDir}`);
  if (summary.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
