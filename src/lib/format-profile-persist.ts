import { createDirectory, readFile, writeFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"
import type { FormatProfileRecord } from "@/lib/format-profile"

export interface FormatProfileEnvelope {
  version: 1
  profiles: FormatProfileRecord[]
  activeProfileId: string | null
}

const FORMAT_PROFILES_FILE = ".llm-wiki/format-profiles.json"

async function ensureFormatProfileDir(projectPath: string): Promise<void> {
  await createDirectory(`${projectPath}/.llm-wiki`).catch(() => {})
}

export async function saveFormatProfiles(
  projectPath: string,
  profiles: FormatProfileRecord[],
  activeProfileId: string | null,
): Promise<void> {
  const pp = normalizePath(projectPath)
  await ensureFormatProfileDir(pp)
  const envelope: FormatProfileEnvelope = { version: 1, profiles, activeProfileId }
  await writeFile(`${pp}/${FORMAT_PROFILES_FILE}`, JSON.stringify(envelope, null, 2))
}

export async function loadFormatProfiles(projectPath: string): Promise<FormatProfileEnvelope> {
  const pp = normalizePath(projectPath)
  try {
    const content = await readFile(`${pp}/${FORMAT_PROFILES_FILE}`)
    const parsed = JSON.parse(content) as FormatProfileEnvelope | FormatProfileRecord[]
    if (Array.isArray(parsed)) {
      return { version: 1, profiles: parsed, activeProfileId: null }
    }
    if (parsed && Array.isArray(parsed.profiles)) {
      return {
        version: 1,
        profiles: parsed.profiles,
        activeProfileId: typeof parsed.activeProfileId === "string" ? parsed.activeProfileId : null,
      }
    }
    return { version: 1, profiles: [], activeProfileId: null }
  } catch {
    return { version: 1, profiles: [], activeProfileId: null }
  }
}
