import { createDirectory, readFile, writeFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"
import type { DraftRecord } from "@/stores/draft-store"

interface DraftEnvelope {
  version: 1
  drafts: DraftRecord[]
}

const DRAFTS_FILE = ".llm-wiki/drafts.json"

async function ensureDraftDir(projectPath: string): Promise<void> {
  await createDirectory(`${projectPath}/.llm-wiki`).catch(() => {})
}

export async function saveDrafts(projectPath: string, drafts: DraftRecord[]): Promise<void> {
  const pp = normalizePath(projectPath)
  await ensureDraftDir(pp)
  const envelope: DraftEnvelope = { version: 1, drafts }
  await writeFile(`${pp}/${DRAFTS_FILE}`, JSON.stringify(envelope, null, 2))
}

export async function loadDrafts(projectPath: string): Promise<DraftRecord[]> {
  const pp = normalizePath(projectPath)
  try {
    const content = await readFile(`${pp}/${DRAFTS_FILE}`)
    const parsed = JSON.parse(content) as DraftEnvelope | DraftRecord[]
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.drafts)) return parsed.drafts
    return []
  } catch {
    return []
  }
}
