import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { asArray, truncateText } from './utils.mjs';
import { collectAllowedEvidenceIds, sanitizeText } from './source-context.mjs';

function firstRefs(input, predicate, limit = 3) {
  return input.rawEvidence.filter(predicate).slice(0, limit).map((item) => item.id);
}

function fallbackRefs(input, limit = 2) {
  return input.rawEvidence.slice(0, limit).map((item) => item.id);
}

function valuesFromEvidence(input, predicate, fallbackValues, limit = 5) {
  const values = input.rawEvidence.filter(predicate).map((item) => item.text).filter(Boolean).map((x) => truncateText(x, 120));
  return (values.length ? values : fallbackValues).slice(0, limit);
}

function claim(value, evidenceRefs, rationale, inference = true) {
  return { value, evidenceRefs, inference, rationale };
}

function mockPassOverlay(input) {
  const format = input.case.formatType;
  const profile = input.deterministicProfile;
  const styleRefs = firstRefs(input, (x) => x.kind === 'profile.style' || x.kind.endsWith('.style'), 3);
  const diagRefs = firstRefs(input, (x) => x.kind === 'diagnostic', 1);
  const docKind = profile?.documentKind?.label || (format === 'xlsx' ? '表格/数据分析材料' : format === 'pptx' ? '汇报演示材料' : format === 'pdf' ? 'PDF 参考成品' : '正式文稿');
  let structureValues = [];
  let styleValues = [];
  let writingValues = [];
  let boundaryValues = [];
  let structureRefs = fallbackRefs(input, 2);

  if (format === 'docx') {
    structureRefs = firstRefs(input, (x) => x.kind === 'raw.docx.paragraph' || x.kind === 'profile.structure', 4);
    structureValues = valuesFromEvidence(input, (x) => x.kind === 'raw.docx.paragraph' && /第.+[章节]|总则|附则|第.+条/u.test(x.text || ''), [], 6);
    if (!structureValues.length) structureValues = ['正式制度类文稿，宜按章/条/款或编号条目组织。', '候选标题中存在较长条目，生成时应概括为层级线索而非逐字复用。'];
    styleValues = ['保留字体、字号、样式定义和页面 twips 等版式线索，用作写作层级提示。', '样式线索只作为段落层级和正式程度参考。'];
    writingValues = ['按制度/通知类正式文稿口吻组织底稿，先搭建章节，再填充用户事实。', '遇到候选标题过长或像正文条款时，应降噪为结构意图。'];
    boundaryValues = ['格式画像只约束结构、表达和诊断，不代表文件导出能力。', '不得根据画像补造公司事实、金额、条款或结论。'];
  } else if (format === 'xlsx') {
    structureRefs = firstRefs(input, (x) => x.kind === 'raw.xlsx.sheet' || x.kind === 'profile.structure', 3);
    structureValues = ['以工作表、字段、指标和数据区域为主要组织边界。', '生成底稿时优先输出表格化分析框架，而不是承诺生成 Excel 文件。'];
    styleValues = ['保留字体、填充、表格区域和工作表数量等线索，用于判断数据呈现密度。'];
    writingValues = ['围绕指标解释、口径说明、数据质量和后续填表步骤组织内容。'];
    boundaryValues = ['XLSX 画像用于表格结构和分析约束，不代表会生成电子表格成品。'];
  } else if (format === 'pptx') {
    structureRefs = firstRefs(input, (x) => x.kind === 'raw.pptx.slide' || x.kind === 'profile.structure', 3);
    structureValues = ['按逐页汇报叙事组织：封面/议题/主体/总结等页级边界。', '保留 slideCount、layoutCount、masterCount 等线索，用于控制内容粒度。'];
    styleValues = ['版式、母版、主题和颜色线索用于提示页面节奏与正式程度。'];
    writingValues = ['输出可转写到幻灯片的分页面底稿，每页聚焦一个观点。'];
    boundaryValues = ['PPTX 画像用于汇报底稿和页级结构建议，不代表会生成演示文件。'];
  } else if (format === 'pdf') {
    structureRefs = firstRefs(input, (x) => x.kind === 'raw.pdf.fact' || x.kind === 'profile.structure', 4);
    structureValues = ['PDF 作为参考成品，应先判断页数、文本层和扫描倾向。', '若文本层线索较弱，应降低内容抽取置信度并保留诊断。'];
    styleValues = ['字体、图片数量和页面对象只作为参考线索，不作为可编辑样式承诺。'];
    writingValues = ['生成时参考成品的主题密度和页面粒度，但事实必须来自用户材料。'];
    boundaryValues = ['PDF 画像只作为参考，不代表可编辑模板或导出能力。'];
  }

  return {
    schemaVersion: 'format-profile-llm-overlay.v0',
    caseId: input.case.caseId,
    confidence: { semanticConfidence: 'medium', notes: ['mock-pass overlay for harness validation'] },
    semanticOverlay: {
      documentKind: claim(docKind, fallbackRefs(input, 1), 'documentKind comes from deterministic profile label.', false),
      structureSummary: claim(structureValues, structureRefs.length ? structureRefs : fallbackRefs(input, 2), 'Structure summary is compressed from profile/evidence headings or format facts.', true),
      styleSummary: claim(styleValues, styleRefs.length ? styleRefs : fallbackRefs(input, 2), 'Style summary cites style evidence and avoids export promises.', true),
      writingConstraints: claim(writingValues, [...(structureRefs.length ? structureRefs.slice(0, 2) : fallbackRefs(input, 1)), ...(diagRefs || [])], 'Writing constraints preserve user fact boundary.', true),
      formatBoundaries: claim(boundaryValues, diagRefs.length ? diagRefs : fallbackRefs(input, 1), 'Boundaries are derived from capability diagnostics and harness policy.', true),
    },
    diagnostics: [{ severity: 'info', code: 'mock_pass', message: 'Mock overlay generated for harness validation.', evidenceRefs: fallbackRefs(input, 1) }],
  };
}

function resolveRealLlmConfig() {
  const provider = process.env.FORMAT_PROFILE_LLM_PROVIDER || process.env.LLM_PROVIDER || (process.env.MINIMAX_API_KEY ? 'minimax' : 'ollama');
  const isMiniMax = provider === 'minimax';
  const isOpenAI = provider === 'openai';
  if (provider === 'codex-cli') {
    return { provider, endpoint: 'codex-cli', model: process.env.FORMAT_PROFILE_CODEX_MODEL || process.env.FORMAT_PROFILE_LLM_MODEL || 'gpt-5.3-codex-spark', apiKey: '' };
  }
  const endpoint = process.env.FORMAT_PROFILE_LLM_ENDPOINT
    || (isMiniMax ? (process.env.MINIMAX_ENDPOINT || 'https://api.minimaxi.com/v1') : '')
    || (isOpenAI ? (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') : '')
    || process.env.OLLAMA_URL;
  const model = process.env.FORMAT_PROFILE_LLM_MODEL
    || (isMiniMax ? (process.env.MINIMAX_MODEL || 'MiniMax-M2.7-highspeed') : '')
    || (isOpenAI ? (process.env.OPENAI_MODEL || 'gpt-4.1-mini') : '')
    || process.env.OLLAMA_MODEL;
  const apiKey = process.env.FORMAT_PROFILE_LLM_API_KEY
    || (isMiniMax ? process.env.MINIMAX_API_KEY : '')
    || (isOpenAI ? process.env.OPENAI_API_KEY : '')
    || process.env.OPENAI_API_KEY
    || '';
  if (!endpoint) throw new Error('real-llm requires FORMAT_PROFILE_LLM_ENDPOINT, OLLAMA_URL, MINIMAX_ENDPOINT, or OPENAI_BASE_URL');
  if (!model) throw new Error('real-llm requires FORMAT_PROFILE_LLM_MODEL, OLLAMA_MODEL, MINIMAX_MODEL, or OPENAI_MODEL');
  if ((isMiniMax || isOpenAI) && !apiKey) throw new Error(`real-llm provider ${provider} requires an API key env var`);
  return { provider, endpoint, model, apiKey };
}

function buildChatCompletionsUrl(endpoint) {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

function compactProfileForPrompt(input) {
  const p = input.deterministicProfile;
  return {
    profileId: p.profileId,
    source: { fileName: p.source?.fileName, fileType: p.source?.fileType, byteSize: p.source?.byteSize, sha256: p.source?.sha256 },
    documentKind: p.documentKind,
    capabilities: p.capabilities,
    structureProfile: {
      confidence: p.structureProfile?.confidence,
      sectionPattern: p.structureProfile?.sectionPattern,
      counts: p.structureProfile?.counts,
      slideCount: p.structureProfile?.slideCount,
      pageCount: p.structureProfile?.pageCount,
      textOperatorCount: p.structureProfile?.textOperatorCount,
      imageCount: p.structureProfile?.imageCount,
      scanLikely: p.structureProfile?.scanLikely,
      sections: asArray(p.structureProfile?.sections).slice(0, 18),
    },
    styleProfile: {
      confidence: p.styleProfile?.confidence,
      layout: p.styleProfile?.layout,
      typography: {
        fonts: p.styleProfile?.typography?.fonts,
        fontUsage: asArray(p.styleProfile?.typography?.fontUsage).slice(0, 10),
        fontSizeUsageHalfPoints: asArray(p.styleProfile?.typography?.fontSizeUsageHalfPoints).slice(0, 10),
        styleCount: p.styleProfile?.typography?.styleCount,
        styles: asArray(p.styleProfile?.typography?.styles).slice(0, 8),
      },
      formatSpecific: p.styleProfile?.formatSpecific,
    },
    diagnostics: asArray(p.diagnostics).slice(0, 8),
  };
}

function compactSourceContextForPrompt(input) {
  return asArray(input.sourceContext?.chunks).map((item) => ({
    id: item.id,
    kind: item.kind,
    linkedEvidenceRefs: item.linkedEvidenceRefs,
    text: item.text,
    charLength: item.charLength,
    tokenEstimate: item.tokenEstimate,
    redactionStatus: item.redactionStatus,
    qualityFlags: item.qualityFlags,
  }));
}

function compactEvidenceForPrompt(input) {
  const priority = new Map([
    ['raw.docx.paragraph', 1], ['raw.xlsx.sheet', 1], ['raw.pptx.slide', 1], ['raw.pdf.fact', 1],
    ['profile.structure', 2], ['profile.style', 3], ['raw.docx.style', 3], ['diagnostic', 4],
  ]);
  return [...input.rawEvidence]
    .sort((a, b) => (priority.get(a.kind) || 9) - (priority.get(b.kind) || 9) || a.id.localeCompare(b.id))
    .slice(0, 70)
    .map((item) => ({ id: item.id, kind: item.kind, pointer: item.pointer, text: item.text, value: item.value }));
}

function buildRealLlmMessages(input) {
  const schemaHint = {
    schemaVersion: 'format-profile-llm-overlay.v0',
    caseId: input.case.caseId,
    confidence: { semanticConfidence: 'medium', notes: ['short notes'] },
    semanticOverlay: {
      documentKind: { value: '...', evidenceRefs: ['evidence.id'], inference: true, rationale: '...' },
      structureSummary: { value: ['...'], evidenceRefs: ['evidence.id'], inference: true, rationale: '...' },
      styleSummary: { value: ['...'], evidenceRefs: ['evidence.id'], inference: true, rationale: '...' },
      writingConstraints: { value: ['...'], evidenceRefs: ['evidence.id'], inference: true, rationale: '...' },
      formatBoundaries: { value: ['...'], evidenceRefs: ['evidence.id'], inference: true, rationale: '...' },
    },
    diagnostics: [{ severity: 'info', code: 'real_llm_refined', message: '...', evidenceRefs: ['evidence.id'] }],
  };
  const exactCaseId = input.case.caseId;
  return [
    {
      role: 'system',
      content: [
        '你是 FormatProfile 语义精炼器。',
        '只输出一个 JSON 对象，不要 Markdown，不要代码围栏，不要解释。',
        '输出必须符合 closed schema：只允许 schemaVersion, caseId, confidence, semanticOverlay, diagnostics。',
        'semanticOverlay 只允许 documentKind, structureSummary, styleSummary, writingConstraints, formatBoundaries。',
        `caseId 必须逐字等于 ${exactCaseId}，不要使用 sourceCaseId。`,
        '每个 claim 必须包含 value, evidenceRefs, inference, rationale。',
        'evidenceRefs 必须只引用 allowedEvidenceRefIds 中的原文字符串，例如 raw.docx.paragraph.0001、profile.style.0001、diagnostic.0001、source.snippet.0001。',
        '如果使用 sourceContext 中的片段/全文信息，相关 claim 必须引用对应 source.snippet.* 或 source.fulltext.chunk.* id。',
        '不要引用 deterministicProfileSummary、case、sourceCaseId、profileId 或 pointer 作为 evidenceRefs。',
        '禁止输出 renderedGenerationInstruction/finalGenerationInstruction。',
        '禁止提及手动输入模板、手填模板、高保真导出、精确复刻、导出成品。',
        '不得根据格式画像虚构事实；只概括结构、样式、写作边界。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: `Produce a semantic overlay JSON for this FormatProfile. Return JSON only. caseId MUST equal ${exactCaseId}.`,
        outputExampleShape: schemaHint,
        case: input.case,
        deterministicProfileSummary: compactProfileForPrompt(input),
        dataScope: input.dataScope,
        allowedEvidenceRefIds: collectAllowedEvidenceIds(input),
        evidence: compactEvidenceForPrompt(input),
        sourceContext: compactSourceContextForPrompt(input),
      }, null, 2),
    },
  ];
}

function extractAssistantContent(payload) {
  if (typeof payload?.choices?.[0]?.message?.content === 'string') return payload.choices[0].message.content;
  if (typeof payload?.choices?.[0]?.text === 'string') return payload.choices[0].text;
  if (typeof payload?.output_text === 'string') return payload.output_text;
  if (Array.isArray(payload?.output)) {
    const text = payload.output.flatMap((item) => item.content || []).map((c) => c.text || '').join('');
    if (text) return text;
  }
  throw new Error('real-llm response did not contain assistant content');
}

function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return extractJsonObject(fenced[1]);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

async function callCodexCli(input, cfg) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'format-profile-codex-'));
  const outputFile = path.join(tmpDir, 'last-message.txt');
  const prompt = buildRealLlmMessages(input).map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join('\n\n')
    + '\n\nReturn the JSON object only. Do not run tools. Do not read files.';
  const args = [
    'exec',
    '-C', process.cwd(),
    '--sandbox', 'read-only',
    '--ephemeral',
    '--output-last-message', outputFile,
    '--model', cfg.model,
    '-',
  ];
  try {
    const result = await new Promise((resolve, reject) => {
      const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'codex';
      const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'codex', ...args] : args;
      const child = spawn(command, commandArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('codex-cli timed out after 5 minutes'));
      }, 5 * 60 * 1000);
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      child.stdin.end(prompt);
    });
    let finalText = '';
    try { finalText = await readFile(outputFile, 'utf8'); } catch {}
    if (result.code !== 0 && !finalText.trim()) {
      throw new Error(`codex-cli exited ${result.code}: ${(result.stderr || result.stdout).slice(0, 1000)}`);
    }
    const assistantContent = finalText.trim() || result.stdout.trim();
    return {
      status: 'llm_completed',
      rawText: extractJsonObject(assistantContent),
      providerRawText: sanitizeText(assistantContent).text,
      provider: { provider: cfg.provider, endpoint: cfg.endpoint, model: cfg.model },
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function callRealLlm(input) {
  const cfg = resolveRealLlmConfig();
  if (cfg.provider === 'codex-cli') return callCodexCli(input, cfg);
  const url = buildChatCompletionsUrl(cfg.endpoint);
  const body = {
    model: cfg.model,
    messages: buildRealLlmMessages(input),
    stream: false,
    temperature: 0.1,
    max_tokens: 2400,
  };
  const headers = {
    'Content-Type': 'application/json',
    ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  try {
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const responseText = await resp.text();
    if (!resp.ok) throw new Error(`real-llm HTTP ${resp.status}: ${responseText.slice(0, 500)}`);
    const payload = JSON.parse(responseText);
    const assistantContent = extractAssistantContent(payload);
    return {
      status: 'llm_completed',
      rawText: extractJsonObject(assistantContent),
      providerRawText: sanitizeText(assistantContent).text,
      provider: { provider: cfg.provider, endpoint: url.replace(/\/chat\/completions$/i, ''), model: cfg.model },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runLlmRefiner(input, { mode, allowExternalLlm = false } = {}) {
  if (mode === 'disabled') return { status: 'not_attempted' };
  if (mode === 'mock-pass') return { status: 'llm_completed', rawText: JSON.stringify(mockPassOverlay(input), null, 2) };
  if (mode === 'mock-hallucination') {
    const overlay = mockPassOverlay(input);
    overlay.semanticOverlay.structureSummary.evidenceRefs = ['missing.evidence.9999'];
    overlay.semanticOverlay.structureSummary.value = ['这是不存在证据支持的虚构结构。'];
    return { status: 'llm_completed', rawText: JSON.stringify(overlay, null, 2) };
  }
  if (mode === 'mock-overreach-instruction') {
    const overlay = mockPassOverlay(input);
    overlay.renderedGenerationInstruction = 'LLM 越权输出最终指令，并承诺高保真导出。';
    return { status: 'llm_completed', rawText: JSON.stringify(overlay, null, 2) };
  }
  if (mode === 'mock-invalid-json') return { status: 'llm_completed', rawText: '{ not valid json ' };
  if (mode === 'mock-schema-invalid') return { status: 'llm_completed', rawText: JSON.stringify({ schemaVersion: 'format-profile-llm-overlay.v0', caseId: input.case.caseId, semanticOverlay: { structureSummary: { value: 42 } } }) };
  if (mode === 'mock-error') throw new Error('mock llm transport error');
  if (mode === 'real-llm') {
    if (!allowExternalLlm) throw new Error('real-llm mode requires --allow-external-llm');
    return callRealLlm(input);
  }
  throw new Error(`Unknown mode: ${mode}`);
}
