import { invoke } from "@tauri-apps/api/core"
import type { FileNode, WikiProject } from "@/types/wiki"
import { ensureProjectId, upsertProjectInfo } from "@/lib/project-identity"

/** Raw shape returned by the Rust commands — id is attached client-side. */
interface RawProject {
  name: string
  path: string
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path })
}

export async function writeFile(path: string, contents: string): Promise<void> {
  return invoke<void>("write_file", { path, contents })
}

export async function writeBinaryFileBase64(path: string, contentsBase64: string): Promise<void> {
  return invoke<void>("write_binary_file_base64", { path, contentsBase64 })
}

export async function listDirectory(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("list_directory", { path })
}

export async function copyFile(
  source: string,
  destination: string
): Promise<void> {
  return invoke("copy_file", { source, destination })
}

export async function copyDirectory(
  source: string,
  destination: string
): Promise<string[]> {
  return invoke<string[]>("copy_directory", { source, destination })
}

export async function preprocessFile(path: string): Promise<string> {
  return invoke<string>("preprocess_file", { path })
}

export interface MarkitdownConversion {
  ok: boolean
  markdown?: string | null
  error?: string | null
  timedOut: boolean
}



export interface FormatProfileProbe {
  kind: "office_zip" | "pdf"
  officeKind?: "docx" | "xlsx" | "pptx"
  entryCount?: number
  hasMainDocument?: boolean
  relationships?: number
  contentTypesCount?: number
  header?: string
  structure?: Record<string, unknown>
  style?: Record<string, unknown>
}

export async function probeFormatProfile(path: string): Promise<FormatProfileProbe> {
  return invoke<FormatProfileProbe>("probe_format_profile", { path })
}
export async function convertWithMarkitdown(
  path: string,
): Promise<MarkitdownConversion> {
  return invoke<MarkitdownConversion>("convert_with_markitdown", { path })
}

export async function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path })
}

export async function findRelatedWikiPages(
  projectPath: string,
  sourceName: string
): Promise<string[]> {
  return invoke<string[]>("find_related_wiki_pages", { projectPath, sourceName })
}

export async function createDirectory(path: string): Promise<void> {
  return invoke<void>("create_directory", { path })
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>("file_exists", { path })
}

export async function fileModifiedMs(path: string): Promise<number | null> {
  return invoke<number | null>("file_modified_ms", { path })
}

/** Mirror of `commands::fs::FileBase64` (Rust side). */
export interface FileBase64 {
  base64: string
  mimeType: string
}

/**
 * Read any file off disk as base64 + a guessed mime type. The
 * vision-caption pipeline uses this to pick up extracted images
 * without having to read them as UTF-8 strings (PNG bytes aren't
 * valid UTF-8 — `readFile` would corrupt them).
 */
export async function readFileAsBase64(path: string): Promise<FileBase64> {
  return invoke<FileBase64>("read_file_as_base64", { path })
}

export async function createProject(
  name: string,
  path: string,
): Promise<WikiProject> {
  const raw = await invoke<RawProject>("create_project", { name, path })
  const id = await ensureProjectId(raw.path)
  await upsertProjectInfo(id, raw.path, raw.name)
  return { id, name: raw.name, path: raw.path }
}

export async function openProject(path: string): Promise<WikiProject> {
  const raw = await invoke<RawProject>("open_project", { path })
  const id = await ensureProjectId(raw.path)
  await upsertProjectInfo(id, raw.path, raw.name)
  return { id, name: raw.name, path: raw.path }
}

export async function openProjectFolder(path: string): Promise<void> {
  return invoke<void>("open_project_folder", { path })
}

export async function clipServerStatus(): Promise<string> {
  return invoke<string>("clip_server_status")
}
