import { createDirectory, readFile, writeFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"
import type { TemplateRecord } from "@/stores/template-store"

export interface TemplateEnvelope {
  version: 1
  templates: TemplateRecord[]
  activeTemplateId: string | null
}

const TEMPLATES_FILE = ".llm-wiki/templates.json"

async function ensureTemplateDir(projectPath: string): Promise<void> {
  await createDirectory(`${projectPath}/.llm-wiki`).catch(() => {})
}

export async function saveTemplates(
  projectPath: string,
  templates: TemplateRecord[],
  activeTemplateId: string | null,
): Promise<void> {
  const pp = normalizePath(projectPath)
  await ensureTemplateDir(pp)
  const envelope: TemplateEnvelope = { version: 1, templates, activeTemplateId }
  await writeFile(`${pp}/${TEMPLATES_FILE}`, JSON.stringify(envelope, null, 2))
}

export async function loadTemplates(projectPath: string): Promise<TemplateEnvelope> {
  const pp = normalizePath(projectPath)
  try {
    const content = await readFile(`${pp}/${TEMPLATES_FILE}`)
    const parsed = JSON.parse(content) as TemplateEnvelope | TemplateRecord[]
    if (Array.isArray(parsed)) {
      return { version: 1, templates: parsed, activeTemplateId: null }
    }
    if (parsed && Array.isArray(parsed.templates)) {
      return {
        version: 1,
        templates: parsed.templates,
        activeTemplateId: typeof parsed.activeTemplateId === "string" ? parsed.activeTemplateId : null,
      }
    }
    return { version: 1, templates: [], activeTemplateId: null }
  } catch {
    return { version: 1, templates: [], activeTemplateId: null }
  }
}
