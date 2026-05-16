import crypto from 'node:crypto';

export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
  }
  return value;
}

export function stableStringify(value, spaces = 2) {
  return JSON.stringify(sortDeep(value), null, spaces);
}

export function sha256(value) {
  const text = typeof value === 'string' ? value : stableStringify(value, 0);
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
