#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
let root = 'experiments/format-profile-semantic-refinement/outputs';
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--root') root = args[++i];
}

const allowedRedacted = /\[REDACTED_(?:PATH|SECRET)\]/;
const checks = [
  { code: 'absolute_windows_path', pattern: /[A-Za-z]:\\[^\s"'<>]+/g },
  { code: 'unc_path', pattern: /\\\\[^\s"'<>]+\\[^\s"'<>]+/g },
  { code: 'file_url', pattern: /file:\/\/\/[^\s"'<>]+/gi },
  { code: 'absolute_posix_path', pattern: /\/(?:Users|home|mnt|tmp|var\/folders)\/[^\s"'<>]+/g },
  { code: 'repo_sample_path', pattern: /runtime[\\/]format-profile[\\/]samples[\\/][^\s"'<>]*/g },
  { code: 'llm_wiki_path', pattern: /\.llm-wiki[\\/][^\s"'<>]*/g },
  { code: 'omx_path', pattern: /\.omx[\\/][^\s"'<>]*/g },
  { code: 'path_field', pattern: /"(?:source\.path|runtimeDir|profilePath|instructionPath|diagnosticsPath|sourcePath|path)"\s*:\s*"(?!\[REDACTED_PATH\])[^"\n]+"/g },
  { code: 'secret_bearer', pattern: /Bearer\s+[A-Za-z0-9._-]{16,}/gi },
  { code: 'secret_sk', pattern: /sk-[A-Za-z0-9_-]{16,}/g },
  { code: 'secret_kv', pattern: /(?:api[_-]?key|token|secret)["'\s:=]+(?!\[REDACTED_SECRET\])[A-Za-z0-9._-]{12,}/gi },
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

function isTextFile(file) {
  return /\.(json|md|txt|sha256|raw)$/i.test(file) || !path.extname(file);
}

const findings = [];
try {
  const files = (await walk(root)).filter(isTextFile);
  for (const file of files) {
    const size = (await stat(file)).size;
    if (size > 2_000_000) findings.push({ file, code: 'oversized_artifact', match: `size=${size}` });
    const text = await readFile(file, 'utf8');
    for (const check of checks) {
      const matches = [...text.matchAll(check.pattern)].slice(0, 5).map((m) => m[0]);
      for (const match of matches) {
        if (allowedRedacted.test(match)) continue;
        findings.push({ file, code: check.code, match: match.slice(0, 160) });
      }
    }
    if (/source\.(?:snippet|fulltext\.chunk)\.\d{4}/.test(text)) {
      try {
        const json = JSON.parse(text);
        const chunks = Array.isArray(json?.chunks) ? json.chunks : [];
        for (const chunk of chunks) {
          const max = chunk.kind === 'source.fulltext.chunk' ? 1000 : 500;
          if ((chunk.text || '').length > max) findings.push({ file, code: 'chunk_over_cap', match: chunk.id });
        }
      } catch {}
    }
  }
} catch (error) {
  console.error(`scan failed: ${error.message}`);
  process.exit(1);
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, root, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, root }, null, 2));
