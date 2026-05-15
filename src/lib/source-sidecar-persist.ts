import { createDirectory, writeFile } from "@/commands/fs"
import type { SourceSidecar } from "./source-sidecar-types"

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/")
}

function joinPath(...parts: string[]): string {
  return normalizeSlashes(parts.join("/"))
}

export function safeSidecarFileName(sidecar: SourceSidecar): string {
  const hash = sidecar.source.content_hash?.slice(0, 16)
  const sourcePart = sidecar.source.title ?? sidecar.source.source_id
  const safeSource = sourcePart
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0)
    .pop()
    ?.replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    || "source"
  return hash ? `${safeSource}.${hash}.sidecar.json` : `${safeSource}.sidecar.json`
}

export function sourceSidecarDirectory(projectPath: string): string {
  return joinPath(projectPath, ".llm-wiki", "sidecars")
}

export function sourceSidecarPath(projectPath: string, sidecar: SourceSidecar): string {
  return joinPath(sourceSidecarDirectory(projectPath), safeSidecarFileName(sidecar))
}

export function serializeSourceSidecar(sidecar: SourceSidecar): string {
  return `${JSON.stringify(sidecar, null, 2)}\n`
}

export async function persistSourceSidecar(projectPath: string, sidecar: SourceSidecar): Promise<string> {
  const directory = sourceSidecarDirectory(projectPath)
  const path = sourceSidecarPath(projectPath, sidecar)
  await createDirectory(directory)
  await writeFile(path, serializeSourceSidecar(sidecar))
  return path
}
