import fs from 'node:fs';
import path from 'node:path';

export const experimentRoot = path.resolve('experiments/format-profile-style-extraction');
export const runtimeRoot = path.resolve('runtime/format-profile-style-extraction');
export const casesDir = path.join(experimentRoot, 'cases');

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value, stableStringify) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

export function loadCases() {
  return fs.readdirSync(casesDir)
    .filter((name) => name.endsWith('.case.json'))
    .sort()
    .map((name) => readJson(path.join(casesDir, name)));
}

export function selectCases(caseId) {
  const cases = loadCases();
  if (!caseId) return cases;
  const selected = cases.filter((entry) => entry.caseId === caseId);
  if (selected.length === 0) {
    const known = cases.map((entry) => entry.caseId).join(', ');
    throw new Error(`Unknown case '${caseId}'. Known cases: ${known}`);
  }
  return selected;
}

export function parseArgs(argv) {
  const args = { mode: 'deterministic', caseId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--mode') args.mode = argv[++index];
    else if (token === '--case') args.caseId = argv[++index];
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}
