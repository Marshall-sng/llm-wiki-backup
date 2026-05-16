import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  const input = typeof value === 'string' ? value : stableJson(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function truncateText(value, max = 240) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function inferFormat(profile, fallback = 'unknown') {
  return profile?.source?.fileType || profile?.rawProbeFacts?.kind || profile?.rawProbeFacts?.officeKind || fallback;
}

export function evidenceItem({ id, kind, sourcePath, pointer, text, value }) {
  const item = { id, kind, pointer };
  if (sourcePath) item.sourcePath = sourcePath;
  const clipped = truncateText(text);
  if (clipped) item.text = clipped;
  if (value !== undefined) item.value = value;
  item.sha256 = sha256(item);
  return item;
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeText(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value, 'utf8');
}

export function relPath(repoRoot, file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}

export function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
