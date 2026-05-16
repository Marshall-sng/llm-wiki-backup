import { asArray, inferFormat, truncateText, unique } from './utils.mjs';

function normalizeHeading(text) {
  const value = truncateText(text, 120) || '';
  return value
    .replace(/^(candidate|heading)[:：]?\s*/i, '')
    .replace(/^(\d+)[\.、]\s*/u, '$1. ')
    .replace(/^(第[一二三四五六七八九十百零〇]+章)\s*/u, '$1 ')
    .replace(/^(第[一二三四五六七八九十百零〇]+条)\s*/u, '$1 ')
    .trim();
}

function isNoisyHeading(text) {
  const value = (text || '').trim();
  if (!value) return true;
  if (/^[\d\s\.、-]+$/.test(value)) return true;
  if (value.length > 95 && !/^第.+[章节]/u.test(value)) return true;
  return false;
}

function buildStructure(profile, format) {
  if (format === 'docx') {
    const candidates = asArray(profile?.structureProfile?.sections)
      .map((section) => normalizeHeading(section?.text || section?.title))
      .filter((text) => text && !isNoisyHeading(text));
    return unique(candidates).slice(0, 10);
  }
  if (format === 'xlsx') {
    const sections = asArray(profile?.structureProfile?.sections).map((s) => s?.text || s?.title || s?.name).filter(Boolean);
    const sheetCount = profile?.rawProbeFacts?.structure?.sheetCount ?? profile?.styleProfile?.formatSpecific?.sheetCount;
    return unique(sections.length ? sections : [`工作簿包含 ${sheetCount ?? '若干'} 个工作表/数据区域线索`]).slice(0, 8);
  }
  if (format === 'pptx') {
    const slideCount = profile?.structureProfile?.slideCount ?? profile?.rawProbeFacts?.structure?.slideCount;
    const layoutCount = profile?.structureProfile?.layoutCount;
    return [`逐页汇报结构：约 ${slideCount ?? '若干'} 页`, layoutCount ? `版式线索：${layoutCount} 个 layout` : '保留页级叙事边界'].filter(Boolean);
  }
  if (format === 'pdf') {
    const pageCount = profile?.structureProfile?.pageCount;
    const textOps = profile?.structureProfile?.textOperatorCount;
    const scanLikely = profile?.structureProfile?.scanLikely;
    return [`PDF 参考成品：约 ${pageCount ?? '若干'} 页`, `文本层线索：${textOps ?? 0} 个文本操作符`, `扫描倾向：${scanLikely ? '可能扫描件' : '未判定为扫描件'}`];
  }
  return [];
}

function buildStyle(profile) {
  const typography = profile?.styleProfile?.typography || {};
  const layout = profile?.styleProfile?.layout || {};
  const fonts = asArray(typography.fontUsage).slice(0, 5).map((x) => `${x.value}(${x.count})`);
  const sizes = asArray(typography.fontSizeUsageHalfPoints).slice(0, 5).map((x) => `${x.value} half-points(${x.count})`);
  const lines = [];
  if (fonts.length) lines.push(`字体使用：${fonts.join('、')}`);
  if (sizes.length) lines.push(`字号线索：${sizes.join('、')}`);
  if (typography.styleCount !== undefined) lines.push(`样式定义：${typography.styleCount} 个`);
  if (layout.pageSizeTwips) lines.push(`页面线索：${layout.pageSizeTwips.width ?? '?'}×${layout.pageSizeTwips.height ?? '?'} twips`);
  return lines;
}

export function buildDeterministicCleanupOverlay(input) {
  const profile = input.deterministicProfile;
  const format = input.case.formatType || inferFormat(profile);
  return {
    schemaVersion: 'format-profile-deterministic-cleanup.v0',
    caseId: input.case.caseId,
    formatType: format,
    structureSummary: buildStructure(profile, format),
    styleSummary: buildStyle(profile),
    boundarySummary: [
      '保留来源事实边界，不根据格式画像虚构内容。',
      '格式画像只约束结构、表达和诊断，不代表正式导出样式。',
    ],
  };
}
