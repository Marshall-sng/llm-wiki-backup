import { asArray, sha256, truncateText } from './utils.mjs';

function claimValues(claim) {
  if (!claim) return [];
  const value = claim.value;
  return Array.isArray(value) ? value.map((item) => truncateText(item, 220)).filter(Boolean) : [truncateText(value, 300)].filter(Boolean);
}

function renderList(title, values) {
  const items = asArray(values).filter(Boolean);
  if (!items.length) return '';
  return `\n### ${title}\n${items.map((value) => `- ${value}`).join('\n')}\n`;
}

function renderEvidenceRefs(claim) {
  const refs = asArray(claim?.evidenceRefs).slice(0, 8);
  return refs.length ? `（证据：${refs.join(', ')}）` : '';
}

export function renderGenerationInstruction(input, overlay, evaluatorReport) {
  const profile = input.deterministicProfile;
  const maxChars = input.case?.constraints?.maxInstructionChars || 4000;
  const lines = [];
  lines.push(`# 格式画像语义精炼约束: ${input.case.caseId}`);
  lines.push('');
  lines.push('## 适用边界');
  lines.push(`- 文件类型：${input.case.formatType}`);
  lines.push(`- 来源画像：${profile.profileId || input.case.sourceCaseId}`);
  lines.push('- 本指令由 harness 根据确定性画像和已验收 LLM overlay 渲染；LLM 不直接生成最终指令。');
  lines.push('- 保留来源事实边界，不根据格式画像虚构内容；不承诺版式还原或文件导出能力。');

  const semantic = overlay.semanticOverlay || {};
  const documentKind = claimValues(semantic.documentKind);
  if (documentKind.length) lines.push(renderList('文档定位', documentKind.map((x) => `${x} ${renderEvidenceRefs(semantic.documentKind)}`)));
  const structure = claimValues(semantic.structureSummary);
  if (structure.length) lines.push(renderList('结构组织建议', structure));
  const style = claimValues(semantic.styleSummary);
  if (style.length) lines.push(renderList('样式/版式线索', style));
  const writing = claimValues(semantic.writingConstraints);
  if (writing.length) lines.push(renderList('写作约束', writing));
  const boundaries = claimValues(semantic.formatBoundaries);
  if (boundaries.length) lines.push(renderList('格式边界', boundaries));

  lines.push('\n## 诊断边界');
  lines.push(`- 语义置信度：${overlay.confidence?.semanticConfidence || 'unknown'}`);
  if (evaluatorReport?.metrics?.qualityScore !== undefined) lines.push(`- Harness 质量分：${evaluatorReport.metrics.qualityScore.toFixed(3)}`);
  lines.push('- 若用户事实材料与格式画像冲突，以用户事实材料为准，并记录诊断。');

  let rendered = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  if (rendered.length > maxChars) {
    rendered = rendered.slice(0, maxChars - 80).trimEnd() + '\n\n- [truncated] 已按 case 字数预算截断，保留边界约束。\n';
  }
  return rendered;
}

export function hashInstruction(text) {
  return sha256(text);
}
